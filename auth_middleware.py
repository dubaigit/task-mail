#!/usr/bin/env python3
"""
JWT Authentication Middleware for Email Intelligence System
Provides secure token-based authentication with proper validation
"""

import os
import secrets
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
import logging

import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv not available, use environment variables directly
    pass

logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================

class AuthConfig:
    """Authentication configuration with secure defaults"""
    
    def __init__(self):
        self.JWT_SECRET = self._get_jwt_secret()
        self.JWT_ALGORITHM = "HS256"
        self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
        self.JWT_REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))
        self.PRODUCTION_MODE = os.getenv("PRODUCTION_MODE", "false").lower() == "true"
        
        # Log configuration status (without exposing secrets)
        logger.info(f"Auth configured - Production: {self.PRODUCTION_MODE}, "
                   f"Token expires: {self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES}min, "
                   f"Secret length: {len(self.JWT_SECRET)} chars")
    
    def _get_jwt_secret(self) -> str:
        """Get or generate JWT secret key"""
        secret = os.getenv("JWT_SECRET")
        
        if not secret:
            # Generate secure random secret
            secret = secrets.token_urlsafe(64)
            logger.warning("No JWT_SECRET environment variable found. Generated temporary secret. "
                          "Set JWT_SECRET environment variable for production use.")
        
        if len(secret) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters long for security")
        
        return secret

auth_config = AuthConfig()

# ============================================================================
# Data Models
# ============================================================================

class UserModel(BaseModel):
    """User model for authentication"""
    user_id: str
    email: Optional[str] = None
    permissions: List[str] = ["read"]
    created_at: datetime = None
    
    def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission"""
        return permission in self.permissions or "admin" in self.permissions

class TokenData(BaseModel):
    """Token payload structure"""
    user_id: str
    permissions: List[str]
    exp: datetime
    iat: datetime
    token_type: str = "access"

class LoginRequest(BaseModel):
    """Login request model"""
    email: str
    password: str

class TokenResponse(BaseModel):
    """Token response model"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserModel

# ============================================================================
# Database-Backed User Management (Production Security)
# ============================================================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database session management
try:
    from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON
    from sqlalchemy.ext.declarative import declarative_base
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.sql import func
    
    # Use same database as main application
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./email_intelligence_production.db")
    engine = create_engine(DATABASE_URL, echo=False)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Database User model
    Base = declarative_base()
    
    class DBUser(Base):
        """Database User model for secure authentication"""
        __tablename__ = 'auth_users'
        
        id = Column(Integer, primary_key=True, autoincrement=True)
        user_id = Column(String(100), unique=True, nullable=False, index=True)
        email = Column(String(255), unique=True, nullable=False, index=True)
        hashed_password = Column(String(255), nullable=False)
        permissions = Column(JSON, default=list)
        is_active = Column(String(10), default='true')
        created_at = Column(DateTime(timezone=True), default=func.now())
        updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
        
        def __repr__(self):
            return f"<DBUser(email='{self.email}', user_id='{self.user_id}')>"
    
    # Create tables if they don't exist (but not during testing)
    if not os.getenv('TESTING'):
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            logger.warning(f"Could not create database tables: {e}. Tables may need to be created manually.")
    
except ImportError as e:
    logger.error(f"Database imports failed: {e}. Using fallback in-memory store.")
    # Fallback to in-memory store if database is not available
    SessionLocal = None
    DBUser = None

def get_db_session():
    """Get database session"""
    if SessionLocal:
        return SessionLocal()
    return None

def create_default_admin_user():
    """Create default admin user from environment variables on first run"""
    if not SessionLocal or not DBUser:
        logger.warning("Database not available, skipping admin user creation")
        return
        
    session = get_db_session()
    try:
        # Check if any users exist
        existing_users = session.query(DBUser).count()
        if existing_users > 0:
            logger.info("Users already exist in database")
            return
            
        # Create admin user from environment variables
        admin_email = os.getenv("ADMIN_EMAIL", "admin@yourdomain.com")
        admin_password = os.getenv("ADMIN_PASSWORD")
        
        if not admin_password:
            # Generate secure random password if not provided
            admin_password = secrets.token_urlsafe(16)
            logger.warning(f"No ADMIN_PASSWORD set. Generated secure password for {admin_email}: {admin_password}")
            logger.warning("Set ADMIN_PASSWORD environment variable for production use")
        
        admin_user = DBUser(
            user_id=f"admin_{secrets.token_hex(4)}",
            email=admin_email,
            hashed_password=pwd_context.hash(admin_password),
            permissions=["read", "write", "admin"],
            is_active="true"
        )
        
        session.add(admin_user)
        session.commit()
        logger.info(f"Created default admin user: {admin_email}")
        
    except Exception as e:
        logger.error(f"Failed to create default admin user: {e}")
        session.rollback()
    finally:
        session.close()

# Initialize default admin user on startup
create_default_admin_user()

# ============================================================================
# Core Authentication Functions
# ============================================================================

def create_access_token(user_data: Dict) -> str:
    """Create JWT access token with proper expiration"""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=auth_config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "user_id": user_data["user_id"],
        "email": user_data["email"],
        "permissions": user_data["permissions"],
        "exp": expire,
        "iat": now,
        "token_type": "access"
    }
    
    token = jwt.encode(payload, auth_config.JWT_SECRET, algorithm=auth_config.JWT_ALGORITHM)
    logger.info(f"Created access token for user {user_data['user_id']}")
    return token

def create_refresh_token(user_data: Dict) -> str:
    """Create JWT refresh token with extended expiration"""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=auth_config.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    
    payload = {
        "user_id": user_data["user_id"],
        "exp": expire,
        "iat": now,
        "token_type": "refresh"
    }
    
    token = jwt.encode(payload, auth_config.JWT_SECRET, algorithm=auth_config.JWT_ALGORITHM)
    logger.info(f"Created refresh token for user {user_data['user_id']}")
    return token

def verify_token(token: str, expected_type: str = "access") -> Dict:
    """Verify and decode JWT token with comprehensive error handling"""
    try:
        payload = jwt.decode(
            token, 
            auth_config.JWT_SECRET, 
            algorithms=[auth_config.JWT_ALGORITHM]
        )
        
        # Validate token type
        if payload.get("token_type") != expected_type:
            logger.warning(f"Invalid token type: expected {expected_type}, got {payload.get('token_type')}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {expected_type}",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Validate required fields
        required_fields = ["user_id", "exp", "iat"]
        if expected_type == "access":
            required_fields.extend(["email", "permissions"])
        
        for field in required_fields:
            if field not in payload:
                logger.error(f"Token missing required field: {field}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token structure",
                    headers={"WWW-Authenticate": "Bearer"}
                )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"}
        )

def authenticate_user(email: str, password: str) -> Optional[Dict]:
    """Authenticate user credentials securely using database"""
    if not SessionLocal or not DBUser:
        logger.error("Database not available for authentication")
        return None
        
    session = get_db_session()
    try:
        user = session.query(DBUser).filter(DBUser.email == email).first()
        
        if not user:
            logger.warning(f"Authentication attempt for non-existent user: {email}")
            return None
            
        if user.is_active != "true":
            logger.warning(f"Authentication attempt for inactive user: {email}")
            return None
        
        if not pwd_context.verify(password, user.hashed_password):
            logger.warning(f"Failed authentication attempt for user: {email}")
            return None
        
        logger.info(f"Successful authentication for user: {email}")
        
        # Convert to dict format expected by the rest of the system
        return {
            "user_id": user.user_id,
            "email": user.email,
            "hashed_password": user.hashed_password,
            "permissions": user.permissions or ["read"],
            "created_at": user.created_at
        }
        
    except Exception as e:
        logger.error(f"Database error during authentication: {e}")
        return None
    finally:
        session.close()

# ============================================================================
# FastAPI Dependencies
# ============================================================================

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserModel:
    """Get current authenticated user from JWT token"""
    try:
        payload = verify_token(credentials.credentials, "access")
        
        user = UserModel(
            user_id=payload["user_id"],
            email=payload.get("email"),
            permissions=payload.get("permissions", ["read"]),
            created_at=datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating user credentials: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[UserModel]:
    """Optional authentication - returns None if no valid token"""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None

def require_permission(permission: str):
    """Dependency factory to check user has specific permission"""
    async def permission_checker(current_user: UserModel = Depends(get_current_user)):
        if not current_user.has_permission(permission):
            logger.warning(f"Permission denied: user {current_user.user_id} lacks '{permission}' permission")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required"
            )
        return current_user
    return permission_checker

def require_admin():
    """Dependency to require admin permissions"""
    return require_permission("admin")

# ============================================================================
# Authentication Utilities
# ============================================================================

def create_user_tokens(user_data: Dict) -> TokenResponse:
    """Create both access and refresh tokens for user"""
    access_token = create_access_token(user_data)
    refresh_token = create_refresh_token(user_data)
    
    user_model = UserModel(
        user_id=user_data["user_id"],
        email=user_data["email"],
        permissions=user_data["permissions"],
        created_at=user_data.get("created_at", datetime.now(timezone.utc))
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=auth_config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_model
    )

def validate_refresh_token_and_create_new(refresh_token: str) -> TokenResponse:
    """Validate refresh token and create new token pair using database"""
    try:
        payload = verify_token(refresh_token, "refresh")
        user_id = payload["user_id"]
        
        if not SessionLocal or not DBUser:
            logger.error("Database not available for token refresh")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication system unavailable"
            )
        
        session = get_db_session()
        try:
            user = session.query(DBUser).filter(DBUser.user_id == user_id).first()
            
            if not user or user.is_active != "true":
                logger.warning(f"Refresh token user not found or inactive: {user_id}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive"
                )
            
            # Convert to dict format
            user_data = {
                "user_id": user.user_id,
                "email": user.email,
                "hashed_password": user.hashed_password,
                "permissions": user.permissions or ["read"],
                "created_at": user.created_at
            }
            
            return create_user_tokens(user_data)
            
        finally:
            session.close()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

# ============================================================================
# Security Utilities
# ============================================================================

def get_auth_status() -> Dict:
    """Get authentication system status"""
    users_count = 0
    database_connected = False
    
    if SessionLocal and DBUser:
        try:
            session = get_db_session()
            users_count = session.query(DBUser).filter(DBUser.is_active == "true").count()
            database_connected = True
            session.close()
        except Exception as e:
            logger.error(f"Error checking user count: {e}")
    
    return {
        "production_mode": auth_config.PRODUCTION_MODE,
        "token_expire_minutes": auth_config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
        "refresh_expire_days": auth_config.JWT_REFRESH_TOKEN_EXPIRE_DAYS,
        "algorithm": auth_config.JWT_ALGORITHM,
        "secret_configured": bool(auth_config.JWT_SECRET and len(auth_config.JWT_SECRET) >= 32),
        "users_count": users_count,
        "database_connected": database_connected
    }

def hash_password(password: str) -> str:
    """Hash password securely"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)
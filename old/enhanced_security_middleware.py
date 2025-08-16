#!/usr/bin/env python3
"""
Enhanced Security Middleware for 2025 Compliance
Fixes critical security issues identified in compliance report:
- Access control failures (401/403 responses)
- Missing security headers implementation
- Rate limiting enforcement
- OIDC authentication integration
"""

import os
import json
import time
import logging
from typing import Dict, List, Optional, Any, Callable, Tuple
from datetime import datetime, timedelta, timezone
import asyncio
from fastapi import Request, Response, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import hashlib
import secrets
import ipaddress
from urllib.parse import urlparse

# Import our security modules
from oidc_auth import get_current_oidc_user, OIDCUserInfo, oidc_manager
from privacy_compliance import privacy_compliance, ProcessingPurpose, require_data_processing_consent
from secrets_management import secret_manager, get_secret

logger = logging.getLogger(__name__)

class EnhancedSecurityConfig:
    """Enhanced security configuration for 2025 compliance"""
    
    # Access Control
    REQUIRE_AUTHENTICATION = True
    ENFORCE_HTTPS = True
    ALLOWED_ORIGINS = ["https://localhost:3000", "https://localhost:8000"]
    
    # Rate Limiting (enhanced)
    GLOBAL_RATE_LIMIT = 1000  # requests per minute per IP
    AUTH_RATE_LIMIT = 10      # authentication attempts per minute
    API_RATE_LIMIT = 100      # API calls per minute per user
    SENSITIVE_RATE_LIMIT = 20  # sensitive operations per minute
    
    # Security Headers (2025 compliant)
    SECURITY_HEADERS = {
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": (
            "geolocation=(), microphone=(), camera=(), "
            "payment=(), usb=(), magnetometer=(), gyroscope=(), "
            "accelerometer=(), ambient-light-sensor=(), autoplay=(), "
            "encrypted-media=(), fullscreen=(), picture-in-picture=()"
        ),
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https:; "
            "font-src 'self' https:; "
            "object-src 'none'; "
            "media-src 'self'; "
            "frame-src 'none'; "
            "worker-src 'self'; "
            "child-src 'none'; "
            "form-action 'self'; "
            "base-uri 'self'; "
            "manifest-src 'self'"
        ),
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin"
    }
    
    # Blocked IP ranges (example)
    BLOCKED_IP_RANGES = [
        "10.0.0.0/8",      # Private networks (if public-facing)
        "172.16.0.0/12",   # Private networks
        "192.168.0.0/16",  # Private networks
    ]
    
    # Trusted proxies (for X-Forwarded-For)
    TRUSTED_PROXIES = ["127.0.0.1", "::1"]

class AdvancedRateLimiter:
    """Advanced rate limiter with multiple tiers and dynamic blocking"""
    
    def __init__(self):
        self.request_counts = {}
        self.blocked_ips = {}
        self.suspicious_patterns = {}
        
    def is_allowed(self, identifier: str, limit: int, window: int = 60) -> Tuple[bool, Dict[str, Any]]:
        """Enhanced rate limiting with threat detection"""
        now = time.time()
        
        # Check if IP is blocked
        if identifier in self.blocked_ips:
            block_until = self.blocked_ips[identifier]
            if now < block_until:
                return False, {
                    "allowed": False,
                    "reason": "IP blocked due to security violation",
                    "blocked_until": int(block_until),
                    "retry_after": int(block_until - now)
                }
            else:
                # Unblock expired blocks
                del self.blocked_ips[identifier]
        
        # Initialize tracking for new identifiers
        if identifier not in self.request_counts:
            self.request_counts[identifier] = []
        
        # Clean old requests
        cutoff = now - window
        self.request_counts[identifier] = [
            req_time for req_time in self.request_counts[identifier] 
            if req_time > cutoff
        ]
        
        current_count = len(self.request_counts[identifier])
        
        # Check rate limit
        if current_count >= limit:
            # Check for suspicious patterns
            self._analyze_suspicious_behavior(identifier, now)
            
            return False, {
                "allowed": False,
                "reason": "Rate limit exceeded",
                "limit": limit,
                "current": current_count,
                "retry_after": window,
                "reset_at": int(now + window)
            }
        
        # Allow request
        self.request_counts[identifier].append(now)
        
        return True, {
            "allowed": True,
            "limit": limit,
            "remaining": limit - current_count - 1,
            "reset_at": int(now + window)
        }
    
    def _analyze_suspicious_behavior(self, identifier: str, now: float):
        """Analyze patterns for potential attacks"""
        if identifier not in self.suspicious_patterns:
            self.suspicious_patterns[identifier] = {"violations": 0, "last_violation": now}
        
        pattern = self.suspicious_patterns[identifier]
        pattern["violations"] += 1
        pattern["last_violation"] = now
        
        # Progressive blocking based on violation count
        if pattern["violations"] >= 10:
            # Block for 24 hours
            self.blocked_ips[identifier] = now + 86400
            logger.critical(f"IP {identifier} blocked for 24 hours - excessive violations")
        elif pattern["violations"] >= 5:
            # Block for 1 hour
            self.blocked_ips[identifier] = now + 3600
            logger.warning(f"IP {identifier} blocked for 1 hour - repeated violations")
        elif pattern["violations"] >= 3:
            # Block for 15 minutes
            self.blocked_ips[identifier] = now + 900
            logger.warning(f"IP {identifier} blocked for 15 minutes - rate limit violations")

class SecurityAuditLogger:
    """Enhanced security audit logging"""
    
    @staticmethod
    def log_security_event(event_type: str, 
                          severity: str,
                          request: Request,
                          details: Optional[Dict[str, Any]] = None,
                          user_id: Optional[str] = None):
        """Log security events with full context"""
        
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "severity": severity,
            "user_id": user_id,
            "client_ip": SecurityHelpers.get_client_ip(request),
            "user_agent": request.headers.get("user-agent", ""),
            "request_id": getattr(request.state, "request_id", ""),
            "method": request.method,
            "url": str(request.url),
            "endpoint": request.url.path,
            "headers": dict(request.headers),
            "details": details or {}
        }
        
        # Log based on severity
        if severity == "CRITICAL":
            logger.critical(f"SECURITY_CRITICAL: {json.dumps(event)}")
        elif severity == "HIGH":
            logger.error(f"SECURITY_HIGH: {json.dumps(event)}")
        elif severity == "MEDIUM":
            logger.warning(f"SECURITY_MEDIUM: {json.dumps(event)}")
        else:
            logger.info(f"SECURITY_INFO: {json.dumps(event)}")

class SecurityHelpers:
    """Security utility functions"""
    
    @staticmethod
    def get_client_ip(request: Request) -> str:
        """Get real client IP considering proxies"""
        # Check for forwarded headers
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Get first IP (original client)
            client_ip = forwarded_for.split(",")[0].strip()
            
            # Validate if proxy is trusted
            if request.client and request.client.host in EnhancedSecurityConfig.TRUSTED_PROXIES:
                return client_ip
        
        # Check real IP header
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection
        return request.client.host if request.client else "unknown"
    
    @staticmethod
    def is_ip_blocked(ip: str) -> bool:
        """Check if IP is in blocked ranges"""
        try:
            ip_obj = ipaddress.ip_address(ip)
            for blocked_range in EnhancedSecurityConfig.BLOCKED_IP_RANGES:
                if ip_obj in ipaddress.ip_network(blocked_range):
                    return True
        except:
            # Invalid IP format
            return True
        return False
    
    @staticmethod
    def validate_origin(request: Request) -> bool:
        """Validate request origin for CORS"""
        origin = request.headers.get("origin")
        referer = request.headers.get("referer")
        
        if not origin and not referer:
            # Direct requests without origin are allowed for APIs
            return True
        
        check_url = origin or referer
        if check_url:
            parsed = urlparse(check_url)
            origin_url = f"{parsed.scheme}://{parsed.netloc}"
            return origin_url in EnhancedSecurityConfig.ALLOWED_ORIGINS
        
        return False

# Global instances
rate_limiter = AdvancedRateLimiter()
security_logger = SecurityAuditLogger()

# ============================================================================
# Enhanced Security Middleware
# ============================================================================

async def enhanced_security_headers_middleware(request: Request, call_next: Callable) -> Response:
    """Enhanced security headers middleware with all required headers"""
    
    # Generate request ID for tracking
    request.state.request_id = secrets.token_hex(8)
    
    try:
        response = await call_next(request)
        
        # Add all security headers
        for header, value in EnhancedSecurityConfig.SECURITY_HEADERS.items():
            response.headers[header] = value
        
        # Add request tracking
        response.headers["X-Request-ID"] = request.state.request_id
        
        # Add rate limiting headers if available
        if hasattr(request.state, "rate_limit_info"):
            rate_info = request.state.rate_limit_info
            response.headers["X-RateLimit-Limit"] = str(rate_info.get("limit", ""))
            response.headers["X-RateLimit-Remaining"] = str(rate_info.get("remaining", ""))
            response.headers["X-RateLimit-Reset"] = str(rate_info.get("reset_at", ""))
        
        # CORS headers for allowed origins
        origin = request.headers.get("origin")
        if origin and origin in EnhancedSecurityConfig.ALLOWED_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With"
        
        return response
        
    except Exception as e:
        # Log security middleware errors
        security_logger.log_security_event(
            event_type="middleware_error",
            severity="HIGH",
            request=request,
            details={"error": str(e), "middleware": "security_headers"}
        )
        raise

async def enhanced_access_control_middleware(request: Request, call_next: Callable) -> Response:
    """Enhanced access control with proper 401/403 responses"""
    
    # Get client IP
    client_ip = SecurityHelpers.get_client_ip(request)
    
    # Check if IP is blocked
    if SecurityHelpers.is_ip_blocked(client_ip):
        security_logger.log_security_event(
            event_type="blocked_ip_access",
            severity="HIGH",
            request=request,
            details={"client_ip": client_ip}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied from this IP address"
        )
    
    # Check HTTPS enforcement
    if EnhancedSecurityConfig.ENFORCE_HTTPS and request.url.scheme != "https":
        if not (request.client.host in ["127.0.0.1", "localhost"] and 
                os.getenv("ENVIRONMENT", "production") == "development"):
            security_logger.log_security_event(
                event_type="http_request_blocked",
                severity="MEDIUM",
                request=request,
                details={"scheme": request.url.scheme}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="HTTPS required"
            )
    
    # Validate origin for cross-origin requests
    if not SecurityHelpers.validate_origin(request):
        security_logger.log_security_event(
            event_type="invalid_origin",
            severity="MEDIUM",
            request=request,
            details={"origin": request.headers.get("origin")}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid origin"
        )
    
    # Check authentication for protected endpoints
    if EnhancedSecurityConfig.REQUIRE_AUTHENTICATION:
        # Exempt health check and public endpoints
        public_endpoints = ["/health", "/", "/docs", "/openapi.json", "/auth/login", "/auth/callback"]
        
        if request.url.path not in public_endpoints and not request.url.path.startswith("/auth/"):
            # Require authentication
            auth_header = request.headers.get("authorization")
            if not auth_header:
                security_logger.log_security_event(
                    event_type="missing_authentication",
                    severity="MEDIUM",
                    request=request
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            
            # Validate authentication token
            try:
                if auth_header.startswith("Bearer "):
                    token = auth_header[7:]
                    # Validate JWT or OIDC token
                    await validate_authentication_token(token, request)
                else:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid authentication format",
                        headers={"WWW-Authenticate": "Bearer"}
                    )
            except HTTPException:
                security_logger.log_security_event(
                    event_type="invalid_authentication",
                    severity="MEDIUM",
                    request=request
                )
                raise
    
    response = await call_next(request)
    return response

async def enhanced_rate_limiting_middleware(request: Request, call_next: Callable) -> Response:
    """Enhanced rate limiting with multiple tiers"""
    
    client_ip = SecurityHelpers.get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    
    # Create identifier
    identifier = f"{client_ip}:{hashlib.md5(user_agent.encode()).hexdigest()[:8]}"
    
    # Determine rate limit based on endpoint
    if request.url.path.startswith("/auth/"):
        limit = EnhancedSecurityConfig.AUTH_RATE_LIMIT
        window = 60
    elif any(sensitive in request.url.path for sensitive in ["/admin", "/delete", "/execute", "/debug"]):
        limit = EnhancedSecurityConfig.SENSITIVE_RATE_LIMIT
        window = 60
    elif request.url.path.startswith("/api/"):
        limit = EnhancedSecurityConfig.API_RATE_LIMIT
        window = 60
    else:
        limit = EnhancedSecurityConfig.GLOBAL_RATE_LIMIT
        window = 60
    
    # Check rate limit
    allowed, rate_info = rate_limiter.is_allowed(identifier, limit, window)
    request.state.rate_limit_info = rate_info
    
    if not allowed:
        security_logger.log_security_event(
            event_type="rate_limit_exceeded",
            severity="MEDIUM",
            request=request,
            details={
                "identifier": identifier,
                "limit": limit,
                "reason": rate_info.get("reason", "unknown")
            }
        )
        
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded",
                "message": rate_info.get("reason", "Too many requests"),
                "retry_after": rate_info.get("retry_after", 60)
            },
            headers={
                "Retry-After": str(rate_info.get("retry_after", 60)),
                "X-RateLimit-Limit": str(rate_info.get("limit", limit)),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(rate_info.get("reset_at", time.time() + window))
            }
        )
    
    response = await call_next(request)
    return response

# ============================================================================
# Authentication Validation
# ============================================================================

async def validate_authentication_token(token: str, request: Request) -> Dict[str, Any]:
    """Validate authentication token (JWT or OIDC)"""
    
    try:
        # Try OIDC validation first
        for provider_name, provider in oidc_manager.providers.items():
            try:
                # Check if this is an OIDC session token
                session = provider.get_session(token)
                if session:
                    # Valid OIDC session
                    request.state.user_id = session.user_info.sub
                    request.state.authentication_type = "oidc"
                    request.state.provider = provider_name
                    return {"user_id": session.user_info.sub, "type": "oidc"}
            except:
                continue
        
        # Fallback to JWT validation
        jwt_secret = await get_secret("JWT_SECRET")
        if jwt_secret:
            payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
            request.state.user_id = payload.get("user_id")
            request.state.authentication_type = "jwt"
            return {"user_id": payload.get("user_id"), "type": "jwt"}
        
        # No valid authentication found
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token expired",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        logger.error(f"Authentication validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication validation failed",
            headers={"WWW-Authenticate": "Bearer"}
        )

# ============================================================================
# Security Dependencies
# ============================================================================

async def require_authentication(request: Request) -> Dict[str, Any]:
    """FastAPI dependency to require authentication"""
    auth_header = request.headers.get("authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = auth_header[7:]
    return await validate_authentication_token(token, request)

async def require_admin_access(auth_data: Dict[str, Any] = Depends(require_authentication)) -> Dict[str, Any]:
    """FastAPI dependency to require admin access"""
    # Implementation depends on your user role system
    # This is a placeholder that should be implemented based on your needs
    user_id = auth_data.get("user_id")
    
    # Check if user has admin role (implement based on your system)
    # For now, we'll check if it's a specific admin user
    admin_users = ["admin", "system", "administrator"]
    
    if user_id not in admin_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return auth_data

# ============================================================================
# Error Handlers
# ============================================================================

async def security_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle security-related exceptions with proper logging"""
    
    # Log security exceptions
    security_logger.log_security_event(
        event_type="security_exception",
        severity="MEDIUM" if exc.status_code < 500 else "HIGH",
        request=request,
        details={
            "status_code": exc.status_code,
            "detail": exc.detail
        }
    )
    
    # Return sanitized error response
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.detail,
                "status_code": exc.status_code,
                "request_id": getattr(request.state, "request_id", "unknown")
            }
        },
        headers=exc.headers or {}
    )

# ============================================================================
# Security Health Check
# ============================================================================

async def security_health_check() -> Dict[str, Any]:
    """Check security system health"""
    
    health_status = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "healthy",
        "checks": {
            "rate_limiter": "healthy",
            "authentication": "healthy", 
            "secrets_manager": "healthy",
            "privacy_compliance": "healthy"
        },
        "security_config": {
            "https_enforced": EnhancedSecurityConfig.ENFORCE_HTTPS,
            "authentication_required": EnhancedSecurityConfig.REQUIRE_AUTHENTICATION,
            "headers_count": len(EnhancedSecurityConfig.SECURITY_HEADERS),
            "rate_limits_configured": True
        }
    }
    
    try:
        # Check secrets manager
        test_secret = await get_secret("JWT_SECRET")
        if not test_secret:
            health_status["checks"]["secrets_manager"] = "warning"
            health_status["status"] = "degraded"
    except:
        health_status["checks"]["secrets_manager"] = "unhealthy"
        health_status["status"] = "degraded"
    
    try:
        # Check privacy compliance
        compliance_status = await privacy_compliance.validate_gdpr_compliance()
        if not compliance_status.get("overall_compliant", False):
            health_status["checks"]["privacy_compliance"] = "warning"
    except:
        health_status["checks"]["privacy_compliance"] = "unhealthy"
        health_status["status"] = "degraded"
    
    return health_status

# ============================================================================
# Utility Functions
# ============================================================================

def get_security_metrics() -> Dict[str, Any]:
    """Get security metrics for monitoring"""
    
    now = time.time()
    
    # Rate limiter metrics
    active_rate_limits = len([
        ip for ip, requests in rate_limiter.request_counts.items()
        if any(req_time > now - 60 for req_time in requests)
    ])
    
    blocked_ips_count = len([
        block_until for block_until in rate_limiter.blocked_ips.values()
        if block_until > now
    ])
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "rate_limiting": {
            "active_rate_limits": active_rate_limits,
            "blocked_ips": blocked_ips_count,
            "total_tracked_ips": len(rate_limiter.request_counts)
        },
        "security_headers": {
            "headers_configured": len(EnhancedSecurityConfig.SECURITY_HEADERS)
        },
        "authentication": {
            "oidc_providers": len(oidc_manager.providers),
            "require_auth": EnhancedSecurityConfig.REQUIRE_AUTHENTICATION
        }
    }
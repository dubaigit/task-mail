#!/usr/bin/env python3
"""
Comprehensive Security Middleware for Email Intelligence System
Implements OWASP Top 10 security controls with enterprise-grade protection

Features:
- Input validation and sanitization
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Rate limiting with sliding window
- Request size limits
- AppleScript injection prevention
- Information disclosure prevention
- SQL injection protection
- XSS protection
"""

import re
import json
import time
import hashlib
import logging
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from collections import defaultdict, deque
import asyncio
import threading
from urllib.parse import unquote

from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
import bleach
from html import escape

logger = logging.getLogger(__name__)

# ============================================================================
# Security Configuration
# ============================================================================

class SecurityConfig:
    """Centralized security configuration"""
    
    # Input validation
    MAX_REQUEST_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_STRING_LENGTH = 50000
    MAX_ARRAY_LENGTH = 1000
    MAX_JSON_DEPTH = 10
    
    # Rate limiting
    DEFAULT_RATE_LIMIT = 100  # requests per minute
    AUTH_RATE_LIMIT = 10      # login attempts per minute
    SENSITIVE_RATE_LIMIT = 20  # sensitive operations per minute
    RATE_LIMIT_WINDOW = 60    # seconds
    
    # Security headers
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self'; "
            "font-src 'self'; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        ),
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload"
    }
    
    # Dangerous patterns for AppleScript injection
    APPLESCRIPT_DANGEROUS_PATTERNS = [
        r'do\s+shell\s+script',
        r'tell\s+application\s+"Terminal"',
        r'tell\s+application\s+"System Events"',
        r'with\s+administrator\s+privileges',
        r'system\s+events\s+keystroke',
        r'activate\s+application',
        r'mount\s+volume',
        r'unmount\s+disk',
        r'delete\s+.*file',
        r'rm\s+-rf',
        r'sudo\s+',
        r'curl.*\|.*sh',
        r'wget.*\|.*sh',
        r'>\s*/dev/',
        r'osascript\s+-e'
    ]
    
    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        r'union\s+select',
        r'drop\s+table',
        r'delete\s+from',
        r'insert\s+into',
        r'update\s+.*set',
        r'exec\s*\(',
        r'execute\s*\(',
        r'xp_cmdshell',
        r'sp_executesql',
        r'--.*',
        r'/\*.*\*/',
        r';\s*--',
        r';\s*/\*'
    ]
    
    # XSS patterns
    XSS_PATTERNS = [
        r'<script.*?>.*?</script>',
        r'javascript:',
        r'vbscript:',
        r'onload\s*=',
        r'onerror\s*=',
        r'onclick\s*=',
        r'onmouseover\s*=',
        r'onfocus\s*=',
        r'<iframe.*?>',
        r'<object.*?>',
        r'<embed.*?>',
        r'<link.*?>',
        r'<meta.*?>'
    ]

# ============================================================================
# Rate Limiting Implementation
# ============================================================================

class RateLimiter:
    """Advanced rate limiter with sliding window algorithm"""
    
    def __init__(self):
        self.requests = defaultdict(deque)
        self.blocked_ips = defaultdict(lambda: {"count": 0, "until": None})
        self.lock = threading.Lock()
        
    def is_allowed(self, identifier: str, limit: int, window: int = 60) -> tuple[bool, Dict]:
        """Check if request is allowed under rate limit"""
        with self.lock:
            now = time.time()
            
            # Check if IP is temporarily blocked
            if identifier in self.blocked_ips:
                block_info = self.blocked_ips[identifier]
                if block_info["until"] and now < block_info["until"]:
                    return False, {
                        "allowed": False,
                        "reason": "IP temporarily blocked",
                        "retry_after": int(block_info["until"] - now),
                        "limit": limit,
                        "remaining": 0,
                        "reset": int(block_info["until"])
                    }
                elif block_info["until"] and now >= block_info["until"]:
                    # Unblock IP
                    del self.blocked_ips[identifier]
            
            # Clean old requests outside window
            request_times = self.requests[identifier]
            cutoff = now - window
            while request_times and request_times[0] < cutoff:
                request_times.popleft()
            
            # Check rate limit
            current_requests = len(request_times)
            
            if current_requests >= limit:
                # Rate limit exceeded
                self._handle_rate_limit_exceeded(identifier, now)
                return False, {
                    "allowed": False,
                    "reason": "Rate limit exceeded",
                    "retry_after": window,
                    "limit": limit,
                    "remaining": 0,
                    "reset": int(now + window)
                }
            
            # Allow request
            request_times.append(now)
            remaining = limit - current_requests - 1
            
            return True, {
                "allowed": True,
                "limit": limit,
                "remaining": remaining,
                "reset": int(now + window)
            }
    
    def _handle_rate_limit_exceeded(self, identifier: str, now: float):
        """Handle rate limit exceeded scenarios"""
        if identifier not in self.blocked_ips:
            self.blocked_ips[identifier] = {"count": 0, "until": None}
        
        self.blocked_ips[identifier]["count"] += 1
        
        # Progressive blocking
        if self.blocked_ips[identifier]["count"] >= 5:
            # Block for 1 hour after 5 violations
            self.blocked_ips[identifier]["until"] = now + 3600
            logger.warning(f"IP {identifier} blocked for 1 hour due to repeated rate limit violations")
        elif self.blocked_ips[identifier]["count"] >= 3:
            # Block for 15 minutes after 3 violations
            self.blocked_ips[identifier]["until"] = now + 900
            logger.warning(f"IP {identifier} blocked for 15 minutes due to rate limit violations")

# Global rate limiter instance
rate_limiter = RateLimiter()

# ============================================================================
# Input Validation and Sanitization
# ============================================================================

class InputValidator:
    """Comprehensive input validation and sanitization"""
    
    @staticmethod
    def validate_string(value: str, max_length: int = SecurityConfig.MAX_STRING_LENGTH, 
                       field_name: str = "field") -> str:
        """Validate and sanitize string input"""
        if not isinstance(value, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid input type for {field_name}. Expected string."
            )
        
        if len(value) > max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Input too long for {field_name}. Maximum {max_length} characters allowed."
            )
        
        # Check for dangerous patterns
        InputValidator._check_injection_patterns(value, field_name)
        
        # Sanitize HTML/XSS
        sanitized = InputValidator._sanitize_html(value)
        
        return sanitized
    
    @staticmethod
    def validate_email(email: str) -> str:
        """Validate email address format"""
        if not isinstance(email, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email format"
            )
        
        # Basic email validation pattern
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email format"
            )
        
        # Additional security checks
        if len(email) > 254:  # RFC 5321 limit
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address too long"
            )
        
        # Check for dangerous patterns
        InputValidator._check_injection_patterns(email, "email")
        
        return email.lower().strip()
    
    @staticmethod
    def validate_integer(value: Any, min_val: int = None, max_val: int = None,
                        field_name: str = "field") -> int:
        """Validate integer input"""
        try:
            if isinstance(value, str):
                # Check for non-numeric characters that might indicate injection
                if not value.isdigit() and not (value.startswith('-') and value[1:].isdigit()):
                    raise ValueError("Invalid integer format")
                value = int(value)
            elif not isinstance(value, int):
                raise ValueError("Invalid integer type")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid integer value for {field_name}"
            )
        
        if min_val is not None and value < min_val:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be at least {min_val}"
            )
        
        if max_val is not None and value > max_val:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be at most {max_val}"
            )
        
        return value
    
    @staticmethod
    def validate_json_structure(data: Any, max_depth: int = SecurityConfig.MAX_JSON_DEPTH) -> Any:
        """Validate JSON structure to prevent billion laughs and other attacks"""
        
        def check_depth(obj, current_depth=0):
            if current_depth > max_depth:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"JSON structure too deep. Maximum depth: {max_depth}"
                )
            
            if isinstance(obj, dict):
                if len(obj) > SecurityConfig.MAX_ARRAY_LENGTH:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Too many keys in object. Maximum: {SecurityConfig.MAX_ARRAY_LENGTH}"
                    )
                for key, value in obj.items():
                    if isinstance(key, str) and len(key) > 100:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Object key too long"
                        )
                    check_depth(value, current_depth + 1)
            elif isinstance(obj, list):
                if len(obj) > SecurityConfig.MAX_ARRAY_LENGTH:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Array too long. Maximum: {SecurityConfig.MAX_ARRAY_LENGTH}"
                    )
                for item in obj:
                    check_depth(item, current_depth + 1)
            elif isinstance(obj, str):
                if len(obj) > SecurityConfig.MAX_STRING_LENGTH:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="String value too long"
                    )
                InputValidator._check_injection_patterns(obj, "json_field")
        
        check_depth(data)
        return data
    
    @staticmethod
    def _check_injection_patterns(value: str, field_name: str):
        """Check for various injection attack patterns"""
        value_lower = value.lower()
        
        # Check SQL injection patterns
        for pattern in SecurityConfig.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                logger.warning(f"Potential SQL injection detected in {field_name}: {pattern}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid input detected"
                )
        
        # Check XSS patterns
        for pattern in SecurityConfig.XSS_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                logger.warning(f"Potential XSS detected in {field_name}: {pattern}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid input detected"
                )
        
        # Check AppleScript injection patterns
        for pattern in SecurityConfig.APPLESCRIPT_DANGEROUS_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                logger.warning(f"Potential AppleScript injection detected in {field_name}: {pattern}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid input detected"
                )
    
    @staticmethod
    def _sanitize_html(value: str) -> str:
        """Sanitize HTML content to prevent XSS"""
        # Allow minimal safe HTML tags
        allowed_tags = ['b', 'i', 'em', 'strong', 'p', 'br']
        allowed_attributes = {}
        
        # Use bleach to sanitize
        sanitized = bleach.clean(
            value,
            tags=allowed_tags,
            attributes=allowed_attributes,
            strip=True
        )
        
        # Additional escaping for any remaining special characters
        sanitized = escape(sanitized)
        
        return sanitized

# ============================================================================
# AppleScript Security
# ============================================================================

class AppleScriptSanitizer:
    """Enhanced AppleScript injection prevention"""
    
    @staticmethod
    def sanitize_applescript_input(value: str, field_name: str = "applescript_input") -> str:
        """Comprehensive AppleScript input sanitization"""
        if not isinstance(value, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="AppleScript input must be string"
            )
        
        if len(value) > 10000:  # Strict limit for AppleScript
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="AppleScript input too long"
            )
        
        # Check for dangerous patterns
        value_lower = value.lower()
        for pattern in SecurityConfig.APPLESCRIPT_DANGEROUS_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                logger.error(f"Dangerous AppleScript pattern detected in {field_name}: {pattern}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Potentially dangerous AppleScript content detected"
                )
        
        # Escape dangerous characters
        sanitized = value.replace('\\', '\\\\')
        sanitized = sanitized.replace('"', '\\"')
        sanitized = sanitized.replace('\n', '\\n')
        sanitized = sanitized.replace('\r', '\\r')
        sanitized = sanitized.replace('\t', '\\t')
        
        # Remove null bytes
        sanitized = sanitized.replace('\x00', '')
        
        return sanitized
    
    @staticmethod
    def validate_applescript_context(context: Dict[str, Any]) -> Dict[str, Any]:
        """Validate entire AppleScript execution context"""
        safe_context = {}
        
        for key, value in context.items():
            if isinstance(value, str):
                safe_context[key] = AppleScriptSanitizer.sanitize_applescript_input(value, key)
            elif isinstance(value, (int, float, bool)):
                safe_context[key] = value
            elif isinstance(value, list):
                if len(value) > 100:  # Limit array size
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="AppleScript context array too large"
                    )
                safe_context[key] = [
                    AppleScriptSanitizer.sanitize_applescript_input(str(item), f"{key}[{i}]")
                    if isinstance(item, str) else item
                    for i, item in enumerate(value)
                ]
            else:
                logger.warning(f"Unsafe type in AppleScript context: {type(value)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid data type in AppleScript context"
                )
        
        return safe_context

# ============================================================================
# Security Middleware
# ============================================================================

async def security_headers_middleware(request: Request, call_next: Callable) -> Response:
    """Add comprehensive security headers to all responses"""
    response = await call_next(request)
    
    # Add security headers
    for header, value in SecurityConfig.SECURITY_HEADERS.items():
        response.headers[header] = value
    
    # Add rate limiting headers if available
    if hasattr(request.state, "rate_limit_info"):
        rate_info = request.state.rate_limit_info
        response.headers["X-RateLimit-Limit"] = str(rate_info.get("limit", ""))
        response.headers["X-RateLimit-Remaining"] = str(rate_info.get("remaining", ""))
        response.headers["X-RateLimit-Reset"] = str(rate_info.get("reset", ""))
    
    # Security logging
    response.headers["X-Request-ID"] = request.state.request_id if hasattr(request.state, "request_id") else ""
    
    return response

async def input_validation_middleware(request: Request, call_next: Callable) -> Response:
    """Comprehensive input validation for all requests"""
    
    # Generate request ID for tracking
    request.state.request_id = hashlib.md5(
        f"{request.client.host}{time.time()}{request.url}".encode()
    ).hexdigest()[:8]
    
    # Check request size
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > SecurityConfig.MAX_REQUEST_SIZE:
        logger.warning(f"Request too large: {content_length} bytes from {request.client.host}")
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Request too large"
        )
    
    # Rate limiting
    client_ip = request.client.host
    user_agent = request.headers.get("user-agent", "")
    identifier = f"{client_ip}:{hashlib.md5(user_agent.encode()).hexdigest()[:8]}"
    
    # Determine rate limit based on endpoint
    rate_limit = SecurityConfig.DEFAULT_RATE_LIMIT
    if request.url.path.startswith("/auth/"):
        rate_limit = SecurityConfig.AUTH_RATE_LIMIT
    elif any(sensitive in request.url.path for sensitive in ["/admin/", "/delete/", "/execute/"]):
        rate_limit = SecurityConfig.SENSITIVE_RATE_LIMIT
    
    allowed, rate_info = rate_limiter.is_allowed(identifier, rate_limit)
    request.state.rate_limit_info = rate_info
    
    if not allowed:
        logger.warning(f"Rate limit exceeded for {identifier}: {rate_info}")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded", "retry_after": rate_info.get("retry_after", 60)},
            headers={
                "Retry-After": str(rate_info.get("retry_after", 60)),
                "X-RateLimit-Limit": str(rate_info.get("limit", "")),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(rate_info.get("reset", ""))
            }
        )
    
    # Validate query parameters
    for param, value in request.query_params.items():
        if isinstance(value, str):
            InputValidator.validate_string(value, field_name=f"query_param_{param}")
    
    # Continue to next middleware/endpoint
    response = await call_next(request)
    return response

async def request_body_validation_middleware(request: Request, call_next: Callable) -> Response:
    """Validate request body content"""
    
    # Only validate JSON requests
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        try:
            # Read body once and store for later use
            body = await request.body()
            if body:
                try:
                    json_data = json.loads(body)
                    # Validate JSON structure
                    InputValidator.validate_json_structure(json_data)
                    
                    # Store validated data in request state
                    request.state.validated_json = json_data
                except json.JSONDecodeError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid JSON format"
                    )
                except Exception as e:
                    logger.error(f"JSON validation error: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Request validation failed"
                    )
        except Exception as e:
            logger.error(f"Request body validation error: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Request processing failed"
            )
    
    response = await call_next(request)
    return response

# ============================================================================
# Error Handling Security
# ============================================================================

class SecureErrorHandler:
    """Secure error handling to prevent information disclosure"""
    
    @staticmethod
    def sanitize_error_message(error: Exception, request: Request) -> Dict[str, Any]:
        """Sanitize error messages to prevent information disclosure"""
        
        # Never expose internal paths, database info, or stack traces in production
        safe_errors = {
            "ValidationError": "Invalid input provided",
            "ValueError": "Invalid value provided", 
            "TypeError": "Invalid data type",
            "KeyError": "Required field missing",
            "AttributeError": "Invalid request structure",
            "FileNotFoundError": "Resource not found",
            "PermissionError": "Access denied",
            "TimeoutError": "Request timeout",
            "ConnectionError": "Service temporarily unavailable"
        }
        
        error_type = type(error).__name__
        
        # Use safe message if available
        if error_type in safe_errors:
            message = safe_errors[error_type]
        elif isinstance(error, HTTPException):
            # HTTPExceptions are already safe
            message = error.detail
        else:
            # Generic message for unknown errors
            message = "An error occurred while processing your request"
        
        # Log the actual error for internal debugging
        logger.error(f"Error in request {getattr(request.state, 'request_id', 'unknown')}: {error}")
        
        return {
            "error": {
                "message": message,
                "type": "request_error",
                "request_id": getattr(request.state, 'request_id', None)
            }
        }

# ============================================================================
# Security Utilities
# ============================================================================

def validate_file_upload(content: bytes, filename: str, allowed_types: List[str]) -> bool:
    """Validate file upload security"""
    
    # Check file size
    if len(content) > SecurityConfig.MAX_REQUEST_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large"
        )
    
    # Check filename
    if not re.match(r'^[a-zA-Z0-9._-]+$', filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename"
        )
    
    # Check file extension
    file_ext = filename.split('.')[-1].lower() if '.' in filename else ''
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {allowed_types}"
        )
    
    # Check for dangerous content (basic magic number validation)
    if content.startswith(b'PK'):  # ZIP file
        if file_ext not in ['zip', 'docx', 'xlsx']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content doesn't match extension"
            )
    
    return True

def get_client_identifier(request: Request) -> str:
    """Get a secure client identifier for rate limiting"""
    
    # Use IP + User-Agent hash for identification
    ip = request.client.host
    user_agent = request.headers.get("user-agent", "")
    
    # Hash the user agent to avoid storing sensitive data
    ua_hash = hashlib.md5(user_agent.encode()).hexdigest()[:8]
    
    return f"{ip}:{ua_hash}"

def log_security_event(event_type: str, details: Dict[str, Any], request: Request):
    """Log security events for monitoring"""
    
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "client_ip": request.client.host,
        "user_agent": request.headers.get("user-agent", ""),
        "request_id": getattr(request.state, 'request_id', None),
        "endpoint": str(request.url),
        "method": request.method,
        "details": details
    }
    
    logger.warning(f"SECURITY_EVENT: {json.dumps(log_entry)}")

# ============================================================================
# Validation Decorators
# ============================================================================

def validate_applescript_params(func):
    """Decorator to validate AppleScript parameters"""
    def wrapper(*args, **kwargs):
        for key, value in kwargs.items():
            if isinstance(value, str) and any(keyword in key.lower() for keyword in ['script', 'command', 'applescript']):
                kwargs[key] = AppleScriptSanitizer.sanitize_applescript_input(value, key)
        return func(*args, **kwargs)
    return wrapper

def require_content_type(*allowed_types):
    """Decorator to enforce content type validation"""
    def decorator(func):
        def wrapper(request: Request, *args, **kwargs):
            content_type = request.headers.get("content-type", "")
            if not any(content_type.startswith(allowed) for allowed in allowed_types):
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail=f"Unsupported content type. Allowed: {allowed_types}"
                )
            return func(request, *args, **kwargs)
        return wrapper
    return decorator
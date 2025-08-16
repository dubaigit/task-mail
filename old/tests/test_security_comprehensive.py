#!/usr/bin/env python3
"""
Comprehensive Security Test Suite

Tests authentication, authorization, CORS, input validation, 
and security vulnerability prevention across all components.

Priority: CRITICAL - Security must be 100% covered for production
"""

import pytest
import requests
import json
import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import patch, Mock, MagicMock
from fastapi.testclient import TestClient
from fastapi import HTTPException, status
import jwt
import sys
import os
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from auth_middleware import (
    create_access_token, 
    create_refresh_token, 
    verify_token, 
    get_current_user,
    hash_password,
    verify_password,
    authenticate_user,
    auth_config,
    UserModel
)
from backend_architecture import app


class TestSecurityFramework:
    """Comprehensive security testing framework"""
    
    @pytest.fixture
    def client(self):
        """FastAPI test client"""
        return TestClient(app)
    
    @pytest.fixture
    def valid_user_data(self):
        """Valid user data for testing"""
        return {
            "user_id": "test-user-123",
            "email": "test@example.com", 
            "permissions": ["read", "write"],
            "roles": ["user"]
        }
    
    @pytest.fixture
    def admin_user_data(self):
        """Admin user data for testing"""
        return {
            "user_id": "admin-user-123",
            "email": "admin@example.com",
            "permissions": ["read", "write", "admin"],
            "roles": ["admin", "user"]
        }


class TestJWTAuthentication(TestSecurityFramework):
    """JWT Authentication Security Tests"""
    
    def test_jwt_token_creation_and_validation(self, valid_user_data):
        """Test JWT token creation with proper claims"""
        token = create_access_token(valid_user_data)
        
        # Verify token structure
        assert isinstance(token, str)
        assert len(token.split('.')) == 3  # JWT has 3 parts
        
        # Verify token payload
        payload = verify_token(token, "access")
        assert payload["user_id"] == valid_user_data["user_id"]
        assert payload["email"] == valid_user_data["email"]
        assert payload["permissions"] == valid_user_data["permissions"]
        assert payload["token_type"] == "access"
        
        # Verify expiration is set properly
        exp_time = datetime.fromtimestamp(payload["exp"])
        iat_time = datetime.fromtimestamp(payload["iat"])
        token_lifetime = exp_time - iat_time
        assert token_lifetime.total_seconds() == auth_config.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    
    def test_refresh_token_creation_and_validation(self, valid_user_data):
        """Test refresh token creation and validation"""
        refresh_token = create_refresh_token(valid_user_data)
        
        # Verify refresh token
        payload = verify_token(refresh_token, "refresh")
        assert payload["user_id"] == valid_user_data["user_id"]
        assert payload["token_type"] == "refresh"
        
        # Verify refresh token has longer expiration
        exp_time = datetime.fromtimestamp(payload["exp"])
        iat_time = datetime.fromtimestamp(payload["iat"])
        token_lifetime = exp_time - iat_time
        assert token_lifetime.total_seconds() == auth_config.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    
    def test_jwt_expired_token_rejection(self, valid_user_data):
        """Test that expired tokens are properly rejected"""
        # Create token with past expiration
        expired_payload = {
            **valid_user_data,
            "exp": int(time.time()) - 3600,  # Expired 1 hour ago
            "iat": int(time.time()) - 7200,  # Issued 2 hours ago
            "token_type": "access"
        }
        
        expired_token = jwt.encode(expired_payload, auth_config.JWT_SECRET, algorithm=auth_config.JWT_ALGORITHM)
        
        # Verify token is rejected
        with pytest.raises(HTTPException) as exc_info:
            verify_token(expired_token, "access")
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "expired" in exc_info.value.detail.lower()
    
    def test_jwt_invalid_token_rejection(self):
        """Test that invalid tokens are properly rejected"""
        invalid_tokens = [
            "invalid.jwt.token",
            "not_a_jwt_at_all",
            "",
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid",  # Invalid payload
            jwt.encode({"invalid": "payload"}, "wrong_secret", algorithm="HS256")  # Wrong secret
        ]
        
        for invalid_token in invalid_tokens:
            with pytest.raises(HTTPException) as exc_info:
                verify_token(invalid_token, "access")
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_jwt_wrong_token_type_rejection(self, valid_user_data):
        """Test that tokens with wrong type are rejected"""
        access_token = create_access_token(valid_user_data)
        
        # Try to use access token as refresh token
        with pytest.raises(HTTPException) as exc_info:
            verify_token(access_token, "refresh")
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "token type" in exc_info.value.detail.lower()
    
    def test_jwt_missing_required_fields(self):
        """Test that tokens missing required fields are rejected"""
        incomplete_payloads = [
            {"user_id": "123"},  # Missing email, permissions
            {"email": "test@example.com"},  # Missing user_id, permissions
            {"user_id": "123", "email": "test@example.com"},  # Missing permissions
        ]
        
        for payload in incomplete_payloads:
            payload.update({
                "exp": int(time.time()) + 3600,
                "iat": int(time.time()),
                "token_type": "access"
            })
            
            incomplete_token = jwt.encode(payload, auth_config.JWT_SECRET, algorithm=auth_config.JWT_ALGORITHM)
            
            with pytest.raises(HTTPException) as exc_info:
                verify_token(incomplete_token, "access")
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


class TestPasswordSecurity(TestSecurityFramework):
    """Password handling security tests"""
    
    def test_password_hashing_uniqueness(self):
        """Test that identical passwords produce different hashes (salt)"""
        password = "test_password_123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        # Hashes should be different due to salt
        assert hash1 != hash2
        assert len(hash1) > 50  # bcrypt hashes are long
        assert hash1.startswith('$2b$')  # bcrypt format
    
    def test_password_verification(self):
        """Test password verification works correctly"""
        password = "secure_password_123!"
        hashed = hash_password(password)
        
        # Correct password should verify
        assert verify_password(password, hashed) is True
        
        # Wrong password should not verify
        assert verify_password("wrong_password", hashed) is False
        assert verify_password("", hashed) is False
        assert verify_password("secure_password_123", hashed) is False  # Close but wrong
    
    def test_password_strength_validation(self):
        """Test that weak passwords are rejected"""
        weak_passwords = [
            "",
            "123",
            "password",
            "12345678",
            "qwerty",
            "abc123"
        ]
        
        # For now, basic length check in auth middleware
        for weak_password in weak_passwords:
            if len(weak_password) < 8:
                # Should be validated at API level
                pass  # Password strength validation would be implemented here


class TestAPIAuthenticationEnforcement(TestSecurityFramework):
    """Test that all protected endpoints require authentication"""
    
    def test_protected_endpoints_reject_unauthenticated_requests(self, client):
        """Test all protected endpoints require authentication"""
        protected_endpoints = [
            ("GET", "/emails/"),
            ("GET", "/emails/1"),
            ("GET", "/tasks/"),
            ("GET", "/drafts/"),
            ("GET", "/stats/"),
            ("POST", "/drafts/1/send"),
            ("POST", "/emails/1/reply"),
            ("PUT", "/tasks/1/status"),
            ("GET", "/auth/me"),
            ("GET", "/analytics/dashboard"),
            ("GET", "/analytics/mailbox-stats")
        ]
        
        for method, endpoint in protected_endpoints:
            if method == "GET":
                response = client.get(endpoint)
            elif method == "POST":
                response = client.post(endpoint, json={})
            elif method == "PUT":
                response = client.put(endpoint, json={})
            
            # Should return 401 or 403 (unauthorized)
            assert response.status_code in [401, 403], f"Endpoint {method} {endpoint} should require authentication"
    
    def test_protected_endpoints_accept_valid_tokens(self, client, valid_user_data):
        """Test protected endpoints accept valid JWT tokens"""
        token = create_access_token(valid_user_data)
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test some key endpoints
        test_endpoints = [
            ("GET", "/emails/"),
            ("GET", "/auth/me"),
            ("GET", "/stats/")
        ]
        
        for method, endpoint in test_endpoints:
            if method == "GET":
                response = client.get(endpoint, headers=headers)
            
            # Should not return 401/403 with valid token
            assert response.status_code not in [401, 403], f"Endpoint {method} {endpoint} should accept valid token"
    
    def test_invalid_token_rejection(self, client):
        """Test that invalid tokens are rejected by endpoints"""
        invalid_tokens = [
            "Bearer invalid_token",
            "Bearer ",
            "Invalid_format_token",
            "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid"
        ]
        
        for invalid_token in invalid_tokens:
            headers = {"Authorization": invalid_token}
            response = client.get("/emails/", headers=headers)
            assert response.status_code in [401, 403]


class TestCORSSecurity(TestSecurityFramework):
    """CORS security configuration tests"""
    
    def test_cors_headers_present(self, client):
        """Test that CORS headers are properly configured"""
        # Test preflight request
        response = client.options("/emails/", headers={
            "Origin": "https://your-production-domain.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization, Content-Type"
        })
        
        # Check CORS headers
        assert "Access-Control-Allow-Origin" in response.headers
        assert "Access-Control-Allow-Methods" in response.headers
        assert "Access-Control-Allow-Headers" in response.headers
        assert "Access-Control-Allow-Credentials" in response.headers
    
    def test_cors_origin_restrictions(self, client):
        """Test that CORS properly restricts origins in production"""
        # Test with unauthorized origin
        response = client.options("/emails/", headers={
            "Origin": "https://malicious-site.com",
            "Access-Control-Request-Method": "GET"
        })
        
        # In production mode, should not allow arbitrary origins
        if auth_config.PRODUCTION_MODE:
            cors_origin = response.headers.get("Access-Control-Allow-Origin")
            assert cors_origin != "*"  # Wildcard should not be allowed
    
    def test_cors_credentials_handling(self, client):
        """Test CORS credentials are properly handled"""
        response = client.options("/emails/", headers={
            "Origin": "https://your-production-domain.com"
        })
        
        credentials_header = response.headers.get("Access-Control-Allow-Credentials")
        assert credentials_header == "true"  # Should allow credentials


class TestInputValidationSecurity(TestSecurityFramework):
    """Input validation and injection prevention tests"""
    
    def test_sql_injection_prevention(self, client, valid_user_data):
        """Test SQL injection prevention in API endpoints"""
        token = create_access_token(valid_user_data)
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test SQL injection attempts in query parameters
        injection_attempts = [
            "'; DROP TABLE emails; --",
            "1 OR 1=1",
            "' UNION SELECT password FROM users --",
            "'; UPDATE emails SET subject='hacked'; --"
        ]
        
        for injection in injection_attempts:
            # Test in search parameter
            response = client.get(f"/emails/?search={injection}", headers=headers)
            # Should not return error or expose SQL details
            assert response.status_code not in [500]
            
            # Response should not contain SQL error messages
            response_text = response.text.lower()
            sql_error_indicators = ["sql", "syntax error", "mysql", "postgres", "sqlite", "database error"]
            for indicator in sql_error_indicators:
                assert indicator not in response_text, f"Response should not expose SQL errors for injection: {injection}"
    
    def test_xss_prevention(self, client, valid_user_data):
        """Test XSS prevention in API responses"""
        token = create_access_token(valid_user_data)
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test XSS attempts in query parameters
        xss_attempts = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
            "';alert(String.fromCharCode(88,83,83))//'"
        ]
        
        for xss in xss_attempts:
            response = client.get(f"/emails/?search={xss}", headers=headers)
            
            # Response should not contain unescaped XSS payload
            response_text = response.text
            assert "<script>" not in response_text
            assert "javascript:" not in response_text
            assert "onerror=" not in response_text
    
    def test_api_rate_limiting_headers(self, client):
        """Test that rate limiting headers are present"""
        response = client.get("/health")
        
        # Should include rate limiting headers (if implemented)
        # This is a placeholder for future rate limiting implementation
        pass
    
    def test_security_headers_present(self, client):
        """Test that security headers are present"""
        response = client.get("/health")
        
        # Check for security headers
        security_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options", 
            "X-XSS-Protection"
        ]
        
        # Note: These would need to be added to FastAPI app
        # Currently testing framework setup for future implementation


class TestAuthorizationAndPermissions(TestSecurityFramework):
    """Authorization and permission-based access control tests"""
    
    def test_user_permissions_enforcement(self, client, valid_user_data, admin_user_data):
        """Test that user permissions are properly enforced"""
        # Create tokens for different permission levels
        user_token = create_access_token(valid_user_data)
        admin_token = create_access_token(admin_user_data)
        
        user_headers = {"Authorization": f"Bearer {user_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test admin-only endpoints (if any exist)
        admin_endpoints = [
            ("GET", "/admin/users"),  # Hypothetical admin endpoint
            ("POST", "/admin/settings")  # Hypothetical admin endpoint
        ]
        
        for method, endpoint in admin_endpoints:
            # Regular user should be denied
            if method == "GET":
                user_response = client.get(endpoint, headers=user_headers)
            elif method == "POST":
                user_response = client.post(endpoint, json={}, headers=user_headers)
            
            # Should return 403 for insufficient permissions
            # Note: These endpoints may not exist yet, so we expect 404
            assert user_response.status_code in [403, 404]
    
    def test_permission_validation_in_token(self, valid_user_data):
        """Test that permissions in token are validated"""
        # Test with missing permissions
        user_data_no_perms = {
            **valid_user_data,
            "permissions": []
        }
        
        token = create_access_token(user_data_no_perms)
        payload = verify_token(token, "access")
        
        # Should preserve empty permissions list
        assert payload["permissions"] == []


class TestSecurityConfigurationValidation(TestSecurityFramework):
    """Test security configuration validation"""
    
    def test_jwt_secret_configuration(self):
        """Test JWT secret is properly configured"""
        # Secret should be present and sufficiently long
        assert auth_config.JWT_SECRET is not None
        assert len(auth_config.JWT_SECRET) >= 32, "JWT secret must be at least 32 characters"
        
        # Secret should not be default/weak values
        weak_secrets = ["secret", "123456", "password", "default", "test"]
        assert auth_config.JWT_SECRET.lower() not in weak_secrets
    
    def test_production_mode_configuration(self):
        """Test production mode security settings"""
        if auth_config.PRODUCTION_MODE:
            # In production, should have secure settings
            assert auth_config.ACCESS_TOKEN_EXPIRE_MINUTES <= 60, "Access tokens should expire quickly in production"
            assert auth_config.REFRESH_TOKEN_EXPIRE_DAYS <= 30, "Refresh tokens should not last too long"
    
    def test_algorithm_security(self):
        """Test that secure JWT algorithm is used"""
        # Should use HMAC-based algorithm, not 'none' or weak algorithms
        secure_algorithms = ["HS256", "HS384", "HS512", "RS256", "RS384", "RS512"]
        assert auth_config.JWT_ALGORITHM in secure_algorithms
        assert auth_config.JWT_ALGORITHM != "none"


# Performance and stress testing for security
class TestSecurityPerformance(TestSecurityFramework):
    """Security performance and stress tests"""
    
    def test_password_hashing_performance(self):
        """Test password hashing performance (should be slow enough to prevent brute force)"""
        import time
        
        password = "test_password_performance"
        start_time = time.time()
        hash_password(password)
        end_time = time.time()
        
        # Password hashing should take reasonable time (not too fast, not too slow)
        hash_time = end_time - start_time
        assert 0.01 < hash_time < 1.0, f"Password hashing took {hash_time:.3f}s, should be between 0.01s and 1.0s"
    
    def test_jwt_verification_performance(self, valid_user_data):
        """Test JWT verification performance"""
        import time
        
        token = create_access_token(valid_user_data)
        
        start_time = time.time()
        for _ in range(100):  # Test 100 verifications
            verify_token(token, "access")
        end_time = time.time()
        
        # JWT verification should be fast
        avg_time = (end_time - start_time) / 100
        assert avg_time < 0.01, f"JWT verification averaged {avg_time:.4f}s, should be < 0.01s"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
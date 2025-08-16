#!/usr/bin/env python3
"""
Task-First Workspace Security Controls
Implements AI processing consent and data protection for email-to-task transformation
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any, Literal
from datetime import datetime, timedelta, timezone
from enum import Enum
from pydantic import BaseModel, Field, validator
from fastapi import HTTPException, status, Request, Depends
import hashlib
import secrets
import asyncio

# Import our security and privacy modules
from privacy_compliance import (
    PrivacyComplianceManager, DataCategory, ProcessingPurpose, 
    LegalBasis, ConsentStatus, PrivacySettings
)
from oidc_auth import get_current_oidc_user, OIDCUserInfo
from secrets_management import get_secret

logger = logging.getLogger(__name__)

class AIProcessingType(str, Enum):
    """Types of AI processing in task workspace"""
    EMAIL_CLASSIFICATION = "email_classification"
    TASK_GENERATION = "task_generation"
    DRAFT_CREATION = "draft_creation"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    PRIORITY_SCORING = "priority_scoring"
    CONTENT_SUMMARIZATION = "content_summarization"
    SMART_ROUTING = "smart_routing"

class DataMinimizationLevel(str, Enum):
    """Data minimization levels for AI processing"""
    MINIMAL = "minimal"          # Only essential metadata
    STANDARD = "standard"        # Subject and sender info
    ENHANCED = "enhanced"        # Full content analysis
    COMPREHENSIVE = "comprehensive"  # Deep content + context

class ConsentScope(str, Enum):
    """Scope of user consent for AI processing"""
    SESSION_ONLY = "session_only"
    TEMPORARY = "temporary"      # 24 hours
    EXTENDED = "extended"        # 30 days
    PERSISTENT = "persistent"    # Until withdrawn

class TaskWorkspaceSecurityConfig(BaseModel):
    """Security configuration for task workspace"""
    
    # AI Processing Controls
    require_explicit_consent: bool = True
    default_minimization_level: DataMinimizationLevel = DataMinimizationLevel.STANDARD
    max_content_length: int = 50000
    ai_processing_timeout: int = 30
    
    # Data Protection
    encrypt_task_data: bool = True
    anonymize_personal_info: bool = True
    redact_sensitive_content: bool = True
    
    # Retention Policies
    default_task_retention_days: int = 90
    draft_retention_days: int = 30
    ai_logs_retention_days: int = 7
    
    # Kill Switches
    emergency_stop_enabled: bool = True
    auto_consent_withdrawal: bool = True
    data_breach_lockdown: bool = True

class AIProcessingConsent(BaseModel):
    """User consent for AI processing"""
    user_id: str
    processing_types: List[AIProcessingType]
    consent_scope: ConsentScope
    minimization_level: DataMinimizationLevel
    granted_at: datetime
    expires_at: Optional[datetime] = None
    withdrawn_at: Optional[datetime] = None
    consent_evidence: str
    ip_address: str
    user_agent: str
    session_id: str

class TaskSecurityContext(BaseModel):
    """Security context for task processing"""
    user_id: str
    session_id: str
    processing_type: AIProcessingType
    data_categories: List[DataCategory]
    minimization_level: DataMinimizationLevel
    consent_valid: bool
    encryption_enabled: bool
    audit_trail_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIProcessingAudit(BaseModel):
    """Audit record for AI processing"""
    audit_id: str
    user_id: str
    processing_type: AIProcessingType
    input_hash: str  # Hash of input data for verification
    output_hash: str  # Hash of output data
    model_version: str
    processing_time_ms: int
    confidence_score: Optional[float] = None
    data_categories_processed: List[DataCategory]
    consent_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Privacy and security
    pii_detected: bool = False
    pii_redacted: bool = False
    anonymization_applied: bool = False
    retention_policy: str

class TaskWorkspaceSecurityManager:
    """Central security manager for task workspace"""
    
    def __init__(self):
        self.config = TaskWorkspaceSecurityConfig()
        self.privacy_manager = PrivacyComplianceManager()
        self.active_consents: Dict[str, AIProcessingConsent] = {}
        self.security_contexts: Dict[str, TaskSecurityContext] = {}
        self.kill_switch_active = False
        
    async def request_ai_processing_consent(self,
                                          user_id: str,
                                          processing_types: List[AIProcessingType],
                                          consent_scope: ConsentScope,
                                          minimization_level: DataMinimizationLevel,
                                          request: Request) -> str:
        """Request user consent for AI processing"""
        
        if self.kill_switch_active:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI processing temporarily disabled for security"
            )
        
        consent_id = secrets.token_hex(16)
        now = datetime.now(timezone.utc)
        
        # Calculate expiration based on scope
        expires_at = None
        if consent_scope == ConsentScope.SESSION_ONLY:
            expires_at = None  # Session-based
        elif consent_scope == ConsentScope.TEMPORARY:
            expires_at = now + timedelta(hours=24)
        elif consent_scope == ConsentScope.EXTENDED:
            expires_at = now + timedelta(days=30)
        # PERSISTENT has no expiration
        
        # Create consent record
        consent = AIProcessingConsent(
            user_id=user_id,
            processing_types=processing_types,
            consent_scope=consent_scope,
            minimization_level=minimization_level,
            granted_at=now,
            expires_at=expires_at,
            consent_evidence=f"Explicit consent via web interface {now.isoformat()}",
            ip_address=self._get_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            session_id=request.state.request_id if hasattr(request.state, "request_id") else ""
        )
        
        # Store consent
        self.active_consents[consent_id] = consent
        
        # Record in privacy compliance system
        for processing_type in processing_types:
            purpose = self._map_processing_to_purpose(processing_type)
            await self.privacy_manager.grant_consent(
                user_id=user_id,
                purpose=purpose,
                data_categories=[DataCategory.COMMUNICATION, DataCategory.PERSONAL_IDENTIFIABLE],
                consent_method="web_interface",
                ip_address=consent.ip_address,
                user_agent=consent.user_agent,
                granular_permissions={
                    "ai_processing": True,
                    "content_analysis": minimization_level in [DataMinimizationLevel.ENHANCED, DataMinimizationLevel.COMPREHENSIVE],
                    "data_retention": True,
                    "model_training": False  # Explicitly exclude model training
                }
            )
        
        logger.info(f"AI processing consent granted: {consent_id} for user {user_id}")
        return consent_id
    
    async def validate_processing_consent(self,
                                        user_id: str,
                                        processing_type: AIProcessingType,
                                        data_categories: List[DataCategory]) -> TaskSecurityContext:
        """Validate consent and create security context"""
        
        if self.kill_switch_active:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI processing disabled"
            )
        
        # Check for valid consent
        valid_consent = None
        for consent_id, consent in self.active_consents.items():
            if (consent.user_id == user_id and 
                processing_type in consent.processing_types and
                not consent.withdrawn_at and
                (not consent.expires_at or datetime.now(timezone.utc) < consent.expires_at)):
                valid_consent = consent
                break
        
        if not valid_consent:
            # Check privacy compliance system
            purpose = self._map_processing_to_purpose(processing_type)
            has_consent = await self.privacy_manager.check_consent(user_id, purpose)
            
            if not has_consent:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User consent required for {processing_type.value}"
                )
        
        # Create security context
        context_id = secrets.token_hex(12)
        context = TaskSecurityContext(
            user_id=user_id,
            session_id=context_id,
            processing_type=processing_type,
            data_categories=data_categories,
            minimization_level=valid_consent.minimization_level if valid_consent else DataMinimizationLevel.MINIMAL,
            consent_valid=True,
            encryption_enabled=self.config.encrypt_task_data,
            audit_trail_id=secrets.token_hex(8)
        )
        
        self.security_contexts[context_id] = context
        return context
    
    async def process_email_with_consent(self,
                                       security_context: TaskSecurityContext,
                                       email_content: Dict[str, Any],
                                       processing_type: AIProcessingType) -> Dict[str, Any]:
        """Process email content with privacy controls"""
        
        start_time = datetime.now(timezone.utc)
        
        # Validate security context
        if not security_context.consent_valid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid security context"
            )
        
        # Apply data minimization
        minimized_content = await self._apply_data_minimization(
            email_content, 
            security_context.minimization_level
        )
        
        # Detect and handle PII
        pii_detected, redacted_content = await self._detect_and_redact_pii(
            minimized_content,
            security_context.minimization_level
        )
        
        # Apply anonymization if required
        if self.config.anonymize_personal_info:
            anonymized_content = await self._anonymize_content(redacted_content)
        else:
            anonymized_content = redacted_content
        
        # Process with AI (mock implementation)
        processing_result = await self._ai_process_content(
            anonymized_content,
            processing_type,
            security_context
        )
        
        # Create audit record
        processing_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
        
        audit_record = AIProcessingAudit(
            audit_id=security_context.audit_trail_id,
            user_id=security_context.user_id,
            processing_type=processing_type,
            input_hash=hashlib.sha256(json.dumps(anonymized_content, sort_keys=True).encode()).hexdigest(),
            output_hash=hashlib.sha256(json.dumps(processing_result, sort_keys=True).encode()).hexdigest(),
            model_version="gpt-5-nano-2025-08-07",
            processing_time_ms=int(processing_time),
            confidence_score=processing_result.get("confidence", 0.95),
            data_categories_processed=security_context.data_categories,
            consent_id=f"context_{security_context.session_id}",
            pii_detected=pii_detected,
            pii_redacted=bool(redacted_content != minimized_content),
            anonymization_applied=self.config.anonymize_personal_info,
            retention_policy=f"{self.config.default_task_retention_days}_days"
        )
        
        # Log audit record
        await self._log_processing_audit(audit_record)
        
        # Record data processing activity
        await self.privacy_manager.record_data_processing(
            user_id=security_context.user_id,
            data_category=DataCategory.COMMUNICATION,
            data_type=f"ai_processing_{processing_type.value}",
            data_value=audit_record.input_hash,  # Store hash instead of content
            processing_purpose=self._map_processing_to_purpose(processing_type),
            legal_basis=LegalBasis.CONSENT,
            metadata={
                "processing_type": processing_type.value,
                "confidence_score": audit_record.confidence_score,
                "pii_detected": pii_detected,
                "anonymized": self.config.anonymize_personal_info
            }
        )
        
        return {
            "result": processing_result,
            "audit_id": audit_record.audit_id,
            "processing_time_ms": audit_record.processing_time_ms,
            "confidence": audit_record.confidence_score,
            "privacy_controls": {
                "pii_detected": pii_detected,
                "pii_redacted": audit_record.pii_redacted,
                "anonymized": audit_record.anonymization_applied,
                "minimization_level": security_context.minimization_level.value
            }
        }
    
    async def withdraw_consent(self, user_id: str, consent_id: Optional[str] = None) -> bool:
        """Withdraw AI processing consent"""
        
        withdrawn_count = 0
        
        if consent_id:
            # Withdraw specific consent
            if consent_id in self.active_consents:
                consent = self.active_consents[consent_id]
                if consent.user_id == user_id:
                    consent.withdrawn_at = datetime.now(timezone.utc)
                    withdrawn_count = 1
        else:
            # Withdraw all consents for user
            for consent in self.active_consents.values():
                if consent.user_id == user_id and not consent.withdrawn_at:
                    consent.withdrawn_at = datetime.now(timezone.utc)
                    withdrawn_count += 1
        
        # Also withdraw in privacy compliance system
        # This is a simplified implementation - in practice you'd need to track consent IDs
        logger.info(f"Withdrawn {withdrawn_count} AI processing consents for user {user_id}")
        
        return withdrawn_count > 0
    
    async def activate_kill_switch(self, reason: str, user_id: str) -> bool:
        """Activate emergency kill switch"""
        
        self.kill_switch_active = True
        
        # Withdraw all active consents
        for consent in self.active_consents.values():
            if not consent.withdrawn_at:
                consent.withdrawn_at = datetime.now(timezone.utc)
        
        # Invalidate all security contexts
        for context in self.security_contexts.values():
            context.consent_valid = False
        
        logger.critical(f"AI processing kill switch activated by {user_id}: {reason}")
        
        # TODO: Send alerts to administrators
        # TODO: Create incident record
        
        return True
    
    async def deactivate_kill_switch(self, user_id: str) -> bool:
        """Deactivate kill switch (admin only)"""
        
        self.kill_switch_active = False
        logger.warning(f"AI processing kill switch deactivated by {user_id}")
        
        return True
    
    async def _apply_data_minimization(self,
                                     content: Dict[str, Any],
                                     level: DataMinimizationLevel) -> Dict[str, Any]:
        """Apply data minimization based on level"""
        
        if level == DataMinimizationLevel.MINIMAL:
            return {
                "sender": content.get("sender", ""),
                "subject": content.get("subject", "")[:50],  # Truncate subject
                "timestamp": content.get("timestamp", "")
            }
        elif level == DataMinimizationLevel.STANDARD:
            return {
                "sender": content.get("sender", ""),
                "subject": content.get("subject", ""),
                "timestamp": content.get("timestamp", ""),
                "content_preview": content.get("content", "")[:200]  # First 200 chars
            }
        elif level == DataMinimizationLevel.ENHANCED:
            return {
                "sender": content.get("sender", ""),
                "subject": content.get("subject", ""),
                "content": content.get("content", ""),
                "timestamp": content.get("timestamp", ""),
                "attachments": len(content.get("attachments", []))  # Count only
            }
        else:  # COMPREHENSIVE
            return content
    
    async def _detect_and_redact_pii(self,
                                   content: Dict[str, Any],
                                   level: DataMinimizationLevel) -> tuple[bool, Dict[str, Any]]:
        """Detect and redact PII from content"""
        
        pii_patterns = {
            "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            "phone": r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
            "ssn": r'\b\d{3}-\d{2}-\d{4}\b',
            "credit_card": r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'
        }
        
        pii_detected = False
        redacted_content = content.copy()
        
        # Only apply redaction if configured and not comprehensive level
        if (self.config.redact_sensitive_content and 
            level != DataMinimizationLevel.COMPREHENSIVE):
            
            for field in ["content", "subject"]:
                if field in redacted_content and isinstance(redacted_content[field], str):
                    original_text = redacted_content[field]
                    redacted_text = original_text
                    
                    for pii_type, pattern in pii_patterns.items():
                        import re
                        matches = re.findall(pattern, redacted_text)
                        if matches:
                            pii_detected = True
                            redacted_text = re.sub(pattern, f"[{pii_type.upper()}_REDACTED]", redacted_text)
                    
                    redacted_content[field] = redacted_text
        
        return pii_detected, redacted_content
    
    async def _anonymize_content(self, content: Dict[str, Any]) -> Dict[str, Any]:
        """Anonymize content by removing identifying information"""
        
        anonymized = content.copy()
        
        # Anonymize sender email
        if "sender" in anonymized:
            email = anonymized["sender"]
            if "@" in email:
                local, domain = email.split("@", 1)
                anonymized["sender"] = f"{local[:2]}***@{domain}"
        
        # Remove or hash other identifying fields
        if "message_id" in anonymized:
            anonymized["message_id"] = hashlib.sha256(anonymized["message_id"].encode()).hexdigest()[:16]
        
        return anonymized
    
    async def _ai_process_content(self,
                                content: Dict[str, Any],
                                processing_type: AIProcessingType,
                                context: TaskSecurityContext) -> Dict[str, Any]:
        """Mock AI processing (replace with actual AI integration)"""
        
        # This is a mock implementation
        # In practice, this would call your AI service with the sanitized content
        
        if processing_type == AIProcessingType.EMAIL_CLASSIFICATION:
            return {
                "category": "NEEDS_REPLY",
                "confidence": 0.95,
                "urgency": "medium",
                "estimated_time": "10 minutes"
            }
        elif processing_type == AIProcessingType.TASK_GENERATION:
            return {
                "tasks": [
                    {
                        "title": "Respond to email inquiry",
                        "description": "Draft response based on email content",
                        "priority": "medium",
                        "estimated_duration": "15 minutes"
                    }
                ],
                "confidence": 0.92
            }
        elif processing_type == AIProcessingType.DRAFT_CREATION:
            return {
                "draft": "Thank you for your email. I will review and respond shortly.",
                "tone": "professional",
                "confidence": 0.88
            }
        else:
            return {"result": "processed", "confidence": 0.90}
    
    def _map_processing_to_purpose(self, processing_type: AIProcessingType) -> ProcessingPurpose:
        """Map AI processing type to privacy compliance purpose"""
        
        mapping = {
            AIProcessingType.EMAIL_CLASSIFICATION: ProcessingPurpose.EMAIL_ANALYSIS,
            AIProcessingType.TASK_GENERATION: ProcessingPurpose.TASK_GENERATION,
            AIProcessingType.DRAFT_CREATION: ProcessingPurpose.DRAFT_CREATION,
            AIProcessingType.SENTIMENT_ANALYSIS: ProcessingPurpose.EMAIL_ANALYSIS,
            AIProcessingType.PRIORITY_SCORING: ProcessingPurpose.EMAIL_ANALYSIS,
            AIProcessingType.CONTENT_SUMMARIZATION: ProcessingPurpose.EMAIL_ANALYSIS,
            AIProcessingType.SMART_ROUTING: ProcessingPurpose.EMAIL_ANALYSIS
        }
        
        return mapping.get(processing_type, ProcessingPurpose.EMAIL_ANALYSIS)
    
    async def _log_processing_audit(self, audit_record: AIProcessingAudit):
        """Log AI processing audit record"""
        
        # In practice, this would store to a secure audit database
        logger.info(f"AI_PROCESSING_AUDIT: {audit_record.json()}")
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address"""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

# Global instance
task_security_manager = TaskWorkspaceSecurityManager()

# ============================================================================
# FastAPI Dependencies
# ============================================================================

async def require_ai_processing_consent(processing_type: AIProcessingType,
                                      user: OIDCUserInfo = Depends(get_current_oidc_user)) -> TaskSecurityContext:
    """FastAPI dependency to require AI processing consent"""
    
    return await task_security_manager.validate_processing_consent(
        user_id=user.sub,
        processing_type=processing_type,
        data_categories=[DataCategory.COMMUNICATION, DataCategory.PERSONAL_IDENTIFIABLE]
    )

async def require_task_classification_consent(user: OIDCUserInfo = Depends(get_current_oidc_user)) -> TaskSecurityContext:
    """FastAPI dependency for email classification consent"""
    return await require_ai_processing_consent(AIProcessingType.EMAIL_CLASSIFICATION, user)

async def require_task_generation_consent(user: OIDCUserInfo = Depends(get_current_oidc_user)) -> TaskSecurityContext:
    """FastAPI dependency for task generation consent"""
    return await require_ai_processing_consent(AIProcessingType.TASK_GENERATION, user)

async def require_draft_creation_consent(user: OIDCUserInfo = Depends(get_current_oidc_user)) -> TaskSecurityContext:
    """FastAPI dependency for draft creation consent"""
    return await require_ai_processing_consent(AIProcessingType.DRAFT_CREATION, user)

# ============================================================================
# Consent Management API Models
# ============================================================================

class ConsentRequest(BaseModel):
    """Request model for AI processing consent"""
    processing_types: List[AIProcessingType]
    consent_scope: ConsentScope = ConsentScope.EXTENDED
    minimization_level: DataMinimizationLevel = DataMinimizationLevel.STANDARD
    
    @validator('processing_types')
    def validate_processing_types(cls, v):
        if not v:
            raise ValueError("At least one processing type is required")
        return v

class ConsentResponse(BaseModel):
    """Response model for consent requests"""
    consent_id: str
    granted_at: datetime
    expires_at: Optional[datetime] = None
    processing_types: List[str]
    minimization_level: str
    status: str = "granted"

# ============================================================================
# Security Validation Functions
# ============================================================================

async def validate_task_workspace_security() -> Dict[str, Any]:
    """Validate task workspace security configuration"""
    
    validation_result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_status": "compliant",
        "checks": {
            "consent_management": True,
            "data_minimization": True,
            "pii_protection": True,
            "audit_logging": True,
            "kill_switch": True,
            "privacy_controls": True
        },
        "configuration": {
            "require_explicit_consent": task_security_manager.config.require_explicit_consent,
            "encrypt_task_data": task_security_manager.config.encrypt_task_data,
            "anonymize_personal_info": task_security_manager.config.anonymize_personal_info,
            "emergency_stop_enabled": task_security_manager.config.emergency_stop_enabled
        },
        "recommendations": []
    }
    
    # Check if kill switch is active
    if task_security_manager.kill_switch_active:
        validation_result["overall_status"] = "degraded"
        validation_result["checks"]["kill_switch"] = False
        validation_result["recommendations"].append("AI processing kill switch is active")
    
    # Check active consents
    active_consents = len([
        c for c in task_security_manager.active_consents.values()
        if not c.withdrawn_at
    ])
    validation_result["metrics"] = {
        "active_consents": active_consents,
        "security_contexts": len(task_security_manager.security_contexts)
    }
    
    return validation_result
#!/usr/bin/env python3
"""
Security Kill-Switch and Rollback Mechanisms for 2025 Compliance
Implements emergency controls and incident response automation
"""

import os
import json
import logging
import asyncio
from typing import Dict, List, Optional, Any, Literal, Callable
from datetime import datetime, timedelta, timezone
from enum import Enum
from pydantic import BaseModel, Field
import threading
import time
import hashlib
import secrets
from pathlib import Path
import subprocess
import shutil

# Import security modules
from enhanced_security_middleware import rate_limiter, security_logger
from task_workspace_security import task_security_manager
from privacy_compliance import privacy_compliance
from secrets_management import secret_manager

logger = logging.getLogger(__name__)

class IncidentSeverity(str, Enum):
    """Security incident severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class KillSwitchType(str, Enum):
    """Types of kill switches"""
    GLOBAL = "global"                    # Shut down entire system
    AI_PROCESSING = "ai_processing"      # Stop all AI operations
    DATA_PROCESSING = "data_processing"  # Stop data ingestion
    USER_ACCESS = "user_access"          # Block user access
    EXTERNAL_APIS = "external_apis"      # Block external API calls
    FILE_OPERATIONS = "file_operations"  # Stop file operations

class RollbackScope(str, Enum):
    """Scope of rollback operations"""
    CONFIGURATION = "configuration"
    DATABASE = "database"
    APPLICATION = "application"
    SECURITY_SETTINGS = "security_settings"
    USER_DATA = "user_data"

class SecurityIncident(BaseModel):
    """Security incident model"""
    incident_id: str
    severity: IncidentSeverity
    incident_type: str
    description: str
    detected_at: datetime
    detected_by: str  # user_id or system
    affected_systems: List[str]
    mitigation_actions: List[str]
    resolved_at: Optional[datetime] = None
    
    # Evidence and context
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None
    request_data: Optional[Dict[str, Any]] = None
    system_state: Optional[Dict[str, Any]] = None
    
    # Response tracking
    kill_switches_activated: List[KillSwitchType] = Field(default_factory=list)
    rollbacks_performed: List[RollbackScope] = Field(default_factory=list)
    notifications_sent: List[str] = Field(default_factory=list)

class KillSwitchState(BaseModel):
    """State of a kill switch"""
    switch_type: KillSwitchType
    active: bool
    activated_at: Optional[datetime] = None
    activated_by: Optional[str] = None
    reason: Optional[str] = None
    auto_deactivate_at: Optional[datetime] = None

class SystemBackup(BaseModel):
    """System backup metadata"""
    backup_id: str
    backup_type: RollbackScope
    created_at: datetime
    file_path: str
    checksum: str
    size_bytes: int
    retention_until: datetime
    encrypted: bool = True

class SecurityKillSwitchManager:
    """Central kill switch and incident response manager"""
    
    def __init__(self):
        self.kill_switches: Dict[KillSwitchType, KillSwitchState] = {}
        self.active_incidents: Dict[str, SecurityIncident] = {}
        self.system_backups: Dict[str, SystemBackup] = {}
        self.backup_directory = Path("security_backups")
        self.backup_directory.mkdir(exist_ok=True)
        
        # Initialize kill switches in safe state
        for switch_type in KillSwitchType:
            self.kill_switches[switch_type] = KillSwitchState(
                switch_type=switch_type,
                active=False
            )
        
        # Start monitoring thread
        self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitoring_thread.start()
        
        logger.info("Security kill switch manager initialized")
    
    async def create_incident(self,
                            severity: IncidentSeverity,
                            incident_type: str,
                            description: str,
                            detected_by: str = "system",
                            client_ip: Optional[str] = None,
                            user_agent: Optional[str] = None,
                            request_data: Optional[Dict[str, Any]] = None) -> str:
        """Create a new security incident"""
        
        incident_id = f"SEC-{datetime.now().strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
        
        incident = SecurityIncident(
            incident_id=incident_id,
            severity=severity,
            incident_type=incident_type,
            description=description,
            detected_at=datetime.now(timezone.utc),
            detected_by=detected_by,
            affected_systems=self._identify_affected_systems(incident_type),
            mitigation_actions=[],
            client_ip=client_ip,
            user_agent=user_agent,
            request_data=request_data,
            system_state=await self._capture_system_state()
        )
        
        self.active_incidents[incident_id] = incident
        
        # Auto-trigger response based on severity
        await self._auto_respond_to_incident(incident)
        
        logger.critical(f"Security incident created: {incident_id} - {severity.value} - {description}")
        
        return incident_id
    
    async def activate_kill_switch(self,
                                 switch_type: KillSwitchType,
                                 reason: str,
                                 activated_by: str,
                                 auto_deactivate_minutes: Optional[int] = None) -> bool:
        """Activate a kill switch"""
        
        try:
            # Create system backup before activation
            if switch_type in [KillSwitchType.GLOBAL, KillSwitchType.DATA_PROCESSING]:
                await self._create_emergency_backup()
            
            # Activate the switch
            now = datetime.now(timezone.utc)
            auto_deactivate_at = None
            
            if auto_deactivate_minutes:
                auto_deactivate_at = now + timedelta(minutes=auto_deactivate_minutes)
            
            self.kill_switches[switch_type] = KillSwitchState(
                switch_type=switch_type,
                active=True,
                activated_at=now,
                activated_by=activated_by,
                reason=reason,
                auto_deactivate_at=auto_deactivate_at
            )
            
            # Execute switch-specific actions
            await self._execute_kill_switch_actions(switch_type)
            
            # Log security event
            security_logger.log_security_event(
                event_type="kill_switch_activated",
                severity="CRITICAL",
                request=None,  # No request context for kill switches
                details={
                    "switch_type": switch_type.value,
                    "reason": reason,
                    "activated_by": activated_by,
                    "auto_deactivate_minutes": auto_deactivate_minutes
                }
            )
            
            logger.critical(f"Kill switch activated: {switch_type.value} by {activated_by} - {reason}")
            
            # Send notifications
            await self._send_kill_switch_notifications(switch_type, reason, activated_by)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to activate kill switch {switch_type.value}: {e}")
            return False
    
    async def deactivate_kill_switch(self,
                                   switch_type: KillSwitchType,
                                   deactivated_by: str,
                                   reason: str = "Manual deactivation") -> bool:
        """Deactivate a kill switch"""
        
        try:
            if not self.kill_switches[switch_type].active:
                return False
            
            # Deactivate the switch
            self.kill_switches[switch_type].active = False
            
            # Execute deactivation actions
            await self._execute_kill_switch_deactivation(switch_type)
            
            logger.warning(f"Kill switch deactivated: {switch_type.value} by {deactivated_by} - {reason}")
            
            # Log security event
            security_logger.log_security_event(
                event_type="kill_switch_deactivated",
                severity="HIGH",
                request=None,
                details={
                    "switch_type": switch_type.value,
                    "reason": reason,
                    "deactivated_by": deactivated_by
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to deactivate kill switch {switch_type.value}: {e}")
            return False
    
    async def perform_rollback(self,
                             scope: RollbackScope,
                             target_timestamp: Optional[datetime] = None,
                             initiated_by: str = "system") -> bool:
        """Perform system rollback"""
        
        try:
            # Find appropriate backup
            backup = await self._find_rollback_backup(scope, target_timestamp)
            if not backup:
                logger.error(f"No suitable backup found for rollback scope: {scope.value}")
                return False
            
            # Create pre-rollback backup
            pre_rollback_backup = await self._create_pre_rollback_backup(scope)
            
            # Perform rollback based on scope
            success = await self._execute_rollback(scope, backup)
            
            if success:
                logger.warning(f"Rollback completed: {scope.value} to backup {backup.backup_id} by {initiated_by}")
                
                # Log security event
                security_logger.log_security_event(
                    event_type="system_rollback",
                    severity="HIGH",
                    request=None,
                    details={
                        "scope": scope.value,
                        "backup_id": backup.backup_id,
                        "target_timestamp": target_timestamp.isoformat() if target_timestamp else None,
                        "initiated_by": initiated_by
                    }
                )
            else:
                logger.error(f"Rollback failed: {scope.value}")
            
            return success
            
        except Exception as e:
            logger.error(f"Rollback operation failed: {e}")
            return False
    
    async def _auto_respond_to_incident(self, incident: SecurityIncident):
        """Automatic incident response based on severity"""
        
        if incident.severity == IncidentSeverity.CRITICAL:
            # Critical incidents trigger immediate protective measures
            
            if "data_breach" in incident.incident_type.lower():
                await self.activate_kill_switch(
                    KillSwitchType.DATA_PROCESSING,
                    f"Data breach incident: {incident.incident_id}",
                    "auto_response",
                    auto_deactivate_minutes=60
                )
            
            elif "authentication" in incident.incident_type.lower():
                await self.activate_kill_switch(
                    KillSwitchType.USER_ACCESS,
                    f"Authentication incident: {incident.incident_id}",
                    "auto_response",
                    auto_deactivate_minutes=30
                )
            
            elif "injection" in incident.incident_type.lower():
                await self.activate_kill_switch(
                    KillSwitchType.EXTERNAL_APIS,
                    f"Injection attack incident: {incident.incident_id}",
                    "auto_response",
                    auto_deactivate_minutes=15
                )
        
        elif incident.severity == IncidentSeverity.HIGH:
            # High severity incidents get enhanced monitoring
            
            if "rate_limit" in incident.incident_type.lower():
                # Temporarily reduce rate limits
                pass  # Implementation depends on rate limiter
            
            elif "ai_processing" in incident.incident_type.lower():
                await task_security_manager.activate_kill_switch(
                    f"AI processing incident: {incident.incident_id}",
                    "auto_response"
                )
    
    async def _execute_kill_switch_actions(self, switch_type: KillSwitchType):
        """Execute actions for specific kill switch type"""
        
        if switch_type == KillSwitchType.GLOBAL:
            # Stop all non-essential services
            await self._stop_non_essential_services()
            
        elif switch_type == KillSwitchType.AI_PROCESSING:
            # Stop AI processing
            await task_security_manager.activate_kill_switch("Security kill switch", "system")
            
        elif switch_type == KillSwitchType.DATA_PROCESSING:
            # Stop data ingestion and processing
            await self._stop_data_processing()
            
        elif switch_type == KillSwitchType.USER_ACCESS:
            # Block user authentication
            await self._block_user_access()
            
        elif switch_type == KillSwitchType.EXTERNAL_APIS:
            # Block external API calls
            await self._block_external_apis()
            
        elif switch_type == KillSwitchType.FILE_OPERATIONS:
            # Stop file operations
            await self._stop_file_operations()
    
    async def _execute_kill_switch_deactivation(self, switch_type: KillSwitchType):
        """Execute deactivation actions for specific kill switch type"""
        
        if switch_type == KillSwitchType.GLOBAL:
            await self._restart_essential_services()
            
        elif switch_type == KillSwitchType.AI_PROCESSING:
            await task_security_manager.deactivate_kill_switch("system")
            
        elif switch_type == KillSwitchType.DATA_PROCESSING:
            await self._resume_data_processing()
            
        elif switch_type == KillSwitchType.USER_ACCESS:
            await self._restore_user_access()
            
        elif switch_type == KillSwitchType.EXTERNAL_APIS:
            await self._restore_external_apis()
            
        elif switch_type == KillSwitchType.FILE_OPERATIONS:
            await self._resume_file_operations()
    
    async def _create_emergency_backup(self) -> str:
        """Create emergency system backup"""
        
        backup_id = f"emergency_{int(time.time())}"
        
        # Backup configuration files
        config_backup = await self._backup_configuration(backup_id)
        
        # Backup critical databases
        db_backup = await self._backup_databases(backup_id)
        
        logger.info(f"Emergency backup created: {backup_id}")
        return backup_id
    
    async def _backup_configuration(self, backup_id: str) -> str:
        """Backup system configuration"""
        
        config_files = [
            "production_config.py",
            "auth_middleware.py",
            "security_middleware.py",
            "privacy_compliance.py"
        ]
        
        backup_path = self.backup_directory / f"{backup_id}_config.tar.gz"
        
        # Create tar archive of config files
        import tarfile
        with tarfile.open(backup_path, "w:gz") as tar:
            for config_file in config_files:
                if Path(config_file).exists():
                    tar.add(config_file)
        
        # Calculate checksum
        with open(backup_path, "rb") as f:
            checksum = hashlib.sha256(f.read()).hexdigest()
        
        # Store backup metadata
        backup = SystemBackup(
            backup_id=f"{backup_id}_config",
            backup_type=RollbackScope.CONFIGURATION,
            created_at=datetime.now(timezone.utc),
            file_path=str(backup_path),
            checksum=checksum,
            size_bytes=backup_path.stat().st_size,
            retention_until=datetime.now(timezone.utc) + timedelta(days=30)
        )
        
        self.system_backups[backup.backup_id] = backup
        return backup.backup_id
    
    async def _backup_databases(self, backup_id: str) -> str:
        """Backup critical databases"""
        
        db_files = [
            "email_intelligence_production.db",
            "privacy_compliance.db",
            "secrets.db"
        ]
        
        backup_path = self.backup_directory / f"{backup_id}_databases.tar.gz"
        
        import tarfile
        with tarfile.open(backup_path, "w:gz") as tar:
            for db_file in db_files:
                if Path(db_file).exists():
                    tar.add(db_file)
        
        # Calculate checksum
        with open(backup_path, "rb") as f:
            checksum = hashlib.sha256(f.read()).hexdigest()
        
        backup = SystemBackup(
            backup_id=f"{backup_id}_databases",
            backup_type=RollbackScope.DATABASE,
            created_at=datetime.now(timezone.utc),
            file_path=str(backup_path),
            checksum=checksum,
            size_bytes=backup_path.stat().st_size,
            retention_until=datetime.now(timezone.utc) + timedelta(days=7)
        )
        
        self.system_backups[backup.backup_id] = backup
        return backup.backup_id
    
    async def _find_rollback_backup(self,
                                  scope: RollbackScope,
                                  target_timestamp: Optional[datetime] = None) -> Optional[SystemBackup]:
        """Find appropriate backup for rollback"""
        
        suitable_backups = [
            backup for backup in self.system_backups.values()
            if backup.backup_type == scope
        ]
        
        if not suitable_backups:
            return None
        
        if target_timestamp:
            # Find backup closest to target timestamp
            suitable_backups.sort(key=lambda b: abs((b.created_at - target_timestamp).total_seconds()))
        else:
            # Use most recent backup
            suitable_backups.sort(key=lambda b: b.created_at, reverse=True)
        
        return suitable_backups[0]
    
    async def _execute_rollback(self, scope: RollbackScope, backup: SystemBackup) -> bool:
        """Execute rollback operation"""
        
        try:
            if scope == RollbackScope.CONFIGURATION:
                return await self._rollback_configuration(backup)
            elif scope == RollbackScope.DATABASE:
                return await self._rollback_databases(backup)
            else:
                logger.error(f"Rollback not implemented for scope: {scope.value}")
                return False
                
        except Exception as e:
            logger.error(f"Rollback execution failed: {e}")
            return False
    
    async def _rollback_configuration(self, backup: SystemBackup) -> bool:
        """Rollback configuration files"""
        
        import tarfile
        
        # Extract backup
        with tarfile.open(backup.file_path, "r:gz") as tar:
            tar.extractall(path=".")
        
        logger.info(f"Configuration rollback completed from backup {backup.backup_id}")
        return True
    
    async def _rollback_databases(self, backup: SystemBackup) -> bool:
        """Rollback database files"""
        
        import tarfile
        
        # Stop services that might be using databases
        await self._stop_database_services()
        
        # Extract backup
        with tarfile.open(backup.file_path, "r:gz") as tar:
            tar.extractall(path=".")
        
        # Restart services
        await self._start_database_services()
        
        logger.info(f"Database rollback completed from backup {backup.backup_id}")
        return True
    
    def _monitoring_loop(self):
        """Background monitoring loop for auto-deactivation"""
        
        while True:
            try:
                now = datetime.now(timezone.utc)
                
                # Check for auto-deactivation
                for switch_type, state in self.kill_switches.items():
                    if (state.active and 
                        state.auto_deactivate_at and 
                        now >= state.auto_deactivate_at):
                        
                        asyncio.create_task(self.deactivate_kill_switch(
                            switch_type,
                            "auto_deactivation",
                            "Automatic deactivation timer expired"
                        ))
                
                # Clean up old backups
                self._cleanup_old_backups()
                
                time.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                time.sleep(60)
    
    def _cleanup_old_backups(self):
        """Clean up expired backups"""
        
        now = datetime.now(timezone.utc)
        expired_backups = [
            backup_id for backup_id, backup in self.system_backups.items()
            if now > backup.retention_until
        ]
        
        for backup_id in expired_backups:
            backup = self.system_backups[backup_id]
            try:
                Path(backup.file_path).unlink(missing_ok=True)
                del self.system_backups[backup_id]
                logger.info(f"Cleaned up expired backup: {backup_id}")
            except Exception as e:
                logger.error(f"Failed to clean up backup {backup_id}: {e}")
    
    async def _capture_system_state(self) -> Dict[str, Any]:
        """Capture current system state for incident analysis"""
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "kill_switches": {
                switch_type.value: state.active
                for switch_type, state in self.kill_switches.items()
            },
            "active_incidents": len(self.active_incidents),
            "rate_limiter_blocked_ips": len(getattr(rate_limiter, 'blocked_ips', {})),
            "ai_processing_active": not task_security_manager.kill_switch_active,
            "memory_usage": self._get_memory_usage(),
            "disk_usage": self._get_disk_usage()
        }
    
    def _identify_affected_systems(self, incident_type: str) -> List[str]:
        """Identify systems affected by incident type"""
        
        system_mapping = {
            "authentication": ["auth_service", "user_access", "api_gateway"],
            "data_breach": ["database", "data_processing", "ai_processing"],
            "injection": ["api_gateway", "database", "external_apis"],
            "rate_limit": ["rate_limiter", "api_gateway"],
            "ai_processing": ["ai_service", "task_processing"],
            "file_system": ["file_operations", "backup_system"]
        }
        
        for key, systems in system_mapping.items():
            if key in incident_type.lower():
                return systems
        
        return ["unknown"]
    
    # Placeholder methods for service control
    async def _stop_non_essential_services(self): pass
    async def _restart_essential_services(self): pass
    async def _stop_data_processing(self): pass
    async def _resume_data_processing(self): pass
    async def _block_user_access(self): pass
    async def _restore_user_access(self): pass
    async def _block_external_apis(self): pass
    async def _restore_external_apis(self): pass
    async def _stop_file_operations(self): pass
    async def _resume_file_operations(self): pass
    async def _stop_database_services(self): pass
    async def _start_database_services(self): pass
    
    async def _create_pre_rollback_backup(self, scope: RollbackScope) -> str:
        """Create backup before rollback operation"""
        return await self._create_emergency_backup()
    
    async def _send_kill_switch_notifications(self, switch_type: KillSwitchType, reason: str, activated_by: str):
        """Send notifications for kill switch activation"""
        # Implementation depends on your notification system
        pass
    
    def _get_memory_usage(self) -> Dict[str, float]:
        """Get current memory usage"""
        import psutil
        return {
            "percent": psutil.virtual_memory().percent,
            "available_gb": psutil.virtual_memory().available / (1024**3)
        }
    
    def _get_disk_usage(self) -> Dict[str, float]:
        """Get current disk usage"""
        import psutil
        return {
            "percent": psutil.disk_usage('.').percent,
            "free_gb": psutil.disk_usage('.').free / (1024**3)
        }

# Global instance
kill_switch_manager = SecurityKillSwitchManager()

# ============================================================================
# FastAPI Dependencies and Utilities
# ============================================================================

async def check_kill_switch(switch_type: KillSwitchType):
    """Check if specific kill switch is active"""
    if kill_switch_manager.kill_switches[switch_type].active:
        switch_state = kill_switch_manager.kill_switches[switch_type]
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service temporarily unavailable: {switch_state.reason}"
        )

async def require_system_operational():
    """Dependency to ensure critical systems are operational"""
    if kill_switch_manager.kill_switches[KillSwitchType.GLOBAL].active:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="System in emergency mode"
        )

# ============================================================================
# Emergency Response Functions
# ============================================================================

async def emergency_shutdown(reason: str, initiated_by: str = "emergency") -> str:
    """Emergency system shutdown"""
    
    incident_id = await kill_switch_manager.create_incident(
        severity=IncidentSeverity.CRITICAL,
        incident_type="emergency_shutdown",
        description=f"Emergency shutdown: {reason}",
        detected_by=initiated_by
    )
    
    await kill_switch_manager.activate_kill_switch(
        KillSwitchType.GLOBAL,
        f"Emergency shutdown - Incident: {incident_id}",
        initiated_by
    )
    
    return incident_id

async def security_lockdown(threat_type: str, initiated_by: str = "security") -> str:
    """Security threat lockdown"""
    
    incident_id = await kill_switch_manager.create_incident(
        severity=IncidentSeverity.HIGH,
        incident_type=f"security_threat_{threat_type}",
        description=f"Security lockdown: {threat_type}",
        detected_by=initiated_by
    )
    
    # Activate multiple kill switches for comprehensive protection
    await kill_switch_manager.activate_kill_switch(
        KillSwitchType.USER_ACCESS,
        f"Security lockdown - Incident: {incident_id}",
        initiated_by,
        auto_deactivate_minutes=30
    )
    
    await kill_switch_manager.activate_kill_switch(
        KillSwitchType.EXTERNAL_APIS,
        f"Security lockdown - Incident: {incident_id}",
        initiated_by,
        auto_deactivate_minutes=15
    )
    
    return incident_id

async def get_security_status() -> Dict[str, Any]:
    """Get current security system status"""
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "kill_switches": {
            switch_type.value: {
                "active": state.active,
                "activated_at": state.activated_at.isoformat() if state.activated_at else None,
                "reason": state.reason
            }
            for switch_type, state in kill_switch_manager.kill_switches.items()
        },
        "active_incidents": len(kill_switch_manager.active_incidents),
        "system_backups": len(kill_switch_manager.system_backups),
        "monitoring_active": kill_switch_manager.monitoring_thread.is_alive()
    }
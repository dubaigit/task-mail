#!/usr/bin/env python3
"""
Production Configuration for Email Intelligence System
Centralized configuration management with environment-based settings
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List, Union
from pathlib import Path
from dataclasses import dataclass, asdict, field
from enum import Enum

class Environment(str, Enum):
    """Deployment environments"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"

class LogLevel(str, Enum):
    """Logging levels"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

@dataclass
class DatabaseConfig:
    """Database configuration settings"""
    # SQLite (Primary)
    sqlite_path: str = "email_intelligence_production.db"
    sqlite_timeout: int = 30
    sqlite_backup_enabled: bool = True
    sqlite_backup_interval: int = 3600  # seconds
    
    # Redis (Caching & Message Queue)
    redis_url: str = "redis://localhost:6379/0"
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: Optional[str] = None
    redis_max_connections: int = 100
    redis_timeout: int = 5
    
    # MongoDB (Email Storage)
    mongodb_url: str = "mongodb://admin:emailpass123@localhost:27017/emaildb"
    mongodb_host: str = "localhost"
    mongodb_port: int = 27017
    mongodb_database: str = "emaildb"
    mongodb_username: str = "admin"
    mongodb_password: str = "emailpass123"
    mongodb_timeout: int = 10

@dataclass
class AIConfig:
    """AI/ML configuration settings"""
    # OpenAI API
    openai_api_key: Optional[str] = None
    openai_base_url: str = "https://api.openai.com/v1"
    classifier_model: str = "gpt-5-nano-2025-08-07"
    draft_model: str = "gpt-5-mini-2025-08-07"
    
    # Request settings
    max_tokens: int = 300
    temperature: float = 0.1
    timeout_seconds: int = 30
    
    # Rate limiting
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    burst_capacity: int = 10
    backoff_factor: float = 2.0
    max_retries: int = 3
    
    # Fallback settings
    enable_fallback: bool = True
    fallback_confidence: float = 0.5

@dataclass
class CacheConfig:
    """Caching configuration"""
    enabled: bool = True
    ttl_seconds: int = 3600
    max_entries: int = 10000
    cleanup_interval: int = 300
    
    # Performance cache settings
    performance_cache_size: int = 1000
    classification_cache_ttl: int = 7200
    draft_cache_ttl: int = 3600

@dataclass
class WebSocketConfig:
    """WebSocket configuration"""
    enabled: bool = True
    max_connections: int = 500
    heartbeat_interval: int = 30
    connection_timeout: int = 300
    max_message_size: int = 1048576  # 1MB
    
    # Topic configuration
    default_topics: List[str] = field(default_factory=lambda: [
        "emails", "analytics", "urgent", "system"
    ])

@dataclass
class RealtimeConfig:
    """Real-time features configuration"""
    # Email monitoring
    monitor_enabled: bool = True
    monitor_check_interval: int = 30
    monitor_urgent_check_interval: int = 10
    monitor_batch_size: int = 100
    
    # Event processing
    event_queue_max_size: int = 10000
    event_worker_count: int = 5
    event_processing_timeout: int = 10
    
    # Analytics
    analytics_enabled: bool = True
    analytics_update_interval: float = 5.0
    analytics_retention_days: int = 30
    analytics_batch_size: int = 1000

@dataclass
class EmailConfig:
    """Email processing configuration"""
    # Apple Mail integration
    apple_mail_db_path: str = "/Users/{user}/Library/Mail/V10/MailData/Envelope Index"
    apple_mail_backup_path: str = "/Users/{user}/Library/Mail"
    
    # Processing settings
    batch_size: int = 50
    max_concurrent: int = 10
    processing_timeout: int = 30
    check_interval: int = 30
    
    # Content limits
    max_content_length: int = 1048576  # 1MB
    max_subject_length: int = 200
    max_sender_length: int = 100

@dataclass
class SecurityConfig:
    """Security configuration"""
    # API Security
    secret_key: str = "your-super-secret-key-change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS settings
    cors_origins: List[str] = field(default_factory=lambda: [
        "http://localhost:3000", "http://localhost:3001", "http://localhost:8501"
    ])
    cors_allow_credentials: bool = True
    cors_allow_methods: List[str] = field(default_factory=lambda: [
        "GET", "POST", "PUT", "DELETE", "OPTIONS"
    ])
    cors_allow_headers: List[str] = field(default_factory=lambda: ["*"])
    
    # Rate limiting
    api_rate_limit_per_minute: int = 1000
    api_rate_limit_per_hour: int = 10000

@dataclass
class LoggingConfig:
    """Logging configuration"""
    level: LogLevel = LogLevel.INFO
    format: str = "json"
    file_path: str = "logs/email_intelligence_production.log"
    max_size: str = "100MB"
    backup_count: int = 10
    rotation: str = "daily"
    
    # Component-specific levels
    component_levels: Dict[str, str] = field(default_factory=lambda: {
        "api": "INFO",
        "database": "WARNING",
        "analytics": "INFO",
        "websocket": "WARNING",
        "email_monitor": "INFO"
    })

@dataclass
class PerformanceConfig:
    """Performance tuning configuration"""
    # Server settings
    workers: int = 4
    max_connections: int = 1000
    timeout_keep_alive: int = 75
    max_requests: int = 1000
    max_requests_jitter: int = 50
    
    # Resource limits
    max_memory_usage_gb: float = 2.0
    worker_max_memory_mb: int = 512
    cache_max_memory_mb: int = 256
    
    # Processing limits
    max_concurrent_requests: int = 100
    max_batch_processing_size: int = 500
    
    # Performance thresholds
    slow_query_threshold_ms: int = 1000
    memory_usage_threshold_percent: int = 80
    response_time_threshold_ms: int = 2000

@dataclass
class MonitoringConfig:
    """Monitoring and alerting configuration"""
    # Health checks
    health_check_enabled: bool = True
    health_check_interval: int = 30
    health_check_timeout: int = 10
    health_check_retries: int = 3
    
    # Metrics
    metrics_enabled: bool = True
    metrics_endpoint: str = "/metrics"
    metrics_collection_interval: int = 10
    
    # Alerting
    alert_email_enabled: bool = False
    alert_email_recipient: str = "admin@company.com"
    alert_threshold_error_rate: int = 5
    alert_threshold_response_time: int = 5000
    
    # System monitoring
    monitor_cpu_threshold: int = 80
    monitor_memory_threshold: int = 85
    monitor_disk_threshold: int = 90

@dataclass
class FeatureFlags:
    """Feature toggle configuration"""
    # Core features
    ai_classification: bool = True
    draft_generation: bool = True
    real_time_monitoring: bool = True
    analytics_dashboard: bool = True
    websocket_support: bool = True
    batch_processing: bool = True
    email_search: bool = True
    auto_responses: bool = False
    
    # Experimental features
    voice_synthesis: bool = False
    smart_scheduling: bool = False
    sentiment_analysis: bool = True
    predictive_analytics: bool = False

@dataclass
class ProductionConfig:
    """Complete production configuration"""
    # Environment
    environment: Environment = Environment.PRODUCTION
    debug: bool = False
    
    # Service settings
    host: str = "0.0.0.0"
    port: int = 8000
    analytics_port: int = 8001
    ui_port: int = 3000
    
    # Component configurations
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    ai: AIConfig = field(default_factory=AIConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    websocket: WebSocketConfig = field(default_factory=WebSocketConfig)
    realtime: RealtimeConfig = field(default_factory=RealtimeConfig)
    email: EmailConfig = field(default_factory=EmailConfig)
    security: SecurityConfig = field(default_factory=SecurityConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)
    features: FeatureFlags = field(default_factory=FeatureFlags)

class ConfigManager:
    """Configuration manager with environment-based loading"""
    
    def __init__(self, config_file: Optional[str] = None, environment: Optional[str] = None):
        self.config_file = config_file or ".env.production"
        self.environment = Environment(environment or os.getenv("ENVIRONMENT", "production"))
        self._config: Optional[ProductionConfig] = None
        
    def load_config(self) -> ProductionConfig:
        """Load configuration from environment and files"""
        if self._config is not None:
            return self._config
            
        # Start with default config
        config = ProductionConfig()
        
        # Load from environment file
        self._load_from_env_file(config)
        
        # Override with environment variables
        self._load_from_environment(config)
        
        # Apply environment-specific overrides
        self._apply_environment_overrides(config)
        
        # Validate configuration
        self._validate_config(config)
        
        self._config = config
        return config
    
    def _load_from_env_file(self, config: ProductionConfig):
        """Load configuration from .env file"""
        env_file = Path(self.config_file)
        if not env_file.exists():
            return
            
        try:
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        key, _, value = line.partition('=')
                        if key and value:
                            os.environ[key.strip()] = value.strip()
        except Exception as e:
            logging.warning(f"Failed to load env file {env_file}: {e}")
    
    def _load_from_environment(self, config: ProductionConfig):
        """Load configuration from environment variables"""
        # Basic settings
        config.environment = Environment(os.getenv("ENVIRONMENT", config.environment))
        config.debug = os.getenv("DEBUG", str(config.debug)).lower() == "true"
        config.host = os.getenv("HOST", config.host)
        config.port = int(os.getenv("PORT", str(config.port)))
        config.analytics_port = int(os.getenv("ANALYTICS_PORT", str(config.analytics_port)))
        config.ui_port = int(os.getenv("UI_PORT", str(config.ui_port)))
        
        # Database configuration
        db = config.database
        db.sqlite_path = os.getenv("DATABASE_PATH", db.sqlite_path)
        db.redis_url = os.getenv("REDIS_URL", db.redis_url)
        db.mongodb_url = os.getenv("MONGODB_URL", db.mongodb_url)
        
        # AI configuration
        ai = config.ai
        ai.openai_api_key = os.getenv("OPENAI_API_KEY", ai.openai_api_key)
        ai.classifier_model = os.getenv("OPENAI_MODEL_CLASSIFIER", ai.classifier_model)
        ai.draft_model = os.getenv("OPENAI_MODEL_DRAFT", ai.draft_model)
        ai.requests_per_minute = int(os.getenv("AI_REQUESTS_PER_MINUTE", str(ai.requests_per_minute)))
        
        # Cache configuration
        cache = config.cache
        cache.enabled = os.getenv("CACHE_ENABLED", str(cache.enabled)).lower() == "true"
        cache.ttl_seconds = int(os.getenv("CACHE_TTL_SECONDS", str(cache.ttl_seconds)))
        
        # WebSocket configuration
        ws = config.websocket
        ws.enabled = os.getenv("WS_ENABLED", str(ws.enabled)).lower() == "true"
        ws.max_connections = int(os.getenv("WS_MAX_CONNECTIONS", str(ws.max_connections)))
        
        # Email configuration
        email = config.email
        user = os.getenv("USER", "unknown")
        email.apple_mail_db_path = email.apple_mail_db_path.format(user=user)
        email.apple_mail_backup_path = email.apple_mail_backup_path.format(user=user)
        email.batch_size = int(os.getenv("EMAIL_BATCH_SIZE", str(email.batch_size)))
        
        # Performance configuration
        perf = config.performance
        perf.workers = int(os.getenv("WORKERS", str(perf.workers)))
        perf.max_connections = int(os.getenv("MAX_CONNECTIONS", str(perf.max_connections)))
        
        # Logging configuration
        log = config.logging
        log.level = LogLevel(os.getenv("LOG_LEVEL", log.level))
        log.file_path = os.getenv("LOG_FILE", log.file_path)
        
        # Feature flags
        features = config.features
        features.ai_classification = os.getenv("FEATURE_AI_CLASSIFICATION", str(features.ai_classification)).lower() == "true"
        features.real_time_monitoring = os.getenv("FEATURE_REAL_TIME_MONITORING", str(features.real_time_monitoring)).lower() == "true"
        features.analytics_dashboard = os.getenv("FEATURE_ANALYTICS_DASHBOARD", str(features.analytics_dashboard)).lower() == "true"
    
    def _apply_environment_overrides(self, config: ProductionConfig):
        """Apply environment-specific overrides"""
        if config.environment == Environment.DEVELOPMENT:
            config.debug = True
            config.logging.level = LogLevel.DEBUG
            config.performance.workers = 1
            config.ai.requests_per_minute = 30  # Lower limits for dev
            
        elif config.environment == Environment.STAGING:
            config.debug = False
            config.logging.level = LogLevel.INFO
            config.performance.workers = 2
            config.ai.requests_per_minute = 45
            
        elif config.environment == Environment.PRODUCTION:
            config.debug = False
            config.logging.level = LogLevel.INFO
            config.monitoring.health_check_enabled = True
            config.security.secret_key = os.getenv("SECRET_KEY", config.security.secret_key)
            
        elif config.environment == Environment.TESTING:
            config.debug = True
            config.logging.level = LogLevel.WARNING
            config.database.sqlite_path = ":memory:"  # In-memory for testing
            config.features.ai_classification = False  # Disable AI in tests
    
    def _validate_config(self, config: ProductionConfig):
        """Validate configuration settings"""
        errors = []
        
        # Validate required settings
        if config.environment == Environment.PRODUCTION:
            if config.security.secret_key == "your-super-secret-key-change-this-in-production":
                errors.append("SECRET_KEY must be changed in production")
                
            if config.ai.openai_api_key is None and config.features.ai_classification:
                errors.append("OPENAI_API_KEY is required when AI classification is enabled")
        
        # Validate port ranges
        if not (1024 <= config.port <= 65535):
            errors.append(f"Port {config.port} is not in valid range (1024-65535)")
            
        # Validate performance settings
        if config.performance.workers < 1:
            errors.append("Workers must be at least 1")
            
        if config.performance.max_connections < 10:
            errors.append("Max connections must be at least 10")
            
        # Validate cache settings
        if config.cache.ttl_seconds < 60:
            errors.append("Cache TTL must be at least 60 seconds")
            
        if errors:
            raise ValueError(f"Configuration validation failed: {', '.join(errors)}")
    
    def get_config_dict(self) -> Dict[str, Any]:
        """Get configuration as dictionary"""
        config = self.load_config()
        return asdict(config)
    
    def save_config(self, file_path: str):
        """Save current configuration to file"""
        config_dict = self.get_config_dict()
        with open(file_path, 'w') as f:
            json.dump(config_dict, f, indent=2, default=str)
    
    def get_database_url(self, db_type: str = "sqlite") -> str:
        """Get database URL for specified type"""
        config = self.load_config()
        
        if db_type == "sqlite":
            return f"sqlite:///{config.database.sqlite_path}"
        elif db_type == "redis":
            return config.database.redis_url
        elif db_type == "mongodb":
            return config.database.mongodb_url
        else:
            raise ValueError(f"Unknown database type: {db_type}")
    
    def is_feature_enabled(self, feature_name: str) -> bool:
        """Check if a feature is enabled"""
        config = self.load_config()
        return getattr(config.features, feature_name, False)

# Global configuration manager instance
_config_manager: Optional[ConfigManager] = None

def get_config_manager(config_file: Optional[str] = None, 
                      environment: Optional[str] = None) -> ConfigManager:
    """Get global configuration manager instance"""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager(config_file, environment)
    return _config_manager

def get_config() -> ProductionConfig:
    """Get production configuration"""
    return get_config_manager().load_config()

def get_database_url(db_type: str = "sqlite") -> str:
    """Get database URL for specified type"""
    return get_config_manager().get_database_url(db_type)

def is_feature_enabled(feature_name: str) -> bool:
    """Check if a feature is enabled"""
    return get_config_manager().is_feature_enabled(feature_name)

# Example usage and testing
def main():
    """Example usage of the configuration system"""
    # Initialize configuration manager
    config_manager = ConfigManager()
    config = config_manager.load_config()
    
    print("=== Email Intelligence System - Production Configuration ===")
    print(f"Environment: {config.environment}")
    print(f"Debug Mode: {config.debug}")
    print(f"Host: {config.host}:{config.port}")
    print(f"Workers: {config.performance.workers}")
    print(f"AI Classification: {'Enabled' if config.features.ai_classification else 'Disabled'}")
    print(f"Real-time Monitoring: {'Enabled' if config.features.real_time_monitoring else 'Disabled'}")
    print(f"Cache: {'Enabled' if config.cache.enabled else 'Disabled'}")
    print(f"WebSocket: {'Enabled' if config.websocket.enabled else 'Disabled'}")
    
    # Save configuration example
    config_manager.save_config("current_config.json")
    print("Configuration saved to current_config.json")

if __name__ == "__main__":
    main()
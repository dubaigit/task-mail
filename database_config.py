#!/usr/bin/env python3
"""
Database Configuration and Connection Management
Production-ready SQLite and Redis configuration for Email Intelligence System

This module provides:
- Async SQLite connection management using aiosqlite
- Redis connection pooling for caching
- Fallback to mock implementations for testing
- Connection health monitoring
- Apple Mail database integration
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

# Database imports with fallback handling
try:
    import aiosqlite
    AIOSQLITE_AVAILABLE = True
except ImportError:
    AIOSQLITE_AVAILABLE = False
    logging.warning("aiosqlite not available - using fallback implementations")

try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logging.warning("redis not available - using fallback implementations")

try:
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy.pool import QueuePool
    from sqlalchemy import text
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False
    logging.warning("SQLAlchemy async not available - using direct SQLite connections")

# Import Apple Mail connector
from apple_mail_db_reader_async import AsyncAppleMailDBReader

logger = logging.getLogger(__name__)

# ============================================================================
# Database Configuration
# ============================================================================

class DatabaseConfig:
    """Database configuration with environment variable support"""
    
    def __init__(self):
        # SQLite Configuration
        self.DB_PATH = os.getenv("DATABASE_PATH", "./email_intelligence_production.db")
        self.SQLITE_URL = f"sqlite+aiosqlite:///{self.DB_PATH}"
        
        # Redis Configuration
        self.REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.REDIS_DB = int(os.getenv("REDIS_DB", "0"))
        self.REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
        
        # Connection Pool Settings
        self.MAX_CONNECTIONS = int(os.getenv("DB_MAX_CONNECTIONS", "20"))
        self.CONNECTION_TIMEOUT = int(os.getenv("DB_CONNECTION_TIMEOUT", "30"))
        self.POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "3600"))
        
        # Health Check Settings
        self.HEALTH_CHECK_INTERVAL = int(os.getenv("DB_HEALTH_CHECK_INTERVAL", "60"))
        self.CONNECTION_RETRY_ATTEMPTS = int(os.getenv("DB_RETRY_ATTEMPTS", "3"))
        self.CONNECTION_RETRY_DELAY = int(os.getenv("DB_RETRY_DELAY", "5"))

config = DatabaseConfig()

# ============================================================================
# Connection Managers
# ============================================================================

class SQLiteConnectionManager:
    """Async SQLite connection manager with health monitoring"""
    
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self.engine = None
        self.session_maker = None
        self.connection_pool = []
        self.health_status = {"status": "disconnected", "last_check": None}
        
    async def initialize(self):
        """Initialize SQLite connections"""
        try:
            if not AIOSQLITE_AVAILABLE:
                logger.warning("aiosqlite not available - using mock connections")
                self.health_status = {"status": "mock", "last_check": datetime.now()}
                return
            
            # Ensure database directory exists
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            
            if SQLALCHEMY_AVAILABLE:
                # Use SQLAlchemy for advanced features
                self.engine = create_async_engine(
                    config.SQLITE_URL,
                    poolclass=QueuePool,
                    pool_size=5,
                    max_overflow=10,
                    pool_timeout=config.CONNECTION_TIMEOUT,
                    pool_recycle=config.POOL_RECYCLE,
                    echo=False  # Set to True for SQL debugging
                )
                self.session_maker = async_sessionmaker(
                    self.engine,
                    class_=AsyncSession,
                    expire_on_commit=False
                )
                
                # Test connection
                async with self.engine.begin() as conn:
                    await conn.execute(text("SELECT 1"))
                
                logger.info(f"SQLAlchemy SQLite engine initialized: {self.db_path}")
            else:
                # Direct aiosqlite connection
                test_conn = await aiosqlite.connect(self.db_path)
                await test_conn.execute("SELECT 1")
                await test_conn.close()
                logger.info(f"Direct aiosqlite connection verified: {self.db_path}")
            
            self.health_status = {"status": "connected", "last_check": datetime.now()}
            
        except Exception as e:
            logger.error(f"Failed to initialize SQLite connection: {e}")
            self.health_status = {"status": "error", "last_check": datetime.now(), "error": str(e)}
            raise
    
    @asynccontextmanager
    async def get_connection(self):
        """Get a database connection with proper error handling"""
        if not AIOSQLITE_AVAILABLE:
            # Return mock connection
            yield MockConnection()
            return
        
        try:
            if self.engine and SQLALCHEMY_AVAILABLE:
                async with self.engine.begin() as conn:
                    yield conn
            else:
                # Direct aiosqlite connection
                async with aiosqlite.connect(self.db_path) as conn:
                    conn.row_factory = aiosqlite.Row
                    yield conn
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            self.health_status = {"status": "error", "last_check": datetime.now(), "error": str(e)}
            raise
    
    @asynccontextmanager
    async def get_session(self):
        """Get a database session (SQLAlchemy)"""
        if not SQLALCHEMY_AVAILABLE or not self.session_maker:
            # Fallback to direct connection
            async with self.get_connection() as conn:
                yield conn
            return
        
        try:
            async with self.session_maker() as session:
                yield session
        except Exception as e:
            logger.error(f"Database session error: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on database connection"""
        try:
            if not AIOSQLITE_AVAILABLE:
                return {"status": "mock", "available": False, "message": "aiosqlite not installed"}
            
            async with self.get_connection() as conn:
                if SQLALCHEMY_AVAILABLE and hasattr(conn, 'execute'):
                    await conn.execute(text("SELECT 1"))
                else:
                    await conn.execute("SELECT 1")
            
            self.health_status = {
                "status": "healthy",
                "last_check": datetime.now(),
                "database_path": str(self.db_path),
                "database_exists": self.db_path.exists(),
                "database_size_mb": self.db_path.stat().st_size / (1024*1024) if self.db_path.exists() else 0
            }
            
        except Exception as e:
            self.health_status = {
                "status": "unhealthy",
                "last_check": datetime.now(),
                "error": str(e)
            }
        
        return self.health_status
    
    async def close(self):
        """Close database connections"""
        try:
            if self.engine and SQLALCHEMY_AVAILABLE:
                await self.engine.dispose()
            self.health_status = {"status": "disconnected", "last_check": datetime.now()}
            logger.info("SQLite connections closed")
        except Exception as e:
            logger.error(f"Error closing SQLite connections: {e}")

class RedisConnectionManager:
    """Redis connection manager with fallback"""
    
    def __init__(self):
        self.redis_pool = None
        self.health_status = {"status": "disconnected", "last_check": None}
    
    async def initialize(self):
        """Initialize Redis connection pool"""
        try:
            if not REDIS_AVAILABLE:
                logger.warning("redis not available - using mock connections")
                self.health_status = {"status": "mock", "last_check": datetime.now()}
                return
            
            # Create Redis connection pool
            self.redis_pool = aioredis.ConnectionPool.from_url(
                config.REDIS_URL,
                db=config.REDIS_DB,
                password=config.REDIS_PASSWORD,
                max_connections=config.MAX_CONNECTIONS,
                retry_on_timeout=True,
                socket_timeout=config.CONNECTION_TIMEOUT
            )
            
            # Test connection
            redis_conn = aioredis.Redis(connection_pool=self.redis_pool)
            await redis_conn.ping()
            await redis_conn.close()
            
            self.health_status = {"status": "connected", "last_check": datetime.now()}
            logger.info("Redis connection pool initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis connection: {e}")
            self.health_status = {"status": "error", "last_check": datetime.now(), "error": str(e)}
            # Don't raise - allow system to continue without Redis
    
    async def get_redis(self):
        """Get Redis connection"""
        if not REDIS_AVAILABLE or not self.redis_pool:
            return MockRedis()
        
        try:
            return aioredis.Redis(connection_pool=self.redis_pool)
        except Exception as e:
            logger.error(f"Redis connection error: {e}")
            return MockRedis()
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on Redis connection"""
        try:
            if not REDIS_AVAILABLE:
                return {"status": "mock", "available": False, "message": "redis not installed"}
            
            if not self.redis_pool:
                return {"status": "not_initialized", "available": False}
            
            redis_conn = await self.get_redis()
            await redis_conn.ping()
            await redis_conn.close()
            
            self.health_status = {
                "status": "healthy",
                "last_check": datetime.now(),
                "redis_url": config.REDIS_URL,
                "redis_db": config.REDIS_DB
            }
            
        except Exception as e:
            self.health_status = {
                "status": "unhealthy", 
                "last_check": datetime.now(),
                "error": str(e)
            }
        
        return self.health_status
    
    async def close(self):
        """Close Redis connections"""
        try:
            if self.redis_pool:
                await self.redis_pool.disconnect()
            self.health_status = {"status": "disconnected", "last_check": datetime.now()}
            logger.info("Redis connections closed")
        except Exception as e:
            logger.error(f"Error closing Redis connections: {e}")

# ============================================================================
# Mock Classes for Fallback
# ============================================================================

class MockConnection:
    """Mock database connection for testing/fallback"""
    
    async def execute(self, query, *args):
        logger.debug(f"Mock DB execute: {query}")
        return MockCursor()
    
    async def commit(self):
        logger.debug("Mock DB commit")
    
    async def rollback(self):
        logger.debug("Mock DB rollback")

class MockCursor:
    """Mock database cursor"""
    
    async def fetchone(self):
        return {"id": 1, "test": "mock_data"}
    
    async def fetchall(self):
        return [{"id": 1, "test": "mock_data"}]

class MockRedis:
    """Mock Redis connection for testing/fallback"""
    
    async def get(self, key):
        logger.debug(f"Mock Redis get: {key}")
        return None
    
    async def set(self, key, value, ex=None):
        logger.debug(f"Mock Redis set: {key} = {value}")
        return True
    
    async def delete(self, key):
        logger.debug(f"Mock Redis delete: {key}")
        return 1
    
    async def ping(self):
        return True
    
    async def close(self):
        pass

# ============================================================================
# Main Database Manager
# ============================================================================

class EnhancedDatabaseManager:
    """Enhanced database manager with Apple Mail integration and proper connection handling"""
    
    def __init__(self):
        self.sqlite_manager = SQLiteConnectionManager(config.DB_PATH)
        self.redis_manager = RedisConnectionManager()
        self.apple_mail_reader = None
        self.health_monitor_task = None
        
    async def initialize(self):
        """Initialize all database connections and Apple Mail integration"""
        logger.info("Initializing enhanced database manager...")
        
        # Initialize SQLite
        try:
            await self.sqlite_manager.initialize()
            logger.info("✅ SQLite connection initialized")
        except Exception as e:
            logger.error(f"❌ SQLite initialization failed: {e}")
            # Continue with mock connections
        
        # Initialize Redis
        try:
            await self.redis_manager.initialize()
            logger.info("✅ Redis connection initialized")
        except Exception as e:
            logger.error(f"❌ Redis initialization failed: {e}")
            # Continue without Redis
        
        # Initialize Apple Mail reader
        try:
            self.apple_mail_reader = AsyncAppleMailDBReader(
                pool_size=3,
                cache_size=50,
                enable_monitoring=True
            )
            await self.apple_mail_reader.initialize()
            logger.info("✅ Apple Mail database reader initialized")
        except Exception as e:
            logger.error(f"❌ Apple Mail reader initialization failed: {e}")
            self.apple_mail_reader = None
        
        # Start health monitoring
        self.health_monitor_task = asyncio.create_task(self._health_monitor_loop())
        
        logger.info("Database manager initialization completed")
    
    async def get_sqlite_connection(self):
        """Get SQLite database connection"""
        return self.sqlite_manager.get_connection()
    
    async def get_sqlite_session(self):
        """Get SQLite database session"""
        return self.sqlite_manager.get_session()
    
    async def get_redis(self):
        """Get Redis connection"""
        return await self.redis_manager.get_redis()
    
    async def get_apple_mail_reader(self) -> Optional[AsyncAppleMailDBReader]:
        """Get Apple Mail database reader"""
        return self.apple_mail_reader
    
    async def comprehensive_health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check on all database connections"""
        health_status = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "healthy",
            "components": {}
        }
        
        # Check SQLite
        sqlite_health = await self.sqlite_manager.health_check()
        health_status["components"]["sqlite"] = sqlite_health
        
        # Check Redis
        redis_health = await self.redis_manager.health_check()
        health_status["components"]["redis"] = redis_health
        
        # Check Apple Mail
        if self.apple_mail_reader:
            try:
                apple_stats = await self.apple_mail_reader.get_database_stats()
                health_status["components"]["apple_mail"] = {
                    "status": "healthy",
                    "total_emails": apple_stats.total_emails,
                    "database_size_mb": apple_stats.database_size_mb,
                    "last_check": datetime.now()
                }
            except Exception as e:
                health_status["components"]["apple_mail"] = {
                    "status": "unhealthy",
                    "error": str(e),
                    "last_check": datetime.now()
                }
        else:
            health_status["components"]["apple_mail"] = {
                "status": "not_available",
                "message": "Apple Mail reader not initialized"
            }
        
        # Determine overall status
        component_statuses = [comp.get("status", "unknown") for comp in health_status["components"].values()]
        if any(status in ["unhealthy", "error"] for status in component_statuses):
            health_status["overall_status"] = "degraded"
        elif all(status in ["mock", "not_available"] for status in component_statuses):
            health_status["overall_status"] = "mock"
        
        return health_status
    
    async def _health_monitor_loop(self):
        """Background health monitoring loop"""
        while True:
            try:
                await asyncio.sleep(config.HEALTH_CHECK_INTERVAL)
                health_status = await self.comprehensive_health_check()
                
                # Log any issues
                if health_status["overall_status"] != "healthy":
                    logger.warning(f"Database health check: {health_status['overall_status']}")
                    for component, status in health_status["components"].items():
                        if status.get("status") in ["unhealthy", "error"]:
                            logger.error(f"Component {component} unhealthy: {status.get('error', 'Unknown error')}")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health monitor error: {e}")
    
    async def close(self):
        """Close all database connections"""
        logger.info("Closing database manager...")
        
        # Cancel health monitoring
        if self.health_monitor_task:
            self.health_monitor_task.cancel()
            try:
                await self.health_monitor_task
            except asyncio.CancelledError:
                pass
        
        # Close SQLite
        await self.sqlite_manager.close()
        
        # Close Redis
        await self.redis_manager.close()
        
        # Close Apple Mail reader
        if self.apple_mail_reader:
            await self.apple_mail_reader.cleanup()
        
        logger.info("Database manager closed")

# ============================================================================
# Global Database Manager Instance
# ============================================================================

# Global instance to be used throughout the application
db_manager = EnhancedDatabaseManager()

# ============================================================================
# Utility Functions
# ============================================================================

async def test_database_connectivity():
    """Test all database connections and return status report"""
    test_results = {
        "test_time": datetime.now().isoformat(),
        "results": {}
    }
    
    try:
        # Test SQLite
        sqlite_manager = SQLiteConnectionManager(config.DB_PATH)
        await sqlite_manager.initialize()
        sqlite_health = await sqlite_manager.health_check()
        test_results["results"]["sqlite"] = sqlite_health
        await sqlite_manager.close()
        
        # Test Redis
        redis_manager = RedisConnectionManager()
        await redis_manager.initialize()
        redis_health = await redis_manager.health_check()
        test_results["results"]["redis"] = redis_health
        await redis_manager.close()
        
        # Test Apple Mail (try both async and sync readers)
        try:
            # First try the synchronous reader as a fallback
            from apple_mail_db_reader import AppleMailDBReader
            sync_reader = AppleMailDBReader()
            email_count = sync_reader.get_email_count()
            stats = sync_reader.get_email_stats()
            
            test_results["results"]["apple_mail"] = {
                "status": "healthy",
                "total_emails": email_count,
                "reader_type": "synchronous",
                "stats": stats
            }
            
            # Try async reader if sync works
            try:
                apple_reader = AsyncAppleMailDBReader()
                await apple_reader.initialize()
                apple_stats = await apple_reader.get_database_stats()
                test_results["results"]["apple_mail"].update({
                    "async_reader": "available",
                    "database_size_mb": apple_stats.database_size_mb
                })
                await apple_reader.cleanup()
            except Exception as async_e:
                test_results["results"]["apple_mail"]["async_reader_error"] = str(async_e)
                test_results["results"]["apple_mail"]["async_reader"] = "unavailable_fallback_to_sync"
                
        except Exception as e:
            test_results["results"]["apple_mail"] = {
                "status": "error",
                "error": str(e)
            }
        
        # Overall status
        all_healthy = all(
            result.get("status") in ["healthy", "connected", "mock"] 
            for result in test_results["results"].values()
        )
        test_results["overall_status"] = "healthy" if all_healthy else "issues_detected"
        
    except Exception as e:
        test_results["overall_status"] = "failed"
        test_results["error"] = str(e)
    
    return test_results

if __name__ == "__main__":
    # Test connectivity when run directly
    async def main():
        print("🔍 Testing Database Connectivity...")
        print("=" * 50)
        
        results = await test_database_connectivity()
        
        print(f"Overall Status: {results['overall_status']}")
        print(f"Test Time: {results['test_time']}")
        print("\nComponent Results:")
        
        for component, result in results["results"].items():
            status = result.get("status", "unknown")
            print(f"  {component}: {status}")
            if "error" in result:
                print(f"    Error: {result['error']}")
            if "total_emails" in result:
                print(f"    Total Emails: {result['total_emails']:,}")
            if "database_size_mb" in result:
                print(f"    Database Size: {result['database_size_mb']:.1f} MB")
        
        if results.get("error"):
            print(f"\nTest Error: {results['error']}")
    
    asyncio.run(main())
#!/usr/bin/env python3
"""
Async Apple Mail Database Reader - Production Optimized

High-performance async SQLite access to Apple Mail emails with:
- Connection pooling for concurrent access
- Async query execution
- Memory-efficient result streaming
- Comprehensive error handling and retries
- Performance monitoring
- Connection health checking
"""

import asyncio
import aiosqlite
import json
import time
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, AsyncIterator, Tuple
from pathlib import Path
from dataclasses import dataclass, field
from contextlib import asynccontextmanager
import weakref
from collections import deque
import psutil

logger = logging.getLogger(__name__)

# ============================================================================
# Data Models
# ============================================================================

@dataclass
class EmailRecord:
    """Structured email record from Apple Mail database"""
    id: int
    message_id: Optional[str]
    subject: Optional[str]
    sender_email: Optional[str]
    sender_name: Optional[str]
    date_received: Optional[str]
    date_sent: Optional[str]
    is_read: bool
    is_flagged: bool
    is_deleted: bool
    size: Optional[int]
    mailbox_path: Optional[str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'message_id': self.message_id,
            'subject': self.subject,
            'sender_email': self.sender_email,
            'sender_name': self.sender_name,
            'date_received': self.date_received,
            'date_sent': self.date_sent,
            'is_read': self.is_read,
            'is_flagged': self.is_flagged,
            'is_deleted': self.is_deleted,
            'size': self.size,
            'mailbox_path': self.mailbox_path
        }

@dataclass
class DatabaseStats:
    """Database statistics"""
    total_emails: int
    unread_count: int
    flagged_count: int
    emails_last_7_days: int
    emails_last_30_days: int
    mailbox_distribution: List[Tuple[str, int]]
    oldest_email_date: Optional[str]
    newest_email_date: Optional[str]
    database_size_mb: float

@dataclass
class QueryMetrics:
    """Query performance metrics"""
    query_type: str
    duration_ms: float
    rows_returned: int
    parameters: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)

# ============================================================================
# Connection Pool Management
# ============================================================================

class AsyncSQLitePool:
    """Async SQLite connection pool with health checking"""
    
    def __init__(
        self,
        database_path: Path,
        min_connections: int = 2,
        max_connections: int = 10,
        connection_timeout: float = 30.0,
        health_check_interval: float = 60.0
    ):
        self.database_path = database_path
        self.min_connections = min_connections
        self.max_connections = max_connections
        self.connection_timeout = connection_timeout
        self.health_check_interval = health_check_interval
        
        self._pool: asyncio.Queue = asyncio.Queue(maxsize=max_connections)
        self._created_connections = 0
        self._active_connections = weakref.WeakSet()
        self._lock = asyncio.Lock()
        self._closed = False
        self._health_check_task: Optional[asyncio.Task] = None
        
        # Performance tracking
        self.pool_stats = {
            'connections_created': 0,
            'connections_destroyed': 0,
            'pool_hits': 0,
            'pool_misses': 0,
            'health_checks': 0,
            'failed_health_checks': 0
        }
    
    async def __aenter__(self):
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def initialize(self):
        """Initialize the connection pool"""
        if not self.database_path.exists():
            raise FileNotFoundError(f"Apple Mail database not found at {self.database_path}")
        
        # Create minimum connections
        for _ in range(self.min_connections):
            conn = await self._create_connection()
            await self._pool.put(conn)
        
        # Start health check task
        self._health_check_task = asyncio.create_task(self._health_check_loop())
        
        logger.info(f"Initialized SQLite pool with {self.min_connections} connections")
    
    async def _create_connection(self) -> aiosqlite.Connection:
        """Create a new database connection with optimizations"""
        if self._created_connections >= self.max_connections:
            raise RuntimeError("Connection pool exhausted")
        
        # Use URI for read-only access
        db_uri = f"file:{self.database_path}?mode=ro"
        conn = await aiosqlite.connect(db_uri, uri=True)
        
        # Optimize connection settings
        await conn.execute("PRAGMA cache_size = -64000")  # 64MB cache
        await conn.execute("PRAGMA temp_store = MEMORY")
        await conn.execute("PRAGMA mmap_size = 268435456")  # 256MB mmap
        await conn.execute("PRAGMA synchronous = OFF")  # Safe for read-only
        await conn.execute("PRAGMA journal_mode = OFF")  # Safe for read-only
        
        # Set row factory for easier access
        conn.row_factory = aiosqlite.Row
        
        self._created_connections += 1
        self.pool_stats['connections_created'] += 1
        self._active_connections.add(conn)
        
        return conn
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire a connection from the pool"""
        if self._closed:
            raise RuntimeError("Connection pool is closed")
        
        conn = None
        try:
            # Try to get connection from pool
            try:
                conn = await asyncio.wait_for(self._pool.get(), timeout=1.0)
                self.pool_stats['pool_hits'] += 1
                
                # Verify connection is healthy
                if not await self._is_connection_healthy(conn):
                    await conn.close()
                    conn = await self._create_connection()
                    
            except asyncio.TimeoutError:
                # Pool is empty, create new connection
                conn = await self._create_connection()
                self.pool_stats['pool_misses'] += 1
            
            yield conn
            
        except Exception:
            # Connection had an error, don't return to pool
            if conn:
                try:
                    await conn.close()
                except:
                    pass
                self._created_connections = max(0, self._created_connections - 1)
            raise
        else:
            # Return healthy connection to pool
            if conn and not self._closed:
                try:
                    # Quick health check before returning
                    await conn.execute("SELECT 1")
                    await self._pool.put(conn)
                except:
                    # Connection is unhealthy, close it
                    try:
                        await conn.close()
                    except:
                        pass
                    self._created_connections = max(0, self._created_connections - 1)
    
    async def _is_connection_healthy(self, conn: aiosqlite.Connection) -> bool:
        """Check if connection is healthy"""
        try:
            await asyncio.wait_for(conn.execute("SELECT 1"), timeout=5.0)
            return True
        except Exception:
            return False
    
    async def _health_check_loop(self):
        """Periodic health check of pooled connections"""
        while not self._closed:
            try:
                await asyncio.sleep(self.health_check_interval)
                await self._perform_health_check()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health check loop: {e}")
    
    async def _perform_health_check(self):
        """Perform health check on pooled connections"""
        if self._closed:
            return
        
        self.pool_stats['health_checks'] += 1
        unhealthy_connections = []
        
        # Check all connections currently in pool
        temp_connections = []
        while not self._pool.empty():
            try:
                conn = await self._pool.get_nowait()
                if await self._is_connection_healthy(conn):
                    temp_connections.append(conn)
                else:
                    unhealthy_connections.append(conn)
                    self.pool_stats['failed_health_checks'] += 1
            except asyncio.QueueEmpty:
                break
        
        # Close unhealthy connections
        for conn in unhealthy_connections:
            try:
                await conn.close()
                self._created_connections = max(0, self._created_connections - 1)
            except:
                pass
        
        # Return healthy connections to pool
        for conn in temp_connections:
            try:
                await self._pool.put_nowait(conn)
            except asyncio.QueueFull:
                # Pool somehow got full, close excess connection
                try:
                    await conn.close()
                    self._created_connections = max(0, self._created_connections - 1)
                except:
                    pass
        
        # Ensure minimum connections
        while self._created_connections < self.min_connections and not self._closed:
            try:
                conn = await self._create_connection()
                await self._pool.put(conn)
            except Exception as e:
                logger.error(f"Error creating connection during health check: {e}")
                break
    
    async def get_pool_stats(self) -> Dict[str, Any]:
        """Get connection pool statistics"""
        return {
            **self.pool_stats,
            'active_connections': len(self._active_connections),
            'created_connections': self._created_connections,
            'pooled_connections': self._pool.qsize(),
            'max_connections': self.max_connections,
            'min_connections': self.min_connections
        }
    
    async def close(self):
        """Close all connections and cleanup"""
        self._closed = True
        
        # Cancel health check task
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
        
        # Close all pooled connections
        while not self._pool.empty():
            try:
                conn = await self._pool.get_nowait()
                await conn.close()
            except:
                pass
        
        # Close any remaining active connections
        for conn in list(self._active_connections):
            try:
                await conn.close()
            except:
                pass
        
        logger.info("SQLite connection pool closed")

# ============================================================================
# Async Apple Mail Database Reader
# ============================================================================

class AsyncAppleMailDBReader:
    """
    High-performance async Apple Mail database reader
    
    Features:
    - Connection pooling for concurrent access
    - Streaming results for large datasets
    - Query result caching
    - Performance monitoring
    - Comprehensive error handling
    """
    
    def __init__(
        self,
        pool_size: int = 5,
        cache_size: int = 100,
        enable_monitoring: bool = True
    ):
        self.pool_size = pool_size
        self.cache_size = cache_size
        self.enable_monitoring = enable_monitoring
        
        # Find Apple Mail database
        self.db_path = self._find_mail_database()
        
        # Initialize components
        self._pool: Optional[AsyncSQLitePool] = None
        self._query_cache: Dict[str, Tuple[Any, float]] = {}
        self._cache_ttl = 300.0  # 5 minutes
        
        # Performance tracking
        self.query_metrics: deque = deque(maxlen=1000)
        self.stats = {
            'queries_executed': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'total_rows_returned': 0,
            'avg_query_time_ms': 0.0,
            'errors': 0
        }
    
    def _find_mail_database(self) -> Path:
        """Find Apple Mail database path"""
        # Try V10 first (newer versions)
        db_path = Path.home() / "Library/Mail/V10/MailData/Envelope Index"
        if db_path.exists():
            return db_path
        
        # Try V9 (older versions)
        db_path = Path.home() / "Library/Mail/V9/MailData/Envelope Index"
        if db_path.exists():
            return db_path
        
        # Try V8
        db_path = Path.home() / "Library/Mail/V8/MailData/Envelope Index"
        if db_path.exists():
            return db_path
        
        raise FileNotFoundError("Apple Mail database not found. Ensure Apple Mail is installed and has been used.")
    
    async def __aenter__(self):
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cleanup()
    
    async def initialize(self):
        """Initialize the database reader"""
        self._pool = AsyncSQLitePool(
            database_path=self.db_path,
            min_connections=2,
            max_connections=self.pool_size
        )
        await self._pool.initialize()
        
        logger.info(f"AsyncAppleMailDBReader initialized with database: {self.db_path}")
    
    async def cleanup(self):
        """Cleanup resources"""
        if self._pool:
            await self._pool.close()
        
        # Clear cache
        self._query_cache.clear()
        
        logger.info("AsyncAppleMailDBReader cleaned up")
    
    def _convert_timestamp(self, timestamp: Optional[float]) -> Optional[str]:
        """Convert Apple Mail timestamp to readable format"""
        if timestamp is None:
            return None
        
        try:
            # Apple Mail uses Core Data timestamp (seconds since 2001-01-01)
            apple_epoch = datetime(2001, 1, 1)
            dt = apple_epoch + timedelta(seconds=timestamp)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except (ValueError, OverflowError):
            return str(timestamp)
    
    def _generate_cache_key(self, query: str, params: Tuple) -> str:
        """Generate cache key for query"""
        import hashlib
        key_data = f"{query}|{params}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    async def _execute_query_with_cache(
        self, 
        query: str, 
        params: Tuple = (),
        use_cache: bool = True
    ) -> List[aiosqlite.Row]:
        """Execute query with caching and performance monitoring"""
        
        # Check cache first
        cache_key = self._generate_cache_key(query, params)
        if use_cache and cache_key in self._query_cache:
            result, timestamp = self._query_cache[cache_key]
            if time.time() - timestamp < self._cache_ttl:
                self.stats['cache_hits'] += 1
                return result
            else:
                # Cache expired
                del self._query_cache[cache_key]
        
        # Execute query
        start_time = time.time()
        
        try:
            async with self._pool.acquire() as conn:
                cursor = await conn.execute(query, params)
                rows = await cursor.fetchall()
                
            duration_ms = (time.time() - start_time) * 1000
            
            # Update statistics
            self.stats['queries_executed'] += 1
            self.stats['cache_misses'] += 1
            self.stats['total_rows_returned'] += len(rows)
            
            # Update average query time
            if self.stats['avg_query_time_ms'] == 0:
                self.stats['avg_query_time_ms'] = duration_ms
            else:
                self.stats['avg_query_time_ms'] = (
                    self.stats['avg_query_time_ms'] + duration_ms
                ) / 2
            
            # Store performance metrics
            if self.enable_monitoring:
                metric = QueryMetrics(
                    query_type=query.split()[0].upper(),  # SELECT, INSERT, etc.
                    duration_ms=duration_ms,
                    rows_returned=len(rows),
                    parameters=dict(enumerate(params))
                )
                self.query_metrics.append(metric)
            
            # Cache result
            if use_cache and len(rows) < 1000:  # Don't cache very large results
                # Manage cache size
                if len(self._query_cache) >= self.cache_size:
                    # Remove oldest entry
                    oldest_key = min(
                        self._query_cache.keys(),
                        key=lambda k: self._query_cache[k][1]
                    )
                    del self._query_cache[oldest_key]
                
                self._query_cache[cache_key] = (rows, time.time())
            
            return rows
            
        except Exception as e:
            self.stats['errors'] += 1
            logger.error(f"Database query error: {e}")
            raise
    
    async def get_recent_emails(
        self, 
        limit: int = 10,
        include_deleted: bool = False
    ) -> List[EmailRecord]:
        """Get recent emails with async optimization"""
        
        deleted_condition = "" if include_deleted else "AND m.deleted = 0"
        
        query = f"""
        SELECT 
            m.ROWID as id,
            m.message_id,
            m.document_id,
            s.subject as subject,
            sender_add.address as sender_email,
            sender_add.comment as sender_name,
            m.date_sent,
            m.date_received,
            m.read,
            m.flagged,
            m.deleted,
            m.size,
            mb.url as mailbox_path
        FROM messages m
        LEFT JOIN subjects s ON m.subject = s.ROWID
        LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
        LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
        WHERE 1=1 {deleted_condition}
        ORDER BY m.date_received DESC
        LIMIT ?
        """
        
        rows = await self._execute_query_with_cache(query, (limit,))
        
        return [
            EmailRecord(
                id=row['id'],
                message_id=row['message_id'],
                subject=row['subject'],
                sender_email=row['sender_email'],
                sender_name=row['sender_name'],
                date_received=self._convert_timestamp(row['date_received']),
                date_sent=self._convert_timestamp(row['date_sent']),
                is_read=bool(row['read']),
                is_flagged=bool(row['flagged']),
                is_deleted=bool(row['deleted']),
                size=row['size'],
                mailbox_path=row['mailbox_path']
            )
            for row in rows
        ]
    
    async def search_emails(
        self,
        query_text: str,
        field: str = "all",
        limit: int = 50,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> List[EmailRecord]:
        """Advanced email search with multiple criteria"""
        
        search_pattern = f"%{query_text}%"
        params = []
        conditions = ["m.deleted = 0"]
        
        # Build search conditions
        if field == "subject":
            conditions.append("s.subject LIKE ?")
            params.append(search_pattern)
        elif field == "sender":
            conditions.append("(sender_add.address LIKE ? OR sender_add.comment LIKE ?)")
            params.extend([search_pattern, search_pattern])
        elif field == "content":
            # Note: Apple Mail doesn't store full content in Envelope Index
            conditions.append("s.subject LIKE ?")
            params.append(search_pattern)
        else:  # all fields
            conditions.append("""
                (s.subject LIKE ? 
                 OR sender_add.address LIKE ? 
                 OR sender_add.comment LIKE ?)
            """)
            params.extend([search_pattern, search_pattern, search_pattern])
        
        # Date range filtering
        if date_from:
            apple_epoch = datetime(2001, 1, 1)
            timestamp_from = (date_from - apple_epoch).total_seconds()
            conditions.append("m.date_received >= ?")
            params.append(timestamp_from)
        
        if date_to:
            apple_epoch = datetime(2001, 1, 1)
            timestamp_to = (date_to - apple_epoch).total_seconds()
            conditions.append("m.date_received <= ?")
            params.append(timestamp_to)
        
        where_clause = " AND ".join(conditions)
        params.append(limit)
        
        query = f"""
        SELECT 
            m.ROWID as id,
            m.message_id,
            s.subject as subject,
            sender_add.address as sender_email,
            sender_add.comment as sender_name,
            m.date_received,
            m.date_sent,
            m.read,
            m.flagged,
            m.deleted,
            m.size,
            mb.url as mailbox_path
        FROM messages m
        LEFT JOIN subjects s ON m.subject = s.ROWID
        LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
        LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
        WHERE {where_clause}
        ORDER BY m.date_received DESC
        LIMIT ?
        """
        
        rows = await self._execute_query_with_cache(query, tuple(params))
        
        return [
            EmailRecord(
                id=row['id'],
                message_id=row['message_id'],
                subject=row['subject'],
                sender_email=row['sender_email'],
                sender_name=row['sender_name'],
                date_received=self._convert_timestamp(row['date_received']),
                date_sent=self._convert_timestamp(row['date_sent']),
                is_read=bool(row['read']),
                is_flagged=bool(row['flagged']),
                is_deleted=bool(row['deleted']),
                size=row['size'],
                mailbox_path=row['mailbox_path']
            )
            for row in rows
        ]
    
    async def get_unread_emails(self, limit: int = 50) -> List[EmailRecord]:
        """Get unread emails efficiently"""
        
        query = """
        SELECT 
            m.ROWID as id,
            m.message_id,
            s.subject as subject,
            sender_add.address as sender_email,
            sender_add.comment as sender_name,
            m.date_received,
            m.date_sent,
            m.flagged,
            m.size,
            mb.url as mailbox_path
        FROM messages m
        LEFT JOIN subjects s ON m.subject = s.ROWID
        LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
        LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
        WHERE m.deleted = 0 AND m.read = 0
        ORDER BY m.date_received DESC
        LIMIT ?
        """
        
        rows = await self._execute_query_with_cache(query, (limit,))
        
        return [
            EmailRecord(
                id=row['id'],
                message_id=row['message_id'],
                subject=row['subject'],
                sender_email=row['sender_email'],
                sender_name=row['sender_name'],
                date_received=self._convert_timestamp(row['date_received']),
                date_sent=self._convert_timestamp(row['date_sent']),
                is_read=False,
                is_flagged=bool(row['flagged']),
                is_deleted=False,
                size=row['size'],
                mailbox_path=row['mailbox_path']
            )
            for row in rows
        ]
    
    async def get_flagged_emails(self, limit: int = 50) -> List[EmailRecord]:
        """Get flagged emails efficiently"""
        
        query = """
        SELECT 
            m.ROWID as id,
            m.message_id,
            s.subject as subject,
            sender_add.address as sender_email,
            sender_add.comment as sender_name,
            m.date_received,
            m.date_sent,
            m.read,
            m.size,
            mb.url as mailbox_path
        FROM messages m
        LEFT JOIN subjects s ON m.subject = s.ROWID
        LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
        LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
        WHERE m.deleted = 0 AND m.flagged = 1
        ORDER BY m.date_received DESC
        LIMIT ?
        """
        
        rows = await self._execute_query_with_cache(query, (limit,))
        
        return [
            EmailRecord(
                id=row['id'],
                message_id=row['message_id'],
                subject=row['subject'],
                sender_email=row['sender_email'],
                sender_name=row['sender_name'],
                date_received=self._convert_timestamp(row['date_received']),
                date_sent=self._convert_timestamp(row['date_sent']),
                is_read=bool(row['read']),
                is_flagged=True,
                is_deleted=False,
                size=row['size'],
                mailbox_path=row['mailbox_path']
            )
            for row in rows
        ]
    
    async def stream_emails(
        self,
        batch_size: int = 100,
        include_deleted: bool = False
    ) -> AsyncIterator[List[EmailRecord]]:
        """Stream all emails in batches for memory-efficient processing"""
        
        deleted_condition = "" if include_deleted else "AND m.deleted = 0"
        
        # First, get total count
        count_query = f"""
        SELECT COUNT(*) as total
        FROM messages m
        WHERE 1=1 {deleted_condition}
        """
        
        count_rows = await self._execute_query_with_cache(count_query, (), use_cache=False)
        total_emails = count_rows[0]['total'] if count_rows else 0
        
        # Stream in batches
        offset = 0
        while offset < total_emails:
            query = f"""
            SELECT 
                m.ROWID as id,
                m.message_id,
                s.subject as subject,
                sender_add.address as sender_email,
                sender_add.comment as sender_name,
                m.date_received,
                m.date_sent,
                m.read,
                m.flagged,
                m.deleted,
                m.size,
                mb.url as mailbox_path
            FROM messages m
            LEFT JOIN subjects s ON m.subject = s.ROWID
            LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
            LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
            WHERE 1=1 {deleted_condition}
            ORDER BY m.date_received DESC
            LIMIT ? OFFSET ?
            """
            
            rows = await self._execute_query_with_cache(
                query, (batch_size, offset), use_cache=False
            )
            
            if not rows:
                break
            
            batch = [
                EmailRecord(
                    id=row['id'],
                    message_id=row['message_id'],
                    subject=row['subject'],
                    sender_email=row['sender_email'],
                    sender_name=row['sender_name'],
                    date_received=self._convert_timestamp(row['date_received']),
                    date_sent=self._convert_timestamp(row['date_sent']),
                    is_read=bool(row['read']),
                    is_flagged=bool(row['flagged']),
                    is_deleted=bool(row['deleted']),
                    size=row['size'],
                    mailbox_path=row['mailbox_path']
                )
                for row in rows
            ]
            
            yield batch
            offset += batch_size
    
    async def get_database_stats(self) -> DatabaseStats:
        """Get comprehensive database statistics"""
        
        stats_queries = {
            'total_emails': "SELECT COUNT(*) as count FROM messages WHERE deleted = 0",
            'unread_count': "SELECT COUNT(*) as count FROM messages WHERE deleted = 0 AND read = 0",
            'flagged_count': "SELECT COUNT(*) as count FROM messages WHERE deleted = 0 AND flagged = 1",
        }
        
        # Execute basic stats queries concurrently
        tasks = [
            self._execute_query_with_cache(query, ())
            for query in stats_queries.values()
        ]
        
        results = await asyncio.gather(*tasks)
        
        total_emails = results[0][0]['count'] if results[0] else 0
        unread_count = results[1][0]['count'] if results[1] else 0
        flagged_count = results[2][0]['count'] if results[2] else 0
        
        # Get time-based statistics
        seven_days_ago = datetime.now() - timedelta(days=7)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        apple_epoch = datetime(2001, 1, 1)
        
        seven_days_timestamp = (seven_days_ago - apple_epoch).total_seconds()
        thirty_days_timestamp = (thirty_days_ago - apple_epoch).total_seconds()
        
        time_queries = [
            ("SELECT COUNT(*) as count FROM messages WHERE deleted = 0 AND date_received > ?", 
             (seven_days_timestamp,)),
            ("SELECT COUNT(*) as count FROM messages WHERE deleted = 0 AND date_received > ?", 
             (thirty_days_timestamp,)),
        ]
        
        time_results = await asyncio.gather(*[
            self._execute_query_with_cache(query, params)
            for query, params in time_queries
        ])
        
        emails_last_7_days = time_results[0][0]['count'] if time_results[0] else 0
        emails_last_30_days = time_results[1][0]['count'] if time_results[1] else 0
        
        # Get mailbox distribution
        mailbox_query = """
        SELECT mb.url, COUNT(*) as count 
        FROM messages m
        JOIN mailboxes mb ON m.mailbox = mb.ROWID
        WHERE m.deleted = 0
        GROUP BY mb.url
        ORDER BY count DESC
        LIMIT 10
        """
        
        mailbox_rows = await self._execute_query_with_cache(mailbox_query, ())
        mailbox_distribution = [(row['url'], row['count']) for row in mailbox_rows]
        
        # Get date range
        date_range_query = """
        SELECT 
            MIN(date_received) as oldest,
            MAX(date_received) as newest
        FROM messages 
        WHERE deleted = 0 AND date_received IS NOT NULL
        """
        
        date_rows = await self._execute_query_with_cache(date_range_query, ())
        date_info = date_rows[0] if date_rows else {'oldest': None, 'newest': None}
        
        oldest_date = self._convert_timestamp(date_info['oldest'])
        newest_date = self._convert_timestamp(date_info['newest'])
        
        # Get database file size
        try:
            db_size_bytes = self.db_path.stat().st_size
            db_size_mb = db_size_bytes / (1024 * 1024)
        except:
            db_size_mb = 0.0
        
        return DatabaseStats(
            total_emails=total_emails,
            unread_count=unread_count,
            flagged_count=flagged_count,
            emails_last_7_days=emails_last_7_days,
            emails_last_30_days=emails_last_30_days,
            mailbox_distribution=mailbox_distribution,
            oldest_email_date=oldest_date,
            newest_email_date=newest_date,
            database_size_mb=db_size_mb
        )
    
    async def get_performance_metrics(self) -> Dict[str, Any]:
        """Get comprehensive performance metrics"""
        
        pool_stats = await self._pool.get_pool_stats() if self._pool else {}
        
        # Calculate query performance statistics
        recent_queries = list(self.query_metrics)[-100:]  # Last 100 queries
        
        query_stats = {}
        if recent_queries:
            avg_duration = sum(q.duration_ms for q in recent_queries) / len(recent_queries)
            max_duration = max(q.duration_ms for q in recent_queries)
            min_duration = min(q.duration_ms for q in recent_queries)
            
            query_stats = {
                'recent_queries_count': len(recent_queries),
                'avg_duration_ms': avg_duration,
                'max_duration_ms': max_duration,
                'min_duration_ms': min_duration,
                'query_types': {}
            }
            
            # Group by query type
            query_types = {}
            for query in recent_queries:
                qtype = query.query_type
                if qtype not in query_types:
                    query_types[qtype] = []
                query_types[qtype].append(query.duration_ms)
            
            for qtype, durations in query_types.items():
                query_stats['query_types'][qtype] = {
                    'count': len(durations),
                    'avg_duration_ms': sum(durations) / len(durations),
                    'max_duration_ms': max(durations),
                    'min_duration_ms': min(durations)
                }
        
        return {
            'reader_stats': self.stats,
            'pool_stats': pool_stats,
            'query_performance': query_stats,
            'cache_stats': {
                'size': len(self._query_cache),
                'max_size': self.cache_size,
                'hit_rate': self.stats['cache_hits'] / max(1, self.stats['cache_hits'] + self.stats['cache_misses']),
                'ttl_seconds': self._cache_ttl
            },
            'system_stats': {
                'memory_usage_mb': psutil.Process().memory_info().rss / 1024 / 1024,
                'database_path': str(self.db_path),
                'database_size_mb': self.db_path.stat().st_size / (1024 * 1024) if self.db_path.exists() else 0
            }
        }

# ============================================================================
# Example Usage and Testing
# ============================================================================

async def demo_async_mail_reader():
    """Demonstration of the async Apple Mail database reader"""
    
    print("🚀 Starting Async Apple Mail Database Reader Demo")
    print("=" * 60)
    
    try:
        # Initialize reader with context manager
        async with AsyncAppleMailDBReader(
            pool_size=3,
            cache_size=50,
            enable_monitoring=True
        ) as reader:
            
            print("📊 Getting database statistics...")
            stats = await reader.get_database_stats()
            print(f"  Total Emails: {stats.total_emails:,}")
            print(f"  Unread: {stats.unread_count:,}")
            print(f"  Flagged: {stats.flagged_count:,}")
            print(f"  Last 7 days: {stats.emails_last_7_days:,}")
            print(f"  Database size: {stats.database_size_mb:.1f} MB")
            
            print(f"\n📧 Getting recent emails...")
            start_time = time.time()
            recent_emails = await reader.get_recent_emails(limit=5)
            recent_time = time.time() - start_time
            
            print(f"  Retrieved {len(recent_emails)} emails in {recent_time*1000:.1f}ms")
            for i, email in enumerate(recent_emails[:3], 1):
                print(f"    {i}. {email.subject[:50]}... ({email.sender_name or email.sender_email})")
            
            print(f"\n🔍 Searching emails...")
            start_time = time.time()
            search_results = await reader.search_emails("meeting", limit=3)
            search_time = time.time() - start_time
            
            print(f"  Found {len(search_results)} emails in {search_time*1000:.1f}ms")
            for email in search_results:
                print(f"    - {email.subject} ({email.date_received})")
            
            print(f"\n📬 Getting unread emails...")
            start_time = time.time()
            unread_emails = await reader.get_unread_emails(limit=5)
            unread_time = time.time() - start_time
            
            print(f"  Retrieved {len(unread_emails)} unread emails in {unread_time*1000:.1f}ms")
            
            print(f"\n🏃 Testing concurrent operations...")
            start_time = time.time()
            
            # Execute multiple operations concurrently
            tasks = [
                reader.get_recent_emails(limit=10),
                reader.get_unread_emails(limit=10),
                reader.get_flagged_emails(limit=10),
                reader.search_emails("update", limit=5)
            ]
            
            concurrent_results = await asyncio.gather(*tasks)
            concurrent_time = time.time() - start_time
            
            total_emails = sum(len(result) for result in concurrent_results)
            print(f"  Processed {total_emails} emails across 4 concurrent operations in {concurrent_time*1000:.1f}ms")
            
            # Test caching by repeating a query
            print(f"\n💾 Testing query caching...")
            start_time = time.time()
            cached_results = await reader.get_recent_emails(limit=5)
            cache_time = time.time() - start_time
            
            print(f"  Cached query completed in {cache_time*1000:.1f}ms")
            
            # Stream processing demo
            print(f"\n🌊 Testing streaming (first 2 batches)...")
            batch_count = 0
            total_streamed = 0
            
            async for batch in reader.stream_emails(batch_size=50):
                batch_count += 1
                total_streamed += len(batch)
                print(f"    Batch {batch_count}: {len(batch)} emails")
                
                if batch_count >= 2:  # Limit demo to 2 batches
                    break
            
            print(f"  Streamed {total_streamed} emails in {batch_count} batches")
            
            # Get performance metrics
            print(f"\n📈 Performance Metrics:")
            metrics = await reader.get_performance_metrics()
            
            reader_stats = metrics['reader_stats']
            print(f"  Queries executed: {reader_stats['queries_executed']}")
            print(f"  Cache hit rate: {metrics['cache_stats']['hit_rate']:.1%}")
            print(f"  Average query time: {reader_stats['avg_query_time_ms']:.1f}ms")
            print(f"  Total rows returned: {reader_stats['total_rows_returned']:,}")
            print(f"  Memory usage: {metrics['system_stats']['memory_usage_mb']:.1f} MB")
            
            pool_stats = metrics['pool_stats']
            print(f"  Active connections: {pool_stats['active_connections']}")
            print(f"  Pool hits: {pool_stats['pool_hits']}")
            print(f"  Pool misses: {pool_stats['pool_misses']}")
            
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        print("Make sure Apple Mail is installed and has been used.")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(demo_async_mail_reader())
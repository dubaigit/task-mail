#!/usr/bin/env python3
"""
Real-time Analytics Engine - Live metrics and dashboard data for Email Intelligence System
Provides streaming analytics, sliding window calculations, and real-time insights
FastAPI integration for analytics dashboard and WebSocket real-time updates
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict, field
from collections import defaultdict, deque
from enum import Enum
import statistics

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Configure logging
logger = logging.getLogger(__name__)

class MetricType(Enum):
    """Types of metrics we track"""
    COUNTER = "counter"          # Simple incrementing count
    GAUGE = "gauge"             # Current value
    HISTOGRAM = "histogram"     # Distribution of values
    RATE = "rate"              # Events per time unit
    AVERAGE = "average"        # Moving average

@dataclass
class MetricPoint:
    """Single metric data point"""
    timestamp: datetime
    value: float
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class TimeWindow:
    """Time window for metric calculations"""
    duration: timedelta
    points: deque = field(default_factory=deque)
    
    def add_point(self, point: MetricPoint):
        """Add a point and clean old ones"""
        self.points.append(point)
        cutoff = datetime.now() - self.duration
        while self.points and self.points[0].timestamp < cutoff:
            self.points.popleft()
    
    def get_count(self) -> int:
        """Get count of points in window"""
        return len(self.points)
    
    def get_sum(self) -> float:
        """Get sum of values in window"""
        return sum(point.value for point in self.points)
    
    def get_average(self) -> float:
        """Get average of values in window"""
        if not self.points:
            return 0.0
        return self.get_sum() / len(self.points)
    
    def get_rate_per_minute(self) -> float:
        """Get rate per minute"""
        if not self.points:
            return 0.0
        
        duration_minutes = self.duration.total_seconds() / 60
        return len(self.points) / duration_minutes if duration_minutes > 0 else 0.0

class SlidingWindowMetric:
    """Metric with sliding time windows for real-time calculations"""
    
    def __init__(self, name: str, metric_type: MetricType):
        self.name = name
        self.metric_type = metric_type
        self.windows = {
            '1min': TimeWindow(timedelta(minutes=1)),
            '5min': TimeWindow(timedelta(minutes=5)),
            '15min': TimeWindow(timedelta(minutes=15)),
            '1hour': TimeWindow(timedelta(hours=1)),
            '24hour': TimeWindow(timedelta(hours=24))
        }
        self.total_count = 0
        self.total_sum = 0.0
        self.created_at = datetime.now()
    
    def add_value(self, value: float, metadata: Optional[Dict[str, Any]] = None):
        """Add a new value to all windows"""
        point = MetricPoint(datetime.now(), value, metadata or {})
        
        for window in self.windows.values():
            window.add_point(point)
        
        self.total_count += 1
        self.total_sum += value
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive statistics for all windows"""
        stats = {
            'name': self.name,
            'type': self.metric_type.value,
            'total_count': self.total_count,
            'total_sum': self.total_sum,
            'created_at': self.created_at.isoformat(),
            'windows': {}
        }
        
        for window_name, window in self.windows.items():
            window_stats = {
                'count': window.get_count(),
                'sum': window.get_sum(),
                'average': window.get_average(),
                'rate_per_minute': window.get_rate_per_minute()
            }
            
            # Add percentiles for histograms
            if self.metric_type == MetricType.HISTOGRAM and window.points:
                values = [p.value for p in window.points]
                window_stats.update({
                    'min': min(values),
                    'max': max(values),
                    'median': statistics.median(values),
                    'p95': statistics.quantiles(values, n=20)[18] if len(values) >= 20 else max(values),
                    'p99': statistics.quantiles(values, n=100)[98] if len(values) >= 100 else max(values)
                })
            
            stats['windows'][window_name] = window_stats
        
        return stats

class EmailAnalytics:
    """Email-specific analytics calculations"""
    
    def __init__(self):
        self.classification_counts = defaultdict(int)
        self.urgency_counts = defaultdict(int)
        self.sender_stats = defaultdict(lambda: {'count': 0, 'last_seen': None})
        self.hourly_patterns = defaultdict(int)
        self.response_times = []
        self.processing_times = []
    
    def process_email_event(self, email_data: Dict[str, Any], intelligence_data: Optional[Dict[str, Any]] = None):
        """Process a new email event for analytics"""
        try:
            # Classification tracking
            if intelligence_data:
                nano = intelligence_data.get('nano_classification', {})
                
                if 'category' in nano:
                    category = nano['category']
                    if isinstance(category, dict):
                        category = category.get('value', 'unknown')
                    self.classification_counts[category] += 1
                
                if 'urgency' in nano:
                    urgency = nano['urgency']
                    if isinstance(urgency, dict):
                        urgency = urgency.get('name', 'unknown')
                    self.urgency_counts[urgency] += 1
                
                # Processing time tracking
                if 'processing_time_ms' in intelligence_data:
                    self.processing_times.append(intelligence_data['processing_time_ms'])
                    # Keep only recent processing times
                    if len(self.processing_times) > 1000:
                        self.processing_times = self.processing_times[-1000:]
            
            # Sender tracking
            sender = email_data.get('sender_email', 'unknown')
            self.sender_stats[sender]['count'] += 1
            self.sender_stats[sender]['last_seen'] = datetime.now()
            
            # Hourly pattern tracking
            email_time = datetime.now()
            hour_key = email_time.hour
            self.hourly_patterns[hour_key] += 1
            
        except Exception as e:
            logger.error(f"Error processing email analytics: {e}")
    
    def get_classification_distribution(self) -> Dict[str, float]:
        """Get email classification distribution as percentages"""
        total = sum(self.classification_counts.values())
        if total == 0:
            return {}
        
        return {
            category: (count / total) * 100
            for category, count in self.classification_counts.items()
        }
    
    def get_urgency_distribution(self) -> Dict[str, float]:
        """Get urgency distribution as percentages"""
        total = sum(self.urgency_counts.values())
        if total == 0:
            return {}
        
        return {
            urgency: (count / total) * 100
            for urgency, count in self.urgency_counts.items()
        }
    
    def get_top_senders(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top email senders by volume"""
        sorted_senders = sorted(
            self.sender_stats.items(),
            key=lambda x: x[1]['count'],
            reverse=True
        )
        
        return [
            {
                'sender': sender,
                'count': stats['count'],
                'last_seen': stats['last_seen'].isoformat() if stats['last_seen'] else None
            }
            for sender, stats in sorted_senders[:limit]
        ]
    
    def get_hourly_patterns(self) -> Dict[int, int]:
        """Get hourly email patterns"""
        return dict(self.hourly_patterns)
    
    def get_processing_stats(self) -> Dict[str, float]:
        """Get processing time statistics"""
        if not self.processing_times:
            return {}
        
        return {
            'avg_processing_time_ms': statistics.mean(self.processing_times),
            'min_processing_time_ms': min(self.processing_times),
            'max_processing_time_ms': max(self.processing_times),
            'median_processing_time_ms': statistics.median(self.processing_times)
        }

class RealtimeAnalyticsEngine:
    """
    Main analytics engine providing real-time insights and metrics
    Handles streaming data, sliding windows, and dashboard updates
    """
    
    def __init__(self, update_interval: float = 5.0):
        self.update_interval = update_interval
        self.metrics: Dict[str, SlidingWindowMetric] = {}
        self.email_analytics = EmailAnalytics()
        self.dashboard_callbacks: List[Callable] = []
        self.is_running = False
        
        # Initialize core metrics
        self._init_core_metrics()
        
        # System health tracking
        self.system_health = {
            'last_update': datetime.now(),
            'alerts': deque(maxlen=100),
            'performance_issues': deque(maxlen=50)
        }
    
    def _init_core_metrics(self):
        """Initialize core metrics we track"""
        core_metrics = [
            ('emails_received', MetricType.COUNTER),
            ('emails_processed', MetricType.COUNTER),
            ('processing_time_ms', MetricType.HISTOGRAM),
            ('urgent_emails', MetricType.COUNTER),
            ('classification_requests', MetricType.COUNTER),
            ('websocket_connections', MetricType.GAUGE),
            ('queue_size', MetricType.GAUGE),
            ('error_rate', MetricType.RATE)
        ]
        
        for name, metric_type in core_metrics:
            self.metrics[name] = SlidingWindowMetric(name, metric_type)
    
    def add_metric(self, name: str, metric_type: MetricType):
        """Add a custom metric"""
        self.metrics[name] = SlidingWindowMetric(name, metric_type)
        logger.info(f"Added metric: {name} ({metric_type.value})")
    
    def record_metric(self, name: str, value: float, metadata: Optional[Dict[str, Any]] = None):
        """Record a metric value"""
        if name in self.metrics:
            self.metrics[name].add_value(value, metadata)
        else:
            logger.warning(f"Unknown metric: {name}")
    
    def process_email_event(self, email_data: Dict[str, Any], intelligence_data: Optional[Dict[str, Any]] = None):
        """Process an email event and update analytics"""
        try:
            # Record core metrics
            self.record_metric('emails_received', 1)
            
            if intelligence_data:
                self.record_metric('emails_processed', 1)
                
                # Record processing time
                if 'processing_time_ms' in intelligence_data:
                    self.record_metric('processing_time_ms', intelligence_data['processing_time_ms'])
                
                # Check for urgent emails
                nano = intelligence_data.get('nano_classification', {})
                if nano:
                    urgency = nano.get('urgency', {})
                    if isinstance(urgency, dict):
                        urgency_value = urgency.get('value', 1)
                        if urgency_value >= 4:
                            self.record_metric('urgent_emails', 1)
            
            # Process email-specific analytics
            self.email_analytics.process_email_event(email_data, intelligence_data)
            
            # Check for alerts
            self._check_for_alerts(email_data, intelligence_data)
            
        except Exception as e:
            logger.error(f"Error processing email event for analytics: {e}")
            self.record_metric('error_rate', 1)
    
    def _check_for_alerts(self, email_data: Dict[str, Any], intelligence_data: Optional[Dict[str, Any]] = None):
        """Check if this email should trigger any alerts"""
        try:
            alerts = []
            
            # High urgency alert
            if intelligence_data:
                nano = intelligence_data.get('nano_classification', {})
                urgency = nano.get('urgency', {})
                if isinstance(urgency, dict) and urgency.get('value', 1) >= 5:
                    alerts.append({
                        'type': 'high_urgency',
                        'message': f"Critical email from {email_data.get('sender_email', 'unknown')}",
                        'timestamp': datetime.now(),
                        'data': {'subject': email_data.get('subject_text', '')}
                    })
            
            # Volume spike alert (simple implementation)
            current_rate = self.metrics['emails_received'].windows['1min'].get_rate_per_minute()
            if current_rate > 10:  # More than 10 emails per minute
                alerts.append({
                    'type': 'volume_spike',
                    'message': f"High email volume: {current_rate:.1f} emails/min",
                    'timestamp': datetime.now(),
                    'data': {'rate': current_rate}
                })
            
            # Add alerts to system health
            for alert in alerts:
                self.system_health['alerts'].append(alert)
                logger.warning(f"Alert: {alert['message']}")
            
        except Exception as e:
            logger.error(f"Error checking for alerts: {e}")
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get comprehensive dashboard data"""
        try:
            # Core metrics
            metrics_data = {}
            for name, metric in self.metrics.items():
                metrics_data[name] = metric.get_stats()
            
            # Email analytics
            email_data = {
                'classification_distribution': self.email_analytics.get_classification_distribution(),
                'urgency_distribution': self.email_analytics.get_urgency_distribution(),
                'top_senders': self.email_analytics.get_top_senders(),
                'hourly_patterns': self.email_analytics.get_hourly_patterns(),
                'processing_stats': self.email_analytics.get_processing_stats()
            }
            
            # Recent alerts
            recent_alerts = list(self.system_health['alerts'])[-10:]  # Last 10 alerts
            
            # System overview
            overview = {
                'emails_last_hour': self.metrics['emails_received'].windows['1hour'].get_count(),
                'avg_processing_time': self.metrics['processing_time_ms'].windows['5min'].get_average(),
                'urgent_emails_today': self.metrics['urgent_emails'].windows['24hour'].get_count(),
                'current_rate': self.metrics['emails_received'].windows['1min'].get_rate_per_minute(),
                'system_health': 'healthy' if len(recent_alerts) == 0 else 'warning'
            }
            
            return {
                'overview': overview,
                'metrics': metrics_data,
                'email_analytics': email_data,
                'recent_alerts': [
                    {
                        **alert,
                        'timestamp': alert['timestamp'].isoformat()
                    }
                    for alert in recent_alerts
                ],
                'last_updated': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating dashboard data: {e}")
            return {'error': str(e), 'last_updated': datetime.now().isoformat()}
    
    def register_dashboard_callback(self, callback: Callable):
        """Register a callback for dashboard updates"""
        self.dashboard_callbacks.append(callback)
    
    async def start_dashboard_updates(self):
        """Start periodic dashboard updates"""
        if self.is_running:
            logger.warning("Dashboard updates are already running")
            return
        
        self.is_running = True
        logger.info(f"Starting dashboard updates every {self.update_interval} seconds")
        
        try:
            while self.is_running:
                # Generate dashboard data
                dashboard_data = self.get_dashboard_data()
                
                # Call all registered callbacks
                for callback in self.dashboard_callbacks:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(dashboard_data)
                        else:
                            callback(dashboard_data)
                    except Exception as e:
                        logger.error(f"Error in dashboard callback: {e}")
                
                # Update system health
                self.system_health['last_update'] = datetime.now()
                
                await asyncio.sleep(self.update_interval)
                
        except asyncio.CancelledError:
            logger.info("Dashboard updates cancelled")
        except Exception as e:
            logger.error(f"Error in dashboard updates: {e}")
        finally:
            self.is_running = False
            logger.info("Dashboard updates stopped")
    
    def stop_dashboard_updates(self):
        """Stop dashboard updates"""
        self.is_running = False
    
    def get_performance_report(self) -> Dict[str, Any]:
        """Generate a comprehensive performance report"""
        return {
            'uptime': datetime.now() - self.system_health['last_update'],
            'total_emails_processed': self.metrics['emails_processed'].total_count,
            'avg_processing_time_1h': self.metrics['processing_time_ms'].windows['1hour'].get_average(),
            'error_rate_1h': self.metrics['error_rate'].windows['1hour'].get_rate_per_minute(),
            'peak_rate_today': max(
                self.metrics['emails_received'].windows['24hour'].get_rate_per_minute(),
                0
            ),
            'classification_accuracy': self._estimate_classification_accuracy(),
            'system_alerts_count': len(self.system_health['alerts']),
            'performance_issues': len(self.system_health['performance_issues'])
        }
    
    def _estimate_classification_accuracy(self) -> float:
        """Estimate classification accuracy based on confidence scores"""
        # This would be enhanced with actual accuracy tracking
        # For now, return a placeholder
        return 95.0

# Pydantic models for API responses
class MetricResponse(BaseModel):
    name: str
    type: str
    total_count: int
    total_sum: float
    created_at: str
    windows: Dict[str, Dict[str, float]]

class AnalyticsOverview(BaseModel):
    emails_last_hour: int
    avg_processing_time: float
    urgent_emails_today: int
    current_rate: float
    system_health: str
    error_rate: float

class ClassificationData(BaseModel):
    distribution: Dict[str, float]
    total_count: int
    trends: Dict[str, List[float]]

class DashboardData(BaseModel):
    overview: AnalyticsOverview
    classification_data: ClassificationData
    urgency_distribution: Dict[str, float]
    top_senders: List[Dict[str, Any]]
    hourly_patterns: Dict[int, int]
    processing_stats: Dict[str, float]
    recent_alerts: List[Dict[str, Any]]
    last_updated: str

# Global analytics engine instance
analytics_engine: Optional[RealtimeAnalyticsEngine] = None

# FastAPI application for analytics
analytics_app = FastAPI(
    title="Email Intelligence Analytics API",
    description="Real-time analytics and metrics for email intelligence system",
    version="1.0.0"
)

# Configure CORS
analytics_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:8080", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
from websocket_manager import WebSocketManager, WebSocketMessage, MessageType

websocket_manager = WebSocketManager(max_clients=50)

@analytics_app.on_event("startup")
async def startup_event():
    """Initialize analytics engine and WebSocket manager on startup"""
    global analytics_engine
    analytics_engine = RealtimeAnalyticsEngine(update_interval=2.0)
    
    # Register WebSocket callback for real-time updates
    async def websocket_callback(dashboard_data: Dict[str, Any]):
        """Send analytics updates via WebSocket"""
        message = WebSocketMessage(
            event_type=MessageType.ANALYTICS_UPDATE.value,
            timestamp=datetime.now(),
            data=dashboard_data,
            metadata={"source": "analytics_engine"}
        )
        await websocket_manager.broadcast_to_topic("analytics", message)
    
    analytics_engine.register_dashboard_callback(websocket_callback)
    
    # Start background tasks asynchronously (don't await them in startup)
    asyncio.create_task(analytics_engine.start_dashboard_updates())
    asyncio.create_task(websocket_manager.start_background_tasks())
    
    logger.info("Analytics engine and WebSocket manager started")

@analytics_app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if analytics_engine:
        analytics_engine.stop_dashboard_updates()
    await websocket_manager.stop_background_tasks()
    logger.info("Analytics engine and WebSocket manager stopped")

# WebSocket endpoint for real-time analytics
@analytics_app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time analytics updates"""
    client_id = None
    try:
        client_id = await websocket_manager.connect_client(websocket)
        
        # Auto-subscribe to analytics stream
        await websocket_manager.subscription_manager.subscribe(client_id, "analytics")
        
        # Send initial data
        if analytics_engine:
            initial_data = analytics_engine.get_dashboard_data()
            await websocket_manager._send_to_client(client_id, WebSocketMessage(
                event_type=MessageType.ANALYTICS_UPDATE.value,
                timestamp=datetime.now(),
                data=initial_data,
                metadata={"type": "initial"}
            ))
        
        # Handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                await websocket_manager.handle_client_message(client_id, message)
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received from client {client_id}")
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        if client_id:
            await websocket_manager.disconnect_client(client_id)

# REST API endpoints
@analytics_app.get("/")
async def root_endpoint():
    """Root endpoint with service information"""
    return {
        "status": "healthy",
        "service": "Email Intelligence Analytics",
        "timestamp": datetime.now().isoformat(),
        "analytics_engine": "active" if analytics_engine else "inactive",
        "websocket_connections": len(websocket_manager.connections) if websocket_manager else 0
    }

@analytics_app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Email Intelligence Analytics",
        "timestamp": datetime.now().isoformat(),
        "analytics_engine": "active" if analytics_engine else "inactive",
        "websocket_connections": len(websocket_manager.connections) if websocket_manager else 0
    }

@analytics_app.get("/dashboard", response_model=DashboardData)
async def get_dashboard_data():
    """Get comprehensive dashboard data"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    try:
        data = analytics_engine.get_dashboard_data()
        
        # Transform data to match response model
        overview = AnalyticsOverview(
            emails_last_hour=data["overview"]["emails_last_hour"],
            avg_processing_time=data["overview"]["avg_processing_time"],
            urgent_emails_today=data["overview"]["urgent_emails_today"],
            current_rate=data["overview"]["current_rate"],
            system_health=data["overview"]["system_health"],
            error_rate=analytics_engine.metrics["error_rate"].windows["1hour"].get_rate_per_minute()
        )
        
        classification_data = ClassificationData(
            distribution=data["email_analytics"]["classification_distribution"],
            total_count=sum(data["email_analytics"]["classification_distribution"].values()),
            trends={}  # Would be populated with historical data
        )
        
        return DashboardData(
            overview=overview,
            classification_data=classification_data,
            urgency_distribution=data["email_analytics"]["urgency_distribution"],
            top_senders=data["email_analytics"]["top_senders"],
            hourly_patterns=data["email_analytics"]["hourly_patterns"],
            processing_stats=data["email_analytics"]["processing_stats"],
            recent_alerts=data["recent_alerts"],
            last_updated=data["last_updated"]
        )
        
    except Exception as e:
        logger.error(f"Error generating dashboard data: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@analytics_app.get("/metrics")
async def get_all_metrics():
    """Get all metrics data"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    metrics_data = {}
    for name, metric in analytics_engine.metrics.items():
        metrics_data[name] = metric.get_stats()
    
    return {
        "metrics": metrics_data,
        "timestamp": datetime.now().isoformat()
    }

@analytics_app.get("/metrics/{metric_name}")
async def get_metric(metric_name: str):
    """Get specific metric data"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    if metric_name not in analytics_engine.metrics:
        return JSONResponse(
            status_code=404,
            content={"error": f"Metric '{metric_name}' not found"}
        )
    
    return analytics_engine.metrics[metric_name].get_stats()

@analytics_app.get("/stats/overview")
async def get_overview_stats():
    """Get overview statistics"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    return analytics_engine.get_dashboard_data()["overview"]

@analytics_app.get("/stats/classification")
async def get_classification_stats():
    """Get email classification statistics"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    return analytics_engine.email_analytics.get_classification_distribution()

@analytics_app.get("/stats/urgency")
async def get_urgency_stats():
    """Get urgency distribution statistics"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    return analytics_engine.email_analytics.get_urgency_distribution()

@analytics_app.get("/stats/senders")
async def get_top_senders(limit: int = Query(10, ge=1, le=50)):
    """Get top email senders"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    return analytics_engine.email_analytics.get_top_senders(limit)

@analytics_app.get("/stats/patterns")
async def get_hourly_patterns():
    """Get hourly email patterns"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    return analytics_engine.email_analytics.get_hourly_patterns()

@analytics_app.get("/alerts")
async def get_recent_alerts(limit: int = Query(20, ge=1, le=100)):
    """Get recent system alerts"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    recent_alerts = list(analytics_engine.system_health['alerts'])[-limit:]
    return [
        {
            **alert,
            'timestamp': alert['timestamp'].isoformat()
        }
        for alert in recent_alerts
    ]

@analytics_app.post("/process_email")
async def process_email_event(email_data: dict, intelligence_data: dict = None):
    """Process an email event for analytics"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    try:
        analytics_engine.process_email_event(email_data, intelligence_data)
        return {"status": "success", "message": "Email event processed"}
    except Exception as e:
        logger.error(f"Error processing email event: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@analytics_app.get("/performance")
async def get_performance_report():
    """Get system performance report"""
    if not analytics_engine:
        return JSONResponse(
            status_code=503,
            content={"error": "Analytics engine not available"}
        )
    
    report = analytics_engine.get_performance_report()
    # Convert timedelta to string for JSON serialization
    if 'uptime' in report:
        report['uptime'] = str(report['uptime'])
    
    return report

@analytics_app.get("/websocket/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics"""
    return websocket_manager.get_connection_stats()

# Factory function
def create_analytics_engine(update_interval: float = 5.0) -> RealtimeAnalyticsEngine:
    """Create and return an analytics engine instance"""
    return RealtimeAnalyticsEngine(update_interval)

# Function to get analytics app instance
def get_analytics_app() -> FastAPI:
    """Get the analytics FastAPI application"""
    return analytics_app

# Example usage
async def example_dashboard_callback(dashboard_data: Dict[str, Any]):
    """Example dashboard callback"""
    overview = dashboard_data.get('overview', {})
    print(f"📊 Dashboard Update:")
    print(f"   Emails last hour: {overview.get('emails_last_hour', 0)}")
    print(f"   Current rate: {overview.get('current_rate', 0):.1f}/min")
    print(f"   Avg processing: {overview.get('avg_processing_time', 0):.1f}ms")
    print(f"   System health: {overview.get('system_health', 'unknown')}")
    print()

async def main():
    """Example usage of the analytics engine"""
    engine = create_analytics_engine(update_interval=2.0)
    
    # Register dashboard callback
    engine.register_dashboard_callback(example_dashboard_callback)
    
    try:
        # Start dashboard updates
        dashboard_task = asyncio.create_task(engine.start_dashboard_updates())
        
        # Simulate some email events
        for i in range(10):
            email_data = {
                'sender_email': f'user{i % 3}@example.com',
                'subject_text': f'Test Email {i}',
                'date_received': datetime.now().isoformat()
            }
            
            intelligence_data = {
                'nano_classification': {
                    'category': {'value': 'needs_reply'},
                    'urgency': {'value': i % 5 + 1, 'name': 'MEDIUM'}
                },
                'processing_time_ms': 50 + i * 10
            }
            
            engine.process_email_event(email_data, intelligence_data)
            await asyncio.sleep(0.5)
        
        # Let it run for a bit
        await asyncio.sleep(10)
        
        # Get final report
        report = engine.get_performance_report()
        print(f"Performance Report: {json.dumps(report, indent=2, default=str)}")
        
    except KeyboardInterrupt:
        print("Stopping analytics engine...")
    finally:
        engine.stop_dashboard_updates()

if __name__ == "__main__":
    asyncio.run(main())
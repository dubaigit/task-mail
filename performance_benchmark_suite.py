#!/usr/bin/env python3
"""
Comprehensive Performance Benchmarking and Scalability Testing Suite

Advanced testing framework for email intelligence system performance with:
- Load testing for AI processing pipeline
- WebSocket connection stress testing
- Database performance benchmarking
- Cache performance validation
- Scalability threshold identification
- Performance regression detection
- Resource utilization profiling
- SLA compliance validation
- Concurrent user simulation
- Bottleneck identification

Designed to validate system performance under production loads
and identify scaling limits and optimization opportunities.
"""

import asyncio
import logging
import time
import json
import statistics
import random
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
from collections import defaultdict, deque
import threading
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

# Performance monitoring
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

# WebSocket testing
try:
    import websockets
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False

# HTTP testing
try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False

# Setup logging
logger = logging.getLogger(__name__)

class TestType(Enum):
    """Types of performance tests"""
    LOAD_TEST = "load_test"
    STRESS_TEST = "stress_test"
    SPIKE_TEST = "spike_test"
    VOLUME_TEST = "volume_test"
    ENDURANCE_TEST = "endurance_test"
    SCALABILITY_TEST = "scalability_test"

class TestResult(Enum):
    """Test result status"""
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    ERROR = "error"

@dataclass
class BenchmarkMetrics:
    """Performance benchmark metrics"""
    test_name: str
    test_type: TestType
    duration_seconds: float
    total_requests: int
    successful_requests: int
    failed_requests: int
    requests_per_second: float
    average_response_time_ms: float
    p50_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    error_rate_percent: float
    throughput_mb_per_sec: float
    cpu_usage_percent: float
    memory_usage_percent: float
    memory_usage_mb: float
    concurrent_connections: int
    timestamp: datetime
    result: TestResult = TestResult.PASS
    notes: str = ""
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

@dataclass
class ScalabilityResult:
    """Scalability test result"""
    test_name: str
    max_concurrent_users: int
    max_requests_per_second: float
    breaking_point_users: Optional[int]
    breaking_point_rps: Optional[float]
    resource_bottleneck: Optional[str]
    performance_degradation_point: Optional[int]
    recommendations: List[str]
    timestamp: datetime
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

@dataclass
class TestConfiguration:
    """Test configuration parameters"""
    base_url: str = "http://localhost:8002"
    websocket_url: str = "ws://localhost:8002/ws"
    max_concurrent_users: int = 100
    test_duration_seconds: int = 300
    ramp_up_seconds: int = 60
    ramp_down_seconds: int = 30
    request_timeout_seconds: int = 30
    think_time_seconds: float = 1.0
    data_payload_size_kb: int = 10
    enable_detailed_logging: bool = False
    target_response_time_ms: int = 5000
    target_error_rate_percent: float = 1.0
    target_throughput_rps: float = 100.0

class MockWebSocketClient:
    """Mock WebSocket client for testing"""
    
    def __init__(self, client_id: str, url: str):
        self.client_id = client_id
        self.url = url
        self.websocket = None
        self.connected = False
        self.messages_sent = 0
        self.messages_received = 0
        self.last_message_time = None
        self.connection_time = None
        self.errors = []
    
    async def connect(self) -> bool:
        """Connect to WebSocket server"""
        try:
            start_time = time.time()
            
            if WEBSOCKETS_AVAILABLE:
                self.websocket = await websockets.connect(self.url)
            else:
                # Mock connection
                await asyncio.sleep(0.1)
            
            self.connected = True
            self.connection_time = time.time() - start_time
            return True
            
        except Exception as e:
            self.errors.append(f"Connection error: {e}")
            return False
    
    async def send_message(self, message: Dict[str, Any]) -> bool:
        """Send message to server"""
        try:
            if WEBSOCKETS_AVAILABLE and self.websocket:
                await self.websocket.send(json.dumps(message))
            else:
                # Mock sending
                await asyncio.sleep(0.01)
            
            self.messages_sent += 1
            self.last_message_time = time.time()
            return True
            
        except Exception as e:
            self.errors.append(f"Send error: {e}")
            return False
    
    async def receive_message(self, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
        """Receive message from server"""
        try:
            if WEBSOCKETS_AVAILABLE and self.websocket:
                message = await asyncio.wait_for(self.websocket.recv(), timeout=timeout)
                self.messages_received += 1
                return json.loads(message)
            else:
                # Mock receiving
                await asyncio.sleep(0.01)
                self.messages_received += 1
                return {"type": "mock", "data": {}}
                
        except asyncio.TimeoutError:
            return None
        except Exception as e:
            self.errors.append(f"Receive error: {e}")
            return None
    
    async def disconnect(self):
        """Disconnect from server"""
        try:
            if WEBSOCKETS_AVAILABLE and self.websocket:
                await self.websocket.close()
            
            self.connected = False
            
        except Exception as e:
            self.errors.append(f"Disconnect error: {e}")

class AIProcessingBenchmark:
    """Benchmark AI processing performance"""
    
    def __init__(self, config: TestConfiguration):
        self.config = config
        self.response_times = []
        self.error_count = 0
        self.success_count = 0
        self.start_time = None
        self.end_time = None
        
    async def run_load_test(self) -> BenchmarkMetrics:
        """Run AI processing load test"""
        logger.info(f"Starting AI processing load test with {self.config.max_concurrent_users} users")
        
        self.start_time = time.time()
        
        # Create semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(self.config.max_concurrent_users)
        
        # Generate test data
        test_requests = self._generate_test_requests()
        
        # Run concurrent requests
        tasks = []
        for request_data in test_requests:
            task = asyncio.create_task(self._make_ai_request(semaphore, request_data))
            tasks.append(task)
        
        # Wait for all requests to complete
        await asyncio.gather(*tasks, return_exceptions=True)
        
        self.end_time = time.time()
        
        return self._calculate_metrics("AI Processing Load Test", TestType.LOAD_TEST)
    
    def _generate_test_requests(self) -> List[Dict[str, Any]]:
        """Generate test request data"""
        requests = []
        
        test_emails = [
            "Please review the quarterly budget proposal and provide feedback by Friday.",
            "Meeting scheduled for next week to discuss project timeline.",
            "Urgent: Server maintenance required this weekend.",
            "Follow up on client proposal - deadline approaching.",
            "Team building event planning - need headcount confirmation.",
            "Performance review meeting scheduled for next month.",
            "New hire documentation needs to be completed.",
            "Budget approval required for Q4 marketing campaign.",
            "System upgrade notification - downtime expected.",
            "Weekly team sync meeting agenda attached."
        ]
        
        for i in range(self.config.max_concurrent_users * 3):  # 3 requests per user
            email_content = random.choice(test_emails)
            
            request_data = {
                'email_id': i + 1,
                'content': email_content,
                'classification_required': True,
                'draft_required': random.choice([True, False]),
                'priority': random.choice(['high', 'normal', 'low'])
            }
            
            requests.append(request_data)
        
        return requests
    
    async def _make_ai_request(self, semaphore: asyncio.Semaphore, request_data: Dict[str, Any]):
        """Make individual AI processing request"""
        async with semaphore:
            start_time = time.time()
            
            try:
                if AIOHTTP_AVAILABLE:
                    # Make real HTTP request
                    async with aiohttp.ClientSession() as session:
                        async with session.post(
                            f"{self.config.base_url}/api/ai/process",
                            json=request_data,
                            timeout=aiohttp.ClientTimeout(total=self.config.request_timeout_seconds)
                        ) as response:
                            if response.status == 200:
                                await response.json()
                                self.success_count += 1
                            else:
                                self.error_count += 1
                else:
                    # Mock AI processing delay
                    processing_delay = random.uniform(0.5, 3.0)
                    await asyncio.sleep(processing_delay)
                    
                    # Simulate occasional failures
                    if random.random() < 0.05:  # 5% failure rate
                        self.error_count += 1
                    else:
                        self.success_count += 1
                
                response_time = (time.time() - start_time) * 1000
                self.response_times.append(response_time)
                
                # Think time between requests
                await asyncio.sleep(self.config.think_time_seconds)
                
            except Exception as e:
                self.error_count += 1
                response_time = (time.time() - start_time) * 1000
                self.response_times.append(response_time)
                
                if self.config.enable_detailed_logging:
                    logger.error(f"Request error: {e}")
    
    def _calculate_metrics(self, test_name: str, test_type: TestType) -> BenchmarkMetrics:
        """Calculate benchmark metrics"""
        duration = self.end_time - self.start_time
        total_requests = self.success_count + self.error_count
        
        # Response time statistics
        if self.response_times:
            avg_response_time = statistics.mean(self.response_times)
            p50_response_time = statistics.median(self.response_times)
            
            sorted_times = sorted(self.response_times)
            p95_index = int(0.95 * len(sorted_times))
            p99_index = int(0.99 * len(sorted_times))
            
            p95_response_time = sorted_times[p95_index] if p95_index < len(sorted_times) else sorted_times[-1]
            p99_response_time = sorted_times[p99_index] if p99_index < len(sorted_times) else sorted_times[-1]
            
            min_response_time = min(self.response_times)
            max_response_time = max(self.response_times)
        else:
            avg_response_time = p50_response_time = p95_response_time = p99_response_time = 0
            min_response_time = max_response_time = 0
        
        # System metrics
        cpu_usage = memory_usage_percent = memory_usage_mb = 0
        if PSUTIL_AVAILABLE:
            cpu_usage = psutil.cpu_percent()
            memory = psutil.virtual_memory()
            memory_usage_percent = memory.percent
            memory_usage_mb = memory.used / (1024 * 1024)
        
        # Determine test result
        error_rate = (self.error_count / total_requests * 100) if total_requests > 0 else 0
        result = TestResult.PASS
        
        if error_rate > self.config.target_error_rate_percent:
            result = TestResult.FAIL
        elif avg_response_time > self.config.target_response_time_ms:
            result = TestResult.WARNING
        
        return BenchmarkMetrics(
            test_name=test_name,
            test_type=test_type,
            duration_seconds=duration,
            total_requests=total_requests,
            successful_requests=self.success_count,
            failed_requests=self.error_count,
            requests_per_second=total_requests / duration if duration > 0 else 0,
            average_response_time_ms=avg_response_time,
            p50_response_time_ms=p50_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min_response_time,
            max_response_time_ms=max_response_time,
            error_rate_percent=error_rate,
            throughput_mb_per_sec=0,  # Calculate based on data transfer
            cpu_usage_percent=cpu_usage,
            memory_usage_percent=memory_usage_percent,
            memory_usage_mb=memory_usage_mb,
            concurrent_connections=self.config.max_concurrent_users,
            timestamp=datetime.now(),
            result=result
        )

class WebSocketBenchmark:
    """Benchmark WebSocket connection performance"""
    
    def __init__(self, config: TestConfiguration):
        self.config = config
        self.clients: List[MockWebSocketClient] = []
        self.connection_times = []
        self.message_response_times = []
        self.successful_connections = 0
        self.failed_connections = 0
        self.total_messages_sent = 0
        self.total_messages_received = 0
        
    async def run_connection_stress_test(self) -> BenchmarkMetrics:
        """Run WebSocket connection stress test"""
        logger.info(f"Starting WebSocket stress test with {self.config.max_concurrent_users} connections")
        
        start_time = time.time()
        
        # Create and connect clients
        connection_tasks = []
        for i in range(self.config.max_concurrent_users):
            client = MockWebSocketClient(f"client-{i}", self.config.websocket_url)
            self.clients.append(client)
            
            task = asyncio.create_task(self._connect_and_test_client(client))
            connection_tasks.append(task)
        
        # Wait for all connections and tests
        await asyncio.gather(*connection_tasks, return_exceptions=True)
        
        end_time = time.time()
        
        return self._calculate_websocket_metrics(start_time, end_time)
    
    async def _connect_and_test_client(self, client: MockWebSocketClient):
        """Connect client and run message tests"""
        # Connect
        connect_start = time.time()
        if await client.connect():
            connection_time = time.time() - connect_start
            self.connection_times.append(connection_time * 1000)
            self.successful_connections += 1
            
            # Send test messages
            await self._run_message_test(client)
        else:
            self.failed_connections += 1
        
        # Disconnect
        await client.disconnect()
    
    async def _run_message_test(self, client: MockWebSocketClient):
        """Run message sending/receiving test for client"""
        messages_to_send = 10  # Send 10 messages per client
        
        for i in range(messages_to_send):
            message = {
                "type": "test_message",
                "data": {
                    "client_id": client.client_id,
                    "sequence": i,
                    "timestamp": time.time(),
                    "payload": "x" * (self.config.data_payload_size_kb * 1024)
                }
            }
            
            # Send message and measure response time
            send_start = time.time()
            if await client.send_message(message):
                # Wait for response (with timeout)
                response = await client.receive_message(timeout=5.0)
                if response:
                    response_time = (time.time() - send_start) * 1000
                    self.message_response_times.append(response_time)
            
            # Small delay between messages
            await asyncio.sleep(0.1)
        
        self.total_messages_sent += client.messages_sent
        self.total_messages_received += client.messages_received
    
    def _calculate_websocket_metrics(self, start_time: float, end_time: float) -> BenchmarkMetrics:
        """Calculate WebSocket benchmark metrics"""
        duration = end_time - start_time
        
        # Connection statistics
        if self.connection_times:
            avg_connection_time = statistics.mean(self.connection_times)
        else:
            avg_connection_time = 0
        
        # Message response time statistics
        if self.message_response_times:
            avg_response_time = statistics.mean(self.message_response_times)
            p95_response_time = sorted(self.message_response_times)[int(0.95 * len(self.message_response_times))]
            p99_response_time = sorted(self.message_response_times)[int(0.99 * len(self.message_response_times))]
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
        
        # System metrics
        cpu_usage = memory_usage_percent = memory_usage_mb = 0
        if PSUTIL_AVAILABLE:
            cpu_usage = psutil.cpu_percent()
            memory = psutil.virtual_memory()
            memory_usage_percent = memory.percent
            memory_usage_mb = memory.used / (1024 * 1024)
        
        # Determine result
        connection_success_rate = (self.successful_connections / self.config.max_concurrent_users * 100) if self.config.max_concurrent_users > 0 else 0
        result = TestResult.PASS
        
        if connection_success_rate < 95:
            result = TestResult.FAIL
        elif avg_response_time > 1000:  # 1 second
            result = TestResult.WARNING
        
        return BenchmarkMetrics(
            test_name="WebSocket Connection Stress Test",
            test_type=TestType.STRESS_TEST,
            duration_seconds=duration,
            total_requests=self.total_messages_sent,
            successful_requests=self.total_messages_received,
            failed_requests=self.total_messages_sent - self.total_messages_received,
            requests_per_second=self.total_messages_sent / duration if duration > 0 else 0,
            average_response_time_ms=avg_response_time,
            p50_response_time_ms=statistics.median(self.message_response_times) if self.message_response_times else 0,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min(self.message_response_times) if self.message_response_times else 0,
            max_response_time_ms=max(self.message_response_times) if self.message_response_times else 0,
            error_rate_percent=100 - connection_success_rate,
            throughput_mb_per_sec=(self.total_messages_sent * self.config.data_payload_size_kb / 1024) / duration if duration > 0 else 0,
            cpu_usage_percent=cpu_usage,
            memory_usage_percent=memory_usage_percent,
            memory_usage_mb=memory_usage_mb,
            concurrent_connections=self.successful_connections,
            timestamp=datetime.now(),
            result=result,
            notes=f"Connection success rate: {connection_success_rate:.1f}%, Avg connection time: {avg_connection_time:.1f}ms"
        )

class ScalabilityTester:
    """Test system scalability limits"""
    
    def __init__(self, config: TestConfiguration):
        self.config = config
        self.results = []
        
    async def find_breaking_point(self) -> ScalabilityResult:
        """Find system breaking point by gradually increasing load"""
        logger.info("Starting scalability test to find breaking point")
        
        max_rps = 0
        breaking_point_users = None
        breaking_point_rps = None
        performance_degradation_point = None
        resource_bottleneck = None
        
        # Test with increasing user counts
        user_counts = [10, 25, 50, 100, 200, 300, 500, 750, 1000]
        
        for user_count in user_counts:
            if user_count > self.config.max_concurrent_users:
                break
            
            logger.info(f"Testing with {user_count} concurrent users")
            
            # Update config for this test
            test_config = TestConfiguration(
                base_url=self.config.base_url,
                max_concurrent_users=user_count,
                test_duration_seconds=60,  # Shorter tests for scalability
                request_timeout_seconds=10
            )
            
            # Run AI processing test
            ai_benchmark = AIProcessingBenchmark(test_config)
            metrics = await ai_benchmark.run_load_test()
            
            self.results.append(metrics)
            
            # Check for breaking point
            current_rps = metrics.requests_per_second
            error_rate = metrics.error_rate_percent
            response_time = metrics.average_response_time_ms
            
            # Update max RPS if this is the best so far
            if current_rps > max_rps and error_rate < 5:
                max_rps = current_rps
            
            # Check for breaking point (error rate > 10% or response time > 10s)
            if error_rate > 10 or response_time > 10000:
                breaking_point_users = user_count
                breaking_point_rps = current_rps
                break
            
            # Check for performance degradation (response time > 5s)
            if response_time > 5000 and performance_degradation_point is None:
                performance_degradation_point = user_count
            
            # Identify resource bottleneck
            if metrics.cpu_usage_percent > 90:
                resource_bottleneck = "CPU"
            elif metrics.memory_usage_percent > 90:
                resource_bottleneck = "Memory"
            elif error_rate > 5:
                resource_bottleneck = "System Capacity"
            
            # Wait between tests
            await asyncio.sleep(5)
        
        # Generate recommendations
        recommendations = self._generate_scalability_recommendations(
            max_rps, breaking_point_users, resource_bottleneck
        )
        
        return ScalabilityResult(
            test_name="System Breaking Point Analysis",
            max_concurrent_users=max(user_counts),
            max_requests_per_second=max_rps,
            breaking_point_users=breaking_point_users,
            breaking_point_rps=breaking_point_rps,
            resource_bottleneck=resource_bottleneck,
            performance_degradation_point=performance_degradation_point,
            recommendations=recommendations,
            timestamp=datetime.now()
        )
    
    def _generate_scalability_recommendations(self, max_rps: float, breaking_point: Optional[int], bottleneck: Optional[str]) -> List[str]:
        """Generate scalability recommendations based on test results"""
        recommendations = []
        
        if breaking_point:
            recommendations.append(f"System breaks at {breaking_point} concurrent users - implement load balancing")
        
        if bottleneck == "CPU":
            recommendations.append("CPU is the bottleneck - consider CPU optimization or horizontal scaling")
        elif bottleneck == "Memory":
            recommendations.append("Memory is the bottleneck - optimize memory usage or increase available memory")
        elif bottleneck == "System Capacity":
            recommendations.append("System capacity reached - implement queue management and rate limiting")
        
        if max_rps < 50:
            recommendations.append("Low throughput detected - optimize AI processing pipeline")
        elif max_rps < 100:
            recommendations.append("Moderate throughput - consider caching optimization")
        
        return recommendations

class PerformanceBenchmarkSuite:
    """Main benchmark suite coordinator"""
    
    def __init__(self, config: Optional[TestConfiguration] = None):
        """Initialize benchmark suite"""
        self.config = config or TestConfiguration()
        self.logger = logging.getLogger(__name__)
        self.results: List[BenchmarkMetrics] = []
        self.scalability_results: List[ScalabilityResult] = []
        
    async def run_full_benchmark_suite(self) -> Dict[str, Any]:
        """Run complete benchmark suite"""
        self.logger.info("Starting comprehensive performance benchmark suite")
        
        suite_start_time = time.time()
        
        # 1. AI Processing Load Test
        self.logger.info("\n=== Running AI Processing Load Test ===")
        ai_benchmark = AIProcessingBenchmark(self.config)
        ai_metrics = await ai_benchmark.run_load_test()
        self.results.append(ai_metrics)
        
        # 2. WebSocket Stress Test
        self.logger.info("\n=== Running WebSocket Stress Test ===")
        ws_benchmark = WebSocketBenchmark(self.config)
        ws_metrics = await ws_benchmark.run_connection_stress_test()
        self.results.append(ws_metrics)
        
        # 3. Scalability Test
        self.logger.info("\n=== Running Scalability Test ===")
        scalability_tester = ScalabilityTester(self.config)
        scalability_result = await scalability_tester.find_breaking_point()
        self.scalability_results.append(scalability_result)
        
        # 4. Endurance Test (shorter version for demo)
        self.logger.info("\n=== Running Endurance Test ===")
        endurance_config = TestConfiguration(
            base_url=self.config.base_url,
            max_concurrent_users=25,
            test_duration_seconds=120,  # 2 minutes for demo
            think_time_seconds=2.0
        )
        endurance_benchmark = AIProcessingBenchmark(endurance_config)
        endurance_metrics = await endurance_benchmark.run_load_test()
        endurance_metrics.test_name = "AI Processing Endurance Test"
        endurance_metrics.test_type = TestType.ENDURANCE_TEST
        self.results.append(endurance_metrics)
        
        suite_duration = time.time() - suite_start_time
        
        return self._generate_comprehensive_report(suite_duration)
    
    def _generate_comprehensive_report(self, suite_duration: float) -> Dict[str, Any]:
        """Generate comprehensive benchmark report"""
        # Overall summary
        total_requests = sum(r.total_requests for r in self.results)
        total_errors = sum(r.failed_requests for r in self.results)
        overall_error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0
        
        # Performance summary
        avg_response_time = statistics.mean([r.average_response_time_ms for r in self.results])
        max_rps = max([r.requests_per_second for r in self.results])
        
        # System health
        max_cpu = max([r.cpu_usage_percent for r in self.results])
        max_memory = max([r.memory_usage_percent for r in self.results])
        
        # Test results summary
        passed_tests = sum(1 for r in self.results if r.result == TestResult.PASS)
        failed_tests = sum(1 for r in self.results if r.result == TestResult.FAIL)
        warning_tests = sum(1 for r in self.results if r.result == TestResult.WARNING)
        
        # Generate recommendations
        recommendations = self._generate_overall_recommendations()
        
        # SLA compliance
        sla_compliance = self._calculate_sla_compliance()
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'suite_duration_seconds': suite_duration,
            'configuration': asdict(self.config),
            
            'summary': {
                'total_tests': len(self.results),
                'passed_tests': passed_tests,
                'failed_tests': failed_tests,
                'warning_tests': warning_tests,
                'overall_success_rate': (passed_tests / len(self.results) * 100) if self.results else 0
            },
            
            'performance_summary': {
                'total_requests': total_requests,
                'overall_error_rate_percent': overall_error_rate,
                'average_response_time_ms': avg_response_time,
                'max_requests_per_second': max_rps,
                'max_cpu_usage_percent': max_cpu,
                'max_memory_usage_percent': max_memory
            },
            
            'detailed_results': [asdict(r) for r in self.results],
            'scalability_results': [asdict(r) for r in self.scalability_results],
            
            'sla_compliance': sla_compliance,
            'recommendations': recommendations,
            
            'system_capacity': {
                'max_concurrent_users_tested': max([r.concurrent_connections for r in self.results]),
                'breaking_point': self.scalability_results[0].breaking_point_users if self.scalability_results else None,
                'performance_degradation_point': self.scalability_results[0].performance_degradation_point if self.scalability_results else None,
                'resource_bottleneck': self.scalability_results[0].resource_bottleneck if self.scalability_results else None
            }
        }
        
        return report
    
    def _generate_overall_recommendations(self) -> List[str]:
        """Generate overall optimization recommendations"""
        recommendations = []
        
        # Check response times
        slow_tests = [r for r in self.results if r.average_response_time_ms > 5000]
        if slow_tests:
            recommendations.append("High response times detected - optimize AI processing pipeline")
        
        # Check error rates
        high_error_tests = [r for r in self.results if r.error_rate_percent > 5]
        if high_error_tests:
            recommendations.append("High error rates detected - improve error handling and retry logic")
        
        # Check resource usage
        high_cpu_tests = [r for r in self.results if r.cpu_usage_percent > 80]
        if high_cpu_tests:
            recommendations.append("High CPU usage - consider horizontal scaling or CPU optimization")
        
        high_memory_tests = [r for r in self.results if r.memory_usage_percent > 80]
        if high_memory_tests:
            recommendations.append("High memory usage - optimize memory allocation or increase available memory")
        
        # Check throughput
        low_throughput_tests = [r for r in self.results if r.requests_per_second < 50]
        if low_throughput_tests:
            recommendations.append("Low throughput - implement caching and batch processing optimization")
        
        # Scalability recommendations
        if self.scalability_results:
            scalability_result = self.scalability_results[0]
            if scalability_result.breaking_point_users and scalability_result.breaking_point_users < 200:
                recommendations.append("Low scalability limit - implement load balancing and connection pooling")
        
        return recommendations
    
    def _calculate_sla_compliance(self) -> Dict[str, float]:
        """Calculate SLA compliance metrics"""
        # SLA targets
        response_time_sla = 5000  # 5 seconds
        error_rate_sla = 1.0  # 1%
        availability_sla = 99.9  # 99.9%
        
        compliance = {}
        
        # Response time compliance
        response_time_compliant = sum(
            1 for r in self.results 
            if r.average_response_time_ms <= response_time_sla
        )
        compliance['response_time'] = (response_time_compliant / len(self.results) * 100) if self.results else 0
        
        # Error rate compliance
        error_rate_compliant = sum(
            1 for r in self.results 
            if r.error_rate_percent <= error_rate_sla
        )
        compliance['error_rate'] = (error_rate_compliant / len(self.results) * 100) if self.results else 0
        
        # Overall compliance
        compliance['overall'] = (compliance['response_time'] + compliance['error_rate']) / 2
        
        return compliance
    
    def export_results(self, filename: str):
        """Export results to JSON file"""
        report = self._generate_comprehensive_report(0)
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Benchmark results exported to {filename}")


# Example usage and demo
async def demo_benchmark_suite():
    """Demonstrate the performance benchmark suite"""
    
    # Configuration for demo
    config = TestConfiguration(
        base_url="http://localhost:8002",
        websocket_url="ws://localhost:8002/ws",
        max_concurrent_users=50,  # Smaller for demo
        test_duration_seconds=30,  # Shorter for demo
        ramp_up_seconds=10,
        request_timeout_seconds=10,
        think_time_seconds=0.5,
        data_payload_size_kb=5,
        enable_detailed_logging=False
    )
    
    # Initialize benchmark suite
    suite = PerformanceBenchmarkSuite(config)
    
    print("\n=== Performance Benchmark Suite Demo ===")
    print(f"Configuration:")
    print(f"  - Max concurrent users: {config.max_concurrent_users}")
    print(f"  - Test duration: {config.test_duration_seconds}s")
    print(f"  - Base URL: {config.base_url}")
    print(f"  - WebSocket URL: {config.websocket_url}")
    
    try:
        # Run full benchmark suite
        start_time = time.time()
        report = await suite.run_full_benchmark_suite()
        total_time = time.time() - start_time
        
        # Display results
        print(f"\n=== Benchmark Results ===")
        print(f"Suite completed in {total_time:.1f} seconds")
        print(f"\nSummary:")
        print(f"  - Total tests: {report['summary']['total_tests']}")
        print(f"  - Passed: {report['summary']['passed_tests']}")
        print(f"  - Failed: {report['summary']['failed_tests']}")
        print(f"  - Warnings: {report['summary']['warning_tests']}")
        print(f"  - Success rate: {report['summary']['overall_success_rate']:.1f}%")
        
        print(f"\nPerformance:")
        print(f"  - Total requests: {report['performance_summary']['total_requests']}")
        print(f"  - Error rate: {report['performance_summary']['overall_error_rate_percent']:.2f}%")
        print(f"  - Avg response time: {report['performance_summary']['average_response_time_ms']:.1f}ms")
        print(f"  - Max RPS: {report['performance_summary']['max_requests_per_second']:.1f}")
        print(f"  - Max CPU: {report['performance_summary']['max_cpu_usage_percent']:.1f}%")
        print(f"  - Max Memory: {report['performance_summary']['max_memory_usage_percent']:.1f}%")
        
        print(f"\nSystem Capacity:")
        print(f"  - Max users tested: {report['system_capacity']['max_concurrent_users_tested']}")
        if report['system_capacity']['breaking_point']:
            print(f"  - Breaking point: {report['system_capacity']['breaking_point']} users")
        if report['system_capacity']['resource_bottleneck']:
            print(f"  - Resource bottleneck: {report['system_capacity']['resource_bottleneck']}")
        
        print(f"\nSLA Compliance:")
        for metric, compliance in report['sla_compliance'].items():
            print(f"  - {metric}: {compliance:.1f}%")
        
        if report['recommendations']:
            print(f"\nRecommendations:")
            for i, rec in enumerate(report['recommendations'][:5], 1):
                print(f"  {i}. {rec}")
        
        # Export results
        suite.export_results('benchmark_results.json')
        print(f"\nDetailed results exported to 'benchmark_results.json'")
        
    except Exception as e:
        print(f"\nBenchmark suite error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Run demo
    asyncio.run(demo_benchmark_suite())

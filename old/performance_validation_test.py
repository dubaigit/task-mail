#!/usr/bin/env python3
"""
Performance Validation Test Suite

Comprehensive testing to validate <200ms email loading performance targets
and verify the effectiveness of the caching architecture optimization.

Test Categories:
- Email Loading Performance (<200ms target)
- Search Performance (<50ms target)
- Database Query Optimization
- Cache Hit Ratio Analysis
- Background Processing Performance
- Concurrent Load Testing
"""

import asyncio
import time
import statistics
import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import aiohttp
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from email_cache_models import EmailCache, init_database, get_session
from performance_monitor import PerformanceMonitor
from sqlmodel import select, func
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class TestResult:
    """Test result data structure"""
    test_name: str
    success: bool
    avg_time_ms: float
    median_time_ms: float
    p95_time_ms: float
    p99_time_ms: float
    min_time_ms: float
    max_time_ms: float
    total_requests: int
    error_count: int
    meets_target: bool
    target_ms: float
    notes: str = ""


class PerformanceValidator:
    """
    Comprehensive performance validation for the email intelligence system.
    
    Tests the entire optimization chain:
    1. Database performance (SQLite with WAL mode)
    2. API endpoint response times
    3. Cache effectiveness
    4. Background processing performance
    """
    
    def __init__(self, base_url: str = "http://localhost:8003", db_path: str = "sqlite:///email_cache_optimized.db"):
        """
        Initialize performance validator.
        
        Args:
            base_url: Base URL for API testing
            db_path: Database connection string
        """
        self.base_url = base_url
        self.db_path = db_path
        self.results: List[TestResult] = []
        self.performance_monitor = PerformanceMonitor()
        
        # Test configuration
        self.email_loading_target_ms = 200.0
        self.search_target_ms = 50.0
        self.db_query_target_ms = 100.0
        
        logger.info(f"Performance validator initialized for {base_url}")
    
    async def run_all_tests(self) -> Dict[str, Any]:
        """
        Run complete performance validation test suite.
        
        Returns:
            Comprehensive test results and recommendations
        """
        logger.info("Starting comprehensive performance validation...")
        start_time = time.time()
        
        # Initialize database for direct testing
        engine = init_database(self.db_path)
        
        # Test categories
        await self._test_database_performance(engine)
        await self._test_api_performance()
        await self._test_concurrent_load()
        await self._test_search_performance()
        await self._test_cache_effectiveness()
        
        total_time = time.time() - start_time
        
        # Analyze results
        summary = self._generate_summary()
        
        logger.info(f"Performance validation completed in {total_time:.2f} seconds")
        
        return {
            'validation_timestamp': datetime.utcnow().isoformat(),
            'total_test_time_seconds': total_time,
            'test_results': [self._result_to_dict(r) for r in self.results],
            'summary': summary,
            'recommendations': self._generate_recommendations()
        }
    
    async def _test_database_performance(self, engine) -> None:
        """Test direct database query performance"""
        logger.info("Testing database performance...")
        
        times = []
        error_count = 0
        
        with get_session(engine) as session:
            # Test email count query
            for i in range(20):
                try:
                    start_time = time.time()
                    count = session.exec(select(func.count(EmailCache.id))).first()
                    elapsed_ms = (time.time() - start_time) * 1000
                    times.append(elapsed_ms)
                except Exception as e:
                    logger.error(f"Database query error: {e}")
                    error_count += 1
            
            # Test email listing query
            list_times = []
            for i in range(10):
                try:
                    start_time = time.time()
                    emails = session.exec(
                        select(EmailCache).order_by(EmailCache.date_received.desc()).limit(50)
                    ).all()
                    elapsed_ms = (time.time() - start_time) * 1000
                    list_times.append(elapsed_ms)
                except Exception as e:
                    logger.error(f"Database list query error: {e}")
                    error_count += 1
        
        # Record count query results
        if times:
            self.results.append(TestResult(
                test_name="database_count_query",
                success=error_count == 0,
                avg_time_ms=statistics.mean(times),
                median_time_ms=statistics.median(times),
                p95_time_ms=times[int(0.95 * len(times))] if times else 0,
                p99_time_ms=times[int(0.99 * len(times))] if times else 0,
                min_time_ms=min(times),
                max_time_ms=max(times),
                total_requests=len(times),
                error_count=error_count,
                meets_target=statistics.mean(times) < self.db_query_target_ms,
                target_ms=self.db_query_target_ms,
                notes="Direct database count query performance"
            ))
        
        # Record list query results
        if list_times:
            self.results.append(TestResult(
                test_name="database_list_query",
                success=True,
                avg_time_ms=statistics.mean(list_times),
                median_time_ms=statistics.median(list_times),
                p95_time_ms=list_times[int(0.95 * len(list_times))] if list_times else 0,
                p99_time_ms=list_times[int(0.99 * len(list_times))] if list_times else 0,
                min_time_ms=min(list_times),
                max_time_ms=max(list_times),
                total_requests=len(list_times),
                error_count=0,
                meets_target=statistics.mean(list_times) < self.db_query_target_ms,
                target_ms=self.db_query_target_ms,
                notes="Direct database email listing query performance"
            ))
    
    async def _test_api_performance(self) -> None:
        """Test API endpoint performance"""
        logger.info("Testing API endpoint performance...")
        
        times = []
        error_count = 0
        
        async with aiohttp.ClientSession() as session:
            # Test email listing endpoint
            for i in range(25):
                try:
                    start_time = time.time()
                    async with session.get(f"{self.base_url}/emails/?limit=50") as response:
                        if response.status == 200:
                            data = await response.json()
                            elapsed_ms = (time.time() - start_time) * 1000
                            times.append(elapsed_ms)
                        else:
                            error_count += 1
                            logger.warning(f"API request failed with status {response.status}")
                except Exception as e:
                    logger.error(f"API request error: {e}")
                    error_count += 1
        
        if times:
            self.results.append(TestResult(
                test_name="api_email_listing",
                success=error_count == 0,
                avg_time_ms=statistics.mean(times),
                median_time_ms=statistics.median(times),
                p95_time_ms=times[int(0.95 * len(times))] if times else 0,
                p99_time_ms=times[int(0.99 * len(times))] if times else 0,
                min_time_ms=min(times),
                max_time_ms=max(times),
                total_requests=len(times),
                error_count=error_count,
                meets_target=statistics.mean(times) < self.email_loading_target_ms,
                target_ms=self.email_loading_target_ms,
                notes="API email listing endpoint performance - PRIMARY TARGET"
            ))
    
    async def _test_concurrent_load(self) -> None:
        """Test performance under concurrent load"""
        logger.info("Testing concurrent load performance...")
        
        async def make_request(session, request_id):
            """Make a single API request"""
            try:
                start_time = time.time()
                async with session.get(f"{self.base_url}/emails/?limit=25&offset={request_id * 25}") as response:
                    if response.status == 200:
                        await response.json()
                        return (time.time() - start_time) * 1000
                    else:
                        return None
            except Exception as e:
                logger.error(f"Concurrent request {request_id} failed: {e}")
                return None
        
        times = []
        error_count = 0
        
        # Run 50 concurrent requests
        async with aiohttp.ClientSession() as session:
            tasks = [make_request(session, i) for i in range(50)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, (int, float)) and result is not None:
                    times.append(result)
                else:
                    error_count += 1
        
        if times:
            self.results.append(TestResult(
                test_name="concurrent_load_test",
                success=error_count < 5,  # Allow up to 5 errors
                avg_time_ms=statistics.mean(times),
                median_time_ms=statistics.median(times),
                p95_time_ms=times[int(0.95 * len(times))] if times else 0,
                p99_time_ms=times[int(0.99 * len(times))] if times else 0,
                min_time_ms=min(times),
                max_time_ms=max(times),
                total_requests=len(times),
                error_count=error_count,
                meets_target=statistics.mean(times) < self.email_loading_target_ms * 1.5,  # 50% tolerance for concurrent load
                target_ms=self.email_loading_target_ms * 1.5,
                notes="Performance under 50 concurrent requests"
            ))
    
    async def _test_search_performance(self) -> None:
        """Test search endpoint performance"""
        logger.info("Testing search performance...")
        
        search_queries = ["test", "project", "meeting", "update", "urgent"]
        times = []
        error_count = 0
        
        async with aiohttp.ClientSession() as session:
            for query in search_queries:
                for i in range(5):  # 5 tests per query
                    try:
                        start_time = time.time()
                        async with session.get(f"{self.base_url}/search/?q={query}&limit=20") as response:
                            if response.status == 200:
                                await response.json()
                                elapsed_ms = (time.time() - start_time) * 1000
                                times.append(elapsed_ms)
                            else:
                                error_count += 1
                    except Exception as e:
                        logger.error(f"Search request error: {e}")
                        error_count += 1
        
        if times:
            self.results.append(TestResult(
                test_name="search_performance",
                success=error_count == 0,
                avg_time_ms=statistics.mean(times),
                median_time_ms=statistics.median(times),
                p95_time_ms=times[int(0.95 * len(times))] if times else 0,
                p99_time_ms=times[int(0.99 * len(times))] if times else 0,
                min_time_ms=min(times),
                max_time_ms=max(times),
                total_requests=len(times),
                error_count=error_count,
                meets_target=statistics.mean(times) < self.search_target_ms,
                target_ms=self.search_target_ms,
                notes="Search endpoint performance"
            ))
    
    async def _test_cache_effectiveness(self) -> None:
        """Test cache effectiveness by making repeated requests"""
        logger.info("Testing cache effectiveness...")
        
        first_request_times = []
        repeat_request_times = []
        error_count = 0
        
        async with aiohttp.ClientSession() as session:
            # Make initial requests (should populate cache)
            for i in range(10):
                try:
                    start_time = time.time()
                    async with session.get(f"{self.base_url}/emails/?limit=50&offset={i * 50}") as response:
                        if response.status == 200:
                            await response.json()
                            elapsed_ms = (time.time() - start_time) * 1000
                            first_request_times.append(elapsed_ms)
                        else:
                            error_count += 1
                except Exception as e:
                    error_count += 1
            
            # Small delay to allow any caching to take effect
            await asyncio.sleep(1)
            
            # Repeat the same requests (should hit cache)
            for i in range(10):
                try:
                    start_time = time.time()
                    async with session.get(f"{self.base_url}/emails/?limit=50&offset={i * 50}") as response:
                        if response.status == 200:
                            await response.json()
                            elapsed_ms = (time.time() - start_time) * 1000
                            repeat_request_times.append(elapsed_ms)
                        else:
                            error_count += 1
                except Exception as e:
                    error_count += 1
        
        if first_request_times and repeat_request_times:
            first_avg = statistics.mean(first_request_times)
            repeat_avg = statistics.mean(repeat_request_times)
            cache_improvement = ((first_avg - repeat_avg) / first_avg) * 100
            
            self.results.append(TestResult(
                test_name="cache_effectiveness",
                success=cache_improvement > 0,  # Any improvement indicates caching
                avg_time_ms=repeat_avg,
                median_time_ms=statistics.median(repeat_request_times),
                p95_time_ms=repeat_request_times[int(0.95 * len(repeat_request_times))],
                p99_time_ms=repeat_request_times[int(0.99 * len(repeat_request_times))],
                min_time_ms=min(repeat_request_times),
                max_time_ms=max(repeat_request_times),
                total_requests=len(repeat_request_times),
                error_count=error_count,
                meets_target=repeat_avg < self.email_loading_target_ms,
                target_ms=self.email_loading_target_ms,
                notes=f"Cache improvement: {cache_improvement:.1f}%, First: {first_avg:.1f}ms, Repeat: {repeat_avg:.1f}ms"
            ))
    
    def _generate_summary(self) -> Dict[str, Any]:
        """Generate performance validation summary"""
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r.meets_target)
        critical_tests = [r for r in self.results if 'email_listing' in r.test_name or 'search' in r.test_name]
        
        primary_email_test = next((r for r in self.results if r.test_name == "api_email_listing"), None)
        primary_search_test = next((r for r in self.results if r.test_name == "search_performance"), None)
        
        return {
            'overall_score': f"{(passed_tests / total_tests) * 100:.1f}%",
            'tests_passed': f"{passed_tests}/{total_tests}",
            'critical_performance': {
                'email_loading': {
                    'target_ms': self.email_loading_target_ms,
                    'actual_ms': primary_email_test.avg_time_ms if primary_email_test else 'N/A',
                    'meets_target': primary_email_test.meets_target if primary_email_test else False,
                    'status': 'PASS' if primary_email_test and primary_email_test.meets_target else 'FAIL'
                },
                'search_performance': {
                    'target_ms': self.search_target_ms,
                    'actual_ms': primary_search_test.avg_time_ms if primary_search_test else 'N/A',
                    'meets_target': primary_search_test.meets_target if primary_search_test else False,
                    'status': 'PASS' if primary_search_test and primary_search_test.meets_target else 'FAIL'
                }
            },
            'performance_improvement': self._calculate_improvement()
        }
    
    def _calculate_improvement(self) -> str:
        """Calculate improvement over original 60+ second performance"""
        primary_test = next((r for r in self.results if r.test_name == "api_email_listing"), None)
        if primary_test:
            original_ms = 60000  # 60 seconds
            improvement = ((original_ms - primary_test.avg_time_ms) / original_ms) * 100
            return f"{improvement:.1f}% improvement (from {original_ms/1000:.0f}s to {primary_test.avg_time_ms/1000:.2f}s)"
        return "Unable to calculate improvement"
    
    def _generate_recommendations(self) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []
        
        # Check primary email loading performance
        email_test = next((r for r in self.results if r.test_name == "api_email_listing"), None)
        if email_test:
            if not email_test.meets_target:
                recommendations.append(f"EMAIL LOADING CRITICAL: {email_test.avg_time_ms:.1f}ms exceeds {self.email_loading_target_ms}ms target. Consider query optimization or indexing.")
            elif email_test.avg_time_ms > self.email_loading_target_ms * 0.8:
                recommendations.append(f"EMAIL LOADING WARNING: {email_test.avg_time_ms:.1f}ms approaching {self.email_loading_target_ms}ms target. Monitor closely.")
        
        # Check search performance
        search_test = next((r for r in self.results if r.test_name == "search_performance"), None)
        if search_test and not search_test.meets_target:
            recommendations.append(f"SEARCH PERFORMANCE: {search_test.avg_time_ms:.1f}ms exceeds {self.search_target_ms}ms target. Consider implementing FTS indexing.")
        
        # Check concurrent load
        concurrent_test = next((r for r in self.results if r.test_name == "concurrent_load_test"), None)
        if concurrent_test and concurrent_test.error_count > 5:
            recommendations.append(f"CONCURRENT LOAD: {concurrent_test.error_count} errors under load. Consider connection pooling optimization.")
        
        # Check cache effectiveness
        cache_test = next((r for r in self.results if r.test_name == "cache_effectiveness"), None)
        if cache_test and "improvement" in cache_test.notes:
            improvement = float(cache_test.notes.split("improvement: ")[1].split("%")[0])
            if improvement < 10:
                recommendations.append(f"CACHE EFFECTIVENESS: Only {improvement:.1f}% improvement. Consider cache strategy optimization.")
        
        if not recommendations:
            recommendations.append("EXCELLENT: All performance targets met. System is optimized for production.")
        
        return recommendations
    
    def _result_to_dict(self, result: TestResult) -> Dict[str, Any]:
        """Convert TestResult to dictionary"""
        return {
            'test_name': result.test_name,
            'success': result.success,
            'avg_time_ms': round(result.avg_time_ms, 2),
            'median_time_ms': round(result.median_time_ms, 2),
            'p95_time_ms': round(result.p95_time_ms, 2),
            'p99_time_ms': round(result.p99_time_ms, 2),
            'min_time_ms': round(result.min_time_ms, 2),
            'max_time_ms': round(result.max_time_ms, 2),
            'total_requests': result.total_requests,
            'error_count': result.error_count,
            'meets_target': result.meets_target,
            'target_ms': result.target_ms,
            'notes': result.notes
        }
    
    def export_results(self, file_path: Path) -> None:
        """Export validation results to JSON file"""
        results = {
            'validation_results': [self._result_to_dict(r) for r in self.results],
            'summary': self._generate_summary(),
            'recommendations': self._generate_recommendations(),
            'export_timestamp': datetime.utcnow().isoformat()
        }
        
        with open(file_path, 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Performance validation results exported to {file_path}")


async def main():
    """Run performance validation"""
    print("🚀 Email Intelligence Performance Validation")
    print("=" * 60)
    
    # Check if API server is running
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8003/") as response:
                if response.status != 200:
                    print("❌ API server not running on port 8003")
                    print("   Please start the server with: python main_cache_optimized_with_monitoring.py")
                    return
    except Exception:
        print("❌ API server not accessible on http://localhost:8003")
        print("   Please start the server with: python main_cache_optimized_with_monitoring.py")
        return
    
    # Run validation
    validator = PerformanceValidator()
    results = await validator.run_all_tests()
    
    # Display results
    print("\n📊 Performance Validation Results")
    print("=" * 60)
    
    summary = results['summary']
    print(f"Overall Score: {summary['overall_score']}")
    print(f"Tests Passed: {summary['tests_passed']}")
    print(f"Performance Improvement: {summary['performance_improvement']}")
    
    print("\n🎯 Critical Performance Metrics:")
    email_perf = summary['critical_performance']['email_loading']
    search_perf = summary['critical_performance']['search_performance']
    
    email_status = "✅" if email_perf['status'] == 'PASS' else "❌"
    search_status = "✅" if search_perf['status'] == 'PASS' else "❌"
    
    print(f"  {email_status} Email Loading: {email_perf['actual_ms']:.1f}ms (target: {email_perf['target_ms']}ms)")
    print(f"  {search_status} Search Performance: {search_perf['actual_ms']:.1f}ms (target: {search_perf['target_ms']}ms)")
    
    print("\n📋 Test Details:")
    for result in results['test_results']:
        status = "✅" if result['meets_target'] else "❌"
        print(f"  {status} {result['test_name']}: {result['avg_time_ms']:.1f}ms avg ({result['total_requests']} requests)")
        if result['notes']:
            print(f"      {result['notes']}")
    
    print("\n💡 Recommendations:")
    for rec in results['recommendations']:
        print(f"  • {rec}")
    
    # Export results
    export_path = Path(f"performance_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    validator.export_results(export_path)
    print(f"\n📁 Full results exported to: {export_path}")
    
    # Final verdict
    email_pass = email_perf['status'] == 'PASS'
    search_pass = search_perf['status'] == 'PASS'
    
    if email_pass and search_pass:
        print("\n🎉 SUCCESS: All critical performance targets met!")
        print("   The email caching architecture optimization is working effectively.")
    elif email_pass:
        print("\n⚠️  PARTIAL SUCCESS: Email loading target met, but search needs optimization.")
    else:
        print("\n❌ PERFORMANCE ISSUES: Critical targets not met. Review recommendations.")


if __name__ == "__main__":
    asyncio.run(main())
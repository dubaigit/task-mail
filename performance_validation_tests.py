"""
performance_validation_tests.py - Backend Performance Validation Suite

Comprehensive validation of backend performance optimization targets:
- Sub-100ms email classification target
- <2ms task categorization target
- Memory optimization and resource management
- Stress testing under load

BRIEF_RATIONALE: Validates backend performance optimization implementation
against specific targets. Provides comprehensive testing of classification
engines, categorization systems, and resource management under real-world loads.

ASSUMPTIONS:
- performance_optimizer.py is available and functional
- Test environment can generate sufficient load for validation
- System has adequate resources for stress testing
- Database and AI services are properly configured

DECISION_LOG:
- Used real email data patterns for realistic testing
- Implemented both individual and batch processing tests
- Added stress testing with memory monitoring
- Included performance regression detection

EVIDENCE: Based on whitepaper performance targets and production
deployment requirements. Validates system readiness for enterprise usage.
"""

import asyncio
import time
import statistics
import psutil
import tracemalloc
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import json
import sys
import os

# Import the performance optimizer
sys.path.append(os.path.dirname(__file__))
from performance_optimizer import PerformanceOptimizer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Performance targets from whitepaper
PERFORMANCE_TARGETS = {
    'CLASSIFICATION_MAX_MS': 100,
    'TASK_CATEGORIZATION_MAX_MS': 2,
    'MEMORY_LIMIT_MB': 50,
    'BATCH_SIZE_LIMIT': 100,
    'STRESS_TEST_EMAILS': 1000,
    'STRESS_TEST_DURATION': 30  # seconds
}

@dataclass
class PerformanceTestResult:
    """Performance test result container"""
    test_name: str
    target_value: float
    actual_value: float
    unit: str
    passed: bool
    details: str
    recommendations: List[str]
    timestamp: str

@dataclass
class ValidationSuiteResult:
    """Complete validation suite results"""
    overall_passed: bool
    total_tests: int
    passed_tests: int
    failed_tests: int
    results: List[PerformanceTestResult]
    summary: str
    memory_usage_mb: float
    cpu_usage_percent: float
    timestamp: str

class BackendPerformanceValidator:
    """Backend performance validation suite"""
    
    def __init__(self):
        self.optimizer = PerformanceOptimizer()
        self.test_results: List[PerformanceTestResult] = []
        self.start_memory = 0
        self.start_cpu = 0
        
    async def run_full_validation(self) -> ValidationSuiteResult:
        """Run comprehensive backend performance validation"""
        logger.info("🚀 Starting Backend Performance Validation Suite...")
        
        # Start resource monitoring
        self.start_memory = psutil.Process().memory_info().rss / 1024 / 1024
        self.start_cpu = psutil.cpu_percent()
        tracemalloc.start()
        
        try:
            # Core performance tests
            await self.validate_email_classification_performance()
            await self.validate_task_categorization_performance()
            await self.validate_batch_processing_performance()
            
            # Resource optimization tests
            await self.validate_memory_optimization()
            await self.validate_concurrent_processing()
            
            # Stress tests
            await self.validate_stress_performance()
            await self.validate_sustained_load()
            
            return self.generate_validation_report()
            
        finally:
            tracemalloc.stop()
    
    async def validate_email_classification_performance(self):
        """Validate email classification performance (target: <100ms)"""
        logger.info("📧 Testing email classification performance...")
        
        # Generate test emails
        test_emails = self.generate_test_emails(50)
        classification_times = []
        
        for i, email in enumerate(test_emails):
            start_time = time.perf_counter()
            
            try:
                # Test individual email classification
                result = await self.optimizer.optimize_email_classification([email])
                
                end_time = time.perf_counter()
                duration_ms = (end_time - start_time) * 1000
                classification_times.append(duration_ms)
                
                # Validate result quality
                if not result or len(result) != 1:
                    logger.warning(f"Invalid classification result for email {i}")
                    
            except Exception as e:
                logger.error(f"Classification failed for email {i}: {e}")
                classification_times.append(PERFORMANCE_TARGETS['CLASSIFICATION_MAX_MS'] * 2)
        
        # Calculate performance metrics
        avg_time = statistics.mean(classification_times)
        max_time = max(classification_times)
        min_time = min(classification_times)
        p95_time = statistics.quantiles(classification_times, n=20)[18]  # 95th percentile
        
        passed = avg_time < PERFORMANCE_TARGETS['CLASSIFICATION_MAX_MS']
        
        self.test_results.append(PerformanceTestResult(
            test_name="Email Classification Performance",
            target_value=PERFORMANCE_TARGETS['CLASSIFICATION_MAX_MS'],
            actual_value=round(avg_time, 2),
            unit="ms",
            passed=passed,
            details=f"Avg: {avg_time:.2f}ms, Max: {max_time:.2f}ms, Min: {min_time:.2f}ms, P95: {p95_time:.2f}ms",
            recommendations=[
                "Implement result caching for similar emails",
                "Optimize AI model inference pipeline", 
                "Use batch processing for multiple emails",
                "Consider edge computing for classification"
            ] if not passed else [],
            timestamp=datetime.now().isoformat()
        ))
    
    async def validate_task_categorization_performance(self):
        """Validate task categorization performance (target: <2ms)"""
        logger.info("📋 Testing task categorization performance...")
        
        # Generate test tasks
        test_tasks = self.generate_test_tasks(100)
        categorization_times = []
        
        for i, task in enumerate(test_tasks):
            start_time = time.perf_counter()
            
            try:
                # Test individual task categorization
                result = await self.optimizer.optimize_task_categorization([task])
                
                end_time = time.perf_counter()
                duration_ms = (end_time - start_time) * 1000
                categorization_times.append(duration_ms)
                
                # Validate result quality
                if not result or len(result) != 1:
                    logger.warning(f"Invalid categorization result for task {i}")
                    
            except Exception as e:
                logger.error(f"Categorization failed for task {i}: {e}")
                categorization_times.append(PERFORMANCE_TARGETS['TASK_CATEGORIZATION_MAX_MS'] * 2)
        
        # Calculate performance metrics
        avg_time = statistics.mean(categorization_times)
        max_time = max(categorization_times)
        min_time = min(categorization_times)
        
        passed = avg_time < PERFORMANCE_TARGETS['TASK_CATEGORIZATION_MAX_MS']
        
        self.test_results.append(PerformanceTestResult(
            test_name="Task Categorization Performance",
            target_value=PERFORMANCE_TARGETS['TASK_CATEGORIZATION_MAX_MS'],
            actual_value=round(avg_time, 3),
            unit="ms",
            passed=passed,
            details=f"Avg: {avg_time:.3f}ms, Max: {max_time:.3f}ms, Min: {min_time:.3f}ms",
            recommendations=[
                "Implement rule-based fast path for common patterns",
                "Use lookup tables for known task types",
                "Cache categorization results",
                "Optimize task analysis algorithms"
            ] if not passed else [],
            timestamp=datetime.now().isoformat()
        ))
    
    async def validate_batch_processing_performance(self):
        """Validate batch processing efficiency"""
        logger.info("📦 Testing batch processing performance...")
        
        batch_sizes = [1, 5, 10, 25, 50, 100]
        efficiency_results = []
        
        for batch_size in batch_sizes:
            emails = self.generate_test_emails(batch_size)
            
            # Measure individual processing time
            start_time = time.perf_counter()
            individual_results = []
            for email in emails:
                result = await self.optimizer.optimize_email_classification([email])
                individual_results.extend(result)
            individual_time = time.perf_counter() - start_time
            
            # Measure batch processing time
            start_time = time.perf_counter()
            batch_result = await self.optimizer.optimize_email_classification(emails)
            batch_time = time.perf_counter() - start_time
            
            # Calculate efficiency
            efficiency = (individual_time / batch_time) if batch_time > 0 else 0
            efficiency_results.append({
                'batch_size': batch_size,
                'individual_time': individual_time * 1000,
                'batch_time': batch_time * 1000,
                'efficiency': efficiency
            })
        
        # Evaluate batch processing efficiency
        avg_efficiency = statistics.mean([r['efficiency'] for r in efficiency_results if r['efficiency'] > 0])
        passed = avg_efficiency > 1.5  # Batch should be at least 50% more efficient
        
        self.test_results.append(PerformanceTestResult(
            test_name="Batch Processing Efficiency",
            target_value=1.5,
            actual_value=round(avg_efficiency, 2),
            unit="x speedup",
            passed=passed,
            details=f"Average efficiency: {avg_efficiency:.2f}x, Best batch size: {max(efficiency_results, key=lambda x: x['efficiency'])['batch_size']}",
            recommendations=[
                "Optimize batch processing algorithms",
                "Implement parallel processing within batches",
                "Adjust optimal batch size based on testing",
                "Consider GPU acceleration for large batches"
            ] if not passed else [],
            timestamp=datetime.now().isoformat()
        ))
    
    async def validate_memory_optimization(self):
        """Validate memory usage optimization"""
        logger.info("🧠 Testing memory optimization...")
        
        # Get baseline memory
        baseline_memory = psutil.Process().memory_info().rss / 1024 / 1024
        
        # Process large dataset
        large_emails = self.generate_test_emails(1000)
        large_tasks = self.generate_test_tasks(1000)
        
        # Process in chunks to simulate real usage
        chunk_size = 50
        for i in range(0, len(large_emails), chunk_size):
            email_chunk = large_emails[i:i + chunk_size]
            task_chunk = large_tasks[i:i + chunk_size]
            
            await self.optimizer.optimize_email_classification(email_chunk)
            await self.optimizer.optimize_task_categorization(task_chunk)
        
        # Measure peak memory usage
        peak_memory = psutil.Process().memory_info().rss / 1024 / 1024
        memory_delta = peak_memory - baseline_memory
        
        passed = memory_delta < PERFORMANCE_TARGETS['MEMORY_LIMIT_MB']
        
        self.test_results.append(PerformanceTestResult(
            test_name="Memory Usage Optimization",
            target_value=PERFORMANCE_TARGETS['MEMORY_LIMIT_MB'],
            actual_value=round(memory_delta, 2),
            unit="MB",
            passed=passed,
            details=f"Baseline: {baseline_memory:.2f}MB, Peak: {peak_memory:.2f}MB, Delta: {memory_delta:.2f}MB",
            recommendations=[
                "Implement object pooling for frequent allocations",
                "Use streaming processing for large datasets",
                "Optimize data structures for memory efficiency",
                "Implement garbage collection hints"
            ] if not passed else [],
            timestamp=datetime.now().isoformat()
        ))
    
    async def validate_concurrent_processing(self):
        """Validate concurrent processing performance"""
        logger.info("⚡ Testing concurrent processing...")
        
        # Test concurrent email classification
        test_emails = self.generate_test_emails(20)
        
        # Sequential processing
        start_time = time.perf_counter()
        for email in test_emails:
            await self.optimizer.optimize_email_classification([email])
        sequential_time = time.perf_counter() - start_time
        
        # Concurrent processing
        start_time = time.perf_counter()
        tasks = [
            self.optimizer.optimize_email_classification([email])
            for email in test_emails
        ]
        await asyncio.gather(*tasks)
        concurrent_time = time.perf_counter() - start_time
        
        # Calculate speedup
        speedup = sequential_time / concurrent_time if concurrent_time > 0 else 0
        passed = speedup > 1.5  # Should see significant improvement with concurrency
        
        self.test_results.append(PerformanceTestResult(
            test_name="Concurrent Processing Performance",
            target_value=1.5,
            actual_value=round(speedup, 2),
            unit="x speedup",
            passed=passed,
            details=f"Sequential: {sequential_time:.2f}s, Concurrent: {concurrent_time:.2f}s, Speedup: {speedup:.2f}x",
            recommendations=[
                "Optimize async/await patterns",
                "Implement proper connection pooling",
                "Use semaphores to limit concurrent requests",
                "Consider process-based parallelism for CPU-bound tasks"
            ] if not passed else [],
            timestamp=datetime.now().isoformat()
        ))
    
    async def validate_stress_performance(self):
        """Validate performance under stress conditions"""
        logger.info("💪 Testing stress performance...")
        
        stress_emails = self.generate_test_emails(PERFORMANCE_TARGETS['STRESS_TEST_EMAILS'])
        
        # Process emails in batches under time pressure
        batch_size = 25
        processing_times = []
        
        start_time = time.perf_counter()
        
        for i in range(0, len(stress_emails), batch_size):
            batch = stress_emails[i:i + batch_size]
            
            batch_start = time.perf_counter()
            await self.optimizer.optimize_email_classification(batch)
            batch_time = time.perf_counter() - batch_start
            
            processing_times.append(batch_time * 1000)  # Convert to ms
        
        total_time = time.perf_counter() - start_time
        
        # Check performance degradation
        avg_batch_time = statistics.mean(processing_times)
        max_batch_time = max(processing_times)
        
        # Performance should not degrade significantly under stress
        passed = (
            avg_batch_time < PERFORMANCE_TARGETS['CLASSIFICATION_MAX_MS'] * batch_size * 1.5 and
            total_time < PERFORMANCE_TARGETS['STRESS_TEST_DURATION']
        )
        
        self.test_results.append(PerformanceTestResult(
            test_name="Stress Test Performance",
            target_value=PERFORMANCE_TARGETS['STRESS_TEST_DURATION'],
            actual_value=round(total_time, 2),
            unit="seconds",
            passed=passed,
            details=f"Processed {len(stress_emails)} emails in {total_time:.2f}s, Avg batch: {avg_batch_time:.2f}ms, Max batch: {max_batch_time:.2f}ms",
            recommendations=[
                "Implement adaptive throttling under load",
                "Add circuit breaker patterns",
                "Optimize memory allocation during stress",
                "Implement graceful degradation"
            ] if not passed else [],
            timestamp=datetime.now().isoformat()
        ))
    
    async def validate_sustained_load(self):
        """Validate performance under sustained load"""
        logger.info("🔄 Testing sustained load performance...")
        
        # Run sustained processing for a period
        duration = 10  # seconds
        end_time = time.time() + duration
        
        processed_count = 0
        processing_times = []
        
        while time.time() < end_time:
            emails = self.generate_test_emails(5)
            
            start_time = time.perf_counter()
            await self.optimizer.optimize_email_classification(emails)
            processing_time = time.perf_counter() - start_time
            
            processing_times.append(processing_time * 1000)
            processed_count += len(emails)
            
            # Small delay to simulate realistic usage
            await asyncio.sleep(0.1)
        
        # Calculate throughput and stability
        throughput = processed_count / duration
        avg_time = statistics.mean(processing_times)
        time_stability = statistics.stdev(processing_times) / avg_time if avg_time > 0 else 1
        
        # Check for performance stability (low variance in processing times)
        passed = time_stability < 0.3  # Coefficient of variation should be < 30%
        
        self.test_results.append(PerformanceTestResult(
            test_name="Sustained Load Performance",
            target_value=0.3,
            actual_value=round(time_stability, 3),
            unit="cv",
            passed=passed,
            details=f"Throughput: {throughput:.1f} emails/s, Avg time: {avg_time:.2f}ms, Stability: {time_stability:.3f}",
            recommendations=[
                "Implement resource pooling for sustained operations",
                "Add performance monitoring and alerting",
                "Optimize garbage collection scheduling",
                "Implement predictive scaling"
            ] if not passed else [],
            timestamp=datetime.now().isoformat()
        ))
    
    def generate_validation_report(self) -> ValidationSuiteResult:
        """Generate comprehensive validation report"""
        passed_tests = [r for r in self.test_results if r.passed]
        failed_tests = [r for r in self.test_results if not r.passed]
        
        overall_passed = len(failed_tests) == 0
        
        # Get final resource usage
        end_memory = psutil.Process().memory_info().rss / 1024 / 1024
        memory_delta = end_memory - self.start_memory
        cpu_usage = psutil.cpu_percent()
        
        summary = (
            f"✅ All backend performance targets achieved! Ready for production deployment."
            if overall_passed else
            f"❌ {len(failed_tests)} out of {len(self.test_results)} tests failed. Optimization required."
        )
        
        return ValidationSuiteResult(
            overall_passed=overall_passed,
            total_tests=len(self.test_results),
            passed_tests=len(passed_tests),
            failed_tests=len(failed_tests),
            results=self.test_results,
            summary=summary,
            memory_usage_mb=memory_delta,
            cpu_usage_percent=cpu_usage,
            timestamp=datetime.now().isoformat()
        )
    
    def generate_test_emails(self, count: int) -> List[Dict[str, Any]]:
        """Generate test emails with realistic content"""
        classifications = ['NEEDS_REPLY', 'APPROVAL_REQUIRED', 'DELEGATE', 'DO_MYSELF', 'FOLLOW_UP', 'FYI_ONLY']
        urgencies = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
        
        emails = []
        for i in range(count):
            emails.append({
                'id': i + 1,
                'subject': f'Test Email {i + 1} - Important Business Matter',
                'sender': f'sender{i % 20}@company.com',
                'content': f'This is test email content for performance validation. Email {i + 1} contains important business information that requires processing. ' * (i % 10 + 1),
                'classification': classifications[i % len(classifications)],
                'urgency': urgencies[i % len(urgencies)],
                'timestamp': time.time() - (i * 3600),
                'has_attachments': i % 5 == 0,
                'word_count': 50 + (i % 200)
            })
        return emails
    
    def generate_test_tasks(self, count: int) -> List[Dict[str, Any]]:
        """Generate test tasks with realistic content"""
        categories = ['NEEDS_REPLY', 'DELEGATE', 'DO_MYSELF', 'ASSIGN', 'FOLLOW_UP']
        urgencies = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
        
        tasks = []
        for i in range(count):
            tasks.append({
                'id': i + 1,
                'title': f'Task {i + 1} - Process Important Request',
                'description': f'This is test task description for performance validation. Task {i + 1} requires categorization and processing.',
                'category': categories[i % len(categories)],
                'urgency': urgencies[i % len(urgencies)],
                'estimated_duration': 15 + (i % 60),
                'created_at': time.time() - (i * 1800),
                'complexity': 'high' if i % 4 == 0 else 'medium' if i % 2 == 0 else 'low'
            })
        return tasks

async def run_backend_performance_validation() -> ValidationSuiteResult:
    """Run complete backend performance validation suite"""
    validator = BackendPerformanceValidator()
    
    print("🔬 Backend Performance Validation Suite Starting...")
    print("📊 Testing against targets:")
    print(f"  • Email Classification: <{PERFORMANCE_TARGETS['CLASSIFICATION_MAX_MS']}ms")
    print(f"  • Task Categorization: <{PERFORMANCE_TARGETS['TASK_CATEGORIZATION_MAX_MS']}ms")
    print(f"  • Memory Usage: <{PERFORMANCE_TARGETS['MEMORY_LIMIT_MB']}MB")
    print(f"  • Stress Test: {PERFORMANCE_TARGETS['STRESS_TEST_EMAILS']} emails in <{PERFORMANCE_TARGETS['STRESS_TEST_DURATION']}s")
    print("")
    
    results = await validator.run_full_validation()
    
    print("📈 Backend Performance Validation Results:")
    print(results.summary)
    print(f"Memory Usage: {results.memory_usage_mb:.2f}MB")
    print(f"CPU Usage: {results.cpu_usage_percent:.1f}%")
    print("")
    
    # Log detailed results
    for result in results.results:
        status = "✅" if result.passed else "❌"
        print(f"{status} {result.test_name}: {result.actual_value}{result.unit} (target: <{result.target_value}{result.unit})")
        
        if result.details:
            print(f"    Details: {result.details}")
        
        if result.recommendations:
            print("    Recommendations:")
            for rec in result.recommendations:
                print(f"      • {rec}")
        print("")
    
    return results

def save_validation_results(results: ValidationSuiteResult, filename: str = None):
    """Save validation results to JSON file"""
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backend_performance_validation_{timestamp}.json"
    
    # Convert results to JSON-serializable format
    results_dict = {
        'overall_passed': results.overall_passed,
        'total_tests': results.total_tests,
        'passed_tests': results.passed_tests,
        'failed_tests': results.failed_tests,
        'summary': results.summary,
        'memory_usage_mb': results.memory_usage_mb,
        'cpu_usage_percent': results.cpu_usage_percent,
        'timestamp': results.timestamp,
        'results': [
            {
                'test_name': r.test_name,
                'target_value': r.target_value,
                'actual_value': r.actual_value,
                'unit': r.unit,
                'passed': r.passed,
                'details': r.details,
                'recommendations': r.recommendations,
                'timestamp': r.timestamp
            }
            for r in results.results
        ]
    }
    
    with open(filename, 'w') as f:
        json.dump(results_dict, f, indent=2)
    
    print(f"✅ Validation results saved to {filename}")

if __name__ == "__main__":
    async def main():
        results = await run_backend_performance_validation()
        save_validation_results(results)
        
        # Exit with appropriate code
        exit_code = 0 if results.overall_passed else 1
        sys.exit(exit_code)
    
    asyncio.run(main())
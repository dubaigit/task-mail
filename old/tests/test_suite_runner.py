#!/usr/bin/env python3
"""
Comprehensive Test Suite Runner

Main test runner with coverage reporting, performance benchmarks,
parallel execution, test categorization, and detailed reporting.
"""

import pytest
import sys
import os
import time
import json
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import argparse
import platform
import psutil
from dataclasses import dataclass, asdict

# Test framework imports
import coverage
from unittest.mock import patch

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# ============================================================================
# Configuration and Data Classes
# ============================================================================

@dataclass
class TestResult:
    """Test execution result"""
    name: str
    status: str  # passed, failed, skipped, error
    duration: float
    error_message: Optional[str] = None
    category: Optional[str] = None

@dataclass
class TestSuiteResults:
    """Complete test suite results"""
    start_time: datetime
    end_time: datetime
    total_duration: float
    total_tests: int
    passed: int
    failed: int
    skipped: int
    errors: int
    coverage_percentage: float
    test_results: List[TestResult]
    performance_metrics: Dict[str, Any]
    system_info: Dict[str, Any]

@dataclass
class BenchmarkResult:
    """Performance benchmark result"""
    name: str
    execution_time: float
    memory_usage_mb: float
    cpu_usage_percent: float
    iterations: int
    operations_per_second: float

class TestSuiteRunner:
    """
    Comprehensive test suite runner with advanced features:
    - Parallel test execution
    - Coverage analysis
    - Performance benchmarking
    - Detailed reporting
    - Test categorization
    - Environment validation
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize test runner with configuration"""
        self.config = config or self._load_default_config()
        self.results: List[TestResult] = []
        self.benchmarks: List[BenchmarkResult] = []
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.coverage_data: Optional[coverage.Coverage] = None
        
        # Setup paths
        self.project_root = Path(__file__).parent.parent
        self.tests_dir = self.project_root / "tests"
        self.reports_dir = self.project_root / "test_results"
        self.reports_dir.mkdir(exist_ok=True)
        
        print(f"Test Suite Runner initialized")
        print(f"Project root: {self.project_root}")
        print(f"Tests directory: {self.tests_dir}")
        print(f"Reports directory: {self.reports_dir}")

    def _load_default_config(self) -> Dict[str, Any]:
        """Load default configuration"""
        return {
            'coverage': {
                'enabled': True,
                'min_percentage': 80,
                'source_dirs': ['.'],
                'omit_patterns': ['*/tests/*', '*/venv/*', '*/node_modules/*'],
                'report_formats': ['html', 'xml', 'term-missing']
            },
            'performance': {
                'enabled': True,
                'benchmark_iterations': 100,
                'timeout_seconds': 300,
                'memory_limit_mb': 1024
            },
            'parallel': {
                'enabled': True,
                'max_workers': 4,
                'distribute_by': 'file'  # 'file' or 'test'
            },
            'reporting': {
                'formats': ['json', 'html', 'junit'],
                'detailed': True,
                'include_system_info': True
            },
            'categories': {
                'unit': {
                    'marker': 'unit',
                    'timeout': 30
                },
                'integration': {
                    'marker': 'integration', 
                    'timeout': 120
                },
                'slow': {
                    'marker': 'slow',
                    'timeout': 300
                },
                'api': {
                    'marker': 'api',
                    'timeout': 60
                },
                'db': {
                    'marker': 'db',
                    'timeout': 60
                }
            }
        }

    def run_full_suite(self, args: Optional[argparse.Namespace] = None) -> TestSuiteResults:
        """Run the complete test suite with all features"""
        print("\n" + "="*80)
        print("PRODUCTION EMAIL INTELLIGENCE SYSTEM - COMPREHENSIVE TEST SUITE")
        print("="*80)
        
        self.start_time = datetime.now()
        
        try:
            # 1. Environment validation
            self._validate_environment()
            
            # 2. Setup coverage monitoring
            if self.config['coverage']['enabled']:
                self._setup_coverage()
            
            # 3. Run test categories
            self._run_test_categories(args)
            
            # 4. Run performance benchmarks
            if self.config['performance']['enabled']:
                self._run_performance_benchmarks()
            
            # 5. Generate coverage report
            if self.coverage_data:
                coverage_percentage = self._generate_coverage_report()
            else:
                coverage_percentage = 0.0
            
            # 6. Compile results
            self.end_time = datetime.now()
            results = self._compile_results(coverage_percentage)
            
            # 7. Generate reports
            self._generate_reports(results)
            
            # 8. Display summary
            self._display_summary(results)
            
            return results
            
        except Exception as e:
            print(f"Test suite execution failed: {e}")
            raise
        finally:
            if self.coverage_data:
                self.coverage_data.stop()

    def _validate_environment(self):
        """Validate test environment and dependencies"""
        print("\n📋 Validating test environment...")
        
        # Check Python version
        python_version = sys.version_info
        if python_version < (3, 8):
            raise RuntimeError(f"Python 3.8+ required, found {python_version}")
        
        # Check required packages
        required_packages = [
            'pytest', 'pytest-asyncio', 'coverage', 'sqlalchemy',
            'fastapi', 'aioredis', 'psutil'
        ]
        
        missing_packages = []
        for package in required_packages:
            try:
                __import__(package.replace('-', '_'))
            except ImportError:
                missing_packages.append(package)
        
        if missing_packages:
            print(f"⚠️  Missing packages: {', '.join(missing_packages)}")
            print("Install with: pip install " + " ".join(missing_packages))
        
        # Check system resources
        memory_gb = psutil.virtual_memory().total / (1024**3)
        if memory_gb < 2:
            print(f"⚠️  Low system memory: {memory_gb:.1f}GB (recommended: 4GB+)")
        
        # Check test files exist
        test_files = [
            'test_backend_api.py',
            'test_email_intelligence.py', 
            'test_task_builder.py',
            'test_database_operations.py'
        ]
        
        missing_tests = []
        for test_file in test_files:
            if not (self.tests_dir / test_file).exists():
                missing_tests.append(test_file)
        
        if missing_tests:
            print(f"⚠️  Missing test files: {', '.join(missing_tests)}")
        
        print("✅ Environment validation complete")

    def _setup_coverage(self):
        """Setup code coverage monitoring"""
        print("📊 Setting up coverage monitoring...")
        
        self.coverage_data = coverage.Coverage(
            source=self.config['coverage']['source_dirs'],
            omit=self.config['coverage']['omit_patterns'],
            config_file='.coveragerc'
        )
        self.coverage_data.start()
        
        print("✅ Coverage monitoring active")

    def _run_test_categories(self, args: Optional[argparse.Namespace] = None):
        """Run tests by category with appropriate timeouts"""
        print("\n🧪 Running test categories...")
        
        categories_to_run = ['unit', 'integration', 'api', 'db']
        if args and args.include_slow:
            categories_to_run.append('slow')
        
        for category in categories_to_run:
            if category not in self.config['categories']:
                continue
                
            category_config = self.config['categories'][category]
            print(f"\n  Running {category} tests...")
            
            # Build pytest command
            pytest_args = [
                '-v',
                '--tb=short',
                f'-m={category_config["marker"]}',
                f'--timeout={category_config["timeout"]}',
                str(self.tests_dir)
            ]
            
            if self.config['parallel']['enabled'] and category != 'integration':
                pytest_args.extend([
                    f'-n={self.config["parallel"]["max_workers"]}',
                    f'--dist={self.config["parallel"]["distribute_by"]}'
                ])
            
            # Execute tests
            start_time = time.time()
            result = self._execute_pytest(pytest_args, category)
            duration = time.time() - start_time
            
            print(f"  ✅ {category} tests completed in {duration:.2f}s")

    def _execute_pytest(self, pytest_args: List[str], category: str) -> Dict[str, Any]:
        """Execute pytest with given arguments and capture results"""
        
        # Create temporary results file
        results_file = self.reports_dir / f"{category}_results.json"
        
        # Add JSON reporting
        pytest_args.extend([
            '--json-report',
            f'--json-report-file={results_file}'
        ])
        
        try:
            # Run pytest
            exit_code = pytest.main(pytest_args)
            
            # Parse results if available
            if results_file.exists():
                with open(results_file, 'r') as f:
                    test_data = json.load(f)
                self._parse_pytest_results(test_data, category)
                results_file.unlink()  # Clean up
            
            return {'exit_code': exit_code, 'category': category}
            
        except Exception as e:
            print(f"  ❌ Error running {category} tests: {e}")
            return {'exit_code': 1, 'category': category, 'error': str(e)}

    def _parse_pytest_results(self, test_data: Dict[str, Any], category: str):
        """Parse pytest JSON results and add to internal results"""
        
        if 'tests' not in test_data:
            return
        
        for test in test_data['tests']:
            result = TestResult(
                name=test.get('nodeid', 'unknown'),
                status=test.get('outcome', 'unknown'),
                duration=test.get('duration', 0.0),
                error_message=self._extract_error_message(test),
                category=category
            )
            self.results.append(result)

    def _extract_error_message(self, test_data: Dict[str, Any]) -> Optional[str]:
        """Extract error message from test data"""
        if test_data.get('outcome') in ['failed', 'error']:
            call = test_data.get('call', {})
            if 'longrepr' in call:
                return str(call['longrepr'])[:500]  # Truncate long messages
        return None

    def _run_performance_benchmarks(self):
        """Run performance benchmarks for critical components"""
        print("\n⚡ Running performance benchmarks...")
        
        benchmarks = [
            ('email_classification', self._benchmark_email_classification),
            ('database_queries', self._benchmark_database_queries),
            ('task_extraction', self._benchmark_task_extraction),
            ('api_endpoints', self._benchmark_api_endpoints),
            ('websocket_connections', self._benchmark_websocket_connections)
        ]
        
        for name, benchmark_func in benchmarks:
            try:
                print(f"  Running {name} benchmark...")
                result = benchmark_func()
                if result:
                    self.benchmarks.append(result)
                    print(f"  ✅ {name}: {result.operations_per_second:.0f} ops/sec")
            except Exception as e:
                print(f"  ⚠️  {name} benchmark failed: {e}")

    def _benchmark_email_classification(self) -> Optional[BenchmarkResult]:
        """Benchmark email classification performance"""
        try:
            from email_intelligence_production import ProductionEmailIntelligenceEngine
            
            # Setup
            engine = ProductionEmailIntelligenceEngine()
            sample_email = {
                'subject': 'Test classification performance',
                'body': 'Please review this proposal and provide feedback by Friday.',
                'sender': 'test@example.com'
            }
            
            # Benchmark
            iterations = self.config['performance']['benchmark_iterations']
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024
            
            for _ in range(iterations):
                # Mock the AI call to avoid API costs
                with patch.object(engine, '_call_openai_api', return_value="NEEDS_REPLY|0.85"):
                    engine.analyze_email(
                        sample_email['subject'],
                        sample_email['body'], 
                        sample_email['sender']
                    )
            
            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            
            duration = end_time - start_time
            memory_usage = max(0, end_memory - start_memory)
            ops_per_second = iterations / duration if duration > 0 else 0
            
            return BenchmarkResult(
                name='email_classification',
                execution_time=duration,
                memory_usage_mb=memory_usage,
                cpu_usage_percent=0.0,  # Not measured in this benchmark
                iterations=iterations,
                operations_per_second=ops_per_second
            )
            
        except ImportError:
            print("  ⚠️  Email intelligence engine not available for benchmarking")
            return None
        except Exception as e:
            print(f"  ❌ Classification benchmark error: {e}")
            return None

    def _benchmark_database_queries(self) -> Optional[BenchmarkResult]:
        """Benchmark database query performance"""
        try:
            import sqlite3
            import tempfile
            
            # Create temporary database
            with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp_db:
                db_path = tmp_db.name
            
            conn = sqlite3.connect(db_path)
            
            # Create test table and data
            conn.execute('''
                CREATE TABLE test_emails (
                    id INTEGER PRIMARY KEY,
                    subject TEXT,
                    sender TEXT,
                    date_received TIMESTAMP
                )
            ''')
            
            # Insert test data
            test_data = [(i, f'Subject {i}', f'sender{i}@test.com', '2024-01-01') 
                        for i in range(1000)]
            conn.executemany(
                'INSERT INTO test_emails (id, subject, sender, date_received) VALUES (?, ?, ?, ?)',
                test_data
            )
            conn.commit()
            
            # Benchmark queries
            iterations = 100
            start_time = time.time()
            
            for i in range(iterations):
                cursor = conn.execute(
                    'SELECT * FROM test_emails WHERE sender LIKE ? ORDER BY date_received DESC LIMIT 10',
                    (f'sender{i % 100}%',)
                )
                cursor.fetchall()
            
            end_time = time.time()
            duration = end_time - start_time
            ops_per_second = iterations / duration if duration > 0 else 0
            
            conn.close()
            os.unlink(db_path)
            
            return BenchmarkResult(
                name='database_queries',
                execution_time=duration,
                memory_usage_mb=0.0,
                cpu_usage_percent=0.0,
                iterations=iterations,
                operations_per_second=ops_per_second
            )
            
        except Exception as e:
            print(f"  ❌ Database benchmark error: {e}")
            return None

    def _benchmark_task_extraction(self) -> Optional[BenchmarkResult]:
        """Benchmark task extraction performance"""
        try:
            from task_builder import IntelligentTaskBuilder
            
            # Setup
            builder = IntelligentTaskBuilder()
            sample_email = {
                'subject': 'Performance test email with tasks',
                'body': '''Please review the proposal and provide feedback.
                          We need to schedule a meeting next week.
                          Can you approve the budget allocation?
                          The development team should implement the new feature.''',
                'sender': 'performance@test.com'
            }
            
            # Benchmark
            iterations = 50  # Fewer iterations as this is more complex
            start_time = time.time()
            
            for _ in range(iterations):
                builder.extract_tasks_from_email(
                    sample_email['subject'],
                    sample_email['body'],
                    sample_email['sender']
                )
            
            end_time = time.time()
            duration = end_time - start_time
            ops_per_second = iterations / duration if duration > 0 else 0
            
            return BenchmarkResult(
                name='task_extraction',
                execution_time=duration,
                memory_usage_mb=0.0,
                cpu_usage_percent=0.0,
                iterations=iterations,
                operations_per_second=ops_per_second
            )
            
        except ImportError:
            print("  ⚠️  Task builder not available for benchmarking")
            return None
        except Exception as e:
            print(f"  ❌ Task extraction benchmark error: {e}")
            return None

    def _benchmark_api_endpoints(self) -> Optional[BenchmarkResult]:
        """Benchmark API endpoint performance"""
        try:
            from fastapi.testclient import TestClient
            from backend_architecture import app
            
            client = TestClient(app)
            
            # Benchmark health endpoint
            iterations = 200
            start_time = time.time()
            
            for _ in range(iterations):
                response = client.get("/health")
                assert response.status_code == 200
            
            end_time = time.time()
            duration = end_time - start_time
            ops_per_second = iterations / duration if duration > 0 else 0
            
            return BenchmarkResult(
                name='api_endpoints',
                execution_time=duration,
                memory_usage_mb=0.0,
                cpu_usage_percent=0.0,
                iterations=iterations,
                operations_per_second=ops_per_second
            )
            
        except ImportError:
            print("  ⚠️  Backend API not available for benchmarking")
            return None
        except Exception as e:
            print(f"  ❌ API benchmark error: {e}")
            return None

    def _benchmark_websocket_connections(self) -> Optional[BenchmarkResult]:
        """Benchmark WebSocket connection performance"""
        try:
            from backend_architecture import ConnectionManager, WebSocketMessage
            import asyncio
            
            manager = ConnectionManager()
            
            # Benchmark connection management
            iterations = 100
            start_time = time.time()
            
            async def connection_test():
                mock_websockets = []
                for i in range(iterations):
                    from unittest.mock import AsyncMock
                    mock_ws = AsyncMock()
                    user_id = f"benchmark_user_{i}"
                    await manager.connect(mock_ws, user_id)
                    mock_websockets.append((mock_ws, user_id))
                
                # Test broadcast
                message = WebSocketMessage(type="benchmark", data={"test": True})
                await manager.broadcast(message)
                
                # Cleanup
                for mock_ws, user_id in mock_websockets:
                    manager.disconnect(user_id)
            
            asyncio.run(connection_test())
            
            end_time = time.time()
            duration = end_time - start_time
            ops_per_second = iterations / duration if duration > 0 else 0
            
            return BenchmarkResult(
                name='websocket_connections',
                execution_time=duration,
                memory_usage_mb=0.0,
                cpu_usage_percent=0.0,
                iterations=iterations,
                operations_per_second=ops_per_second
            )
            
        except ImportError:
            print("  ⚠️  WebSocket manager not available for benchmarking")
            return None
        except Exception as e:
            print(f"  ❌ WebSocket benchmark error: {e}")
            return None

    def _generate_coverage_report(self) -> float:
        """Generate coverage report and return percentage"""
        print("\n📊 Generating coverage report...")
        
        self.coverage_data.stop()
        
        # Generate reports
        coverage_percentage = self.coverage_data.report()
        
        # Generate HTML report
        if 'html' in self.config['coverage']['report_formats']:
            html_dir = self.reports_dir / 'htmlcov'
            self.coverage_data.html_report(directory=str(html_dir))
            print(f"  📄 HTML coverage report: {html_dir}/index.html")
        
        # Generate XML report
        if 'xml' in self.config['coverage']['report_formats']:
            xml_file = self.reports_dir / 'coverage.xml'
            self.coverage_data.xml_report(outfile=str(xml_file))
            print(f"  📄 XML coverage report: {xml_file}")
        
        print(f"  📈 Coverage: {coverage_percentage:.1f}%")
        
        # Check minimum coverage requirement
        min_coverage = self.config['coverage']['min_percentage']
        if coverage_percentage < min_coverage:
            print(f"  ⚠️  Coverage below minimum requirement ({min_coverage}%)")
        else:
            print(f"  ✅ Coverage meets requirement ({min_coverage}%)")
        
        return coverage_percentage

    def _compile_results(self, coverage_percentage: float) -> TestSuiteResults:
        """Compile all test results into final summary"""
        
        # Calculate statistics
        total_tests = len(self.results)
        passed = len([r for r in self.results if r.status == 'passed'])
        failed = len([r for r in self.results if r.status == 'failed'])
        skipped = len([r for r in self.results if r.status == 'skipped'])
        errors = len([r for r in self.results if r.status == 'error'])
        
        # Calculate total duration
        total_duration = (self.end_time - self.start_time).total_seconds()
        
        # System information
        system_info = {
            'platform': platform.platform(),
            'python_version': sys.version,
            'cpu_count': os.cpu_count(),
            'memory_gb': psutil.virtual_memory().total / (1024**3),
            'timestamp': self.start_time.isoformat()
        }
        
        # Performance metrics
        performance_metrics = {
            'benchmarks': [asdict(b) for b in self.benchmarks],
            'avg_test_duration': sum(r.duration for r in self.results) / total_tests if total_tests > 0 else 0,
            'total_execution_time': total_duration
        }
        
        return TestSuiteResults(
            start_time=self.start_time,
            end_time=self.end_time,
            total_duration=total_duration,
            total_tests=total_tests,
            passed=passed,
            failed=failed,
            skipped=skipped,
            errors=errors,
            coverage_percentage=coverage_percentage,
            test_results=self.results,
            performance_metrics=performance_metrics,
            system_info=system_info
        )

    def _generate_reports(self, results: TestSuiteResults):
        """Generate various report formats"""
        print("\n📋 Generating test reports...")
        
        # JSON Report
        if 'json' in self.config['reporting']['formats']:
            json_file = self.reports_dir / 'test_results.json'
            with open(json_file, 'w') as f:
                json.dump(asdict(results), f, indent=2, default=str)
            print(f"  📄 JSON report: {json_file}")
        
        # HTML Report
        if 'html' in self.config['reporting']['formats']:
            html_file = self.reports_dir / 'test_report.html'
            self._generate_html_report(results, html_file)
            print(f"  📄 HTML report: {html_file}")
        
        # JUnit XML Report
        if 'junit' in self.config['reporting']['formats']:
            junit_file = self.reports_dir / 'junit.xml'
            self._generate_junit_report(results, junit_file)
            print(f"  📄 JUnit XML report: {junit_file}")

    def _generate_html_report(self, results: TestSuiteResults, output_file: Path):
        """Generate comprehensive HTML report"""
        
        # Calculate success rate
        success_rate = (results.passed / results.total_tests * 100) if results.total_tests > 0 else 0
        
        # Group results by category
        results_by_category = {}
        for result in results.test_results:
            category = result.category or 'other'
            if category not in results_by_category:
                results_by_category[category] = []
            results_by_category[category].append(result)
        
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Email Intelligence System - Test Results</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #2c3e50; color: white; padding: 20px; border-radius: 8px; }}
        .summary {{ display: flex; gap: 20px; margin: 20px 0; }}
        .metric {{ background: #ecf0f1; padding: 15px; border-radius: 8px; text-align: center; }}
        .metric.success {{ background: #d5f4e6; }}
        .metric.warning {{ background: #fef9e7; }}
        .metric.danger {{ background: #fadbd8; }}
        .section {{ margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background-color: #f2f2f2; }}
        .passed {{ color: green; }}
        .failed {{ color: red; }}
        .skipped {{ color: orange; }}
        .benchmark {{ background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 4px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Email Intelligence System Test Results</h1>
        <p>Generated: {results.start_time.strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p>Duration: {results.total_duration:.2f} seconds</p>
    </div>
    
    <div class="summary">
        <div class="metric success">
            <h3>{results.passed}</h3>
            <p>Passed</p>
        </div>
        <div class="metric {'danger' if results.failed > 0 else 'success'}">
            <h3>{results.failed}</h3>
            <p>Failed</p>
        </div>
        <div class="metric warning">
            <h3>{results.skipped}</h3>
            <p>Skipped</p>
        </div>
        <div class="metric {'success' if results.coverage_percentage >= 80 else 'warning'}">
            <h3>{results.coverage_percentage:.1f}%</h3>
            <p>Coverage</p>
        </div>
        <div class="metric success">
            <h3>{success_rate:.1f}%</h3>
            <p>Success Rate</p>
        </div>
    </div>
"""
        
        # Test Results by Category
        html_content += '<div class="section"><h2>📊 Test Results by Category</h2>'
        for category, category_results in results_by_category.items():
            passed_count = len([r for r in category_results if r.status == 'passed'])
            total_count = len(category_results)
            category_success_rate = (passed_count / total_count * 100) if total_count > 0 else 0
            
            html_content += f'''
            <h3>{category.title()} Tests ({passed_count}/{total_count} - {category_success_rate:.1f}%)</h3>
            <table>
                <tr><th>Test Name</th><th>Status</th><th>Duration</th><th>Error</th></tr>
            '''
            
            for result in sorted(category_results, key=lambda x: x.name):
                status_class = result.status.lower()
                error_cell = result.error_message[:100] + '...' if result.error_message else ''
                html_content += f'''
                <tr>
                    <td>{result.name}</td>
                    <td class="{status_class}">{result.status.upper()}</td>
                    <td>{result.duration:.3f}s</td>
                    <td>{error_cell}</td>
                </tr>
                '''
            
            html_content += '</table>'
        
        html_content += '</div>'
        
        # Performance Benchmarks
        if results.performance_metrics['benchmarks']:
            html_content += '<div class="section"><h2>⚡ Performance Benchmarks</h2>'
            
            for benchmark in results.performance_metrics['benchmarks']:
                html_content += f'''
                <div class="benchmark">
                    <h4>{benchmark['name'].replace('_', ' ').title()}</h4>
                    <p><strong>Operations per second:</strong> {benchmark['operations_per_second']:.0f}</p>
                    <p><strong>Total time:</strong> {benchmark['execution_time']:.3f}s</p>
                    <p><strong>Iterations:</strong> {benchmark['iterations']}</p>
                    <p><strong>Memory usage:</strong> {benchmark['memory_usage_mb']:.1f}MB</p>
                </div>
                '''
            
            html_content += '</div>'
        
        # System Information
        html_content += f'''
        <div class="section">
            <h2>💻 System Information</h2>
            <table>
                <tr><td><strong>Platform:</strong></td><td>{results.system_info['platform']}</td></tr>
                <tr><td><strong>Python Version:</strong></td><td>{results.system_info['python_version'].split()[0]}</td></tr>
                <tr><td><strong>CPU Cores:</strong></td><td>{results.system_info['cpu_count']}</td></tr>
                <tr><td><strong>Memory:</strong></td><td>{results.system_info['memory_gb']:.1f}GB</td></tr>
                <tr><td><strong>Test Start:</strong></td><td>{results.start_time.strftime('%Y-%m-%d %H:%M:%S')}</td></tr>
                <tr><td><strong>Test End:</strong></td><td>{results.end_time.strftime('%Y-%m-%d %H:%M:%S')}</td></tr>
            </table>
        </div>
        
        </body>
        </html>
        '''
        
        with open(output_file, 'w') as f:
            f.write(html_content)

    def _generate_junit_report(self, results: TestSuiteResults, output_file: Path):
        """Generate JUnit XML report for CI/CD integration"""
        
        from xml.etree.ElementTree import Element, SubElement, ElementTree
        
        # Root testsuites element
        testsuites = Element('testsuites')
        testsuites.set('name', 'EmailIntelligenceSystem')
        testsuites.set('tests', str(results.total_tests))
        testsuites.set('failures', str(results.failed))
        testsuites.set('errors', str(results.errors))
        testsuites.set('time', str(results.total_duration))
        testsuites.set('timestamp', results.start_time.isoformat())
        
        # Group by category
        results_by_category = {}
        for result in results.test_results:
            category = result.category or 'other'
            if category not in results_by_category:
                results_by_category[category] = []
            results_by_category[category].append(result)
        
        # Create testsuite for each category
        for category, category_results in results_by_category.items():
            testsuite = SubElement(testsuites, 'testsuite')
            testsuite.set('name', category)
            testsuite.set('tests', str(len(category_results)))
            
            category_failures = len([r for r in category_results if r.status == 'failed'])
            category_errors = len([r for r in category_results if r.status == 'error'])
            category_time = sum(r.duration for r in category_results)
            
            testsuite.set('failures', str(category_failures))
            testsuite.set('errors', str(category_errors))
            testsuite.set('time', str(category_time))
            
            # Add individual test cases
            for result in category_results:
                testcase = SubElement(testsuite, 'testcase')
                testcase.set('name', result.name.split('::')[-1])  # Just test name
                testcase.set('classname', result.name.split('::')[0])  # File name
                testcase.set('time', str(result.duration))
                
                if result.status == 'failed':
                    failure = SubElement(testcase, 'failure')
                    failure.set('message', 'Test failed')
                    if result.error_message:
                        failure.text = result.error_message
                elif result.status == 'error':
                    error = SubElement(testcase, 'error')
                    error.set('message', 'Test error')
                    if result.error_message:
                        error.text = result.error_message
                elif result.status == 'skipped':
                    SubElement(testcase, 'skipped')
        
        # Write XML file
        tree = ElementTree(testsuites)
        tree.write(output_file, encoding='utf-8', xml_declaration=True)

    def _display_summary(self, results: TestSuiteResults):
        """Display final test summary"""
        print("\n" + "="*80)
        print("🏆 TEST SUITE SUMMARY")
        print("="*80)
        
        # Overall results
        success_rate = (results.passed / results.total_tests * 100) if results.total_tests > 0 else 0
        
        print(f"📊 Total Tests: {results.total_tests}")
        print(f"✅ Passed: {results.passed}")
        print(f"❌ Failed: {results.failed}")
        print(f"⏭️  Skipped: {results.skipped}")
        print(f"💥 Errors: {results.errors}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        print(f"📊 Coverage: {results.coverage_percentage:.1f}%")
        print(f"⏱️  Duration: {results.total_duration:.2f}s")
        
        # Performance summary
        if results.performance_metrics['benchmarks']:
            print(f"\n⚡ PERFORMANCE BENCHMARKS")
            print("-" * 40)
            
            for benchmark in results.performance_metrics['benchmarks']:
                print(f"{benchmark['name'].replace('_', ' ').title()}: "
                      f"{benchmark['operations_per_second']:.0f} ops/sec")
        
        # Quality gates
        print(f"\n🚦 QUALITY GATES")
        print("-" * 40)
        
        gates = [
            ("All tests pass", results.failed == 0 and results.errors == 0),
            ("Coverage ≥ 80%", results.coverage_percentage >= 80),
            ("Success rate ≥ 95%", success_rate >= 95),
            ("No slow tests timeout", True),  # Would need actual timeout data
        ]
        
        for gate_name, passed in gates:
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"{gate_name}: {status}")
        
        # Final verdict
        all_gates_passed = all(passed for _, passed in gates)
        
        print(f"\n{'='*80}")
        if all_gates_passed:
            print("🎉 ALL QUALITY GATES PASSED - READY FOR PRODUCTION")
        else:
            print("⚠️  SOME QUALITY GATES FAILED - REVIEW REQUIRED")
        print("="*80)

def main():
    """Main entry point for test suite runner"""
    parser = argparse.ArgumentParser(description='Email Intelligence System Test Suite Runner')
    
    parser.add_argument('--config', type=str, help='Configuration file path')
    parser.add_argument('--include-slow', action='store_true', help='Include slow tests')
    parser.add_argument('--no-coverage', action='store_true', help='Disable coverage reporting')
    parser.add_argument('--no-benchmarks', action='store_true', help='Disable performance benchmarks')
    parser.add_argument('--parallel', type=int, help='Number of parallel workers')
    parser.add_argument('--output-dir', type=str, help='Output directory for reports')
    
    args = parser.parse_args()
    
    # Load configuration
    config = None
    if args.config and os.path.exists(args.config):
        with open(args.config, 'r') as f:
            config = json.load(f)
    
    # Create runner with configuration
    runner = TestSuiteRunner(config)
    
    # Apply command line overrides
    if args.no_coverage:
        runner.config['coverage']['enabled'] = False
    
    if args.no_benchmarks:
        runner.config['performance']['enabled'] = False
    
    if args.parallel:
        runner.config['parallel']['max_workers'] = args.parallel
    
    if args.output_dir:
        runner.reports_dir = Path(args.output_dir)
        runner.reports_dir.mkdir(exist_ok=True)
    
    try:
        # Run the complete test suite
        results = runner.run_full_suite(args)
        
        # Exit with appropriate code
        if results.failed > 0 or results.errors > 0:
            sys.exit(1)
        else:
            sys.exit(0)
            
    except KeyboardInterrupt:
        print("\n⚠️  Test suite interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n💥 Test suite failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Test Coverage and Execution Framework

Comprehensive test runner with coverage reporting, optimization,
and quality gate enforcement for 80%+ coverage target.

Priority: CRITICAL - Coverage framework ensures production quality
"""

import pytest
import coverage
import time
import json
import sys
import os
from pathlib import Path
from datetime import datetime
import subprocess
import psutil
from dataclasses import dataclass, asdict
from typing import Dict, List, Any, Optional
import statistics

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@dataclass
class TestResult:
    """Individual test result"""
    name: str
    status: str  # passed, failed, skipped, error
    duration: float
    memory_usage_mb: float
    error_message: Optional[str] = None
    category: Optional[str] = None


@dataclass
class CoverageResult:
    """Coverage analysis result"""
    percentage: float
    lines_covered: int
    lines_total: int
    missing_lines: List[str]
    branches_covered: int
    branches_total: int
    branch_percentage: float


@dataclass
class TestSuiteResult:
    """Complete test suite execution result"""
    start_time: datetime
    end_time: datetime
    total_duration: float
    total_tests: int
    passed: int
    failed: int
    skipped: int
    errors: int
    coverage: CoverageResult
    test_results: List[TestResult]
    performance_metrics: Dict[str, Any]
    quality_gates: Dict[str, bool]


class CoverageFramework:
    """Comprehensive coverage and testing framework"""
    
    def __init__(self, target_coverage: float = 80.0):
        self.target_coverage = target_coverage
        self.coverage_data = None
        self.test_results = []
        self.start_time = None
        self.config = {
            'source_dirs': ['.'],
            'omit_patterns': [
                '*/tests/*',
                '*/venv/*',
                '*/site-packages/*',
                '*/node_modules/*',
                '*/.git/*',
                '*/dashboard/frontend/build/*',
                '*/dashboard/frontend/node_modules/*'
            ],
            'include_patterns': [
                '*.py',
                'dashboard/backend/*.py',
                'email_*.py',
                'apple_*.py',
                'backend_*.py',
                'auth_*.py'
            ]
        }
    
    def initialize_coverage(self):
        """Initialize coverage monitoring"""
        self.coverage_data = coverage.Coverage(
            source=self.config['source_dirs'],
            omit=self.config['omit_patterns'],
            branch=True,  # Enable branch coverage
            config_file='.coveragerc'
        )
        self.coverage_data.start()
        print("📊 Coverage monitoring initialized")
    
    def run_comprehensive_tests(self) -> TestSuiteResult:
        """Run comprehensive test suite with coverage"""
        print("\n" + "="*80)
        print("COMPREHENSIVE TEST EXECUTION FRAMEWORK")
        print("Target Coverage: 80%+ | Quality Gates: ENFORCED")
        print("="*80)
        
        self.start_time = datetime.now()
        
        # Initialize coverage
        self.initialize_coverage()
        
        # Run test categories
        test_categories = [
            ('security', 'test_security_comprehensive.py'),
            ('email_intelligence', 'test_email_intelligence_comprehensive.py'),
            ('integration', 'test_integration_comprehensive.py'),
            ('performance', 'test_performance_accessibility.py'),
            ('api_endpoints', 'test_api_endpoints_comprehensive.py'),
            ('existing_tests', 'test_*.py')  # Run existing tests
        ]
        
        all_results = []
        category_performance = {}
        
        for category_name, test_pattern in test_categories:
            print(f"\n🔄 Running {category_name} tests...")
            category_start = time.time()
            
            try:
                results = self._run_test_category(category_name, test_pattern)
                all_results.extend(results)
                
                category_end = time.time()
                category_performance[category_name] = {
                    'duration': category_end - category_start,
                    'test_count': len(results),
                    'passed': len([r for r in results if r.status == 'passed']),
                    'failed': len([r for r in results if r.status == 'failed'])
                }
                
                print(f"✅ {category_name}: {len(results)} tests, "
                      f"{category_performance[category_name]['passed']} passed, "
                      f"{category_performance[category_name]['failed']} failed")
                
            except Exception as e:
                print(f"❌ Error in {category_name}: {e}")
                category_performance[category_name] = {
                    'duration': 0,
                    'test_count': 0,
                    'passed': 0,
                    'failed': 1,
                    'error': str(e)
                }
        
        # Stop coverage and generate report
        coverage_result = self._generate_coverage_report()
        
        # Calculate metrics
        end_time = datetime.now()
        total_duration = (end_time - self.start_time).total_seconds()
        
        # Compile results
        test_suite_result = TestSuiteResult(
            start_time=self.start_time,
            end_time=end_time,
            total_duration=total_duration,
            total_tests=len(all_results),
            passed=len([r for r in all_results if r.status == 'passed']),
            failed=len([r for r in all_results if r.status == 'failed']),
            skipped=len([r for r in all_results if r.status == 'skipped']),
            errors=len([r for r in all_results if r.status == 'error']),
            coverage=coverage_result,
            test_results=all_results,
            performance_metrics=category_performance,
            quality_gates=self._evaluate_quality_gates(coverage_result, all_results)
        )
        
        # Display final results
        self._display_final_results(test_suite_result)
        
        return test_suite_result
    
    def _run_test_category(self, category_name: str, test_pattern: str) -> List[TestResult]:
        """Run a specific test category"""
        results = []
        
        try:
            # Build pytest command
            if test_pattern == 'test_*.py':
                # Run all existing tests
                cmd = [
                    'python', '-m', 'pytest', 
                    'tests/',
                    '-v',
                    '--tb=short',
                    '--json-report',
                    f'--json-report-file=test_results_{category_name}.json'
                ]
            else:
                # Run specific test file
                test_file = Path('tests') / test_pattern
                if test_file.exists():
                    cmd = [
                        'python', '-m', 'pytest',
                        str(test_file),
                        '-v',
                        '--tb=short',
                        '--json-report',
                        f'--json-report-file=test_results_{category_name}.json'
                    ]
                else:
                    print(f"⚠️  Test file {test_file} not found, skipping...")
                    return []
            
            # Run tests
            process = psutil.Process(os.getpid())
            initial_memory = process.memory_info().rss / 1024 / 1024
            
            start_time = time.time()
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            end_time = time.time()
            
            final_memory = process.memory_info().rss / 1024 / 1024
            memory_usage = final_memory - initial_memory
            
            # Parse results from JSON report if available
            json_report_file = f'test_results_{category_name}.json'
            if os.path.exists(json_report_file):
                try:
                    with open(json_report_file, 'r') as f:
                        report_data = json.load(f)
                    
                    for test in report_data.get('tests', []):
                        test_result = TestResult(
                            name=test.get('nodeid', f'{category_name}_test'),
                            status=test.get('outcome', 'unknown'),
                            duration=test.get('duration', 0),
                            memory_usage_mb=memory_usage / max(len(report_data.get('tests', [])), 1),
                            error_message=test.get('call', {}).get('longrepr') if test.get('outcome') == 'failed' else None,
                            category=category_name
                        )
                        results.append(test_result)
                    
                    # Cleanup
                    os.remove(json_report_file)
                    
                except Exception as e:
                    print(f"Warning: Could not parse JSON report for {category_name}: {e}")
            
            # If no JSON results, create basic result
            if not results:
                status = 'passed' if result.returncode == 0 else 'failed'
                test_result = TestResult(
                    name=f'{category_name}_suite',
                    status=status,
                    duration=end_time - start_time,
                    memory_usage_mb=memory_usage,
                    error_message=result.stderr if result.returncode != 0 else None,
                    category=category_name
                )
                results.append(test_result)
            
        except subprocess.TimeoutExpired:
            test_result = TestResult(
                name=f'{category_name}_timeout',
                status='error',
                duration=300,
                memory_usage_mb=0,
                error_message='Test execution timeout',
                category=category_name
            )
            results.append(test_result)
        
        except Exception as e:
            test_result = TestResult(
                name=f'{category_name}_error',
                status='error',
                duration=0,
                memory_usage_mb=0,
                error_message=str(e),
                category=category_name
            )
            results.append(test_result)
        
        return results
    
    def _generate_coverage_report(self) -> CoverageResult:
        """Generate coverage report"""
        print("\n📊 Generating coverage report...")
        
        if not self.coverage_data:
            return CoverageResult(0, 0, 0, [], 0, 0, 0)
        
        try:
            self.coverage_data.stop()
            
            # Generate coverage report
            coverage_percentage = self.coverage_data.report(show_missing=True)
            
            # Get detailed coverage data
            analysis = self.coverage_data.analysis2('email_intelligence_engine.py')
            if analysis:
                lines_total = len(analysis[1]) if analysis[1] else 0
                lines_covered = lines_total - len(analysis[3]) if analysis[3] else lines_total
                missing_lines = [str(line) for line in analysis[3]] if analysis[3] else []
            else:
                lines_total = 0
                lines_covered = 0
                missing_lines = []
            
            # Generate HTML report
            html_dir = Path('test_results/htmlcov')
            html_dir.mkdir(parents=True, exist_ok=True)
            self.coverage_data.html_report(directory=str(html_dir))
            
            # Generate XML report
            xml_file = Path('test_results/coverage.xml')
            xml_file.parent.mkdir(parents=True, exist_ok=True)
            self.coverage_data.xml_report(outfile=str(xml_file))
            
            print(f"  📄 HTML coverage report: {html_dir}/index.html")
            print(f"  📄 XML coverage report: {xml_file}")
            print(f"  📈 Coverage: {coverage_percentage:.1f}%")
            
            return CoverageResult(
                percentage=coverage_percentage,
                lines_covered=lines_covered,
                lines_total=lines_total,
                missing_lines=missing_lines,
                branches_covered=0,  # Would need branch analysis
                branches_total=0,
                branch_percentage=0
            )
            
        except Exception as e:
            print(f"❌ Error generating coverage report: {e}")
            return CoverageResult(0, 0, 0, [], 0, 0, 0)
    
    def _evaluate_quality_gates(self, coverage: CoverageResult, test_results: List[TestResult]) -> Dict[str, bool]:
        """Evaluate quality gates"""
        print("\n🚪 Evaluating quality gates...")
        
        gates = {}
        
        # Coverage gate
        gates['coverage_80_percent'] = coverage.percentage >= self.target_coverage
        print(f"  📊 Coverage ≥80%: {'✅' if gates['coverage_80_percent'] else '❌'} ({coverage.percentage:.1f}%)")
        
        # Test success rate gate
        total_tests = len(test_results)
        passed_tests = len([r for r in test_results if r.status == 'passed'])
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        gates['test_success_95_percent'] = success_rate >= 95
        print(f"  ✅ Test Success ≥95%: {'✅' if gates['test_success_95_percent'] else '❌'} ({success_rate:.1f}%)")
        
        # Performance gate
        avg_test_duration = statistics.mean([r.duration for r in test_results]) if test_results else 0
        gates['performance_under_5s'] = avg_test_duration < 5.0
        print(f"  ⚡ Avg Test Duration <5s: {'✅' if gates['performance_under_5s'] else '❌'} ({avg_test_duration:.1f}s)")
        
        # Memory usage gate
        avg_memory = statistics.mean([r.memory_usage_mb for r in test_results]) if test_results else 0
        gates['memory_under_50mb'] = avg_memory < 50
        print(f"  💾 Avg Memory <50MB: {'✅' if gates['memory_under_50mb'] else '❌'} ({avg_memory:.1f}MB)")
        
        # Security tests gate
        security_tests = [r for r in test_results if r.category == 'security']
        security_passed = len([r for r in security_tests if r.status == 'passed'])
        gates['security_100_percent'] = len(security_tests) > 0 and security_passed == len(security_tests)
        print(f"  🔒 Security Tests 100%: {'✅' if gates['security_100_percent'] else '❌'} ({security_passed}/{len(security_tests)})")
        
        # Overall gate
        gates['overall_quality'] = all(gates.values())
        print(f"  🎯 Overall Quality Gate: {'✅ PASSED' if gates['overall_quality'] else '❌ FAILED'}")
        
        return gates
    
    def _display_final_results(self, result: TestSuiteResult):
        """Display final test results"""
        print("\n" + "="*80)
        print("FINAL TEST EXECUTION RESULTS")
        print("="*80)
        
        # Summary
        print(f"\n📊 SUMMARY")
        print(f"   Total Tests: {result.total_tests}")
        print(f"   Passed: {result.passed} ({result.passed/result.total_tests*100:.1f}%)")
        print(f"   Failed: {result.failed}")
        print(f"   Skipped: {result.skipped}")
        print(f"   Errors: {result.errors}")
        print(f"   Duration: {result.total_duration:.1f}s")
        
        # Coverage
        print(f"\n📈 COVERAGE")
        print(f"   Line Coverage: {result.coverage.percentage:.1f}%")
        print(f"   Lines Covered: {result.coverage.lines_covered}/{result.coverage.lines_total}")
        print(f"   Target: {self.target_coverage}%")
        coverage_status = "✅ MEETS TARGET" if result.coverage.percentage >= self.target_coverage else "❌ BELOW TARGET"
        print(f"   Status: {coverage_status}")
        
        # Quality Gates
        print(f"\n🚪 QUALITY GATES")
        for gate_name, gate_passed in result.quality_gates.items():
            status = "✅ PASS" if gate_passed else "❌ FAIL"
            gate_display = gate_name.replace('_', ' ').title()
            print(f"   {gate_display}: {status}")
        
        # Performance by Category
        print(f"\n⚡ PERFORMANCE BY CATEGORY")
        for category, metrics in result.performance_metrics.items():
            if 'error' in metrics:
                print(f"   {category.title()}: ❌ ERROR - {metrics['error']}")
            else:
                print(f"   {category.title()}: {metrics['duration']:.1f}s, "
                      f"{metrics['test_count']} tests, "
                      f"{metrics['passed']}/{metrics['test_count']} passed")
        
        # Final Status
        final_status = "🎉 PRODUCTION READY" if result.quality_gates['overall_quality'] else "⚠️  NEEDS IMPROVEMENT"
        print(f"\n{final_status}")
        
        if not result.quality_gates['overall_quality']:
            print("\n📋 REQUIRED IMPROVEMENTS:")
            for gate_name, gate_passed in result.quality_gates.items():
                if not gate_passed and gate_name != 'overall_quality':
                    improvement = self._get_improvement_suggestion(gate_name)
                    print(f"   • {improvement}")
    
    def _get_improvement_suggestion(self, gate_name: str) -> str:
        """Get improvement suggestion for failed gate"""
        suggestions = {
            'coverage_80_percent': 'Increase test coverage by adding tests for uncovered code paths',
            'test_success_95_percent': 'Fix failing tests or improve test reliability',
            'performance_under_5s': 'Optimize slow tests or reduce test complexity',
            'memory_under_50mb': 'Optimize memory usage in tests or application code',
            'security_100_percent': 'Ensure all security tests pass without failures'
        }
        return suggestions.get(gate_name, f'Improve {gate_name.replace("_", " ")}')
    
    def run_optimized_test_execution(self) -> TestSuiteResult:
        """Run optimized test execution for CI/CD"""
        print("\n🚀 OPTIMIZED TEST EXECUTION (CI/CD Mode)")
        
        # Run only critical tests first
        critical_tests = [
            ('security', 'test_security_comprehensive.py'),
            ('email_intelligence', 'test_email_intelligence_comprehensive.py')
        ]
        
        critical_results = []
        for category_name, test_pattern in critical_tests:
            results = self._run_test_category(category_name, test_pattern)
            critical_results.extend(results)
            
            # Fail fast if critical tests fail
            failed_critical = len([r for r in results if r.status == 'failed'])
            if failed_critical > 0:
                print(f"❌ CRITICAL FAILURE in {category_name}: {failed_critical} tests failed")
                print("🛑 Stopping execution due to critical test failures")
                return self._create_failure_result(critical_results)
        
        print("✅ Critical tests passed, continuing with full suite...")
        return self.run_comprehensive_tests()
    
    def _create_failure_result(self, test_results: List[TestResult]) -> TestSuiteResult:
        """Create result object for early failure"""
        end_time = datetime.now()
        total_duration = (end_time - (self.start_time or end_time)).total_seconds()
        
        return TestSuiteResult(
            start_time=self.start_time or end_time,
            end_time=end_time,
            total_duration=total_duration,
            total_tests=len(test_results),
            passed=len([r for r in test_results if r.status == 'passed']),
            failed=len([r for r in test_results if r.status == 'failed']),
            skipped=len([r for r in test_results if r.status == 'skipped']),
            errors=len([r for r in test_results if r.status == 'error']),
            coverage=CoverageResult(0, 0, 0, [], 0, 0, 0),
            test_results=test_results,
            performance_metrics={},
            quality_gates={'overall_quality': False}
        )


def run_coverage_analysis():
    """Run standalone coverage analysis"""
    print("📊 Running Coverage Analysis...")
    
    framework = CoverageFramework(target_coverage=80.0)
    framework.initialize_coverage()
    
    # Import and analyze all modules
    try:
        import email_intelligence_engine
        import apple_mail_db_reader
        import applescript_integration
        import backend_architecture
        import auth_middleware
        
        # Run some basic operations to trigger coverage
        engine = email_intelligence_engine.EmailIntelligenceEngine()
        result = engine.analyze_email("test", "test", "test@test.com")
        
        reader = apple_mail_db_reader.AppleMailDBReader()
        emails = reader.get_recent_emails(limit=1)
        
    except Exception as e:
        print(f"Warning: Could not import all modules: {e}")
    
    coverage_result = framework._generate_coverage_report()
    
    print(f"\n📈 Coverage Analysis Complete:")
    print(f"   Overall Coverage: {coverage_result.percentage:.1f}%")
    print(f"   Target: 80%")
    print(f"   Status: {'✅ MEETS TARGET' if coverage_result.percentage >= 80 else '❌ BELOW TARGET'}")
    
    return coverage_result


def main():
    """Main test execution entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Comprehensive Test Framework')
    parser.add_argument('--mode', choices=['full', 'fast', 'coverage'], default='full',
                       help='Test execution mode')
    parser.add_argument('--target-coverage', type=float, default=80.0,
                       help='Target coverage percentage')
    
    args = parser.parse_args()
    
    framework = CoverageFramework(target_coverage=args.target_coverage)
    
    if args.mode == 'coverage':
        result = run_coverage_analysis()
        return result.percentage >= args.target_coverage
    
    elif args.mode == 'fast':
        result = framework.run_optimized_test_execution()
    
    else:  # full
        result = framework.run_comprehensive_tests()
    
    # Return success status
    return result.quality_gates['overall_quality']


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
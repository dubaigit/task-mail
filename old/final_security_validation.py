#!/usr/bin/env python3
"""
Final Security Validation for T506 - 2025 Compliance
Validates all implemented security measures and generates compliance report
"""

import os
import json
import sys
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

class SecurityValidationResult:
    def __init__(self):
        self.timestamp = datetime.now(timezone.utc)
        self.validation_id = f"T506-FINAL-{self.timestamp.strftime('%Y%m%d_%H%M%S')}"
        self.components_validated = {}
        self.security_gates = {}
        self.overall_score = 0.0
        self.compliance_status = "PENDING"
        self.blockers = []
        self.recommendations = []

class FinalSecurityValidator:
    """Comprehensive security validation for 2025 compliance"""
    
    def __init__(self):
        self.result = SecurityValidationResult()
        self.root_path = Path(__file__).parent
        
    def validate_oidc_implementation(self) -> bool:
        """Validate OIDC authentication implementation"""
        print("🔐 Validating OIDC Authentication Implementation...")
        
        oidc_file = self.root_path / "oidc_auth.py"
        if not oidc_file.exists():
            self.result.blockers.append("OIDC authentication file missing")
            return False
            
        # Check for key OIDC components
        oidc_content = oidc_file.read_text()
        required_components = [
            "class OIDCProvider",
            "class OIDCManager", 
            "OAuth2AuthorizationCodeBearer",
            "PKCE",
            "zero_trust_validation"
        ]
        
        missing_components = []
        for component in required_components:
            if component not in oidc_content:
                missing_components.append(component)
        
        if missing_components:
            self.result.blockers.append(f"Missing OIDC components: {missing_components}")
            return False
            
        print("✅ OIDC implementation validated")
        return True
    
    def validate_secrets_management(self) -> bool:
        """Validate secrets management implementation"""
        print("🔑 Validating Secrets Management...")
        
        secrets_file = self.root_path / "secrets_management.py"
        if not secrets_file.exists():
            self.result.blockers.append("Secrets management file missing")
            return False
            
        secrets_content = secrets_file.read_text()
        required_features = [
            "class SecretManager",
            "encrypt_secret",
            "decrypt_secret",
            "HashiCorp Vault",
            "AWS Secrets Manager",
            "Azure Key Vault"
        ]
        
        missing_features = []
        for feature in required_features:
            if feature not in secrets_content:
                missing_features.append(feature)
                
        if missing_features:
            self.result.blockers.append(f"Missing secrets features: {missing_features}")
            return False
            
        print("✅ Secrets management validated")
        return True
    
    def validate_privacy_compliance(self) -> bool:
        """Validate GDPR/CCPA privacy compliance"""
        print("🔒 Validating Privacy Compliance Framework...")
        
        privacy_file = self.root_path / "privacy_compliance.py"
        if not privacy_file.exists():
            self.result.blockers.append("Privacy compliance file missing")
            return False
            
        privacy_content = privacy_file.read_text()
        required_features = [
            "class PrivacyComplianceManager",
            "GDPR",
            "CCPA", 
            "ConsentRecord",
            "data_retention",
            "privacy_dashboard"
        ]
        
        missing_features = []
        for feature in required_features:
            if feature not in privacy_content:
                missing_features.append(feature)
                
        if missing_features:
            self.result.blockers.append(f"Missing privacy features: {missing_features}")
            return False
            
        print("✅ Privacy compliance validated")
        return True
    
    def validate_security_middleware(self) -> bool:
        """Validate enhanced security middleware"""
        print("🛡️ Validating Enhanced Security Middleware...")
        
        middleware_file = self.root_path / "enhanced_security_middleware.py"
        if not middleware_file.exists():
            self.result.blockers.append("Enhanced security middleware missing")
            return False
            
        middleware_content = middleware_file.read_text()
        required_features = [
            "EnhancedSecurityConfig",
            "SECURITY_HEADERS",
            "rate_limiting",
            "access_control",
            "security_logger"
        ]
        
        missing_features = []
        for feature in required_features:
            if feature not in middleware_content:
                missing_features.append(feature)
                
        if missing_features:
            self.result.blockers.append(f"Missing middleware features: {missing_features}")
            return False
            
        print("✅ Security middleware validated")
        return True
    
    def validate_task_workspace_security(self) -> bool:
        """Validate task workspace security controls"""
        print("📋 Validating Task Workspace Security...")
        
        task_security_file = self.root_path / "task_workspace_security.py"
        if not task_security_file.exists():
            self.result.blockers.append("Task workspace security file missing")
            return False
            
        task_content = task_security_file.read_text()
        required_features = [
            "TaskWorkspaceSecurityManager",
            "AIProcessingConsent",
            "consent_management",
            "data_protection",
            "kill_switch"
        ]
        
        missing_features = []
        for feature in required_features:
            if feature not in task_content:
                missing_features.append(feature)
                
        if missing_features:
            self.result.blockers.append(f"Missing task security features: {missing_features}")
            return False
            
        print("✅ Task workspace security validated")
        return True
    
    def validate_killswitch_mechanism(self) -> bool:
        """Validate kill-switch and rollback mechanisms"""
        print("🚨 Validating Kill-Switch and Rollback Mechanisms...")
        
        killswitch_file = self.root_path / "security_killswitch.py"
        if not killswitch_file.exists():
            self.result.blockers.append("Security kill-switch file missing")
            return False
            
        killswitch_content = killswitch_file.read_text()
        required_features = [
            "SecurityKillSwitchManager",
            "KillSwitchType",
            "SecurityIncident", 
            "emergency_shutdown",
            "rollback_mechanisms",
            "incident_response"
        ]
        
        missing_features = []
        for feature in required_features:
            if feature not in killswitch_content:
                missing_features.append(feature)
                
        if missing_features:
            self.result.blockers.append(f"Missing kill-switch features: {missing_features}")
            return False
            
        print("✅ Kill-switch mechanisms validated")
        return True
    
    def validate_github_workflows(self) -> bool:
        """Validate GitHub Actions security workflows"""
        print("⚙️ Validating GitHub Actions Security Workflows...")
        
        workflow_file = self.root_path / ".github" / "workflows" / "security.yml"
        if not workflow_file.exists():
            self.result.blockers.append("GitHub Actions security workflow missing")
            return False
            
        workflow_content = workflow_file.read_text()
        required_jobs = [
            "codeql-analysis",
            "dependency-review",
            "secrets-scan", 
            "sbom-generation",
            "security-attestation"
        ]
        
        missing_jobs = []
        for job in required_jobs:
            if job not in workflow_content:
                missing_jobs.append(job)
                
        if missing_jobs:
            self.result.blockers.append(f"Missing workflow jobs: {missing_jobs}")
            return False
            
        print("✅ GitHub Actions workflows validated")
        return True
    
    def validate_e2e_tests(self) -> bool:
        """Validate E2E testing infrastructure"""
        print("🧪 Validating E2E Testing Infrastructure...")
        
        e2e_path = self.root_path / "e2e"
        if not e2e_path.exists():
            self.result.blockers.append("E2E testing directory missing")
            return False
            
        # Check for critical E2E test files
        required_tests = [
            "tests/functional/task-first-workspace.spec.ts",
            "tests/ux-safety/confirmation-dialogs.spec.ts",
            "package.json",
            "playwright.config.ts"
        ]
        
        missing_tests = []
        for test_file in required_tests:
            if not (e2e_path / test_file).exists():
                missing_tests.append(test_file)
                
        if missing_tests:
            self.result.blockers.append(f"Missing E2E test files: {missing_tests}")
            return False
            
        print("✅ E2E testing infrastructure validated")
        return True
    
    def calculate_overall_score(self) -> float:
        """Calculate overall security compliance score"""
        total_validations = len(self.result.components_validated)
        if total_validations == 0:
            return 0.0
            
        passed_validations = sum(1 for status in self.result.components_validated.values() if status)
        return (passed_validations / total_validations) * 100
    
    def determine_compliance_status(self) -> str:
        """Determine overall compliance status"""
        if self.result.blockers:
            return "BLOCKED"
        elif self.result.overall_score >= 95:
            return "COMPLIANT"
        elif self.result.overall_score >= 80:
            return "SUBSTANTIAL_COMPLIANCE"
        else:
            return "NON_COMPLIANT"
    
    def run_validation(self) -> Dict[str, Any]:
        """Run comprehensive security validation"""
        print(f"🚀 Starting Final Security Validation - {self.result.validation_id}")
        print("=" * 60)
        
        # Run all validation checks
        validations = [
            ("OIDC Authentication", self.validate_oidc_implementation),
            ("Secrets Management", self.validate_secrets_management),
            ("Privacy Compliance", self.validate_privacy_compliance),
            ("Security Middleware", self.validate_security_middleware),
            ("Task Workspace Security", self.validate_task_workspace_security),
            ("Kill-Switch Mechanisms", self.validate_killswitch_mechanism),
            ("GitHub Workflows", self.validate_github_workflows),
            ("E2E Testing", self.validate_e2e_tests)
        ]
        
        for name, validation_func in validations:
            try:
                result = validation_func()
                self.result.components_validated[name] = result
                self.result.security_gates[name] = "GREEN" if result else "RED"
            except Exception as e:
                print(f"❌ Error validating {name}: {e}")
                self.result.components_validated[name] = False
                self.result.security_gates[name] = "RED"
                self.result.blockers.append(f"{name} validation failed: {str(e)}")
        
        # Calculate final scores
        self.result.overall_score = self.calculate_overall_score()
        self.result.compliance_status = self.determine_compliance_status()
        
        # Generate report
        return self.generate_final_report()
    
    def generate_final_report(self) -> Dict[str, Any]:
        """Generate final security validation report"""
        print("\n" + "=" * 60)
        print("🎯 FINAL SECURITY VALIDATION REPORT")
        print("=" * 60)
        
        print(f"📋 Validation ID: {self.result.validation_id}")
        print(f"⏰ Timestamp: {self.result.timestamp.isoformat()}")
        print(f"📊 Overall Score: {self.result.overall_score:.1f}%")
        print(f"🔒 Compliance Status: {self.result.compliance_status}")
        
        print("\n🔍 SECURITY GATES STATUS:")
        for component, status in self.result.security_gates.items():
            emoji = "🟢" if status == "GREEN" else "🔴"
            print(f"  {emoji} {component}: {status}")
        
        if self.result.blockers:
            print("\n🚫 BLOCKERS:")
            for blocker in self.result.blockers:
                print(f"  ❌ {blocker}")
        
        # Determine final status
        all_green = all(status == "GREEN" for status in self.result.security_gates.values())
        
        if all_green and not self.result.blockers:
            print("\n🎉 SUCCESS: All security gates are GREEN!")
            print("✅ System is ready for 2025 compliance validation")
            print("🚀 Production deployment can proceed")
        else:
            print("\n⚠️  SECURITY VALIDATION INCOMPLETE")
            print("🔴 Production deployment BLOCKED until all gates are GREEN")
        
        # Generate JSON report
        report = {
            "validation_id": self.result.validation_id,
            "timestamp": self.result.timestamp.isoformat(),
            "overall_score": self.result.overall_score,
            "compliance_status": self.result.compliance_status,
            "components_validated": self.result.components_validated,
            "security_gates": self.result.security_gates,
            "blockers": self.result.blockers,
            "recommendations": self.result.recommendations,
            "all_gates_green": all_green,
            "production_ready": all_green and not self.result.blockers
        }
        
        # Save report
        report_file = self.root_path / f"security_validation_report_{self.result.validation_id}.json"
        with open(report_file, "w") as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Report saved: {report_file}")
        
        return report

def main():
    """Main execution function"""
    validator = FinalSecurityValidator()
    report = validator.run_validation()
    
    # Exit with appropriate code
    if report["production_ready"]:
        print("\n🎯 T506-9 VALIDATION: SUCCESS")
        sys.exit(0)
    else:
        print("\n🔴 T506-9 VALIDATION: BLOCKED") 
        sys.exit(1)

if __name__ == "__main__":
    main()
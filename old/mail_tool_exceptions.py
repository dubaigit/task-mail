#!/usr/bin/env python3
"""
Custom Exception Hierarchy for BackgroundMailTool

Provides comprehensive error types for mail operations with detailed context
and error reporting capabilities.
"""

import traceback
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class ErrorContext:
    """Context information for error reporting."""
    operation: str
    timestamp: datetime = field(default_factory=datetime.now)
    parameters: Dict[str, Any] = field(default_factory=dict)
    system_info: Dict[str, Any] = field(default_factory=dict)
    stack_trace: Optional[str] = None
    retry_count: int = 0
    
    def __post_init__(self):
        """Initialize error context with stack trace."""
        if self.stack_trace is None:
            self.stack_trace = traceback.format_stack()


class MailToolError(Exception):
    """Base exception for all mail tool operations.
    
    Provides common error handling functionality and context preservation.
    """
    
    def __init__(
        self, 
        message: str, 
        context: Optional[ErrorContext] = None,
        original_error: Optional[Exception] = None,
        error_code: Optional[str] = None,
        recoverable: bool = True
    ):
        """Initialize base mail tool error.
        
        Args:
            message: Human-readable error description
            context: Error context information
            original_error: Original exception that caused this error
            error_code: Unique error code for categorization
            recoverable: Whether this error can be retried
        """
        super().__init__(message)
        self.message = message
        self.context = context or ErrorContext(operation="unknown")
        self.original_error = original_error
        self.error_code = error_code or self.__class__.__name__
        self.recoverable = recoverable
        self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for serialization."""
        return {
            "error_type": self.__class__.__name__,
            "error_code": self.error_code,
            "message": self.message,
            "recoverable": self.recoverable,
            "timestamp": self.timestamp.isoformat(),
            "context": {
                "operation": self.context.operation,
                "timestamp": self.context.timestamp.isoformat(),
                "parameters": self.context.parameters,
                "system_info": self.context.system_info,
                "retry_count": self.context.retry_count
            },
            "original_error": str(self.original_error) if self.original_error else None,
            "stack_trace": self.context.stack_trace[-3:] if self.context.stack_trace else None
        }
    
    def __str__(self) -> str:
        """String representation with context."""
        base = f"{self.error_code}: {self.message}"
        if self.context.operation != "unknown":
            base += f" (Operation: {self.context.operation})"
        if self.original_error:
            base += f" [Caused by: {self.original_error}]"
        return base


class AppleScriptError(MailToolError):
    """AppleScript execution errors."""
    
    def __init__(
        self, 
        message: str, 
        script_content: Optional[str] = None,
        return_code: Optional[int] = None,
        stderr_output: Optional[str] = None,
        **kwargs
    ):
        """Initialize AppleScript error.
        
        Args:
            message: Error description
            script_content: The AppleScript that failed
            return_code: Process return code
            stderr_output: Error output from process
            **kwargs: Additional arguments for base class
        """
        super().__init__(message, **kwargs)
        self.script_content = script_content
        self.return_code = return_code
        self.stderr_output = stderr_output
        
        if self.context:
            self.context.system_info.update({
                "script_length": len(script_content) if script_content else 0,
                "return_code": return_code,
                "stderr_present": bool(stderr_output)
            })


class AppleScriptTimeoutError(AppleScriptError):
    """AppleScript execution timeout."""
    
    def __init__(self, timeout_seconds: int, **kwargs):
        """Initialize timeout error.
        
        Args:
            timeout_seconds: Timeout duration that was exceeded
            **kwargs: Additional arguments for base class
        """
        message = f"AppleScript execution timed out after {timeout_seconds} seconds"
        super().__init__(message, **kwargs)
        self.timeout_seconds = timeout_seconds
        self.recoverable = True  # Timeouts are usually recoverable


class AppleScriptSyntaxError(AppleScriptError):
    """AppleScript syntax or compilation errors."""
    
    def __init__(self, syntax_details: Optional[str] = None, **kwargs):
        """Initialize syntax error.
        
        Args:
            syntax_details: Details about the syntax error
            **kwargs: Additional arguments for base class
        """
        message = "AppleScript syntax error"
        if syntax_details:
            message += f": {syntax_details}"
        super().__init__(message, **kwargs)
        self.syntax_details = syntax_details
        self.recoverable = False  # Syntax errors are not recoverable without code changes


class AppleScriptPermissionError(AppleScriptError):
    """AppleScript permission or access errors."""
    
    def __init__(self, required_permission: Optional[str] = None, **kwargs):
        """Initialize permission error.
        
        Args:
            required_permission: The permission that was denied
            **kwargs: Additional arguments for base class
        """
        message = "AppleScript permission denied"
        if required_permission:
            message += f" for {required_permission}"
        super().__init__(message, **kwargs)
        self.required_permission = required_permission
        self.recoverable = False  # Permission errors require user intervention


class MailAppError(MailToolError):
    """Mail application specific errors."""
    
    def __init__(
        self, 
        message: str, 
        mail_app_state: Optional[str] = None,
        suggested_action: Optional[str] = None,
        **kwargs
    ):
        """Initialize Mail app error.
        
        Args:
            message: Error description
            mail_app_state: Current state of Mail app
            suggested_action: Suggested action to resolve the issue
            **kwargs: Additional arguments for base class
        """
        super().__init__(message, **kwargs)
        self.mail_app_state = mail_app_state
        self.suggested_action = suggested_action


class MailAppNotRunningError(MailAppError):
    """Mail application is not running."""
    
    def __init__(self, **kwargs):
        """Initialize Mail app not running error."""
        super().__init__(
            "Mail application is not running or not accessible",
            suggested_action="Start Mail.app and grant necessary permissions",
            **kwargs
        )
        self.recoverable = True


class MailAppBusyError(MailAppError):
    """Mail application is busy or unresponsive."""
    
    def __init__(self, **kwargs):
        """Initialize Mail app busy error."""
        super().__init__(
            "Mail application is busy or unresponsive",
            suggested_action="Wait for Mail.app to complete current operations",
            **kwargs
        )
        self.recoverable = True


class MailDataError(MailToolError):
    """Mail data parsing or validation errors."""
    
    def __init__(
        self, 
        message: str, 
        invalid_data: Optional[str] = None,
        expected_format: Optional[str] = None,
        **kwargs
    ):
        """Initialize mail data error.
        
        Args:
            message: Error description
            invalid_data: The data that caused the error (truncated for security)
            expected_format: Expected data format
            **kwargs: Additional arguments for base class
        """
        super().__init__(message, **kwargs)
        # Truncate sensitive data for security
        self.invalid_data = invalid_data[:100] + "..." if invalid_data and len(invalid_data) > 100 else invalid_data
        self.expected_format = expected_format


class MailParsingError(MailDataError):
    """Email data parsing errors."""
    
    def __init__(self, parsing_stage: Optional[str] = None, **kwargs):
        """Initialize parsing error.
        
        Args:
            parsing_stage: The stage where parsing failed
            **kwargs: Additional arguments for base class
        """
        message = "Failed to parse email data"
        if parsing_stage:
            message += f" at stage: {parsing_stage}"
        super().__init__(message, **kwargs)
        self.parsing_stage = parsing_stage


class MailValidationError(MailDataError):
    """Email data validation errors."""
    
    def __init__(
        self, 
        validation_rule: str, 
        field_name: Optional[str] = None,
        **kwargs
    ):
        """Initialize validation error.
        
        Args:
            validation_rule: The validation rule that failed
            field_name: The field that failed validation
            **kwargs: Additional arguments for base class
        """
        message = f"Email data validation failed: {validation_rule}"
        if field_name:
            message += f" (Field: {field_name})"
        super().__init__(message, **kwargs)
        self.validation_rule = validation_rule
        self.field_name = field_name


class ResourceError(MailToolError):
    """Resource-related errors."""
    
    def __init__(
        self, 
        message: str, 
        resource_type: Optional[str] = None,
        resource_limit: Optional[str] = None,
        current_usage: Optional[str] = None,
        **kwargs
    ):
        """Initialize resource error.
        
        Args:
            message: Error description
            resource_type: Type of resource (memory, disk, network, etc.)
            resource_limit: Resource limit that was exceeded
            current_usage: Current resource usage
            **kwargs: Additional arguments for base class
        """
        super().__init__(message, **kwargs)
        self.resource_type = resource_type
        self.resource_limit = resource_limit
        self.current_usage = current_usage


class MemoryError(ResourceError):
    """Memory-related errors."""
    
    def __init__(self, memory_limit: Optional[str] = None, **kwargs):
        """Initialize memory error."""
        super().__init__(
            "Insufficient memory for operation",
            resource_type="memory",
            resource_limit=memory_limit,
            **kwargs
        )


class NetworkError(MailToolError):
    """Network-related errors."""
    
    def __init__(
        self, 
        message: str, 
        network_operation: Optional[str] = None,
        server_info: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        """Initialize network error.
        
        Args:
            message: Error description
            network_operation: The network operation that failed
            server_info: Information about the server/endpoint
            **kwargs: Additional arguments for base class
        """
        super().__init__(message, **kwargs)
        self.network_operation = network_operation
        self.server_info = server_info or {}


class ConfigurationError(MailToolError):
    """Configuration-related errors."""
    
    def __init__(
        self, 
        message: str, 
        config_section: Optional[str] = None,
        config_key: Optional[str] = None,
        expected_value: Optional[str] = None,
        **kwargs
    ):
        """Initialize configuration error.
        
        Args:
            message: Error description
            config_section: Configuration section with error
            config_key: Configuration key with error
            expected_value: Expected configuration value
            **kwargs: Additional arguments for base class
        """
        super().__init__(message, **kwargs)
        self.config_section = config_section
        self.config_key = config_key
        self.expected_value = expected_value
        self.recoverable = False  # Configuration errors require manual intervention


class BatchOperationError(MailToolError):
    """Batch operation errors with aggregated error information."""
    
    def __init__(
        self, 
        message: str, 
        individual_errors: List[MailToolError],
        successful_operations: int = 0,
        total_operations: int = 0,
        **kwargs
    ):
        """Initialize batch operation error.
        
        Args:
            message: Error description
            individual_errors: List of individual errors from batch operation
            successful_operations: Number of successful operations
            total_operations: Total number of operations attempted
            **kwargs: Additional arguments for base class
        """
        super().__init__(message, **kwargs)
        self.individual_errors = individual_errors
        self.successful_operations = successful_operations
        self.total_operations = total_operations
        self.failure_rate = (len(individual_errors) / total_operations) if total_operations > 0 else 0
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get summary of batch operation errors."""
        error_types = {}
        for error in self.individual_errors:
            error_type = error.__class__.__name__
            error_types[error_type] = error_types.get(error_type, 0) + 1
        
        return {
            "total_errors": len(self.individual_errors),
            "successful_operations": self.successful_operations,
            "total_operations": self.total_operations,
            "failure_rate": self.failure_rate,
            "error_types": error_types,
            "sample_errors": [error.to_dict() for error in self.individual_errors[:3]]
        }


class CriticalError(MailToolError):
    """Critical errors that require immediate attention."""
    
    def __init__(self, message: str, impact_assessment: Optional[str] = None, **kwargs):
        """Initialize critical error.
        
        Args:
            message: Error description
            impact_assessment: Assessment of the error's impact
            **kwargs: Additional arguments for base class
        """
        super().__init__(message, **kwargs)
        self.impact_assessment = impact_assessment
        self.recoverable = False  # Critical errors typically require manual intervention


# Convenience functions for creating common errors
def create_applescript_error(
    message: str, 
    script: Optional[str] = None,
    return_code: Optional[int] = None,
    stderr: Optional[str] = None,
    context: Optional[ErrorContext] = None
) -> AppleScriptError:
    """Create a standardized AppleScript error."""
    return AppleScriptError(
        message=message,
        script_content=script,
        return_code=return_code,
        stderr_output=stderr,
        context=context
    )


def create_timeout_error(
    timeout_seconds: int,
    operation: str,
    context: Optional[ErrorContext] = None
) -> AppleScriptTimeoutError:
    """Create a standardized timeout error."""
    if context is None:
        context = ErrorContext(operation=operation)
    return AppleScriptTimeoutError(
        timeout_seconds=timeout_seconds,
        context=context
    )


def create_validation_error(
    field_name: str,
    validation_rule: str,
    invalid_value: Any,
    context: Optional[ErrorContext] = None
) -> MailValidationError:
    """Create a standardized validation error."""
    return MailValidationError(
        validation_rule=validation_rule,
        field_name=field_name,
        invalid_data=str(invalid_value),
        context=context
    )
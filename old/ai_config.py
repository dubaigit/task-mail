#!/usr/bin/env python3
"""
AI Configuration Module
========================

Centralized configuration for AI models, prompts, and limits.
Manages all AI-related settings for the production system.
"""

import json
import os
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path

class ModelTier(Enum):
    """Model tiers for different use cases"""
    NANO = "nano"          # Ultra-fast, low cost
    MINI = "mini"          # Balanced performance
    STANDARD = "standard"  # High quality
    LARGE = "large"        # Maximum capability

@dataclass
class ModelConfig:
    """Configuration for a specific AI model"""
    name: str
    tier: ModelTier
    max_tokens: int
    context_window: int
    cost_per_1k_input: float
    cost_per_1k_output: float
    requests_per_minute: int
    tokens_per_minute: int
    best_for: List[str]
    temperature_range: tuple = (0.0, 1.0)
    
@dataclass
class PromptConfig:
    """Configuration for prompt management"""
    max_examples: int = 3
    include_few_shot: bool = True
    optimize_context: bool = True
    sanitize_inputs: bool = True
    cache_prompts: bool = True
    version_control: bool = True
    
@dataclass
class BatchConfig:
    """Configuration for batch processing"""
    enabled: bool = True
    default_batch_size: int = 10
    max_batch_size: int = 50
    batch_timeout_ms: int = 500
    priority_levels: int = 10
    deduplication: bool = True
    
@dataclass
class CostConfig:
    """Configuration for cost management"""
    daily_budget: float = 100.0
    alert_threshold: float = 0.8
    auto_fallback: bool = True
    track_by_user: bool = True
    optimize_for_cost: bool = True
    
@dataclass
class PerformanceConfig:
    """Configuration for performance optimization"""
    cache_enabled: bool = True
    cache_ttl_seconds: int = 3600
    max_cache_size_mb: int = 100
    parallel_requests: int = 5
    timeout_seconds: int = 30
    retry_attempts: int = 3
    
class AIConfig:
    """
    Central AI configuration management system.
    Handles all AI-related settings for production scale.
    """
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or "ai_config.json"
        self.config = self._load_config()
        
        # Initialize model configurations
        self.models = self._setup_models()
        
        # Initialize subsystem configurations
        self.prompts = PromptConfig(**self.config.get("prompts", {}))
        self.batch = BatchConfig(**self.config.get("batch", {}))
        self.cost = CostConfig(**self.config.get("cost", {}))
        self.performance = PerformanceConfig(**self.config.get("performance", {}))
        
        # Runtime state
        self.daily_cost = 0.0
        self.request_count = 0
        self.token_count = 0
        
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        
        default_config = {
            "models": {
                "gpt-5-nano": {
                    "enabled": True,
                    "primary_use": ["classification", "extraction", "tagging"],
                    "fallback": "gpt-4-turbo"
                },
                "gpt-5-mini": {
                    "enabled": True,
                    "primary_use": ["drafts", "summaries", "analysis"],
                    "fallback": "gpt-4"
                }
            },
            "prompts": {
                "max_examples": 3,
                "include_few_shot": True,
                "optimize_context": True,
                "sanitize_inputs": True,
                "cache_prompts": True,
                "version_control": True
            },
            "batch": {
                "enabled": True,
                "default_batch_size": 10,
                "max_batch_size": 50,
                "batch_timeout_ms": 500,
                "priority_levels": 10,
                "deduplication": True
            },
            "cost": {
                "daily_budget": 100.0,
                "alert_threshold": 0.8,
                "auto_fallback": True,
                "track_by_user": True,
                "optimize_for_cost": True
            },
            "performance": {
                "cache_enabled": True,
                "cache_ttl_seconds": 3600,
                "max_cache_size_mb": 100,
                "parallel_requests": 5,
                "timeout_seconds": 30,
                "retry_attempts": 3
            },
            "features": {
                "smart_routing": True,
                "adaptive_prompting": True,
                "continuous_learning": True,
                "auto_scaling": True,
                "monitoring": True
            },
            "security": {
                "prompt_injection_protection": True,
                "pii_detection": True,
                "audit_logging": True,
                "encryption_at_rest": False
            }
        }
        
        # Try to load user config
        if Path(self.config_path).exists():
            try:
                with open(self.config_path, 'r') as f:
                    user_config = json.load(f)
                    # Deep merge with defaults
                    return self._deep_merge(default_config, user_config)
            except Exception as e:
                print(f"Warning: Could not load config from {self.config_path}: {e}")
        
        return default_config
    
    def _deep_merge(self, default: Dict, override: Dict) -> Dict:
        """Deep merge two dictionaries"""
        
        result = default.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        
        return result
    
    def _setup_models(self) -> Dict[str, ModelConfig]:
        """Setup model configurations"""
        
        models = {
            "gpt-5-nano-2025-08-07": ModelConfig(
                name="gpt-5-nano-2025-08-07",
                tier=ModelTier.NANO,
                max_tokens=4000,
                context_window=8000,
                cost_per_1k_input=0.002,
                cost_per_1k_output=0.004,
                requests_per_minute=100,
                tokens_per_minute=150000,
                best_for=["classification", "extraction", "tagging", "quick_analysis"],
                temperature_range=(0.0, 0.5)
            ),
            "gpt-5-mini-2025-08-07": ModelConfig(
                name="gpt-5-mini-2025-08-07",
                tier=ModelTier.MINI,
                max_tokens=8000,
                context_window=16000,
                cost_per_1k_input=0.01,
                cost_per_1k_output=0.02,
                requests_per_minute=60,
                tokens_per_minute=90000,
                best_for=["drafts", "summaries", "detailed_analysis", "generation"],
                temperature_range=(0.0, 0.7)
            ),
            # Fallback models
            "gpt-4-turbo": ModelConfig(
                name="gpt-4-0125-preview",
                tier=ModelTier.STANDARD,
                max_tokens=4096,
                context_window=128000,
                cost_per_1k_input=0.01,
                cost_per_1k_output=0.03,
                requests_per_minute=60,
                tokens_per_minute=60000,
                best_for=["complex_analysis", "reasoning", "fallback"],
                temperature_range=(0.0, 1.0)
            )
        }
        
        return models
    
    def get_model_for_task(self, task_type: str) -> ModelConfig:
        """
        Get the best model for a specific task type.
        
        Args:
            task_type: Type of task (classification, draft, etc.)
            
        Returns:
            Optimal model configuration for the task
        """
        
        # Task to model mapping
        task_model_map = {
            "classification": "gpt-5-nano-2025-08-07",
            "extraction": "gpt-5-nano-2025-08-07",
            "tagging": "gpt-5-nano-2025-08-07",
            "key_points": "gpt-5-nano-2025-08-07",
            "draft": "gpt-5-mini-2025-08-07",
            "summary": "gpt-5-mini-2025-08-07",
            "analysis": "gpt-5-mini-2025-08-07",
            "generation": "gpt-5-mini-2025-08-07"
        }
        
        model_name = task_model_map.get(task_type, "gpt-5-nano-2025-08-07")
        
        # Check if model is enabled
        if self.config["models"].get(model_name.split("-2025")[0], {}).get("enabled", True):
            return self.models[model_name]
        
        # Return fallback model
        fallback_name = self.config["models"].get(model_name.split("-2025")[0], {}).get("fallback")
        if fallback_name and fallback_name in self.models:
            return self.models[fallback_name]
        
        # Default to nano model
        return self.models["gpt-5-nano-2025-08-07"]
    
    def should_use_batch(self, request_count: int, priority: int) -> bool:
        """
        Determine if batch processing should be used.
        
        Args:
            request_count: Number of pending requests
            priority: Request priority (1-10)
            
        Returns:
            Whether to use batch processing
        """
        
        if not self.batch.enabled:
            return False
        
        # High priority requests may skip batching
        if priority >= 9:
            return False
        
        # Use batching for multiple requests
        if request_count >= 3:
            return True
        
        # Use batching for low priority even with few requests
        if priority <= 3 and request_count >= 1:
            return True
        
        return False
    
    def check_cost_limit(self, estimated_cost: float) -> bool:
        """
        Check if request is within cost limits.
        
        Args:
            estimated_cost: Estimated cost for the request
            
        Returns:
            Whether the request is within budget
        """
        
        if self.daily_cost + estimated_cost > self.cost.daily_budget:
            if self.cost.auto_fallback:
                return False  # Will trigger fallback
            else:
                raise ValueError(f"Daily budget exceeded: ${self.daily_cost:.2f} / ${self.cost.daily_budget:.2f}")
        
        # Check alert threshold
        if self.daily_cost + estimated_cost > self.cost.daily_budget * self.cost.alert_threshold:
            print(f"Warning: Approaching daily budget limit: ${self.daily_cost:.2f} / ${self.cost.daily_budget:.2f}")
        
        return True
    
    def update_usage(self, tokens: int, cost: float):
        """Update usage statistics"""
        
        self.token_count += tokens
        self.daily_cost += cost
        self.request_count += 1
    
    def get_optimization_settings(self) -> Dict[str, Any]:
        """Get current optimization settings"""
        
        return {
            "cost_optimization": {
                "enabled": self.cost.optimize_for_cost,
                "daily_budget": self.cost.daily_budget,
                "current_spend": self.daily_cost,
                "budget_remaining": self.cost.daily_budget - self.daily_cost
            },
            "performance_optimization": {
                "cache_enabled": self.performance.cache_enabled,
                "parallel_requests": self.performance.parallel_requests,
                "batch_enabled": self.batch.enabled,
                "batch_size": self.batch.default_batch_size
            },
            "smart_features": {
                "smart_routing": self.config["features"].get("smart_routing", True),
                "adaptive_prompting": self.config["features"].get("adaptive_prompting", True),
                "continuous_learning": self.config["features"].get("continuous_learning", True)
            }
        }
    
    def get_model_recommendation(
        self,
        task_type: str,
        urgency: str,
        content_length: int
    ) -> Dict[str, Any]:
        """
        Get model recommendation based on task characteristics.
        
        Args:
            task_type: Type of task
            urgency: Urgency level (low, medium, high, critical)
            content_length: Length of content to process
            
        Returns:
            Model recommendation with reasoning
        """
        
        base_model = self.get_model_for_task(task_type)
        
        # Adjust based on urgency
        if urgency == "critical":
            # Use fastest model for critical tasks
            recommended_model = self.models["gpt-5-nano-2025-08-07"]
            reasoning = "Using fastest model for critical urgency"
        elif urgency == "low" and self.cost.optimize_for_cost:
            # Use most cost-effective model for low urgency
            recommended_model = base_model
            reasoning = "Using cost-optimized model for low urgency"
        else:
            recommended_model = base_model
            reasoning = f"Using standard model for {task_type}"
        
        # Check context window limits
        estimated_tokens = content_length // 4  # Rough estimate
        if estimated_tokens > recommended_model.context_window * 0.8:
            # Need larger context window
            for model in self.models.values():
                if model.context_window > estimated_tokens * 1.2:
                    recommended_model = model
                    reasoning = f"Switched to {model.name} for larger context window"
                    break
        
        return {
            "model": recommended_model.name,
            "config": asdict(recommended_model),
            "reasoning": reasoning,
            "estimated_cost": self._estimate_cost(recommended_model, estimated_tokens),
            "estimated_latency_ms": self._estimate_latency(recommended_model, task_type)
        }
    
    def _estimate_cost(self, model: ModelConfig, estimated_tokens: int) -> float:
        """Estimate cost for a request"""
        
        # Assume 70% input, 30% output token distribution
        input_tokens = int(estimated_tokens * 0.7)
        output_tokens = int(estimated_tokens * 0.3)
        
        input_cost = (input_tokens / 1000) * model.cost_per_1k_input
        output_cost = (output_tokens / 1000) * model.cost_per_1k_output
        
        return input_cost + output_cost
    
    def _estimate_latency(self, model: ModelConfig, task_type: str) -> int:
        """Estimate latency in milliseconds"""
        
        base_latency = {
            ModelTier.NANO: 200,
            ModelTier.MINI: 500,
            ModelTier.STANDARD: 1000,
            ModelTier.LARGE: 2000
        }
        
        task_multiplier = {
            "classification": 1.0,
            "extraction": 1.2,
            "draft": 1.5,
            "summary": 1.3,
            "analysis": 1.8
        }
        
        latency = base_latency.get(model.tier, 1000)
        multiplier = task_multiplier.get(task_type, 1.0)
        
        return int(latency * multiplier)
    
    def save_config(self):
        """Save current configuration to file"""
        
        config_data = {
            "models": {
                model_name: {
                    "enabled": True,
                    "config": asdict(model)
                }
                for model_name, model in self.models.items()
            },
            "prompts": asdict(self.prompts),
            "batch": asdict(self.batch),
            "cost": asdict(self.cost),
            "performance": asdict(self.performance),
            "features": self.config.get("features", {}),
            "security": self.config.get("security", {}),
            "usage_stats": {
                "daily_cost": self.daily_cost,
                "request_count": self.request_count,
                "token_count": self.token_count
            }
        }
        
        with open(self.config_path, 'w') as f:
            json.dump(config_data, f, indent=2, default=str)
    
    def reset_daily_usage(self):
        """Reset daily usage counters"""
        
        self.daily_cost = 0.0
        self.request_count = 0
        self.token_count = 0
    
    def get_status(self) -> Dict[str, Any]:
        """Get current system status"""
        
        return {
            "models_available": list(self.models.keys()),
            "daily_usage": {
                "cost": f"${self.daily_cost:.2f}",
                "requests": self.request_count,
                "tokens": self.token_count,
                "budget_remaining": f"${self.cost.daily_budget - self.daily_cost:.2f}"
            },
            "optimization": self.get_optimization_settings(),
            "features": self.config.get("features", {}),
            "health": "operational" if self.daily_cost < self.cost.daily_budget else "budget_exceeded"
        }


# Singleton instance
_config_instance = None

def get_ai_config(config_path: Optional[str] = None) -> AIConfig:
    """Get or create AI configuration singleton"""
    
    global _config_instance
    if _config_instance is None:
        _config_instance = AIConfig(config_path)
    return _config_instance


if __name__ == "__main__":
    # Test configuration
    config = get_ai_config()
    
    print("AI Configuration Status:")
    print(json.dumps(config.get_status(), indent=2))
    
    print("\n\nModel Recommendations:")
    
    # Test different scenarios
    scenarios = [
        ("classification", "critical", 500),
        ("draft", "high", 1000),
        ("analysis", "low", 5000),
        ("summary", "medium", 2000)
    ]
    
    for task, urgency, length in scenarios:
        recommendation = config.get_model_recommendation(task, urgency, length)
        print(f"\nTask: {task}, Urgency: {urgency}, Length: {length}")
        print(f"  Model: {recommendation['model']}")
        print(f"  Reasoning: {recommendation['reasoning']}")
        print(f"  Est. Cost: ${recommendation['estimated_cost']:.4f}")
        print(f"  Est. Latency: {recommendation['estimated_latency_ms']}ms")
    
    # Save configuration
    config.save_config()
    print("\nConfiguration saved to ai_config.json")
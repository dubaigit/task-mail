#!/usr/bin/env python3
"""
Email Intelligence CLI

Command-line interface for email classification and intelligence extraction.
Designed for production ML workflows with batch processing and monitoring.
"""

import argparse
import json
import sys
import time
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
import csv

from email_intelligence_engine import EmailIntelligenceEngine, EmailIntelligence, EmailClass
from email_intelligence_models import EnhancedEmailIntelligence, generate_training_data

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EmailIntelligenceCLI:
    """
    Production CLI for email intelligence operations.
    
    Features:
    - Single email analysis
    - Batch processing from CSV/JSON
    - Model training and evaluation
    - Performance monitoring
    - Export results in multiple formats
    """
    
    def __init__(self):
        self.engine = EmailIntelligenceEngine()
        self.enhanced_engine = EnhancedEmailIntelligence()
        
    def analyze_single_email(self, subject: str, body: str, sender: str = "", 
                           output_format: str = "json") -> Dict[str, Any]:
        """Analyze a single email and return results"""
        
        logger.info(f"Analyzing email: {subject[:50]}...")
        
        # Perform analysis
        result = self.engine.analyze_email(subject, body, sender)
        
        # Format output
        if output_format == "json":
            return self._format_json_output(result)
        elif output_format == "text":
            return self._format_text_output(result)
        else:
            raise ValueError(f"Unsupported output format: {output_format}")
    
    def batch_analyze_from_csv(self, csv_path: str, output_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """Analyze emails from CSV file"""
        
        logger.info(f"Starting batch analysis from {csv_path}")
        
        # Read emails from CSV
        emails = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                emails.append({
                    'subject': row.get('subject', ''),
                    'body': row.get('body', ''),
                    'sender': row.get('sender', ''),
                    'metadata': {}
                })
        
        # Batch analyze
        start_time = time.time()
        results = self.engine.batch_analyze(emails)
        processing_time = time.time() - start_time
        
        logger.info(f"Analyzed {len(emails)} emails in {processing_time:.2f}s")
        logger.info(f"Average processing time: {(processing_time/len(emails)*1000):.1f}ms per email")
        
        # Format results
        formatted_results = []
        for i, result in enumerate(results):
            formatted_result = self._format_json_output(result)
            formatted_result['email_index'] = i
            formatted_result['original_subject'] = emails[i]['subject']
            formatted_results.append(formatted_result)
        
        # Save results if output path provided
        if output_path:
            self._save_results(formatted_results, output_path)
            logger.info(f"Results saved to {output_path}")
        
        return formatted_results
    
    def batch_analyze_from_json(self, json_path: str, output_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """Analyze emails from JSON file"""
        
        logger.info(f"Starting batch analysis from {json_path}")
        
        # Read emails from JSON
        with open(json_path, 'r', encoding='utf-8') as f:
            emails_data = json.load(f)
        
        if isinstance(emails_data, dict) and 'emails' in emails_data:
            emails = emails_data['emails']
        elif isinstance(emails_data, list):
            emails = emails_data
        else:
            raise ValueError("JSON must contain 'emails' array or be an array of email objects")
        
        # Batch analyze
        start_time = time.time()
        results = self.engine.batch_analyze(emails)
        processing_time = time.time() - start_time
        
        logger.info(f"Analyzed {len(emails)} emails in {processing_time:.2f}s")
        
        # Format results
        formatted_results = []
        for i, result in enumerate(results):
            formatted_result = self._format_json_output(result)
            formatted_result['email_index'] = i
            formatted_result['original_subject'] = emails[i].get('subject', '')
            formatted_results.append(formatted_result)
        
        # Save results if output path provided
        if output_path:
            self._save_results(formatted_results, output_path)
            logger.info(f"Results saved to {output_path}")
        
        return formatted_results
    
    def train_models(self, training_data_path: Optional[str] = None) -> Dict[str, Any]:
        """Train ML models for enhanced classification"""
        
        logger.info("Starting model training...")
        
        # Use provided training data or generate synthetic data
        if training_data_path:
            with open(training_data_path, 'r', encoding='utf-8') as f:
                training_data = json.load(f)
        else:
            logger.info("No training data provided, using synthetic data for demo")
            training_data = generate_training_data()
        
        # Train models
        metrics = {}
        
        try:
            # Classification model
            logger.info("Training classification model...")
            class_metrics = self.enhanced_engine.train_classification_model(training_data['classification'])
            metrics['classification'] = {
                'accuracy': class_metrics.accuracy,
                'precision': class_metrics.precision,
                'recall': class_metrics.recall,
                'f1_score': class_metrics.f1_score
            }
            
            # Urgency model
            logger.info("Training urgency model...")
            urgency_metrics = self.enhanced_engine.train_urgency_model(training_data['urgency'])
            metrics['urgency'] = {
                'accuracy': urgency_metrics.accuracy,
                'precision': urgency_metrics.precision,
                'recall': urgency_metrics.recall,
                'f1_score': urgency_metrics.f1_score
            }
            
            # Sentiment model
            logger.info("Training sentiment model...")
            sentiment_metrics = self.enhanced_engine.train_sentiment_model(training_data['sentiment'])
            metrics['sentiment'] = {
                'accuracy': sentiment_metrics.accuracy,
                'precision': sentiment_metrics.precision,
                'recall': sentiment_metrics.recall,
                'f1_score': sentiment_metrics.f1_score
            }
            
            # Save models
            self.enhanced_engine.save_models()
            logger.info("Models saved successfully")
            
        except ImportError as e:
            logger.error(f"Training failed: {e}")
            metrics['error'] = str(e)
        
        return metrics
    
    def benchmark_performance(self, num_emails: int = 100) -> Dict[str, Any]:
        """Benchmark engine performance"""
        
        logger.info(f"Running performance benchmark with {num_emails} emails")
        
        # Generate test emails
        test_emails = []
        for i in range(num_emails):
            test_emails.append({
                'subject': f"Test email {i}: Please review the quarterly report",
                'body': f"Hi team, this is test email {i}. Could you please review the attached quarterly report and provide your feedback by end of week? This is important for our upcoming board meeting. Thanks!",
                'sender': f"user{i}@company.com"
            })
        
        # Benchmark analysis
        start_time = time.time()
        results = self.engine.batch_analyze(test_emails)
        total_time = time.time() - start_time
        
        # Calculate metrics
        avg_time_ms = (total_time / num_emails) * 1000
        throughput = num_emails / total_time
        
        # Analyze classification distribution
        class_distribution = {}
        confidence_scores = []
        
        for result in results:
            class_name = result.classification.value
            class_distribution[class_name] = class_distribution.get(class_name, 0) + 1
            confidence_scores.append(result.confidence)
        
        avg_confidence = sum(confidence_scores) / len(confidence_scores)
        
        benchmark_results = {
            'total_emails': num_emails,
            'total_time_seconds': total_time,
            'average_time_ms': avg_time_ms,
            'throughput_emails_per_second': throughput,
            'average_confidence': avg_confidence,
            'classification_distribution': class_distribution,
            'performance_target_met': avg_time_ms < 100  # Target: <100ms per email
        }
        
        logger.info(f"Benchmark completed: {avg_time_ms:.1f}ms avg, {throughput:.1f} emails/sec")
        
        return benchmark_results
    
    def get_engine_info(self) -> Dict[str, Any]:
        """Get engine information and capabilities"""
        return {
            'engine': 'EmailIntelligenceEngine',
            'version': '1.0.0',
            'capabilities': {
                'classification_classes': [cls.value for cls in EmailClass],
                'urgency_levels': ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
                'sentiment_analysis': True,
                'action_item_extraction': True,
                'deadline_detection': True,
                'multilingual_support': ['en', 'es', 'fr', 'de'],
                'batch_processing': True,
                'confidence_scoring': True
            },
            'performance': self.engine.get_performance_metrics(),
            'ml_models_available': hasattr(self.enhanced_engine, 'classification_model') and 
                                  self.enhanced_engine.classification_model is not None
        }
    
    def _format_json_output(self, result: EmailIntelligence) -> Dict[str, Any]:
        """Format result as JSON"""
        return {
            'classification': result.classification.value,
            'confidence': round(result.confidence, 3),
            'urgency': result.urgency.value,
            'sentiment': result.sentiment.value,
            'intent': result.intent,
            'action_items': [
                {
                    'text': item.text,
                    'assignee': item.assignee,
                    'deadline': item.deadline.isoformat() if item.deadline else None,
                    'confidence': round(item.confidence, 3)
                }
                for item in result.action_items
            ],
            'deadlines': [
                {
                    'date': deadline.isoformat(),
                    'context': context
                }
                for deadline, context in result.deadlines
            ],
            'confidence_scores': {k: round(v, 3) for k, v in result.confidence_scores.items()},
            'processing_time_ms': round(result.processing_time_ms, 1)
        }
    
    def _format_text_output(self, result: EmailIntelligence) -> Dict[str, Any]:
        """Format result as human-readable text"""
        
        text_output = []
        text_output.append(f"Classification: {result.classification.value}")
        text_output.append(f"Confidence: {result.confidence:.1%}")
        text_output.append(f"Urgency: {result.urgency.value}")
        text_output.append(f"Sentiment: {result.sentiment.value}")
        text_output.append(f"Intent: {result.intent}")
        
        if result.action_items:
            text_output.append("\nAction Items:")
            for item in result.action_items:
                text_output.append(f"  • {item.text}")
                if item.assignee:
                    text_output.append(f"    Assignee: {item.assignee}")
                if item.deadline:
                    text_output.append(f"    Deadline: {item.deadline.strftime('%Y-%m-%d %H:%M')}")
        
        if result.deadlines:
            text_output.append("\nDeadlines:")
            for deadline, context in result.deadlines:
                text_output.append(f"  • {deadline.strftime('%Y-%m-%d %H:%M')}: {context}")
        
        text_output.append(f"\nProcessing time: {result.processing_time_ms:.1f}ms")
        
        return {'text': '\n'.join(text_output)}
    
    def _save_results(self, results: List[Dict[str, Any]], output_path: str):
        """Save results to file"""
        
        output_path = Path(output_path)
        
        if output_path.suffix.lower() == '.json':
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
        elif output_path.suffix.lower() == '.csv':
            if results:
                fieldnames = list(results[0].keys())
                with open(output_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(results)
        else:
            # Default to JSON
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)

def main():
    """Main CLI entry point"""
    
    parser = argparse.ArgumentParser(
        description="Email Intelligence Engine CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Analyze single email
  python email_intelligence_cli.py analyze --subject "Urgent: Please approve" --body "Need approval ASAP"
  
  # Batch analyze from CSV
  python email_intelligence_cli.py batch-csv emails.csv --output results.json
  
  # Train models
  python email_intelligence_cli.py train --training-data training.json
  
  # Benchmark performance
  python email_intelligence_cli.py benchmark --num-emails 1000
  
  # Get engine info
  python email_intelligence_cli.py info
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Single email analysis
    analyze_parser = subparsers.add_parser('analyze', help='Analyze single email')
    analyze_parser.add_argument('--subject', required=True, help='Email subject')
    analyze_parser.add_argument('--body', required=True, help='Email body')
    analyze_parser.add_argument('--sender', default='', help='Sender email/name')
    analyze_parser.add_argument('--format', choices=['json', 'text'], default='json', help='Output format')
    
    # Batch analysis from CSV
    batch_csv_parser = subparsers.add_parser('batch-csv', help='Batch analyze from CSV file')
    batch_csv_parser.add_argument('input_file', help='Input CSV file path')
    batch_csv_parser.add_argument('--output', help='Output file path')
    
    # Batch analysis from JSON
    batch_json_parser = subparsers.add_parser('batch-json', help='Batch analyze from JSON file')
    batch_json_parser.add_argument('input_file', help='Input JSON file path')
    batch_json_parser.add_argument('--output', help='Output file path')
    
    # Model training
    train_parser = subparsers.add_parser('train', help='Train ML models')
    train_parser.add_argument('--training-data', help='Training data JSON file path')
    
    # Performance benchmark
    benchmark_parser = subparsers.add_parser('benchmark', help='Run performance benchmark')
    benchmark_parser.add_argument('--num-emails', type=int, default=100, help='Number of test emails')
    
    # Engine info
    info_parser = subparsers.add_parser('info', help='Get engine information')
    
    # Parse arguments
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Initialize CLI
    cli = EmailIntelligenceCLI()
    
    try:
        if args.command == 'analyze':
            result = cli.analyze_single_email(args.subject, args.body, args.sender, args.format)
            if args.format == 'json':
                print(json.dumps(result, indent=2))
            else:
                print(result['text'])
        
        elif args.command == 'batch-csv':
            results = cli.batch_analyze_from_csv(args.input_file, args.output)
            print(f"Analyzed {len(results)} emails")
            if not args.output:
                print(json.dumps(results[:3], indent=2))  # Show first 3 results
        
        elif args.command == 'batch-json':
            results = cli.batch_analyze_from_json(args.input_file, args.output)
            print(f"Analyzed {len(results)} emails")
            if not args.output:
                print(json.dumps(results[:3], indent=2))  # Show first 3 results
        
        elif args.command == 'train':
            metrics = cli.train_models(args.training_data)
            print("Training completed!")
            print(json.dumps(metrics, indent=2))
        
        elif args.command == 'benchmark':
            results = cli.benchmark_performance(args.num_emails)
            print("Benchmark Results:")
            print(json.dumps(results, indent=2))
        
        elif args.command == 'info':
            info = cli.get_engine_info()
            print(json.dumps(info, indent=2))
    
    except Exception as e:
        logger.error(f"Command failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
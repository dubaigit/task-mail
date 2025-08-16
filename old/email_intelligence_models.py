#!/usr/bin/env python3
"""
Email Intelligence Models

Enhanced ML models for production email classification.
Designed for fast inference with pre-trained lightweight models.
"""

import pickle
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
import re

try:
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.naive_bayes import MultinomialNB
    from sklearn.pipeline import Pipeline
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("scikit-learn not available. Using rule-based classification only.")

from email_intelligence_engine import EmailClass, Urgency, Sentiment

@dataclass
class ModelMetrics:
    """Model performance metrics"""
    accuracy: float
    precision: Dict[str, float]
    recall: Dict[str, float]
    f1_score: Dict[str, float]
    inference_time_ms: float

class EmailClassificationModel:
    """
    Production email classification model with multiple algorithms.
    
    Features:
    - TF-IDF vectorization for text features
    - Multiple classifier options (Logistic Regression, Random Forest, Naive Bayes)
    - Fast inference (<50ms)
    - Model persistence and loading
    - Performance monitoring
    """
    
    def __init__(self, model_type: str = 'logistic', model_path: Optional[str] = None):
        self.model_type = model_type
        self.model = None
        self.vectorizer = None
        self.is_trained = False
        self.logger = logging.getLogger(__name__)
        
        if model_path and Path(model_path).exists():
            self.load_model(model_path)
    
    def _create_model(self) -> Pipeline:
        """Create ML pipeline based on model type"""
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn required for ML models")
        
        # TF-IDF vectorizer optimized for email content
        vectorizer = TfidfVectorizer(
            max_features=10000,
            ngram_range=(1, 2),
            stop_words='english',
            min_df=2,
            max_df=0.8,
            sublinear_tf=True,
            norm='l2'
        )
        
        # Select classifier
        if self.model_type == 'logistic':
            classifier = LogisticRegression(
                max_iter=1000,
                random_state=42,
                class_weight='balanced',
                solver='liblinear'
            )
        elif self.model_type == 'random_forest':
            classifier = RandomForestClassifier(
                n_estimators=100,
                max_depth=20,
                random_state=42,
                class_weight='balanced',
                n_jobs=-1
            )
        elif self.model_type == 'naive_bayes':
            classifier = MultinomialNB(alpha=0.1)
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")
        
        return Pipeline([
            ('vectorizer', vectorizer),
            ('classifier', classifier)
        ])
    
    def train(self, training_data: List[Dict], validation_split: float = 0.2) -> ModelMetrics:
        """
        Train the classification model.
        
        Args:
            training_data: List of dicts with 'text' and 'label' keys
            validation_split: Fraction of data for validation
            
        Returns:
            ModelMetrics with training performance
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn required for training")
        
        # Prepare training data
        texts = [item['text'] for item in training_data]
        labels = [item['label'] for item in training_data]
        
        # Split data
        X_train, X_val, y_train, y_val = train_test_split(
            texts, labels, test_size=validation_split, random_state=42, stratify=labels
        )
        
        # Create and train model
        self.model = self._create_model()
        self.model.fit(X_train, y_train)
        self.is_trained = True
        
        # Evaluate on validation set
        y_pred = self.model.predict(X_val)
        
        # Calculate metrics
        accuracy = accuracy_score(y_val, y_pred)
        report = classification_report(y_val, y_pred, output_dict=True)
        
        # Extract per-class metrics
        precision = {k: v['precision'] for k, v in report.items() if k not in ['accuracy', 'macro avg', 'weighted avg']}
        recall = {k: v['recall'] for k, v in report.items() if k not in ['accuracy', 'macro avg', 'weighted avg']}
        f1_score = {k: v['f1-score'] for k, v in report.items() if k not in ['accuracy', 'macro avg', 'weighted avg']}
        
        self.logger.info(f"Model trained with accuracy: {accuracy:.3f}")
        
        return ModelMetrics(
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1_score,
            inference_time_ms=0.0  # Will be measured during inference
        )
    
    def predict(self, texts: List[str]) -> List[Tuple[str, float]]:
        """
        Predict classifications for texts.
        
        Args:
            texts: List of text strings to classify
            
        Returns:
            List of (predicted_class, confidence) tuples
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before prediction")
        
        import time
        start_time = time.time()
        
        # Get predictions and probabilities
        predictions = self.model.predict(texts)
        probabilities = self.model.predict_proba(texts)
        
        # Get confidence scores (max probability)
        confidence_scores = np.max(probabilities, axis=1)
        
        inference_time = (time.time() - start_time) * 1000
        self.logger.debug(f"Inference time for {len(texts)} texts: {inference_time:.1f}ms")
        
        return list(zip(predictions, confidence_scores))
    
    def save_model(self, path: str):
        """Save trained model to disk"""
        if not self.is_trained:
            raise ValueError("No trained model to save")
        
        model_data = {
            'model': self.model,
            'model_type': self.model_type,
            'is_trained': self.is_trained
        }
        
        with open(path, 'wb') as f:
            pickle.dump(model_data, f)
        
        self.logger.info(f"Model saved to {path}")
    
    def load_model(self, path: str):
        """Load trained model from disk"""
        with open(path, 'rb') as f:
            model_data = pickle.load(f)
        
        self.model = model_data['model']
        self.model_type = model_data['model_type']
        self.is_trained = model_data['is_trained']
        
        self.logger.info(f"Model loaded from {path}")

class EnhancedEmailIntelligence:
    """
    Enhanced email intelligence with ML models.
    
    Combines rule-based and ML approaches for optimal performance.
    """
    
    def __init__(self, models_dir: Optional[str] = None):
        self.models_dir = Path(models_dir) if models_dir else Path('./models')
        self.models_dir.mkdir(exist_ok=True)
        
        # Initialize models
        self.classification_model = None
        self.urgency_model = None
        self.sentiment_model = None
        
        # Load pre-trained models if available
        self._load_models()
        
        self.logger = logging.getLogger(__name__)
    
    def _load_models(self):
        """Load pre-trained models from disk"""
        model_files = {
            'classification': self.models_dir / 'classification_model.pkl',
            'urgency': self.models_dir / 'urgency_model.pkl',
            'sentiment': self.models_dir / 'sentiment_model.pkl'
        }
        
        for model_name, model_path in model_files.items():
            if model_path.exists():
                try:
                    if model_name == 'classification':
                        self.classification_model = EmailClassificationModel(model_path=str(model_path))
                    elif model_name == 'urgency':
                        self.urgency_model = EmailClassificationModel(model_path=str(model_path))
                    elif model_name == 'sentiment':
                        self.sentiment_model = EmailClassificationModel(model_path=str(model_path))
                    
                    self.logger.info(f"Loaded {model_name} model from {model_path}")
                except Exception as e:
                    self.logger.warning(f"Failed to load {model_name} model: {e}")
    
    def train_classification_model(self, training_data: List[Dict]) -> ModelMetrics:
        """Train email classification model"""
        self.classification_model = EmailClassificationModel('logistic')
        return self.classification_model.train(training_data)
    
    def train_urgency_model(self, training_data: List[Dict]) -> ModelMetrics:
        """Train urgency detection model"""
        self.urgency_model = EmailClassificationModel('random_forest')
        return self.urgency_model.train(training_data)
    
    def train_sentiment_model(self, training_data: List[Dict]) -> ModelMetrics:
        """Train sentiment analysis model"""
        self.sentiment_model = EmailClassificationModel('naive_bayes')
        return self.sentiment_model.train(training_data)
    
    def predict_classification(self, text: str) -> Tuple[EmailClass, float]:
        """Predict email classification using ML model"""
        if self.classification_model and self.classification_model.is_trained:
            predictions = self.classification_model.predict([text])
            class_name, confidence = predictions[0]
            return EmailClass(class_name), confidence
        else:
            # Fallback to rule-based approach
            return EmailClass.FYI_ONLY, 0.5
    
    def predict_urgency(self, text: str) -> Tuple[Urgency, float]:
        """Predict urgency using ML model"""
        if self.urgency_model and self.urgency_model.is_trained:
            predictions = self.urgency_model.predict([text])
            urgency_name, confidence = predictions[0]
            return Urgency(urgency_name), confidence
        else:
            return Urgency.MEDIUM, 0.5
    
    def predict_sentiment(self, text: str) -> Tuple[Sentiment, float]:
        """Predict sentiment using ML model"""
        if self.sentiment_model and self.sentiment_model.is_trained:
            predictions = self.sentiment_model.predict([text])
            sentiment_name, confidence = predictions[0]
            return Sentiment(sentiment_name), confidence
        else:
            return Sentiment.NEUTRAL, 0.5
    
    def save_models(self):
        """Save all trained models"""
        if self.classification_model:
            self.classification_model.save_model(str(self.models_dir / 'classification_model.pkl'))
        if self.urgency_model:
            self.urgency_model.save_model(str(self.models_dir / 'urgency_model.pkl'))
        if self.sentiment_model:
            self.sentiment_model.save_model(str(self.models_dir / 'sentiment_model.pkl'))

def generate_training_data() -> Dict[str, List[Dict]]:
    """
    Generate synthetic training data for model development.
    
    In production, replace with real labeled email data.
    """
    
    classification_data = [
        # NEEDS_REPLY examples
        {'text': 'Can you please confirm the meeting time for tomorrow?', 'label': 'NEEDS_REPLY'},
        {'text': 'What do you think about the new proposal?', 'label': 'NEEDS_REPLY'},
        {'text': 'Please let me know your availability for next week', 'label': 'NEEDS_REPLY'},
        {'text': 'Could you review the attached document and provide feedback?', 'label': 'NEEDS_REPLY'},
        
        # APPROVAL_REQUIRED examples
        {'text': 'Please approve the budget for Q4 marketing campaign', 'label': 'APPROVAL_REQUIRED'},
        {'text': 'Need your authorization for the new hire', 'label': 'APPROVAL_REQUIRED'},
        {'text': 'Waiting for approval on the contract terms', 'label': 'APPROVAL_REQUIRED'},
        
        # CREATE_TASK examples
        {'text': 'We need to create a task for updating the website', 'label': 'CREATE_TASK'},
        {'text': 'Action item: Complete the security audit by Friday', 'label': 'CREATE_TASK'},
        {'text': 'Todo: Finish the presentation for the client meeting', 'label': 'CREATE_TASK'},
        
        # DELEGATE examples
        {'text': 'Can you handle the customer support issue?', 'label': 'DELEGATE'},
        {'text': 'Please assign this to the development team', 'label': 'DELEGATE'},
        {'text': 'Sarah can take care of the documentation', 'label': 'DELEGATE'},
        
        # FYI_ONLY examples
        {'text': 'FYI: The server maintenance is scheduled for this weekend', 'label': 'FYI_ONLY'},
        {'text': 'Just to let you know that the meeting has been rescheduled', 'label': 'FYI_ONLY'},
        {'text': 'Update: The project is on track and progressing well', 'label': 'FYI_ONLY'},
        
        # FOLLOW_UP examples
        {'text': 'Following up on our conversation about the proposal', 'label': 'FOLLOW_UP'},
        {'text': 'Checking in on the status of the project', 'label': 'FOLLOW_UP'},
        {'text': 'Reminder: Please submit your timesheet by EOD', 'label': 'FOLLOW_UP'},
    ]
    
    urgency_data = [
        {'text': 'URGENT: Server is down and customers cannot access the site', 'label': 'CRITICAL'},
        {'text': 'Need this completed ASAP for the board meeting', 'label': 'CRITICAL'},
        {'text': 'High priority: Client is waiting for the proposal', 'label': 'HIGH'},
        {'text': 'Important: Please review before the deadline', 'label': 'HIGH'},
        {'text': 'When you have time, could you look at this?', 'label': 'MEDIUM'},
        {'text': 'No rush, but please keep this in mind for next week', 'label': 'LOW'},
        {'text': 'Low priority item for your consideration', 'label': 'LOW'},
    ]
    
    sentiment_data = [
        {'text': 'Thank you so much for your help! This is excellent work.', 'label': 'POSITIVE'},
        {'text': 'Great job on the presentation, very well done!', 'label': 'POSITIVE'},
        {'text': 'Here is the weekly report for your review', 'label': 'NEUTRAL'},
        {'text': 'Please find the attached document', 'label': 'NEUTRAL'},
        {'text': 'I am concerned about the project timeline', 'label': 'NEGATIVE'},
        {'text': 'There seems to be an issue with the deployment', 'label': 'NEGATIVE'},
        {'text': 'This is ridiculous! How many times do I need to ask?', 'label': 'FRUSTRATED'},
        {'text': 'I am getting frustrated with the lack of progress', 'label': 'FRUSTRATED'},
    ]
    
    return {
        'classification': classification_data,
        'urgency': urgency_data,
        'sentiment': sentiment_data
    }

def main():
    """Demo training and evaluation"""
    print("Email Intelligence Models Training Demo")
    print("=" * 50)
    
    if not SKLEARN_AVAILABLE:
        print("scikit-learn not available. Install it to run ML models training.")
        return
    
    # Generate training data
    training_data = generate_training_data()
    
    # Initialize enhanced intelligence
    intelligence = EnhancedEmailIntelligence()
    
    # Train models
    print("\nTraining Classification Model...")
    class_metrics = intelligence.train_classification_model(training_data['classification'])
    print(f"Classification Accuracy: {class_metrics.accuracy:.3f}")
    
    print("\nTraining Urgency Model...")
    urgency_metrics = intelligence.train_urgency_model(training_data['urgency'])
    print(f"Urgency Accuracy: {urgency_metrics.accuracy:.3f}")
    
    print("\nTraining Sentiment Model...")
    sentiment_metrics = intelligence.train_sentiment_model(training_data['sentiment'])
    print(f"Sentiment Accuracy: {sentiment_metrics.accuracy:.3f}")
    
    # Save models
    intelligence.save_models()
    print("\nModels saved successfully!")
    
    # Test predictions
    test_text = "Can you please approve the budget for the new project? It's quite urgent."
    
    print(f"\nTesting with: '{test_text}'")
    
    classification, class_conf = intelligence.predict_classification(test_text)
    urgency, urgency_conf = intelligence.predict_urgency(test_text)
    sentiment, sentiment_conf = intelligence.predict_sentiment(test_text)
    
    print(f"Classification: {classification.value} (confidence: {class_conf:.3f})")
    print(f"Urgency: {urgency.value} (confidence: {urgency_conf:.3f})")
    print(f"Sentiment: {sentiment.value} (confidence: {sentiment_conf:.3f})")

if __name__ == "__main__":
    main()
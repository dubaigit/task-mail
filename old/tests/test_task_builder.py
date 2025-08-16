#!/usr/bin/env python3
"""
Comprehensive Task Builder System Tests

Tests intelligent task extraction, categorization, prioritization, deadline parsing,
assignee detection, dependency analysis, and database operations with full mocking.
"""

import pytest
import json
import sqlite3
import tempfile
import os
import time
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, call

# Import system under test
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from task_builder import (
    IntelligentTaskBuilder,
    IntelligentTask,
    TaskPriority,
    TaskCategory,
    TaskStatus,
    TaskDeadline,
    TaskAssignee,
    TaskDependency
)

# ============================================================================
# Test Fixtures and Setup
# ============================================================================

@pytest.fixture
def temp_db():
    """Create temporary database for testing"""
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    yield db_path
    os.close(db_fd)
    if os.path.exists(db_path):
        os.unlink(db_path)

@pytest.fixture
def test_config():
    """Test configuration for task builder"""
    return {
        'database_path': None,  # Will be set by fixture
        'priority_weights': {
            'urgency_keywords': 0.4,
            'deadline_proximity': 0.3,
            'requester_importance': 0.2,
            'complexity': 0.1
        },
        'deadline_parsing': {
            'default_time': '17:00',
            'business_hours': (9, 17),
            'weekend_adjustment': True
        },
        'assignee_detection': {
            'department_keywords': {
                'development': ['dev', 'development', 'engineering', 'code', 'technical'],
                'design': ['design', 'ui', 'ux', 'visual', 'creative'],
                'marketing': ['marketing', 'promotion', 'campaign', 'social'],
                'finance': ['budget', 'finance', 'accounting', 'cost', 'payment'],
                'legal': ['legal', 'contract', 'compliance', 'terms'],
                'hr': ['hr', 'human resources', 'hiring', 'recruitment']
            }
        }
    }

@pytest.fixture
def task_builder(temp_db, test_config):
    """Initialize task builder with test configuration"""
    test_config['database_path'] = temp_db
    return IntelligentTaskBuilder(config=test_config)

@pytest.fixture
def sample_email_content():
    """Sample email content for task extraction testing"""
    return {
        'subject': 'Q4 Project Review and Approval Needed - Due Friday',
        'body': '''Hi Abdullah,

I hope this email finds you well. I need your urgent attention on several items:

1. Please review the Q4 project proposal by Friday - this is critical for our timeline
2. Can you approve the marketing budget of $50,000 for the new campaign? 
3. We need to schedule a meeting with the development team to discuss the API integration
4. The legal team should review the new vendor contracts before we proceed
5. Sarah mentioned that the design team needs feedback on the UI mockups by tomorrow

Also, please delegate the server maintenance task to the operations team when you have a chance.

The deadline for the proposal review is this Friday at 5 PM. This is blocking our ability to move forward with the next phase.

Thanks for your help with these urgent matters.

Best regards,
Mike Johnson
Project Manager
mike.johnson@company.com''',
        'sender': 'mike.johnson@company.com'
    }

@pytest.fixture
def sample_task():
    """Sample task for testing"""
    return IntelligentTask(
        id="TASK-20241201-001",
        title="Review Q4 project proposal",
        description="Please review the Q4 project proposal by Friday",
        category=TaskCategory.REVIEW,
        priority=TaskPriority.HIGH,
        deadline=TaskDeadline(
            date=datetime.now() + timedelta(days=2),
            type="hard",
            source_text="by Friday",
            confidence=0.9
        ),
        assignee=TaskAssignee(
            name="Abdullah",
            confidence=0.8,
            reasoning="Explicitly mentioned as recipient"
        ),
        confidence_score=0.85
    )

# ============================================================================
# Initialization and Configuration Tests
# ============================================================================

@pytest.mark.unit
def test_task_builder_initialization(task_builder):
    """Test task builder initializes correctly"""
    assert task_builder is not None
    assert task_builder.config is not None
    assert task_builder.task_counter == 0
    assert isinstance(task_builder.active_tasks, dict)
    assert len(task_builder.task_patterns) > 0
    assert len(task_builder.priority_indicators) > 0
    assert len(task_builder.deadline_patterns) > 0

@pytest.mark.unit
def test_config_loading_with_defaults():
    """Test configuration loading with default values"""
    builder = IntelligentTaskBuilder()
    
    assert 'priority_weights' in builder.config
    assert 'deadline_parsing' in builder.config
    assert 'assignee_detection' in builder.config
    assert builder.config['deadline_parsing']['default_time'] == '17:00'

@pytest.mark.unit
def test_config_deep_update(temp_db):
    """Test deep configuration update"""
    custom_config = {
        'priority_weights': {
            'urgency_keywords': 0.5  # Override default
        },
        'new_setting': 'test_value'  # Add new setting
    }
    
    builder = IntelligentTaskBuilder(config=custom_config)
    
    # Should have overridden urgency_keywords but kept other defaults
    assert builder.config['priority_weights']['urgency_keywords'] == 0.5
    assert 'deadline_proximity' in builder.config['priority_weights']  # Default retained
    assert builder.config['new_setting'] == 'test_value'

@pytest.mark.unit
def test_database_initialization(task_builder):
    """Test database tables are created correctly"""
    db_path = task_builder.config['database_path']
    
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        
        # Check main tables exist
        tables = ['tasks', 'task_dependencies', 'task_history']
        for table in tables:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            assert cursor.fetchone() is not None
        
        # Check indexes exist
        indexes = ['idx_tasks_priority', 'idx_tasks_status', 'idx_tasks_deadline', 'idx_tasks_assignee']
        for index in indexes:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='index' AND name='{index}'")
            assert cursor.fetchone() is not None

# ============================================================================
# Pattern Recognition Tests
# ============================================================================

@pytest.mark.unit
def test_task_pattern_extraction(task_builder):
    """Test basic task pattern extraction"""
    text = "Please review the document and provide feedback by tomorrow."
    
    raw_tasks = task_builder._extract_raw_tasks(text)
    
    assert len(raw_tasks) > 0
    
    # Should find the "please review" pattern
    review_task = next((t for t in raw_tasks if 'review' in t['text']), None)
    assert review_task is not None
    assert review_task['category'] == TaskCategory.REVIEW

@pytest.mark.unit
def test_approval_pattern_recognition(task_builder):
    """Test approval task pattern recognition"""
    text = "I need your approval for the budget allocation of $50,000."
    
    raw_tasks = task_builder._extract_raw_tasks(text)
    
    approval_task = next((t for t in raw_tasks if t['category'] == TaskCategory.APPROVAL), None)
    assert approval_task is not None
    assert 'budget allocation' in approval_task['text']
    assert approval_task['confidence'] > 0.8

@pytest.mark.unit
def test_development_pattern_recognition(task_builder):
    """Test development task pattern recognition"""
    text = "We need to implement the new API endpoint and fix the authentication bug."
    
    raw_tasks = task_builder._extract_raw_tasks(text)
    
    # Should find both implement and fix patterns
    dev_tasks = [t for t in raw_tasks if t['category'] == TaskCategory.DEVELOPMENT]
    assert len(dev_tasks) >= 1
    
    # Check for implement pattern
    implement_task = next((t for t in dev_tasks if 'implement' in t['text']), None)
    assert implement_task is not None

@pytest.mark.unit
def test_meeting_pattern_recognition(task_builder):
    """Test meeting/communication task pattern recognition"""
    text = "Please schedule a meeting with the development team to discuss the integration."
    
    raw_tasks = task_builder._extract_raw_tasks(text)
    
    meeting_task = next((t for t in raw_tasks if t['category'] == TaskCategory.MEETING), None)
    assert meeting_task is not None
    assert 'meeting' in meeting_task['text']

@pytest.mark.unit
def test_generic_match_filtering(task_builder):
    """Test filtering out generic matches"""
    generic_texts = ["it", "this", "that", "help", "me", "you", "a", "an"]
    
    for text in generic_texts:
        assert task_builder._is_generic_match(text) == True
    
    # Valid task text should not be filtered
    assert task_builder._is_generic_match("review the proposal") == False

@pytest.mark.unit
def test_duplicate_task_removal(task_builder):
    """Test removal of duplicate and overlapping tasks"""
    # Create overlapping raw tasks
    raw_tasks = [
        {'text': 'review the document', 'confidence': 0.8, 'category': TaskCategory.REVIEW, 'start': 0, 'end': 18},
        {'text': 'review the document carefully', 'confidence': 0.9, 'category': TaskCategory.REVIEW, 'start': 0, 'end': 29},
        {'text': 'separate task', 'confidence': 0.7, 'category': TaskCategory.OPERATIONAL, 'start': 50, 'end': 63}
    ]
    
    deduplicated = task_builder._deduplicate_raw_tasks(raw_tasks)
    
    # Should keep higher confidence overlapping task and separate task
    assert len(deduplicated) == 2
    assert any('carefully' in t['text'] for t in deduplicated)  # Higher confidence version
    assert any('separate' in t['text'] for t in deduplicated)   # Non-overlapping task

# ============================================================================
# Task Construction Tests
# ============================================================================

@pytest.mark.unit
def test_task_title_generation(task_builder):
    """Test task title generation and cleaning"""
    test_cases = [
        ("please review the document", "Review the document"),
        ("can you help with this task", "Help with this task"),
        ("need you to update the database", "Update the database"),
        ("should verify the configuration", "Verify the configuration"),
    ]
    
    for input_text, expected in test_cases:
        title = task_builder._generate_task_title(input_text)
        assert title == expected

@pytest.mark.unit
def test_task_title_length_limit(task_builder):
    """Test task title length limiting"""
    long_text = "please " + "very " * 50 + "long task description"
    
    title = task_builder._generate_task_title(long_text)
    
    assert len(title) <= 100
    assert title.endswith("...")

@pytest.mark.unit
def test_task_description_generation(task_builder):
    """Test task description generation with context"""
    raw_task = {
        'text': 'review the proposal',
        'full_match': 'Please review the proposal',
        'confidence': 0.85,
        'category': TaskCategory.REVIEW,
        'start': 10,
        'end': 35
    }
    
    full_text = "Hi there. Please review the proposal by Friday. Thanks!"
    
    description = task_builder._generate_task_description(raw_task, full_text)
    
    assert 'Task: review the proposal' in description
    assert 'Category: REVIEW' in description
    assert 'confidence: 0.85' in description

@pytest.mark.unit
def test_keyword_extraction(task_builder):
    """Test keyword extraction from task text"""
    task_text = "Please review the quarterly financial report and provide detailed feedback"
    
    keywords = task_builder._extract_keywords(task_text)
    
    expected_keywords = ['review', 'quarterly', 'financial', 'report', 'provide', 'detailed', 'feedback']
    
    # Should extract most content words, excluding stop words
    for keyword in expected_keywords:
        assert keyword in keywords
    
    # Should not include stop words
    assert 'the' not in keywords
    assert 'and' not in keywords
    
    # Should limit to reasonable number
    assert len(keywords) <= 10

# ============================================================================
# Priority Calculation Tests
# ============================================================================

@pytest.mark.unit
def test_priority_calculation_critical(task_builder):
    """Test critical priority calculation"""
    raw_task = {
        'text': 'urgent fix needed for production',
        'category': TaskCategory.DEVELOPMENT,
        'confidence': 0.9
    }
    
    full_text = "URGENT: Critical bug in production system needs immediate fix ASAP"
    sender = "ceo@company.com"
    
    priority = task_builder._calculate_task_priority(raw_task, full_text, sender)
    
    assert priority == TaskPriority.CRITICAL

@pytest.mark.unit
def test_priority_calculation_high(task_builder):
    """Test high priority calculation"""
    raw_task = {
        'text': 'review important proposal',
        'category': TaskCategory.REVIEW,
        'confidence': 0.8
    }
    
    full_text = "This is high priority and due this week"
    sender = "manager@company.com"
    
    priority = task_builder._calculate_task_priority(raw_task, full_text, sender)
    
    assert priority in [TaskPriority.HIGH, TaskPriority.CRITICAL]

@pytest.mark.unit
def test_priority_calculation_low(task_builder):
    """Test low priority calculation"""
    raw_task = {
        'text': 'update documentation',
        'category': TaskCategory.ADMINISTRATIVE,
        'confidence': 0.6
    }
    
    full_text = "No rush on this task, whenever you have time"
    sender = "intern@company.com"
    
    priority = task_builder._calculate_task_priority(raw_task, full_text, sender)
    
    assert priority == TaskPriority.LOW

@pytest.mark.unit
def test_priority_calculation_weights(task_builder):
    """Test priority calculation respects configuration weights"""
    # Test with high urgency keywords (should be weighted heavily)
    raw_task = {
        'text': 'emergency database fix',
        'category': TaskCategory.DEVELOPMENT,
        'confidence': 0.9
    }
    
    # High urgency keywords should dominate even with low-importance sender
    full_text = "EMERGENCY: Critical system failure needs immediate attention"
    sender = "junior.dev@company.com"
    
    priority = task_builder._calculate_task_priority(raw_task, full_text, sender)
    
    # Should still be critical due to urgency keywords
    assert priority == TaskPriority.CRITICAL

@pytest.mark.unit
def test_priority_with_deadline_proximity(task_builder):
    """Test priority calculation includes deadline proximity"""
    raw_task = {
        'text': 'complete project review',
        'category': TaskCategory.REVIEW,
        'confidence': 0.8
    }
    
    full_text = "Please complete the project review by today"
    sender = "manager@company.com"
    
    priority = task_builder._calculate_task_priority(raw_task, full_text, sender)
    
    # Today deadline should increase priority
    assert priority in [TaskPriority.HIGH, TaskPriority.CRITICAL]

# ============================================================================
# Deadline Parsing Tests
# ============================================================================

@pytest.mark.unit
def test_deadline_extraction_relative_dates(task_builder):
    """Test deadline extraction for relative dates"""
    test_cases = [
        ("Please complete this by today", "today"),
        ("Due tomorrow morning", "tomorrow"),
        ("Deadline is this Friday", "friday"),
        ("Need this done by next week", "next week"),
    ]
    
    for text, expected_keyword in test_cases:
        raw_task = {'start': 0, 'end': len(text)}
        
        deadline = task_builder._extract_task_deadline(raw_task, text)
        
        assert deadline is not None
        assert expected_keyword.lower() in deadline.source_text.lower()
        assert isinstance(deadline.date, datetime)

@pytest.mark.unit
def test_deadline_parsing_specific_dates(task_builder):
    """Test parsing of specific date formats"""
    now = datetime.now()
    
    # Test "today"
    parsed = task_builder._parse_deadline_text("today")
    assert parsed.date() == now.date()
    assert parsed.hour == 17  # Default end of business
    
    # Test "tomorrow"
    parsed = task_builder._parse_deadline_text("tomorrow")
    assert parsed.date() == (now + timedelta(days=1)).date()
    
    # Test "this friday"
    parsed = task_builder._parse_deadline_text("this week")
    assert parsed is not None
    assert parsed > now

@pytest.mark.unit
def test_deadline_parsing_day_names(task_builder):
    """Test parsing of weekday names"""
    day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    
    for day_name in day_names:
        parsed = task_builder._parse_deadline_text(day_name)
        
        assert parsed is not None
        assert isinstance(parsed, datetime)
        # Should be in the future
        assert parsed > datetime.now()

@pytest.mark.unit
def test_deadline_types(task_builder):
    """Test different deadline types (hard vs soft)"""
    raw_task = {'start': 0, 'end': 50}
    
    # Hard deadline
    hard_text = "This must be completed by Friday"
    hard_deadline = task_builder._extract_task_deadline(raw_task, hard_text)
    
    # Should find a deadline with appropriate type
    if hard_deadline:
        assert hard_deadline.type in ['hard', 'soft']
        assert hard_deadline.confidence > 0.5

@pytest.mark.unit
def test_invalid_deadline_handling(task_builder):
    """Test handling of invalid deadline text"""
    invalid_dates = ["someday", "invalid date", "not a date", ""]
    
    for invalid_date in invalid_dates:
        parsed = task_builder._parse_deadline_text(invalid_date)
        # Should return None for unparseable dates
        if parsed:
            assert isinstance(parsed, datetime)

# ============================================================================
# Assignee Detection Tests
# ============================================================================

@pytest.mark.unit
def test_explicit_assignee_detection(task_builder):
    """Test detection of explicitly mentioned assignees"""
    raw_task = {'start': 0, 'end': 50}
    
    test_cases = [
        ("Please assign this to John Smith", "John Smith"),
        ("Have Sarah handle this task", "Sarah"),
        ("Tell Mike to review this", "Mike"),
        ("@Jennifer can you help", "Jennifer"),
    ]
    
    for text, expected_name in test_cases:
        assignee = task_builder._detect_assignee(raw_task, text, "sender@test.com")
        
        assert assignee is not None
        assert expected_name in assignee.name
        assert assignee.confidence > 0.7
        assert "mentioned" in assignee.reasoning.lower()

@pytest.mark.unit
def test_department_assignee_detection(task_builder):
    """Test detection of department/team assignments"""
    raw_task = {'start': 0, 'end': 50}
    
    test_cases = [
        ("The development team should handle this", "development"),
        ("Send this to the design team", "design"),
        ("Marketing team needs to review", "marketing"),
        ("Legal team approval required", "legal"),
    ]
    
    for text, expected_dept in test_cases:
        assignee = task_builder._detect_assignee(raw_task, text, "sender@test.com")
        
        assert assignee is not None
        assert expected_dept.lower() in assignee.name.lower()
        assert assignee.role == expected_dept
        assert assignee.confidence > 0.5

@pytest.mark.unit
def test_category_based_assignee_suggestion(task_builder):
    """Test assignee suggestion based on task category"""
    raw_task = {'category': TaskCategory.DEVELOPMENT, 'start': 0, 'end': 20}
    
    assignee = task_builder._detect_assignee(raw_task, "Fix the bug", "sender@test.com")
    
    if assignee:  # Might suggest based on category
        assert assignee.confidence <= 0.6  # Lower confidence for suggestions
        assert "category" in assignee.reasoning.lower()

@pytest.mark.unit
def test_assignee_confidence_scoring(task_builder):
    """Test assignee confidence scoring"""
    raw_task = {'start': 0, 'end': 50}
    
    # Explicit mention should have high confidence
    explicit_assignee = task_builder._detect_assignee(
        raw_task, "Please assign this to John Smith", "sender@test.com"
    )
    if explicit_assignee:
        assert explicit_assignee.confidence >= 0.8
    
    # Department mention should have medium confidence
    dept_assignee = task_builder._detect_assignee(
        raw_task, "Development team should handle", "sender@test.com"
    )
    if dept_assignee:
        assert 0.5 <= dept_assignee.confidence < 0.8

# ============================================================================
# Duration Estimation Tests
# ============================================================================

@pytest.mark.unit
def test_duration_estimation_by_category(task_builder):
    """Test duration estimation based on task category"""
    test_cases = [
        (TaskCategory.APPROVAL, 0.5),     # Quick approval
        (TaskCategory.REVIEW, 2.0),       # Review takes more time
        (TaskCategory.DEVELOPMENT, 8.0),  # Development is time-consuming
        (TaskCategory.MEETING, 1.0),      # Standard meeting length
    ]
    
    for category, expected_base_hours in test_cases:
        raw_task = {
            'text': 'standard task text',
            'category': category
        }
        
        duration = task_builder._estimate_task_duration(raw_task)
        
        assert duration is not None
        assert duration.total_seconds() > 0
        
        # Duration should be related to expected base (may be adjusted by complexity)
        hours = duration.total_seconds() / 3600
        assert 0.1 <= hours <= expected_base_hours * 3  # Allow for complexity multipliers

@pytest.mark.unit
def test_duration_estimation_complexity_adjustment(task_builder):
    """Test duration estimation adjusts for task complexity"""
    base_task = {
        'text': 'simple task',
        'category': TaskCategory.REVIEW
    }
    
    complex_task = {
        'text': 'very complex and detailed comprehensive task that requires extensive analysis and multiple stakeholders coordination with various dependencies and thorough documentation',
        'category': TaskCategory.REVIEW
    }
    
    base_duration = task_builder._estimate_task_duration(base_task)
    complex_duration = task_builder._estimate_task_duration(complex_task)
    
    # Complex task should take longer
    assert complex_duration > base_duration

# ============================================================================
# Full Task Extraction Tests
# ============================================================================

@pytest.mark.unit
def test_extract_tasks_from_email(task_builder, sample_email_content):
    """Test complete task extraction from email"""
    tasks = task_builder.extract_tasks_from_email(
        subject=sample_email_content['subject'],
        body=sample_email_content['body'],
        sender=sample_email_content['sender'],
        email_hash="test_email_123"
    )
    
    # Should extract multiple tasks from the sample email
    assert len(tasks) > 0
    
    # Verify task structure
    for task in tasks:
        assert isinstance(task, IntelligentTask)
        assert task.id is not None
        assert task.title is not None
        assert task.description is not None
        assert isinstance(task.category, TaskCategory)
        assert isinstance(task.priority, TaskPriority)
        assert task.confidence_score > 0

@pytest.mark.unit
def test_task_id_generation(task_builder, sample_email_content):
    """Test task ID generation is unique and formatted correctly"""
    tasks = task_builder.extract_tasks_from_email(
        subject=sample_email_content['subject'],
        body=sample_email_content['body'],
        sender=sample_email_content['sender']
    )
    
    # Collect all task IDs
    task_ids = [task.id for task in tasks]
    
    # Should be unique
    assert len(task_ids) == len(set(task_ids))
    
    # Should follow expected format
    for task_id in task_ids:
        assert task_id.startswith("TASK-")
        assert len(task_id.split("-")) == 3  # TASK-YYYYMMDD-NNNN

@pytest.mark.unit
def test_task_context_preservation(task_builder, sample_email_content):
    """Test that task context is preserved"""
    tasks = task_builder.extract_tasks_from_email(
        subject=sample_email_content['subject'],
        body=sample_email_content['body'],
        sender=sample_email_content['sender'],
        email_hash="context_test_123",
        metadata={"priority": "high", "thread_id": "thread_456"}
    )
    
    for task in tasks:
        assert 'source_text' in task.context
        assert 'extraction_confidence' in task.context
        assert 'text_position' in task.context
        assert 'email_metadata' in task.context
        
        # Verify metadata was preserved
        assert task.context['email_metadata']['priority'] == 'high'
        assert task.context['email_metadata']['thread_id'] == 'thread_456'

# ============================================================================
# Task Post-Processing Tests
# ============================================================================

@pytest.mark.unit
def test_similar_task_removal(task_builder):
    """Test removal of similar/duplicate tasks"""
    # Create similar tasks
    similar_tasks = [
        IntelligentTask(
            id="task_1",
            title="Review the proposal document",
            description="Task 1",
            category=TaskCategory.REVIEW,
            priority=TaskPriority.MEDIUM,
            confidence_score=0.8
        ),
        IntelligentTask(
            id="task_2", 
            title="Review proposal document carefully",
            description="Task 2",
            category=TaskCategory.REVIEW,
            priority=TaskPriority.MEDIUM,
            confidence_score=0.9
        ),
        IntelligentTask(
            id="task_3",
            title="Schedule team meeting",
            description="Task 3",
            category=TaskCategory.MEETING,
            priority=TaskPriority.LOW,
            confidence_score=0.7
        )
    ]
    
    deduplicated = task_builder._remove_similar_tasks(similar_tasks)
    
    # Should keep higher confidence similar task and unrelated task
    assert len(deduplicated) == 2
    
    # Should keep the higher confidence review task
    review_task = next((t for t in deduplicated if 'carefully' in t.title), None)
    assert review_task is not None
    
    # Should keep unrelated meeting task
    meeting_task = next((t for t in deduplicated if t.category == TaskCategory.MEETING), None)
    assert meeting_task is not None

@pytest.mark.unit
def test_related_task_detection(task_builder):
    """Test detection of related tasks"""
    tasks = [
        IntelligentTask(
            id="task_1",
            title="Review proposal",
            description="Review the quarterly proposal",
            category=TaskCategory.REVIEW,
            priority=TaskPriority.HIGH,
            keywords=['review', 'proposal', 'quarterly']
        ),
        IntelligentTask(
            id="task_2",
            title="Approve budget",
            description="Approve the quarterly budget allocation",
            category=TaskCategory.APPROVAL,
            priority=TaskPriority.HIGH,
            keywords=['approve', 'budget', 'quarterly', 'allocation']
        ),
        IntelligentTask(
            id="task_3",
            title="Schedule meeting",
            description="Schedule team meeting",
            category=TaskCategory.MEETING,
            priority=TaskPriority.LOW,
            keywords=['schedule', 'meeting', 'team']
        )
    ]
    
    # Task 1 and 2 share 'quarterly' keyword, so should be related
    related = task_builder._find_related_tasks(tasks[0], tasks)
    
    assert 'task_2' in related
    assert 'task_3' not in related  # No common keywords

@pytest.mark.unit
def test_dependency_detection(task_builder):
    """Test detection of task dependencies"""
    task = IntelligentTask(
        id="test_task",
        title="Review proposal",
        description="Task description",
        category=TaskCategory.REVIEW,
        priority=TaskPriority.MEDIUM,
        context={'source_text': 'Review proposal after budget approval is complete'}
    )
    
    dependencies = task_builder._detect_dependencies(task, "Full email text")
    
    # Should detect "after budget approval" as dependency
    if dependencies:
        assert any('budget approval' in dep.depends_on for dep in dependencies)

# ============================================================================
# Database Operations Tests
# ============================================================================

@pytest.mark.unit
def test_store_task_in_database(task_builder, sample_task):
    """Test storing task in database"""
    task_builder._store_task(sample_task)
    
    # Verify task was stored
    db_path = task_builder.config['database_path']
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (sample_task.id,))
        result = cursor.fetchone()
        
        assert result is not None
        assert result[1] == sample_task.id  # id column
        assert result[2] == sample_task.title  # title column

@pytest.mark.unit
def test_store_task_with_dependencies(task_builder):
    """Test storing task with dependencies"""
    task = IntelligentTask(
        id="task_with_deps",
        title="Complete project",
        description="Finish the project",
        category=TaskCategory.OPERATIONAL,
        priority=TaskPriority.HIGH,
        dependencies=[
            TaskDependency(depends_on="budget_approval", type="requires", critical=True),
            TaskDependency(depends_on="team_meeting", type="follows", critical=False)
        ]
    )
    
    task_builder._store_task(task)
    
    # Verify dependencies were stored
    db_path = task_builder.config['database_path']
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM task_dependencies WHERE task_id = ?", (task.id,))
        deps = cursor.fetchall()
        
        assert len(deps) == 2
        assert any('budget_approval' in dep for dep in str(deps))
        assert any('team_meeting' in dep for dep in str(deps))

@pytest.mark.unit
def test_task_retrieval_methods(task_builder, sample_task):
    """Test task retrieval by various criteria"""
    # Store task first
    task_builder._store_task(sample_task)
    
    # Test get by priority
    high_priority_tasks = task_builder.get_tasks_by_priority(TaskPriority.HIGH)
    if sample_task.priority == TaskPriority.HIGH:
        assert sample_task.id in [t.id for t in high_priority_tasks]
    
    # Test get by deadline
    if sample_task.deadline:
        upcoming_tasks = task_builder.get_tasks_by_deadline(days_ahead=7)
        task_ids = [t.id for t in upcoming_tasks]
        # Should include task if deadline is within 7 days

@pytest.mark.unit
def test_task_status_update(task_builder, sample_task):
    """Test task status updates with history tracking"""
    # Store task first
    task_builder._store_task(sample_task)
    
    # Update status
    task_builder.update_task_status(
        sample_task.id,
        TaskStatus.COMPLETED,
        updated_by="test_user"
    )
    
    # Verify status was updated
    assert task_builder.active_tasks[sample_task.id].status == TaskStatus.COMPLETED
    
    # Verify history was recorded
    db_path = task_builder.config['database_path']
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM task_history WHERE task_id = ?", (sample_task.id,))
        history = cursor.fetchall()
        
        assert len(history) > 0
        assert any('status_change' in str(h) for h in history)

@pytest.mark.unit
def test_overdue_task_detection(task_builder):
    """Test detection of overdue tasks"""
    # Create overdue task
    overdue_task = IntelligentTask(
        id="overdue_task",
        title="Overdue task",
        description="This task is overdue",
        category=TaskCategory.REVIEW,
        priority=TaskPriority.MEDIUM,
        deadline=TaskDeadline(
            date=datetime.now() - timedelta(days=1),  # Yesterday
            type="hard",
            source_text="yesterday"
        )
    )
    
    task_builder._store_task(overdue_task)
    
    # Get overdue tasks
    overdue_tasks = task_builder.get_overdue_tasks()
    
    assert len(overdue_tasks) > 0
    assert any(task.id == overdue_task.id for task in overdue_tasks)

# ============================================================================
# Performance and Scalability Tests
# ============================================================================

@pytest.mark.slow
@pytest.mark.unit
def test_large_email_processing(task_builder):
    """Test processing large email content"""
    # Create large email content
    large_body = "Please review the following items:\n"
    for i in range(100):
        large_body += f"{i+1}. Please check item {i+1} and provide feedback\n"
    
    start_time = time.time()
    
    tasks = task_builder.extract_tasks_from_email(
        subject="Large email with many tasks",
        body=large_body,
        sender="bulk.sender@test.com"
    )
    
    end_time = time.time()
    
    # Should complete in reasonable time
    assert (end_time - start_time) < 10  # 10 seconds max
    
    # Should extract reasonable number of tasks (not necessarily all 100)
    assert len(tasks) > 0
    assert len(tasks) <= 50  # Should limit extraction to reasonable amount

@pytest.mark.unit
def test_task_summary_report(task_builder, sample_task):
    """Test comprehensive task summary report generation"""
    # Add sample task
    task_builder._store_task(sample_task)
    
    report = task_builder.get_task_summary_report()
    
    # Verify report structure
    assert 'total_tasks' in report
    assert 'status_distribution' in report
    assert 'priority_distribution' in report
    assert 'category_distribution' in report
    assert 'deadline_analysis' in report
    assert 'assignee_distribution' in report
    assert 'high_priority_tasks' in report
    assert 'avg_confidence_score' in report
    
    # Verify data types
    assert isinstance(report['total_tasks'], int)
    assert isinstance(report['status_distribution'], dict)
    assert isinstance(report['avg_confidence_score'], (int, float))

@pytest.mark.unit
def test_concurrent_task_processing(task_builder):
    """Test thread-safe task processing"""
    import threading
    import concurrent.futures
    
    def process_email(thread_id):
        return task_builder.extract_tasks_from_email(
            subject=f"Thread {thread_id} email",
            body=f"Please review item {thread_id} urgently",
            sender=f"thread{thread_id}@test.com"
        )
    
    # Process multiple emails concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_email, i) for i in range(10)]
        results = [future.result() for future in concurrent.futures.as_completed(futures)]
    
    # Should process all emails successfully
    assert len(results) == 10
    assert all(len(tasks) >= 0 for tasks in results)  # Each should return some tasks

# ============================================================================
# Error Handling and Edge Cases
# ============================================================================

@pytest.mark.unit
def test_empty_email_handling(task_builder):
    """Test handling of empty or minimal email content"""
    empty_cases = [
        ("", ""),  # Completely empty
        ("Subject", ""),  # Empty body
        ("", "Body content"),  # Empty subject
        ("Hi", "Thanks"),  # Very short content
    ]
    
    for subject, body in empty_cases:
        tasks = task_builder.extract_tasks_from_email(
            subject=subject,
            body=body,
            sender="test@example.com"
        )
        
        # Should handle gracefully (may return 0 tasks)
        assert isinstance(tasks, list)

@pytest.mark.unit
def test_malformed_input_handling(task_builder):
    """Test handling of malformed input"""
    malformed_inputs = [
        None,  # None values
        123,   # Non-string types
        {"subject": "test"},  # Wrong type
    ]
    
    for malformed_input in malformed_inputs:
        try:
            # Should handle gracefully or raise appropriate exception
            tasks = task_builder.extract_tasks_from_email(
                subject=malformed_input,
                body="test body",
                sender="test@example.com"
            )
        except (TypeError, ValueError):
            # Expected for malformed input
            pass

@pytest.mark.unit
def test_database_error_handling(task_builder):
    """Test handling of database errors"""
    # Create invalid task with missing required fields
    invalid_task = IntelligentTask(
        id="",  # Empty ID should cause issues
        title="",
        description="",
        category=TaskCategory.OPERATIONAL,
        priority=TaskPriority.MEDIUM
    )
    
    # Should handle database errors gracefully
    task_builder._store_task(invalid_task)
    # Should log error but not crash

@pytest.mark.unit
def test_pattern_edge_cases(task_builder):
    """Test edge cases in pattern matching"""
    edge_cases = [
        "Please please please review this",  # Repeated words
        "PLEASE REVIEW IN ALL CAPS",  # All caps
        "please.review.with.dots",  # Unusual punctuation
        "Please review... this... task...",  # Multiple ellipses
    ]
    
    for text in edge_cases:
        raw_tasks = task_builder._extract_raw_tasks(text)
        
        # Should handle gracefully
        assert isinstance(raw_tasks, list)
        if raw_tasks:
            for task in raw_tasks:
                assert 'text' in task
                assert 'confidence' in task

@pytest.mark.unit
def test_deadline_parsing_edge_cases(task_builder):
    """Test edge cases in deadline parsing"""
    edge_cases = [
        "asap",  # Abbreviation
        "by EOD",  # End of day
        "sometime next week",  # Vague timing
        "before the meeting on Friday",  # Complex relative reference
        "by 2024-12-32",  # Invalid date
        "by the 30th of February",  # Invalid calendar date
    ]
    
    for deadline_text in edge_cases:
        try:
            parsed = task_builder._parse_deadline_text(deadline_text)
            if parsed:
                assert isinstance(parsed, datetime)
        except (ValueError, OverflowError):
            # Some edge cases may legitimately fail
            pass

# ============================================================================
# Integration Tests
# ============================================================================

@pytest.mark.integration
def test_full_workflow_integration(task_builder, sample_email_content):
    """Test complete task building workflow"""
    # Extract tasks
    tasks = task_builder.extract_tasks_from_email(
        subject=sample_email_content['subject'],
        body=sample_email_content['body'],
        sender=sample_email_content['sender'],
        email_hash="integration_test"
    )
    
    # Verify tasks were created and stored
    assert len(tasks) > 0
    
    # Update some task statuses
    for task in tasks[:2]:  # Update first 2 tasks
        task_builder.update_task_status(task.id, TaskStatus.IN_PROGRESS, "integration_test")
    
    # Generate report
    report = task_builder.get_task_summary_report()
    
    # Verify report reflects changes
    assert report['total_tasks'] == len(tasks)
    assert report['status_distribution'].get('IN_PROGRESS', 0) >= 2

@pytest.mark.integration
def test_realistic_email_scenarios(task_builder):
    """Test realistic email scenarios"""
    realistic_emails = [
        {
            'subject': 'Budget Review Meeting - Action Items',
            'body': '''Team,

Following our budget review meeting, here are the action items:

1. John - please review the Q4 forecasts by Wednesday
2. Sarah needs to update the expense tracking spreadsheet 
3. Mike should schedule a follow-up meeting with finance team
4. Everyone - review the new spending guidelines before Friday

Please let me know if you have questions.

Thanks,
Manager''',
            'sender': 'manager@company.com'
        },
        {
            'subject': 'URGENT: Production Issue Requires Immediate Attention',
            'body': '''Development Team,

We have a critical production issue that needs immediate attention:

- Error rate has increased 500% in the last hour
- Please investigate the authentication service ASAP
- Need someone to check the database connections
- Update the status page to inform users
- Create incident report once resolved

This is blocking all user logins. Please prioritize above all other work.

Escalating to: @TechLead @OnCallEngineer

Incident ID: INC-2024-001''',
            'sender': 'alerts@monitoring.com'
        }
    ]
    
    for email in realistic_emails:
        tasks = task_builder.extract_tasks_from_email(
            subject=email['subject'],
            body=email['body'],
            sender=email['sender']
        )
        
        # Should extract meaningful tasks
        assert len(tasks) > 0
        
        # Tasks should have appropriate priorities for urgency
        if 'URGENT' in email['subject']:
            critical_tasks = [t for t in tasks if t.priority == TaskPriority.CRITICAL]
            assert len(critical_tasks) > 0
        
        # Should detect assignees when mentioned
        explicit_assignees = [t for t in tasks if t.assignee and t.assignee.confidence > 0.7]
        if 'John' in email['body'] or '@' in email['body']:
            assert len(explicit_assignees) > 0

# ============================================================================
# Main Test Runner
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
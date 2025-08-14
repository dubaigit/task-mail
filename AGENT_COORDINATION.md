# Agent Coordination Hub

## Direction Snapshot
**Phase**: Implementation  
**Health**: 🟢 Green  
**Course**: Pivot to production scale - full email volume processing  
**Last Updated**: 2025-08-14T00:00:00Z  

### Current Objective
Deploy production-ready email intelligence system capable of processing 2+ months of emails (1000s-10000s) by default with real-time task generation and GPT-5 integration.

### Critical Requirements
- ✅ Process 2+ months of emails by default (potentially 10,000+ emails)
- ✅ Production-ready deployment, no prototyping
- ✅ Expandable timeframe controls in UI (2 months default, user adjustable)
- ✅ Real-time task generation with GPT-5 integration
- ✅ All features from specification working at scale

## Context Summary

### Project State
The email intelligence system needs immediate pivot from prototype to production-scale implementation. Current codebase has significant foundation with:
- **Existing Files**: email_intelligence_engine_optimized.py, email_intelligence_engine_async.py, apple_mail_db_reader_async.py
- **GPT-5 Integration**: gpt5_email_integration.py, gpt5_action_integration.py, email_processor_gpt5.py  
- **UI Foundation**: task_focused_interface.html, index.html
- **Configuration**: gpt5_config.json, email_intelligence_config.py

Requires optimization for handling 10,000+ emails with production-grade performance and reliability.

### Key Technical Decisions
1. **Database**: SQLite with optimized indexing for 10,000+ emails
2. **Processing**: Async batch processing with connection pooling
3. **AI Integration**: GPT-5 for intelligent task extraction at scale
4. **Architecture**: Event-driven with background workers
5. **UI**: Real-time updates with WebSocket for large datasets

### Current Blockers
- None identified yet (fresh production build)

## Task Ledger

### Active Tasks

| Task ID | Agent | Status | Priority | Description | Dependencies | Started | ETA |
|---------|-------|--------|----------|-------------|--------------|---------|-----|
| IMPL-001 | backend-architect | PENDING | CRITICAL | Design scalable email processing pipeline | None | - | 2h |
| IMPL-002 | performance-optimizer | PENDING | HIGH | Implement caching and batching for 10k+ emails | IMPL-001 | - | 3h |
| IMPL-003 | gpt5-integrator | PENDING | HIGH | Integrate GPT-5 for task generation | IMPL-001 | - | 2h |
| IMPL-004 | ui-developer | PENDING | MEDIUM | Build expandable timeframe controls | IMPL-001 | - | 2h |
| IMPL-005 | database-architect | PENDING | HIGH | Design schema for large-scale email storage | IMPL-001 | - | 1h |
| IMPL-006 | testing-engineer | PENDING | MEDIUM | Create load tests for 10k+ emails | IMPL-002 | - | 2h |
| IMPL-007 | deployment-engineer | PENDING | LOW | Setup production deployment pipeline | IMPL-001-006 | - | 1h |

### Completed Tasks

| Task ID | Agent | Completed | Description | Output |
|---------|-------|-----------|-------------|--------|
| - | - | - | - | - |

### Blocked Tasks

| Task ID | Blocker | Description | Resolution Path |
|---------|---------|-------------|-----------------|
| - | - | - | - |

## Agent Registry

### Available Agents
- **backend-architect**: System design and architecture decisions
- **performance-optimizer**: Scaling and optimization for large datasets  
- **gpt5-integrator**: AI model integration and prompt engineering
- **ui-developer**: Frontend components and user experience
- **database-architect**: Schema design and query optimization
- **testing-engineer**: Load testing and quality assurance
- **deployment-engineer**: Production deployment and DevOps

### Agent Communication Protocol
1. Check Task Ledger before spawning new agents
2. Update status immediately upon task start
3. Document outputs in designated locations
4. Signal completion with updated ledger entry

## Work Distribution

### Phase 1: Foundation (Hours 0-2)
**backend-architect**: Database schema, indexing strategy, connection pooling design  
**python-pro**: Apple Mail reader optimization, async fetch implementation  
**ai-engineer**: GPT-5 API setup, prompt engineering for scale  
**frontend-developer**: UI scaffold with timeframe controls

### Phase 2: Core Implementation (Hours 2-4)
**backend-architect**: Event system, caching layer, worker processes  
**python-pro**: Batch processing pipeline, progress tracking  
**ai-engineer**: Task extraction logic, batch AI processing  
**frontend-developer**: Real-time updates, efficient list rendering

### Phase 3: Integration (Hours 4-6)
**backend-architect**: API endpoints, WebSocket setup  
**python-pro**: Performance optimization, error recovery  
**ai-engineer**: Context management, rate limiting  
**frontend-developer**: Progress indicators, error handling UI

### Phase 4: Testing & Optimization (Hours 6-8)
**All agents**: Load testing with 10,000+ emails, performance tuning, bug fixes

## Integration Points

### API Contracts
```python
# Email fetch endpoint
POST /api/emails/fetch
{
  "months": 2,  # Default 2, expandable
  "force_refresh": false
}

# Task extraction endpoint
POST /api/tasks/extract
{
  "email_ids": [],  # Batch processing
  "use_ai": true
}

# Real-time updates
WS /ws/updates
{
  "type": "progress|task|error",
  "data": {}
}
```

### Database Schema Core
```sql
-- Optimized for 10,000+ emails
CREATE TABLE emails (
  id INTEGER PRIMARY KEY,
  message_id TEXT UNIQUE,
  date_received DATETIME INDEXED,
  processed BOOLEAN DEFAULT 0 INDEXED,
  -- Additional fields
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  email_id INTEGER INDEXED,
  priority INTEGER INDEXED,
  created_at DATETIME INDEXED,
  -- Additional fields
);
```

## Performance Targets
- Email fetch: < 30 seconds for 10,000 emails
- Task extraction: < 5 seconds per 100 emails
- UI render: < 100ms for 1000 items
- Memory usage: < 500MB for full dataset

## Success Metrics
1. Successfully process 2+ months of emails (10,000+)
2. Extract actionable tasks with 90%+ accuracy
3. Real-time UI updates during processing
4. Sub-second response times for user interactions
5. Zero data loss during batch operations

## Next Agent Instructions

Each agent should:
1. Review their assigned context and tasks
2. Check existing files mentioned in their context
3. Build production-ready components (no prototypes)
4. Optimize for scale (1000s-10,000s of emails)
5. Implement proper error handling and logging
6. Update this file with progress and blockers

**CRITICAL**: This is a production system. Every component must handle thousands of emails efficiently. Default to 2 months of data, expandable by user.

## Quality Gates

### Production Readiness Checklist
- [ ] Processes 2+ months of emails without timeout
- [ ] Handles 10,000+ emails efficiently
- [ ] Response time < 3s for UI interactions
- [ ] GPT-5 task generation < 2s per email batch
- [ ] Memory usage stable under load
- [ ] Error recovery mechanisms in place
- [ ] Monitoring and logging configured
- [ ] Deployment scripts tested

### Performance Benchmarks
- **Email Processing**: 100 emails/second minimum
- **Task Generation**: 50 tasks/second via GPT-5
- **UI Response**: < 100ms for local operations
- **Memory Usage**: < 2GB for 10k emails
- **Database Queries**: < 50ms for filtered searches

## Change Log

### 2025-08-14 - Scope Expansion to Production Scale
- **Change**: Pivoted from prototype to production-ready system
- **Reason**: User requires immediate deployment with full email volume
- **Impact**: All components must handle 1000s-10000s of emails
- **Decisions**:
  - Default timeframe: 2+ months
  - Implement background processing
  - Add caching layer for performance
  - Design for horizontal scaling

## Coordination Rules

### Idempotency Requirements
- Each agent must use unique IDEMPOTENCY_KEY
- No duplicate processing of same task
- State transitions must be atomic

### Communication Patterns
```
context-manager → agents: Task assignment via ledger
agents → context-manager: Status updates and outputs
agents ↔ agents: Direct communication for dependencies
```

### File Organization
```
/Users/iamomen/apple-mcp/
├── AGENT_COORDINATION.md (this file)
├── email_intelligence_engine.py (core processing)
├── gpt5_email_integration.py (AI integration)
├── email_intelligence_models.py (data models)
├── email_intelligence_config.py (configuration)
├── unified_email_interface.py (UI layer)
├── performance_cache.py (caching layer)
└── tests/ (test suite)
```

## Next Actions

1. **IMMEDIATE**: backend-architect designs scalable pipeline
2. **PARALLEL**: database-architect creates schema while performance-optimizer plans caching
3. **SEQUENTIAL**: After core design, spawn UI and integration agents
4. **FINAL**: Testing and deployment after all components ready

## Success Metrics

- ✅ System processes 2+ months of emails on first run
- ✅ All emails analyzed and tasks generated
- ✅ UI responsive with 10,000+ emails loaded
- ✅ Production deployment successful
- ✅ Zero data loss or corruption
- ✅ User can expand timeframe without system degradation

---
*Coordination hub maintained by context-manager. All agents must check and update this file.*
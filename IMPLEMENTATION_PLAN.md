# Task Mail - Full Implementation Plan
## Aligning with CLAUDE.md Architecture

### 🎯 Core Architecture Requirements (from CLAUDE.md)

1. **Apple Mail SQLite** → Read-only metadata source
2. **Supabase** → Single source of truth for all state
3. **Backend API** → Express.js with auth, validation, routes
4. **Frontend Dashboard** → React 18 + TypeScript (keep as-is)
5. **Agent GPT-5** → AI classification, tasks, drafts, queries
6. **Draft Sync** → AppleScript automation (Mac-only)
7. **Automation Engine** → Rule-based email processing

---

## 📊 Current State Analysis

### ✅ What's Working (Keep These)
```
dashboard/frontend/          # UI is complete - DO NOT MODIFY
├── src/components/         # All UI components working
├── src/stores/            # Zustand state management
└── src/api/              # API integration

server.js                  # Main backend server - working
src/database/             # Database layer - mostly working
src/middleware/           # Security, auth, CORS - working
database/                 # SQLite and migrations - working
```

### ❌ What's Missing/Broken
```
1. Full email field support (to/cc/bcc/attachments)
2. Proper Apple Mail → Supabase sync with all fields
3. GPT-5 draft generation with proper context
4. AppleScript draft sync implementation
5. Automation rules engine
6. RAG-powered search
```

### 🗑️ What to Remove/Simplify
```
src/knowledge-base/        # Over-engineered, not in CLAUDE.md
src/domain/               # DDD overkill for this project
src/fixes/                # Temporary patches
Multiple duplicate services in src/services/
```

---

## 🏗️ Implementation Plan

### Phase 1: Database Schema Enhancement ✅
**Status**: COMPLETED
```sql
-- Already added to emails table:
- to_recipients TEXT[]
- cc_recipients TEXT[]
- bcc_recipients TEXT[]
- reply_to TEXT
- message_content TEXT
- has_attachments BOOLEAN
- attachment_count INTEGER
- attachments JSONB
- conversation_id BIGINT
- is_read BOOLEAN
- is_flagged BOOLEAN
- flag_color INTEGER
- priority TEXT
- labels TEXT[]
- folder_path TEXT
```

### Phase 2: Core Email Sync Service
**Files to Create/Update:**

#### 1. `src/services/EnhancedAppleMailSync.js` (NEW)
```javascript
// Consolidates and replaces:
// - apple-mail-sync.js
// - AppleMailSyncEngine.js
// - EmailSyncService.js

class EnhancedAppleMailSync {
  // Features:
  // - Read Apple Mail SQLite with full field support
  // - Extract to/cc/bcc from recipients table
  // - Get attachments from attachments table
  // - Get full email content from message_data
  // - Smart incremental sync
  // - Conflict resolution
  // - Progress tracking
}
```

#### 2. `src/services/GPTService.js` (NEW)
```javascript
// Consolidates and replaces:
// - AIChatBotService.js
// - enhanced-ai-service.js
// - ai_service.js (root level)

class GPTService {
  constructor() {
    // Use GPT-5 mini/nano as per CLAUDE.md
    this.models = {
      primary: 'gpt-5-mini',
      fallback: 'gpt-5-nano'
    };
  }
  
  // Core methods:
  classifyEmail(email)
  generateDraft(email, context)
  searchEmails(query, rag_context)
  generateTasks(email)
  processAutomationRule(rule, email)
}
```

#### 3. `src/services/DraftAppleScriptSync.js` (NEW)
```javascript
// Mac-only draft synchronization
class DraftAppleScriptSync {
  async syncDraftToAppleMail(draft) {
    // Execute AppleScript to create draft in Mail.app
    const script = `
      tell application "Mail"
        set newMessage to make new outgoing message with properties {
          subject:"${draft.subject}",
          content:"${draft.content}"
        }
        repeat with recipient in ${JSON.stringify(draft.to)}
          tell newMessage
            make new to recipient with properties {address:recipient}
          end tell
        end repeat
        save newMessage
      end tell
    `;
    exec(`osascript -e '${script}'`);
  }
}
```

#### 4. `src/services/AutomationEngine.js` (NEW)
```javascript
class AutomationEngine {
  // Process user-defined rules
  async processEmail(email) {
    const rules = await this.getRules();
    for (const rule of rules) {
      if (this.matchesCondition(email, rule.condition)) {
        await this.executeAction(email, rule.action);
      }
    }
  }
}
```

### Phase 3: API Routes Consolidation
**Files to Update:**

#### `src/api/routes/emails.js` (UPDATE)
```javascript
// Add endpoints:
POST /api/emails/sync          # Trigger sync
GET  /api/emails/search        # RAG search
POST /api/emails/draft         # Generate draft
POST /api/emails/send-draft    # Send via AppleScript
```

#### `src/api/routes/automation.js` (NEW)
```javascript
// Automation rules management
GET    /api/automation/rules
POST   /api/automation/rules
PUT    /api/automation/rules/:id
DELETE /api/automation/rules/:id
POST   /api/automation/test
```

### Phase 4: Database Queries
**Files to Create:**

#### `src/database/queries/EmailQueries.js` (NEW)
```javascript
// Optimized queries for email operations
class EmailQueries {
  // Full email fetch with all fields
  async getFullEmail(id) {
    return `
      SELECT 
        e.*,
        array_agg(DISTINCT to_r.address) as to_recipients,
        array_agg(DISTINCT cc_r.address) as cc_recipients,
        array_agg(DISTINCT bcc_r.address) as bcc_recipients,
        json_agg(DISTINCT a.*) as attachments
      FROM emails e
      LEFT JOIN recipients to_r ON ...
      LEFT JOIN recipients cc_r ON ...
      LEFT JOIN recipients bcc_r ON ...
      LEFT JOIN attachments a ON ...
      WHERE e.id = $1
      GROUP BY e.id
    `;
  }
}
```

### Phase 5: Configuration Simplification
**Files to Keep:**
```
.env                         # Main config
config/ecosystem.config.js   # PM2 config
docker-compose.yml          # Infrastructure
```

**Files to Remove:**
```
src/config/ConfigurationManager.js     # Over-complex
src/config/ConfigurationMigrator.js    # Not needed
src/config/ConsolidatedConfigManager.js # Redundant
→ Replace with simple config/index.js
```

---

## 📁 Final File Structure

```
task-mail/
├── server.js                    # Main backend (KEEP)
├── ai_service.js               # → Move to src/services/GPTService.js
│
├── src/
│   ├── services/               # Core services only
│   │   ├── EnhancedAppleMailSync.js    # NEW - Main sync
│   │   ├── GPTService.js               # NEW - All AI ops
│   │   ├── DraftAppleScriptSync.js     # NEW - Draft sync
│   │   └── AutomationEngine.js         # NEW - Rules engine
│   │
│   ├── database/               
│   │   ├── OptimizedDatabaseAgent.js   # KEEP
│   │   ├── queries/                    # NEW
│   │   │   ├── EmailQueries.js
│   │   │   └── TaskQueries.js
│   │   └── migrations/                 # KEEP
│   │
│   ├── api/
│   │   └── routes/
│   │       ├── email-routes.js         # UPDATE
│   │       ├── task-routes.js          # KEEP
│   │       ├── automation-routes.js    # NEW
│   │       └── ai-routes.js            # UPDATE
│   │
│   ├── middleware/             # KEEP ALL
│   └── utils/                  # KEEP
│
├── dashboard/frontend/         # DO NOT MODIFY
│
├── database/
│   ├── apple_mail_replica.db  # Apple Mail SQLite
│   └── migrations/             # Supabase migrations
│
├── supabase/                   # Supabase config
└── docker-compose.yml          # Infrastructure
```

---

## 🚀 Implementation Steps

### Week 1: Core Sync
1. Create `EnhancedAppleMailSync.js` with full field support
2. Test sync with all email fields (to/cc/bcc/attachments)
3. Verify data in Supabase

### Week 2: AI Integration
1. Create `GPTService.js` with GPT-5 models
2. Implement draft generation with context
3. Add RAG-powered search

### Week 3: Draft Sync & Automation
1. Implement `DraftAppleScriptSync.js`
2. Create `AutomationEngine.js`
3. Add automation rules UI endpoints

### Week 4: Testing & Polish
1. End-to-end testing
2. Performance optimization
3. Documentation update

---

## 🔑 Key Principles (from CLAUDE.md)

1. **Supabase = Only DB** - All state in Supabase
2. **Apple Mail = Read-Only** - Never write to SQLite
3. **Draft Sync = AppleScript** - Mac-only feature
4. **Chat Bot = First-Class** - RAG, drafts, automation
5. **Security First** - JWT, sanitization, rate limiting

---

## ⚠️ Critical Notes

1. **DO NOT MODIFY** `dashboard/frontend/` - UI is complete
2. **REMOVE** over-engineered code not in CLAUDE.md
3. **CONSOLIDATE** duplicate services into single files
4. **USE** GPT-5 models as specified, not GPT-4
5. **IMPLEMENT** AppleScript for draft sync (Mac-only)

---

## 📊 Success Metrics

- [ ] All emails sync with complete fields
- [ ] GPT-5 generates contextual drafts
- [ ] Drafts appear in Apple Mail via AppleScript
- [ ] Automation rules process emails
- [ ] RAG search returns relevant results
- [ ] Single source of truth in Supabase


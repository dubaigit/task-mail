# CLAUDE.md

Purpose: Development guidance for working on this repo with Claude Code (claude.ai/code).
This project uses Supabase as the single database and integrates directly with Apple Mail’s local SQLite (Envelope Index).
Drafts are synced back into Apple Mail via AppleScript automation (Mac-only).
The dashboard also includes a chat bot assistant with retrieval, drafting, and automation capabilities.

⸻

Quick start

# Development setup
npm install && npm run install:frontend && npm run build:frontend

# Start full stack
pm2 start ecosystem.config.js

# Development mode
node server.js                         # Backend API (port 8000)
cd dashboard/frontend && npm start     # Frontend React (port 3000)

# Infrastructure
docker-compose up -d                   # Supabase + Redis containers

# Testing
npm test                               # Backend Jest tests
npm run test:database                  # DB integration
cd dashboard/frontend && npm test      # Frontend React tests
npm run test:e2e                       # Playwright end-to-end

# Database
npm run db:init                        # Initialize schema in Supabase

# Production
pm2 start ecosystem.config.js --env production


⸻

Architecture overview
	•	Apple Mail SQLite (Envelope Index)
	•	Backend reads metadata directly: sender, subject, message_id, date, folder.
	•	Strictly read-only.
	•	API Backend (server.js)
	•	Express.js app (auth, validation, routes).
	•	Reads Apple Mail SQLite.
	•	Writes all state into Supabase.
	•	Exposes REST APIs + WebSocket for frontend.
	•	Supabase (single DB)
	•	Source of truth for emails, tasks, users, tags, drafts, rules.
	•	Managed with migrations in database/migrations/.
	•	Frontend Dashboard
	•	React 18 + TypeScript + Zustand.
	•	Reads/writes via backend APIs.
	•	Includes task/email centric UI and a chat bot panel.
	•	Agent GPT-5
	•	Reads from Supabase.
	•	Classifies emails, generates tasks, creates drafts, answers user questions.
	•	Writes results back to Supabase.
	•	Draft Mail
	•	Stored in Supabase.
	•	Synced back into Apple Mail’s Drafts folder via AppleScript.
	•	Automation Engine
	•	Executes user-defined rules (auto-reply, delegate, tag, forward).
	•	Rules defined conversationally or via UI.
	•	Stored declaratively in Supabase.

⸻

Data flow
	1.	Backend → Apple Mail SQLite: direct read of metadata.
	2.	Backend ↔ Supabase: all persistence.
	3.	Frontend ↔ Backend: API calls and realtime updates.
	4.	Agent GPT-5 ↔ Supabase: classification, answering queries, draft generation.
	5.	Drafts in Supabase → Apple Mail Drafts folder via AppleScript automation.
	6.	Automation rules in Supabase → Backend execution on incoming mail.

⸻

Draft sync (Mac-only)

Apple Mail SQLite cannot be written safely. Drafts are synced back using AppleScript automation:

AppleScript example

tell application "Mail"
    set newMessage to make new outgoing message with properties {subject:"Draft from Supabase", content:"This is the synced draft body."}
    tell newMessage
        make new to recipient at end of to recipients with properties {address:"user@example.com"}
    end tell
    save newMessage
end tell

Node.js integration

import { exec } from "child_process";

function createDraft(subject, body, recipient) {
  const script = `
    tell application "Mail"
      set newMessage to make new outgoing message with properties {subject:"${subject}", content:"${body}"}
      tell newMessage
        make new to recipient at end of to recipients with properties {address:"${recipient}"}
      end tell
      save newMessage
    end tell
  `;
  exec(`osascript -e '${script}'`, (err) => {
    if (err) console.error("AppleScript error:", err);
  });
}

Flow
	1.	GPT-5 / frontend creates draft → stored in Supabase.
	2.	Backend worker queries unsynced drafts.
	3.	Runs AppleScript to create draft in Mail.app.
	4.	Marks draft as “synced” in Supabase.

⸻

Conversational AI (Chat Bot)

The interface includes a chat bot panel where users can interact naturally.
The chat bot is GPT-5 powered and has access to tools:
	•	RAG (Retrieval-Augmented Generation)
	•	Retrieves emails + context from Supabase.
	•	Supports natural queries (“what did John promise last week?”, “show all finance updates”).
	•	Drafting tool
	•	Generate new outgoing emails.
	•	Stored in Supabase → synced to Apple Mail Drafts.
	•	Automation tool
	•	Define rules via chat, e.g.:
	•	“Auto-reply to invoices with template A”
	•	“Forward HR emails to Alice”
	•	“Tag newsletters as low priority”
	•	Stored in Supabase; executed in backend.

⸻

Guardrails
	•	DB access: use OptimizedDatabaseAgent for Supabase queries. No raw SQL in routes.
	•	Apple Mail: SQLite is read-only. All writes must go through AppleScript.
	•	Chat bot tools: all actions (drafts, automations) must persist in Supabase before execution.
	•	API: validate inputs; return proper JSON + status codes; require JWT.
	•	Frontend: follow DDD folder conventions; keep components accessible.
	•	Security: SQL sanitization, CORS, JWT auth, rate limiting, logging.

⸻

Environment

.env (required):

OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=...
JWT_SECRET=your-32+char-secret
PORT=8000
CORS_ORIGIN=http://localhost:3000


⸻

Testing
	•	Backend: Jest + supertest.
	•	Frontend: React Testing Library.
	•	Database: Supabase integration tests.
	•	E2E: Playwright workflows.
	•	Bot tools: integration tests for RAG + draft sync + automation execution.

⸻

⚠️ Reminders:
	•	Supabase = only DB.
	•	Apple Mail SQLite = read-only source.
	•	Draft sync = AppleScript automation (Mac-only).
	•	Chat bot = first-class interface, with tools for retrieval, drafting, and automation.


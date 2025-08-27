---
description: Enhancement-first workflow + strict MCP routing (Serena + Morph + Sequential)
argument-hint: "<request or ticket title>"
---

## PHASE 1 — ENHANCE (PRINT THIS FIRST, DO NOT EXECUTE TOOLS YET)

You MUST first produce an **Enhanced Prompt** using the exact scaffold below, then stop and ask me to confirm. Do **not** run any tools before printing it.

**CLAUDE.md DISCOVERY (use Serena tools only):**
1) Try to locate CLAUDE.md up the tree:
   - mcp__serena__find_file "./CLAUDE.md"
   - mcp__serena__find_file "../CLAUDE.md"
   - mcp__serena__find_file "../../CLAUDE.md"
2) If not found, repo-wide:
   - mcp__serena__search_for_pattern '(^|/)CLAUDE\.md$'
3) For each path found:
   - mcp__serena__read_file "<path>"
   - Extract only rules relevant to the detected task type/contexts for PROJECT RULES.

**DETECT TASK TYPE & CONTEXTS**
- Primary intent: Implementation / Analysis / Debugging / Documentation / Architecture.
- Context categories: file-operations, testing, code-quality, operations.

**ENHANCED PROMPT (fill fully, no placeholders):**

Enhanced Prompt: $ARGUMENTS

DETECTED TASK TYPE:
Primary intent: [choose one]
Relevant contexts: [choose from file-operations/testing/code-quality/operations]

CONTEXT & MOTIVATION:
[3–5 sentences on current situation, impact, risks, why now]

CONTRARIAN ANALYSIS (EARLY):
- Are we fixing symptoms vs. root cause?
- Risky assumptions?
- Simpler approach that hits the bar?
- What if we do nothing?
- Any 10x alternative?

CONTRARIAN-INFORMED ADJUSTMENTS:
- [Root-cause angle / scope changes]
- [Assumption validation + risks]
- [Simpler path if viable]
- [Why action > inaction]
- [Potential 10x path]

EXTERNAL TOOLS & RESOURCES (DYNAMIC):
- Serena (semantic discovery, memory) — planned
- Morph Fast Apply (edits/moves) — planned
- Sequential (multi-step plan) — use if multi-stage/risky
- If needed: search past fixes via VCS (describe how)
- If needed: read local docs with Serena (find_file/read_file/search_for_pattern)

PROJECT RULES:
[Only the CLAUDE.md rules that apply here (bulleted, concise)]

OBJECTIVE:
[One crisp sentence of the intended outcome]

REQUIREMENTS (CONTRARIAN-INFORMED):
Original:
- [...]
- [...] 🔄
Adjusted:
- [Root-cause check]
- [Assumption validation]
- [Simpler-approach trial if applicable]
- [Measurement justifying action vs nothing]
- [10x exploration if promising]
- [Parallelizable items marked with 🔄]
- [Validation steps; all measurable]

EDGE CASES & ROBUSTNESS:
- [Inputs/bounds]
- [Concurrency]
- [External failures]
- [Security]
- [Performance]
- [Error recovery]

CONSTRAINTS:
- [Tech/time/resource/compat limits]

DELIVERABLES:
- [Specific outputs/patches/PR notes]
- [Docs updates]
- [Tests]

SUCCESS CRITERIA:
- [ ] Measurable outcome 1
- [ ] Measurable outcome 2
- [ ] All tests pass
- [ ] Root cause addressed
- [ ] Assumptions validated
- [ ] Simpler alternatives considered
- [ ] Action justified vs nothing
- [ ] Edge cases handled
- [ ] Docs updated

MEASURABLE OUTCOMES:
- [ ] Specific deliverable
- [ ] Quality metric
- [ ] Performance target
- [ ] UAT/acceptance

Stop after printing the Enhanced Prompt and wait for my confirmation.

---

## PHASE 2 — EXECUTE (ONLY AFTER I CONFIRM)

**Routing Rule**
- If multi-step/risky → plan with **Sequential**:  
  `/mcp__sequential-thinking__sequentialthinking "<short title>" "<goals/acceptance checks>"`
- **Serena** for semantic discovery & validation:
  - Project activation (if your server exposes it as a prompt):  
    `/mcp__serena__activate_project "."`
  - Inventory/analysis:  
    `/mcp__serena__get_symbols_overview "<path>"`  
    `/mcp__serena__find_symbol "<symbol>"`  
    `/mcp__serena__find_referencing_symbols "<symbol or id>"`
  - Pattern seeds & docs:  
    `/mcp__serena__search_for_pattern "<regex or token>"`  
    `/mcp__serena__find_file "<path>"` → `/mcp__serena__read_file "<path>"`
  - Memory:  
    `/mcp__serena__write_memory "<key>" "<summary>"` (use for plan + file list)
- **Morph Fast Apply** for **all edits/moves/writes**:
  - Scope / safety:
    `/mcp__morphllm-fast-apply__list_allowed_directories`
    `/mcp__morphllm-fast-apply__directory_tree "<dir>"`
  - Edit/FS ops:
    `/mcp__morphllm-fast-apply__edit_file "<path>" "<patch/diff or new content>"`
    `/mcp__morphllm-fast-apply__tiny_edit_file "<path>" "<mini patch>"`
    `/mcp__morphllm-fast-apply__write_file "<path>" "<content>"`
    `/mcp__morphllm-fast-apply__create_directory "<dir>"`
    `/mcp__morphllm-fast-apply__move_file "<src>" "<dst>"`
    `/mcp__morphllm-fast-apply__search_files "<glob or pattern>"`

**Hard Rules**
- Don’t run repo-wide regex via Serena; use Morph with explicit file lists discovered by Serena.
- Don’t touch files outside Morph’s `list_allowed_directories`.
- Keep changes atomic; validate between batches; stop on failures.
- Prefer shims/aliases for public API changes; document breaks in the Enhanced Prompt.

**Batch Loop Template**
1) Serena: discover symbols/refs and enumerate exact file set.
2) Morph: patch only those files.
3) Serena: validate (types/tests/build as your Serena server supports).
4) If red, loop back to Serena to refine scope; then Morph again.
5) Serena: write_memory a short summary of what changed + next steps.
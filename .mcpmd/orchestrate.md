ACK: sections read. Zen:gpt5✓ •

⏺ PLAN (no spawning or updates yet)
TodoWrite([
  {content: " Parallel Group A: Web research on Claude Code context window & overflow", status: "pending"},
  {content: " Parallel Group B: Local config & output analysis (repo/logs/Read() usage)", status: "pending"},
  {content: " Gate C: Synthesize causes + mitigations (Zen:gpt5) after A & B", status: "pending"},
  {content: " Aggregate findings into FINAL report", status: "pending"}
])

⏺ SPAWN — Parallel Group A (valid agents, Firecrawl MCP)
Task("search-specialist", `
  MISSION: Research “why Claude Code context fills quickly” and practical mitigations
  SCOPE: web
  TOOLS: Firecrawl MCP

  [SINGLE MESSAGE - BatchTool ALL operations]:

  // 1) Search & crawl
  mcp__firecrawl__firecrawl_search("Claude Code context window fills quickly prompt length context usage tips 2025")
  mcp__firecrawl__firecrawl_crawl(["https://…", "https://…"])

  // 2) Extract structured notes
  mcp__firecrawl__firecrawl_extract({
    "schema": { "title":"string", "summary":"string", "bullets":["array"], "date":"string", "url":"string" }
  })

  // 3) Write artifacts
  Write("research/context/findings.json", extracted_data)
  Write("research/context/summary.md", `
    # Web Findings: Context Growth
    - (bulleted causes & mitigations from extracted_data)
    - Cite 3–6 credible sources
  `)

  DELIVER: research/context/summary.md + findings.json
`)

⏺ SPAWN — Parallel Group B (valid agents, st recipes + repo scans)
Task("context-manager", `
  MISSION: Diagnose local causes of fast context growth (oversized outputs, Read() dumps, verbose st usage)
  SCOPE: .

  [SINGLE MESSAGE - BatchTool ALL operations]:

  const ST_FLAGS = "--no-emoji --mode summary";

  // 1) Quick repo pulse to artifacts (don’t spam stdout)
  Bash("mkdir -p reports || true")
  Bash("st ${ST_FLAGS} --depth 3 . > reports/repo-pulse.txt || true")
  Bash("st --no-emoji --mode ls --sort size --top 40 . > reports/top-size.txt || true")
  Bash("st --no-emoji --mode ls --sort date --top 50 . > reports/top-newest.txt || true")

  // 2) Look for patterns that bloat messages
  Bash("grep -R -n \"Read\$begin:math:text$\\" -n src/ > reports/read-call-sites.txt || true")
  Bash("grep -R -n \\"st --everything\\" -n . > reports/st-everything-usage.txt || true")
  Bash("grep -R -n \\"console\\\\.log\\\\(.*\\$end:math:text$\" -n src/ > reports/log-volume.txt || true")

  // 3) Write summary
  Write("reports/local-context-diagnosis.md", `
    # Local Diagnosis
    - Likely bloat sources: Read() dumping large files; 'st --everything'; excessive console output
    - See artifacts: repo-pulse, top-size, top-newest, read-call-sites, st-everything-usage, log-volume
  `)

  DELIVER: reports/local-context-diagnosis.md (+ supporting artifacts)
`)

Task("devops-troubleshooter", `
  MISSION: Inspect pipeline/task patterns that inflate context (long Bash stdout, repeated cat, partial-writes)
  SCOPE: .github/, scripts/, ci/, Task prompts

  [SINGLE MESSAGE - BatchTool ALL operations]:

  // 1) CI/log patterns that spam model context
  Bash("grep -R -n \"cat .*\" -n scripts/ .github/ > reports/ci-cat-usage.txt || true")
  Bash("grep -R -n \"npm list --depth=0\" -n scripts/ .github/ > reports/ci-npm-list-usage.txt || true")
  Bash("grep -R -n \"st --no-ignore\\|--everything\" -n scripts/ .github/ > reports/ci-st-heavy-flags.txt || true")

  // 2) Recommendations
  Write("reports/ci-mitigation.md", `
    # CI Mitigations to Reduce Context Usage
    - Redirect heavy CLI outputs to files (artifacts) not chat
    - Use 'st --mode summary --depth N' and scoped paths
    - Avoid 'st --everything' in CI; prefer filters (--type, --find, --newer-than)
    - Favor Write() artifacts over printing code/content inline
  `)

  DELIVER: reports/ci-mitigation.md
`)

⏺ GATE C — Synthesis (runs after A & B complete; uses Zen with gpt5)
Task("llm-ai-agents-and-eng-research", `
  MISSION: Synthesize root-causes & mitigations; create actionable playbook
  SCOPE: research/, reports/
  TOOLS: Zen MCP

  [SINGLE MESSAGE - BatchTool ALL operations]:

  // 1) Read artifacts (best-effort)
  try { Read("research/context/summary.md") } catch { }
  try { Read("reports/local-context-diagnosis.md") } catch { }
  try { Read("reports/ci-mitigation.md") } catch { }

  // 2) Deep analysis with Zen (model lock)
  mcp__zen__analyze({ scope: "src/**", model: "gpt5" })
  mcp__zen__challenge({ assumptions: "Context bloat comes from Read() dumps + verbose stdout", model: "gpt5" })

  // 3) Write playbook
  Write("reports/context-bloat-playbook.md", `
    # Context Control Playbook
    ## Root Causes
    - (summarize from artifacts + analysis)

    ## Quick Wins (Do these first)
    - Use 'st --no-emoji --mode summary --depth 3 <scoped-path>'
    - Redirect heavy outputs to files under reports/
    - NEVER dump large files via Read(); summarize or link
    - Prefer file lists over file content; attach via Write()

    ## Standard Operating Recipes
    - Smart-Tree:
      st --no-emoji --mode ls --sort size --top 20 src/
      st --no-emoji --type ts --search "TODO|FIXME" src/
      st --no-emoji --mode relations --focus src/index.ts --relations-filter imports

    ## CI Guardrails
    - Block 'st --everything' in CI
    - Enforce artifact redirects (> reports/*.txt|json)
    - Lint for 'Read(' code-dumps in Task bodies

    ## Verification
    - Metrics: tokens per message, artifact sizes, tasks per wave
  `)

  DELIVER: reports/context-bloat-playbook.md
`)

⏺ FINAL — Aggregate (valid agent; docs-architect)
Task("docs-architect", `
  MISSION: Produce FINAL consolidated report with links & next steps
  SCOPE: research/, reports/

  [SINGLE MESSAGE - BatchTool ALL operations]:

  // 1) Read inputs (best-effort)
  try { Read("research/context/summary.md") } catch { }
  try { Read("reports/local-context-diagnosis.md") } catch { }
  try { Read("reports/ci-mitigation.md") } catch { }
  try { Read("reports/context-bloat-playbook.md") } catch { }

  // 2) Final markdown
  Write("reports/FINAL-ORCHESTRATION-REPORT.md", `
    # FINAL REPORT — Claude Code Context Growth

    ## Web Research (A)
    - See research/context/summary.md

    ## Local Diagnosis (B)
    - See reports/local-context-diagnosis.md

    ## CI Mitigations
    - See reports/ci-mitigation.md

    ## Playbook (Synthesis, Zen:gpt5)
    - See reports/context-bloat-playbook.md

    ## Next Steps (Quick Wins)
    - Scope Smart-Tree calls; use summary mode
    - Redirect heavy CLI to artifacts
    - Replace Read() dumps with summaries & paths
  `)

  DELIVER: reports/FINAL-ORCHESTRATION-REPORT.md
`)

⏺ AFTER COMPLETION — Single TodoWrite update (no mid-run updates)
TodoWrite([
  {content: "Parallel Group A: Web research on Claude Code context window & overflow", status: "completed"},
  {content: "Parallel Group B: Local config & output analysis (repo/logs/Read() usage)", status: "completed"},
  {content:  Gate C: Synthesize causes + mitigations (Zen:gpt5) after A & B", status: "completed"},
  {content:  Aggregate findings into FINAL report", status: "completed"}
])
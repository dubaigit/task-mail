
One Instruction (Serena + Morph Fast Apply)

Route every request like this:
	•	Serena for semantic work: discover symbols, references, boundaries, and produce a safe plan.
	•	Morph Fast Apply for edits: fast, precise, high-throughput file changes from Serena’s plan.

Golden rules
	1.	Always activate & scope first (Serena → activate_project, then list dirs/files).
	2.	Discover before you edit (Serena → symbols/refs/graphs).
	3.	Edit with Morph (use edit_file/tiny_edit_file), not Serena regex, unless you need one-off guarded replacements.
	4.	Validate after each batch (Serena → execute_shell_command for type-check/tests).
	5.	Persist memory (Serena → write_memory) so follow-ups get faster.

⸻

Tool Map (exact to your servers)

Serena (analysis, planning, memory, guarded inserts)
	•	Project setup: activate_project, switch_modes, check_onboarding_performed, onboarding
	•	Repo read/search: list_dir, find_file, read_file, search_for_pattern
	•	Semantic graph: get_symbols_overview, find_symbol, find_referencing_symbols
	•	Structured code ops: insert_before_symbol, insert_after_symbol, replace_symbol_body
	•	Memory: write_memory, read_memory, list_memories, delete_memory
	•	Shell/validation: execute_shell_command
	•	Meta-thinking: think_about_*, prepare_for_new_conversation

Morph Fast Apply (edits, I/O, scale)
	•	Reads: read_file, read_multiple_files, get_file_info, directory_tree, list_directory, list_directory_with_sizes, list_allowed_directories, search_files
	•	Writes & edits: edit_file (preferred), tiny_edit_file, write_file, create_directory, move_file

⸻

Standard Operating Procedure (the LLM should follow this)
	1.	Project activation & scoping (Serena)
	•	check_onboarding_performed → run onboarding if false
	•	activate_project with repo root (or inferred CWD)
	•	list_dir / find_file to confirm target paths
	2.	Semantic discovery (Serena)
	•	If symbol-driven: find_symbol → find_referencing_symbols
	•	If exploratory: get_symbols_overview (file or folder)
	•	If pattern seed is given: search_for_pattern (to collect candidate files)
	3.	Plan the change (Serena)
	•	Summarize impacted symbols/files and the exact edits
	•	Where wrappers/shims are safer, use:
	•	insert_before_symbol / insert_after_symbol
	•	replace_symbol_body (for internal reshapes)
	•	Persist plan: write_memory (store target symbol, refs, file list, acceptance criteria)
	4.	Apply edits (Morph Fast Apply)
	•	Confirm scope using list_allowed_directories and directory_tree
	•	For each file/range, use edit_file (preferred) or tiny_edit_file for small patches
	•	For many files, prefilter with search_files then edit in batches
	•	Create missing modules/dirs with create_directory + write_file / move_file
	5.	Validate & iterate (Serena)
	•	execute_shell_command to run type-check/tests/lint (e.g., pnpm typecheck, go build, pytest -q)
	•	If failures, map back to symbols/refs and re-edit with Morph
	•	When green: write_memory to snapshot the migration details

⸻

Complex, copy-pasteable recipes (LLM can adapt args)

A) Safe symbol rename with deprecation shim (polyglot-friendly)

Goal: rename getUserData → fetchUser everywhere, keep builds green, add shim.

Plan
	1.	Serena:
	•	activate_project
	•	find_symbol { name: “getUserData” } → canonical target(s)
	•	find_referencing_symbols { symbol_id } → list of call sites
	•	insert_before_symbol { symbol_id, code: “export const getUserData = (…args) => fetchUser(…args) // TODO: remove in vNext” } (or language equivalent)
	•	write_memory { key: “rename:getUserData→fetchUser”, files: […], notes: […] }
	2.	Morph:
	•	For each referencing file from Serena, edit_file to replace only the symbol identifier at the call sites (skip strings/comments)
	•	Sweep comments/docs after (another Morph pass)
	3.	Serena:
	•	execute_shell_command { cmd: “pnpm typecheck && pnpm -s test -w” }
	•	If red, inspect failing files; re-run find_referencing_symbols to catch stragglers

B) Extract interface + move implementation behind adapters (e.g., Stripe → Adyen)
	1.	Serena:
	•	find_symbol { name: “PaymentGateway” }
	•	replace_symbol_body to split public contract vs. impl (or create a new interface file with create_text_file)
	•	insert_after_symbol in composition root to register both adapters
	•	write_memory { key: “payments-port”, adapters: [“stripe”,“adyen”], files: […] }
	2.	Morph:
	•	create_directory { path: “adapters/adyen” }
	•	write_file { path: “adapters/adyen/index.ts”, content: “” }
	•	Update env/config keys across repo with search_files → edit_file
	3.	Serena:
	•	execute_shell_command { cmd: “pnpm build && pnpm test payments” }

C) Move class to new package + fix imports & cycles
	1.	Serena:
	•	find_symbol { name: “OrderValidator” } → source file
	•	find_referencing_symbols → usages and barrel exports
	•	Plan import graph changes; if needed, add boundary shim with insert_before_symbol
	2.	Morph:
	•	move_file { from: “core/OrderValidator.ts”, to: “domain/orders/OrderValidator.ts” }
	•	For each referencing file: edit_file to update import paths
	3.	Serena:
	•	execute_shell_command { cmd: “pnpm typecheck” }
	•	If cycle remains, propose anti-corruption layer and patch

D) UUIDv7 migration across TS + Go
	1.	Serena:
	•	search_for_pattern { pattern: “UserId” } + get_symbols_overview to map types
	•	Plan adapters at boundaries; store plan via write_memory
	2.	Morph:
	•	edit_file in TS: validators, parsers, DTOs
	•	edit_file in Go: type aliases, marshaling
	3.	Serena:
	•	execute_shell_command { cmd: “go build ./… && pnpm typecheck && pnpm test -w” }

E) Dead-code quarantine then delete
	1.	Serena:
	•	search_for_pattern in legacy/ + find_referencing_symbols to confirm non-usage
	•	If ambiguous, wrap exports with deprecated stubs using insert_before_symbol
	2.	Morph:
	•	Move to deprecated/ with move_file and update imports
	•	On next pass, remove with edit_file once green
	3.	Serena:
	•	execute_shell_command { cmd: “pnpm -s test -w” }

⸻

Guardrails the LLM must enforce
	•	Scoping: Before mass edits, call Morph’s list_allowed_directories and operate only within those.
	•	Atomicity: Batch by feature; commit between batches (use Serena’s execute_shell_command to run git add -A && git commit -m "<msg>").
	•	Precision: Prefer Morph edit_file with explicit ranges/diffs; avoid global regex unless Serena has enumerated exact matches.
	•	Validation: Every batch ends with execute_shell_command for type-check/tests; if failing, stop and repair.
	•	Memory: After each major step, write_memory a short summary (goal, files, decisions). Read it back (read_memory) before follow-ups.

⸻

Quick routing cheatsheet (LLM decides fast)
	•	Rename/extract/move symbols, fix imports/refs → Serena plan → Morph edits → Serena validate
	•	Pattern sweeps (strings/comments/configs) → Morph directly (optionally seed with Serena search_for_pattern)
	•	Multi-lang refactor → Serena discovery across langs → Morph apply per language → Serena validate
	•	Create/relocate modules → Morph for files/dirs → Serena to re-wire code with inserts/replace body
	•	CI/build/test → Serena execute_shell_command



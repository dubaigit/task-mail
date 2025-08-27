---
argument-hint: "[describe task requiring multiple operations]"
description: "Multi-Execution Enforcer - Batch all related operations in single messages for maximum performance"
---

# 🚀 MULTI-EXECUTION ENFORCER

**REQUEST:** "$ARGUMENTS"

You are the Multi-Execution Enforcer. Your job is to execute ALL related operations in PARALLEL within SINGLE messages, achieving the same performance benefits as swarm mode without any wrapper or coordination layer.

## THE GOLDEN RULE (FROM SWARM)

⚡ **THE GOLDEN RULE:**
If you need to do X operations, they should be in 1 message, not X messages.

**MANDATORY: Always use BatchTool pattern for parallel execution:**

✅ **CORRECT: BatchTool Pattern**
```
[Single Message with Multiple Tools]:
Write("/src/api.js", "...")
Write("/src/utils.js", "...")  
Write("/tests/api.test.js", "...")
Edit("/src/config.js", oldString, newString)
Bash("npm run lint && npm run test")
TodoWrite([...multiple todos...])
```

❌ **VIOLATION: Sequential Messages**
```
Message 1: Write("/src/api.js", "...")
Message 2: Write("/src/utils.js", "...")
Message 3: Bash("npm run test")
```

🚫 **NEVER DO THIS:**
- Separate messages for related file operations
- Individual command execution instead of chaining
- Split implementation and testing
- Todo updates separate from work completion

## CORE BATCHING PATTERNS (Pure Multi-Execution)

### 1️⃣ **FILE OPERATIONS** - Always batch related files:
```javascript
[Single Message with Multiple Tools]:
  // Read multiple files for analysis
  Read("/src/index.js")
  Read("/src/config.js") 
  Read("/package.json")
  
  // Use Smart Tree MCP for directory analysis
  mcp__smart-tree__analyze_directory({path: "/src", mode: "ai"})
  mcp__smart-tree__find_code_files({path: "/src", languages: ["javascript", "typescript"]})
  
  // Write multiple files atomically
  Write("/src/api/auth.js", "...complete implementation...")
  Write("/src/api/users.js", "...complete implementation...")
  Write("/tests/auth.test.js", "...comprehensive tests...")
  
  // Test immediately with validation
  Bash("npm run typecheck && npm run test && npm run lint")
  
  // Update todos atomically
  TodoWrite([
    {content: "API endpoints implemented", status: "completed"},
    {content: "Tests written and passing", status: "completed"},
    {content: "Code validated", status: "completed"}
  ])
```

### 2️⃣ **BUG FIXING** - Complete diagnosis + fix (Prevents Edit → Fail → Edit → Fail):
```javascript
[Single Message with Multiple Tools]:
  // Smart Tree analysis for bug investigation
  mcp__smart-tree__find_files({path: "/src", pattern: ".*problematic.*", type: "py"})
  mcp__smart-tree__search_in_files({path: "/src", query: "redis.*hash", type: "py"})
  mcp__smart-tree__get_statistics({path: "/src"})
  
  // Analyze ALL related files FIRST
  Read("/src/problematic_module.py")
  Read("/tests/test_module.py")
  Read("/config/settings.py")
  
  // Write COMPLETE fixed version (not incremental edits)
  Write("/src/problematic_module.py", "...COMPLETE FIXED VERSION...")
  Write("/src/problematic_module_backup.py", "...original for rollback...")
  
  // Validate fix immediately
  Bash("source venv/bin/activate && python3 test_module.py && python3 integration_test.py")
  
  // Document results
  TodoWrite([
    {content: "Diagnosed Redis hash retrieval bug", status: "completed"},
    {content: "Implemented complete fix", status: "completed"},
    {content: "Validated solution", status: "completed"}
  ])
```

### 3️⃣ **FEATURE DEVELOPMENT** - End-to-end delivery:
```javascript
[Single Message with Multiple Tools]:
  // Smart Tree project analysis
  mcp__smart-tree__project_overview({path: "/src"})
  mcp__smart-tree__find_code_files({path: "/src", languages: ["javascript", "typescript"]})
  mcp__smart-tree__semantic_analysis({path: "/src"})
  
  // Research existing patterns
  Read("/src/existing_feature.js")
  Read("/docs/architecture.md")
  
  // Implement complete feature stack
  Write("/src/components/NewFeature.tsx", "...frontend component...")
  Write("/src/api/new-feature.js", "...backend API...")
  Write("/src/utils/feature-helpers.js", "...utilities...")
  Write("/tests/new-feature.test.js", "...comprehensive tests...")
  Write("/docs/new-feature.md", "...documentation...")
  
  // Validate end-to-end
  Bash("npm run build && npm run test:feature && npm run e2e:feature")
  
  // Complete status update
  TodoWrite([
    {content: "New feature research", status: "completed"},
    {content: "Frontend implementation", status: "completed"},
    {content: "Backend API", status: "completed"},
    {content: "Testing suite", status: "completed"},
    {content: "Documentation", status: "completed"}
  ])
```

## ADVANCED PATTERNS (Optional - For Complex Workflows)

### Pattern A: PROJECT SETUP - Directory + Config + Dependencies:
```javascript
[Single Message with Multiple Tools]:
  // Create project structure
  Bash("mkdir -p src/{components,utils,api} tests docs config")
  
  // Analyze directory structure with Smart Tree
  mcp__smart-tree__analyze_directory({path: ".", mode: "stats"})
  mcp__smart-tree__get_statistics({path: "."})
  
  // Write configuration files
  Write("/package.json", "...dependencies...")
  Write("/tsconfig.json", "...typescript config...")
  Write("/.eslintrc.js", "...linting rules...")
  Write("/jest.config.js", "...test config...")
  
  // Initialize git and install
  Bash("git init && npm install && npm run build")
  
  // Document setup
  TodoWrite([
    {content: "Project structure created", status: "completed"},
    {content: "Configuration files written", status: "completed"},
    {content: "Dependencies installed", status: "completed"}
  ])
```

### Pattern B: REFACTORING - Analysis + Implementation + Validation:
```javascript
[Single Message with Multiple Tools]:
  // Smart Tree analysis for refactoring candidates
  mcp__smart-tree__find_large_files({path: "/src", min_size: "10KB"})
  mcp__smart-tree__semantic_analysis({path: "/src"})
  mcp__smart-tree__find_duplicates({path: "/src"})
  
  // Analyze current implementation
  Read("/src/legacy-module.js")
  Read("/tests/legacy-module.test.js")
  Read("/docs/legacy-architecture.md")
  
  // Implement refactored version
  Write("/src/modern-module.js", "...refactored implementation...")
  Write("/tests/modern-module.test.js", "...updated tests...")
  Write("/src/migration-guide.md", "...migration instructions...")
  
  // Validate refactoring
  Bash("npm run test && npm run lint && npm run build")
  
  // Track progress
  TodoWrite([
    {content: "Legacy code analyzed", status: "completed"},
    {content: "Modern implementation created", status: "completed"},
    {content: "Tests updated and passing", status: "completed"}
  ])
```

## PERFORMANCE BENEFITS

**Multi-execution provides 2.8-4.4x performance improvement through:**

1. **Parallel Tool Execution**: All operations run simultaneously
2. **Reduced Context Switching**: No message boundaries between related operations  
3. **Optimal Resource Utilization**: Full system throughput usage
4. **Atomic Operation Groups**: Related changes complete together or fail together

## BATCHTOOL ENFORCEMENT RULES

### Rule 1: 2.8-4.4x Performance Multiplier
**Multi-execution achieves swarm-level performance through:**
- Parallel tool coordination
- Reduced context switching overhead
- Optimal resource utilization
- Atomic operation grouping

### Rule 2: Identify All Operations Before Execution
**BatchTool Pattern requires complete operation analysis:**
- What files need to be created/modified?
- What commands need to be run?
- What validations are required?
- What todos need updating?

### Rule 3: Group ALL Related Operations
**Operations that belong together MUST be in same message:**
- Frontend + Backend for same feature
- Implementation + Tests for same functionality  
- Code changes + Build/Test validation
- File creation + Directory setup

### Rule 4: Use Compound Commands with && Chaining
**Chain related commands for atomic execution:**
```bash
# ✅ BATCHTOOL: Compound operations
Bash("mkdir -p src/{components,utils,tests} && npm install && npm run build && npm test")

# ❌ VIOLATION: Split commands violate golden rule
Bash("mkdir -p src/components")
Bash("mkdir -p src/utils")  
Bash("npm install")
Bash("npm run build")
```

### Rule 5: Implementation + Validation = Same Message
**Never split implementation from its validation:**
```bash
[Single Message with Multiple Tools]:
Write("/src/feature.js", "...implementation...")
Write("/tests/feature.test.js", "...tests...")
Bash("npm run typecheck && npm run test:feature && npm run lint:feature")
TodoWrite([{content: "Feature complete", status: "completed"}])
```

## MULTI-EXECUTION SUCCESS INDICATORS

**Successful multi-execution should show:**
- ✅ Multiple tool calls in single assistant message
- ✅ Related operations completing in parallel
- ✅ No unnecessary message boundaries
- ✅ Atomic operation groups (all succeed or all fail together)
- ✅ Significant performance improvement vs sequential execution

## VIOLATION DETECTION & GOLDEN RULE ENFORCEMENT

**🚨 CRITICAL VIOLATIONS (From Swarm Analysis):**

❌ **Sequential Message Pattern (Violates Golden Rule):**
```
Message 1: Write("file1.js", "...")
Message 2: Write("file2.js", "...")  
Message 3: Bash("test")
```

❌ **Split Operations Pattern:**
```
Message 1: Implementation
Message 2: Testing
Message 3: Todo updates
```

❌ **Individual Command Execution:**
```
Bash("mkdir src")
Bash("mkdir tests")
Bash("npm install")
```

✅ **CORRECT: BatchTool Pattern (Follows Golden Rule):**
```
[Single Message with Multiple Tools]:
Write("file1.js", "...")
Write("file2.js", "...")
Write("tests/file.test.js", "...")
Bash("mkdir -p src tests && npm install && npm test")
TodoWrite([{content: "Feature", status: "completed"}])
```

**🎯 MULTI-EXECUTION SUCCESS CRITERIA:**
- All related operations in 1 message (Golden Rule compliance)
- 2.8-4.4x performance improvement achieved through parallel tool execution
- No unnecessary message boundaries
- Atomic operation completion (all succeed or all fail together)
- Complete solutions instead of iterative attempts
- Immediate validation bundled with implementation

## 🧠 ULTIMATE INTELLIGENCE-DRIVEN PATTERN (Smart-Tree Powered)

### 🎯 **THE SUPREME MULTI-EXECUTION PATTERN**
*Uses smart-tree's full 20+ tool suite for maximum intelligence and performance*

```javascript
[SINGLE MESSAGE - ULTIMATE INTELLIGENCE-DRIVEN EXECUTION]:

// PHASE 1: PROJECT RECONNAISSANCE (Complete Intelligence Gathering)
// Get holistic project understanding before any operations
mcp__smart-tree__project_overview({path: "."})                    // Holistic project view
mcp__smart-tree__analyze_workspace({path: "."})                   // Multi-project analysis  
mcp__smart-tree__semantic_analysis({path: ".", show_wave_signatures: true})  // Conceptual structure
mcp__smart-tree__get_statistics({path: "."})                      // Quantitative metrics
mcp__smart-tree__get_git_status({path: "."})                      // Version control context

// PHASE 2: STRATEGIC DISCOVERY (Intelligence-Guided Search)
// Find exactly what we need based on the task and project intelligence
mcp__smart-tree__find_code_files({path: ".", languages: ["javascript", "typescript", "python"]})
mcp__smart-tree__find_config_files({path: "."})                   // Configuration landscape
mcp__smart-tree__find_tests({path: "."})                          // Testing structure
mcp__smart-tree__search_in_files({path: ".", keyword: "TASK_SPECIFIC_PATTERN"})
mcp__smart-tree__find_recent_changes({path: ".", days: 7})        // Recent activity context
mcp__smart-tree__find_large_files({path: ".", min_size: "50KB"})  // Optimization opportunities

// PHASE 3: INFORMED READING (Smart-Tree Intelligence-Driven)
// Read ONLY the files identified as critical by smart-tree analysis - no guesswork
Read("/critical/files/identified/by/smart-tree/analysis")
Read("/configuration/files/found/by/reconnaissance")
Read("/test/files/relevant/to/implementation/task")
Read("/recent/changes/that/impact/current/work")

// PHASE 4: PATTERN-AWARE IMPLEMENTATION (Intelligence-Guided Changes)
// Implement changes that respect discovered project patterns and conventions
Write("/new/feature/implementation.js", "...respecting discovered patterns...")
Write("/tests/comprehensive.test.js", "...following found test patterns...")
Write("/docs/feature.md", "...matching project documentation style...")
Edit("/existing/critical/file.js", "old pattern", "new pattern respecting project conventions")

// PHASE 5: SMART VALIDATION (Intelligence-Driven Verification)
// Validate changes using smart-tree's analytical capabilities
mcp__smart-tree__search_in_files({path: ".", keyword: "VERIFY_IMPLEMENTATION_SUCCESS"})
mcp__smart-tree__find_duplicates({path: "."})                     // Check for code duplication
mcp__smart-tree__get_digest({path: "."})                          // Create change fingerprint
mcp__smart-tree__semantic_analysis({path: ".", show_wave_signatures: true})  // Verify structure integrity

// PHASE 6: EXECUTION & DOCUMENTATION
// Execute validation commands and update project state
Bash("npm run typecheck && npm run test && npm run lint && npm run build")
TodoWrite([
  {content: "Intelligence-driven reconnaissance completed", status: "completed"},
  {content: "Strategic discovery and pattern identification", status: "completed"}, 
  {content: "Implementation following discovered patterns", status: "completed"},
  {content: "Smart validation and verification", status: "completed"}
])
```

### 🔬 **INTELLIGENCE-DRIVEN BENEFITS**

**🎯 5-10x Better Decision Accuracy:**
- Every file operation is **INTELLIGENCE-DRIVEN** rather than based on assumptions
- Complete project understanding before making any changes
- Respects existing patterns, conventions, and architecture
- Eliminates guesswork through comprehensive reconnaissance

**⚡ Performance Optimizations:**
- **Parallel Intelligence Gathering**: All Phase 1-2 operations run simultaneously
- **Smart Caching**: Results cached by git SHA to avoid redundant analysis
- **Incremental Updates**: Only re-analyze changed modules
- **Targeted Operations**: Read/edit only critical files identified by analysis

**🛡️ Risk Reduction:**
- **Pattern Compliance**: Changes automatically follow discovered project conventions
- **Smart Validation**: Multi-layered verification using semantic analysis
- **Graceful Degradation**: Falls back to manual mode if intelligence gathering fails
- **Change Fingerprinting**: Track impact with cryptographic digest

### 🎛️ **ADAPTIVE INTELLIGENCE MODES**

**💨 Light Mode (Quick Tasks):**
```javascript
// Skip expensive analysis for simple tasks
mcp__smart-tree__quick_tree({path: ".", depth: 3})
mcp__smart-tree__find_code_files({path: ".", languages: ["TARGET_LANGUAGE"]})
// ... proceed with focused implementation
```

**🧠 Full Intelligence (Complex Features):**
```javascript  
// Complete 6-phase analysis for complex tasks
// Use full pattern above with all reconnaissance phases
```

**🔄 Incremental Mode (Iterative Changes):**
```javascript
// For subsequent changes in same session
mcp__smart-tree__find_recent_changes({path: ".", days: 1})     // Only recent changes
mcp__smart-tree__compare_directories({path1: "./before", path2: "."})  // Diff analysis
// ... targeted updates based on deltas
```

### 📊 **VALIDATION CONTRACT EXAMPLES**

**✅ Smart Validation Tasks:**
```yaml
validation_manifest:
  static_analysis: ["npm run typecheck", "npm run lint"]
  testing: ["npm run test", "npm run test:integration"] 
  build_verification: ["npm run build", "npm run bundle-analyze"]
  security: ["npm audit", "npm run security-scan"]
  performance: ["npm run perf-test"]
```

**🔍 Intelligence Visibility:**
```javascript
// Enable debugging and introspection
mcp__smart-tree__get_statistics({path: "."})  // Show analysis metrics
// Results cached in .smart-tree/cache/phase-{sha}.json for inspection
```

## START EXECUTION

Apply **ULTIMATE INTELLIGENCE-DRIVEN** multi-execution principles to: "$ARGUMENTS"

**Your task:**
1. **Intelligence First**: Use smart-tree reconnaissance to understand the project completely
2. **Strategic Discovery**: Find exactly what you need through intelligent search
3. **Informed Operations**: Read/edit only files identified as critical by analysis  
4. **Pattern Compliance**: Respect discovered project conventions and architecture
5. **Smart Validation**: Verify changes using multi-layered intelligence analysis
6. **Single Message**: Execute ALL phases in ONE MESSAGE for maximum parallelization

Remember: The goal is intelligence-driven decision making that eliminates guesswork and creates truly optimal multi-execution workflows through systematic project understanding.

## 🚨 **CRITICAL ISSUE: SMART-TREE NOT EXECUTING**

**PROBLEM**: The patterns above show example syntax but **don't actually execute smart-tree commands**. 

**SOLUTION**: Here's a **WORKING EXAMPLE** of how to actually use smart-tree in multi-execution:

### ✅ **WORKING SMART-TREE MULTI-EXECUTION EXAMPLE**

```javascript
// Instead of this (just examples):
// mcp__smart-tree__project_overview({path: "."})  // This is just text!

// Do this (actual executable pattern):
[SINGLE MESSAGE WITH REAL SMART-TREE EXECUTION]:

// PHASE 1: ACTUAL PROJECT RECONNAISSANCE  
mcp__smart-tree__project_overview({path: "/absolute/path/to/project"})
mcp__smart-tree__get_statistics({path: "/absolute/path/to/project"}) 
mcp__smart-tree__semantic_analysis({path: "/absolute/path/to/project"})

// PHASE 2: INTELLIGENCE-BASED DISCOVERY
mcp__smart-tree__search_in_files({path: "/absolute/path/to/project", keyword: "ERROR_PATTERN"})
mcp__smart-tree__find_code_files({path: "/absolute/path/to/project", languages: ["typescript"]})

// PHASE 3: INFORMED READING (based on smart-tree results)
Read("/files/identified/by/smart-tree/analysis")
Read("/critical/files/found/in/search")

// PHASE 4: INTELLIGENT IMPLEMENTATION
Edit("/file.ts", "old pattern", "new pattern based on intelligence")
Write("/new-file.ts", "content following discovered patterns")

// PHASE 5: SMART VALIDATION
mcp__smart-tree__find_duplicates({path: "/absolute/path/to/project"})
Bash("npm run test && npm run build")
```

### 🔧 **KEY REQUIREMENTS FOR WORKING SMART-TREE:**

1. **Use Absolute Paths**: `"/Users/name/project"` not `"."`
2. **Actually Execute**: Don't just show examples - run the commands
3. **Sequential Batching**: Intelligence → Reading → Implementation → Validation
4. **Real File Paths**: Use paths discovered by smart-tree, not assumptions

### 🎯 **REAL-WORLD WORKING EXAMPLE**

**TypeScript Error Fixing with Smart-Tree Intelligence:**

```javascript
[SINGLE MESSAGE - WORKING PATTERN]:

// PHASE 1: Get complete project intelligence
mcp__smart-tree__project_overview({path: "/Users/iamomen/apple-mcp/dashboard/frontend"})
mcp__smart-tree__search_in_files({path: "/Users/iamomen/apple-mcp/dashboard/frontend", keyword: "TaskStatus", file_type: "ts"})

// PHASE 2: Read files identified by smart-tree (not guessing)
Read("/Users/iamomen/apple-mcp/dashboard/frontend/src/types/core.ts")
Read("/Users/iamomen/apple-mcp/dashboard/frontend/src/components/MainDashboard.tsx") 

// PHASE 3: Fix issues using intelligence from phases 1-2
Edit("/Users/iamomen/apple-mcp/dashboard/frontend/src/components/MainDashboard.tsx", 
     "task.status === 'completed'", 
     "task.status === TaskStatus.COMPLETED")

// PHASE 4: Validate with build
Bash("cd /Users/iamomen/apple-mcp/dashboard/frontend && npm run build")
```

**This eliminates the guesswork that caused multiple edit failures in your example!**
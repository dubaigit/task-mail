# Claude Flow Permanent Installation Fix

## Issue
Claude Flow requires better-sqlite3 dependency but often fails with `ERR_MODULE_NOT_FOUND` when using npx.

## Permanent Solution

### Method 1: Use npx with bundled packages (Recommended)
```bash
# Always use this pattern for claude-flow commands:
npx --package=claude-flow@alpha --package=better-sqlite3 --yes claude-flow <command>

# Examples:
npx --package=claude-flow@alpha --package=better-sqlite3 --yes claude-flow init --force --project-name task-workflow
npx --package=claude-flow@alpha --package=better-sqlite3 --yes claude-flow swarm "your objective"
```

### Method 2: Create a permanent alias
```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile:
alias claude-flow='npx --package=claude-flow@alpha --package=better-sqlite3 --yes claude-flow'

# Then use normally:
claude-flow init --force --project-name task-workflow
claude-flow swarm "build API"
```

### Method 3: Global installation workaround
```bash
# Install build tools first
npm install -g node-gyp

# Clean caches
npm cache clean --force
rm -rf ~/.npm/_npx/*/node_modules/claude-flow

# Install with dependencies
npm install -g claude-flow@alpha
```

## Why This Happens
- better-sqlite3 is a native module requiring compilation
- npx doesn't always resolve peer dependencies correctly
- Global installations can have permission/path issues on macOS

## Testing the Fix
```bash
# Test the installation:
npx --package=claude-flow@alpha --package=better-sqlite3 --yes claude-flow --help
```

## Alternative: Use Docker
```bash
# If all else fails, use Docker:
docker run --rm -v $(pwd):/workspace -w /workspace node:latest npx claude-flow@alpha init
```
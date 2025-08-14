# apple-mcp Development Commands

## Commands
- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Run built application
- `python test_mail_tool.py` - Run single test
- `python test_mail_tool_core.py` - Run core tests

## Code Style
- **Imports**: ESM with `.js` extensions, external first
- **Types**: Explicit annotations, strong interfaces
- **Naming**: PascalCase types, camelCase vars/funcs
- **Formatting**: 2-space indent, 100 char line limit
- **Error**: try/catch around applescript, detailed messages
- **Structure**: utils/ modules for related functionality

## Testing
- Python unittest for mail functionality
- TypeScript strict mode enabled
- Check for unused variables (see useEagerLoading)
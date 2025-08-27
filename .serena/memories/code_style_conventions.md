# Code Style and Conventions

## JavaScript/Node.js Conventions

### File Structure
- Main backend server: `server.js` 
- AI service: `ai_service.js`
- Database services in `src/database/`
- Services in `src/services/`

### Code Style
- **ES6+ syntax**: Arrow functions, destructuring, async/await
- **Semicolons**: Used consistently
- **Quotes**: Single quotes for strings (exceptions for SQL queries)
- **Indentation**: 2 spaces
- **Naming**:
  - camelCase for variables and functions
  - PascalCase for classes and constructors
  - UPPER_SNAKE_CASE for constants

### Error Handling
```javascript
try {
  // operation
} catch (error) {
  console.error('Context:', error);
  // graceful handling
}
```

### Security Patterns
- Input validation and sanitization
- Rate limiting on all endpoints
- Security headers via Helmet
- Environment variables for secrets

## React/TypeScript Conventions

### Component Structure
- Functional components with hooks
- TypeScript for type safety
- Components in `dashboard/frontend/src/components/`
- Organized by feature (Email/, Analytics/, TaskCentric/, etc.)

### State Management
- Zustand for global state
- Custom hooks in `src/hooks/`
- Types in `src/types/`

### Styling
- Tailwind CSS for utility classes
- Radix UI for accessible components
- Component-specific styles via className
- Responsive design patterns

### File Organization
```
components/
├── AI/           # AI-powered features
├── Analytics/    # Data visualization
├── Email/        # Email management
├── TaskCentric/  # Task management hub
├── Mobile/       # Mobile optimizations
└── ui/           # Shared UI components
```

## Testing Conventions

### Test Structure
- Jest for unit and integration tests
- Playwright for E2E tests
- Test files named `*.test.js` or `*.spec.js`
- Coverage reports in HTML format

### Test Organization
```
tests/
├── unit/         # Unit tests
├── integration/  # Integration tests
├── performance/  # Performance tests
├── gpt5/        # GPT-5 specific tests
├── database/    # Database tests
└── e2e/         # End-to-end tests
```

## Documentation
- JSDoc comments for functions
- README.md for project overview
- TECHNICAL_ARCHITECTURE.md for deep technical details
- Inline comments for complex logic

## Git Conventions
- Meaningful commit messages
- Feature branches
- Main branch protection
- PR reviews before merge
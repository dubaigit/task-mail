# Apple MCP Project Context

## System Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Zustand + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Supabase) + Redis
- **AI**: GPT-5 via OpenAI API
- **Real-time**: WebSocket (ws)
- **Auth**: JWT + bcrypt

### Key Domains
- **Email Management**: Apple Mail sync, classification, prioritization
- **Task Processing**: Task extraction, prioritization, assignment
- **AI Processing**: Async queue-based GPT-5 processing
- **User Auth**: JWT-based authentication with session management

### Project Structure
```
apple-mcp/
├── server.js                 # Main backend server
├── src/
│   ├── api/                 # API routes and middleware
│   ├── domain/              # Domain-driven modules
│   │   ├── email-management/
│   │   ├── task-processing/
│   │   └── user-auth/
│   ├── database/            # Database services
│   ├── services/            # External integrations
│   └── websocket/           # Real-time communication
└── dashboard/frontend/      # React frontend
    └── src/
        ├── components/      # UI components
        ├── stores/         # Zustand stores
        └── hooks/          # Custom hooks
```

## Code Standards

### General Rules
- NO COMMENTS in code (self-documenting)
- TypeScript for all new code
- Async/await over callbacks
- Functional React components with hooks
- Domain-driven design for backend

### Security Requirements
- Parameterized queries (NEVER string concatenation)
- Input validation with Zod/Joi
- Rate limiting on all endpoints
- JWT token expiration
- Bcrypt for password hashing

### Performance Requirements
- Redis caching for frequent queries
- Virtual scrolling for long lists
- Lazy loading for components
- Database connection pooling
- WebSocket for real-time updates

## Testing Requirements
- Jest for unit/integration tests
- Playwright for E2E tests
- Minimum 80% code coverage
- Test files: `*.test.js` or `*.test.ts`

## Current Features (Already Implemented)
- Apple Mail synchronization
- AI-powered email classification
- Task extraction from emails
- Priority detection
- Real-time WebSocket updates
- Multi-tier Redis caching
- JWT authentication
- Responsive React dashboard
- Virtual scrolling for performance
- Domain-driven architecture

## Common Patterns

### API Endpoints
```javascript
router.get('/api/emails', authMiddleware, getEmails);
router.post('/api/emails/:id/classify', authMiddleware, classifyEmail);
```

### Database Queries
```javascript
const query = 'SELECT * FROM emails WHERE user_id = $1';
const values = [userId];
const result = await db.query(query, values);
```

### React Components
```tsx
const Component: React.FC<Props> = memo(({ prop }) => {
  const [state, setState] = useState();
  const handleAction = useCallback(() => {}, []);
  return <div>...</div>;
});
```

### Error Handling
```javascript
try {
  const result = await operation();
  res.json({ success: true, data: result });
} catch (error) {
  logger.error('Operation failed:', error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}
```
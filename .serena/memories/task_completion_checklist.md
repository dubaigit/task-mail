# Task Completion Checklist

## When a Task is Completed

### 1. Code Quality Checks
Although no explicit linting/formatting commands were found configured, you should:

- [ ] Ensure code follows established patterns in the codebase
- [ ] Check for consistent indentation (2 spaces)
- [ ] Verify proper error handling
- [ ] Remove any console.log statements used for debugging
- [ ] Ensure no hardcoded values or secrets

### 2. Testing
Run appropriate tests based on what was changed:

#### Backend Changes
```bash
# Run all backend tests
npm test

# Or specific test suites
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:database    # Database tests
```

#### Frontend Changes
```bash
cd dashboard/frontend
npm test                 # Run frontend tests
npm run test:coverage    # Check coverage
```

#### GPT-5/AI Changes
```bash
npm run test:gpt5        # All GPT-5 tests
npm run test:gpt5:quality # Quality validation
```

### 3. Validation
```bash
# Validate the integration
npm run validate

# Auto-fix validation issues if any
npm run validate:fix
```

### 4. Build Verification
```bash
# For frontend changes
cd dashboard/frontend && npm run build

# Verify the build completes without errors
```

### 5. Database Sync (if DB changes)
```bash
# Check sync status
npm run sync:status

# Run sync if needed
npm run db:sync
```

### 6. Manual Testing
- [ ] Start the services and test manually
  ```bash
  docker-compose up -d     # Start infrastructure
  npm run dev             # Start backend
  cd dashboard/frontend && npm start  # Start frontend
  ```
- [ ] Test the specific feature/fix
- [ ] Check browser console for errors
- [ ] Verify API responses in Network tab

### 7. Performance Check
For significant changes:
- [ ] Monitor request timing (backend logs slow requests >1000ms)
- [ ] Check Redis cache hit rates
- [ ] Verify no memory leaks

### 8. Security Review
- [ ] No exposed secrets or API keys
- [ ] Input validation in place
- [ ] Rate limiting functioning
- [ ] CORS properly configured

### 9. Documentation
- [ ] Update README.md if needed
- [ ] Add JSDoc comments for new functions
- [ ] Update TECHNICAL_ARCHITECTURE.md for architectural changes

### 10. Git Workflow
```bash
# Check status
git status

# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: description of change"

# Push to feature branch (not directly to main)
git push origin feature-branch
```

## Common Issues to Check

1. **Environment Variables**: Ensure `.env` is properly configured
2. **Docker Services**: Verify Supabase and Redis are running
3. **Port Conflicts**: Check ports 3000, 8000, 54323 are available
4. **Database Migrations**: Run if schema changed
5. **Cache Invalidation**: Clear Redis if caching issues occur

## Emergency Rollback
If something breaks in production:
```bash
git revert HEAD
git push origin main
docker-compose restart
```
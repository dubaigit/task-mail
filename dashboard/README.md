# Email Intelligence Dashboard

A modern FastAPI + React web dashboard for AI-powered email classification and task management system.

## Features

### Backend (FastAPI)
- **Email Intelligence Engine Integration**: Real-time email classification using AI
- **REST API**: Complete API for emails, tasks, and drafts management
- **Email Analysis**: 
  - Classification (Needs Reply, Approval Required, Create Task, etc.)
  - Urgency detection (Critical, High, Medium, Low)
  - Sentiment analysis (Positive, Neutral, Negative, Frustrated)
  - Action item extraction
  - Deadline detection
- **Task Management**: Auto-generated tasks from email analysis
- **Draft Generation**: AI-powered email response drafts
- **Analytics**: Comprehensive statistics and insights

### Frontend (React + TypeScript)
- **Modern Dashboard Layout**: Responsive design with sidebar navigation
- **Email View**: 
  - Email list with AI-powered insights
  - Classification badges and confidence scores
  - Search and filtering capabilities
  - Action items and deadline highlighting
- **Task Management**: 
  - Task list with email context integration
  - Status tracking and priority management
  - Progress statistics
- **Draft Management**: 
  - AI-generated draft responses
  - Preview and editing capabilities
  - Send tracking
- **Analytics Dashboard**: 
  - Real-time performance metrics
  - Classification and urgency breakdowns
  - AI performance insights
  - Actionable recommendations

## Technology Stack

### Backend
- FastAPI (Python web framework)
- SQLite (for demo, easily replaceable with PostgreSQL/MySQL)
- Email Intelligence Engine (custom AI classification system)
- Pydantic (data validation)
- Uvicorn (ASGI server)

### Frontend
- React 18 with TypeScript
- Tailwind CSS (styling)
- React Router (navigation)
- Axios (API communication)
- Lucide React (icons)
- Modern component architecture

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd dashboard/backend
```

2. Install Python dependencies:
```bash
pip install -r ../requirements.txt
```

3. Start the FastAPI server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd dashboard/frontend
```

2. Install Node dependencies:
```bash
npm install
```

3. Start the React development server:
```bash
npm start
```

The frontend will be available at `http://localhost:3000`

## API Endpoints

### Emails
- `GET /api/emails` - Get all emails with analysis
- `GET /api/emails/{email_id}` - Get specific email
- `POST /api/emails/analyze` - Analyze new email

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/{task_id}` - Get specific task
- `PUT /api/tasks/{task_id}/status` - Update task status

### Drafts
- `GET /api/drafts` - Get all drafts
- `GET /api/drafts/{draft_id}` - Get specific draft
- `PUT /api/drafts/{draft_id}/send` - Mark draft as sent

### Analytics
- `GET /api/statistics` - Get dashboard statistics
- `GET /health` - Health check

## Email Intelligence Engine

The system uses a sophisticated AI engine for email analysis:

### Classification Types
- **NEEDS_REPLY**: Emails requiring a response
- **APPROVAL_REQUIRED**: Emails needing approval/authorization
- **CREATE_TASK**: Emails that should generate tasks
- **DELEGATE**: Emails that can be delegated
- **FYI_ONLY**: Informational emails
- **FOLLOW_UP**: Follow-up or reminder emails

### Analysis Features
- **Confidence Scoring**: Each classification includes confidence percentage
- **Action Item Extraction**: Automatic identification of actionable items
- **Deadline Detection**: Parsing of dates and deadlines
- **Multilingual Support**: Basic support for Spanish, French, German
- **Performance**: Sub-100ms processing time

## Project Structure

```
dashboard/
├── backend/
│   ├── main.py                 # FastAPI application
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/         # Dashboard layout
│   │   │   ├── Email/          # Email view components
│   │   │   ├── Tasks/          # Task management
│   │   │   ├── Drafts/         # Draft management
│   │   │   └── Analytics/      # Analytics dashboard
│   │   ├── styles/
│   │   │   └── globals.css     # Global styles
│   │   ├── App.tsx             # Main app component
│   │   └── index.tsx           # Entry point
│   ├── public/
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

## Features Demonstration

The dashboard comes with sample data to demonstrate:

1. **Email Classification**: See how emails are automatically categorized
2. **Task Generation**: Watch tasks being created from email analysis
3. **Draft Responses**: AI-generated response drafts for emails
4. **Analytics Insights**: Performance metrics and recommendations
5. **Real-time Updates**: Dynamic status updates and filtering

## Customization

### Adding New Classifications
Extend the email intelligence engine by adding new patterns in:
- Backend: `email_intelligence_engine.py`
- Frontend: Update badge colors and labels in components

### Styling
The frontend uses Tailwind CSS for easy customization:
- Modify `tailwind.config.js` for theme changes
- Update component styles for custom appearance

### Database Integration
Replace the in-memory storage with a real database:
1. Add SQLAlchemy models
2. Create database migration scripts
3. Update API endpoints to use database queries

## Performance

- **Backend**: Sub-100ms email analysis
- **Frontend**: Optimized React components with lazy loading
- **Real-time**: WebSocket support for live updates (can be added)
- **Scalability**: Designed for easy horizontal scaling

## Security Considerations

For production deployment:
- Add authentication and authorization
- Implement rate limiting
- Use environment variables for configuration
- Enable CORS properly
- Add input validation and sanitization
- Use HTTPS for all communications

## Future Enhancements

- [ ] Real-time notifications
- [ ] Email threading support
- [ ] Advanced ML models for classification
- [ ] Integration with email providers (Gmail, Outlook)
- [ ] Team collaboration features
- [ ] Mobile responsive improvements
- [ ] Dark mode support
- [ ] Export/import functionality

## License

This project is part of the Apple MCP ecosystem and follows the same licensing terms.

## Support

For questions and support, please refer to the main Apple MCP repository.
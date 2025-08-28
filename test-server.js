const express = require('express');
const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Test server is running'
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Task Mail Test Server' });
});

app.listen(PORT, () => {
  console.log(`✅ Test server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});


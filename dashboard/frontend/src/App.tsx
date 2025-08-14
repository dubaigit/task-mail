import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import EmailList from './components/Email/EmailList';
import TaskList from './components/Tasks/TaskList';
import DraftList from './components/Drafts/DraftList';
import Analytics from './components/Analytics/Analytics';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<EmailList />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/drafts" element={<DraftList />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
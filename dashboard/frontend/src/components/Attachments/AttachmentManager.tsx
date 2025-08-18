/**
 * Email Attachment Management Component
 * 
 * Provides a comprehensive interface for managing email attachments with:
 * - Attachment preview and thumbnail generation
 * - File organization and categorization
 * - Bulk operations and batch processing
 * - Security scanning and validation
 * - Search and filtering capabilities
 * 
 * Follows the task-centric dashboard design pattern adapted for email attachments.
 * 
 * @author Enterprise Email Management System
 * @date 2025-08-17
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Paperclip, 
  Download, 
  Eye, 
  Trash2, 
  Search, 
  Filter, 
  Grid, 
  List, 
  Upload, 
  FileText, 
  Image, 
  Music, 
  Video, 
  Archive,
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  MoreHorizontal
} from 'lucide-react';
import './AttachmentManager.css';

// Type definitions
interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  originalFilename: string;
  size: number;
  mimeType: string;
  contentType: string;
  hashMd5: string;
  hashSha256: string;
  createdAt: string;
  updatedAt: string;
  isSafe: boolean;
  scanResult?: string;
  previewAvailable: boolean;
  thumbnailPath?: string;
  extractedText?: string;
  metadata: Record<string, any>;
  tags: string[];
  category: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';
  status: 'scanning' | 'safe' | 'quarantined' | 'processing';
}

interface AttachmentStats {
  totalAttachments: number;
  totalSizeBytes: number;
  totalSizeMb: number;
  safeAttachments: number;
  unsafeAttachments: number;
  fileTypes: Record<string, number>;
}

interface AttachmentColumnProps {
  title: string;
  attachments: Attachment[];
  count: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const AttachmentColumn: React.FC<AttachmentColumnProps> = ({ 
  title, 
  attachments, 
  count, 
  color, 
  icon: Icon 
}) => {
  const getFileIcon = (attachment: Attachment) => {
    switch (attachment.category) {
      case 'document': return FileText;
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Music;
      case 'archive': return Archive;
      default: return Paperclip;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return 'text-green-500';
      case 'quarantined': return 'text-red-500';
      case 'scanning': return 'text-yellow-500';
      case 'processing': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="attachment-column">
      <div className="column-header">
        <div className="header-content">
          <div className={`column-indicator ${color}`}></div>
          <Icon className="header-icon" />
          <h3 className="column-title">{title}</h3>
          <span className="column-count">{count}</span>
        </div>
        <button className="add-button">
          <Upload className="w-4 h-4" />
        </button>
      </div>
      
      <div className="attachments-list">
        {attachments.map((attachment) => {
          const FileIcon = getFileIcon(attachment);
          
          return (
            <div key={attachment.id} className="attachment-card">
              <div className="card-header">
                <div className="file-info">
                  <FileIcon className="file-icon" />
                  <div className="file-details">
                    <h4 className="filename" title={attachment.originalFilename}>
                      {attachment.filename}
                    </h4>
                    <p className="file-meta">
                      {formatFileSize(attachment.size)} • {attachment.mimeType.split('/')[1].toUpperCase()}
                    </p>
                  </div>
                </div>
                <button className="more-button">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              
              {attachment.previewAvailable && attachment.thumbnailPath && (
                <div className="preview-container">
                  <div className="preview-placeholder">
                    <FileIcon className="preview-icon" />
                    <span className="preview-text">Preview Available</span>
                  </div>
                </div>
              )}
              
              <div className="card-tags">
                {attachment.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
                <span className={`status-tag ${getStatusColor(attachment.status)}`}>
                  {attachment.status}
                </span>
              </div>
              
              <div className="card-footer">
                <div className="attachment-meta">
                  <span className="email-id">Email: {attachment.emailId.slice(0, 8)}...</span>
                  <span className="created-date">
                    {new Date(attachment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="card-actions">
                  <button className="action-btn" title="Preview">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="action-btn" title="Download">
                    <Download className="w-4 h-4" />
                  </button>
                  <button className="action-btn danger" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        
        {attachments.length === 0 && (
          <div className="empty-column">
            <Icon className="empty-icon" />
            <p>No {title.toLowerCase()} attachments</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AttachmentManager: React.FC = () => {
  // State management
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [stats, setStats] = useState<AttachmentStats | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data for demonstration
  const mockAttachments: Attachment[] = [
    {
      id: '1',
      emailId: 'email_001',
      filename: 'project_proposal.pdf',
      originalFilename: 'Project Proposal - Q4 2024.pdf',
      size: 2048576,
      mimeType: 'application/pdf',
      contentType: 'application/pdf',
      hashMd5: 'abc123',
      hashSha256: 'def456',
      createdAt: '2024-12-15T10:30:00Z',
      updatedAt: '2024-12-15T10:30:00Z',
      isSafe: true,
      previewAvailable: true,
      thumbnailPath: '/cache/thumbnails/1_thumb.jpg',
      metadata: {},
      tags: ['Important', 'Q4'],
      category: 'document',
      status: 'safe'
    },
    {
      id: '2',
      emailId: 'email_002',
      filename: 'team_photo.jpg',
      originalFilename: 'Team Photo December 2024.jpg',
      size: 1536000,
      mimeType: 'image/jpeg',
      contentType: 'image/jpeg',
      hashMd5: 'ghi789',
      hashSha256: 'jkl012',
      createdAt: '2024-12-14T15:45:00Z',
      updatedAt: '2024-12-14T15:45:00Z',
      isSafe: true,
      previewAvailable: true,
      thumbnailPath: '/cache/thumbnails/2_thumb.jpg',
      metadata: { dimensions: [1920, 1080] },
      tags: ['Team', 'Photos'],
      category: 'image',
      status: 'safe'
    },
    {
      id: '3',
      emailId: 'email_003',
      filename: 'suspicious_file.exe',
      originalFilename: 'important_update.exe',
      size: 5242880,
      mimeType: 'application/x-executable',
      contentType: 'application/x-executable',
      hashMd5: 'mno345',
      hashSha256: 'pqr678',
      createdAt: '2024-12-13T09:15:00Z',
      updatedAt: '2024-12-13T09:15:00Z',
      isSafe: false,
      scanResult: 'Potentially dangerous executable file',
      previewAvailable: false,
      metadata: {},
      tags: ['Suspicious'],
      category: 'other',
      status: 'quarantined'
    },
    {
      id: '4',
      emailId: 'email_004',
      filename: 'presentation.pptx',
      originalFilename: 'Q4 Results Presentation.pptx',
      size: 8388608,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      hashMd5: 'stu901',
      hashSha256: 'vwx234',
      createdAt: '2024-12-12T14:20:00Z',
      updatedAt: '2024-12-12T14:20:00Z',
      isSafe: true,
      previewAvailable: false,
      metadata: {},
      tags: ['Presentation', 'Q4'],
      category: 'document',
      status: 'processing'
    }
  ];

  const mockStats: AttachmentStats = {
    totalAttachments: 4,
    totalSizeBytes: 17215488,
    totalSizeMb: 16.4,
    safeAttachments: 3,
    unsafeAttachments: 1,
    fileTypes: {
      '.pdf': 1,
      '.jpg': 1,
      '.exe': 1,
      '.pptx': 1
    }
  };

  // Initialize with mock data
  useEffect(() => {
    setAttachments(mockAttachments);
    setStats(mockStats);
  }, []);

  // Filter attachments based on search and category
  const filteredAttachments = attachments.filter(attachment => {
    const matchesSearch = searchQuery === '' || 
      attachment.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attachment.originalFilename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attachment.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || attachment.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Group attachments by status for Kanban view
  const attachmentColumns = [
    {
      title: 'Safe Files',
      attachments: filteredAttachments.filter(att => att.status === 'safe'),
      count: filteredAttachments.filter(att => att.status === 'safe').length,
      color: 'bg-green-400',
      icon: CheckCircle
    },
    {
      title: 'Processing',
      attachments: filteredAttachments.filter(att => att.status === 'processing'),
      count: filteredAttachments.filter(att => att.status === 'processing').length,
      color: 'bg-blue-400',
      icon: Clock
    },
    {
      title: 'Scanning',
      attachments: filteredAttachments.filter(att => att.status === 'scanning'),
      count: filteredAttachments.filter(att => att.status === 'scanning').length,
      color: 'bg-yellow-400',
      icon: Search
    },
    {
      title: 'Quarantined',
      attachments: filteredAttachments.filter(att => att.status === 'quarantined'),
      count: filteredAttachments.filter(att => att.status === 'quarantined').length,
      color: 'bg-red-400',
      icon: AlertTriangle
    }
  ];

  const handleFileUpload = () => {
    // Handle file upload logic
    console.log('File upload triggered');
  };

  const handleBulkAction = (action: string) => {
    // Handle bulk actions
    console.log('Bulk action:', action);
  };

  return (
    <div className="attachment-manager">
      {/* Header Section */}
      <div className="manager-header">
        <div className="header-content">
          <h1 className="header-title">
            <Paperclip className="title-icon" />
            Attachment Manager
          </h1>
          <div className="header-stats">
            <span className="stat-item">
              {stats?.totalAttachments || 0} Files
            </span>
            <span className="stat-item">
              {stats?.totalSizeMb || 0} MB Total
            </span>
          </div>
        </div>
        
        {error && (
          <div className="error-banner">
            <AlertTriangle className="error-icon" />
            <span className="error-text">{error}</span>
            <button 
              className="error-dismiss"
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="controls-bar">
        <div className="search-controls">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search attachments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-filter"
          >
            <option value="all">All Categories</option>
            <option value="document">Documents</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="archive">Archives</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div className="view-controls">
          <div className="view-mode-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          <button className="filter-btn">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          
          <button className="upload-btn" onClick={handleFileUpload}>
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-value">{stats?.totalAttachments || 0}</div>
            <div className="stat-label">Total Attachments</div>
          </div>
          <Paperclip className="stat-icon" />
        </div>
        
        <div className="stat-card safe">
          <div className="stat-content">
            <div className="stat-value">{stats?.safeAttachments || 0}</div>
            <div className="stat-label">Safe Files</div>
          </div>
          <CheckCircle className="stat-icon" />
        </div>
        
        <div className="stat-card danger">
          <div className="stat-content">
            <div className="stat-value">{stats?.unsafeAttachments || 0}</div>
            <div className="stat-label">Quarantined</div>
          </div>
          <AlertTriangle className="stat-icon" />
        </div>
        
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-value">{stats?.totalSizeMb || 0} MB</div>
            <div className="stat-label">Storage Used</div>
          </div>
          <HardDrive className="stat-icon" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="content-header">
          <h2 className="content-title">Attachment Board</h2>
          <div className="content-actions">
            <button className="action-btn secondary">
              <Filter className="w-4 h-4" />
              Advanced Filter
            </button>
            <button className="action-btn primary" onClick={() => handleBulkAction('download')}>
              <Download className="w-4 h-4" />
              Bulk Download
            </button>
          </div>
        </div>
        
        {/* Kanban Board */}
        <div className="attachment-board">
          {attachmentColumns.map((column) => (
            <AttachmentColumn
              key={column.title}
              title={column.title}
              attachments={column.attachments}
              count={column.count}
              color={column.color}
              icon={column.icon}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AttachmentManager;
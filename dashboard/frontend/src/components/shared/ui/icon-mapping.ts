// Icon Mapping - Heroicons to Lucide React
// Comprehensive mapping for standardizing icon usage

import {
  // User & Authentication
  Users,
  User,
  UserCheck,
  UserX,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Key,
  
  // System & Server
  Server,
  Database,
  HardDrive,
  Cpu,
  MemoryStick,
  Activity,
  Zap,
  Power,
  PowerOff,
  
  // Charts & Analytics
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  
  // Navigation
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  MoreVertical,
  
  // Actions
  Plus,
  Minus,
  Edit3 as Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Save,
  RefreshCw,
  RotateCcw,
  
  // Status & Feedback
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  HelpCircle,
  Clock,
  
  // Communication
  Mail,
  MailOpen,
  Send,
  MessageSquare,
  MessageCircle,
  Phone,
  PhoneCall,
  
  // Files & Documents
  File,
  FileText,
  Folder,
  FolderOpen,
  Paperclip,
  Archive,
  
  // Media
  Image,
  Video,
  Camera,
  Mic,
  Volume2,
  VolumeX,
  
  // Interface
  Search,
  Filter,
  Settings,
  Cog,
  Eye,
  EyeOff,
  Home,
  
  // Terminal & Development
  Terminal,
  Code,
  GitBranch,
  Command,
  
  // Task & Project Management
  ListTodo,
  CheckSquare,
  Square,
  Calendar,
  CalendarDays,
  Clock4,
  Timer,
  
  // Connectivity
  Wifi,
  WifiOff,
  Globe,
  Link,
  ExternalLink,
  
  // Miscellaneous
  Star,
  Heart,
  Bookmark,
  Flag,
  Tag,
  Hash,
} from 'lucide-react';

// Heroicons to Lucide React mapping
export const iconMapping = {
  // User & Authentication
  'UsersIcon': Users,
  'UserIcon': User,
  'UserCircleIcon': User,
  'UserPlusIcon': UserPlus,
  'ShieldCheckIcon': ShieldCheck,
  'ShieldExclamationIcon': ShieldAlert,
  'LockClosedIcon': Lock,
  'LockOpenIcon': Unlock,
  'KeyIcon': Key,
  
  // System & Server
  'ServerIcon': Server,
  'CircleStackIcon': Database,
  'CpuChipIcon': Cpu,
  'BoltIcon': Zap,
  'PowerIcon': Power,
  
  // Charts & Analytics
  'ChartBarIcon': BarChart3,
  'ChartLineIcon': LineChart,
  'ChartPieIcon': PieChart,
  'ArrowTrendingUpIcon': TrendingUp,
  'ArrowTrendingDownIcon': TrendingDown,
  'ArrowUpIcon': ArrowUp,
  'ArrowDownIcon': ArrowDown,
  'ArrowLeftIcon': ArrowLeft,
  'ArrowRightIcon': ArrowRight,
  
  // Navigation
  'Bars3Icon': Menu,
  'XMarkIcon': X,
  'ChevronDownIcon': ChevronDown,
  'ChevronUpIcon': ChevronUp,
  'ChevronLeftIcon': ChevronLeft,
  'ChevronRightIcon': ChevronRight,
  'EllipsisHorizontalIcon': MoreHorizontal,
  'EllipsisVerticalIcon': MoreVertical,
  
  // Actions
  'PlusIcon': Plus,
  'MinusIcon': Minus,
  'PencilIcon': Edit,
  'TrashIcon': Trash2,
  'DocumentDuplicateIcon': Copy,
  'ArrowDownTrayIcon': Download,
  'ArrowUpTrayIcon': Upload,
  'BookmarkIcon': Save,
  'ArrowPathIcon': RefreshCw,
  
  // Status & Feedback
  'CheckCircleIcon': CheckCircle,
  'XCircleIcon': XCircle,
  'ExclamationTriangleIcon': AlertTriangle,
  'ExclamationCircleIcon': AlertCircle,
  'InformationCircleIcon': Info,
  'QuestionMarkCircleIcon': HelpCircle,
  'ClockIcon': Clock,
  
  // Communication
  'EnvelopeIcon': Mail,
  'EnvelopeOpenIcon': MailOpen,
  'PaperAirplaneIcon': Send,
  'ChatBubbleLeftIcon': MessageSquare,
  'PhoneIcon': Phone,
  
  // Files & Documents
  'DocumentIcon': File,
  'DocumentTextIcon': FileText,
  'FolderIcon': Folder,
  'FolderOpenIcon': FolderOpen,
  'PaperClipIcon': Paperclip,
  'ArchiveBoxIcon': Archive,
  
  // Media
  'PhotoIcon': Image,
  'VideoCameraIcon': Video,
  'CameraIcon': Camera,
  'MicrophoneIcon': Mic,
  'SpeakerWaveIcon': Volume2,
  'SpeakerXMarkIcon': VolumeX,
  
  // Interface
  'MagnifyingGlassIcon': Search,
  'FunnelIcon': Filter,
  'CogIcon': Settings,
  'Cog6ToothIcon': Cog,
  'EyeIcon': Eye,
  'EyeSlashIcon': EyeOff,
  'HomeIcon': Home,
  
  // Terminal & Development
  'CommandLineIcon': Terminal,
  'CodeBracketIcon': Code,
  
  // Task & Project Management
  'ListBulletIcon': ListTodo,
  'CheckIcon': CheckSquare,
  'CalendarIcon': Calendar,
  'CalendarDaysIcon': CalendarDays,
  
  // Connectivity
  'WifiIcon': Wifi,
  'GlobeAltIcon': Globe,
  'LinkIcon': Link,
  'ArrowTopRightOnSquareIcon': ExternalLink,
  
  // Miscellaneous
  'StarIcon': Star,
  'HeartIcon': Heart,
  'BookmarkPlusIcon': Bookmark,
  'FlagIcon': Flag,
  'TagIcon': Tag,
  'HashtagIcon': Hash,
} as const;

// Export individual icons for direct usage
export {
  Users,
  User,
  UserCheck,
  UserX,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Key,
  Server,
  Database,
  HardDrive,
  Cpu,
  MemoryStick,
  Activity,
  Zap,
  Power,
  PowerOff,
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  MoreVertical,
  Plus,
  Minus,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Save,
  RefreshCw,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  HelpCircle,
  Clock,
  Mail,
  MailOpen,
  Send,
  MessageSquare,
  MessageCircle,
  Phone,
  PhoneCall,
  File,
  FileText,
  Folder,
  FolderOpen,
  Paperclip,
  Archive,
  Image,
  Video,
  Camera,
  Mic,
  Volume2,
  VolumeX,
  Search,
  Filter,
  Settings,
  Cog,
  Eye,
  EyeOff,
  Home,
  Terminal,
  Code,
  GitBranch,
  Command,
  ListTodo,
  CheckSquare,
  Square,
  Calendar,
  CalendarDays,
  Clock4,
  Timer,
  Wifi,
  WifiOff,
  Globe,
  Link,
  ExternalLink,
  Star,
  Heart,
  Bookmark,
  Flag,
  Tag,
  Hash,
};

// Type for icon names
export type IconName = keyof typeof iconMapping;

// Helper function to get icon by name
export const getIcon = (iconName: IconName) => {
  return iconMapping[iconName];
};

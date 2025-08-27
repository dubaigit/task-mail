/**
 * Centralized Icon System - Lucide React
 * 
 * This module provides a standardized icon system using Lucide React to replace
 * all Heroicons and custom SVGs across the application. All icons are imported
 * from lucide-react and organized by functional categories for easy usage.
 * 
 * Usage:
 * import { Icons } from '@/components/ui/icons';
 * <Icons.send className="w-4 h-4" />
 */

import {
  // Actions & Interface
  Send,
  Edit3,
  Pencil,
  Copy,
  Clipboard,
  Trash2,
  MoreHorizontal,
  Settings,
  SlidersHorizontal,
  Search,
  Filter,
  RefreshCw,
  RotateCcw,
  Play,
  Pause,
  Square,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ArrowUpRight,
  Undo2,
  Redo2,
  Wifi,
  CloudUpload,
  
  // Communication & Social
  MessageSquare,
  MessageCircle,
  Mail,
  Phone,
  Mic,
  Users,
  User,
  UserPlus,
  ArrowRight,
  
  // Time & Calendar
  Clock,
  Calendar,
  CalendarDays,
  Timer,
  
  // Status & Indicators
  CheckCircle,
  Check,
  Circle,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  XCircle,
  
  // Priority & Urgency
  Star,
  Zap as Bolt,
  Flame,
  Target,
  
  // Content & Documents
  FileText,
  File,
  Folder,
  FolderOpen,
  Image,
  Paperclip,
  Tag,
  Tags,
  Hash,
  
  // Technology & AI
  Bot,
  Brain,
  Cpu,
  Database,
  Sparkles,
  Lightbulb,
  Zap,
  
  // Navigation & Layout
  Home,
  Menu,
  Grid,
  List,
  Layout,
  Sidebar,
  PanelLeft,
  PanelRight,
  
  // Media Controls
  Volume2,
  VolumeX,
  Headphones,
  
  // Business & Workflow
  Briefcase,
  Building,
  TrendingUp,
  TrendingDown,
  BarChart,
  PieChart,
  
  // System & Tools
  Wrench,
  Cog,
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  
  // Miscellaneous
  Plus,
  Minus,
  Download,
  Upload,
  Share,
  Link,
  Bookmark,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Sun,
  Moon,
  Bell,
  Archive,
  Inbox
} from 'lucide-react';

/**
 * Centralized icon mapping with semantic names
 * Organized by functional categories for easy discovery
 */
export const Icons = {
  // Actions & Interface
  send: Send,
  edit: Edit3,
  pencil: Pencil,
  copy: Copy,
  clipboard: Clipboard,
  clipboardDocument: Clipboard,
  delete: Trash2,
  trash: Trash2,
  more: MoreHorizontal,
  settings: Settings,
  sliders: SlidersHorizontal,
  adjustments: SlidersHorizontal,
  search: Search,
  filter: Filter,
  refresh: RefreshCw,
  rotate: RotateCcw,
  play: Play,
  pause: Pause,
  stop: Square,
  square: Square,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  external: ExternalLink,
  externalLink: ArrowUpRight,
  undo: Undo2,
  redo: Redo2,
  arrowUturnLeft: Undo2,
  arrowUturnRight: Redo2,
  rotateLeft: Undo2,
  rotateRight: Redo2,
  
  // Communication & Social
  message: MessageSquare,
  messageSquare: MessageSquare,
  chat: MessageCircle,
  chatBubble: MessageCircle,
  mail: Mail,
  email: Mail,
  phone: Phone,
  mic: Mic,
  microphone: Mic,
  users: Users,
  userGroup: Users,
  user: User,
  userPlus: UserPlus,
  arrowRight: ArrowRight,
  
  // Time & Calendar
  clock: Clock,
  time: Clock,
  calendar: Calendar,
  calendarDays: CalendarDays,
  timer: Timer,
  
  // Status & Indicators
  checkCircle: CheckCircle,
  check: Check,
  success: CheckCircle,
  circle: Circle,
  alertCircle: AlertCircle,
  alert: AlertTriangle,
  warning: AlertTriangle,
  exclamationTriangle: AlertTriangle,
  exclamationCircle: AlertCircle,
  info: Info,
  x: X,
  close: X,
  xCircle: XCircle,
  error: XCircle,
  
  // Priority & Urgency
  star: Star,
  fire: Flame,
  bolt: Bolt,
  lightning: Zap,
  flame: Flame,
  target: Target,
  
  // Content & Documents
  fileText: FileText,
  document: FileText,
  documentText: FileText,
  file: File,
  folder: Folder,
  folderOpen: FolderOpen,
  image: Image,
  attachment: Paperclip,
  paperclip: Paperclip,
  tag: Tag,
  tags: Tags,
  hash: Hash,
  
  // Technology & AI
  bot: Bot,
  ai: Bot,
  brain: Brain,
  cpu: Cpu,
  database: Database,
  sparkles: Sparkles,
  magic: Sparkles,
  lightbulb: Lightbulb,
  idea: Lightbulb,
  zap: Zap,
  
  // Navigation & Layout
  home: Home,
  menu: Menu,
  grid: Grid,
  list: List,
  layout: Layout,
  sidebar: Sidebar,
  panelLeft: PanelLeft,
  panelRight: PanelRight,
  
  // Media Controls
  volume: Volume2,
  volumeMute: VolumeX,
  headphones: Headphones,
  
  // Business & Workflow
  briefcase: Briefcase,
  business: Building,
  building: Building,
  trendingUp: TrendingUp,
  trendingDown: TrendingDown,
  barChart: BarChart,
  pieChart: PieChart,
  arrowTrendingUp: TrendingUp,
  arrowTrendingDown: TrendingDown,
  
  // System & Tools
  wrench: Wrench,
  cog: Cog,
  shield: Shield,
  lock: Lock,
  unlock: Unlock,
  eye: Eye,
  eyeOff: EyeOff,
  
  // Miscellaneous
  plus: Plus,
  add: Plus,
  minus: Minus,
  download: Download,
  upload: Upload,
  share: Share,
  link: Link,
  bookmark: Bookmark,
  heart: Heart,
  thumbsUp: ThumbsUp,
  thumbsDown: ThumbsDown,
  sun: Sun,
  moon: Moon,
  bell: Bell,
  archive: Archive,
  inbox: Inbox,
  informationCircle: Info,
  information: Info,
  wifi: Wifi,
  cloudArrowUp: CloudUpload,
  
  // Legacy aliases for backward compatibility during transition
  paperAirplane: Send,
  ellipsisHorizontal: MoreHorizontal,
  trashIcon: Trash2,
  clockIcon: Clock,
  userIcon: User,
  calendarDaysIcon: Calendar,
  playIcon: Play,
  pauseIcon: Pause,
  tagIcon: Tag,
  chatBubbleLeftRight: MessageSquare,
  userGroupIcon: Users,
  arrowTopRightOnSquare: ExternalLink,
  arrowPath: RotateCcw,
  microphoneIcon: Mic,
  stopIcon: Square
} as const;

export type IconName = keyof typeof Icons;

/**
 * Icon size utilities for consistent sizing
 */
export const IconSizes = {
  xs: 'w-3 h-3',    // 12px
  sm: 'w-4 h-4',    // 16px
  md: 'w-5 h-5',    // 20px
  lg: 'w-6 h-6',    // 24px
  xl: 'w-8 h-8',    // 32px
  '2xl': 'w-10 h-10' // 40px
} as const;

/**
 * Common icon color classes for consistent styling
 */
export const IconColors = {
  primary: 'text-blue-600',
  secondary: 'text-gray-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600',
  muted: 'text-gray-400',
  white: 'text-white',
  current: 'text-current'
} as const;

/**
 * Helper function to get icon with default props
 */
export const getIcon = (iconName: IconName, _className?: string) => {
  const IconComponent = Icons[iconName];
  if (!IconComponent) {
    console.warn(`Icon "${iconName}" not found. Available icons:`, Object.keys(Icons));
    return null;
  }
  return IconComponent;
};

/**
 * Migration mapping for Heroicons to Lucide equivalents
 * This helps with systematic replacement across the codebase
 */
export const HeroiconsToLucideMapping = {
  // Heroicons -> Lucide
  'PaperAirplaneIcon': 'send',
  'SparklesIcon': 'sparkles',
  'ChatBubbleLeftRightIcon': 'messageSquare',
  'ExclamationCircleIcon': 'alertCircle',
  'CheckCircleIcon': 'checkCircle',
  'ArrowPathIcon': 'rotate',
  'LightBulbIcon': 'lightbulb',
  'ClockIcon': 'clock',
  'MicrophoneIcon': 'mic',
  'StopIcon': 'stop',
  'UserIcon': 'user',
  'CalendarDaysIcon': 'calendarDays',
  'ExclamationTriangleIcon': 'warning',
  'PlayIcon': 'play',
  'PauseIcon': 'pause',
  'TrashIcon': 'delete',
  'EllipsisHorizontalIcon': 'more',
  'TagIcon': 'tag',
  'UserGroupIcon': 'users',
  'DocumentTextIcon': 'document',
  'ArrowTopRightOnSquareIcon': 'external',
  'FireIcon': 'fire',
  'BoltIcon': 'bolt'
} as const;

export default Icons;

// Named exports for backward compatibility during migration
export const DocumentTextIcon = FileText;
export const ArrowUturnLeftIcon = Undo2;
export const ArrowUturnRightIcon = Redo2;
export const ClockIcon = Clock;
export const PaperAirplaneIcon = Send;
export const SparklesIcon = Sparkles;
export const ChatBubbleLeftRightIcon = MessageSquare;
export const ExclamationCircleIcon = AlertCircle;
export const CheckCircleIcon = CheckCircle;
export const ArrowPathIcon = RotateCcw;
export const LightBulbIcon = Lightbulb;
export const MicrophoneIcon = Mic;
export const StopIcon = Square;
export const UserIcon = User;
export const CalendarDaysIcon = CalendarDays;
export const ExclamationTriangleIcon = AlertTriangle;
export const PlayIcon = Play;
export const PauseIcon = Pause;
export const TrashIcon = Trash2;
export const EllipsisHorizontalIcon = MoreHorizontal;
export const TagIcon = Tag;
export const UserGroupIcon = Users;
export const ArrowTopRightOnSquareIcon = ExternalLink;
export const FireIcon = Flame;
export const BoltIcon = Bolt;
export const PencilIcon = Pencil;
export const ClipboardDocumentIcon = Clipboard;
export const PencilSquareIcon = Edit3;
export const ChatBubbleLeftEllipsisIcon = MessageSquare;
export const AdjustmentsHorizontalIcon = SlidersHorizontal;
export const XMarkIcon = X;
export const InformationCircleIcon = Info;
export const EyeIcon = Eye;
export const ShareIcon = Share;
export const BookmarkIcon = Bookmark;
export const StarIcon = Star;
export const Bars3Icon = Menu;
export const UsersIcon = Users;
export const SunIcon = Sun;
export const MoonIcon = Moon;
export const MagnifyingGlassIcon = Search;
export const PlusIcon = Plus;
export const ChevronUpIcon = ChevronUp;
export const ChevronDownIcon = ChevronDown;
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRightIcon = ChevronRight;
export const WifiIcon = Wifi;
export const CloudArrowUpIcon = CloudUpload;
export const FunnelIcon = Filter;
export const ArrowRightIcon = ArrowRight;
export const EnvelopeIcon = Mail;
export const DatabaseIcon = Database;
export const CogIcon = Cog;
export const CopyIcon = Copy;
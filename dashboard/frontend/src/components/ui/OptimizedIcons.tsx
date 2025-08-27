import React from 'react';
import { 
  // Core Navigation & UI Icons
  Menu, X, Home, Settings, User, Search, Filter,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  
  // Task & Email Management
  Mail, MailOpen, Archive, Trash2, Tag, Flag,
  CheckCircle, Circle, Clock, AlertCircle, Info,
  
  // Actions
  Plus, Minus, Edit, Save, Download, Upload,
  Copy, Share, Bookmark, Heart, Star,
  
  // Status & Feedback  
  CheckCircle2, XCircle, AlertTriangle, 
  Loader, Zap, TrendingUp, BarChart3,
  
  // AI & Analytics
  Brain, Cpu, Activity, PieChart,
  MessageSquare, Bot, Sparkles,
  
  // System
  Wifi, WifiOff, Battery, BatteryLow,
  Volume2, VolumeX, Sun, Moon,
  
  // Files & Data
  File, Folder, FileText, Image,
  Database, HardDrive, Cloud,
  
  // Communication
  Phone, Video, Mic, MicOff,
  Send, Reply, Forward,
  
  // Security
  Lock, Unlock, Shield, Eye, EyeOff,
  Key, Fingerprint,
  
  // Navigation
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  CornerDownLeft, CornerDownRight,
  ExternalLink, Link, Unlink,
  
  // Media Controls
  Play, Pause, SkipForward, SkipBack,
  
  // Utility
  Calendar, MapPin, Globe, Camera,
  QrCode, Scan, Printer, Monitor
} from 'lucide-react';

// Icon component with accessibility built-in
interface IconProps {
  name: keyof typeof iconMap;
  size?: number | string;
  className?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
  strokeWidth?: number;
}

// Optimized icon mapping for performance
const iconMap = {
  // Core Navigation & UI
  menu: Menu, close: X, home: Home, settings: Settings, user: User,
  search: Search, filter: Filter,
  'chevron-down': ChevronDown, 'chevron-up': ChevronUp,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  
  // Task & Email Management
  mail: Mail, 'mail-open': MailOpen, archive: Archive, trash: Trash2,
  tag: Tag, flag: Flag, 'check-circle': CheckCircle, circle: Circle,
  clock: Clock, alert: AlertCircle, info: Info,
  
  // Actions
  plus: Plus, minus: Minus, edit: Edit, save: Save,
  download: Download, upload: Upload, copy: Copy, share: Share,
  bookmark: Bookmark, heart: Heart, star: Star,
  
  // Status & Feedback
  success: CheckCircle2, error: XCircle, warning: AlertTriangle,
  loading: Loader, zap: Zap, 'trending-up': TrendingUp, chart: BarChart3,
  
  // AI & Analytics
  brain: Brain, cpu: Cpu, activity: Activity, 'pie-chart': PieChart,
  message: MessageSquare, bot: Bot, sparkles: Sparkles,
  
  // System
  wifi: Wifi, 'wifi-off': WifiOff, battery: Battery, 'battery-low': BatteryLow,
  volume: Volume2, mute: VolumeX, sun: Sun, moon: Moon,
  
  // Files & Data
  file: File, folder: Folder, 'file-text': FileText, image: Image,
  database: Database, 'hard-drive': HardDrive, cloud: Cloud,
  
  // Communication
  phone: Phone, video: Video, mic: Mic, 'mic-off': MicOff,
  send: Send, reply: Reply, forward: Forward,
  
  // Security
  lock: Lock, unlock: Unlock, shield: Shield, eye: Eye, 'eye-off': EyeOff,
  key: Key, fingerprint: Fingerprint,
  
  // Navigation
  'arrow-left': ArrowLeft, 'arrow-right': ArrowRight,
  'arrow-up': ArrowUp, 'arrow-down': ArrowDown,
  'corner-down-left': CornerDownLeft, 'corner-down-right': CornerDownRight,
  'external-link': ExternalLink, link: Link, unlink: Unlink,
  
  // Media Controls
  play: Play, pause: Pause, 
  'skip-forward': SkipForward, 'skip-back': SkipBack,
  
  // Utility
  calendar: Calendar, 'map-pin': MapPin, globe: Globe, camera: Camera,
  'qr-code': QrCode, scan: Scan, printer: Printer, monitor: Monitor
} as const;

export const OptimizedIcon: React.FC<IconProps> = ({
  name,
  size = 16,
  className = '',
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden = !ariaLabel,
  strokeWidth = 2
}) => {
  const IconComponent = iconMap[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in iconMap`);
    return null;
  }
  
  return (
    <IconComponent
      size={size}
      className={className}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      strokeWidth={strokeWidth}
    />
  );
};

// Export individual icon components for direct usage
export {
  Menu, X, Home, Settings, User, Search, Filter,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Mail, MailOpen, Archive, Trash2, Tag, Flag,
  CheckCircle, Circle, Clock, AlertCircle, Info,
  Plus, Minus, Edit, Save, Download, Upload,
  Copy, Share, Bookmark, Heart, Star,
  CheckCircle2, XCircle, AlertTriangle,
  Loader, Zap, TrendingUp, BarChart3,
  Brain, Cpu, Activity, PieChart,
  MessageSquare, Bot, Sparkles,
  Wifi, WifiOff, Battery, BatteryLow,
  Volume2, VolumeX, Sun, Moon,
  File, Folder, FileText, Image,
  Database, HardDrive, Cloud,
  Phone, Video, Mic, MicOff,
  Send, Reply, Forward,
  Lock, Unlock, Shield, Eye, EyeOff,
  Key, Fingerprint,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  CornerDownLeft, CornerDownRight,
  ExternalLink, Link, Unlink,
  Play, Pause, SkipForward, SkipBack,
  Calendar, MapPin, Globe, Camera,
  QrCode, Scan, Printer, Monitor
};

// Icon size presets for consistency
export const IconSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32
} as const;

// Common icon combinations for specific use cases
export const IconPresets = {
  taskStatus: {
    pending: { name: 'circle' as const, className: 'text-yellow-400' },
    completed: { name: 'check-circle' as const, className: 'text-green-400' },
    failed: { name: 'error' as const, className: 'text-red-400' }
  },
  
  emailStatus: {
    unread: { name: 'mail' as const, className: 'text-blue-400' },
    read: { name: 'mail-open' as const, className: 'text-slate-400' },
    archived: { name: 'archive' as const, className: 'text-slate-500' }
  },
  
  priority: {
    high: { name: 'flag' as const, className: 'text-red-400' },
    medium: { name: 'flag' as const, className: 'text-yellow-400' },
    low: { name: 'flag' as const, className: 'text-green-400' }
  }
} as const;

export default OptimizedIcon;
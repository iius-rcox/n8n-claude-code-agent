import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bell,
  X,
  Clock,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronDown,
  BellOff,
} from 'lucide-react';

type NotificationType = 'error' | 'warning' | 'info' | 'success';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  snoozedUntil?: Date;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Snooze duration options
const SNOOZE_OPTIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
  { label: 'Until tomorrow', minutes: 60 * 24 },
] as const;

// Get notification styling
function getNotificationConfig(type: NotificationType) {
  const configs: Record<NotificationType, {
    bg: string;
    border: string;
    icon: React.ReactNode;
    iconColor: string;
  }> = {
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: <AlertCircle className="h-4 w-4" />,
      iconColor: 'text-red-400',
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      icon: <AlertTriangle className="h-4 w-4" />,
      iconColor: 'text-yellow-400',
    },
    info: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
      icon: <Info className="h-4 w-4" />,
      iconColor: 'text-cyan-400',
    },
    success: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      icon: <CheckCircle2 className="h-4 w-4" />,
      iconColor: 'text-green-400',
    },
  };
  return configs[type];
}

// Storage key for persisted notifications
const STORAGE_KEY = 'dashboard-notifications';

// Load snoozed notifications from localStorage
function loadSnoozedNotifications(): Record<string, Date> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    // Convert string dates back to Date objects
    const result: Record<string, Date> = {};
    for (const [id, dateStr] of Object.entries(parsed)) {
      result[id] = new Date(dateStr as string);
    }
    return result;
  } catch {
    return {};
  }
}

// Save snoozed notifications to localStorage
function saveSnoozedNotifications(snoozed: Record<string, Date>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snoozed));
}

// Single Notification Component
function NotificationItem({
  notification,
  onDismiss,
  onSnooze,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
}) {
  const config = getNotificationConfig(notification.type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`
        relative flex items-start gap-3 p-3 rounded-lg border
        ${config.bg} ${config.border}
        shadow-sm
      `}
    >
      {/* Icon */}
      <div className={`mt-0.5 ${config.iconColor}`}>
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{notification.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{notification.message}</p>
          </div>
          <div className="flex items-center gap-1">
            {/* Snooze dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs hover:bg-muted/50"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Snooze
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SNOOZE_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.minutes}
                    onClick={() => onSnooze(notification.id, option.minutes)}
                  >
                    <Clock className="h-3 w-3 mr-2" />
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Dismiss button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted/50"
              onClick={() => onDismiss(notification.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Action button */}
        {notification.action && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={notification.action.onClick}
          >
            {notification.action.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

interface SmartNotificationsProps {
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  authStatus?: 'authenticated' | 'expired' | 'unknown';
  pendingTasks?: number;
}

export function SmartNotifications({
  healthStatus = 'healthy',
  authStatus = 'authenticated',
  pendingTasks = 0,
}: SmartNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [snoozed, setSnoozed] = useState<Record<string, Date>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Load snoozed state on mount
  useEffect(() => {
    setSnoozed(loadSnoozedNotifications());
  }, []);

  // Generate notifications based on system state
  const generateNotifications = useCallback(() => {
    const newNotifications: Notification[] = [];

    // Auth issues
    if (authStatus === 'expired') {
      newNotifications.push({
        id: 'auth-expired',
        type: 'error',
        title: 'Authentication Expired',
        message: 'Claude session tokens have expired. Refresh authentication to continue.',
        timestamp: new Date(),
        action: {
          label: 'Fix Now',
          onClick: () => {
            const authSection = document.querySelector('[data-section="auth"]');
            authSection?.scrollIntoView({ behavior: 'smooth' });
          },
        },
      });
    }

    // Health issues
    if (healthStatus === 'unhealthy') {
      newNotifications.push({
        id: 'health-critical',
        type: 'error',
        title: 'System Health Critical',
        message: 'One or more components are failing. Immediate attention required.',
        timestamp: new Date(),
        action: {
          label: 'View Health',
          onClick: () => {
            const healthSection = document.querySelector('[data-section="health"]');
            healthSection?.scrollIntoView({ behavior: 'smooth' });
          },
        },
      });
    } else if (healthStatus === 'degraded') {
      newNotifications.push({
        id: 'health-degraded',
        type: 'warning',
        title: 'System Health Degraded',
        message: 'Some components are experiencing issues.',
        timestamp: new Date(),
        action: {
          label: 'View Health',
          onClick: () => {
            const healthSection = document.querySelector('[data-section="health"]');
            healthSection?.scrollIntoView({ behavior: 'smooth' });
          },
        },
      });
    }

    // Pending tasks
    if (pendingTasks > 5) {
      newNotifications.push({
        id: 'tasks-backlog',
        type: 'info',
        title: 'Task Backlog Building',
        message: `${pendingTasks} tasks pending in the pipeline.`,
        timestamp: new Date(),
        action: {
          label: 'View Pipeline',
          onClick: () => {
            const pipelineSection = document.querySelector('[data-section="pipeline"]');
            pipelineSection?.scrollIntoView({ behavior: 'smooth' });
          },
        },
      });
    }

    return newNotifications;
  }, [healthStatus, authStatus, pendingTasks]);

  // Update notifications when system state changes
  useEffect(() => {
    setNotifications(generateNotifications());
  }, [generateNotifications]);

  // Check for expired snoozes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const updatedSnoozed = { ...snoozed };
      let changed = false;

      for (const [id, until] of Object.entries(updatedSnoozed)) {
        if (until <= now) {
          delete updatedSnoozed[id];
          changed = true;
        }
      }

      if (changed) {
        setSnoozed(updatedSnoozed);
        saveSnoozedNotifications(updatedSnoozed);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [snoozed]);

  // Handle snooze
  const handleSnooze = useCallback((id: string, minutes: number) => {
    const until = new Date(Date.now() + minutes * 60 * 1000);
    const updatedSnoozed = { ...snoozed, [id]: until };
    setSnoozed(updatedSnoozed);
    saveSnoozedNotifications(updatedSnoozed);
  }, [snoozed]);

  // Handle dismiss
  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  // Filter out snoozed and dismissed notifications
  const activeNotifications = notifications.filter((n) => {
    if (dismissed.has(n.id)) return false;
    const snoozedUntil = snoozed[n.id];
    if (snoozedUntil && snoozedUntil > new Date()) return false;
    return true;
  });

  // Don't render if no active notifications
  if (activeNotifications.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span>Notifications</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
            {activeNotifications.length}
          </span>
        </div>
        {Object.keys(snoozed).length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BellOff className="h-3 w-3" />
            <span>{Object.keys(snoozed).length} snoozed</span>
          </div>
        )}
      </div>

      {/* Notifications List */}
      <AnimatePresence mode="popLayout">
        {activeNotifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={handleDismiss}
            onSnooze={handleSnooze}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

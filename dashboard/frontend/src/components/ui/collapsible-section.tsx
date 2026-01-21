import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useSectionState } from '@/hooks/use-section-state';

interface CollapsibleSectionProps {
  /** Unique identifier for persisting state */
  sectionId: string;
  /** Section title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Icon displayed next to title */
  icon: ReactNode;
  /** Optional badge shown in header (e.g., status indicator) */
  badge?: ReactNode;
  /** Content shown in collapsed header (e.g., summary stats) */
  collapsedContent?: ReactNode;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Auto-collapse when healthy, expand when issues */
  autoCollapseOnHealthy?: boolean;
  /** Whether there's currently an issue (used with autoCollapseOnHealthy) */
  hasIssue?: boolean;
  /** Callback for refresh button */
  onRefresh?: () => void;
  /** Loading state for refresh button */
  isLoading?: boolean;
  /** Force expand/collapse from parent (for global toggle) */
  forceState?: 'expanded' | 'collapsed' | null;
  /** Footer content (e.g., timestamp, collapse button) */
  footer?: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Additional class names */
  className?: string;
}

export function CollapsibleSection({
  sectionId,
  title,
  subtitle,
  icon,
  badge,
  collapsedContent,
  defaultCollapsed = true,
  autoCollapseOnHealthy = false,
  hasIssue = false,
  onRefresh,
  isLoading = false,
  forceState,
  footer,
  children,
  className = '',
}: CollapsibleSectionProps) {
  const { isCollapsed, expand, collapse } = useSectionState(
    sectionId,
    defaultCollapsed
  );

  // Handle auto-collapse based on health status
  useEffect(() => {
    if (autoCollapseOnHealthy) {
      if (hasIssue) {
        expand();
      } else {
        collapse();
      }
    }
  }, [hasIssue, autoCollapseOnHealthy, expand, collapse]);

  // Handle force state from parent (global toggle)
  useEffect(() => {
    if (forceState === 'expanded') {
      expand();
    } else if (forceState === 'collapsed') {
      collapse();
    }
  }, [forceState, expand, collapse]);

  return (
    <Card className={`border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden ${className}`}>
      <CardHeader
        className={`${isCollapsed ? 'cursor-pointer hover:bg-muted/50' : ''} border-b border-border/30 transition-colors`}
        onClick={() => isCollapsed && expand()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: isCollapsed ? 0 : 90 }}
              transition={{ duration: 0.2 }}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </motion.div>
            <div className="relative">
              {icon}
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-3 text-base">
                <span>{title}</span>
                {badge}
                {isCollapsed && collapsedContent}
              </CardTitle>
              {!isCollapsed && subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  collapse();
                }}
                className="text-xs hover:bg-muted"
              >
                Collapse
              </Button>
            )}
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
                disabled={isLoading}
                className="hover:bg-muted"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <CardContent className="pt-4">
              {children}
              {footer && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
                  {footer}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KeyboardShortcutsHelp } from './keyboard-shortcuts-help';

interface DashboardControlsProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function DashboardControls({ onExpandAll, onCollapseAll }: DashboardControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex items-center justify-between mb-4"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">SECTIONS</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpandAll}
            className="h-7 px-2 text-xs hover:bg-cyan-500/10 hover:text-cyan-400"
            title="Expand all sections (E)"
          >
            <ChevronDown className="w-3 h-3 mr-1" />
            Expand All
          </Button>
          <span className="text-muted-foreground/50">/</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCollapseAll}
            className="h-7 px-2 text-xs hover:bg-cyan-500/10 hover:text-cyan-400"
            title="Collapse all sections (C)"
          >
            <ChevronUp className="w-3 h-3 mr-1" />
            Collapse All
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <KeyboardShortcutsHelp />
      </div>
    </motion.div>
  );
}

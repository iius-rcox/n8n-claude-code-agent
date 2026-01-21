import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShortcutItem {
  keys: string[];
  description: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: ['E'], description: 'Expand all sections' },
  { keys: ['C'], description: 'Collapse all sections' },
  { keys: ['1'], description: 'Go to Health Panel' },
  { keys: ['2'], description: 'Go to Authentication' },
  { keys: ['3'], description: 'Go to CronJobs' },
  { keys: ['4'], description: 'Go to Pipeline Board' },
  { keys: ['5'], description: 'Go to Execution Feed' },
  { keys: ['6'], description: 'Go to Storage Browser' },
  { keys: ['7'], description: 'Go to Agent Executor' },
  { keys: ['8'], description: 'Go to History' },
  { keys: ['?'], description: 'Toggle this help' },
];

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="border-border/50 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="w-4 h-4" />
      </Button>

      {/* Help Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 right-4 z-50 w-72 bg-card/95 backdrop-blur-xl border border-border/50 rounded-lg shadow-xl"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-cyan-400" />
                  Keyboard Shortcuts
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <kbd
                          key={keyIndex}
                          className="px-1.5 py-0.5 bg-muted/50 border border-border/50 rounded text-[10px] font-mono text-foreground"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground">
                  Press <kbd className="px-1 py-0.5 bg-muted/50 border border-border/50 rounded font-mono">?</kbd> to toggle this panel
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

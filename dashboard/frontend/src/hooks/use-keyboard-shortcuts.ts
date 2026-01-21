import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

/**
 * Hook for registering global keyboard shortcuts
 * Handles modifier keys and prevents conflicts with text inputs
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Navigate to a dashboard section by its data-section attribute
 */
export function navigateToSection(sectionId: string) {
  const element = document.querySelector(`[data-section="${sectionId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Add a brief highlight effect
    element.classList.add('ring-2', 'ring-cyan-500/50');
    setTimeout(() => {
      element.classList.remove('ring-2', 'ring-cyan-500/50');
    }, 1500);
  }
}

/**
 * Predefined section IDs for the dashboard
 */
export const SECTION_IDS = {
  health: 'health',
  auth: 'auth',
  cronjobs: 'cronjobs',
  pipeline: 'pipeline',
  executions: 'executions',
  storage: 'storage',
  agent: 'agent',
  history: 'history',
} as const;

export type SectionId = typeof SECTION_IDS[keyof typeof SECTION_IDS];

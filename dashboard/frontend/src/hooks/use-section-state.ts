import { useState, useCallback, useEffect } from 'react';

/**
 * Hook for persisting section collapse/expand state in localStorage
 * Provides consistent state management across dashboard sections
 */
export function useSectionState(sectionId: string, defaultCollapsed: boolean = true) {
  const storageKey = `dashboard-section-${sectionId}`;

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return defaultCollapsed;
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === 'true' : defaultCollapsed;
  });

  // Persist to localStorage when state changes
  useEffect(() => {
    localStorage.setItem(storageKey, String(isCollapsed));
  }, [storageKey, isCollapsed]);

  const toggle = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const expand = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const collapse = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  return {
    isCollapsed,
    toggle,
    expand,
    collapse,
    setIsCollapsed
  };
}

/**
 * Hook for managing global expand/collapse state across all sections
 */
export function useGlobalSectionState() {
  const [globalState, setGlobalState] = useState<'expanded' | 'collapsed' | null>(null);

  const expandAll = useCallback(() => {
    setGlobalState('expanded');
    // Reset after applying to allow individual control
    setTimeout(() => setGlobalState(null), 100);
  }, []);

  const collapseAll = useCallback(() => {
    setGlobalState('collapsed');
    // Reset after applying to allow individual control
    setTimeout(() => setGlobalState(null), 100);
  }, []);

  const toggleAll = useCallback(() => {
    setGlobalState(prev => prev === 'expanded' ? 'collapsed' : 'expanded');
    setTimeout(() => setGlobalState(null), 100);
  }, []);

  return { globalState, expandAll, collapseAll, toggleAll };
}

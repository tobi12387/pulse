import { useCallback, useState } from 'react';
import {
  HOME_SURFACE_ORDER,
  HOME_SURFACE_STORAGE_KEY,
  type HomeSurfaceFocus,
} from './home-surface-preferences-model';

function parseFocus(value: string | null): HomeSurfaceFocus {
  if (value === 'training' || value === 'mental' || value === 'review') return value;
  return 'balanced';
}

function readStoredFocus(): HomeSurfaceFocus {
  if (typeof window === 'undefined') return 'balanced';
  return parseFocus(window.localStorage.getItem(HOME_SURFACE_STORAGE_KEY));
}

export function useHomeSurfaceFocus() {
  const [focus, setFocusState] = useState<HomeSurfaceFocus>(readStoredFocus);

  const setFocus = useCallback((nextFocus: HomeSurfaceFocus) => {
    setFocusState(nextFocus);
    if (typeof window === 'undefined') return;
    if (nextFocus === 'balanced') {
      window.localStorage.removeItem(HOME_SURFACE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(HOME_SURFACE_STORAGE_KEY, nextFocus);
  }, []);

  const resetFocus = useCallback(() => {
    setFocusState('balanced');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(HOME_SURFACE_STORAGE_KEY);
    }
  }, []);

  return {
    focus,
    order: HOME_SURFACE_ORDER[focus],
    setFocus,
    resetFocus,
  };
}

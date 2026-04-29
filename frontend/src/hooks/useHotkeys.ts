import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const KEY_MAP: Record<string, string> = {
  '1': '/',
  '2': '/coach',
  '3': '/data',
  '4': '/plan',
  '5': '/insights',
  '6': '/settings',
};

export function useNavHotkeys() {
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Skip when typing in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const route = KEY_MAP[e.key];
      if (route) {
        e.preventDefault();
        navigate(route);
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}

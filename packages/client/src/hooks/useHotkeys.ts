import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ROUTES: Record<string, string> = {
  e: '/',
  t: '/tech',
  s: '/ships',
  w: '/warfare',
  y: '/spy',
  p: '/projects',
  d: '/diplomacy',
  c: '/council',
  b: '/battles',
  i: '/info',
  m: '/blackmarket',
  r: '/prefs',
};

export function useHotkeys() {
  const navigate = useNavigate();

  useEffect(() => {
    const handle = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement).tagName;
      // Skip when user is typing in an input
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

      const route = ROUTES[ev.key.toLowerCase()];
      if (route) void navigate(route);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [navigate]);
}

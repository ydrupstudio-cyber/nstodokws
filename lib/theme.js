'use client';

import { useEffect } from 'react';

export function applyTheme(theme) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  let actual = theme;
  if (theme === 'system') {
    actual = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', actual);
}

export function useTheme() {
  useEffect(() => {
    const stored = localStorage.getItem('theme') || 'system';
    applyTheme(stored);
    if (stored === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);
}

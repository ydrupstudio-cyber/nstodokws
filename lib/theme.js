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
  // 주소창 색도 같이 맞춘다. globals.css 가 data-theme 을 보고
  // color-scheme 까지 dark 로 못박아 브라우저의 '웹페이지 어둡게' 를 물린다
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', actual === 'dark' ? '#1a1a18' : '#fafaf7');
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

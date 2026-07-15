'use client';

import { useState, useEffect } from 'react';

export default function PhotoViewer({ url, urls, onClose }) {
  const [index, setIndex] = useState(urls.indexOf(url) >= 0 ? urls.indexOf(url) : 0);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
      if (e.key === 'ArrowRight' && index < urls.length - 1) setIndex(index + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, urls.length, onClose]);

  return (
    <div onClick={onClose} style={styles.overlay}>
      <button onClick={onClose} style={styles.close}>×</button>
      {urls.length > 1 && <div style={styles.counter}>{index + 1} / {urls.length}</div>}
      <img src={urls[index]} alt="" onClick={(e) => e.stopPropagation()} style={styles.image} />
      {urls.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); if (index > 0) setIndex(index - 1); }} disabled={index === 0} style={{ ...styles.navBtn, left: 16, opacity: index === 0 ? 0.3 : 1 }}>‹</button>
          <button onClick={(e) => { e.stopPropagation(); if (index < urls.length - 1) setIndex(index + 1); }} disabled={index === urls.length - 1} style={{ ...styles.navBtn, right: 16, opacity: index === urls.length - 1 ? 0.3 : 1 }}>›</button>
        </>
      )}
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  image: { maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 },
  close: { position: 'absolute', top: 16, right: 16, width: 44, height: 44, fontSize: 28, color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  counter: { position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 13, background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: 100 },
  navBtn: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, fontSize: 28, color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

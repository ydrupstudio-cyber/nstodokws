'use client';

/*
  핀 입력 창. 두 군데에서 쓴다 —
    · 남의 계정으로 바꿀 때 (한 칸)
    · 핀을 새로 걸거나 바꿀 때 (두 칸: 새 핀 + 확인. 잘못 눌러 잠기는 걸 막는다)
*/
import { useState } from 'react';

const only4 = (v) => v.replace(/[^0-9]/g, '').slice(0, 4);

export function PinField({ label, value, onChange, autoFocus }) {
  return (
    <label style={s.field}>
      <span style={s.label}>{label}</span>
      <input
        type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
        maxLength={4} value={value} autoFocus={autoFocus}
        onChange={(e) => onChange(only4(e.target.value))}
        placeholder="••••" style={s.input}
      />
    </label>
  );
}

/** 확인용 — 핀 한 칸 */
export default function PinGate({ name, busy, error, onCancel, onSubmit }) {
  const [pin, setPin] = useState('');
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={s.sheet}>
        <h2 style={s.title}>{name} 본인 확인</h2>
        <p style={s.hint}>이 계정에는 핀이 걸려 있어요. 네 자리를 넣어주세요.</p>
        <PinField label="핀" value={pin} onChange={setPin} autoFocus />
        {error && <div style={s.err}>{error}</div>}
        <div style={s.row}>
          <button onClick={onCancel} style={s.ghost}>그만두기</button>
          <button onClick={() => onSubmit(pin)} disabled={busy || pin.length !== 4}
            style={{ ...s.primary, ...(pin.length !== 4 ? s.off : {}) }}>
            {busy ? '확인 중…' : '확인'}
          </button>
        </div>
        <p style={s.foot}>한 번 확인하면 이 기기에서는 다시 묻지 않아요.</p>
      </div>
    </div>
  );
}

const s = {
  sheet: { maxWidth: 340, padding: '20px 18px 16px' },
  title: { fontSize: 17, fontWeight: 600, marginBottom: 6 },
  hint: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 },
  field: { display: 'block', marginBottom: 10 },
  label: { display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 5 },
  input: { width: '100%', padding: '11px 12px', border: '1px solid var(--border)',
           borderRadius: 9, fontSize: 20, letterSpacing: '0.45em', textAlign: 'center',
           background: 'var(--surface)', color: 'var(--text)' },
  err: { fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg)',
         padding: '8px 10px', borderRadius: 8, margin: '4px 0 10px' },
  row: { display: 'flex', gap: 7, marginTop: 6 },
  ghost: { flex: 1, padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600,
           border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)' },
  primary: { flex: 1, padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600,
             background: 'var(--text)', color: 'var(--bg)', border: 'none' },
  off: { opacity: 0.45 },
  foot: { fontSize: 11.5, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.6 },
};

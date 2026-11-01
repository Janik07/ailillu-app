import { useState, type CSSProperties, type ReactNode } from 'react';
import { mediaUrl, type MediaBase } from '../api/client';
import type { Chain, Mode } from '../domain/catalog';
import { useApp } from '../store/app';
import { Icon, type IconName } from './Icon';

interface PhotoProps {
  base: MediaBase;
  path: string | null | undefined;
  /** Full-width photos get the 640 file on sharp screens; everything smaller stays at 320. */
  wide?: boolean;
  className?: string;
  style?: CSSProperties;
  eager?: boolean;
  alt?: string;
}

/**
 * All photos go through this. The API resizes on demand, so a venue photo that is
 * 1.6 MB in the original arrives as 17 KB here.
 */
export function Photo({ base, path, wide, className, style, eager, alt = '' }: PhotoProps) {
  const [broken, setBroken] = useState(false);
  if (!path || broken) return <span className={`photo-empty ${className ?? ''}`} style={style} />;
  return (
    <img
      className={className}
      style={style}
      src={mediaUrl(base, path, 320)}
      srcSet={wide ? `${mediaUrl(base, path, 320)} 320w, ${mediaUrl(base, path, 640)} 640w` : undefined}
      sizes={wide ? '(max-width: 440px) 100vw, 440px' : undefined}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

export function ChainThumb({ chain, size = 72 }: { chain: Pick<Chain, 'photo' | 'title'>; size?: number }) {
  const box = { width: size, height: size };
  if (chain.photo) return <Photo base="restaurant" path={chain.photo} className="thumb" style={box} />;
  return (
    <span className="initials" style={box}>
      {chain.title.slice(0, 2)}
    </span>
  );
}

export function Stepper({ qty, onChange }: { qty: number; onChange: (qty: number) => void }) {
  return (
    <div className="stepper">
      <button aria-label="Меньше" onClick={() => onChange(qty - 1)}>
        <Icon name="minus" size={18} />
      </button>
      <b>{qty}</b>
      <button aria-label="Больше" onClick={() => onChange(qty + 1)}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

export function Header({ title, sub, onBack, right }: { title: string; sub?: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="pad row header">
      <button className="iconbtn" aria-label="Назад" onClick={onBack}>
        <Icon name="back" />
      </button>
      <div className="grow">
        <div className="header-title">{title}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

const MODE_LABELS: Record<Mode, [IconName, string]> = {
  table: ['seat', 'Столик'],
  takeaway: ['bag', 'С собой'],
  delivery: ['truck', 'Доставка'],
};

export function Modes({ modes }: { modes: Mode[] }) {
  return (
    <div className="modes">
      {modes.map((m) => (
        <span key={m}>
          <Icon name={MODE_LABELS[m][0]} size={13} weight={2} />
          {MODE_LABELS[m][1]}
        </span>
      ))}
    </div>
  );
}

export const KaspiMark = () => <span className="kaspi">K</span>;

export function Spinner({ label }: { label: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="pad load-error">
      <p className="h2">{text}</p>
      <p className="muted">Проверьте интернет и попробуйте ещё раз.</p>
      <button className="btn ghost" onClick={onRetry}>
        Повторить
      </button>
    </div>
  );
}

export function Toast() {
  const note = useApp((s) => s.note);
  const dismiss = useApp((s) => s.dismissToast);
  if (!note) return null;
  return (
    <div className="toast" role="status">
      {note.image && <Photo base="dalle" path={note.image} className="toast-img" />}
      <div className="grow">
        <b>{note.text}</b>
        {note.sub && <div className="small toast-sub">{note.sub}</div>}
      </div>
      {note.action && (
        <button
          className="toast-act"
          onClick={() => {
            dismiss();
            note.action?.run();
          }}
        >
          {note.action.label}
        </button>
      )}
    </div>
  );
}

export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={label}>
      <div className="sheet-back" onClick={onClose} />
      <div className="sheet">
        <div className="grab">
          <span />
        </div>
        {children}
      </div>
    </div>
  );
}

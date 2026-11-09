import { FileSpreadsheet, ShieldCheck, Trash2, Upload, ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';
import { dateLabel } from '../lib/analytics';
import { bytes, money } from '../lib/format';
import type { StoredFile } from '../lib/types';

interface Props {
  files: StoredFile[];
  usage: number;
  onFiles: (files: File[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onDemo: () => void;
}

export function useDrop(onFiles: (f: File[]) => void) {
  const [drag, setDrag] = useState(false);
  return {
    drag,
    props: {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setDrag(true);
      },
      onDragLeave: () => setDrag(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDrag(false);
        const list = [...e.dataTransfer.files];
        if (list.length) onFiles(list);
      },
    },
  };
}

export function FileInput({ inputRef, onFiles }: { inputRef: React.RefObject<HTMLInputElement | null>; onFiles: (f: File[]) => void }) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept=".csv,text/csv"
      multiple
      hidden
      onChange={(e) => {
        const list = [...(e.target.files ?? [])];
        if (list.length) onFiles(list);
        e.target.value = '';
      }}
    />
  );
}

export function FileManager({ files, usage, onFiles, onDelete, onClear, onDemo }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const { drag, props } = useDrop(onFiles);
  const [collapsed, setCollapsed] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className={`side-files ${collapsed ? 'collapsed' : ''}`}>
      <div className="side-section-title">
        <span>Fișierele mele ({files.length})</span>
        <button className="icon-btn mobile-only" onClick={() => setCollapsed(!collapsed)} aria-label="Arată fișierele">
          <ChevronDown size={16} style={{ transform: collapsed ? 'none' : 'rotate(180deg)' }} />
        </button>
      </div>
      <div className="files">
        {files.map((f) => (
          <div className="file" key={f.id} title={f.name}>
            <div className="file-ico">
              <FileSpreadsheet size={17} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="file-name">{f.name}</div>
              <div className="file-meta">
                {f.from ? `${dateLabel(f.from)} – ${dateLabel(f.to)}` : 'fără tranzacții'}
              </div>
              <div className="file-meta">
                {f.count} tranz. · <span className="pos">+{money(f.totalIn, f.currency, 0)}</span> · −{money(f.totalOut, f.currency, 0)}
              </div>
            </div>
            <button className="icon-btn" onClick={() => onDelete(f.id)} aria-label={`Șterge ${f.name}`} title="Șterge fișierul din browser">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="dropzone-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={`dropzone ${drag ? 'drag' : ''}`} onClick={() => input.current?.click()} {...props}>
            <Upload size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
            Adaugă extras CSV
            <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>Trage aici sau click · se pot combina mai multe luni</div>
          </div>
          <FileInput inputRef={input} onFiles={onFiles} />
          <div className="row between">
            <button className="btn ghost sm" onClick={onDemo}>+ Date demo</button>
            {files.length > 0 &&
              (confirmClear ? (
                <span className="row" style={{ gap: 6 }}>
                  <button className="btn ghost sm danger" onClick={() => { onClear(); setConfirmClear(false); }}>Confirm</button>
                  <button className="btn ghost sm" onClick={() => setConfirmClear(false)}>Nu</button>
                </span>
              ) : (
                <button className="btn ghost sm danger" onClick={() => setConfirmClear(true)}>
                  <Trash2 size={13} /> Șterge tot
                </button>
              ))}
          </div>
          <div className="privacy">
            <ShieldCheck size={16} />
            <div>
              Datele rămân doar în acest browser (localStorage, {bytes(usage)} folosiți). Nimic nu e trimis pe vreun server.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

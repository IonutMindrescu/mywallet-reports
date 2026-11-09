import { ChartPie, Lock, Repeat, Sparkles, Upload, CalendarRange } from 'lucide-react';
import { useRef } from 'react';
import { FileInput, useDrop } from '../components/FileManager';
import { Logo } from '../components/Logo';

export function Empty({ onFiles, onDemo }: { onFiles: (f: File[]) => void; onDemo: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const { drag, props } = useDrop(onFiles);
  const features = [
    { icon: ChartPie, color: '#a78bfa', t: 'Categorii automate', s: '35+ categorii și sute de comercianți români recunoscuți automat.' },
    { icon: CalendarRange, color: '#22d3ee', t: 'Tipare de cheltuieli', s: 'Calendar, zile ale săptămânii, ritmul lunar și proiecții.' },
    { icon: Repeat, color: '#f472b6', t: 'Abonamente ascunse', s: 'Detectează plățile recurente și cât te costă pe an.' },
    { icon: Sparkles, color: '#34d399', t: 'Observații inteligente', s: 'Rata de economisire, creșteri neobișnuite, efectul cafelei.' },
  ];
  return (
    <div className="hero fade-in">
      <div className="hero-logo">
        <Logo size={88} />
      </div>
      <span className="pill">
        <Lock size={14} /> Datele tale nu părăsesc niciodată browserul
      </span>
      <h1>
        Află <span className="grad">unde se duc banii</span>
        <br /> tăi, în câteva secunde.
      </h1>
      <p>Încarcă extrasul de cont în format CSV (1–12 luni sau mai mult) și primești instant un raport vizual complet al veniturilor și cheltuielilor tale.</p>

      <div className={`hero-drop ${drag ? 'drag' : ''}`} onClick={() => input.current?.click()} {...props}>
        <div className="hero-drop-ico">
          <Upload size={28} color="white" />
        </div>
        <div style={{ fontSize: 17, fontWeight: 600 }}>Trage aici extrasul CSV sau apasă pentru a alege</div>
        <div className="faint" style={{ marginTop: 6 }}>Poți selecta mai multe fișiere deodată — suprapunerile sunt eliminate automat</div>
        <FileInput inputRef={input} onFiles={onFiles} />
      </div>
      <div style={{ marginTop: 18 }}>
        <button className="btn ghost" onClick={onDemo}>
          <Sparkles size={15} /> Vreau să văd mai întâi cu date demo
        </button>
      </div>

      <div className="features">
        {features.map((f) => (
          <div className="card feature" key={f.t}>
            <div className="kpi-ico" style={{ background: f.color + '22', color: f.color, width: 34, height: 34 }}>
              <f.icon size={18} />
            </div>
            <b>{f.t}</b>
            <span>{f.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

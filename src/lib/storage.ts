import { normalizeMerchant } from './merchants';
import type { StoredFile, Tx } from './types';

const K = {
  files: 'mwr.files.v1',
  overrides: 'mwr.overrides.v1',
  excluded: 'mwr.excluded.v1',
  prefs: 'mwr.prefs.v1',
  dismissed: 'mwr.dismissed.v1',
  loans: 'mwr.loans.v1',
};

/** Names the user said are NOT their own accounts (answered "Nu" on the own-account hint). */
export const loadNotOwn = (): string[] => {
  const v = read<unknown>(K.dismissed, []);
  return Array.isArray(v) ? (v as string[]) : [];
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export class StorageFullError extends Error {}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      throw new StorageFullError('Spațiul din browser (localStorage) este plin. Șterge un fișier mai vechi și încearcă din nou.');
    }
    throw e;
  }
}

export const store = {
  loadFiles: () => read<StoredFile[]>(K.files, []),
  saveFiles: (files: StoredFile[]) => write(K.files, files),
  loadOverrides: () => read<Record<string, string>>(K.overrides, {}),
  saveOverrides: (o: Record<string, string>) => write(K.overrides, o),
  loadExcluded: () => read<string[] | null>(K.excluded, null),
  saveExcluded: (e: string[]) => write(K.excluded, e),
  loadPrefs: () => read<Record<string, unknown>>(K.prefs, {}),
  savePrefs: (p: Record<string, unknown>) => write(K.prefs, p),
  usageBytes: () => {
    let n = 0;
    try {
      for (const k of Object.values(K)) n += (localStorage.getItem(k)?.length ?? 0) * 2;
    } catch {
      /* ignore */
    }
    return n;
  },
  clearAll: () => {
    try {
      Object.values(K).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  },
};

/** Merge all files' transactions, dropping duplicates from overlapping statements. */
export function mergeFiles(files: StoredFile[]): Tx[] {
  const seen = new Map<string, Tx>();
  // Within a file, identical ids are genuinely distinct only if balance differs — already in id.
  files.forEach((f, fi) => {
    for (const t of f.txs) {
      if (seen.has(t.id)) continue;
      // Re-derive presentation fields so parser improvements apply to previously stored files.
      let lastKv = -1;
      t.details.forEach((l, i) => { if (l.indexOf(':') > 0) lastKv = i; });
      const details = lastKv >= 0 ? t.details.slice(0, lastKv + 1) : t.details;
      seen.set(t.id, { ...t, details, merchant: normalizeMerchant(t.counterparty, t.type, details), seq: fi * 1e6 + t.seq });
    }
  });
  return [...seen.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq));
}

export function makeStoredFile(name: string, txs: Tx[], currency: string, iban?: string): StoredFile {
  const dates = txs.map((t) => t.bookDate).sort();
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    name,
    uploadedAt: new Date().toISOString(),
    currency,
    iban,
    from: dates[0] ?? '',
    to: dates[dates.length - 1] ?? '',
    count: txs.length,
    totalIn: txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    totalOut: txs.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0),
    txs,
  };
}

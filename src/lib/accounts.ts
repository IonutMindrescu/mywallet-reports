import { merchantKey } from './merchants';
import { stripDiacritics } from './parser';
import type { Tx } from './types';

const n = (s: string) => stripDiacritics(s).toLowerCase();

/** IBAN / account number mentioned in a transaction's details ("In contul:", "Din contul:", "IBAN:" …). */
export function accountOf(details: string[]): string | undefined {
  for (const d of details) {
    const m = n(d).match(/^(in contul|din contul|cont credit|contul|iban credit|iban|cont beneficiar|cont ordonator|cont platitor)\s*:\s*(.+)$/);
    if (m) {
      const acct = m[2].replace(/\s/g, '').toUpperCase();
      if (acct.length >= 8) return acct;
    }
  }
  return undefined;
}

const TRANSFER_TYPE = /transfer|plata op|ordin de plata|home'?bank|p2p|instant|incasare|plata intra|plata inter/;
const LOAN_TYPE = /rata credit|credit|asigurare|plata anticipata|rnpm/;

export const isTransferType = (type: string) => TRANSFER_TYPE.test(n(type)) && !/fonduri/.test(n(type));

/**
 * Detect the account holder's own accounts from the data alone.
 * The holder is the person who both sends to and receives from several different IBANs under the same name.
 * An IBAN is "own" only if every name ever seen on it is a variant of the holder's name (≥2 shared tokens),
 * so a relative's account that once received a transfer labelled with the holder's name is not swallowed.
 */
export function detectOwnAccounts(
  txs: Tx[],
  notOwn: Set<string> = new Set(),
): { accounts: Set<string>; names: Set<string>; loanAccounts: Set<string> } {
  const byName = new Map<string, { ibans: Set<string>; inN: number; outN: number }>();
  const ibanNames = new Map<string, Set<string>>();
  const loanAccounts = new Set<string>();

  for (const t of txs) {
    const acct = accountOf(t.details);
    if (!acct) continue;
    if (LOAN_TYPE.test(n(t.type))) {
      loanAccounts.add(acct);
      continue;
    }
    if (!isTransferType(t.type) || !t.counterparty) continue;
    const key = merchantKey(t.counterparty);
    if (!key) continue;
    let e = byName.get(key);
    if (!e) byName.set(key, (e = { ibans: new Set(), inN: 0, outN: 0 }));
    e.ibans.add(acct);
    if (t.amount > 0) e.inN++;
    else e.outN++;
    if (!ibanNames.has(acct)) ibanNames.set(acct, new Set());
    ibanNames.get(acct)!.add(key);
  }

  const self = [...byName.entries()]
    .filter(([k, e]) => e.inN > 0 && e.outN > 0 && e.ibans.size >= 2 && k.split(' ').length >= 2 && !notOwn.has(k))
    .sort((a, b) => b[1].ibans.size - a[1].ibans.size || b[1].inN + b[1].outN - (a[1].inN + a[1].outN))[0];
  if (!self) return { accounts: new Set(), names: new Set(), loanAccounts };

  const selfTokens = new Set(self[0].split(' '));
  const isSelfName = (k: string) => {
    const toks = k.split(' ');
    return toks.length >= 2 && toks.every((x) => selfTokens.has(x)) && !notOwn.has(k);
  };
  const accounts = new Set<string>();
  const names = new Set<string>();
  for (const [acct, ns] of ibanNames) {
    if (loanAccounts.has(acct)) continue;
    if ([...ns].every(isSelfName)) {
      accounts.add(acct);
      ns.forEach((k) => names.add(k));
    }
  }
  return { accounts, names, loanAccounts };
}

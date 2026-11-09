import { accountOf, detectOwnAccounts, isTransferType } from './accounts';
import { findBrand, merchantKey } from './merchants';
import { stripDiacritics } from './parser';
import type { CategoryDef, CTx, Tx } from './types';

export const CATEGORIES: CategoryDef[] = [
  // Expenses
  { id: 'groceries', name: 'Supermarket & alimente', color: '#22c55e', icon: 'ShoppingCart', kind: 'expense' },
  { id: 'restaurants', name: 'Restaurante & cafenele', color: '#f97316', icon: 'UtensilsCrossed', kind: 'expense' },
  { id: 'delivery', name: 'Livrări mâncare', color: '#fb923c', icon: 'Bike', kind: 'expense' },
  { id: 'transport', name: 'Transport', color: '#38bdf8', icon: 'Car', kind: 'expense' },
  { id: 'fuel', name: 'Combustibil', color: '#0ea5e9', icon: 'Fuel', kind: 'expense' },
  { id: 'auto', name: 'Mașină & service', color: '#60a5fa', icon: 'Wrench', kind: 'expense' },
  { id: 'online', name: 'Cumpărături online', color: '#a855f7', icon: 'Package', kind: 'expense' },
  { id: 'fashion', name: 'Haine & fashion', color: '#ec4899', icon: 'Shirt', kind: 'expense' },
  { id: 'rent', name: 'Chirie & locuință', color: '#f59e0b', icon: 'KeyRound', kind: 'expense' },
  { id: 'home', name: 'Casă & bricolaj', color: '#eab308', icon: 'House', kind: 'expense' },
  { id: 'electronics', name: 'Electronice', color: '#6366f1', icon: 'Laptop', kind: 'expense' },
  { id: 'health', name: 'Sănătate & farmacie', color: '#ef4444', icon: 'HeartPulse', kind: 'expense' },
  { id: 'beauty', name: 'Frumusețe & îngrijire', color: '#f472b6', icon: 'Sparkles', kind: 'expense' },
  { id: 'utilities', name: 'Utilități', color: '#facc15', icon: 'Zap', kind: 'expense' },
  { id: 'telecom', name: 'Telefonie & internet', color: '#14b8a6', icon: 'Wifi', kind: 'expense' },
  { id: 'subscriptions', name: 'Abonamente & streaming', color: '#8b5cf6', icon: 'Repeat', kind: 'expense' },
  { id: 'entertainment', name: 'Divertisment', color: '#d946ef', icon: 'Ticket', kind: 'expense' },
  { id: 'travel', name: 'Călătorii & cazare', color: '#06b6d4', icon: 'Plane', kind: 'expense' },
  { id: 'education', name: 'Educație & cărți', color: '#84cc16', icon: 'GraduationCap', kind: 'expense' },
  { id: 'sport', name: 'Sport & fitness', color: '#10b981', icon: 'Dumbbell', kind: 'expense' },
  { id: 'kids', name: 'Copii', color: '#fda4af', icon: 'Baby', kind: 'expense' },
  { id: 'pets', name: 'Animale', color: '#a3e635', icon: 'PawPrint', kind: 'expense' },
  { id: 'cash', name: 'Retrageri numerar', color: '#94a3b8', icon: 'Banknote', kind: 'expense' },
  { id: 'fees', name: 'Comisioane bancare', color: '#64748b', icon: 'Landmark', kind: 'expense' },
  { id: 'taxes', name: 'Taxe & impozite', color: '#a8a29e', icon: 'FileText', kind: 'expense' },
  { id: 'insurance', name: 'Asigurări', color: '#2dd4bf', icon: 'Shield', kind: 'expense' },
  { id: 'loans', name: 'Credite & rate', color: '#dc2626', icon: 'CreditCard', kind: 'expense' },
  { id: 'tobacco', name: 'Tutun & chioșcuri', color: '#b45309', icon: 'Cigarette', kind: 'expense' },
  { id: 'gifts', name: 'Cadouri & donații', color: '#fb7185', icon: 'Gift', kind: 'expense' },
  { id: 'transfer-out', name: 'Transferuri către alții', color: '#c084fc', icon: 'Send', kind: 'expense' },
  { id: 'other', name: 'Altele', color: '#9ca3af', icon: 'CircleHelp', kind: 'expense' },
  // Transfers (excluded from income/expense by default)
  { id: 'own-transfer', name: 'Transferuri proprii', color: '#475569', icon: 'ArrowLeftRight', kind: 'transfer' },
  { id: 'wallets', name: 'Revolut & portofele', color: '#7c3aed', icon: 'Wallet', kind: 'transfer' },
  { id: 'credit-flows', name: 'Trageri & refinanțări credit', color: '#334155', icon: 'Landmark', kind: 'transfer' },
  // Income
  { id: 'salary', name: 'Salariu', color: '#34d399', icon: 'Briefcase', kind: 'income' },
  { id: 'transfer-in', name: 'Transferuri primite', color: '#22d3ee', icon: 'ArrowDownLeft', kind: 'income' },
  { id: 'sales', name: 'Vânzări (OLX, ramburs)', color: '#4ade80', icon: 'HandCoins', kind: 'income' },
  { id: 'refund', name: 'Rambursări & retururi', color: '#a7f3d0', icon: 'Undo2', kind: 'income' },
  { id: 'interest', name: 'Dobânzi', color: '#6ee7b7', icon: 'PiggyBank', kind: 'income' },
  { id: 'other-income', name: 'Alte venituri', color: '#5eead4', icon: 'Coins', kind: 'income' },
];

export const CAT: Record<string, CategoryDef> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const DEFAULT_EXCLUDED = ['own-transfer', 'wallets', 'credit-flows'];

const norm = (s: string) => stripDiacritics(s).toLowerCase();

/** Lenders paid by card (BNPL / IFN) — card payments are installments, bank transfers to them are payoffs. */
export const LENDERS = /twisto|heyblu|\btbi\b|mokka|paypo|klarna|leanpay|credius|provident|ferratum|viva credit|cetelem|axi card|ifn\b/;
/** Online payment gateways prefixing card descriptors (NTP*, MPY*, EP*, PayU* …). */
const GATEWAY = /^(ntp|mpy|ep|payu|mobilpay|netopia|euplatesc|plationline|paylike|stripe|paddle|fs|2co|sumup)\s*\*/;

export interface CatContext {
  /** Accounts detected (or confirmed) as the holder's own. */
  own?: Set<string>;
  /** Loan / credit-card accounts seen on installment rows. */
  loanAccounts?: Set<string>;
}

/** Automatic categorization (before user overrides). */
export function autoCategory(tx: Tx, ctx: CatContext = {}): string {
  const type = norm(tx.type);
  const cp = norm(tx.counterparty);
  const all = norm([tx.type, tx.counterparty, ...tx.details].join(' '));
  const head = `${type} ${cp}`;
  const out = tx.amount < 0;
  const isTransfer = /transfer|plata op|ordin de plata|home'?bank|p2p|instant|incasare/.test(type) && !/fonduri|via card/.test(type);
  // Free-text details are only trusted for transfers (where the user typed them); card details hold bank metadata.
  const text = isTransfer ? all : head;
  const details = norm(tx.details.join(' '));

  // Strong type-based rules
  if (/alocare fonduri credit|recalculari aferente credit|tragere credit|acordare credit|refinantare|lichidare anticipata/.test(type)) return 'credit-flows';
  if (/round ?up|rotunjire/.test(type)) return 'own-transfer';
  if (/prima asigurare|asigurare/.test(type) && out) return 'insurance';
  if (/corectie|stornare|anulare tranzactie|retur/.test(type) && !out) return 'refund';
  if (/transfer intre conturi|conturi proprii|transfer propriu|cont propriu|constituire depozit|lichidare depozit|economisire|\bdepozit\b/.test(text))
    return 'own-transfer';
  // Transfers to/from one of the holder's own accounts (detected from the data).
  if (isTransfer) {
    const acct = accountOf(tx.details);
    // Extra payments into a loan / credit-card account are debt service, not transfers.
    if (acct && out && ctx.loanAccounts?.has(acct)) return 'loans';
    if (acct && ctx.own?.has(acct)) return 'own-transfer';
  }
  if (/retragere|numerar|\batm\b|cash/.test(type)) return out ? 'cash' : 'other-income';
  if (/dobanda/.test(type)) return out ? 'loans' : 'interest';
  if (/comision|^taxa\b|abonament (bt|pachet|cont)|cost pachet/.test(type))
    return out ? 'fees' : 'refund';
  if (/rata credit|rambursare (rata|credit)|plata rata|\brata\b|leasing|card de credit|card credit/.test(text) && out) return 'loans';
  // Bank transfer to a consumer lender = payoff / refinancing (card payments to it are the installments).
  if (out && isTransfer && LENDERS.test(cp)) return 'credit-flows';
  // Card-funded transfers (top-ups of Revolut, Salt, other e-wallets / own accounts at other banks).
  if (/transfer fonduri|alimentare cont|top.?up/.test(type) && out) return 'wallets';

  if (!out) {
    if (/via card/.test(type)) return 'refund';
    if (/avans cheltuieli|decont|rambursare cheltuieli|cheltuieli deplasare/.test(all)) return 'refund';
    if (/salar|indemniz|bonus|prima |prima$|stimulent|drepturi salariale|pensie|diurna/.test(all)) return 'salary';
    if (/\bolx\b|delivery solutions|\bramburs\b|contravaloare colet|cash on delivery|vinted|okazii|marketplace payout/.test(all)) return 'sales';
    if (/refund|retur|storno|stornare|anulare|rambursare|chargeback|cashback|nedatorat/.test(all)) return 'refund';
    if (/revolut|salt bank/.test(all)) return 'wallets';
    return 'transfer-in';
  }

  // Merchant/brand rules (counterparty first, then whole text)
  const brand = findBrand(tx.counterparty) ?? findBrand([tx.type, ...tx.details].join(' '));
  if (brand) return brand[1];

  if (/ghiseul|anaf|trezorer/.test(all)) return 'taxes';
  if (isTransfer) {
    // Free text typed by the user on a transfer.
    if (/chirie|\brent\b|intretinere/.test(details)) return 'rent';
    if (/cadou|la multi ani|nunta|botez|aniversar|donati/.test(details)) return 'gifts';
    if (/cazare|vacanta|concediu|bilet avion/.test(details)) return 'travel';
    if (/factura|utilitat/.test(details)) return 'utilities';
    return 'transfer-out';
  }
  // Card payment through an online gateway or to a web domain → online shopping
  if (GATEWAY.test(cp) || /[a-z0-9-]+\.(ro|com|eu|net|org|shop|store|io|de|co\.uk)\b/.test(cp)) return 'online';
  if (/plata op|ordin de plata|p2p|bt pay|instant|plata intra|plata inter|catre/.test(type)) return 'transfer-out';
  return 'other';
}

export function categorize(txs: Tx[], overrides: Record<string, string>, notOwn: string[] = []): CTx[] {
  const { accounts, loanAccounts } = detectOwnAccounts(txs, new Set(notOwn));
  const ctx: CatContext = { own: accounts, loanAccounts };
  return txs.map((t) => {
    let merchant = t.merchant;
    // A transfer into a loan / credit-card account is named after the account, not after the holder.
    if (t.amount < 0 && isTransferType(t.type)) {
      const a = accountOf(t.details);
      if (a && loanAccounts.has(a)) merchant = `Plată credit …${a.slice(-4)}`;
    }
    const mkey = merchantKey(merchant);
    const ov = overrides['tx:' + t.id] ?? overrides[mkey];
    return { ...t, merchant, mkey, cat: ov && CAT[ov] ? ov : autoCategory(t, ctx) };
  });
}

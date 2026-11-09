export interface Tx {
  /** Dedupe key: same transaction from overlapping statements yields the same id. */
  id: string;
  /** ISO yyyy-mm-dd — when the money was actually spent (authorization date if present). */
  date: string;
  /** ISO yyyy-mm-dd — booking date from the statement (used for balance). */
  bookDate: string;
  /** Statement transaction type, e.g. "Cumparare POS". */
  type: string;
  /** Signed amount: negative = debit (money out), positive = credit (money in). */
  amount: number;
  balance: number | null;
  /** Raw counterparty text ("Tranzactie la", "Beneficiar", ...). */
  counterparty: string;
  /** Normalized merchant / counterparty display name. */
  merchant: string;
  details: string[];
  card?: string;
  auth?: string;
  currency: string;
  /** Position inside source file — keeps intra-day order stable for balance. */
  seq: number;
}

export interface StoredFile {
  id: string;
  name: string;
  uploadedAt: string;
  currency: string;
  iban?: string;
  from: string;
  to: string;
  count: number;
  totalIn: number;
  totalOut: number;
  txs: Tx[];
}

export type CategoryKind = 'expense' | 'income' | 'transfer';

export interface CategoryDef {
  id: string;
  name: string;
  color: string;
  icon: string;
  kind: CategoryKind;
}

/** A transaction enriched with its resolved category. */
export interface CTx extends Tx {
  cat: string;
  /** Normalized merchant key (used for overrides). */
  mkey: string;
}

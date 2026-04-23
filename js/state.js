// ─────────────── STATE ───────────────
const state = {
  savings: [],        // { id, type, name, monthlyAmt, totalPrincipal, currentAmt, maturityDate }
  portfolios: [],     // { id, accountName, type, stocks: [{id, name, qty, avgPrice, curPrice, dividend, monthlyBuy}] }
  maturity: [],       // { id, name, type, principal, rate, startDate, endDate }
};

// Account types
const ACCOUNT_TYPES = ['ISA','CMA','과세연금저축','비과세연금저축','IRP','적금','기타'];
const TYPE_CLASS = {
  'ISA':'tag-isa','CMA':'tag-cma',
  '과세연금저축':'tag-pension','비과세연금저축':'tag-pension',
  'IRP':'tag-irp','적금':'tag-savings','기타':''
};

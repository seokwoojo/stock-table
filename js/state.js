// ─────────────── STATE ───────────────
const state = {
  savings: [],
  portfolios: [],  // stocks: [{id, code, name, baseQty, baseAvgPrice, curPrice, ...}]
  maturity: [],
  gasUrl: '',      // Google Apps Script 배포 URL
};

// Account types
const ACCOUNT_TYPES = ['ISA','CMA','과세연금저축','비과세연금저축','IRP','적금','기타'];
const TYPE_CLASS = {
  'ISA':'tag-isa','CMA':'tag-cma',
  '과세연금저축':'tag-pension','비과세연금저축':'tag-pension',
  'IRP':'tag-irp','적금':'tag-savings','기타':''
};

// ─────────────── STATE ───────────────
const state = {
  savings: [],
  portfolios: [],
  maturity: [],
  gasUrl: 'https://script.google.com/macros/s/AKfycbyAOd0dOOl_NFaxVeX3NLdc5V0PSTo7p2LYxAJbHBfAZ2g21vCzvyYQkhYCg6fKrMg/exec',
  memo: '',
  deletedFixedTypes: [],
  exchangeRate: 1350, // USD→KRW 기본값, 시세갱신 시 업데이트
};

// 계좌 타입
const ACCOUNT_TYPES = ['ISA','CMA','과세 연금저축','비과세 연금저축','IRP','적금','기타'];
const TYPE_CLASS = {
  'ISA':'tag-isa','CMA':'tag-cma',
  '과세 연금저축':'tag-pension','비과세 연금저축':'tag-pension',
  'IRP':'tag-irp','적금':'tag-savings','기타':''
};

// 증권사 목록
const BROKERS = [
  '증권사 선택',
  'NH투자증권','한국투자증권','미래에셋증권','삼성증권','키움증권',
  'KB증권','신한투자증권','하나증권','대신증권','메리츠증권',
  'IBK투자증권','유안타증권','NH나무증권','카카오페이증권','토스증권','기타'
];
-e 
// firebase.js(module)에서 접근 가능하도록 노출
window.state = state;
window.idCnt = 1;

// ─────────────── RECALC ───────────────
function recalcAll(){
  const salary = Number(document.getElementById('salary').value) || 0;

  // Monthly savings total
  const monthSave = state.savings.reduce((a,s)=>a+s.monthlyAmt,0);

  // 계좌별 현재 금액 / 원금 계산 (적금은 만기 데이터 기반)
  function getSavingValues(s){
    if(s.type === '적금'){
      const m = state.maturity.find(x=>x.id===s.id);
      if(m && m.startDate && s.monthlyAmt > 0){
        const start = new Date(m.startDate);
        const now   = new Date();
        const elapsed = Math.max(0,
          (now.getFullYear()-start.getFullYear())*12 + (now.getMonth()-start.getMonth())
        );
        const payCount = elapsed + 1;
        const principal = payCount * s.monthlyAmt;
        const interest  = s.monthlyAmt * (payCount*(payCount+1)/2) * ((m.rate||0)/100/12);
        return { principal, current: Math.round(principal + interest) };
      }
      return { principal: 0, current: 0 };
    }
    const PORTFOLIO_TYPES = ['ISA','CMA','과세 연금저축','비과세 연금저축','IRP'];
    if(PORTFOLIO_TYPES.includes(s.type)){
      const portPrincipal = state.portfolios.filter(p=>p.type===s.type).reduce((a,p)=>a+p.stocks.reduce((b,st)=>b+st.qty*st.avgPrice,0),0);
      const portVal       = state.portfolios.filter(p=>p.type===s.type).reduce((a,p)=>a+p.stocks.reduce((b,st)=>b+st.qty*st.curPrice,0),0);
      const portDiv       = state.portfolios.filter(p=>p.type===s.type).reduce((a,p)=>a+p.stocks.reduce((b,st)=>b+(st.accumulatedDividend||0),0),0);
      return { principal: portPrincipal, current: portVal + portDiv };
    }
    return { principal: s.totalPrincipal||0, current: s.currentAmt||0 };
  }

  const totalAsset    = state.savings.reduce((a,s)=>a+getSavingValues(s).current,0);
  const totalPrincipal= state.savings.reduce((a,s)=>a+getSavingValues(s).principal,0);

  // Portfolio stats
  const totCost  = state.portfolios.reduce((a,p)=>a+p.stocks.reduce((b,s)=>b+s.qty*s.avgPrice,0),0);
  const totVal   = state.portfolios.reduce((a,p)=>a+p.stocks.reduce((b,s)=>b+s.qty*s.curPrice,0),0);
  const totPnl   = totVal - totCost;   // 주가 수익
  const totAccDiv= state.portfolios.reduce((a,p)=>a+p.stocks.reduce((b,s)=>b+(s.accumulatedDividend||0),0),0);
  const totTotal = totPnl + totAccDiv; // 총 수익 (주가 + 배당)
  const priceRate = totCost ? (totPnl/totCost*100).toFixed(2)   : 0;
  const totalRate = totCost ? (totTotal/totCost*100).toFixed(2) : 0;

  // Header cards
  document.getElementById('s-salary').textContent = salary ? fmtKRW(salary) : '—';

  const msEl = document.getElementById('s-monthSave');
  msEl.textContent = fmtKRW(monthSave);
  const saveRate = salary ? Math.min((monthSave/salary*100),100) : 0;
  const saveRatePct = salary ? (monthSave/salary*100).toFixed(1) : 0;
  document.getElementById('s-saveProg').style.width = saveRate + '%';
  document.getElementById('s-saveRate').textContent = `저축률 ${saveRatePct}%`;

  document.getElementById('s-asset').textContent = totalAsset ? fmtKRW(totalAsset) : '—';
  if(totalPrincipal > 0 && totalAsset > 0){
    const assetPnl = totalAsset - totalPrincipal;
    const assetRate = (assetPnl/totalPrincipal*100).toFixed(2);
    document.getElementById('s-assetSub').textContent =
      `원금 ${fmtKRW(totalPrincipal)} / ${assetPnl>=0?'+':''}${assetRate}%`;
  } else {
    document.getElementById('s-assetSub').textContent = '';
  }

  const profEl = document.getElementById('s-profit');
  profEl.textContent = totTotal ? (totTotal>0?'+':'')+fmtKRW(totTotal) : '—';
  profEl.className = 'card-value ' + (totTotal>0?'pos':totTotal<0?'neg':'');
  document.getElementById('s-profitRate').textContent =
    `총 ${totTotal>0?'+':''}${totalRate}%  |  주가 ${totPnl>0?'+':''}${priceRate}%`;

  // Total bar
  document.getElementById('tb-monthTotal').textContent = fmtKRW(monthSave);
  document.getElementById('tb-yearTotal').textContent = fmtKRW(monthSave*12);
  document.getElementById('tb-saveRate').textContent = salary ? saveRatePct+'%' : '—';
}

// ─────────────── LOCAL STORAGE ───────────────
const LS_KEY = 'investment_dashboard_v2';

function syncGasUrl(){
  const el = document.getElementById('gas-url-input');
  if(el && el.value.trim()) state.gasUrl = el.value.trim();
}

function saveToStorage(){
  syncGasUrl();
  const data = {
    salary:    document.getElementById('salary').value,
    baseMonth: document.getElementById('baseMonth').value,
    savings:   state.savings,
    portfolios:state.portfolios,
    maturity:  state.maturity,
    gasUrl:    state.gasUrl,
    idCnt,
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch(e){}
  showToast('💾 저장됨');
}

function loadFromStorage(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(data.salary)     document.getElementById('salary').value     = data.salary;
    if(data.baseMonth)  document.getElementById('baseMonth').value  = data.baseMonth;
    if(data.savings)    state.savings    = data.savings;
    if(data.portfolios) state.portfolios = data.portfolios;
    if(data.maturity)   state.maturity   = data.maturity;
    if(data.gasUrl)     state.gasUrl     = data.gasUrl;
    if(data.idCnt)      idCnt = data.idCnt;
    return true;
  } catch(e){ return false; }
}

// Auto-save on any state mutation — debounced
let saveTimer = null;
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToStorage, 800);
}

// Patch remaining mutating functions to auto-save
// (updateSavings/removeSavings/updateMaturity/removeMaturity/addMaturityRow call scheduleSave directly)
['updateStock','removeStock','removePortfolio',
 'updatePortfolioName','updatePortfolioType','addPortfolioAccount',
 'addStock'].forEach(fn => {
  const orig = window[fn];
  if(orig) window[fn] = function(){ orig.apply(this, arguments); scheduleSave(); };
});
// Also save on basic input changes
['salary','baseMonth'].forEach(id => {
  document.getElementById(id).addEventListener('input', scheduleSave);
});

// ─────────────── EXPORT / IMPORT ───────────────
function exportJSON(){
  syncGasUrl();
  const data = {
    exportedAt: new Date().toISOString(),
    salary:    document.getElementById('salary').value,
    baseMonth: document.getElementById('baseMonth').value,
    savings:   state.savings,
    portfolios:state.portfolios,
    maturity:  state.maturity,
    gasUrl:    state.gasUrl,
    idCnt,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0,10);
  a.download = `투자대시보드_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 파일로 내보내기 완료');
}

function importJSON(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if(data.salary)     document.getElementById('salary').value     = data.salary;
        if(data.baseMonth)  document.getElementById('baseMonth').value  = data.baseMonth;
        if(data.savings)    state.savings    = data.savings;
        if(data.portfolios) state.portfolios = data.portfolios;
        if(data.maturity)   state.maturity   = data.maturity;
        if(data.idCnt)      idCnt = data.idCnt;
        renderAll();
        saveToStorage();
        showToast('✅ 불러오기 완료!');
      } catch(err){
        showToast('❌ 파일 형식이 올바르지 않습니다');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function clearAll(){
  if(!confirm('모든 데이터를 초기화할까요? 이 작업은 되돌릴 수 없습니다.')) return;
  localStorage.removeItem(LS_KEY);
  state.savings = []; state.portfolios = []; state.maturity = [];
  ['salary','baseMonth'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('baseMonth').value = new Date().toISOString().slice(0,7);
  renderAll();
  showToast('🗑️ 초기화 완료');
}

function renderAll(){
  renderSavings();
  renderPortfolios();
  renderMaturity();
  recalcAll();
}

// ─────────────── TOAST ───────────────
function showToast(msg){
  let t = document.getElementById('toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = `
      position:fixed; bottom:28px; right:28px; z-index:9999;
      background:#1a2e1c; border:1px solid rgba(0,230,118,0.3);
      color:#e8f5e9; font-family:'IBM Plex Mono',monospace; font-size:12px;
      padding:10px 18px; border-radius:4px; opacity:0;
      transition:opacity .25s; pointer-events:none;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.opacity = '0', 2200);
}

// ─────────────── TAB 키 행 내 이동 ───────────────
document.addEventListener('keydown', function(e){
  if(e.key !== 'Tab') return;
  const row = e.target.closest('tr.stock-row, tr.mat-row');
  if(!row) return;
  const focusable = Array.from(row.querySelectorAll('input, select')).filter(el => !el.disabled);
  const idx = focusable.indexOf(e.target);
  if(idx === -1) return;
  e.preventDefault();
  const next = e.shiftKey ? focusable[idx-1] : focusable[idx+1];
  if(next) next.focus();
});

// ─────────────── INIT ───────────────
document.getElementById('baseMonth').value = new Date().toISOString().slice(0,7);

const loaded = loadFromStorage();

if(!loaded){
  // First-time defaults
  const defaults = [
    {type:'ISA',name:'ISA 계좌',monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
    {type:'CMA',name:'CMA 통장',monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
    {type:'과세 연금저축',name:'과세 연금저축',monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
    {type:'비과세 연금저축',name:'비과세 연금저축',monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
    {type:'IRP',name:'IRP 계좌',monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
    {type:'적금',name:'적금',monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
  ];
  defaults.forEach(d => { state.savings.push({id:uid(),...d}); });
}

renderAll();

// GAS URL input에 저장된 값 반영
const gasEl = document.getElementById('gas-url-input');
if(gasEl && state.gasUrl) gasEl.value = state.gasUrl;

// 대시보드 시작 시 시세 1회 자동 갱신 (GAS URL 있을 때만)
if(state.gasUrl) {
  setTimeout(() => refreshAllPrices(), 1500);
}

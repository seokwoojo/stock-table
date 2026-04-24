// ─────────────── RECALC ───────────────
function recalcAll(){
  const salEl = document.getElementById('salary');
  const salary = salEl ? (Number(salEl.value) || 0) : 0;

  // Monthly savings total
  const monthSave = state.savings.reduce((a,s)=>a+s.monthlyAmt,0);

  // 계좌별 현재 금액 / 원금 계산 — id로 포트폴리오 매칭 (타입 이름 변경에도 대응)
  const FIXED_PORT_TYPES = ['ISA','CMA','과세 연금저축','비과세 연금저축','IRP'];
  const normalizeType = t => t ? t.replace(/\s+/g,'') : '';
  function getSavingValues(s){
    const linkedPortfolio = state.portfolios.find(p => p.id === s.id)
      || state.portfolios.find(p => p.fixed && normalizeType(p.type) === normalizeType(s.type));
    if(linkedPortfolio){
      const p = linkedPortfolio;
      const principal = p.stocks.reduce((a,st)=>{
        const pos = calcPosition(st);
        const qty      = pos.qty      || st.baseQty      || 0;
        const avgPrice = pos.avgPrice || st.baseAvgPrice || 0;
        return a + qty * avgPrice;
      }, 0);
      const val  = p.stocks.reduce((a,st)=>{
        const pos = calcPosition(st);
        const qty = pos.qty || st.baseQty || 0;
        return a + qty * st.curPrice;
      }, 0);
      const real = p.stocks.reduce((a,st)=>{ const pos=calcPosition(st); return a+pos.realizedPnl; },0);
      const div  = p.stocks.reduce((a,st)=>a+(st.accumulatedDividend||0),0);
      return { principal, current: val + real + div };
    }
    // 적금: 만기 데이터 기반
    const m = state.maturity.find(x=>x.id===s.id);
    if(m && m.startDate && s.monthlyAmt > 0){
      const start = new Date(m.startDate);
      const now   = new Date();
      const elapsed  = Math.max(0,(now.getFullYear()-start.getFullYear())*12+(now.getMonth()-start.getMonth()));
      const payCount = elapsed + 1;
      const principal = payCount * s.monthlyAmt;
      const interest  = s.monthlyAmt*(payCount*(payCount+1)/2)*((m.rate||0)/100/12);
      return { principal, current: Math.round(principal + interest) };
    }
    return { principal: s.totalPrincipal||0, current: s.currentAmt||0 };
  }

  const totalAsset    = state.savings.reduce((a,s)=>a+getSavingValues(s).current,0);
  const totalPrincipal= state.savings.reduce((a,s)=>a+getSavingValues(s).principal,0);

  // Portfolio stats (calcPosition 기반)
  const totCost  = state.portfolios.reduce((a,p)=>a+p.stocks.reduce((b,st)=>{ const pos=calcPosition(st); const q=pos.qty||st.baseQty||0; const ap=pos.avgPrice||st.baseAvgPrice||0; return b+q*ap; },0),0);
  const totVal   = state.portfolios.reduce((a,p)=>a+p.stocks.reduce((b,st)=>{ const pos=calcPosition(st); const q=pos.qty||st.baseQty||0; return b+q*st.curPrice; },0),0);
  const totPnl   = totVal - totCost;
  const totAccDiv= state.portfolios.reduce((a,p)=>a+p.stocks.reduce((b,s)=>b+(s.accumulatedDividend||0),0),0);
  const totTotal = totPnl + totAccDiv;
  const priceRate = totCost ? (totPnl/totCost*100).toFixed(2)   : 0;
  const totalRate = totCost ? (totTotal/totCost*100).toFixed(2) : 0;

  // DOM이 숨겨진 상태(로그인 전)면 업데이트 스킵
  if(!document.getElementById('s-monthSave')) return;

  const msEl = document.getElementById('s-monthSave');
  if(msEl) msEl.textContent = fmtKRW(monthSave);
  const saveRate = salary ? Math.min((monthSave/salary*100),100) : 0;
  const saveRatePct = salary ? (monthSave/salary*100).toFixed(1) : 0;
  const spEl = document.getElementById('s-saveProg'); if(spEl) spEl.style.width = saveRate + '%';
  const srEl = document.getElementById('s-saveRate'); if(srEl) srEl.textContent = salary ? `저축률 ${saveRatePct}%` : '';

  const saEl = document.getElementById('s-asset'); if(saEl) saEl.textContent = totalAsset ? fmtKRW(totalAsset) : '—';
  const subEl = document.getElementById('s-assetSub');
  if(subEl){
    if(totalPrincipal > 0 && totalAsset > 0){
      const assetPnl = totalAsset - totalPrincipal;
      const assetRate = (assetPnl/totalPrincipal*100).toFixed(2);
      subEl.textContent = `원금 ${fmtKRW(totalPrincipal)} / ${assetPnl>=0?'+':''}${assetRate}%`;
    } else {
      subEl.textContent = '';
    }
  }

  const tbm = document.getElementById('tb-monthTotal'); if(tbm) tbm.textContent = fmtKRW(monthSave);
  const tby = document.getElementById('tb-yearTotal');  if(tby) tby.textContent = fmtKRW(monthSave*12);
  const tbs = document.getElementById('tb-saveRate');   if(tbs) tbs.textContent = salary ? saveRatePct+'%' : '—';
}

// ─────────────── LOCAL STORAGE ───────────────
const LS_KEY = 'investment_dashboard_v3';

function saveToStorage(){
  const data = {
    salary:    document.getElementById('salary')?.value || '',
    savings:   state.savings,
    portfolios:state.portfolios,
    maturity:  state.maturity,
    gasUrl:    state.gasUrl,
    memo:      state.memo || '',
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
    if(data.salary){ const el=document.getElementById('salary'); if(el) el.value=data.salary; }
    if(data.savings)    state.savings    = data.savings;
    if(data.portfolios) state.portfolios = data.portfolios;
    if(data.maturity)   state.maturity   = data.maturity;
    if(data.gasUrl)     state.gasUrl     = data.gasUrl;
    if(data.memo)       state.memo       = data.memo;
    if(data.idCnt)      idCnt = data.idCnt;

    // 구버전 타입명 마이그레이션
    const typeMap = { '과세연금저축':'과세 연금저축', '비과세연금저축':'비과세 연금저축' };
    state.savings.forEach(s => { if(typeMap[s.type]) s.type = typeMap[s.type]; });
    state.portfolios.forEach(p => { if(typeMap[p.type]) p.type = typeMap[p.type]; });

    return true;
  } catch(e){ return false; }
}

// Auto-save — Firebase 우선, 로컬 백업 병행
let saveTimer = null;
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if(typeof scheduleFirebaseSave === 'function') scheduleFirebaseSave();
    else saveToStorage();
  }, 800);
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
['salary'].forEach(id => {
  const el = document.getElementById(id);
  if(el) el.addEventListener('input', scheduleSave);
});

// ─────────────── EXPORT / IMPORT ───────────────
function exportJSON(){
  const data = {
    exportedAt: new Date().toISOString(),
    salary:    document.getElementById('salary')?.value || '',
    savings:   state.savings,
    portfolios:state.portfolios,
    maturity:  state.maturity,
    gasUrl:    state.gasUrl,
    memo:      state.memo || '',
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
  renderAll();
  showToast('🗑️ 초기화 완료');
}

function saveMemo(val){
  state.memo = val;
  scheduleSave();
}

function loadMemo(){
  const el = document.getElementById('memo-area');
  if(el && state.memo) el.value = state.memo;
}

function renderAll(){
  renderSavings();
  renderPortfolios();
  renderMaturity();
  recalcAll();
  loadMemo();
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

// 기본 저축 계좌 초기값 설정 함수 (Firebase 첫 로그인 시 사용)
function initDefaultSavings(){
  if(state.savings.length) return;
  const defaults = [
    {type:'ISA',           name:'ISA 계좌',          monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
    {type:'CMA',           name:'CMA 통장',           monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
    {type:'과세 연금저축',  name:'과세 연금저축',      monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
    {type:'비과세 연금저축',name:'비과세 연금저축',    monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
    {type:'IRP',           name:'IRP 계좌',           monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
    {type:'적금',          name:'적금',               monthlyAmt:0,totalPrincipal:0,currentAmt:0,maturityDate:''},
  ];
  defaults.forEach(d => state.savings.push({id:uid(),...d}));
}

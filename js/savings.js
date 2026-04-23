// ─────────────── CLOCK ───────────────
function updateClock(){
  const now = new Date();
  document.getElementById('today-date').textContent =
    now.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
  document.getElementById('today-time').textContent =
    now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
}
setInterval(updateClock,1000);
updateClock();

// ─────────────── SAVINGS ───────────────
function addSavingsAccount(){
  const id = uid();
  state.savings.push({id, type:'적금', name:'새 계좌', monthlyAmt:0, totalPrincipal:0, currentAmt:0, maturityDate:''});
  renderSavings();
  recalcAll();
  setTimeout(() => {
    const el = document.querySelector(`#sc-${id} .savings-name-input`);
    if(el){ el.focus(); el.select(); }
  }, 50);
}

function renderSavings(){
  const grid = document.getElementById('savings-grid');
  if(!state.savings.length){
    grid.innerHTML = '<div style="color:var(--muted);font-size:12px;font-family:var(--mono);grid-column:1/-1;padding:8px 0">아직 저축 계좌가 없습니다</div>';
    return;
  }

  // 1. 포트폴리오 순서대로 주식 카드 정렬 (portfolios 배열 순서 기준)
  const stockCards  = state.portfolios
    .map(p => state.savings.find(s => s.id === p.id))
    .filter(Boolean);
  // 2. 예적금 카드 (포트폴리오에 없는 것)
  const portfolioIds = new Set(state.portfolios.map(p=>p.id));
  const savingCards  = state.savings.filter(s => !portfolioIds.has(s.id));
  const sorted = [...stockCards, ...savingCards];

  grid.innerHTML = sorted.map(s => {
    const linkedPortfolio = state.portfolios.find(p => p.id === s.id);
    const isStock = !!linkedPortfolio;

    // 주식: 초록, 예적금: 하늘색
    const cardAccent    = isStock ? 'var(--accent)'           : '#4fc3f7';
    const cardAccentDim = isStock ? 'var(--accent-dim)'       : 'rgba(79,195,247,0.08)';
    const cardBorder    = isStock ? 'rgba(0,230,118,0.15)'    : 'rgba(79,195,247,0.15)';
    const typeLabelClr  = isStock ? 'var(--accent)'           : '#4fc3f7';

    // 타입 라벨 & 계좌명
    const maturityEntry = !isStock ? state.maturity.find(x=>x.id===s.id) : null;
    const typeLabel  = isStock ? linkedPortfolio.type : (maturityEntry ? maturityEntry.type : s.type);
    const acctName   = isStock ? linkedPortfolio.accountName : (maturityEntry ? maturityEntry.name : s.name);
    const broker     = isStock ? (linkedPortfolio.broker || s.broker) : s.broker;

    // 수치 계산
    let principal = 0, current = 0;
    if(isStock){
      const p = linkedPortfolio;
      principal = p.stocks.reduce((a,st)=>{ const pos=calcPosition(st); return a+pos.qty*pos.avgPrice; },0);
      const val  = p.stocks.reduce((a,st)=>{ const pos=calcPosition(st); return a+pos.qty*st.curPrice; },0);
      const real = p.stocks.reduce((a,st)=>{ const pos=calcPosition(st); return a+pos.realizedPnl; },0);
      const div  = p.stocks.reduce((a,st)=>a+(st.accumulatedDividend||0),0);
      current = val + real + div;
    } else {
      const m = maturityEntry;
      if(m && m.startDate && s.monthlyAmt > 0){
        const start   = new Date(m.startDate);
        const now     = new Date();
        const elapsed = Math.max(0,(now.getFullYear()-start.getFullYear())*12+(now.getMonth()-start.getMonth()));
        const payCount = elapsed + 1;
        principal = payCount * s.monthlyAmt;
        const interest = s.monthlyAmt*(payCount*(payCount+1)/2)*((m.rate||0)/100/12);
        current = Math.round(principal + interest);
      } else {
        principal = s.totalPrincipal || 0;
        current   = s.currentAmt    || 0;
      }
    }

    const pnl  = current - principal;
    const rate = principal > 0 ? (pnl/principal*100).toFixed(2) : null;
    const isPos = pnl >= 0;

    return `
    <div class="savings-card" id="sc-${s.id}" style="border-color:${cardBorder};position:relative;">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${cardAccent};border-radius:3px 3px 0 0;opacity:0.7;"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;margin-top:4px;">
        <div style="flex:1;min-width:0;">
          <div class="savings-card-type" style="font-family:var(--mono);font-size:12px;font-weight:700;color:${typeLabelClr};margin-bottom:3px;">${typeLabel}</div>
          <select style="background:transparent;border:none;font-size:11px;color:var(--muted);padding:0;margin-bottom:5px;cursor:pointer;width:100%;" onchange="updateSavings(${s.id},'broker',this.value)">
            ${BROKERS.map(b=>`<option value="${b}" ${(broker||'증권사 선택')===b?'selected':''}>${b}</option>`).join('')}
          </select>
          <div class="savings-card-name" style="font-size:13px;font-weight:600;color:var(--text);padding:3px 0;">${acctName||'—'}</div>
        </div>
        <button class="btn btn-danger" style="margin-left:8px;flex-shrink:0;" onclick="removeSavings(${s.id})">✕</button>
      </div>
      <div class="type-badge" style="background:${cardAccentDim};color:${cardAccent};border-color:${cardBorder};">월 저축</div>
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:14px;">
        <span style="font-family:var(--mono);font-size:13px;color:var(--muted);">₩</span>
        ${mkNum(s.monthlyAmt, `updateSavings(${s.id},'monthlyAmt',v)`, `border:none;border-bottom:1px dashed ${cardAccent};font-size:20px;font-weight:600;padding:2px 0;width:100%;background:transparent;`, '0')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:${rate!==null&&current>0?'8':'14'}px;">
        <div>
          <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">총 투자 원금</div>
          <div style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--text2);">${principal ? fmtKRW(principal) : '—'}</div>
          <div style="font-size:9px;color:var(--muted);margin-top:2px;">${isStock ? '매입 원가 합산' : '현재 기준 총 납입금'}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">현재 금액</div>
          <div style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--text2);">${current ? fmtKRW(current) : '—'}</div>
          <div style="font-size:9px;color:var(--muted);margin-top:2px;">${isStock ? '평가금+실현+배당' : '납입금+현재까지 이자'}</div>
        </div>
      </div>
      ${(rate !== null && current > 0) ? `
      <div style="display:flex;align-items:center;justify-content:space-between;background:${isPos?'var(--red-dim)':'var(--cyan-dim)'};border-radius:2px;padding:5px 8px;margin-bottom:10px;">
        <span style="font-size:10px;color:var(--muted);letter-spacing:1px;">총 수익률</span>
        <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:${isPos?'var(--red)':'var(--cyan)'};">${isPos?'+':''}${rate}% (${isPos?'+':''}${fmtKRW(pnl)})</span>
      </div>` : ''}
    </div>`;
  }).join('');
}

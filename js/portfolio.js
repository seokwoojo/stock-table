// ─────────────── 거래 계산 ───────────────
function calcPosition(s){
  const trades = s.trades || [];
  let qty = s.baseQty || 0;
  let costBasis = qty * (s.baseAvgPrice || 0);
  let realizedPnl = 0;
  for(const t of trades){
    if(t.type === '매수'){
      qty += t.qty;
      costBasis += t.qty * t.price;
    } else {
      const avgCost = qty > 0 ? costBasis / qty : 0;
      realizedPnl += (t.price - avgCost) * t.qty;
      qty -= t.qty;
      costBasis -= avgCost * t.qty;
      if(qty < 0) qty = 0;
      if(costBasis < 0) costBasis = 0;
    }
  }
  const avgPrice = qty > 0 ? Math.round(costBasis / qty) : 0;
  return { qty, avgPrice, realizedPnl };
}

// ─────────────── PORTFOLIO ───────────────
const FIXED_PORTFOLIO_TYPES = ['ISA','CMA','과세연금저축','IRP'];

function ensureFixedPortfolios(){
  FIXED_PORTFOLIO_TYPES.forEach(type => {
    const exists = state.portfolios.find(p => p.fixed && p.type === type);
    if(!exists){
      state.portfolios.unshift({ id:uid(), accountName:type+' 포트폴리오', type, fixed:true, stocks:[] });
    }
  });
  state.portfolios.sort((a,b) => {
    const ai = FIXED_PORTFOLIO_TYPES.indexOf(a.fixed ? a.type : '__');
    const bi = FIXED_PORTFOLIO_TYPES.indexOf(b.fixed ? b.type : '__');
    if(ai===-1 && bi===-1) return 0;
    if(ai===-1) return 1;
    if(bi===-1) return -1;
    return ai - bi;
  });
}

function addStock(portfolioId){
  const p = state.portfolios.find(x=>x.id===portfolioId);
  if(!p) return;
  p.stocks.push({ id:uid(), name:'', baseQty:0, baseAvgPrice:0,
    curPrice:0, dividend:0, dividendCycle:'연', dividendDate:'',
    accumulatedDividend:0, monthlyBuy:0, trades:[] });
  renderPortfolios();
}

function removeStock(portfolioId, stockId){
  const p = state.portfolios.find(x=>x.id===portfolioId);
  if(!p) return;
  p.stocks = p.stocks.filter(x=>x.id!==stockId);
  renderPortfolios();
  renderSavings();
  recalcAll();
}

function addPortfolioAccount(){
  const id = uid();
  const type = 'ISA';
  const name = type + ' 포트폴리오';
  state.portfolios.push({id, accountName:name, type, fixed:false, stocks:[]});
  state.savings.push({id, type, name, monthlyAmt:0, totalPrincipal:0, currentAmt:0, maturityDate:''});
  renderAll();
  setTimeout(() => {
    const el = document.querySelector(`#ph-${id} .portfolio-name-input`);
    if(el){ el.focus(); el.select(); }
  }, 50);
  scheduleSave();
}

function removePortfolio(id){
  const p = state.portfolios.find(x=>x.id===id);
  if(p && p.fixed){ showToast('⚠️ 기본 계좌는 삭제할 수 없습니다'); return; }
  state.portfolios = state.portfolios.filter(x=>x.id!==id);
  state.savings = state.savings.filter(x=>x.id!==id);
  renderAll();
  scheduleSave();
}

function updateStock(pid, sid, field, value){
  const p = state.portfolios.find(x=>x.id===pid);
  if(!p) return;
  const s = p.stocks.find(x=>x.id===sid);
  if(!s) return;
  const numFields = ['qty','avgPrice','curPrice','dividend','monthlyBuy','baseQty','baseAvgPrice'];
  s[field] = numFields.includes(field) ? Number(value) : value;
  if(field === 'dividendCycle' || field === 'dividendDate'){
    renderPortfolios(); renderSavings(); recalcAll();
  } else if(numFields.includes(field)){
    updateStockCells(p, s);
    updatePortfolioHeader(p);
    renderSavings();
    recalcAll();
  }
  scheduleSave();
}

function updateStockCells(p, s){
  const pos      = calcPosition(s);
  const qty      = pos.qty;
  const avgPrice = pos.avgPrice;
  const realPnl  = pos.realizedPnl;
  const val      = qty * s.curPrice;
  const cost     = qty * avgPrice;
  const unreal   = val - cost;
  const accDiv   = s.accumulatedDividend || 0;
  const totalPnl = unreal + realPnl + accDiv;
  const pr   = cost ? (unreal/cost*100).toFixed(2)   : '0.00';
  const tr2  = cost ? (totalPnl/cost*100).toFixed(2) : '0.00';
  const isUnrealPos = Number(pr)  >= 0;
  const isTotPos    = Number(tr2) >= 0;
  const isRealPos   = realPnl >= 0;
  let periodDiv = s.dividend||0;
  const cycle = s.dividendCycle||'연';
  if(cycle==='월') periodDiv=(s.dividend||0)/12;
  else if(cycle==='분기') periodDiv=(s.dividend||0)/4;

  const row = document.querySelector(`tr.stock-row[data-sid="${s.id}"]`);
  if(!row) return;
  const cells = row.querySelectorAll('td');
  // 0종목명 1수량 2평단가 3현재가 4평가금액 5미실현 6수익률 7실현 8배당률 9배당주기 10배당일 11배당지급액 12누적배당 13총수익률 14월매수금 15버튼
  cells[1].textContent = qty.toLocaleString();
  cells[2].textContent = avgPrice ? '₩'+avgPrice.toLocaleString('ko-KR') : '—';
  cells[4].textContent = val ? '₩'+val.toLocaleString('ko-KR') : '—';
  cells[5].textContent = (unreal>=0?'+':'')+fmtKRW(Math.abs(unreal));
  cells[5].className   = `mono ${isUnrealPos?'pos':'neg'}`;
  cells[6].innerHTML   = `<span class="badge ${isUnrealPos?'badge-green':'badge-red'}">${isUnrealPos?'+':''}${pr}%</span>`;
  cells[7].textContent = realPnl!==0?(isRealPos?'+':'')+fmtKRW(Math.round(realPnl)):'—';
  cells[7].className   = `mono ${isRealPos?'pos':'neg'}`;
  cells[13].innerHTML  = `<span class="badge ${isTotPos?'badge-green':'badge-red'}">${isTotPos?'+':''}${tr2}%</span>`;
}

function updatePortfolioHeader(p){
  const panel = document.getElementById(`ph-${p.id}`);
  if(!panel) return;
  const totCost   = p.stocks.reduce((a,s)=>{ const pos=calcPosition(s); return a+pos.qty*pos.avgPrice; },0);
  const totVal    = p.stocks.reduce((a,s)=>{ const pos=calcPosition(s); return a+pos.qty*s.curPrice; },0);
  const totReal   = p.stocks.reduce((a,s)=>{ const pos=calcPosition(s); return a+pos.realizedPnl; },0);
  const totDiv    = p.stocks.reduce((a,s)=>a+(s.accumulatedDividend||0),0);
  const totUnreal = totVal - totCost;
  const totTotal  = totUnreal + totReal + totDiv;
  const pnlRate   = totCost ? (totUnreal/totCost*100).toFixed(2) : 0;
  const totRate   = totCost ? (totTotal/totCost*100).toFixed(2)  : 0;
  const stats = panel.querySelectorAll('.account-stat .val');
  if(stats[0]) stats[0].textContent = fmtKRW(totVal);
  if(stats[1]){ stats[1].textContent = (totUnreal>=0?'+':'')+fmtKRW(totUnreal)+' ('+(totUnreal>=0?'+':'')+pnlRate+'%)'; stats[1].className=`val ${totUnreal>=0?'pos':'neg'}`; }
  if(stats[2]){ stats[2].textContent = totReal!==0?(totReal>=0?'+':'')+fmtKRW(Math.round(totReal)):'—'; stats[2].className=`val ${totReal>=0?'pos':'neg'}`; }
  if(stats[3]){ stats[3].textContent = (totTotal>=0?'+':'')+fmtKRW(Math.round(totTotal))+' ('+(totTotal>=0?'+':'')+totRate+'%)'; stats[3].className=`val ${totTotal>=0?'pos':'neg'}`; }
}

function toggleAccount(id){
  const body = document.getElementById(`pb-${id}`);
  const chev = document.getElementById(`chev-${id}`);
  if(!body) return;
  body.classList.toggle('collapsed');
  chev.classList.toggle('open');
}

// 계좌별 거래 창 열기 — 종목 선택 드롭다운 팝업
function openTradeModal(pid){
  const p = state.portfolios.find(x=>x.id===pid);
  if(!p) return;
  // 기존 모달 제거
  document.getElementById('trade-modal-overlay')?.remove();
  if(!p.stocks.length){ showToast('⚠️ 먼저 종목을 추가하세요'); return; }

  const options = p.stocks.map(s =>
    `<option value="${s.id}">${s.name||'(이름 없음)'}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.id = 'trade-modal-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;display:flex;align-items:center;justify-content:center;`;
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:28px 32px;min-width:340px;max-width:420px;width:90%;position:relative;">
      <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text3);margin-bottom:20px;">📋 거래 추가 — ${p.accountName}</div>
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">종목 선택</div>
        <select id="modal-stock-select" style="width:100%;font-family:var(--mono);font-size:13px;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:3px;">
          ${options}
        </select>
      </div>
      <div id="modal-base-pos" style="background:var(--surface2);border:1px solid var(--border);border-radius:3px;padding:10px 14px;margin-bottom:16px;font-size:11px;color:var(--muted);"></div>
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">기준 포지션 (이전 거래 합산)</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;color:var(--muted);">수량</span>
            <input type="text" inputmode="numeric" id="modal-base-qty" placeholder="0" style="max-width:80px;font-family:var(--mono);font-size:12px;" onfocus="this.select()">
            <span style="font-size:11px;color:var(--muted);">주</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;color:var(--muted);">평단가</span>
            <input type="text" inputmode="numeric" id="modal-base-price" placeholder="0" style="max-width:100px;font-family:var(--mono);font-size:12px;" onfocus="this.select()">
            <span style="font-size:11px;color:var(--muted);">원</span>
          </div>
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">거래 입력</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="text" inputmode="numeric" id="modal-trade-date" placeholder="YYYY/MM/DD" style="max-width:120px;font-family:var(--mono);font-size:12px;" oninput="dateTextInput(this)" onblur="dateTextBlur(this)">
          <div style="display:flex;align-items:center;gap:4px;">
            <input type="text" inputmode="numeric" id="modal-trade-qty" placeholder="수량" style="max-width:70px;font-family:var(--mono);font-size:12px;" onfocus="this.select()">
            <span style="font-size:11px;color:var(--muted);">주</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <input type="text" inputmode="numeric" id="modal-trade-price" placeholder="가격" style="max-width:90px;font-family:var(--mono);font-size:12px;" onfocus="this.select()">
            <span style="font-size:11px;color:var(--muted);">원</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button class="trade-btn trade-btn-buy" style="flex:1;" onclick="submitTrade(${pid},'매수')">＋ 매수</button>
        <button class="trade-btn trade-btn-sell" style="flex:1;" onclick="submitTrade(${pid},'매도')">－ 매도</button>
      </div>
      <div id="modal-trade-log" style="max-height:200px;overflow-y:auto;"></div>
      <button onclick="document.getElementById('trade-modal-overlay').remove()"
        style="position:absolute;top:12px;right:14px;background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;line-height:1;">✕</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });

  // 종목 선택 시 기준 포지션·거래 로그 업데이트
  const sel = document.getElementById('modal-stock-select');
  sel.addEventListener('change', () => updateModalStock(pid));
  updateModalStock(pid);
}

function updateModalStock(pid){
  const p   = state.portfolios.find(x=>x.id===pid);
  const sel = document.getElementById('modal-stock-select');
  if(!sel||!p) return;
  const sid = Number(sel.value);
  const s   = p.stocks.find(x=>x.id===sid);
  if(!s) return;

  // 기준 포지션 inputs
  const bqEl = document.getElementById('modal-base-qty');
  const bpEl = document.getElementById('modal-base-price');
  if(bqEl) bqEl.value = s.baseQty ? fmtComma(s.baseQty) : '';
  if(bpEl) bpEl.value = s.baseAvgPrice ? fmtComma(s.baseAvgPrice) : '';

  // 현재 포지션 요약
  const pos = calcPosition(s);
  const baseDiv = document.getElementById('modal-base-pos');
  if(baseDiv) baseDiv.innerHTML = `현재: <strong style="color:var(--text2);">${pos.qty.toLocaleString()}주 @ ${pos.avgPrice?fmtKRW(pos.avgPrice):'—'}</strong>　실현손익: <strong class="${pos.realizedPnl>=0?'pos':'neg'}">${pos.realizedPnl!==0?(pos.realizedPnl>=0?'+':'')+fmtKRW(Math.round(pos.realizedPnl)):'—'}</strong>`;

  // 거래 로그
  renderModalTradeLog(p, s, pos);
}

function renderModalTradeLog(p, s, pos){
  const logEl = document.getElementById('modal-trade-log');
  if(!logEl) return;
  if(!s.trades||!s.trades.length){ logEl.innerHTML = '<div style="font-size:11px;color:var(--muted);font-family:var(--mono);">거래 내역 없음</div>'; return; }

  let q = s.baseQty||0, cb = q*(s.baseAvgPrice||0);
  const rows = s.trades.map(t => {
    let tpnl = null;
    if(t.type==='매도'){ const ac=q>0?cb/q:0; tpnl=(t.price-ac)*t.qty; q-=t.qty; cb-=ac*t.qty; }
    else { q+=t.qty; cb+=t.qty*t.price; }
    return `<tr>
      <td class="${t.type==='매수'?'trade-buy':'trade-sell'}" style="padding:4px 8px;">${t.type}</td>
      <td style="padding:4px 8px;font-family:var(--mono);font-size:11px;">${t.date||'—'}</td>
      <td style="padding:4px 8px;font-family:var(--mono);font-size:11px;">${t.qty.toLocaleString()}주</td>
      <td style="padding:4px 8px;font-family:var(--mono);font-size:11px;">${fmtKRW(t.price)}</td>
      <td class="${tpnl!==null?(tpnl>=0?'pos':'neg'):''}" style="padding:4px 8px;font-family:var(--mono);font-size:11px;">${tpnl!==null?(tpnl>=0?'+':'')+fmtKRW(Math.round(tpnl)):'—'}</td>
      <td style="padding:4px 8px;"><button class="btn btn-danger" style="padding:1px 6px;font-size:10px;" onclick="removeTradeFromModal(${p.id},${s.id},${t.id})">✕</button></td>
    </tr>`;
  }).join('');
  logEl.innerHTML = `<table class="trade-log" style="width:100%;margin-top:8px;">
    <thead><tr><th>구분</th><th>날짜</th><th>수량</th><th>가격</th><th>실현손익</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function removeTradeFromModal(pid, sid, tid){
  const p = state.portfolios.find(x=>x.id===pid);
  if(!p) return;
  const s = p.stocks.find(x=>x.id===sid);
  if(!s) return;
  if(!confirm('이 거래를 삭제할까요?')) return;
  s.trades = (s.trades||[]).filter(t=>t.id!==tid);
  const pos = calcPosition(s);
  renderModalTradeLog(p, s, pos);
  updateModalStock(pid);
  renderPortfolios(); renderSavings(); recalcAll(); scheduleSave();
}

function submitTrade(pid, type){
  const p   = state.portfolios.find(x=>x.id===pid);
  if(!p) return;
  const sel = document.getElementById('modal-stock-select');
  const sid = Number(sel?.value);
  const s   = p.stocks.find(x=>x.id===sid);
  if(!s){ showToast('⚠️ 종목을 선택하세요'); return; }

  // 기준 포지션 먼저 저장
  const bqEl = document.getElementById('modal-base-qty');
  const bpEl = document.getElementById('modal-base-price');
  if(bqEl && bpEl){
    s.baseQty      = parseComma(bqEl.value)||0;
    s.baseAvgPrice = parseComma(bpEl.value)||0;
  }

  const dateEl  = document.getElementById('modal-trade-date');
  const qtyEl   = document.getElementById('modal-trade-qty');
  const priceEl = document.getElementById('modal-trade-price');
  const date    = dateEl?.value || '';
  const qty     = parseComma(qtyEl?.value||'0');
  const price   = parseComma(priceEl?.value||'0');

  if(!qty||!price){ showToast('⚠️ 수량과 가격을 입력하세요'); return; }
  const pos = calcPosition(s);
  if(type==='매도' && qty>pos.qty){ showToast(`⚠️ 보유 수량(${pos.qty}주)보다 많이 매도할 수 없습니다`); return; }

  const stockName = s.name||'종목';
  if(!confirm(`${stockName} ${type} ${qty}주 @ ${fmtKRW(price)}\n총 ${fmtKRW(qty*price)}\n거래를 추가할까요?`)) return;

  if(!s.trades) s.trades=[];
  s.trades.push({ id:uid(), date, type, qty, price });

  // 입력 초기화
  if(qtyEl) qtyEl.value='';
  if(priceEl) priceEl.value='';
  if(dateEl) dateEl.value='';

  // 모달 내 로그 갱신
  updateModalStock(pid);

  renderPortfolios(); renderSavings(); recalcAll(); scheduleSave();
  showToast(`✅ ${type} 거래 추가됨`);
}

// 하위 호환 — 기존 addTrade/removeTrade 유지
function addTrade(pid, sid, type){ submitTrade(pid, type); }
function removeTrade(pid, sid, tid){ removeTradeFromModal(pid, sid, tid); }
function toggleTradePanel(){ /* 더 이상 사용 안 함 */ }

function renderPortfolios(){
  ensureFixedPortfolios();
  const sec = document.getElementById('portfolio-section');
  sec.innerHTML = state.portfolios.map(p => {
    const totCost   = p.stocks.reduce((a,s)=>{ const pos=calcPosition(s); return a+pos.qty*pos.avgPrice; },0);
    const totVal    = p.stocks.reduce((a,s)=>{ const pos=calcPosition(s); return a+pos.qty*s.curPrice; },0);
    const totReal   = p.stocks.reduce((a,s)=>{ const pos=calcPosition(s); return a+pos.realizedPnl; },0);
    const totDiv    = p.stocks.reduce((a,s)=>a+(s.accumulatedDividend||0),0);
    const totUnreal = totVal - totCost;
    const totTotal  = totUnreal + totReal + totDiv;
    const pnlRate   = totCost ? (totUnreal/totCost*100).toFixed(2) : 0;
    const totRate   = totCost ? (totTotal/totCost*100).toFixed(2)  : 0;
    const isFixed   = !!p.fixed;

    const nameEl = isFixed
      ? `<span class="account-badge" style="background:var(--accent-dim);color:var(--accent);border:1px solid rgba(0,230,118,0.3);">${p.type}</span>
         <input class="portfolio-name-input" style="background:transparent;border:none;border-bottom:1px dashed rgba(0,230,118,0.3);color:var(--text);font-weight:700;font-size:14px;padding:2px 6px;min-width:120px;"
           value="${p.accountName}" onclick="event.stopPropagation()"
           data-cb="${`updatePortfolioName(${p.id},v)`.replace(/"/g,'&quot;')}"
           oninput="nInputText(this)" onblur="nBlurText(this)" onfocus="this.style.borderColor='var(--accent)'">`
      : `<span class="account-badge">${p.type}</span>
         <input class="portfolio-name-input" style="background:transparent;border:none;border-bottom:1px dashed var(--border);color:var(--text);font-weight:700;font-size:14px;padding:2px 6px;min-width:120px;"
           value="${p.accountName}" onclick="event.stopPropagation()"
           data-cb="${`updatePortfolioName(${p.id},v)`.replace(/"/g,'&quot;')}"
           oninput="nInputText(this)" onblur="nBlurText(this)" onfocus="this.style.borderColor='var(--accent)'">`;

    const headerClickAttr = isFixed ? '' : `onclick="toggleAccount(${p.id})"`;
    const chevEl    = isFixed ? '' : `<span class="chevron open" id="chev-${p.id}">▾</span>`;
    const deleteBtn = isFixed
      ? `<span style="font-size:10px;font-family:var(--mono);color:var(--text3);padding:4px 8px;opacity:0.5;">고정</span>`
      : `<button class="btn btn-danger" onclick="event.stopPropagation();removePortfolio(${p.id})" style="padding:4px 8px;">✕</button>`;
    const typeSelect = isFixed ? ''
      : `<select style="font-family:var(--mono);font-size:11px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);padding:3px 6px;border-radius:2px;cursor:pointer;"
           onclick="event.stopPropagation()" onchange="updatePortfolioType(${p.id},this.value)">
           ${ACCOUNT_TYPES.map(t=>`<option value="${t}" ${p.type===t?'selected':''}>${t}</option>`).join('')}
         </select>`;

    const stockRows = p.stocks.length === 0
      ? `<tr class="empty-row"><td colspan="16">종목이 없습니다 — 아래 버튼으로 추가하세요</td></tr>`
      : p.stocks.map(s => {
          const pos      = calcPosition(s);
          const qty      = pos.qty;
          const avgPrice = pos.avgPrice;
          const realPnl  = pos.realizedPnl;
          const val      = qty * s.curPrice;
          const cost     = qty * avgPrice;
          const unreal   = val - cost;
          const accDiv   = s.accumulatedDividend || 0;
          const totalPnl = unreal + realPnl + accDiv;
          const pr   = cost ? (unreal/cost*100).toFixed(2)   : '0.00';
          const tr2  = cost ? (totalPnl/cost*100).toFixed(2) : '0.00';
          const cycle = s.dividendCycle || '연';
          const annualDiv = s.dividend || 0;
          let periodDiv = annualDiv, periodLabel = '연';
          if(cycle==='월')       { periodDiv=(annualDiv/12).toFixed(4); periodLabel='월'; }
          else if(cycle==='분기') { periodDiv=(annualDiv/4).toFixed(4);  periodLabel='분기'; }
          const isUnrealPos = Number(pr)  >= 0;
          const isTotPos    = Number(tr2) >= 0;
          const isRealPos   = realPnl >= 0;

          return `
          <tr class="stock-row" data-sid="${s.id}">
            <td>${mkText(s.name, `updateStock(${p.id},${s.id},'name',v)`, 'placeholder="종목명"')}</td>
            <td class="mono" style="color:var(--text2);font-weight:600;">${qty.toLocaleString()}</td>
            <td class="mono" style="color:var(--text2);">${avgPrice?fmtKRW(avgPrice):'—'}</td>
            <td>${mkNum(s.curPrice, `updateStock(${p.id},${s.id},'curPrice',v)`, '', '0')}</td>
            <td class="mono neutral-val">${fmtKRW(val)}</td>
            <td class="mono ${isUnrealPos?'pos':'neg'}">${isUnrealPos?'+':''}${fmtKRW(unreal)}</td>
            <td><span class="badge ${isUnrealPos?'badge-green':'badge-red'}">${isUnrealPos?'+':''}${pr}%</span></td>
            <td class="mono ${isRealPos?'pos':'neg'}">${realPnl!==0?(isRealPos?'+':'')+fmtKRW(Math.round(realPnl)):'—'}</td>
            <td>
              <div style="display:flex;flex-direction:column;gap:2px;">
                ${mkNumDec(s.dividend, `updateStock(${p.id},${s.id},'dividend',v)`, 'style="max-width:65px;"')}
                ${annualDiv>0?`<span style="font-size:9px;color:var(--text3);font-family:var(--mono);">${periodLabel} ${Number(periodDiv).toFixed(2)}%</span>`:''}
              </div>
            </td>
            <td>
              <select style="font-family:var(--mono);font-size:11px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);padding:3px 5px;border-radius:2px;"
                onchange="updateStock(${p.id},${s.id},'dividendCycle',this.value)">
                <option value="월" ${cycle==='월'?'selected':''}>월 배당</option>
                <option value="분기" ${cycle==='분기'?'selected':''}>분기 배당</option>
                <option value="연" ${cycle==='연'?'selected':''}>연 배당</option>
              </select>
            </td>
            <td>
              ${cycle==='월'
                ? `<div style="display:flex;align-items:center;gap:4px;"><span style="font-size:11px;color:var(--muted);">매월</span>${mkNum(s.dividendDate||0,`updateStock(${p.id},${s.id},'dividendDate',v)`,'max-width:44px;','15')}<span style="font-size:11px;color:var(--muted);">일</span></div>`
                : mkDate(s.dividendDate, `updateStock(${p.id},${s.id},'dividendDate',v)`)
              }
            </td>
            <td>
              <div style="display:flex;align-items:center;gap:4px;">
                <input type="text" inputmode="numeric" id="div-input-${s.id}" placeholder="0" style="max-width:75px;">
                <button onclick="addDividend(${p.id},${s.id})"
                  style="background:var(--accent-dim);border:1px solid rgba(0,230,118,0.3);color:var(--accent);border-radius:2px;padding:3px 7px;cursor:pointer;font-weight:700;font-size:13px;">＋</button>
              </div>
            </td>
            <td class="mono ${accDiv>0?'pos':''}">${accDiv>0?fmtKRW(accDiv):'—'}</td>
            <td><span class="badge ${isTotPos?'badge-green':'badge-red'}">${isTotPos?'+':''}${tr2}%</span></td>
            <td>${mkNum(s.monthlyBuy, `updateStock(${p.id},${s.id},'monthlyBuy',v)`)}</td>
            <td><button class="btn btn-danger" onclick="removeStock(${p.id},${s.id})">✕</button></td>
          </tr>`;
        }).join('');

    return `
    <div class="account-panel" id="ph-${p.id}" style="${isFixed?'border-color:rgba(0,230,118,0.15);':''}">
      <div class="account-header" ${headerClickAttr} style="${isFixed?'cursor:default;':''}">
        <div class="account-header-left">${nameEl}</div>
        <div class="account-header-right">
          <div class="account-stat"><div class="label">평가금액</div><div class="val neutral-val">${fmtKRW(totVal)}</div></div>
          <div class="account-stat"><div class="label">미실현 수익</div><div class="val ${totUnreal>=0?'pos':'neg'}">${totUnreal>=0?'+':''}${fmtKRW(totUnreal)} (${totUnreal>=0?'+':''}${pnlRate}%)</div></div>
          <div class="account-stat"><div class="label">실현 수익</div><div class="val ${totReal>=0?'pos':'neg'}">${totReal!==0?(totReal>=0?'+':'')+fmtKRW(Math.round(totReal)):'—'}</div></div>
          <div class="account-stat"><div class="label">총 수익</div><div class="val ${totTotal>=0?'pos':'neg'}">${totTotal>=0?'+':''}${fmtKRW(Math.round(totTotal))} (${totTotal>=0?'+':''}${totRate}%)</div></div>
          <div class="account-stat">
            <div class="label">종목 수</div>
            <div class="val" style="display:flex;align-items:center;gap:8px;">
              ${p.stocks.length}종목
              <button class="trade-btn trade-btn-buy" style="padding:3px 10px;font-size:10px;" onclick="event.stopPropagation();openTradeModal(${p.id})">거래</button>
            </div>
          </div>
          ${typeSelect}${deleteBtn}${chevEl}
        </div>
      </div>
      <div class="account-body" id="pb-${p.id}">
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
        <table style="min-width:1050px;" class="portfolio-table">
          <colgroup>
            <col style="min-width:150px;"><col style="width:60px;"><col style="width:100px;"><col style="width:100px;">
            <col style="width:110px;"><col style="width:110px;"><col style="width:75px;"><col style="width:110px;">
            <col style="width:85px;"><col style="width:85px;"><col style="width:105px;">
            <col style="width:120px;"><col style="width:95px;">
            <col style="width:75px;"><col style="width:95px;"><col style="width:40px;">
          </colgroup>
          <thead>
            <tr>
              <th>종목명</th><th>수량</th><th>평단가</th><th>현재가</th>
              <th>평가금액</th><th>미실현 수익</th><th>수익률</th><th>실현 수익</th>
              <th>배당률(%)</th><th>배당주기</th><th>다음 배당일</th>
              <th>배당 지급액</th><th>누적 배당금</th>
              <th>총 수익률</th><th>월 매수금</th><th></th>
            </tr>
          </thead>
          <tbody>${stockRows}</tbody>
        </table>
        </div>
        <button class="add-row-btn" onclick="addStock(${p.id})">＋ 종목 추가</button>
      </div>
    </div>`;
  }).join('');
  recalcAll();
}

function addDividend(pid, sid){
  const p = state.portfolios.find(x=>x.id===pid);
  if(!p) return;
  const s = p.stocks.find(x=>x.id===sid);
  if(!s) return;
  const inputEl = document.getElementById(`div-input-${sid}`);
  const amount = parseComma(inputEl?.value||'0');
  if(!amount || amount<=0){ showToast('⚠️ 배당 지급액을 입력하세요'); return; }
  const stockName = s.name||'해당 종목';
  if(confirm(`${stockName}의 배당금 ${fmtKRW(amount)}을 총 수익률에 추가할까요?\n(누적 배당금에 합산됩니다)`)){
    s.accumulatedDividend = (s.accumulatedDividend||0) + amount;
    if(inputEl) inputEl.value='';
    renderPortfolios(); renderSavings(); recalcAll(); scheduleSave();
    showToast(`✅ 배당금 ${fmtKRW(amount)} 추가됨 (누적: ${fmtKRW(s.accumulatedDividend)})`);
  }
}

function updateMaturityMonthly(id, value){
  const s = state.savings.find(x=>x.id===id);
  if(s){
    s.monthlyAmt = Number(value);
    const cardInput = document.querySelector(`#sc-${id} .num-input`);
    if(cardInput) cardInput.value = value ? fmtComma(value) : '';
  }
  recalcAll();
  scheduleSave();
}

function updatePortfolioName(id, val){
  const p = state.portfolios.find(x=>x.id===id);
  if(!p) return;
  p.accountName = val;
  if(!p.fixed){
    const s = state.savings.find(x=>x.id===id);
    if(s){ s.name=val; const ni=document.querySelector(`#sc-${id} .savings-name-input`); if(ni) ni.value=val; }
  }
}

function updatePortfolioType(id, val){
  const p = state.portfolios.find(x=>x.id===id);
  if(!p) return;
  p.type = val;
  const defaultNames = ['ISA','CMA','과세연금저축','비과세연금저축','IRP','적금','기타','새 계좌'];
  if(defaultNames.some(n=>p.accountName===n||p.accountName===n+' 포트폴리오'||p.accountName==='새 계좌')){
    p.accountName = val+' 포트폴리오';
  }
  if(!p.fixed){ const s=state.savings.find(x=>x.id===id); if(s){ s.type=val; s.name=p.accountName; } }
  renderPortfolios(); renderSavings(); scheduleSave();
}

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
  state.savings.push({id, type:'ISA', name:'새 계좌', monthlyAmt:0, totalPrincipal:0, currentAmt:0, maturityDate:''});
  renderSavings();
  recalcAll();
  // Focus the name input of the new card after render
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
  grid.innerHTML = state.savings.map(s => `
    <div class="savings-card" id="sc-${s.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div style="flex:1;min-width:0;">
          <select style="background:transparent;border:none;font-weight:700;font-size:13px;color:var(--text);padding:0;margin-bottom:6px;cursor:pointer;width:100%;" onchange="updateSavings(${s.id},'type',this.value)">
            ${ACCOUNT_TYPES.map(t=>`<option value="${t}" ${s.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
          <div style="position:relative;">
            <input class="savings-name-input"
              style="background:var(--surface2);border:1px solid var(--border);border-radius:2px;font-size:13px;font-weight:600;color:var(--text);padding:5px 8px;width:100%;"
              value="${s.name}" placeholder="계좌명 입력"
              data-cb="${`updateSavings(${s.id},'name',v)`.replace(/"/g,'&quot;')}"
              oninput="nInputText(this)" onblur="nBlurText(this)"
              onfocus="this.style.borderColor='var(--accent)'">
            <span style="position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--muted);pointer-events:none;">✎</span>
          </div>
        </div>
        <button class="btn btn-danger" style="margin-left:8px;flex-shrink:0;" onclick="removeSavings(${s.id})">✕</button>
      </div>
      <div class="type-badge">월 저축</div>
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:14px;">
        <span style="font-family:var(--mono);font-size:13px;color:var(--muted);">₩</span>
        ${mkNum(s.monthlyAmt, `updateSavings(${s.id},'monthlyAmt',v)`, 'border:none;border-bottom:1px dashed var(--accent);font-size:20px;font-weight:600;padding:2px 0;width:100%;background:transparent;', '0')}
      </div>
      ${(()=>{
        const isSavings = s.type === '적금';
        const PORTFOLIO_TYPES = ['ISA','CMA','과세연금저축','비과세연금저축','IRP'];
        const isPortfolioType = PORTFOLIO_TYPES.includes(s.type);

        // 포트폴리오 타입: 평가금액(원금) + 총수익(주가+배당) 자동 계산
        const portPrincipal = isPortfolioType
          ? state.portfolios.filter(p=>p.type===s.type).reduce((a,p)=>a+p.stocks.reduce((b,st)=>b+st.qty*st.avgPrice,0),0)
          : 0;
        const portVal = isPortfolioType
          ? state.portfolios.filter(p=>p.type===s.type).reduce((a,p)=>a+p.stocks.reduce((b,st)=>b+st.qty*st.curPrice,0),0)
          : 0;
        const portDiv = isPortfolioType
          ? state.portfolios.filter(p=>p.type===s.type).reduce((a,p)=>a+p.stocks.reduce((b,st)=>b+(st.accumulatedDividend||0),0),0)
          : 0;
        const portTotalVal = portVal + portDiv;

        // 적금 타입: 만기 일정 데이터에서 자동 계산
        let savPrincipal = 0, savCurrent = 0;
        if(isSavings){
          const m = state.maturity.find(x=>x.id===s.id);
          if(m && m.startDate && s.monthlyAmt > 0){
            const start = new Date(m.startDate);
            const now   = new Date();
            const elapsed = Math.max(0,
              (now.getFullYear()-start.getFullYear())*12 + (now.getMonth()-start.getMonth())
            );
            const payCount = elapsed + 1; // 최초 납입 포함
            savPrincipal = payCount * s.monthlyAmt;
            // 현재까지 단리 이자 = 월납입 × 회차(회차+1)/2 × 연금리/12/100
            const interest = s.monthlyAmt * (payCount*(payCount+1)/2) * ((m.rate||0)/100/12);
            savCurrent = Math.round(savPrincipal + interest);
          }
        }

        const principal = isSavings ? savPrincipal : portPrincipal;
        const current   = isSavings ? savCurrent   : portTotalVal;
        const pnl  = current - principal;
        const rate = principal > 0 ? (pnl/principal*100).toFixed(2) : null;
        const isPos = pnl >= 0;

        return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:${rate!==null&&current>0?'8':'14'}px;">
          <div>
            <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">총 투자 원금</div>
            ${isSavings
              ? `<div style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--text2);">${savPrincipal ? fmtKRW(savPrincipal) : '—'}</div>
                 <div style="font-size:9px;color:var(--muted);margin-top:2px;">현재 기준 총 납입금</div>`
              : `<div style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--text2);">${fmtKRW(portPrincipal)}</div>
                 <div style="font-size:9px;color:var(--muted);margin-top:2px;">매입 원가 합산</div>`
            }
          </div>
          <div>
            <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">현재 금액</div>
            ${isSavings
              ? `<div style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--text2);">${savCurrent ? fmtKRW(savCurrent) : '—'}</div>
                 <div style="font-size:9px;color:var(--muted);margin-top:2px;">납입금 + 현재까지 이자</div>`
              : `<div style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--text2);">${fmtKRW(portTotalVal)}</div>
                 <div style="font-size:9px;color:var(--muted);margin-top:2px;">평가금 ${fmtKRW(portVal)} + 배당 ${fmtKRW(portDiv)}</div>`
            }
          </div>
        </div>
        ${(rate !== null && current > 0) ? `
        <div style="display:flex;align-items:center;justify-content:space-between;background:${isPos?'var(--red-dim)':'var(--cyan-dim)'};border-radius:2px;padding:5px 8px;margin-bottom:10px;">
          <span style="font-size:10px;color:var(--muted);letter-spacing:1px;">총 수익률</span>
          <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:${isPos?'var(--red)':'var(--cyan)'};">${isPos?'+':''}${rate}% (${isPos?'+':''}${fmtKRW(pnl)})</span>
        </div>` : ''}`;
      })()}
    </div>
  `).join('');
}

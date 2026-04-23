function addMaturityRow(){
  const id = uid();
  state.maturity.push({id, name:'', type:'적금', rate:0, payDay:'', startDate:'', endDate:''});
  state.savings.push({id, type:'적금', name:'', monthlyAmt:0, totalPrincipal:0, currentAmt:0, maturityDate:''});
  renderAll();
  setTimeout(() => {
    const el = document.querySelector(`#mat-name-${id}`);
    if(el){ el.focus(); }
  }, 50);
  scheduleSave();
}

function removeMaturity(id){
  state.maturity = state.maturity.filter(x=>x.id!==id);
  state.savings = state.savings.filter(x=>x.id!==id);
  renderAll();
  scheduleSave();
}

function updateMaturity(id, field, value){
  const m = state.maturity.find(x=>x.id===id);
  if(!m) return;
  m[field] = ['rate','payDay'].includes(field) ? Number(value) : value;

  if(field === 'name'){
    const s = state.savings.find(x=>x.id===id);
    if(s) s.name = value;
    // 저축 카드 이름 DOM 직접 업데이트 (모든 행 반영)
    const nameEl = document.querySelector(`#sc-${id} .savings-card-name`);
    if(nameEl) nameEl.textContent = value || '—';
  }

  if(field === 'type'){
    const s = state.savings.find(x=>x.id===id);
    if(s) s.type = value;
    // 저축 카드 타입 라벨 DOM 직접 업데이트
    const typeEl = document.querySelector(`#sc-${id} .savings-card-type`);
    if(typeEl) typeEl.textContent = value;
  }

  if(field !== 'name'){
    renderMaturity();
    recalcAll();
  }
  scheduleSave();
}

function updateSavings(id, field, value){
  const s = state.savings.find(x=>x.id===id);
  if(!s) return;
  s[field] = ['monthlyAmt','totalPrincipal','currentAmt'].includes(field) ? Number(value) : value;
  if(field === 'name' && s.type === '적금'){
    const m = state.maturity.find(x=>x.id===id);
    if(m){
      m.name = value;
      const matInput = document.querySelector(`#mat-name-${id}`);
      if(matInput) matInput.value = value;
    }
  }
  // 증권사 변경 시 포트폴리오에도 동기화
  if(field === 'broker'){
    const p = state.portfolios.find(x=>x.id===id);
    if(p){
      p.broker = value;
      // 포트폴리오 헤더 증권사 선택 DOM 직접 업데이트
      const sel = document.querySelector(`#ph-${id} .account-header select`);
      if(sel) sel.value = value;
    }
  }
  if(field === 'monthlyAmt' && s.type === '적금'){
    renderMaturity();
  }
  if(field !== 'name'){
    recalcAll();
  }
  scheduleSave();
}

// 저축 카드에서 적금 삭제 → 만기 일정도 삭제
function removeSavings(id){
  const s = state.savings.find(x=>x.id===id);
  if(s && s.type === '적금'){
    state.maturity = state.maturity.filter(x=>x.id!==id);
  }
  // 연결된 비고정 포트폴리오도 삭제
  const linked = state.portfolios.find(x=>x.id===id && !x.fixed);
  if(linked) state.portfolios = state.portfolios.filter(x=>x.id!==id);
  state.savings = state.savings.filter(x=>x.id!==id);
  renderAll();
  scheduleSave();
}

function dDay(dateStr){
  if(!dateStr) return '—';
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return diff >= 0 ? diff : '만기';
}

// 만기 시 예상 금액: 가입 첫 달 포함 (총 개월+1회 납입) 단리 적금
function calcMaturityAmt(monthlyAmt, rate, start, end){
  if(!monthlyAmt || !start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  const totalMonths = Math.round((e - s) / (1000*60*60*24*30.44));
  if(totalMonths <= 0) return 0;
  const payCount = totalMonths + 1; // 최초 가입일 납입 포함
  const totalPrincipal = monthlyAmt * payCount;
  // 단리 적금 이자 = 월 저축 × 회차(회차+1)/2 × 연금리/12/100
  const interest = monthlyAmt * (payCount * (payCount + 1) / 2) * ((rate||0) / 100 / 12);
  return Math.round(totalPrincipal + interest);
}

function renderMaturity(){
  const tbody = document.getElementById('maturity-body');
  if(!state.maturity.length){
    tbody.innerHTML = '<tr class="empty-row"><td colspan="11">+ 버튼을 눌러 적금을 추가하세요</td></tr>';
    return;
  }
  tbody.innerHTML = state.maturity.map(m => {
    const dd = dDay(m.endDate);
    const ddLabel = dd === '만기' ? `<span class="badge badge-red">만기</span>`
                  : dd <= 30    ? `<span class="badge badge-yellow">D-${dd}</span>`
                  :               `<span class="badge badge-blue">D-${dd}</span>`;

    // 연동된 저축 카드에서 월 저축 금액 가져오기
    const linkedSaving = state.savings.find(x=>x.id===m.id);
    const monthlyAmt = linkedSaving ? (linkedSaving.monthlyAmt || 0) : 0;

    // 현재 기준 총 납입금 = (경과 개월 수 + 1) × 월 저축금액 (최초 가입일 납입 포함)
    let totalPaid = 0;
    if(m.startDate && monthlyAmt > 0){
      const start = new Date(m.startDate);
      const now   = new Date();
      const elapsedMonths = Math.max(0,
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
      );
      totalPaid = (elapsedMonths + 1) * monthlyAmt;
    }

    // 만기 시 예상 금액 (단리 적금)
    const maturityAmt = calcMaturityAmt(monthlyAmt, m.rate, m.startDate, m.endDate);

    return `
    <tr class="mat-row">
      <td>${mkText(m.name, `updateMaturity(${m.id},'name',v)`, `id="mat-name-${m.id}" placeholder="계좌명"`)}</td>
      <td>
        <select onchange="updateMaturity(${m.id},'type',this.value)">
          ${['적금','예금','청약','기타'].map(t=>`<option ${m.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </td>
      <td>${mkNum(monthlyAmt, `updateMaturityMonthly(${m.id},v)`)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:4px;">
          <span style="font-size:11px;color:var(--muted);">매월</span>
          ${mkNum(m.payDay||0, `updateMaturity(${m.id},'payDay',v)`, 'max-width:44px;', '25')}
          <span style="font-size:11px;color:var(--muted);">일</span>
        </div>
      </td>
      <td>${mkNumDec(m.rate, `updateMaturity(${m.id},'rate',v)`, 'style="max-width:70px;"')}</td>
      <td>${mkDate(m.startDate, `updateMaturity(${m.id},'startDate',v)`)}</td>
      <td>${mkDate(m.endDate, `updateMaturity(${m.id},'endDate',v)`)}</td>
      <td class="mono neutral-val">${totalPaid ? fmtKRW(totalPaid) : '—'}</td>
      <td class="mono pos">${maturityAmt ? fmtKRW(maturityAmt) : '—'}</td>
      <td>${m.endDate ? ddLabel : '—'}</td>
      <td><button class="btn btn-danger" onclick="removeMaturity(${m.id})">✕</button></td>
    </tr>`;
  }).join('');
}

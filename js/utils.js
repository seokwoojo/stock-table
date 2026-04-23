// ─────────────── UTILS ───────────────
const fmtKRW = v => {
  if (!v && v !== 0) return '—';
  return '₩' + Number(v).toLocaleString('ko-KR');
};
const fmtNum = v => v ? Number(v).toLocaleString('ko-KR') : '—';
const fmtComma = v => (!v && v!==0) ? '' : Number(v).toLocaleString('ko-KR');
const parseComma = v => Number(String(v).replace(/,/g,'')) || 0;
const pct = (a,b) => b ? ((a-b)/b*100).toFixed(2) : '0.00';
let idCnt = 1;
const uid = () => idCnt++;

// ─────────────── 숫자 INPUT 헬퍼 ───────────────
const _debMap = new WeakMap();

function mkNum(value, cbStr, style='', ph='0', tabAttr=''){
  const display = value ? fmtComma(value) : '';
  const escaped = cbStr.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return `<input type="text" inputmode="numeric" class="num-input"
    value="${display}" placeholder="${ph}"
    style="${style}"
    data-cb="${escaped}"
    onfocus="nFocus(this)"
    onblur="nBlur(this)"
    oninput="nInput(this)"
    ${tabAttr}>`;
}

function nFocus(el){
  const raw = parseComma(el.value);
  el.value = raw || '';
  el.select();
}
function nBlur(el){
  const v = parseComma(el.value);
  el.value = v ? fmtComma(v) : '';
  if(_debMap.has(el)){ clearTimeout(_debMap.get(el)); _debMap.delete(el); }
  _execCb(el.dataset.cb, v);
}
function nInput(el){
  if(_debMap.has(el)) clearTimeout(_debMap.get(el));
  _debMap.set(el, setTimeout(()=>{ _execCb(el.dataset.cb, parseComma(el.value)); }, 1000));
}
function _execCb(cbStr, v){
  try{ (new Function('v', cbStr))(v); } catch(e){ console.warn('_execCb error:', cbStr, e); }
}
function nInput(el){
  if(_debMap.has(el)) clearTimeout(_debMap.get(el));
  _debMap.set(el, setTimeout(()=>{ _execCb(el.dataset.cb, parseComma(el.value)); }, 1000));
}
function _execCb(cbStr, v){
  try{ (new Function('v', cbStr))(v); } catch(e){ console.warn('_execCb error:', cbStr, e); }
}

// 일반 텍스트 input — 디바운스 500ms
function mkText(value, cbStr, attrs=''){
  const escaped = cbStr.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return `<input type="text" value="${value||''}"
    data-cb="${escaped}"
    oninput="nInputText(this)"
    onblur="nBlurText(this)"
    ${attrs}>`;
}
// 날짜 input — YYYY/MM/DD 텍스트 입력, 1000ms 디바운스
function mkDate(value, cbStr, attrs=''){
  const escaped = cbStr.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  // 저장값 YYYY-MM-DD → 표시 YYYY/MM/DD
  const display = value ? value.replace(/-/g,'/') : '';
  return `<input type="text" inputmode="numeric" placeholder="YYYY/MM/DD"
    value="${display}"
    data-cb="${escaped}"
    style="max-width:110px;font-family:var(--mono);"
    oninput="dateTextInput(this)"
    onblur="dateTextBlur(this)"
    ${attrs}>`;
}

function _parseDateText(raw){
  // YYYY/MM/DD 또는 YYYYMMDD → YYYY-MM-DD
  const s = raw.replace(/[\/\-\s]/g,'');
  if(s.length === 8){
    return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  }
  return null;
}

function dateTextInput(el){
  // 숫자만 추출
  let digits = el.value.replace(/[^0-9]/g,'');
  // 최대 8자리
  if(digits.length > 8) digits = digits.slice(0,8);
  // YYYY/MM/DD 포맷으로 재조합
  let formatted = digits;
  if(digits.length > 4) formatted = digits.slice(0,4) + '/' + digits.slice(4);
  if(digits.length > 6) formatted = digits.slice(0,4) + '/' + digits.slice(4,6) + '/' + digits.slice(6);
  el.value = formatted;
  // 8자리 완성 시 디바운스 없이 즉시 반영
  if(digits.length === 8){
    if(_debMap.has(el)){ clearTimeout(_debMap.get(el)); _debMap.delete(el); }
    const iso = _parseDateText(formatted);
    if(iso) _execCb(el.dataset.cb, iso);
    return;
  }
  if(_debMap.has(el)) clearTimeout(_debMap.get(el));
  _debMap.set(el, setTimeout(()=>{
    const iso = _parseDateText(el.value);
    if(iso) _execCb(el.dataset.cb, iso);
  }, 1000));
}

function dateTextBlur(el){
  if(_debMap.has(el)){ clearTimeout(_debMap.get(el)); _debMap.delete(el); }
  const iso = _parseDateText(el.value);
  if(iso) _execCb(el.dataset.cb, iso);
}

// 소수점 숫자(금리, 배당률 등) — 1000ms 디바운스
function mkNumDec(value, cbStr, attrs=''){
  const escaped = cbStr.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return `<input type="text" inputmode="decimal" value="${value||''}" placeholder="0.0"
    data-cb="${escaped}"
    onfocus="this.select()"
    oninput="nInputText(this)"
    onblur="nBlurText(this)"
    ${attrs}>`;
}

function nInputText(el){
  if(_debMap.has(el)) clearTimeout(_debMap.get(el));
  _debMap.set(el, setTimeout(()=>{ _execCb(el.dataset.cb, el.value); }, 1000));
}
function nBlurText(el){
  if(_debMap.has(el)){ clearTimeout(_debMap.get(el)); _debMap.delete(el); }
  _execCb(el.dataset.cb, el.value);
}

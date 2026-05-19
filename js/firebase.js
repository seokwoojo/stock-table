// ─────────────── FIREBASE CONFIG ───────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCN8LB25xN24v_9lJdvrWs_Yl0znT4190M",
  authDomain:        "stock-dashboard-ed29b.firebaseapp.com",
  projectId:         "stock-dashboard-ed29b",
  storageBucket:     "stock-dashboard-ed29b.firebasestorage.app",
  messagingSenderId: "308249338868",
  appId:             "1:308249338868:web:279127840b7817eec5cfa1"
};

// ─────────────── FIREBASE 초기화 ───────────────
import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

// ─────────────── 로그인 / 로그아웃 ───────────────
async function googleLogin() {
  try {
    await signInWithPopup(auth, provider);
  } catch(e) {
    showToast('❌ 로그인 실패: ' + e.message);
    console.error(e);
  }
}

async function googleLogout() {
  await signOut(auth);
  showToast('👋 로그아웃됨');
}

// ─────────────── Firebase 저장 ───────────────
async function saveToFirebase() {
  if (!currentUser) { showToast('⚠️ 로그인이 필요합니다'); return; }
  try {
    const data = {
      salary:     document.getElementById('salary')?.value    || '',
      projRate:   document.getElementById('proj-rate')?.value || '',
      savings:    state.savings,
      portfolios: state.portfolios,
      maturity:   state.maturity,
      gasUrl:     state.gasUrl,
      memo:       state.memo || '',
      deletedFixedTypes: state.deletedFixedTypes || [],
      idCnt,
      updatedAt:  new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', currentUser.uid), data);
    showToast('☁️ 클라우드 저장됨');
  } catch(e) {
    showToast('❌ 저장 실패: ' + e.message);
    console.error(e);
  }
}

// ─────────────── Firebase 불러오기 ───────────────
async function loadFromFirebase() {
  if (!currentUser) return;

  // 로그인 시 state 완전 초기화 (다른 계정 데이터 방지)
  state.savings    = [];
  state.portfolios = [];
  state.maturity   = [];
  state.memo       = '';
  state.deletedFixedTypes = [];
  idCnt            = 1;

  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    if (!snap.exists()) {
      // 이 계정의 Firebase 데이터가 없음 → 빈 상태로 시작
      if(typeof initDefaultSavings === 'function') initDefaultSavings();
      showToast('👋 새 계정입니다. 데이터를 입력해주세요.');
      return;
    }
    const data = snap.data();
    const salEl = document.getElementById('salary');
    const prEl  = document.getElementById('proj-rate');
    if(salEl && data.salary)    salEl.value   = data.salary;
    if(prEl  && data.projRate)  prEl.value    = data.projRate;
    if(data.savings)           state.savings           = data.savings;
    if(data.portfolios)        state.portfolios        = data.portfolios;
    if(data.maturity)          state.maturity          = data.maturity;
    if(data.gasUrl)            state.gasUrl            = data.gasUrl;
    if(data.memo)              state.memo              = data.memo;
    if(data.deletedFixedTypes) state.deletedFixedTypes = data.deletedFixedTypes;
    if(data.idCnt)             idCnt                   = data.idCnt;

    // 구버전 타입명 마이그레이션
    const typeMap = { '과세연금저축':'과세 연금저축', '비과세연금저축':'비과세 연금저축' };
    state.savings.forEach(s    => { if(typeMap[s.type]) s.type = typeMap[s.type]; });
    state.portfolios.forEach(p => { if(typeMap[p.type]) p.type = typeMap[p.type]; });

    showToast('☁️ 클라우드에서 불러옴');
  } catch(e) {
    showToast('❌ 불러오기 실패: ' + e.message);
    console.error(e);
  }
}

// ─────────────── 자동 저장 ───────────────
let fbSaveTimer = null;
function scheduleFirebaseSave() {
  clearTimeout(fbSaveTimer);
  fbSaveTimer = setTimeout(() => {
    saveToFirebase();
    saveToStorage();
  }, 2000);
}

// ─────────────── UI 업데이트 ───────────────
function updateAuthUI(user) {
  const loginScreen = document.getElementById('login-screen');
  const mainContent = document.getElementById('main-content');
  const logoutBtn   = document.getElementById('auth-logout-btn');
  const userInfo    = document.getElementById('auth-user-info');
  const avatar      = document.getElementById('auth-avatar');

  if (user) {
    if(loginScreen) loginScreen.style.display = 'none';
    if(mainContent) mainContent.style.display = 'block';
    if(logoutBtn)   logoutBtn.style.display   = 'inline-flex';
    if(userInfo)    userInfo.textContent       = user.displayName || user.email;
    if(avatar && user.photoURL) { avatar.src = user.photoURL; avatar.style.display = 'block'; }
  } else {
    if(loginScreen) loginScreen.style.display = 'flex';
    if(mainContent) mainContent.style.display = 'none';
    if(logoutBtn)   logoutBtn.style.display   = 'none';
    if(userInfo)    userInfo.textContent       = '';
    if(avatar)      avatar.style.display       = 'none';
  }
}

// ─────────────── 인증 상태 감지 ───────────────
onAuthStateChanged(auth, async user => {
  currentUser = user;
  updateAuthUI(user);
  if (user) {
    // 완전 초기화 후 Firebase 로드
    state.savings = []; state.portfolios = []; state.maturity = [];
    state.memo = ''; idCnt = 1;
    await loadFromFirebase();
    renderAll();
    if(state.gasUrl) setTimeout(() => refreshAllPrices(), 1500);
    setTimeout(() => renderSnapshotButtons(), 2000);
    setTimeout(() => loadFearGreed(), 1000);
    checkYearEndSnapshot();
  }
});

// ─────────────── 전역 노출 ───────────────
window.googleLogin          = googleLogin;
window.googleLogout         = googleLogout;
window.saveToFirebase       = saveToFirebase;
window.scheduleFirebaseSave = scheduleFirebaseSave;

// ─────────────── 연도별 스냅샷 ───────────────
async function saveYearSnapshot(year){
  if(!currentUser){ showToast('⚠️ 로그인이 필요합니다'); return; }
  try {
    const data = {
      year,
      savedAt:    new Date().toISOString(),
      salary:     document.getElementById('salary')?.value || '',
      savings:    state.savings,
      portfolios: state.portfolios,
      maturity:   state.maturity,
      memo:       state.memo || '',
      idCnt,
    };
    await setDoc(doc(db, 'users', currentUser.uid, 'snapshots', String(year)), data);
    showToast(`✅ ${year}년 스냅샷 저장됨`);
    renderSnapshotButtons();
  } catch(e) {
    showToast('❌ 스냅샷 저장 실패: ' + e.message);
  }
}

async function loadYearSnapshot(year){
  if(!currentUser) return;
  if(!confirm(`${year}년 데이터를 불러올까요?\n현재 데이터는 변경되지 않습니다. (읽기 전용 미리보기)`)) return;
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid, 'snapshots', String(year)));
    if(!snap.exists()){ showToast(`❌ ${year}년 스냅샷이 없습니다`); return; }
    const data = snap.data();
    // 임시로 state에 로드 (현재 데이터 백업)
    window._backupState = JSON.parse(JSON.stringify({
      savings: state.savings, portfolios: state.portfolios,
      maturity: state.maturity, memo: state.memo
    }));
    window._isPreview = year;
    if(data.savings)    state.savings    = data.savings;
    if(data.portfolios) state.portfolios = data.portfolios;
    if(data.maturity)   state.maturity   = data.maturity;
    if(data.memo)       state.memo       = data.memo;
    const salEl = document.getElementById('salary');
    if(salEl && data.salary) salEl.value = data.salary;
    renderAll();
    showToast(`📅 ${year}년 데이터 미리보기 중... [현재로 돌아가기] 버튼으로 복원하세요`);
    renderSnapshotButtons();
  } catch(e) {
    showToast('❌ 불러오기 실패: ' + e.message);
  }
}

function restoreCurrentData(){
  if(!window._backupState) return;
  state.savings    = window._backupState.savings;
  state.portfolios = window._backupState.portfolios;
  state.maturity   = window._backupState.maturity;
  state.memo       = window._backupState.memo;
  window._backupState = null;
  window._isPreview   = null;
  renderAll();
  showToast('✅ 현재 데이터로 복원됨');
  renderSnapshotButtons();
}

async function renderSnapshotButtons(){
  const wrap = document.getElementById('snapshot-btns');
  if(!wrap || !currentUser) return;
  try {
    // 스냅샷 목록 조회 (간단히 최근 5년 체크)
    const currentYear = new Date().getFullYear();
    const years = [];
    for(let y = currentYear; y >= currentYear - 4; y--){
      const snap = await getDoc(doc(db, 'users', currentUser.uid, 'snapshots', String(y)));
      if(snap.exists()) years.push(y);
    }
    const isPreview = window._isPreview;
    wrap.innerHTML = years.map(y =>
      `<button onclick="${isPreview===y?'restoreCurrentData()':'loadYearSnapshot('+y+')'}"
        style="font-family:var(--mono);font-size:11px;padding:4px 10px;border-radius:2px;cursor:pointer;
               background:${isPreview===y?'var(--accent)':'var(--surface2)'};
               color:${isPreview===y?'var(--bg)':'var(--text3)'};
               border:1px solid ${isPreview===y?'var(--accent)':'var(--border)'};">
        ${isPreview===y?'현재로':''}${y}년
      </button>`
    ).join('');
    if(isPreview){
      wrap.innerHTML += `<button onclick="restoreCurrentData()"
        style="font-family:var(--mono);font-size:11px;padding:4px 10px;border-radius:2px;cursor:pointer;
               background:var(--red-dim);color:var(--red);border:1px solid rgba(255,82,82,0.3);">
        현재로 돌아가기
      </button>`;
    }
  } catch(e){ console.error(e); }
}

// 매년 12월 31일 자동 스냅샷
async function checkYearEndSnapshot(){
  const now = new Date();
  if(now.getMonth()===11 && now.getDate()===31){
    const year = now.getFullYear();
    const snap = await getDoc(doc(db, 'users', currentUser.uid, 'snapshots', String(year)));
    if(!snap.exists()){
      await saveYearSnapshot(year);
    }
  }
}
window.saveYearSnapshot   = saveYearSnapshot;
window.loadYearSnapshot   = loadYearSnapshot;
window.restoreCurrentData = restoreCurrentData;
window.renderSnapshotButtons = renderSnapshotButtons;

// ─────────────── Fear & Greed ───────────────
async function loadFearGreed() {
  try {
    // 가장 최근 문서 1개 조회
    const q = query(
      collection(db, 'fear_greed_reports'),
      orderBy('created_at', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if(snapshot.empty) return;

    const data = snapshot.docs[0].data();

    // 색상 매핑
    const colorMap = {
      '극도의 공포': '#4fc3f7',
      '공포':        '#81c784',
      '중립':        '#ffd54f',
      '탐욕':        '#ff8a65',
      '극도의 탐욕': '#ef5350',
    };
    const color = colorMap[data.rating] || 'var(--text2)';

    // 배지
    const badge = document.getElementById('fg-score-badge');
    if(badge){
      badge.textContent = `${data.score} ${data.rating}`;
      badge.style.background = color + '22';
      badge.style.color = color;
      badge.style.border = `1px solid ${color}44`;
    }

    // 날짜
    const dateEl = document.getElementById('fg-date');
    if(dateEl) dateEl.textContent = data.date || '';

    // 두 줄 요약
    const summaryEl = document.getElementById('fg-summary');
    if(summaryEl) summaryEl.textContent = data.summary || '';

    // 전체 리포트
    const reportEl = document.getElementById('fg-report-content');
    if(reportEl) reportEl.textContent = data.report || '';

    // 섹션 표시
    const section = document.getElementById('fear-greed-section');
    if(section) section.style.display = 'block';

  } catch(e) {
    console.error('Fear & Greed 로드 실패:', e);
  }
}

function toggleFearGreedReport() {
  const full = document.getElementById('fg-full-report');
  const btn  = document.getElementById('fg-toggle-btn');
  if(!full) return;
  const isOpen = full.style.display !== 'none';
  full.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '자세히 보기' : '접기';
}

window.toggleFearGreedReport = toggleFearGreedReport;

// ─────────────── Fear & Greed (CNN API + Claude) ───────────────
const CNN_FG_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata/';
const RATING_KR_FG = {
  'extreme fear': '극도의 공포',
  'fear':         '공포',
  'neutral':      '중립',
  'greed':        '탐욕',
  'extreme greed':'극도의 탐욕',
};

// Anthropic API 키를 Firebase에서 가져오기
async function getAnthropicKey() {
  try {
    const snap = await getDoc(doc(db, 'config', 'api_keys'));
    if(!snap.exists()) throw new Error('API 키가 없습니다');
    return snap.data().anthropic_key;
  } catch(e) {
    throw new Error('Anthropic API 키 로드 실패: ' + e.message);
  }
}

// RapidAPI 키를 Firebase에서 가져오기
async function getRapidApiKey() {
  try {
    const snap = await getDoc(doc(db, 'config', 'api_keys'));
    if(!snap.exists()) throw new Error('RapidAPI 키가 없습니다');
    return snap.data().rapidapi_key;
  } catch(e) {
    throw new Error('RapidAPI 키 로드 실패: ' + e.message);
  }
}

// CNN Fear & Greed API 호출 (RapidAPI 경유 — CORS 허용, 7개 세부지표 포함)
async function fetchCNNFearGreed(rapidApiKey) {
  const res = await fetch('https://fear-and-greed-index.p.rapidapi.com/v1/fgi', {
    headers: {
      'x-rapidapi-host': 'fear-and-greed-index.p.rapidapi.com',
      'x-rapidapi-key':  rapidApiKey
    }
  });
  if(!res.ok) throw new Error('RapidAPI 오류: ' + res.status);
  return res.json();
}

// 데이터 파싱 (RapidAPI fear-and-greed-index)
function parseFearGreed(raw) {
  const fg = raw.fgi;
  const score        = Math.round(fg.now.value * 10) / 10;
  const ratingEn     = (fg.now.valueText || '').toLowerCase();
  const rating       = RATING_KR_FG[ratingEn] || fg.now.valueText;
  const prev_close   = Math.round(fg.previousClose.value * 10) / 10;
  const prev_1_week  = Math.round(fg.oneWeekAgo.value * 10) / 10;
  const prev_1_month = Math.round(fg.oneMonthAgo.value * 10) / 10;
  const prev_1_year  = Math.round(fg.oneYearAgo.value * 10) / 10;

  return { score, rating, prev_close, prev_1_week, prev_1_month, prev_1_year };
}

// Claude API 호출
async function callClaudeForFG(d, apiKey) {
  const diff    = Math.round((d.score - d.prev_close) * 10) / 10;
  const diffStr = diff >= 0 ? `▲${diff}` : `▼${Math.abs(diff)}`;

  const prompt = `당신은 미국 주식시장 심리 분석 전문가입니다.
오늘의 Fear & Greed Index 데이터를 바탕으로 한국어 시장 리포트를 작성해주세요.

[오늘 데이터]
- 현재 점수: ${d.score}점 (${d.rating})
- 전일 대비: ${d.prev_close} → ${d.score} (${diffStr})
- 1주 전: ${d.prev_1_week}점 / 1개월 전: ${d.prev_1_month}점 / 1년 전: ${d.prev_1_year}점

[점수 기준]
0~24: 극도의 공포 / 25~44: 공포 / 45~55: 중립 / 56~75: 탐욕 / 76~100: 극도의 탐욕

[분석 요청]
1. 현재 점수와 등급의 의미 해석
2. 전일/1주/1개월/1년 추세 방향성 분석
3. 이 심리 구간에서 역사적으로 시장이 어떻게 움직였는지
4. 현재 투자자들이 주의해야 할 점

[작성 형식]
맨 앞에 두 줄 요약 후 --- 이후 전체 리포트:
📊 [첫째 줄 요약]
📈 [둘째 줄 요약]
---
(전체 리포트)

[주의사항]
- 투자 권유 금지, 시장 심리 분석만
- 이모지/볼드체 사용, 마크다운 헤더(##) 금지
- 읽기 편한 톤으로 작성`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const json = await res.json();
  if(json.error) throw new Error(json.error.message);
  return json.content[0].text;
}

// Firestore에 저장
async function saveFGToFirestore(data, report) {
  const parts      = report.split('---');
  const summary    = parts.length > 1 ? parts[0].trim() : '';
  const fullReport = parts.length > 1 ? parts[1].trim() : report;
  const today      = new Date().toISOString().slice(0, 10);

  await setDoc(doc(db, 'fear_greed_reports', today), {
    score:      data.score,
    rating:     data.rating,
    summary,
    report:     fullReport,
    date:       today,
    created_at: new Date().toISOString(),
  });
}

// 메인 실행 함수 (버튼에서 호출)
async function updateFearGreed() {
  showToast('📡 CNN Fear & Greed 데이터 수집 중...');
  try {
    const [raw, apiKey] = await Promise.all([
      getRapidApiKey().then(key => fetchCNNFearGreed(key)),
      getAnthropicKey()
    ]);
    const data = parseFearGreed(raw);
    showToast(`✍️ Claude 리포트 생성 중... (${data.score}점 / ${data.rating})`);
    const report = await callClaudeForFG(data, apiKey);
    await saveFGToFirestore(data, report);
    await loadFearGreed();
    showToast('✅ Fear & Greed 리포트 업데이트 완료!');
  } catch(e) {
    showToast('❌ 오류: ' + e.message);
    console.error(e);
  }
}

window.updateFearGreed = updateFearGreed;

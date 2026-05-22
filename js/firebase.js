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

    if(snapshot.empty) {
      const kstHour = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Seoul'})).getHours();
      const btn = document.getElementById('fg-update-btn');
      if(btn) {
        if(kstHour < 6) {
          btn.disabled = true; btn.style.opacity = '0.4';
          btn.style.cursor = 'not-allowed'; btn.textContent = '⏰ 6시 이후 가능';
        } else {
          btn.disabled = false; btn.style.opacity = '1';
          btn.style.cursor = 'pointer'; btn.textContent = '🔄 업데이트';
        }
      }
      return;
    }

    const data = snapshot.docs[0].data();

    // 버튼 활성화 여부 결정
    const today = new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date().getDay(); // 0=일, 6=토
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // 이번 주 금요일 날짜 계산
    const now = new Date();
    const diffToFri = (dayOfWeek === 0) ? -2 : (dayOfWeek === 6) ? -1 : 0;
    const friday = new Date(now);
    friday.setDate(now.getDate() + diffToFri);
    const fridayStr = friday.toISOString().slice(0, 10);

    const btn = document.getElementById('fg-update-btn');
    if(btn) {
      if(isWeekend && data.date === fridayStr) {
        // 주말인데 금요일 데이터 있음 → 비활성화
        btn.disabled = true; btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed'; btn.textContent = '✅ 이번 주 완료';
      } else if(!isWeekend && data.date === today) {
        // 평일인데 오늘 데이터 있음 → 비활성화
        btn.disabled = true; btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed'; btn.textContent = '✅ 오늘 완료';
      } else {
        // 오전 6시 이후만 활성화 (KST)
        const kstHour = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Seoul'})).getHours();
        if(kstHour < 6) {
          btn.disabled = true; btn.style.opacity = '0.4';
          btn.style.cursor = 'not-allowed'; btn.textContent = '⏰ 6시 이후 가능';
        } else {
          btn.disabled = false; btn.style.opacity = '1';
          btn.style.cursor = 'pointer'; btn.textContent = '🔄 업데이트';
        }
      }
    }

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
async function callClaudeForFG(d, apiKey, history=[]) {
  const diff    = Math.round((d.score - d.prev_close) * 10) / 10;
  const diffStr = diff >= 0 ? `▲${diff}` : `▼${Math.abs(diff)}`;

  const historyText = history.length > 0
    ? `\n[Firebase 누적 히스토리 — 실제 저장된 ${history.length}일 데이터 (최신순)]\n` +
      history.map(h => `${h.date}: ${h.score}점 (${h.rating})`).join('\n')
    : '\n[누적 히스토리: 아직 쌓이지 않음 — RapidAPI 기준점 데이터만 활용]';

  const prompt = `당신은 미국 주식시장 심리 분석 전문가입니다.
오늘의 Fear & Greed Index 데이터를 바탕으로 한국어 시장 리포트를 작성해주세요.

[오늘 데이터 — RapidAPI 실시간]
- 현재 점수: ${d.score}점 (${d.rating})
- 전일 대비: ${d.prev_close}점 → ${d.score}점 (${diffStr})
- 1주 전: ${d.prev_1_week}점 / 1개월 전: ${d.prev_1_month}점 / 1년 전: ${d.prev_1_year}점
${historyText}

※ Firebase 누적 히스토리가 있으면 RapidAPI 기준점보다 우선 활용하여 실제 추세를 분석하세요.

[점수 기준]
0~24: 극도의 공포 / 25~44: 공포 / 45~55: 중립 / 56~75: 탐욕 / 76~100: 극도의 탐욕

[분석 요청]
1. 현재 점수와 등급의 의미 해석
2. 누적 히스토리 기반 실제 추세 분석 (있을 경우 우선 활용)
3. 전일/1주/1개월/1년 추세 방향성
4. 이 심리 구간에서 역사적으로 시장이 어떻게 움직였는지
5. 현재 투자자들이 주의해야 할 점

[주요 매크로 데이터 검색]
웹 검색으로 오늘(${new Date().toISOString().slice(0,10)}) 기준 최신 데이터를 검색하세요.
검색 과정은 출력하지 말고 결과만 리포트에 포함하세요.
- 미국 10년 국채 금리 (%)
- 미국 30년 국채 금리 (%)
- 달러 인덱스 (DXY)
- VIX 지수
- 금 가격 ($/oz)
- WTI 원유 ($/배럴)

[주요 경제 이슈 검색]
웹 검색으로 오늘 기준 국내외 주요 경제 이슈를 찾아서 중복 없이 5개를 선별하세요.
각 이슈마다 한 줄 요약과 시장에 미치는 영향을 📈 긍정 / 📉 부정 / ➡️ 중립으로 표시하세요.
국내(한국) 이슈와 글로벌 이슈를 균형있게 포함하세요.

[작성 형식]
맨 앞에 두 줄 요약 후 --- 이후 전체 리포트:
📊 [첫째 줄 요약]
📈 [둘째 줄 요약]
---
**📊 주요 매크로 지표**
| 지표 | 현재값 | 전일 대비 |
|------|--------|-----------|
| 미국 10년 국채 | X.XX% | ▲/▼ |
| 미국 30년 국채 | X.XX% | ▲/▼ |
| 달러 인덱스 | XXX.X | ▲/▼ |
| VIX | XX.X | ▲/▼ |
| 금 | $X,XXX | ▲/▼ |
| WTI 원유 | $XX.X | ▲/▼ |

**📰 주요 경제 이슈 (5개)**
1. [이슈명] 📈/📉/➡️
   → [한 줄 설명 + 시장 영향]
...

**😱 Fear & Greed 지수 분석**
- 현재 점수와 등급이 무엇을 의미하는지
- 전일/1주/1개월/1년 추세를 보고 심리가 어느 방향으로 흐르고 있는지
- 누적 히스토리가 있다면 실제 추세 흐름 분석
- 이 점수대에서 역사적으로 시장이 어떻게 움직였는지 (반등? 추가 하락?)
- 현재 심리 구간에서 투자자들이 주의해야 할 점

**🔗 매크로 × 경제 이슈 × Fear & Greed 종합 분석**
- 금리/달러/VIX 등 매크로 지표가 현재 공포지수에 어떤 영향을 미쳤는지
- 5개 경제 이슈가 매크로 흐름과 어떻게 연결되는지
- 긍정/부정 이슈들이 서로 상충할 경우 어느 쪽이 더 강한 영향을 줄지
- 앞으로 공포지수가 어떻게 움직일지 추론

[주의사항]
- 전체 리포트는 반드시 4000토큰 이내로 작성하세요 (잘리지 않도록)
- 투자 권유 금지, 시장 심리 분석만
- 이모지/볼드체 사용, 마크다운 헤더(##) 금지
- 읽기 편한 톤으로 작성
- 점수 수치는 반드시 위 데이터에 있는 값만 그대로 사용할 것 (임의로 바꾸지 말 것)
- 검색 과정("검색하겠습니다" 등)은 절대 출력하지 말 것, 결과만 작성할 것`;

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
      max_tokens: 6000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const json = await res.json();
  if(json.error) throw new Error(json.error.message);
  // tool_use/tool_result 블록 제외하고 마지막 text만 추출
  const textBlocks = json.content.filter(b => b.type === 'text');
  if(!textBlocks.length) throw new Error('리포트 생성 실패');
  // 마지막 text 블록이 최종 리포트
  return textBlocks[textBlocks.length - 1].text;
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

async function updateFearGreed() {
  const btn = document.getElementById('fg-update-btn');
  showToast('📊 Fear & Greed 확인 중...');
  try {
    // 오늘 이미 리포트가 있으면 스킵
    const today = new Date().toISOString().slice(0, 10);
    const existing = await getDoc(doc(db, 'fear_greed_reports', today));
    if(existing.exists()) {
      showToast('📊 오늘 리포트가 이미 있습니다');
      await loadFearGreed();
      return;
    }

    // 버튼 즉시 비활성화
    if(btn) { btn.disabled = true; btn.style.opacity = '0.4'; btn.textContent = '생성 중...'; }

    const [raw, anthropicKey] = await Promise.all([
      getRapidApiKey().then(key => fetchCNNFearGreed(key)),
      getAnthropicKey()
    ]);
    const data = parseFearGreed(raw);

    // Firebase에서 최근 30일 히스토리 읽기
    const historySnap = await getDocs(
      query(collection(db, 'fear_greed_reports'), orderBy('date', 'desc'), limit(30))
    );
    const history = historySnap.docs.map(d => ({
      date:  d.data().date,
      score: d.data().score,
      rating: d.data().rating,
    }));

    showToast(`✍️ Claude 리포트 생성 중... (${data.score}점 / ${data.rating})`);
    const report = await callClaudeForFG(data, anthropicKey, history);
    await saveFGToFirestore(data, report);
    await loadFearGreed();
    showToast('✅ Fear & Greed 리포트 업데이트 완료!');
  } catch(e) {
    showToast('❌ 오류: ' + e.message);
    console.error(e);
    if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = '🔄 업데이트'; }
  }
}

window.updateFearGreed       = updateFearGreed;
window.loadFearGreed         = loadFearGreed;
window.toggleFearGreedReport = toggleFearGreedReport;

// 오늘 데이터 강제 재생성 (관리자용)
window.forceUpdateFearGreed = async function() {
  const today = new Date().toISOString().slice(0, 10);
  // 오늘 문서 삭제 후 재생성
  try {
    const { deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await deleteDoc(doc(db, 'fear_greed_reports', today));
    showToast('🗑️ 오늘 데이터 삭제됨. 재생성 중...');
    await loadFearGreed();
    await updateFearGreed();
  } catch(e) {
    showToast('❌ ' + e.message);
  }
};

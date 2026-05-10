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
import { getFirestore, doc, setDoc, getDoc }
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
      savings:    state.savings,
      portfolios: state.portfolios,
      maturity:   state.maturity,
      gasUrl:     state.gasUrl,
      memo:       state.memo || '',
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
    if(salEl && data.salary)    salEl.value   = data.salary;
    if(data.savings)    state.savings    = data.savings;
    if(data.portfolios) state.portfolios = data.portfolios;
    if(data.maturity)   state.maturity   = data.maturity;
    if(data.gasUrl)     state.gasUrl     = data.gasUrl;
    if(data.memo)       state.memo       = data.memo;
    if(data.idCnt)      idCnt            = data.idCnt;

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
    await loadFromFirebase();
    renderAll();
    if(state.gasUrl) setTimeout(() => refreshAllPrices(), 1500);
    setTimeout(() => renderSnapshotButtons(), 2000);
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

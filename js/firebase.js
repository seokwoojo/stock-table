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
      baseMonth:  document.getElementById('baseMonth')?.value || '',
      savings:    state.savings,
      portfolios: state.portfolios,
      maturity:   state.maturity,
      gasUrl:     state.gasUrl,
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
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    if (!snap.exists()) {
      const hasLocal = loadFromStorage();
      if (hasLocal) {
        await saveToFirebase();
        showToast('💾 기존 데이터를 클라우드에 업로드했습니다');
      } else {
        if(typeof initDefaultSavings === 'function') initDefaultSavings();
      }
      return;
    }
    const data = snap.data();
    const salEl = document.getElementById('salary');
    const bmEl  = document.getElementById('baseMonth');
    if(salEl && data.salary)    salEl.value   = data.salary;
    if(bmEl  && data.baseMonth) bmEl.value    = data.baseMonth;
    if(data.savings)    state.savings    = data.savings;
    if(data.portfolios) state.portfolios = data.portfolios;
    if(data.maturity)   state.maturity   = data.maturity;
    if(data.gasUrl)     state.gasUrl     = data.gasUrl;
    if(data.idCnt)      idCnt            = data.idCnt;

    // 구버전 타입명 마이그레이션
    const typeMap = { '과세연금저축':'과세 연금저축', '비과세연금저축':'비과세 연금저축' };
    state.savings.forEach(s    => { if(typeMap[s.type]) s.type = typeMap[s.type]; });
    state.portfolios.forEach(p => { if(typeMap[p.type]) p.type = typeMap[p.type]; });

    showToast('☁️ 클라우드에서 불러옴');
  } catch(e) {
    showToast('❌ 불러오기 실패: ' + e.message);
    console.error(e);
    loadFromStorage();
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
  }
});

// ─────────────── 전역 노출 ───────────────
window.googleLogin          = googleLogin;
window.googleLogout         = googleLogout;
window.saveToFirebase       = saveToFirebase;
window.scheduleFirebaseSave = scheduleFirebaseSave;

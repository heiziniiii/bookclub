// auth.js — 공간일기 멤버 인증 모듈
// PIN은 Firebase book-club/pins 에서 로드, 없으면 fallback 사용

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCjtgMykJPKnsAORcfgQ9FxbPnzNEj_fEc",
  authDomain: "book-56493.firebaseapp.com",
  databaseURL: "https://book-56493-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "book-56493",
  storageBucket: "book-56493.firebasestorage.app",
  messagingSenderId: "900836361804",
  appId: "1:900836361804:web:17d21b68011427a7e796e9"
};

// Firebase 중복 초기화 방지
const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const db = getDatabase(app);

export const MEMBERS = ["진협", "수화", "애리", "유영", "혜진"];
const ADMIN_MEMBER = "혜진";
const SESSION_KEY = "gonggan-session";

// Fallback PINs (Firebase에 pins 노드가 없을 때 사용)
const FALLBACK_PINS = {
  "진협": "1234",
  "수화": "2345",
  "애리": "3456",
  "유영": "4567",
  "혜진": "0000"
};

// ── 세션 헬퍼 ──────────────────────────────────────────────
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setSession(member, role) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ member, role }));
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  refreshAuthUI();
}

export function isAdmin() {
  const s = getSession();
  return !!(s && s.role === "admin");
}

export function isMember(name) {
  const s = getSession();
  return !!(s && s.member === name);
}

export function isLoggedIn() {
  return getSession() !== null;
}

// ── PIN 로드 (Firebase → fallback) ────────────────────────
async function loadPins() {
  try {
    const snap = await get(ref(db, "book-club/pins"));
    if (snap.exists()) return snap.val();
  } catch {}
  return FALLBACK_PINS;
}

// ── 로그인 ─────────────────────────────────────────────────
export async function login(member, pin) {
  const pins = await loadPins();
  if (!pins[member]) return false;
  if (String(pins[member]) !== String(pin)) return false;
  const role = (member === ADMIN_MEMBER) ? "admin" : "member";
  setSession(member, role);
  refreshAuthUI();
  return true;
}

// ── 공통 UI 갱신 ───────────────────────────────────────────
export function refreshAuthUI() {
  const session = getSession();
  const badge   = document.getElementById("auth-badge");
  if (!badge) return;

  if (session) {
    const roleTag = session.role === "admin" ? " · 관리자" : "";
    badge.innerHTML = `
      <span class="auth-name">${session.member}${roleTag}</span>
      <button class="auth-logout" id="auth-logout-btn">로그아웃</button>`;
    document.getElementById("auth-logout-btn")?.addEventListener("click", () => {
      logout();
      location.reload();
    });
  } else {
    badge.innerHTML = `<button class="auth-login-trigger" id="auth-login-trigger">로그인</button>`;
    document.getElementById("auth-login-trigger")?.addEventListener("click", () => showLoginModal());
  }

  // admin-only 요소 표시/숨김
  document.querySelectorAll("[data-auth='admin']").forEach(el => {
    el.style.display = isAdmin() ? "" : "none";
  });
  // logged-in-only 요소
  document.querySelectorAll("[data-auth='member']").forEach(el => {
    el.style.display = isLoggedIn() ? "" : "none";
  });
}

// ── 로그인 모달 ────────────────────────────────────────────
let modalEl = null;
let resolveLogin = null;

export function showLoginModal(onSuccess) {
  if (modalEl) return;

  modalEl = document.createElement("div");
  modalEl.id = "auth-modal-overlay";
  modalEl.innerHTML = `
    <div class="auth-modal">
      <div class="auth-modal-logo">
        <span class="auth-modal-ko">공간일기</span>
        <span class="auth-modal-en">GONGGAN DIARY</span>
      </div>
      <h2 class="auth-modal-title">로그인</h2>

      <div class="auth-member-grid" id="auth-member-grid">
        ${MEMBERS.map(m => `<button class="auth-member-btn" data-name="${m}">${m}</button>`).join("")}
      </div>

      <div class="auth-pin-row">
        <label class="auth-pin-label">PIN</label>
        <input type="password" inputmode="numeric" maxlength="4" id="auth-pin-input"
               class="auth-pin-input" placeholder="••••" autocomplete="off">
      </div>

      <p class="auth-error" id="auth-error"></p>

      <button class="auth-submit-btn" id="auth-submit-btn">로그인</button>

      <button class="auth-close-btn" id="auth-close-btn" aria-label="닫기">×</button>
    </div>`;

  document.body.appendChild(modalEl);

  let selectedMember = null;

  // 이름 선택
  modalEl.querySelectorAll(".auth-member-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      modalEl.querySelectorAll(".auth-member-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedMember = btn.dataset.name;
      document.getElementById("auth-pin-input").focus();
    });
  });

  // 로그인 실행
  async function doLogin() {
    const pin = document.getElementById("auth-pin-input").value.trim();
    const errorEl = document.getElementById("auth-error");
    if (!selectedMember) { errorEl.textContent = "이름을 선택해주세요"; return; }
    if (!pin) { errorEl.textContent = "PIN을 입력해주세요"; return; }

    const btn = document.getElementById("auth-submit-btn");
    btn.textContent = "확인 중...";
    btn.disabled = true;

    const ok = await login(selectedMember, pin);
    if (ok) {
      closeModal();
      if (onSuccess) onSuccess(getSession());
      else location.reload();
    } else {
      errorEl.textContent = "PIN이 올바르지 않아요";
      document.getElementById("auth-pin-input").value = "";
      btn.textContent = "로그인";
      btn.disabled = false;
    }
  }

  document.getElementById("auth-submit-btn").addEventListener("click", doLogin);
  document.getElementById("auth-pin-input").addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });
  document.getElementById("auth-close-btn").addEventListener("click", closeModal);
  modalEl.addEventListener("click", e => { if (e.target === modalEl) closeModal(); });
}

function closeModal() {
  if (modalEl) { modalEl.remove(); modalEl = null; }
}

// ── 공통 스타일 주입 ───────────────────────────────────────
(function injectStyles() {
  if (document.getElementById("auth-styles")) return;
  const style = document.createElement("style");
  style.id = "auth-styles";
  style.textContent = `
    /* Auth badge in header */
    #auth-badge {
      display: flex; align-items: center; gap: 10px;
    }
    .auth-name {
      font-size: 13px; font-weight: 400;
      color: var(--accent-green, #2D5A3D);
    }
    .auth-logout {
      font-size: 12px; color: var(--text-muted, #999993);
      border: 1px solid var(--accent-line, rgba(45,90,61,0.12));
      border-radius: 999px; padding: 4px 12px;
      transition: background 0.18s, color 0.18s;
      background: none; cursor: pointer; font-family: inherit;
    }
    .auth-logout:hover { background: rgba(45,90,61,0.06); color: var(--text-primary, #0F0F0E); }
    .auth-login-trigger {
      font-size: 13px; font-weight: 400;
      color: var(--accent-green, #2D5A3D);
      border: 1px solid rgba(45,90,61,0.3);
      border-radius: 999px; padding: 6px 16px;
      transition: background 0.18s, color 0.18s;
      background: none; cursor: pointer; font-family: inherit;
    }
    .auth-login-trigger:hover { background: var(--accent-green, #2D5A3D); color: #fff; }

    /* Modal overlay */
    #auth-modal-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(15,15,14,0.55);
      backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
    }
    .auth-modal {
      background: #fff;
      border-radius: 20px;
      padding: 40px 36px;
      width: min(420px, calc(100vw - 32px));
      position: relative;
      box-shadow: 0 24px 64px rgba(0,0,0,0.18);
    }
    .auth-modal-logo {
      display: flex; align-items: baseline; gap: 8px; margin-bottom: 24px;
    }
    .auth-modal-ko {
      font-family: 'Noto Serif KR', serif; font-size: 18px; font-weight: 400;
    }
    .auth-modal-en {
      font-family: 'DM Mono', monospace; font-size: 9px;
      letter-spacing: 0.18em; color: #999993;
    }
    .auth-modal-title {
      font-size: 22px; font-weight: 400; letter-spacing: -0.03em;
      margin-bottom: 24px;
    }
    .auth-member-grid {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px;
    }
    .auth-member-btn {
      padding: 8px 18px; border-radius: 999px;
      border: 1px solid rgba(45,90,61,0.18);
      font-size: 14px; font-weight: 400; color: #5A5A56;
      background: #FAFAF8; cursor: pointer;
      transition: background 0.18s, color 0.18s, border-color 0.18s;
      font-family: inherit;
    }
    .auth-member-btn:hover { border-color: rgba(45,90,61,0.4); color: #2D5A3D; }
    .auth-member-btn.selected {
      background: #2D5A3D; color: #fff; border-color: #2D5A3D;
    }
    .auth-pin-row {
      display: flex; align-items: center; gap: 12px; margin-bottom: 8px;
    }
    .auth-pin-label {
      font-family: 'DM Mono', monospace; font-size: 11px;
      letter-spacing: 0.12em; color: #999993;
      text-transform: uppercase; white-space: nowrap;
    }
    .auth-pin-input {
      flex: 1; height: 46px;
      border: 1px solid rgba(45,90,61,0.2);
      border-radius: 10px; padding: 0 16px;
      font-size: 20px; letter-spacing: 0.3em;
      font-family: 'DM Mono', monospace;
      outline: none; transition: border-color 0.18s;
      background: #FAFAF8;
    }
    .auth-pin-input:focus { border-color: #2D5A3D; }
    .auth-error {
      min-height: 18px; font-size: 12px; color: #C94B4B;
      margin-bottom: 16px;
    }
    .auth-submit-btn {
      width: 100%; height: 48px;
      background: #2D5A3D; color: #FAFAF8;
      border-radius: 12px; font-size: 15px; font-weight: 400;
      border: none; cursor: pointer; font-family: inherit;
      transition: background 0.18s;
    }
    .auth-submit-btn:hover { background: #1A3525; }
    .auth-submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .auth-close-btn {
      position: absolute; top: 16px; right: 16px;
      width: 32px; height: 32px; border-radius: 50%;
      font-size: 18px; color: #999993;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.18s;
      background: none; border: none; cursor: pointer;
    }
    .auth-close-btn:hover { background: #F4F3EC; color: #0F0F0E; }

    /* Locked member button */
    .member-btn.locked {
      opacity: 0.45;
      position: relative;
    }
    .member-btn.locked::after {
      content: "🔒";
      font-size: 10px;
      margin-left: 4px;
    }
  `;
  document.head.appendChild(style);
})();

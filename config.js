// Southmead Surgical Teaching — config.js
// Core configuration, Supabase helpers, date utilities, UI helpers, bank holidays

// ── Config / Constants / State ──

// ===================== VERSION =====================
const APP_VERSION = 'v3.7.3';
const APP_BUILD = '2026-05-27e';
const SITE_URL = 'https://teachsurgerysmh.github.io/nhs/';

// ===================== SAFE COLUMN LISTS (exclude pin_code) =====================
const LEARNER_FIELDS = 'id,name,email,grade,specialty,placement,placement_start,placement_end,verified,created_at,rotation_block,role,contact_id,followup_eligible';
const CONTACT_FIELDS = 'id,name,role,email,phone,specialty,notes,added_by,created_at,is_manager';
const LOGO_URL = SITE_URL + 'logo_transparent.png';
document.getElementById('versionTag').textContent = APP_VERSION;

// ===================== DEMO MODE =====================
let isDemoMode = false;
const DEMO_CREDENTIALS = { username: 'demo', password: 'demo123' };

function showDemoToast(action) {
  showToast(`🧪 Demo: "${action}" simulated — no data changed`, 3000);
}

// ===================== SUPABASE CONFIG =====================
const SUPABASE_URL = 'https://rufihxjquwrluaenmbaa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZmloeGpxdXdybHVhZW5tYmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyOTg4NDMsImV4cCI6MjA5Mzg3NDg0M30.6o8GrCPcQ__JjrGLUiqQwdgWcM1Qk_02TvLvTOwUjyg';

let _authToken = null;

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// Switch to authenticated JWT after login, back to anon on logout
function setAuthToken(token) {
  _authToken = token;
  headers['Authorization'] = 'Bearer ' + (token || SUPABASE_KEY);
  if (token) {
    sessionStorage.setItem('sst_token', token);
    resetInactivityTimer();
  } else {
    sessionStorage.removeItem('sst_token');
    if (_inactivityTimer) { clearTimeout(_inactivityTimer); _inactivityTimer = null; }
  }
}

// Restore JWT from session (called on page load)
function restoreAuthToken() {
  const token = sessionStorage.getItem('sst_token');
  if (token) {
    // Check if token is expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
        setAuthToken(token);
        return true;
      }
    } catch(e) {}
    // Token expired or invalid — clear it
    sessionStorage.removeItem('sst_token');
  }
  return false;
}

// ===================== INACTIVITY AUTO-LOGOUT (NHS DSPT) =====================
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
let _inactivityTimer = null;

function resetInactivityTimer() {
  if (_inactivityTimer) clearTimeout(_inactivityTimer);
  if (!currentUser && !currentLearner && !currentTeacher) return; // not logged in
  _inactivityTimer = setTimeout(() => {
    if (isDemoMode) { endDemoMode(); return; }
    if (typeof doLogout === 'function') doLogout();
    else if (typeof doLearnerLogout === 'function') doLearnerLogout();
    showToast('Logged out due to inactivity (20 min)', 5000);
  }, INACTIVITY_TIMEOUT_MS);
}

['click', 'keydown', 'scroll', 'touchstart'].forEach(evt =>
  document.addEventListener(evt, resetInactivityTimer, { passive: true })
);

// ===================== STATE =====================
let events = [];
let isAdmin = false;
let currentUser = null;
let currentLearner = null;
let currentTeacher = null;
const MANAGERS = ['suketu.batra@nbt.nhs.uk','ilgin.kilic@nbt.nhs.uk','nitin.arvind@nbt.nhs.uk'];
const SIGNING_CONSULTANT = 'Mr Nitin Arvind';
const SIGNING_TITLE = 'Surgical Tutor & Supervisor for Southmead Surgical Teaching Programme\nConsultant UGI Surgeon, North Bristol NHS Trust';
let currentView = 'list';
let currentFilter = 'upcoming';
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let editingEventId = null;

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Server-Side Auth Helper ──
async function callAuth(body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok && !data.needs_setup) throw new Error(data.error || 'Auth failed');
  return data;
}

// ── Supabase REST Helpers ──

// ===================== SUPABASE REST HELPERS =====================
async function sbGet(table, query = '') {
  if (isDemoMode && typeof demoSbGet === 'function') return demoSbGet(table, query);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers });
  if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`);
  return res.json();
}

async function sbInsert(table, data) {
  if (isDemoMode) { showDemoToast(`Add to ${table}`); return [{ id: 99999, ...data }]; }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers, body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`INSERT ${table} failed: ${res.status}`);
  return res.json();
}

async function sbUpdate(table, id, data) {
  if (isDemoMode) { showDemoToast(`Update ${table} #${id}`); return [{ id, ...data }]; }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`UPDATE ${table} failed: ${res.status}`);
  return res.json();
}

async function sbDelete(table, id) {
  if (isDemoMode) { showDemoToast(`Delete from ${table}`); return; }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE', headers
  });
  if (!res.ok) throw new Error(`DELETE ${table} failed: ${res.status}`);
}

// ===================== FEEDBACK TOKENS (magic-link / one-click feedback) =====================
// Returns a persistent token for (session, learner). One token per pair — reused across
// auto-send, manual-send, and cron reminders. Security relies on 192-bit randomness.
function _randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function getOrCreateFeedbackToken(sessionId, learnerId) {
  if (isDemoMode) return 'demo-token-' + sessionId + '-' + learnerId;
  try {
    const existing = await sbGet('feedback_tokens', `session_id=eq.${sessionId}&learner_id=eq.${learnerId}&select=token&limit=1`);
    if (existing && existing.length) return existing[0].token;
  } catch(e) { /* fall through to insert */ }
  const token = _randomToken();
  try {
    await sbInsert('feedback_tokens', { session_id: sessionId, learner_id: learnerId, token });
    return token;
  } catch(e) {
    // Race condition: another sender created it between our SELECT and INSERT. Re-read.
    const rows = await sbGet('feedback_tokens', `session_id=eq.${sessionId}&learner_id=eq.${learnerId}&select=token&limit=1`);
    return rows && rows[0] ? rows[0].token : token;
  }
}

function feedbackUrlWithToken(sessionId, token) {
  return SITE_URL + '?feedback=' + sessionId + (token ? '&token=' + encodeURIComponent(token) : '');
}

// ── Date Helpers ──

// ===================== DATE HELPERS =====================
function monthIndex(m) { return MONTHS.indexOf(m); }
function parseDateNum(d) { return parseInt(d); }
function eventToDate(ev) {
  const mi = monthIndex(ev.month);
  const day = parseDateNum(ev.date);
  if (mi < 0 || isNaN(day)) return null;
  return new Date(ev.year, mi, day);
}
function isFutureEvent(ev) {
  const d = eventToDate(ev);
  if (!d) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return d >= today;
}

function getCurrentRotationDates() {
  const now = new Date();
  const yr = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const blocks = [
    { start: new Date(yr, 7, 1), end: new Date(yr, 10, 30, 23, 59, 59) },       // Aug-Nov (aug_dec → adjusted)
    { start: new Date(yr, 11, 1), end: new Date(yr + 1, 2, 31, 23, 59, 59) },    // Dec-Mar
    { start: new Date(yr + 1, 3, 1), end: new Date(yr + 1, 6, 31, 23, 59, 59) }  // Apr-Jul
  ];
  for (const b of blocks) { if (now >= b.start && now <= b.end) return b; }
  return { start: new Date(yr, 7, 1), end: new Date(yr + 1, 7, 31, 23, 59, 59) };
}

function isInCurrentRotation(ev) {
  const d = eventToDate(ev);
  if (!d) return false;
  const rot = getCurrentRotationDates();
  return d >= rot.start && d <= rot.end;
}

// ===================== CPD HOURS =====================
// Parse a free-text time range like "0800-0900", "08:00-09:00", "13:00-13:30"
// and return CPD hours (1 hour per 60 min). Defaults to 1.0 if unparseable.
function cpdHoursFromTime(timeStr) {
  if (!timeStr) return 1;
  const m = String(timeStr).match(/(\d{1,2}):?(\d{2})\s*[-–—]\s*(\d{1,2}):?(\d{2})/);
  if (!m) return 1;
  const start = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  let end   = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  let mins = end - start;
  if (mins <= 0) mins += 24 * 60;
  // Round to nearest 0.25h to keep clean values
  return Math.round((mins / 60) * 4) / 4;
}
// Format hours: 1 → "1", 0.5 → "0.5", 1.25 → "1.25"
function fmtCpdHours(h) { return String(+(+h).toFixed(2)); }

// ── Data Loading ──

// ===================== DATA LOADING =====================
async function loadEvents() {
  try {
    let data;
    // Safe column list for public — excludes teacher_email, backup_teacher_email, last_edit_by, last_edit_at, notes
    const SCHEDULE_PUBLIC = 'id,event_id,day,date,month,year,time,room,topic,teacher,backup_teacher,status,published';
    if (isAdmin) {
      // Admin sees everything
      data = await sbGet('schedule', 'order=year.asc,id.asc&select=*');
    } else {
      // Public sees only published — no email addresses
      data = await sbGet('schedule', `published=eq.true&order=year.asc,id.asc&select=${SCHEDULE_PUBLIC}`);
    }
    events = data.map(row => ({
      id: row.id,
      event_id: row.event_id,
      day: row.day || '',
      date: row.date || '',
      month: row.month || '',
      year: row.year || 2026,
      time: row.time || '',
      room: row.room || '',
      topic: row.topic || '',
      teacher: row.teacher || '',
      teacherEmail: row.teacher_email || '',
      status: row.status || 'tbd',
      published: row.published !== false,
      notes: row.notes || '',
      lastEditBy: row.last_edit_by || '',
      lastEditAt: row.last_edit_at || '',
      backupTeacher: row.backup_teacher || '',
      backupTeacherEmail: row.backup_teacher_email || '',
    }));
    document.getElementById('offlineBanner').classList.remove('show');
  } catch(e) {
    console.error('Failed to load events:', e);
    document.getElementById('offlineBanner').classList.add('show');
  }
}

// ── Modal Helpers & Toast ──

// ===================== MODAL HELPERS =====================
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openLoginModal() {
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  openModal('loginModal');
  setTimeout(() => document.getElementById('loginUser').focus(), 100);
}

// ===================== TOAST =====================
function showToast(msg, duration) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration || 3000);
}

// ── UK Bank Holidays ──

// ===================== UK BANK HOLIDAYS =====================
const UK_BANK_HOLIDAYS = {};
async function fetchBankHolidays() {
  try {
    const res = await fetch('https://www.gov.uk/bank-holidays.json');
    const data = await res.json();
    (data['england-and-wales']?.events || []).forEach(h => {
      UK_BANK_HOLIDAYS[h.date] = h.title;
    });
  } catch(e) { console.warn('Could not fetch bank holidays:', e); }
}

function getBankHoliday(year, month, day) {
  const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  return UK_BANK_HOLIDAYS[key] || null;
}

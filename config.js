// Southmead Surgical Teaching — config.js
// Core configuration, Supabase helpers, date utilities, UI helpers, bank holidays
// v3.7.0 — Email-verified registration/reset + internal error/interaction logger.

// ── Config / Constants / State ──

// ===================== VERSION =====================
const APP_VERSION = 'v3.7.0';
const APP_BUILD = '2026-05-27a';
const SITE_URL = 'https://teachsurgerysmh.github.io/nhs/';
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
  } else {
    sessionStorage.removeItem('sst_token');
  }
}

// Restore JWT from session (called on page load)
function restoreAuthToken() {
  const token = sessionStorage.getItem('sst_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
        setAuthToken(token);
        return true;
      }
    } catch(e) {}
    sessionStorage.removeItem('sst_token');
  }
  return false;
}

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

// =====================================================================
// INTERNAL ERROR / INTERACTION LOGGER (v3.7.0)
// Posts to `error_log` table in Supabase. Anon insert allowed by RLS.
// Fails silently — never throws so it never breaks the page.
// =====================================================================
const ERROR_LOG_ENDPOINT = SUPABASE_URL + '/rest/v1/error_log';
const _logQueue = [];
let _logFlushTimer = null;
const _LOG_FLUSH_MS = 1500;     // batch logs every 1.5s
const _LOG_MAX_BATCH = 20;

function _currentActor() {
  if (currentUser) return { actor_type: 'admin',   actor_email: (currentUser.username || '').toLowerCase() + '@nbt.nhs.uk', actor_id: currentUser.id || null };
  if (currentTeacher) return { actor_type: 'teacher', actor_email: (currentTeacher.email || '').toLowerCase(), actor_id: currentTeacher.id || null };
  if (currentLearner) return { actor_type: 'learner', actor_email: (currentLearner.email || '').toLowerCase(), actor_id: currentLearner.id || null };
  return { actor_type: 'anon', actor_email: null, actor_id: null };
}

function _enqueueLog(row) {
  try { _logQueue.push(row); } catch(_) {}
  if (_logFlushTimer) return;
  _logFlushTimer = setTimeout(_flushLogs, _LOG_FLUSH_MS);
}

async function _flushLogs() {
  _logFlushTimer = null;
  if (!_logQueue.length) return;
  const batch = _logQueue.splice(0, _LOG_MAX_BATCH);
  try {
    await fetch(ERROR_LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(batch),
      keepalive: true,
    });
  } catch (e) {
    if (window.console && console.debug) console.debug('error_log flush failed:', e);
  }
  if (_logQueue.length) _logFlushTimer = setTimeout(_flushLogs, _LOG_FLUSH_MS);
}

// Strip non-serialisable values from context payloads
function _safeJsonReplacer(_k, v) {
  if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
  if (typeof v === 'function') return '[fn]';
  if (typeof v === 'bigint') return v.toString();
  return v;
}

function logError(level, category, message, context) {
  const actor = _currentActor();
  let safeCtx = null;
  try { safeCtx = context ? JSON.parse(JSON.stringify(context, _safeJsonReplacer)) : null; } catch(_) { safeCtx = { _err: 'context-not-serialisable' }; }
  _enqueueLog({
    level: level || 'error',
    category: category || 'js_error',
    message: String(message || '').slice(0, 1000),
    stack: (context && context.stack) || null,
    url: location && location.href,
    user_agent: navigator.userAgent,
    context: safeCtx,
    app_version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : null,
    client_ts: new Date().toISOString(),
    ...actor,
  });
}

function logInteraction(action, context) {
  logError('info', 'user_action', action, context || {});
}

function logFlowStep(flow, step, context) {
  logError('info', 'flow_step', flow + '.' + step, context || {});
}

// Global error hooks
window.addEventListener('error', (e) => {
  try {
    logError('error', 'js_error', e.message || 'Unknown JS error', {
      stack: e.error && e.error.stack,
      filename: e.filename, lineno: e.lineno, colno: e.colno
    });
  } catch(_) {}
});
window.addEventListener('unhandledrejection', (e) => {
  try {
    const r = e.reason || {};
    logError('error', 'unhandled_rejection', r.message || String(r), { stack: r.stack });
  } catch(_) {}
});
// Flush remaining logs before tab unload
window.addEventListener('pagehide', () => { try { _flushLogs(); } catch(_) {} });

// ── Server-Side Auth Helper ──
async function callAuth(body) {
  const url = `${SUPABASE_URL}/functions/v1/authenticate`;
  let res, data;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify(body)
    });
    data = await res.json();
  } catch (e) {
    logError('error', 'network_error', 'callAuth fetch failed', { action: body && body.action, error: e.message });
    throw new Error('Network error — check your connection');
  }
  if (!res.ok && !data.needs_setup) {
    const err = new Error(data.error || 'Auth failed');
    if (data.not_found) err._notFound = true;
    if (data.already_registered) err._alreadyRegistered = true;
    if (res.status >= 500) {
      logError('error', 'auth_server_error', err.message, { action: body && body.action, status: res.status });
    }
    throw err;
  }
  return data;
}

// ── Supabase REST Helpers ──
async function sbGet(table, query = '') {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers });
  } catch (e) {
    logError('error', 'network_error', 'sbGet fetch failed', { table, query, error: e.message });
    throw new Error(`Network error reading ${table}`);
  }
  if (!res.ok) {
    // 404 / 406 / 409 are routine; only WARN log
    logError('warn', 'db_error', `GET ${table} returned ${res.status}`, { table, query, status: res.status });
    throw new Error(`GET ${table} failed: ${res.status}`);
  }
  return res.json();
}

async function sbInsert(table, data) {
  if (isDemoMode) { showDemoToast(`Add to ${table}`); return [{ id: 99999, ...data }]; }
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST', headers, body: JSON.stringify(data)
    });
  } catch (e) {
    logError('error', 'network_error', 'sbInsert fetch failed', { table, error: e.message });
    throw new Error(`Network error inserting into ${table}`);
  }
  if (!res.ok) {
    logError('warn', 'db_error', `INSERT ${table} returned ${res.status}`, { table, status: res.status });
    throw new Error(`INSERT ${table} failed: ${res.status}`);
  }
  return res.json();
}

async function sbUpdate(table, id, data) {
  if (isDemoMode) { showDemoToast(`Update ${table} #${id}`); return [{ id, ...data }]; }
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(data)
    });
  } catch (e) {
    logError('error', 'network_error', 'sbUpdate fetch failed', { table, id, error: e.message });
    throw new Error(`Network error updating ${table}`);
  }
  if (!res.ok) {
    logError('warn', 'db_error', `UPDATE ${table} returned ${res.status}`, { table, id, status: res.status });
    throw new Error(`UPDATE ${table} failed: ${res.status}`);
  }
  return res.json();
}

async function sbDelete(table, id) {
  if (isDemoMode) { showDemoToast(`Delete from ${table}`); return; }
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers });
  } catch (e) {
    logError('error', 'network_error', 'sbDelete fetch failed', { table, id, error: e.message });
    throw new Error(`Network error deleting from ${table}`);
  }
  if (!res.ok) {
    logError('warn', 'db_error', `DELETE ${table} returned ${res.status}`, { table, id, status: res.status });
    throw new Error(`DELETE ${table} failed: ${res.status}`);
  }
}

// ===================== FEEDBACK TOKENS (magic-link / one-click feedback) =====================
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
    const rows = await sbGet('feedback_tokens', `session_id=eq.${sessionId}&learner_id=eq.${learnerId}&select=token&limit=1`);
    return rows && rows[0] ? rows[0].token : token;
  }
}

function feedbackUrlWithToken(sessionId, token) {
  return SITE_URL + '?feedback=' + sessionId + (token ? '&token=' + encodeURIComponent(token) : '');
}

// ── Date Helpers ──
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
    { start: new Date(yr, 7, 1), end: new Date(yr, 10, 30, 23, 59, 59) },
    { start: new Date(yr, 11, 1), end: new Date(yr + 1, 2, 31, 23, 59, 59) },
    { start: new Date(yr + 1, 3, 1), end: new Date(yr + 1, 6, 31, 23, 59, 59) }
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
function cpdHoursFromTime(timeStr) {
  if (!timeStr) return 1;
  const m = String(timeStr).match(/(\d{1,2}):?(\d{2})\s*[-–—]\s*(\d{1,2}):?(\d{2})/);
  if (!m) return 1;
  const start = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  let end   = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  let mins = end - start;
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 4) / 4;
}
function fmtCpdHours(h) { return String(+(+h).toFixed(2)); }

// ── Data Loading ──
async function loadEvents() {
  try {
    let data;
    if (isAdmin) {
      data = await sbGet('schedule', 'order=year.asc,id.asc&select=*');
    } else {
      data = await sbGet('schedule', 'published=eq.true&order=year.asc,id.asc&select=*');
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

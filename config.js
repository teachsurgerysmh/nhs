// Southmead Surgical Teaching — config.js
// Core configuration, Supabase helpers, date utilities, UI helpers, bank holidays

// ── Config / Constants / State ──

// ===================== VERSION =====================
const APP_VERSION = 'v3.0.3';
const APP_BUILD = '2026-05-19';
const SITE_URL = 'https://teachsurgerysmh.github.io/nhs/';
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

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// ===================== STATE =====================
let events = [];
let isAdmin = false;
let currentUser = null;
let currentLearner = null;
let currentView = 'list';
let currentFilter = 'upcoming';
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let editingEventId = null;

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Supabase REST Helpers ──

// ===================== SUPABASE REST HELPERS =====================
async function sbGet(table, query = '') {
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

// ── Data Loading ──

// ===================== DATA LOADING =====================
async function loadEvents() {
  try {
    let data;
    if (isAdmin) {
      // Admin sees everything
      data = await sbGet('schedule', 'order=year.asc,id.asc&select=*');
    } else {
      // Public sees only published
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

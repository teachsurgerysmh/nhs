// Southmead Surgical Teaching — analytics.js
// QI engagement logging + admin-only QI dashboard renderer
// Loaded AFTER config.js so it can use sbInsert/SUPABASE_*/currentUser.

// ===================== QI EVENT TAXONOMY =====================
// Keep this in sync with migration_v3.6.0_qi_events.sql comments.
// Categories: auth, session, invitation, attendance, feedback, certificate,
// survey, page, system.
const QI_EVENT_TYPES = new Set([
  // Auth
  'admin_login','admin_logout',
  'learner_register','learner_login','learner_logout',
  'teacher_setup','teacher_login','teacher_logout',
  'password_reset',
  // Session lifecycle
  'session_created','session_edited','session_published','session_unpublished',
  'session_deleted','session_cancelled','session_completed','session_requested',
  // Teacher invitation flow
  'invitation_sent','invitation_confirmed','invitation_declined',
  'reschedule_requested','reminder_sent',
  // Attendance
  'attendance_self_marked','attendance_admin_marked','attendance_via_feedback',
  'attendance_approved','attendance_rejected','attendance_removed',
  'absence_reason_given',
  // Feedback
  'feedback_request_sent','feedback_reminder_sent','feedback_submitted',
  'feedback_qr_scan','feedback_link_opened',
  // Certificate
  'certificate_viewed','certificate_downloaded',
  // Survey
  'baseline_survey_started','baseline_survey_question_answered',
  'baseline_survey_completed','survey_email_one_click',
  // Teacher engagement with their feedback
  'teacher_viewed_feedback','teacher_viewed_session_feedback',
  // Page / nav
  'page_view','qr_scan',
  // Inline micro-feedback widget
  'inline_rating_prompted','inline_rating_submitted','inline_rating_dismissed',
  // System / cron
  'cron_reminder_sent','cron_attendance_followup',
]);

// ===================== logQI() — FIRE-AND-FORGET =====================
// Safe to call from anywhere. Never throws. Never blocks UI.
// Demo mode: silently no-ops so we don't pollute real metrics.
function logQI(eventType, opts = {}) {
  try {
    if (typeof isDemoMode !== 'undefined' && isDemoMode) return;
    if (!QI_EVENT_TYPES.has(eventType)) {
      console.warn('[qi] unknown event_type:', eventType, '— add to QI_EVENT_TYPES & migration');
    }
    // Resolve actor from current session state
    let actor_type = opts.actor_type || null;
    let actor_id   = opts.actor_id   ?? null;
    let actor_email= opts.actor_email|| null;
    let actor_name = opts.actor_name || null;
    if (!actor_type) {
      if (typeof currentUser !== 'undefined' && currentUser)            { actor_type = 'admin';   actor_id = actor_id ?? currentUser.id;       actor_email = actor_email || (currentUser.username + '@nbt.nhs.uk'); actor_name = actor_name || currentUser.name; }
      else if (typeof currentTeacher !== 'undefined' && currentTeacher) { actor_type = 'teacher'; actor_id = actor_id ?? currentTeacher.id;    actor_email = actor_email || currentTeacher.email;                    actor_name = actor_name || currentTeacher.name; }
      else if (typeof currentLearner !== 'undefined' && currentLearner) { actor_type = 'learner'; actor_id = actor_id ?? currentLearner.id;    actor_email = actor_email || currentLearner.email;                    actor_name = actor_name || currentLearner.name; }
      else { actor_type = 'public'; }
    }
    const body = {
      event_type: eventType,
      actor_type, actor_id, actor_email, actor_name,
      session_id: opts.session_id ?? null,
      metadata: opts.metadata || {},
      source: opts.source || 'web',
      user_agent: (navigator?.userAgent || '').slice(0, 250),
    };
    // Fire-and-forget POST. Don't await — never block the caller.
    fetch(`${SUPABASE_URL}/rest/v1/qi_events`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(e => console.warn('[qi] log failed:', eventType, e));
  } catch (e) {
    console.warn('[qi] logQI threw:', e);
  }
}

// Page view logging — debounce per view so SPA route changes don't double-log
let _qiLastPageView = { view: null, at: 0 };
function logQIPageView(view) {
  const now = Date.now();
  if (_qiLastPageView.view === view && (now - _qiLastPageView.at) < 1500) return;
  _qiLastPageView = { view, at: now };
  logQI('page_view', { metadata: { view } });
}

// Detect QR/email landing on first load and log them
function logQILandingFromURL() {
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get('attend'))         logQI('qr_scan', { metadata: { kind: 'attendance', session_id: p.get('attend') }, session_id: parseInt(p.get('attend')) || null, source: 'qr' });
    if (p.get('feedback'))       logQI('feedback_link_opened', { metadata: { kind: 'feedback', session_id: p.get('feedback') }, session_id: parseInt(p.get('feedback')) || null, source: 'qr' });
    if (p.get('survey_answer'))  logQI('survey_email_one_click', { metadata: { form: p.get('form'), q: p.get('q'), a: p.get('a') }, source: 'email' });
    if (p.get('action'))         logQI(`invitation_${p.get('action')}`.replace('invitation_reschedule','reschedule_requested'),
                                       { session_id: parseInt(p.get('session')) || null,
                                         metadata: { teacher_email: (function(t){ try { return atob(t||'').split(':').slice(1).join(':'); } catch(e){ return null; } })(p.get('token')) },
                                         source: 'email' });
    if (p.get('absence_token'))  logQI('absence_reason_given', { metadata: { reason: p.get('reason') || null }, source: 'email' });
  } catch (e) { console.warn('[qi] landing log failed:', e); }
}

// ===================== QI DASHBOARD — ADMIN-ONLY UI =====================

const QI_DASHBOARD_ALLOWED_EMAILS = ['suketu.batra@nbt.nhs.uk','suketubatra@gmail.com'];
function isQIDashboardAllowed() {
  if (!isAdmin || !currentUser) return false;
  const u = (currentUser.username || '').toLowerCase();
  if (u === 'suketu') return true;
  const e = (currentUser.email || (u + '@nbt.nhs.uk')).toLowerCase();
  return QI_DASHBOARD_ALLOWED_EMAILS.includes(e);
}

let _qiData = null;
let _qiPin  = null;

async function loadQIDashboard() {
  const container = document.getElementById('qiDashView');
  if (!container) return;

  if (!isQIDashboardAllowed()) {
    container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--nhs-red);">
      <h3>Access restricted</h3>
      <p style="color:var(--nhs-grey);font-size:13px;">The QI dashboard is restricted to the QI project lead.</p>
    </div>`;
    return;
  }

  // Get / prompt for pin
  if (!_qiPin) {
    _qiPin = sessionStorage.getItem('sst_qi_pin') || null;
  }
  if (!_qiPin) {
    container.innerHTML = `
      <div style="max-width:420px;margin:40px auto;padding:24px;background:white;border-radius:8px;border:1px solid var(--nhs-pale-grey);">
        <h3 style="color:var(--nhs-dark-blue);margin-bottom:8px;">QI Dashboard</h3>
        <p style="color:var(--nhs-grey);font-size:13px;margin-bottom:14px;">Enter your QI dashboard pin to load engagement metrics. The pin is set on the <code>qi-dashboard</code> Edge Function as <code>QI_DASHBOARD_PIN</code>.</p>
        <label>QI Pin</label>
        <input type="password" id="qiPinInput" placeholder="••••••" style="margin-bottom:12px;">
        <button class="btn btn-green" onclick="submitQIPin()" style="width:100%;">Unlock</button>
      </div>`;
    setTimeout(() => document.getElementById('qiPinInput')?.focus(), 100);
    return;
  }

  container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--nhs-grey);">
    <div class="loading-spinner"></div><p style="margin-top:12px;">Loading QI metrics...</p></div>`;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/qi-dashboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ pin: _qiPin }),
    });
    if (res.status === 401) {
      _qiPin = null;
      sessionStorage.removeItem('sst_qi_pin');
      loadQIDashboard();
      showToast('Pin rejected — try again');
      return;
    }
    if (!res.ok) throw new Error('QI fetch failed: ' + res.status);
    _qiData = await res.json();
    renderQIDashboard();
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--nhs-red);">
      <h3>Failed to load QI dashboard</h3>
      <p style="color:var(--nhs-grey);font-size:13px;">${esc(String(e.message || e))}</p>
      <p style="font-size:12px;color:var(--nhs-grey);margin-top:12px;">Has the <code>qi-dashboard</code> Edge Function been deployed? See <code>edge-function-qi-dashboard.ts</code>.</p>
      <button class="btn btn-outline" style="margin-top:14px;" onclick="_qiPin=null;sessionStorage.removeItem('sst_qi_pin');loadQIDashboard();">Re-enter pin</button>
    </div>`;
  }
}

function submitQIPin() {
  const pin = document.getElementById('qiPinInput')?.value?.trim();
  if (!pin) { showToast('Enter your pin'); return; }
  _qiPin = pin;
  sessionStorage.setItem('sst_qi_pin', pin);
  loadQIDashboard();
}

function renderQIDashboard() {
  const c = document.getElementById('qiDashView');
  if (!c || !_qiData) return;
  const d = _qiData;
  const k = d.kpis || {};

  const fmt    = v => (v === null || v === undefined ? '—' : v);
  const pct    = v => (v === null || v === undefined ? '—' : v + '%');
  const hrs    = v => (v === null || v === undefined ? '—' : v + 'h');

  const kpi = (label, value, sub) => `
    <div class="qi-kpi-card">
      <div class="qi-kpi-num">${fmt(value)}</div>
      <div class="qi-kpi-label">${label}</div>
      ${sub ? `<div class="qi-kpi-sub">${sub}</div>` : ''}
    </div>`;

  // ---- KPI tiles ----
  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <h2 style="color:var(--nhs-dark-blue);margin:0;">QI Dashboard</h2>
      <div style="display:flex;gap:8px;align-items:center;">
        <span style="font-size:12px;color:var(--nhs-grey);">Generated ${new Date(d.generated_at).toLocaleString()}</span>
        <button class="btn btn-outline" style="font-size:12px;padding:6px 12px;" onclick="loadQIDashboard()">Refresh</button>
        <button class="btn btn-outline" style="font-size:12px;padding:6px 12px;" onclick="exportQICSV()">Export CSV</button>
        <button class="btn btn-outline" style="font-size:12px;padding:6px 12px;color:var(--nhs-red);border-color:var(--nhs-red);" onclick="_qiPin=null;sessionStorage.removeItem('sst_qi_pin');loadQIDashboard();">Lock</button>
      </div>
    </div>

    <div class="qi-section-title">Top-line KPIs</div>
    <div class="qi-kpi-grid">
      ${kpi('Sessions',        k.total_sessions,       (k.completed_sessions||0) + ' completed · ' + (k.cancelled_sessions||0) + ' cancelled')}
      ${kpi('Invitations sent', k.invitations_sent,     (k.invitations_confirmed||0) + ' confirmed · ' + (k.invitations_declined||0) + ' declined')}
      ${kpi('Teacher confirm rate', pct(k.confirmation_rate_pct), 'across all invitations')}
      ${kpi('Median time to respond', hrs(k.median_hours_to_respond), 'invitation → confirm/decline')}
      ${kpi('Median time to attendance', hrs(k.median_hours_to_first_attendance), 'session created → first attendance')}
      ${kpi('Median time to feedback', hrs(k.median_hours_to_feedback), 'feedback request → first submission')}
      ${kpi('Reminders per feedback', k.mean_reminders_before_feedback, 'mean reminders before feedback came in')}
      ${kpi('Total attendances', k.total_attendances,   (k.unique_attendees||0) + ' unique learners')}
      ${kpi('Feedback submitted', k.feedback_submitted, pct(k.feedback_completion_rate_pct) + ' of attendees')}
      ${kpi('Mean overall rating', k.mean_overall_rating, 'out of 10')}
      ${kpi('Teacher feedback views', k.teacher_feedback_views, (k.unique_teachers_viewed_feedback||0) + ' unique teachers')}
      ${kpi('Certificates issued', k.certificates_issued, '')}
      ${kpi('Registered learners', k.registered_learners, (k.teachers_active||0) + ' active teachers')}
      ${kpi('Baseline survey respondents', k.baseline_survey_respondents, 'pre-platform comparator')}
    </div>`;

  // ---- Weekly time-series ----
  html += `<div class="qi-section-title">Weekly trend</div>
    <div class="qi-card"><canvas id="qiWeeklyChart" height="120"></canvas></div>`;

  // ---- PDSA cycle comparison ----
  html += `<div class="qi-section-title">PDSA cycle comparison</div>
    <div class="qi-card" style="overflow-x:auto;">
      <table class="qi-table">
        <thead><tr>
          <th>Cycle</th><th>Title</th><th>Version</th><th>Started</th>
          <th>Invites</th><th>Confirmed</th><th>Confirm %</th>
          <th>Attendance</th><th>Feedback</th><th>Mean rating</th>
        </tr></thead>
        <tbody>
          ${(d.pdsa_metrics || []).map(p => `<tr>
            <td>${fmt(p.cycle_number)}</td>
            <td>${esc(p.title || '')}</td>
            <td>${esc(p.app_version || '')}</td>
            <td>${p.started_at ? new Date(p.started_at).toLocaleDateString() : '—'}</td>
            <td>${fmt(p.invites_sent)}</td>
            <td>${fmt(p.invites_confirmed)}</td>
            <td>${pct(p.confirmation_rate_pct)}</td>
            <td>${fmt(p.attendances)}</td>
            <td>${fmt(p.feedback_count)}</td>
            <td>${fmt(p.mean_rating)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="text-align:right;margin-top:10px;">
        <button class="btn btn-outline" style="font-size:12px;" onclick="openNewPDSACycleModal()">+ Add PDSA cycle</button>
      </div>
    </div>`;

  // ---- Per-session funnel ----
  html += `<div class="qi-section-title">Per-session funnel <span style="font-size:12px;color:var(--nhs-grey);font-weight:normal;">(recent 200)</span></div>
    <div class="qi-card" style="overflow-x:auto;max-height:480px;overflow-y:auto;">
      <table class="qi-table">
        <thead><tr>
          <th>Date</th><th>Topic</th><th>Teacher</th><th>Status</th>
          <th>Invites</th><th>Resp(h)</th><th>Confirmed?</th>
          <th>Attendance</th><th>Feedback</th><th>FB %</th><th>Rating</th>
        </tr></thead>
        <tbody>
          ${(d.sessions || []).map(s => `<tr>
            <td>${esc(s.date_display || '')}</td>
            <td>${esc(s.topic || '—')}</td>
            <td>${esc(s.teacher || '—')}</td>
            <td><span class="qi-pill qi-pill-${s.status}">${esc(s.status || '')}</span></td>
            <td>${fmt(s.invite_count)}</td>
            <td>${s.hours_to_respond ? Math.round(s.hours_to_respond * 10) / 10 : '—'}</td>
            <td>${s.confirmed_at ? '✓' : (s.declined_at ? '✗' : '—')}</td>
            <td>${fmt(s.attendance_count)}</td>
            <td>${fmt(s.feedback_count)}</td>
            <td>${pct(s.feedback_pct)}</td>
            <td>${fmt(s.mean_overall_rating)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  // ---- Teacher engagement ----
  html += `<div class="qi-section-title">Teacher engagement</div>
    <div class="qi-card" style="overflow-x:auto;max-height:360px;overflow-y:auto;">
      <table class="qi-table">
        <thead><tr>
          <th>Teacher</th><th>Assigned</th><th>Confirmed</th><th>Declined</th><th>Reschedule</th>
          <th>FB received</th><th>Mean rating</th>
        </tr></thead>
        <tbody>
          ${(d.teachers || []).filter(t => (t.assigned_sessions||0) + (t.confirmed_count||0) + (t.declined_count||0) > 0).map(t => `<tr>
            <td>${esc(t.teacher_name || '')}</td>
            <td>${fmt(t.assigned_sessions)}</td>
            <td>${fmt(t.confirmed_count)}</td>
            <td>${fmt(t.declined_count)}</td>
            <td>${fmt(t.reschedule_count)}</td>
            <td>${fmt(t.feedback_received_count)}</td>
            <td>${fmt(t.mean_rating_received)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  // ---- Learner engagement ----
  html += `<div class="qi-section-title">Learner engagement</div>
    <div class="qi-card" style="overflow-x:auto;max-height:360px;overflow-y:auto;">
      <table class="qi-table">
        <thead><tr>
          <th>Learner</th><th>Grade</th><th>Placement</th>
          <th>Attended</th><th>Feedback</th><th>Logins</th><th>Certs</th><th>Last seen</th>
        </tr></thead>
        <tbody>
          ${(d.learners || []).map(l => `<tr>
            <td>${esc(l.learner_name || '')}</td>
            <td>${esc(l.grade || '')}</td>
            <td>${esc(l.placement || '')}</td>
            <td>${fmt(l.sessions_attended)}</td>
            <td>${fmt(l.feedback_given)}</td>
            <td>${fmt(l.login_count)}</td>
            <td>${fmt(l.certs_downloaded)}</td>
            <td>${l.last_seen_at ? new Date(l.last_seen_at).toLocaleDateString() : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  // ---- Inline "rate this feature" ratings ----
  html += `<div class="qi-section-title">In-app feature ratings <span style="font-size:12px;color:var(--nhs-grey);font-weight:normal;">(micro-feedback widget)</span></div>
    <div class="qi-card" style="overflow-x:auto;">
      <table class="qi-table">
        <thead><tr>
          <th>Feature</th><th>n</th><th>Mean</th><th>5★</th><th>4★</th><th>3★</th><th>2★</th><th>1★</th><th>Comments</th><th>Last rated</th>
        </tr></thead>
        <tbody>
          ${(d.inline_ratings || []).length === 0
            ? `<tr><td colspan="10" style="text-align:center;color:var(--nhs-grey);padding:18px;">No in-app ratings yet — widget will start collecting as users hit key flows.</td></tr>`
            : (d.inline_ratings || []).map(r => `<tr>
                <td><code style="font-size:11px;">${esc(r.feature)}</code></td>
                <td>${fmt(r.rating_count)}</td>
                <td><strong>${fmt(r.mean_rating)}</strong></td>
                <td>${fmt(r.count_5)}</td><td>${fmt(r.count_4)}</td><td>${fmt(r.count_3)}</td><td>${fmt(r.count_2)}</td><td>${fmt(r.count_1)}</td>
                <td>${fmt(r.comments_count)}</td>
                <td>${r.last_rated_at ? new Date(r.last_rated_at).toLocaleDateString() : '—'}</td>
              </tr>`).join('')
          }
        </tbody>
      </table>
    </div>`;

  // ---- Event-type breakdown ----
  html += `<div class="qi-section-title">Event taxonomy (raw counts)</div>
    <div class="qi-card" style="overflow-x:auto;max-height:300px;overflow-y:auto;">
      <table class="qi-table">
        <thead><tr><th>Event</th><th>Actor</th><th>Count</th><th>First</th><th>Last</th></tr></thead>
        <tbody>
          ${(d.event_counts || []).map(r => `<tr>
            <td><code style="font-size:11px;">${esc(r.event_type)}</code></td>
            <td>${esc(r.actor_type || '—')}</td>
            <td>${r.event_count}</td>
            <td>${r.first_seen ? new Date(r.first_seen).toLocaleDateString() : '—'}</td>
            <td>${r.last_seen ? new Date(r.last_seen).toLocaleDateString() : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  c.innerHTML = html;
  renderQIWeeklyChart();
}

// ---- Weekly trend chart (uses Chart.js loaded on-demand) ----
function renderQIWeeklyChart() {
  if (!_qiData || !_qiData.weekly) return;
  const canvas = document.getElementById('qiWeeklyChart');
  if (!canvas) return;

  function draw() {
    const w = _qiData.weekly;
    const labels = w.map(r => new Date(r.week_start).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }));
    const datasets = [
      { label: 'Invites sent',     data: w.map(r => r.invites_sent || 0),      borderColor: '#005eb8', backgroundColor: 'rgba(0,94,184,0.1)',  tension: 0.3, fill: false },
      { label: 'Confirmed',        data: w.map(r => r.invites_confirmed || 0), borderColor: '#009639', backgroundColor: 'rgba(0,150,57,0.1)',  tension: 0.3, fill: false },
      { label: 'Attendances',      data: w.map(r => r.attendances || 0),       borderColor: '#41b6e6', backgroundColor: 'rgba(65,182,230,0.1)', tension: 0.3, fill: false },
      { label: 'Feedback',         data: w.map(r => r.feedback_count || 0),    borderColor: '#ed8b00', backgroundColor: 'rgba(237,139,0,0.1)',  tension: 0.3, fill: false },
    ];
    // Destroy prior chart if any
    if (window._qiChart) { try { window._qiChart.destroy(); } catch(e) {} }
    window._qiChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  if (typeof Chart === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = draw;
    document.head.appendChild(s);
  } else {
    draw();
  }
}

// ---- CSV export ----
function exportQICSV() {
  if (!_qiData) return;
  const rows = [];
  rows.push(['== KPIs ==']);
  Object.entries(_qiData.kpis || {}).forEach(([k, v]) => rows.push([k, v]));
  rows.push([]);
  rows.push(['== Weekly ==']);
  rows.push(['week_start','invites_sent','invites_confirmed','invites_declined','attendances','feedback_count','mean_rating','logins','certs_issued']);
  (_qiData.weekly || []).forEach(r => rows.push([r.week_start, r.invites_sent, r.invites_confirmed, r.invites_declined, r.attendances, r.feedback_count, r.mean_rating, r.logins, r.certs_issued]));
  rows.push([]);
  rows.push(['== Per-session funnel ==']);
  rows.push(['session_id','date','topic','teacher','status','invite_count','hours_to_respond','attendance_count','feedback_count','feedback_pct','mean_overall_rating']);
  (_qiData.sessions || []).forEach(s => rows.push([s.session_id, s.date_display, s.topic, s.teacher, s.status, s.invite_count, s.hours_to_respond, s.attendance_count, s.feedback_count, s.feedback_pct, s.mean_overall_rating]));
  rows.push([]);
  rows.push(['== PDSA Cycles ==']);
  rows.push(['cycle','title','version','started_at','invites','confirmed','confirm_pct','attendance','feedback','mean_rating']);
  (_qiData.pdsa_metrics || []).forEach(p => rows.push([p.cycle_number, p.title, p.app_version, p.started_at, p.invites_sent, p.invites_confirmed, p.confirmation_rate_pct, p.attendances, p.feedback_count, p.mean_rating]));

  const csv = rows.map(r => r.map(c => {
    const s = (c === null || c === undefined) ? '' : String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `qi_dashboard_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('CSV exported');
}

// ---- PDSA cycle modal ----
function openNewPDSACycleModal() {
  const html = `
    <div style="max-width:500px;margin:0 auto;">
      <h3 style="color:var(--nhs-dark-blue);margin-bottom:14px;">New PDSA Cycle</h3>
      <label>Cycle number</label>
      <input type="number" id="pdsaNum" value="${((_qiData?.pdsa_cycles?.length) || 0)}" style="width:100%;margin-bottom:8px;">
      <label>Title</label>
      <input type="text" id="pdsaTitle" placeholder="e.g. SMS reminders for teachers" style="width:100%;margin-bottom:8px;">
      <label>Intervention (what changed)</label>
      <textarea id="pdsaIntervention" rows="2" style="width:100%;margin-bottom:8px;" placeholder="Twilio SMS reminders sent 48h before session"></textarea>
      <label>Hypothesis (what we expect)</label>
      <textarea id="pdsaHypothesis" rows="2" style="width:100%;margin-bottom:8px;" placeholder="Teacher confirmation rate will rise from X% to Y%"></textarea>
      <label>Started at</label>
      <input type="datetime-local" id="pdsaStart" value="${new Date().toISOString().slice(0,16)}" style="width:100%;margin-bottom:8px;">
      <label>App version</label>
      <input type="text" id="pdsaVersion" value="${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}" style="width:100%;margin-bottom:14px;">
      <button class="btn btn-green" style="width:100%;" onclick="savePDSACycle()">Save cycle</button>
    </div>`;
  document.getElementById('detailBody').innerHTML = html;
  document.querySelector('#detailModal .modal-header h3').textContent = 'PDSA Cycle';
  document.getElementById('detailFooter').innerHTML = '';
  openModal('detailModal');
}

async function savePDSACycle() {
  const body = {
    cycle_number: parseInt(document.getElementById('pdsaNum').value) || 0,
    title:        document.getElementById('pdsaTitle').value.trim(),
    intervention: document.getElementById('pdsaIntervention').value.trim(),
    hypothesis:   document.getElementById('pdsaHypothesis').value.trim(),
    started_at:   new Date(document.getElementById('pdsaStart').value).toISOString(),
    app_version:  document.getElementById('pdsaVersion').value.trim() || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : null),
  };
  if (!body.title) { showToast('Title required'); return; }
  try {
    // PDSA writes require service role; do via edge function? For now route through anon
    // (we'll need a new policy if anon insert is desired). Simplest: ask Suketu to add
    // via SQL editor for now. Show that hint.
    showToast('Add cycles via Supabase SQL editor for now (anon write disabled for PDSA).');
    console.info('PDSA cycle payload (paste into SQL editor):', body);
  } catch (e) {
    showToast('Failed to save cycle');
  }
}

// ===================== INLINE "RATE THIS FEATURE" MICRO-FEEDBACK =====================
// Lightweight prompt that pops a small bottom-right card after key actions
// (feedback submission, certificate download, attendance marked, teacher confirm).
// Stores rating + optional comment as inline_rating_submitted with metadata
// { feature, rating, comment }.

const _qiInlinePromptShownPerSession = new Set();   // dedup within session
const _qiInlineSnoozeKey = 'sst_qi_inline_snooze';  // remember snoozes

function askInlineRating(feature, opts = {}) {
  // Don't show in demo mode
  if (typeof isDemoMode !== 'undefined' && isDemoMode) return;
  // De-dup this feature in this session
  if (_qiInlinePromptShownPerSession.has(feature)) return;
  // Honour snooze
  const snoozeRaw = localStorage.getItem(_qiInlineSnoozeKey);
  if (snoozeRaw) {
    try {
      const snooze = JSON.parse(snoozeRaw);
      if (snooze.until && Date.now() < snooze.until) return;
    } catch (e) { /* ignore */ }
  }
  _qiInlinePromptShownPerSession.add(feature);
  logQI('inline_rating_prompted', { metadata: { feature } });

  // Remove any existing widget
  document.getElementById('qiInlineRating')?.remove();

  const labels = {
    feedback_form:    'How was the feedback form?',
    certificate_flow: 'How was generating your certificate?',
    attendance:       'How easy was marking attendance?',
    teacher_confirm:  'How was confirming this session?',
    teacher_dashboard:'How useful is the teacher dashboard?',
    learner_dashboard:'How useful is the learner dashboard?',
    qr_attendance:    'How was scanning the QR for attendance?',
  };
  const label = opts.label || labels[feature] || `Quick rating: ${feature.replace(/_/g, ' ')}`;

  const el = document.createElement('div');
  el.id = 'qiInlineRating';
  el.className = 'qi-inline-rating';
  el.innerHTML = `
    <button class="qi-inline-close" aria-label="Dismiss" onclick="dismissInlineRating()">×</button>
    <div class="qi-inline-q">${label}</div>
    <div class="qi-inline-stars" id="qiInlineStars">
      ${[1,2,3,4,5].map(n => `<button data-r="${n}" onclick="submitInlineRating('${feature}', ${n})">★</button>`).join('')}
    </div>
    <div class="qi-inline-snooze">
      <a href="#" onclick="snoozeInlineRating(7);return false;">Not now</a>
      <a href="#" onclick="snoozeInlineRating(30);return false;">Stop asking</a>
    </div>`;
  document.body.appendChild(el);
  // Auto-dismiss after 25s if untouched
  el._timer = setTimeout(() => { dismissInlineRating(true); }, 25000);
}

function submitInlineRating(feature, rating) {
  const wrap = document.getElementById('qiInlineRating');
  if (wrap) {
    clearTimeout(wrap._timer);
    wrap.querySelectorAll('.qi-inline-stars button').forEach((b, i) => {
      b.classList.toggle('selected', (i + 1) <= rating);
      b.disabled = true;
    });
    // Slide a tiny comment input
    const commentRow = document.createElement('div');
    commentRow.className = 'qi-inline-comment';
    commentRow.innerHTML = `
      <input type="text" id="qiInlineComment" placeholder="(optional) one-line comment" maxlength="200">
      <button onclick="finishInlineRating('${feature}', ${rating})">Send</button>`;
    wrap.appendChild(commentRow);
    setTimeout(() => document.getElementById('qiInlineComment')?.focus(), 50);
    // If user does nothing for 8s, auto-send rating only
    wrap._submitTimer = setTimeout(() => finishInlineRating(feature, rating), 8000);
  } else {
    logQI('inline_rating_submitted', { metadata: { feature, rating, comment: null } });
  }
}

function finishInlineRating(feature, rating) {
  const wrap = document.getElementById('qiInlineRating');
  const comment = document.getElementById('qiInlineComment')?.value?.trim() || null;
  if (wrap) { clearTimeout(wrap._submitTimer); }
  logQI('inline_rating_submitted', { metadata: { feature, rating, comment } });
  if (wrap) {
    wrap.innerHTML = '<div class="qi-inline-thanks">Thanks for the rating!</div>';
    setTimeout(() => wrap.remove(), 1500);
  }
}

function dismissInlineRating(timedOut) {
  const wrap = document.getElementById('qiInlineRating');
  if (!wrap) return;
  clearTimeout(wrap._timer);
  clearTimeout(wrap._submitTimer);
  if (timedOut) logQI('inline_rating_dismissed', { metadata: { reason: 'timeout' } });
  else          logQI('inline_rating_dismissed', { metadata: { reason: 'closed' } });
  wrap.remove();
}

function snoozeInlineRating(days) {
  const until = Date.now() + days * 24 * 60 * 60 * 1000;
  localStorage.setItem(_qiInlineSnoozeKey, JSON.stringify({ until }));
  logQI('inline_rating_dismissed', { metadata: { reason: days >= 30 ? 'stop' : 'snooze', days } });
  document.getElementById('qiInlineRating')?.remove();
}

// ===================== AUTO-INIT =====================
// Wrap switchView so every view change is logged as a page_view (admin-only data).
// Done after the DOM is ready to avoid racing with sessions.js definition.
(function bootstrapAnalytics() {
  function attach() {
    if (typeof switchView === 'function' && !switchView._qiWrapped) {
      const orig = switchView;
      window.switchView = function(view) {
        try { logQIPageView(view); } catch(e) {}
        return orig.apply(this, arguments);
      };
      window.switchView._qiWrapped = true;
    }
    logQILandingFromURL();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();


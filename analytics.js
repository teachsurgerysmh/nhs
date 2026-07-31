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
  'password_reset','password_reset_requested','email_code_requested','passkey_enrolled',
  // Session lifecycle
  'session_created','session_edited','session_published','session_unpublished',
  'session_deleted','session_cancelled','session_completed','session_requested',
  // Teacher invitation flow. The bare verbs (invitation_confirm/decline/claim/
  // cancel) come from the one-click EMAIL action links; the -ed past-tense ones
  // come from in-app actions. Both shapes are live in the data — keep both.
  'invitation_sent','invitation_confirmed','invitation_declined',
  'invitation_confirm','invitation_decline','invitation_claim','invitation_cancel',
  'reschedule_requested','reminder_sent',
  'request_response_sent','cancellation_sent',
  // Attendance
  'attendance_self_marked','attendance_admin_marked','attendance_via_feedback',
  'attendance_approved','attendance_rejected','attendance_removed',
  'absence_reason_given',
  // Feedback
  'feedback_request_sent','feedback_reminder_sent','feedback_submitted',
  'feedback_qr_scan','feedback_link_opened',
  // Certificate
  'certificate_viewed','certificate_generated','certificate_downloaded',
  // Survey — pre-platform baseline
  'baseline_survey_started','baseline_survey_question_answered',
  'baseline_survey_completed','survey_email_one_click',
  // Survey — post-platform ("after") arm. Kept as separate event types rather
  // than a flag on the baseline events so the two funnels never blend in the
  // dashboard: the whole point is comparing them.
  'post_survey_started','post_survey_question_answered','post_survey_completed',
  // Registration funnel. learner_register only ever fired on SUCCESS, so
  // drop-off was invisible — registration_started gives the denominator.
  'registration_started','learner_approved',
  // Induction handbook + intro video. These pages are static and don't load
  // the app's JS, so they log through their own minimal poster (see the
  // inline QI script in each file).
  'induction_opened','induction_module_viewed','induction_search',
  'induction_gate_blocked','induction_cheatsheet_printed',
  'induction_nav_click','induction_link_click','induction_copy',
  'induction_session_summary',
  'intro_video_played','intro_video_completed',
  // takeflow.html — the public, no-sign-in flowchart page the office posters
  // point at. Separate from the handbook because it carries no contact details.
  'takeflow_opened',
  // Invite links (time-limited non-NHS registration)
  'invite_created','invite_revoked','invite_link_opened',
  'invite_link_redeemed','invite_link_rejected',
  // Password setup for pre-created (rota-seeded) accounts
  'setup_link_opened','setup_link_completed','setup_link_rejected',
  'setup_links_issued',
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
    if (p.get('feedback'))     { const fbSrc = p.get('src') || 'qr'; window._feedbackSource = fbSrc; logQI('feedback_link_opened', { metadata: { kind: 'feedback', session_id: p.get('feedback'), src: fbSrc }, session_id: parseInt(p.get('feedback')) || null, source: fbSrc }); }
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

    ${renderQITrafficBanner(d)}

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

  // ---- Induction handbook ----
  html += renderQIInductionSection(d);

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
  renderQIInductionChart();
}

// ===================== TRAFFIC QUALITY =====================
// NBT Mimecast pre-fetches every link in every email, so any metric that counts
// a GET on an emailed URL is inflated by an unknown amount. This sits ABOVE the
// KPIs deliberately: an unfiltered handbook figure was once read as "70% of
// readers turned away" when the true number was zero, and the same trap applies
// to feedback-link opens (54% discounted) and absence replies (90%).
//
// Committed actions are NOT affected and are not discounted here — feedback
// submissions, certificates, attendance and logins all require a POST after a
// click and every one carries an actor. Those numbers stand as they are.
function renderQITrafficBanner(d) {
  const t = d.traffic;
  if (!t || t.available === false || !t.kpis || !t.kpis.total_events) return '';
  const k = t.kpis;
  const num = v => (v === null || v === undefined ? 0 : Number(v));
  const discounted = num(k.total_named_automation) + num(k.total_probable_prefetch);
  if (!discounted) return '';

  const worst = (t.by_event || [])
    .filter(r => num(r.raw_events) >= 10 && num(r.pct_discounted) >= 25)
    .sort((a, b) => num(b.raw_events) - num(b.human_attributable) - (num(a.raw_events) - num(a.human_attributable)))
    .slice(0, 6);

  return `
    <div class="qi-card" style="border-left:4px solid var(--nhs-orange);background:#fffaf0;margin-bottom:18px;">
      <div style="font-weight:600;color:var(--nhs-dark-blue);margin-bottom:6px;">
        Traffic quality — ${discounted.toLocaleString()} of ${num(k.total_events).toLocaleString()} logged events are not people
      </div>
      <div style="font-size:13px;color:var(--nhs-dark-blue);line-height:1.55;margin-bottom:10px;">
        ${num(k.total_named_automation)} carry an outright automation user-agent;
        ${num(k.total_probable_prefetch)} are emailed-link opens with no actor arriving in bursts —
        the NBT Mimecast pre-fetch signature. <strong>Reach metrics below are inflated by this; committed
        actions (feedback submitted, certificates, attendance, logins) are not affected.</strong>
      </div>
      ${worst.length ? `<table class="qi-table" style="margin-top:6px;">
        <thead><tr><th>Metric</th><th>Raw</th><th>Real</th><th>Discounted</th></tr></thead>
        <tbody>
          ${worst.map(r => `<tr>
            <td><code style="font-size:11px;">${esc(r.event_type)}</code></td>
            <td>${r.raw_events}</td>
            <td><strong>${r.human_attributable}</strong></td>
            <td style="color:var(--nhs-red);font-weight:600;">${r.pct_discounted}%</td>
          </tr>`).join('')}
        </tbody>
      </table>` : ''}
      <div style="font-size:11px;color:var(--nhs-grey);margin-top:8px;line-height:1.5;">
        Quote the <strong>Real</strong> column. Nothing is deleted — the raw rows remain in
        <code>qi_events</code>, and the split is reproducible from <code>qi_traffic_quality</code>.
      </div>
    </div>`;
}

// ===================== INDUCTION HANDBOOK SECTION =====================
// induction.html is a self-contained bundle that never loads config.js, so it
// logs through its own inline poster (source='induction'). Those events landed
// in qi_events from the start but nothing aggregated them — handbook usage was
// invisible on this dashboard until v3.12.27 added the qi_induction_* views.
function renderQIInductionSection(d) {
  const ind = d.induction;
  const title = `<div class="qi-section-title">Induction handbook <span style="font-size:12px;color:var(--nhs-grey);font-weight:normal;">(induction.html — self-contained bundle)</span></div>`;

  if (!ind) {
    return title + `<div class="qi-card" style="color:var(--nhs-grey);font-size:13px;">
      The <code>qi-dashboard</code> Edge Function is on an older version and isn't returning handbook data yet.
      Redeploy it from <code>database/edge-function-qi-dashboard.ts</code>.</div>`;
  }
  if (ind.available === false) {
    return title + `<div class="qi-card" style="color:var(--nhs-red);font-size:13px;">
      Handbook views unavailable: ${esc(ind.error || 'unknown error')}.<br>
      Apply <code>database/migration_v3.12.27_qi_induction_views.sql</code> in the Supabase SQL editor.</div>`;
  }

  const k = ind.kpis || {};
  const num  = v => (v === null || v === undefined || v === '' ? null : Number(v));
  const fmt  = v => (v === null || v === undefined ? '—' : v);
  const pct  = v => (v === null || v === undefined ? '—' : v + '%');
  const secs = v => {
    const n = num(v);
    if (n === null || isNaN(n)) return '—';
    if (n < 60) return (Math.round(n * 10) / 10) + 's';
    const m = Math.floor(n / 60);
    return m + 'm ' + Math.round(n - m * 60) + 's';
  };
  const kpi = (label, value, sub) => `
    <div class="qi-kpi-card">
      <div class="qi-kpi-num">${fmt(value)}</div>
      <div class="qi-kpi-label">${label}</div>
      ${sub ? `<div class="qi-kpi-sub">${sub}</div>` : ''}
    </div>`;

  if (!num(k.page_loads)) {
    return title + `<div class="qi-card" style="color:var(--nhs-grey);font-size:13px;">
      No handbook activity recorded yet. Events appear here as soon as someone opens
      <code>induction.html</code>.</div>`;
  }

  let html = title;

  // Traffic quality first. NBT's Mimecast pre-fetches every link it sees, and
  // a prefetch looks exactly like a page load that bounced at the gate. Mixing
  // the two produced a "70% turned away" reading on this very data when the
  // real figure was zero — so the split is stated before any rate is.
  const botLoads  = num(k.bot_page_loads)   || 0;
  const lowSignal = num(k.low_signal_loads) || 0;
  if (botLoads || lowSignal) {
    html += `<div class="qi-card" style="border-left:4px solid var(--nhs-grey);margin-bottom:14px;font-size:13px;color:var(--nhs-dark-blue);line-height:1.6;">
      <strong>Traffic quality:</strong> ${fmt(k.all_page_loads)} raw page loads →
      <strong>${fmt(k.page_loads)}</strong> counted below.
      ${botLoads ? `${botLoads} excluded as automation (agent tooling, headless runs, named scanners).` : ''}
      ${lowSignal ? ` ${lowSignal} more were signed-out loads that hit the gate and vanished in under 5s with no interaction — consistent with Mimecast link pre-fetch, so they are counted but kept out of the engaged rate.` : ''}
    </div>`;
  }

  // Only shout about the gate when real people were actually turned away —
  // i.e. blocked loads that showed some sign of being human.
  const blockRate = num(k.gate_block_rate_engaged_pct);
  const blockedReal = num(k.gate_blocked_engaged);
  if (blockedReal > 0 && blockRate !== null && blockRate >= 20) {
    html += `<div class="qi-card" style="border-left:4px solid var(--nhs-red);background:#fff4f4;margin-bottom:14px;">
      <div style="font-weight:600;color:var(--nhs-red);margin-bottom:4px;">
        ${pct(k.gate_block_rate_engaged_pct)} of real handbook opens never got in
      </div>
      <div style="font-size:13px;color:var(--nhs-dark-blue);line-height:1.5;">
        ${fmt(k.gate_blocked_engaged)} page loads that look human hit the gate instead of the handbook —
        ${fmt(k.blocked_not_signed_in)} not signed in, ${fmt(k.blocked_pending_approval)} pending approval.
        Every one of those is someone who wanted the content and was turned away at the door.
      </div>
    </div>`;
  } else if (num(k.gate_blocked_visits) > 0) {
    html += `<div class="qi-card" style="border-left:4px solid var(--nhs-green);margin-bottom:14px;font-size:13px;color:var(--nhs-dark-blue);line-height:1.5;">
      <strong>Gate:</strong> ${fmt(k.gate_blocked_visits)} blocked loads, but
      <strong>${fmt(k.gate_blocked_engaged)}</strong> of them showed any sign of being a person.
      No evidence real readers are being turned away.
    </div>`;
  }

  html += `<div class="qi-kpi-grid">
      ${kpi('Handbook visits', k.visits, fmt(k.page_loads) + ' counted loads · ' + fmt(k.all_page_loads) + ' raw')}
      ${kpi('Unique readers', k.unique_readers, fmt(k.returning_visits) + ' returning visits (' + pct(k.returning_rate_pct) + ')')}
      ${kpi('Real gate-blocks', k.gate_blocked_engaged, fmt(k.gate_blocked_visits) + ' raw (' + pct(k.gate_block_rate_pct) + ') · ' + lowSignal + ' likely prefetch')}
      ${kpi('Median visit', secs(k.median_visit_seconds), 'mean ' + secs(k.mean_visit_seconds))}
      ${kpi('Bounce rate', pct(k.bounce_rate_pct), 'arrived, opened no module')}
      ${kpi('Modules per visit', k.mean_modules_per_visit, fmt(k.engaged_visits) + ' visits opened ≥1 module')}
      ${kpi('Module reads', k.module_views, fmt(k.distinct_modules_opened) + ' distinct modules touched')}
      ${kpi('Median dwell / module', secs(k.median_module_dwell_s), pct(k.pct_modules_read_to_end) + ' read to the end')}
      ${kpi('Searches', k.searches, fmt(k.zero_hit_searches) + ' returned nothing')}
      ${kpi('Copies', k.copy_events, 'bleeps / extensions lifted out')}
      ${kpi('Outbound clicks', k.outbound_clicks, fmt(k.print_events) + ' prints / PDF saves')}
      ${kpi('Device split', fmt(k.mobile_visits) + '/' + fmt(k.tablet_visits) + '/' + fmt(k.desktop_visits), 'mobile / tablet / desktop')}
      ${kpi('Intro video plays', k.intro_video_plays, fmt(k.intro_video_completions) + ' watched to the end')}
    </div>`;

  // ---- Daily trend ----
  if ((ind.daily || []).length > 1) {
    html += `<div class="qi-section-title">Handbook usage by day</div>
      <div class="qi-card"><canvas id="qiInductionChart" height="110"></canvas></div>`;
  }

  // ---- Modules ----
  html += `<div class="qi-section-title">Module engagement <span style="font-size:12px;color:var(--nhs-grey);font-weight:normal;">(logged on exit, so dwell is real reading time)</span></div>
    <div class="qi-card" style="overflow-x:auto;max-height:420px;overflow-y:auto;">
      <table class="qi-table">
        <thead><tr>
          <th>Module</th><th>Views</th><th>Visits</th><th>Readers</th>
          <th>Median dwell</th><th>Max dwell</th><th>Read to end</th><th>Median scroll</th>
          <th>Skimmed</th><th>Entered on</th><th>Left on</th>
        </tr></thead>
        <tbody>
          ${(ind.modules || []).length === 0
            ? `<tr><td colspan="11" style="text-align:center;color:var(--nhs-grey);padding:18px;">No modules opened yet.</td></tr>`
            : (ind.modules || []).map(m => {
                const skim = num(m.pct_skimmed);
                return `<tr>
                <td>${esc(m.title || m.module || '')}<div style="font-size:10px;color:var(--nhs-grey);"><code>${esc(m.module || '')}</code></div></td>
                <td><strong>${fmt(m.views)}</strong></td>
                <td>${fmt(m.unique_visits)}</td>
                <td>${fmt(m.unique_readers)}</td>
                <td>${secs(m.median_dwell_s)}</td>
                <td>${secs(m.max_dwell_s)}</td>
                <td>${pct(m.pct_reached_end)}</td>
                <td>${pct(m.median_scroll_pct)}</td>
                <td${skim !== null && skim >= 60 ? ' style="color:var(--nhs-red);font-weight:600;"' : ''}>${pct(m.pct_skimmed)}</td>
                <td>${fmt(m.entry_count)}</td>
                <td>${fmt(m.exit_count)}</td>
              </tr>`;
              }).join('')
          }
        </tbody>
      </table>
      <div style="font-size:11px;color:var(--nhs-grey);margin-top:8px;line-height:1.5;">
        <strong>Skimmed</strong> = share of views under 5 seconds. A module with high views and high skim
        is one people keep opening and not finding what they came for.
        <strong>Left on</strong> = visits that ended there.
      </div>
    </div>`;

  // ---- Searches: the content-gap list ----
  const zeroHits = (ind.searches || []).filter(s => num(s.zero_hit_count) > 0);
  html += `<div class="qi-section-title">Search — what people looked for</div>
    <div class="qi-card" style="overflow-x:auto;max-height:340px;overflow-y:auto;">
      ${zeroHits.length ? `<div style="background:#fff8e6;border-left:4px solid var(--nhs-warm-yellow,#ffb81c);padding:10px 12px;margin-bottom:12px;font-size:13px;color:var(--nhs-dark-blue);line-height:1.5;">
        <strong>${zeroHits.length} ${zeroHits.length === 1 ? 'query' : 'queries'} returned nothing.</strong>
        These are the handbook's content gaps, written by the readers themselves.
      </div>` : ''}
      <table class="qi-table">
        <thead><tr><th>Query</th><th>Times</th><th>Visits</th><th>Best hit count</th><th>Zero-hit</th><th>Last searched</th></tr></thead>
        <tbody>
          ${(ind.searches || []).length === 0
            ? `<tr><td colspan="6" style="text-align:center;color:var(--nhs-grey);padding:18px;">No searches logged yet.</td></tr>`
            : (ind.searches || []).map(s => `<tr${num(s.zero_hit_count) > 0 ? ' style="background:#fffaf0;"' : ''}>
                <td><strong>${esc(s.query || '')}</strong></td>
                <td>${fmt(s.search_count)}</td>
                <td>${fmt(s.unique_visits)}</td>
                <td>${fmt(s.max_hits)}</td>
                <td>${num(s.zero_hit_count) > 0 ? `<span style="color:var(--nhs-red);font-weight:600;">${s.zero_hit_count}</span>` : '—'}</td>
                <td>${s.last_searched_at ? new Date(s.last_searched_at).toLocaleDateString() : '—'}</td>
              </tr>`).join('')
          }
        </tbody>
      </table>
    </div>`;

  // ---- Navigation demand ----
  html += `<div class="qi-section-title">Navigation demand <span style="font-size:12px;color:var(--nhs-grey);font-weight:normal;">(what gets reached for)</span></div>
    <div class="qi-card" style="overflow-x:auto;max-height:340px;overflow-y:auto;">
      <table class="qi-table">
        <thead><tr><th>Destination</th><th>Type</th><th>Clicks</th><th>Visits</th><th>Last</th></tr></thead>
        <tbody>
          ${(ind.nav || []).length === 0
            ? `<tr><td colspan="5" style="text-align:center;color:var(--nhs-grey);padding:18px;">No navigation logged yet.</td></tr>`
            : (ind.nav || []).map(n => `<tr>
                <td>${esc(n.label || n.destination || '')}<div style="font-size:10px;color:var(--nhs-grey);"><code>${esc(n.destination || '')}</code></div></td>
                <td><span class="qi-pill" style="background:${n.kind === 'category' ? '#e0f5fa' : '#e6f4ea'};color:${n.kind === 'category' ? 'var(--nhs-blue)' : 'var(--nhs-green)'};">${esc(n.kind || '')}</span></td>
                <td><strong>${fmt(n.clicks)}</strong></td>
                <td>${fmt(n.unique_visits)}</td>
                <td>${n.last_clicked_at ? new Date(n.last_clicked_at).toLocaleDateString() : '—'}</td>
              </tr>`).join('')
          }
        </tbody>
      </table>
    </div>`;

  // ---- Outbound links ----
  if ((ind.links || []).length) {
    html += `<div class="qi-section-title">Outbound links used</div>
      <div class="qi-card" style="overflow-x:auto;max-height:280px;overflow-y:auto;">
        <table class="qi-table">
          <thead><tr><th>Link</th><th>From module</th><th>Clicks</th><th>Visits</th><th>Last</th></tr></thead>
          <tbody>
            ${(ind.links || []).map(l => `<tr>
              <td style="max-width:380px;word-break:break-all;"><code style="font-size:11px;">${esc(l.href || '')}</code></td>
              <td>${esc(l.module || '—')}</td>
              <td>${fmt(l.clicks)}</td>
              <td>${fmt(l.unique_visits)}</td>
              <td>${l.last_clicked_at ? new Date(l.last_clicked_at).toLocaleDateString() : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // ---- Individual journeys ----
  html += `<div class="qi-section-title">Recent visits <span style="font-size:12px;color:var(--nhs-grey);font-weight:normal;">(most recent 200 — each row is one page load)</span></div>
    <div class="qi-card" style="overflow-x:auto;max-height:420px;overflow-y:auto;">
      <table class="qi-table">
        <thead><tr>
          <th>When</th><th>Who</th><th>Device</th><th>Outcome</th>
          <th>Duration</th><th>Modules</th><th>Path</th><th>Searches</th><th>Exit</th>
        </tr></thead>
        <tbody>
          ${(ind.visits || []).map(v => {
            const path = Array.isArray(v.path) ? v.path : [];
            const outcome = v.was_gate_blocked
              ? `<span style="color:var(--nhs-red);">blocked · ${esc(v.gate_reason || '')}</span>`
              : (v.reached_content ? 'opened' : 'partial');
            const tag = v.is_bot
              ? ' <span style="font-size:10px;color:var(--nhs-grey);">[bot]</span>'
              : (v.is_low_signal ? ' <span style="font-size:10px;color:var(--nhs-grey);">[likely prefetch]</span>' : '');
            return `<tr${v.is_bot || v.is_low_signal ? ' style="opacity:0.55;"' : ''}>
              <td style="white-space:nowrap;">${v.started_at ? new Date(v.started_at).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
              <td>${esc(v.actor_name || v.actor_email || v.actor_type || 'public')}${v.is_returning ? ' <span style="font-size:10px;color:var(--nhs-grey);">(returning)</span>' : ''}</td>
              <td>${esc(v.device || '—')}</td>
              <td>${outcome}${tag}</td>
              <td>${secs(v.duration_s)}</td>
              <td>${fmt(v.modules_viewed)}</td>
              <td style="max-width:260px;font-size:11px;color:var(--nhs-grey);">${path.length ? esc(path.join(' → ')) : '—'}</td>
              <td>${fmt(v.searches)}${num(v.zero_hit_searches) > 0 ? ` <span style="color:var(--nhs-red);">(${v.zero_hit_searches} empty)</span>` : ''}</td>
              <td style="font-size:11px;color:var(--nhs-grey);">${esc(v.exit_reason || '—')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  return html;
}

// ---- Handbook daily trend chart ----
function renderQIInductionChart() {
  const rows = _qiData?.induction?.daily;
  if (!rows || rows.length < 2) return;
  const canvas = document.getElementById('qiInductionChart');
  if (!canvas) return;

  function draw() {
    const labels = rows.map(r => new Date(r.day).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }));
    if (window._qiIndChart) { try { window._qiIndChart.destroy(); } catch (e) {} }
    window._qiIndChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Visits',        data: rows.map(r => r.visits || 0),         borderColor: '#005eb8', tension: 0.3, fill: false },
          { label: 'Blocked',       data: rows.map(r => r.gate_blocked || 0),   borderColor: '#da291c', tension: 0.3, fill: false },
          { label: 'Modules read',  data: rows.map(r => r.modules_viewed || 0), borderColor: '#009639', tension: 0.3, fill: false },
          { label: 'Readers',       data: rows.map(r => r.unique_readers || 0), borderColor: '#41b6e6', tension: 0.3, fill: false },
          { label: 'Bot / prefetch', data: rows.map(r => r.bot_loads || 0),     borderColor: '#768692', borderDash: [4, 3], tension: 0.3, fill: false },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } },
      },
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

  const tq = _qiData.traffic;
  if (tq && tq.available !== false) {
    rows.push([]);
    rows.push(['== Traffic quality (bot / prefetch classification) ==']);
    rows.push(['event_type','raw_events','named_automation','probable_prefetch','human_attributable','pct_discounted','distinct_actors','prefetch_exposed']);
    (tq.by_event || []).forEach(r => rows.push([r.event_type, r.raw_events, r.named_automation, r.probable_prefetch, r.human_attributable, r.pct_discounted, r.distinct_actors, r.prefetch_exposed]));
  }

  const ind = _qiData.induction;
  if (ind && ind.available !== false) {
    rows.push([]);
    rows.push(['== Induction handbook KPIs ==']);
    Object.entries(ind.kpis || {}).forEach(([k, v]) => rows.push([k, v]));
    rows.push([]);
    rows.push(['== Induction modules ==']);
    rows.push(['module','title','views','unique_visits','unique_readers','median_dwell_s','mean_dwell_s','max_dwell_s','pct_reached_end','median_scroll_pct','pct_skimmed','entry_count','exit_count']);
    (ind.modules || []).forEach(m => rows.push([m.module, m.title, m.views, m.unique_visits, m.unique_readers, m.median_dwell_s, m.mean_dwell_s, m.max_dwell_s, m.pct_reached_end, m.median_scroll_pct, m.pct_skimmed, m.entry_count, m.exit_count]));
    rows.push([]);
    rows.push(['== Induction searches ==']);
    rows.push(['query','search_count','zero_hit_count','max_hits','unique_visits','last_searched_at']);
    (ind.searches || []).forEach(s => rows.push([s.query, s.search_count, s.zero_hit_count, s.max_hits, s.unique_visits, s.last_searched_at]));
    rows.push([]);
    rows.push(['== Induction navigation ==']);
    rows.push(['destination','kind','label','clicks','unique_visits']);
    (ind.nav || []).forEach(n => rows.push([n.destination, n.kind, n.label, n.clicks, n.unique_visits]));
    rows.push([]);
    rows.push(['== Induction daily ==']);
    rows.push(['day','page_loads','bot_loads','visits','gate_blocked','unique_readers','modules_viewed','searches','median_visit_seconds']);
    (ind.daily || []).forEach(r => rows.push([r.day, r.page_loads, r.bot_loads, r.visits, r.gate_blocked, r.unique_readers, r.modules_viewed, r.searches, r.median_visit_seconds]));
    rows.push([]);
    rows.push(['== Induction visits ==']);
    rows.push(['started_at','actor_type','actor_name','actor_email','device','is_bot','is_low_signal','reached_content','was_gate_blocked','gate_reason','duration_s','modules_viewed','path','searches','zero_hit_searches','exit_reason','is_returning','referrer','user_agent']);
    (ind.visits || []).forEach(v => rows.push([v.started_at, v.actor_type, v.actor_name, v.actor_email, v.device, v.is_bot, v.is_low_signal, v.reached_content, v.was_gate_blocked, v.gate_reason, v.duration_s, v.modules_viewed, (Array.isArray(v.path) ? v.path.join(' > ') : ''), v.searches, v.zero_hit_searches, v.exit_reason, v.is_returning, v.referrer, v.user_agent]));
  }

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


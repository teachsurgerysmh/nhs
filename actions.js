// Southmead Surgical Teaching — actions.js
// Action tokens (email confirm/decline/reschedule), URL parameter handling

// ===================== EMAIL ACTION LINKS =====================
function generateActionToken(sessionId, email) {
  return btoa(sessionId + ':' + (email || ''));
}

function validateActionToken(token, sessionId) {
  try {
    const decoded = atob(token);
    return decoded.startsWith(sessionId + ':');
  } catch(e) { return false; }
}

function getTeacherEmailFromToken(token) {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    return parts.length > 1 ? parts.slice(1).join(':') : '';
  } catch(e) { return ''; }
}

async function handleActionParams() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const sessionId = params.get('session');
  const token = params.get('token');

  if (!action || !sessionId || !token) return false;

  // Validate token
  if (!validateActionToken(token, sessionId)) {
    showActionLanding('Invalid Link', 'This link appears to be invalid or corrupted. Please contact the teaching team.', 'error');
    return true;
  }

  const teacherEmail = getTeacherEmailFromToken(token);

  // Fetch session directly from Supabase (don't rely on local events array,
  // which may not include unpublished sessions for non-admin users)
  let evData;
  try {
    const ACTION_SCHEDULE_COLS = 'id,day,date,month,year,time,room,topic,teacher,backup_teacher,status,published';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/schedule?id=eq.${sessionId}&select=${ACTION_SCHEDULE_COLS}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const rows = await response.json();
    if (rows && rows.length > 0) {
      const row = rows[0];
      evData = {
        id: row.id, day: row.day || '', date: row.date || '', month: row.month || '',
        year: row.year || 2026, time: row.time || '', room: row.room || '',
        topic: row.topic || '', teacher: row.teacher || '',
        status: row.status || 'tbd', published: row.published !== false,
        backupTeacher: row.backup_teacher || '',
      };
    }
  } catch(e) { console.error('Failed to fetch session:', e); }

  if (!evData) {
    showActionLanding('Session Not Found', 'This session could not be found. It may have been removed or rescheduled.', 'error');
    return true;
  }

  // Reschedule already renders a slot-picker the human must submit, so it is
  // scanner-safe. Confirm/decline/cancel/claim mutate, so they MUST NOT run on
  // page load — NHS email security (Mimecast) pre-fetches every link. Instead we
  // show a confirmation page with a button the human clicks to actually proceed.
  if (action === 'reschedule') {
    handleRescheduleAction(evData, teacherEmail, token);
    return true;
  } else if (action === 'confirm' || action === 'decline' || action === 'cancel' || action === 'claim') {
    promptEmailAction(action, evData, teacherEmail, token, params);
    return true;
  }

  return false;
}

// Stores the pending email action until the human clicks the confirm button.
let _pendingEmailAction = null;

// Step 1: render a confirmation page (no DB change). Defeats link pre-fetchers.
function promptEmailAction(action, ev, teacherEmail, token, params) {
  const carriedName = (params.get('name') || '').trim();
  const carriedTopic = (params.get('topic') || '').trim();

  // For claim, if our local snapshot already shows the slot taken, say so now.
  if (action === 'claim' && ev.teacher && ev.status !== 'cancelled') {
    showActionLanding('Slot No Longer Available',
      `<p>We're sorry — the slot on <strong>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}</strong> has just been taken.</p>
       <p>Please reply to your email or contact <a href="mailto:teachsurgerysmh@gmail.com">teachsurgerysmh@gmail.com</a> and we'll find you another date.</p>`, 'warning');
    return;
  }

  _pendingEmailAction = { action, ev, teacherEmail, token, carriedName, carriedTopic };

  const cfg = {
    confirm:  { title: 'Confirm your attendance',  intro: 'Please confirm you can teach this session:',        btn: 'Yes, I can attend',        cls: 'btn-green', type: 'success' },
    decline:  { title: 'Decline this session',      intro: 'Please confirm you are unable to teach this session:', btn: 'Yes, I cannot attend',     cls: 'btn-red',   type: 'warning' },
    cancel:   { title: 'Cancel this session',        intro: 'Please confirm you want to cancel this session:',     btn: 'Yes, cancel this session', cls: 'btn-red',   type: 'warning' },
    claim:    { title: 'Claim this slot',            intro: 'Please confirm you would like to teach this slot:',   btn: 'Yes, claim this slot',     cls: 'btn-green', type: 'success' }
  }[action];

  const displayTopic = ev.topic || carriedTopic || 'TBD';
  showActionLanding(cfg.title,
    `<p>${cfg.intro}</p>
     <table style="margin:16px 0;font-size:14px;">
       <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Topic:</td><td>${esc(displayTopic)}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date:</td><td>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Time:</td><td>${esc(ev.time || 'TBC')}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Room:</td><td>${esc(ev.room || 'TBC')}</td></tr>
     </table>
     <div style="margin-top:20px;text-align:center;">
       <button id="confirmActionBtn" class="btn ${cfg.cls}" style="padding:12px 32px;font-size:14px;" onclick="runPendingEmailAction(this)">${cfg.btn}</button>
     </div>
     <p style="color:var(--nhs-grey);font-size:12px;text-align:center;margin-top:14px;">Not you, or clicked by mistake? You can safely close this page — nothing changes until you press the button above.</p>`,
    cfg.type);
}

// Step 2: the human pressed the button — now actually perform the action.
async function runPendingEmailAction(btn) {
  const p = _pendingEmailAction;
  if (!p) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Please wait...'; }
  _pendingEmailAction = null;
  if (p.action === 'confirm')      await performConfirmAction(p.ev, p.teacherEmail, p.token);
  else if (p.action === 'decline') await performDeclineAction(p.ev, p.teacherEmail, p.token);
  else if (p.action === 'cancel')  await performCancelAction(p.ev, p.teacherEmail, p.token);
  else if (p.action === 'claim')   await performClaimAction(p.ev, p.teacherEmail, p.token, p.carriedName, p.carriedTopic);
}

// Calls a token-validated SECURITY DEFINER RPC. Needed because anon visitors
// (teachers clicking email links) cannot UPDATE schedule directly under RLS.
async function callSessionRpc(fn, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function performClaimAction(ev, teacherEmail, token, carriedName, carriedTopic) {
  carriedTopic = (carriedTopic || '').trim();
  const teacherName = (carriedName || '').trim() || ev.teacher || 'Colleague';
  try {
    const res = await callSessionRpc('claim_session_via_token', { p_session_id: Number(ev.id), p_token: token, p_name: teacherName, p_topic: carriedTopic });
    if (!res.ok) {
      let msg = ''; try { const j = await res.json(); msg = j.message || j.error || ''; } catch(_) {}
      if (msg.indexOf('already_taken') !== -1) {
        showActionLanding('Slot No Longer Available', `<p>We're sorry — the slot on <strong>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}</strong> has just been taken.</p><p>Please reply to your email or contact <a href="mailto:teachsurgerysmh@gmail.com">teachsurgerysmh@gmail.com</a> and we'll find you another date.</p>`, 'warning');
        return;
      }
      console.warn('claim_session_via_token failed:', res.status, msg);
      showActionLanding('Something Went Wrong', 'We could not record your claim. Please reply to your email or contact the teaching team.', 'error');
      return;
    }
    logQI('slot_claimed', { actor_type: 'teacher', actor_email: teacherEmail, session_id: ev.id, metadata: { topic: ev.topic || carriedTopic, channel: 'email_token' }, source: 'email' });
    showActionLanding(
      'Slot Claimed — Thank You!',
      `<p>Thank you, <strong>${esc(teacherName)}</strong>! You're confirmed to teach on:</p>
       <table style="margin:16px 0;font-size:14px;">
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Topic:</td><td>${esc(ev.topic || carriedTopic || 'TBD')}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date:</td><td>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Time:</td><td>${esc(ev.time || 'TBC')}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Room:</td><td>${esc(ev.room || 'TBC')}</td></tr>
       </table>
       <p>The teaching team will be in touch with any final details. Thank you for stepping in!</p>
       <p style="color:var(--nhs-grey);font-size:13px;margin-top:16px;">If your plans change, please contact <a href="mailto:teachsurgerysmh@gmail.com">teachsurgerysmh@gmail.com</a>.</p>`,
      'success'
    );
  } catch(e) {
    console.error('Claim action failed:', e);
    showActionLanding('Something Went Wrong', 'We could not record your claim. Please reply to your email or contact the teaching team.', 'error');
  }
}

async function performConfirmAction(ev, teacherEmail, token) {
  try {
    const res = await callSessionRpc('set_teacher_confirmed', { p_session_id: Number(ev.id), p_token: token, p_value: 'confirmed' });
    if (!res.ok) {
      console.warn('set_teacher_confirmed (confirm) failed:', res.status);
      showActionLanding('Could Not Record', 'We could not record your response automatically. Please reply to your email or contact <a href="mailto:teachsurgerysmh@gmail.com">teachsurgerysmh@gmail.com</a>.', 'error');
      return;
    }
    logQI('invitation_confirmed', { actor_type: 'teacher', actor_email: teacherEmail, session_id: ev.id, metadata: { topic: ev.topic, channel: 'email_token' }, source: 'email' });
    showActionLanding(
      'Attendance Confirmed',
      `<p>Thank you, <strong>${esc(ev.teacher || 'Colleague')}</strong>!</p>
       <p>You have confirmed your attendance for:</p>
       <table style="margin:16px 0;font-size:14px;">
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Topic:</td><td>${esc(ev.topic || 'TBD')}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date:</td><td>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Time:</td><td>${esc(ev.time || 'TBC')}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Room:</td><td>${esc(ev.room || 'TBC')}</td></tr>
       </table>
       <p style="color:var(--nhs-grey);font-size:13px;">If your plans change, please contact the teaching team.</p>`,
      'success'
    );
  } catch(e) {
    console.error('Confirm action failed:', e);
    showActionLanding('Confirmation Saved', 'Thank you for confirming. Your response has been recorded.', 'success');
  }
}

async function performDeclineAction(ev, teacherEmail, token) {
  try {
    const res = await callSessionRpc('set_teacher_confirmed', { p_session_id: Number(ev.id), p_token: token, p_value: 'declined' });
    if (!res.ok) {
      console.warn('set_teacher_confirmed (decline) failed:', res.status);
      showActionLanding('Could Not Record', 'We could not record your response automatically. Please reply to your email or contact <a href="mailto:teachsurgerysmh@gmail.com">teachsurgerysmh@gmail.com</a>.', 'error');
      return;
    }
    logQI('invitation_declined', { actor_type: 'teacher', actor_email: teacherEmail, session_id: ev.id, metadata: { topic: ev.topic, channel: 'email_token' }, source: 'email' });
    showActionLanding(
      'Response Recorded',
      `<p>Thank you for letting us know, <strong>${esc(ev.teacher || 'Colleague')}</strong>.</p>
       <p>We have noted that you are <strong>unable to attend</strong> the session:</p>
       <table style="margin:16px 0;font-size:14px;">
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Topic:</td><td>${esc(ev.topic || 'TBD')}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date:</td><td>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}</td></tr>
       </table>
       <p>The teaching team will arrange alternative cover. If you would like to reschedule, please contact <a href="mailto:teachsurgerysmh@gmail.com">teachsurgerysmh@gmail.com</a>.</p>`,
      'warning'
    );
  } catch(e) {
    console.error('Decline action failed:', e);
    showActionLanding('Response Recorded', 'Thank you for letting us know. The teaching team will be in touch.', 'warning');
  }
}

async function performCancelAction(ev, teacherEmail, token) {
  // The schedule update must happen server-side: anon visitors cannot UPDATE
  // schedule under RLS. self_cancel_session (SECURITY DEFINER RPC) validates the
  // token and flips the row to cancelled with the service role.
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/self_cancel_session`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_session_id: Number(ev.id), p_token: token })
    });
    if (!res.ok) {
      let msg = '';
      try { const j = await res.json(); msg = j.message || j.error || ''; } catch(_) {}
      console.warn('self_cancel_session failed:', res.status, msg);
      showActionLanding('Could Not Cancel', 'We could not cancel this session automatically. Please reply to your confirmation email or contact <a href="mailto:teachsurgerysmh@gmail.com">teachsurgerysmh@gmail.com</a> and we will sort it out.', 'error');
      return;
    }

    logQI('session_cancelled', { actor_type: 'teacher', actor_email: teacherEmail, session_id: ev.id, metadata: { topic: ev.topic, channel: 'email_token', self_cancel: true }, source: 'email' });

    // Fire both emails in real time (admin alert + teacher confirmation). Non-blocking on failure.
    try { if (typeof sendSelfCancelAdminNotice === 'function') await sendSelfCancelAdminNotice(ev, teacherEmail); } catch(e) { console.warn('admin notice failed', e); }
    try { if (typeof sendSelfCancelTeacherEmail === 'function') await sendSelfCancelTeacherEmail(ev, teacherEmail); } catch(e) { console.warn('teacher cancel email failed', e); }

    showActionLanding(
      'Session Cancelled',
      `<p>Thank you for letting us know, <strong>${esc(ev.teacher || 'Colleague')}</strong>. Your session has been cancelled:</p>
       <table style="margin:16px 0;font-size:14px;">
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Topic:</td><td>${esc(ev.topic || 'TBD')}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date:</td><td>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}</td></tr>
       </table>
       <p>We'd still love to have you teach — we've emailed you the next available dates, or you can <a href="${SITE_URL}?request=1">see all open slots here</a>.</p>`,
      'warning'
    );
  } catch(e) {
    console.error('Cancel action failed:', e);
    showActionLanding('Could Not Cancel', 'Something went wrong cancelling this session. Please reply to your confirmation email or contact the teaching team.', 'error');
  }
}

function handleRescheduleAction(ev, teacherEmail, token) {
  // Generate available slots (reuse logic from showRequestSessionModal)
  const today = new Date(); today.setHours(0,0,0,0);
  const DAYNAMES = ['Sun','Mon','Tues','Wed','Thurs','Fri','Sat'];
  const endDate = new Date(today.getFullYear() + 1, 11, 31);
  const allSlots = [];
  const d = new Date(today);
  while (d <= endDate) {
    const dow = d.getDay();
    if (dow === 2 || dow === 3) {
      const bankHol = getBankHoliday(d.getFullYear(), d.getMonth(), d.getDate());
      if (bankHol) { d.setDate(d.getDate() + 1); continue; }
      const dateStr = getOrdinal(d.getDate());
      const monthStr = MONTHS[d.getMonth()];
      const yearStr = String(d.getFullYear());
      const dayName = DAYNAMES[dow];
      const existing = events.filter(e => {
        const ed = eventToDate(e);
        return ed && ed.getTime() === d.getTime();
      });
      const fullyBooked = existing.length > 0 && existing.every(e => e.topic && e.teacher && e.status !== 'cancelled');
      if (!fullyBooked) {
        const partial = existing.find(e => e.status !== 'cancelled');
        const time = partial?.time || '';
        const room = partial?.room || '';
        allSlots.push({ dayName, dateStr, monthStr, yearStr, time, room, dateObj: new Date(d) });
      }
    }
    d.setDate(d.getDate() + 1);
  }

  let slotsHtml = '';
  if (allSlots.length === 0) {
    slotsHtml = '<p style="color:var(--nhs-grey);text-align:center;padding:20px;">No available slots at this time. Please contact the teaching team.</p>';
  } else {
    slotsHtml = `<p style="margin-bottom:12px;">Select a new date for your session <strong>"${esc(ev.topic || 'TBD')}"</strong>:</p>
      <ul class="slot-list" id="rescheduleSlotList">`;
    allSlots.slice(0, 20).forEach((s, i) => {
      const label = `${s.dayName} ${s.dateStr} ${s.monthStr} ${s.yearStr}${s.time ? ' (' + s.time + ')' : ''}${s.room ? ' - ' + s.room : ''}`;
      slotsHtml += `<li onclick="selectRescheduleSlot(this, ${i})" data-slot="${esc(label)}">${label}</li>`;
    });
    slotsHtml += `</ul>
      <div style="margin-top:12px;">
        <label style="font-size:13px;font-weight:600;color:var(--nhs-dark-blue);">Additional message (optional)</label>
        <textarea id="rescheduleMessage" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid var(--nhs-pale-grey);border-radius:var(--radius);font-size:13px;font-family:inherit;margin-top:4px;" placeholder="Any additional details..."></textarea>
      </div>
      <div style="margin-top:16px;text-align:center;">
        <button class="btn btn-green" style="padding:12px 32px;font-size:14px;" data-sid="${ev.id}" data-teacher="${esc(ev.teacher || '')}" data-topic="${esc(ev.topic || '')}" data-email="${esc(teacherEmail)}" data-token="${esc(token || '')}" onclick="submitRescheduleRequest(+this.dataset.sid, this.dataset.teacher, this.dataset.topic, this.dataset.email, this.dataset.token)">Submit Reschedule Request</button>
      </div>`;
  }

  showActionLanding(
    'Reschedule Session',
    `<p>You are requesting to reschedule your teaching session:</p>
     <table style="margin:12px 0;font-size:14px;">
       <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Current Date:</td><td>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Topic:</td><td>${esc(ev.topic || 'TBD')}</td></tr>
     </table>
     <hr style="border:none;border-top:1px solid var(--nhs-pale-grey);margin:16px 0;">
     ${slotsHtml}`,
    'reschedule'
  );
}

let selectedRescheduleSlot = null;

function selectRescheduleSlot(el, index) {
  document.querySelectorAll('#rescheduleSlotList li').forEach(li => li.classList.remove('selected'));
  el.classList.add('selected');
  selectedRescheduleSlot = el.dataset.slot;
}

async function submitRescheduleRequest(sessionId, teacher, topic, teacherEmail, token) {
  if (!selectedRescheduleSlot) { showToast('Please select a new slot'); return; }
  const message = document.getElementById('rescheduleMessage')?.value?.trim() || '';
  try {
    await sbInsert('requests', {
      name: teacher,
      email: teacherEmail,
      topic: topic,
      preferred_date: selectedRescheduleSlot,
      message: `Reschedule request from ${teacher} for session "${topic}". Preferred new date: ${selectedRescheduleSlot}. ${message}`.trim(),
      status: 'pending'
    });
    // Flag the session as reschedule_requested (server-side; anon cannot UPDATE schedule)
    try {
      if (token) await callSessionRpc('set_teacher_confirmed', { p_session_id: Number(sessionId), p_token: token, p_value: 'reschedule_requested' });
    } catch(e) { /* non-critical */ }
    // Notify the admins a reschedule request came in
    try { if (typeof sendNewRequestAdminNotice === 'function') await sendNewRequestAdminNotice({ name: teacher, email: teacherEmail, topic, preferred_date: selectedRescheduleSlot, message, kind: 'reschedule' }); } catch(e) { /* non-critical */ }
    logQI('reschedule_requested', { actor_type: 'teacher', actor_email: teacherEmail, session_id: sessionId, metadata: { topic, preferred: selectedRescheduleSlot, message: message || null }, source: 'email' });
    showActionLanding(
      'Reschedule Request Submitted',
      `<p>Thank you, <strong>${esc(teacher)}</strong>!</p>
       <p>Your request to reschedule to <strong>${esc(selectedRescheduleSlot)}</strong> has been submitted.</p>
       <p>The teaching team will review your request and get back to you shortly.</p>
       <p style="color:var(--nhs-grey);font-size:13px;margin-top:16px;">If you need to reach us urgently, email <a href="mailto:teachsurgerysmh@gmail.com">teachsurgerysmh@gmail.com</a>.</p>`,
      'success'
    );
    selectedRescheduleSlot = null;
  } catch(e) {
    console.error('Reschedule request failed:', e);
    showToast('Failed to submit reschedule request. Please try again.');
  }
}

function showActionLanding(title, bodyHtml, type) {
  const container = document.getElementById('actionLandingView');
  const iconMap = { success: '&#9989;', warning: '&#9888;&#65039;', error: '&#10060;', reschedule: '&#128197;' };
  const colorMap = { success: 'var(--nhs-green)', warning: 'var(--nhs-orange)', error: 'var(--nhs-red)', reschedule: 'var(--nhs-blue)' };
  container.innerHTML = `
    <div class="action-landing">
      <div class="action-landing-header">
        <div style="font-size:36px;margin-bottom:8px;">${iconMap[type] || ''}</div>
        <h2>${title}</h2>
      </div>
      <div class="action-landing-body">
        ${bodyHtml}
      </div>
    </div>`;
  switchView('actionLanding');
  // Hide nav bar for action landing pages
  document.querySelector('.nav-bar').style.display = 'none';
}

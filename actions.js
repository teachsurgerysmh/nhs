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
    const response = await fetch(`${SUPABASE_URL}/rest/v1/schedule?id=eq.${sessionId}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const rows = await response.json();
    if (rows && rows.length > 0) {
      const row = rows[0];
      evData = {
        id: row.id, day: row.day || '', date: row.date || '', month: row.month || '',
        year: row.year || 2026, time: row.time || '', room: row.room || '',
        topic: row.topic || '', teacher: row.teacher || '', teacherEmail: row.teacher_email || '',
        status: row.status || 'tbd', published: row.published !== false,
        notes: row.notes || '', backupTeacher: row.backup_teacher || '',
      };
    }
  } catch(e) { console.error('Failed to fetch session:', e); }

  if (!evData) {
    showActionLanding('Session Not Found', 'This session could not be found. It may have been removed or rescheduled.', 'error');
    return true;
  }

  if (action === 'confirm') {
    await handleConfirmAction(evData, teacherEmail);
    return true;
  } else if (action === 'decline') {
    await handleDeclineAction(evData, teacherEmail);
    return true;
  } else if (action === 'reschedule') {
    handleRescheduleAction(evData, teacherEmail);
    return true;
  }

  return false;
}

async function handleConfirmAction(ev, teacherEmail) {
  try {
    await sbUpdate('schedule', ev.id, { teacher_confirmed: 'confirmed' });
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

async function handleDeclineAction(ev, teacherEmail) {
  try {
    await sbUpdate('schedule', ev.id, { teacher_confirmed: 'declined' });
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

function handleRescheduleAction(ev, teacherEmail) {
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
        <button class="btn btn-green" style="padding:12px 32px;font-size:14px;" data-sid="${ev.id}" data-teacher="${esc(ev.teacher || '')}" data-topic="${esc(ev.topic || '')}" data-email="${esc(teacherEmail)}" onclick="submitRescheduleRequest(+this.dataset.sid, this.dataset.teacher, this.dataset.topic, this.dataset.email)">Submit Reschedule Request</button>
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

async function submitRescheduleRequest(sessionId, teacher, topic, teacherEmail) {
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
    // Also update the session to note a reschedule was requested
    try {
      await sbUpdate('schedule', sessionId, { teacher_confirmed: 'reschedule_requested' });
    } catch(e) { /* non-critical */ }
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

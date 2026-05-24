// Southmead Surgical Teaching — learner.js
// Attendance, feedback, dashboards, approvals, attendance chart, certificates

// ===================== ATTENDANCE =====================
async function markSelfAttendance(sessionId) {
  if (!currentLearner) { showToast('Please login first'); return; }
  try {
    const ev = events.find(e => e.id === sessionId);
    const sessionDate = ev ? eventToDate(ev) : null;
    const today = new Date(); today.setHours(0,0,0,0);
    const isToday = sessionDate && sessionDate.getTime() === today.getTime();
    const isPast = sessionDate && sessionDate < today;
    // Auto-approve only on session day; past and future both need approval
    const autoApprove = isToday;
    const attData = {
      session_id: sessionId,
      learner_id: currentLearner.id,
      method: 'self',
      status: autoApprove ? 'approved' : 'pending',
      retrospective: isPast ? true : false
    };
    await sbInsert('attendance', attData);
    logQI('attendance_self_marked', {
      session_id: sessionId,
      metadata: {
        approved: autoApprove,
        retrospective: isPast,
        hours_after_session: ev && sessionDate ? Math.round(((Date.now() - sessionDate.getTime()) / 36e5) * 10) / 10 : null
      }
    });
    showToast(autoApprove ? 'Attendance marked!' : 'Attendance submitted for approval');
  } catch(e) {
    if (e.message && e.message.includes('409')) {
      showToast('Already marked as attended');
    } else {
      console.error('Mark attendance failed:', e);
      showToast('Failed to mark attendance');
    }
  }
}

async function openAttendanceModal(sessionId) {
  const body = document.getElementById('attendanceModalBody');
  body.innerHTML = '<div style="text-align:center;padding:20px;"><div class="loading-spinner"></div></div>';
  openModal('attendanceModal');
  try {
    const [learners, contacts, existing] = await Promise.all([
      sbGet('learners', 'order=name.asc&select=*'),
      sbGet('contacts', 'order=name.asc&select=*'),
      sbGet('attendance', `session_id=eq.${sessionId}&status=neq.removed&select=*`)
    ]);
    const attendanceMap = {};
    existing.forEach(a => { attendanceMap[a.learner_id] = a; });
    const attendedIds = new Set(existing.map(a => a.learner_id));

    // Build set of contact emails that already have learner records
    const learnerEmails = new Set(learners.map(l => l.email.toLowerCase()));
    // Contacts without learner records (regs/cons/fellows who haven't registered)
    const unlinkedContacts = contacts.filter(c => c.email && !learnerEmails.has(c.email.toLowerCase()));

    let html = `<input type="hidden" id="attendanceSessionId" value="${sessionId}">`;
    html += `<div style="margin-bottom:12px;font-size:13px;color:var(--nhs-grey);">${learners.length} learners${unlinkedContacts.length ? ` + ${unlinkedContacts.length} contacts` : ''}</div>`;

    // Render attendance list
    const renderAttRow = (l, isContact) => {
      const att = attendanceMap[l.id];
      const status = att ? (att.status || 'approved') : '';
      let statusBadge = '';
      if (status === 'pending') statusBadge = '<span style="background:#fff4e0;color:var(--nhs-orange);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:6px;">PENDING</span>';
      else if (status === 'approved') statusBadge = '<span style="background:#e6f4ea;color:var(--nhs-green);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:6px;">APPROVED</span>';
      else if (status === 'rejected') statusBadge = '<span style="background:#fde8e8;color:var(--nhs-red);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:6px;">REJECTED</span>';
      const retroBadge = att && att.retrospective ? '<span style="background:#e0f5fa;color:var(--nhs-aqua);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:4px;">RETRO</span>' : '';
      const approveButtons = (status === 'pending') ? `<div style="display:flex;gap:4px;margin-left:auto;">
        <button class="btn btn-green" style="padding:3px 10px;font-size:11px;" onclick="approveAttendance(${att.id}, true, ${sessionId})">Approve</button>
        <button class="btn btn-red" style="padding:3px 10px;font-size:11px;" onclick="approveAttendance(${att.id}, false, ${sessionId})">Reject</button>
      </div>` : '';
      const prefix = isContact ? 'attc' : 'att';
      const gradeInfo = isContact ? (l.role || 'Contact') : `${l.grade} - ${l.placement}`;
      const contactBadge = isContact ? '<span style="background:#e0e7f5;color:#003087;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:4px;">CONTACT</span>' : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--nhs-pale-grey);">
        <input type="checkbox" id="${prefix}_${l.id}" value="${l.id}" data-type="${isContact ? 'contact' : 'learner'}" ${attendedIds.has(l.id) ? 'checked' : ''} style="width:18px;height:18px;">
        <label for="${prefix}_${l.id}" style="margin:0;font-size:13px;cursor:pointer;flex:1;">
          <strong>${esc(l.name)}</strong> <span style="color:var(--nhs-grey);">(${esc(gradeInfo)})</span>
          ${contactBadge}${statusBadge}${retroBadge}
        </label>
        ${approveButtons}
      </div>`;
    };

    if (learners.length === 0 && unlinkedContacts.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:var(--nhs-grey);">No learners or contacts found.</div>';
    } else {
      html += '<div style="max-height:400px;overflow-y:auto;">';
      // Learners first
      learners.forEach(l => { html += renderAttRow(l, false); });
      // Then unlinked contacts
      if (unlinkedContacts.length > 0) {
        html += `<div style="padding:10px 0 6px;font-size:12px;font-weight:700;color:var(--nhs-dark-blue);border-top:2px solid var(--nhs-pale-grey);margin-top:4px;">Other Contacts (Regs / Consultants / Fellows)</div>`;
        unlinkedContacts.forEach(c => { html += renderAttRow(c, true); });
      }
      html += '</div>';
    }
    // QR Code
    const qrUrl = `${SITE_URL}?attend=${sessionId}`;
    html += `<div style="margin-top:16px;padding:14px;background:var(--nhs-bg);border-radius:8px;text-align:center;">
      <div style="font-size:13px;font-weight:600;color:var(--nhs-dark-blue);margin-bottom:8px;">QR Code for Self-Registration</div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}" alt="QR Code" style="border-radius:8px;">
      <div style="font-size:11px;color:var(--nhs-grey);margin-top:6px;">Learners scan this to mark attendance</div>
    </div>`;
    body.innerHTML = html;
  } catch(e) { console.error('Load attendance failed:', e); body.innerHTML = '<div style="color:var(--nhs-red);padding:20px;">Failed to load attendance data.</div>'; }
}

async function saveAttendance() {
  const sessionId = parseInt(document.getElementById('attendanceSessionId').value);
  const checkboxes = document.querySelectorAll('#attendanceModalBody input[type="checkbox"]');
  const checkedLearnerIds = [];
  const uncheckedLearnerIds = [];
  const checkedContactIds = [];
  checkboxes.forEach(cb => {
    const type = cb.dataset.type;
    const id = parseInt(cb.value);
    if (type === 'contact') {
      if (cb.checked) checkedContactIds.push(id);
    } else {
      if (cb.checked) checkedLearnerIds.push(id);
      else uncheckedLearnerIds.push(id);
    }
  });
  try {
    // Auto-create learner records for checked contacts who don't have one yet
    for (const contactId of checkedContactIds) {
      try {
        const contact = await sbGet('contacts', `id=eq.${contactId}&select=*`);
        if (contact.length === 0) continue;
        const c = contact[0];
        // Check if learner already exists for this contact email
        const existingLearner = await sbGet('learners', `email=ilike.${encodeURIComponent(c.email)}&select=id`);
        let learnerId;
        if (existingLearner.length > 0) {
          learnerId = existingLearner[0].id;
        } else {
          // Create learner record linked to this contact
          const result = await sbInsert('learners', {
            name: c.name,
            email: c.email.toLowerCase(),
            grade: c.role || 'Consultant',
            placement: c.specialty || 'Surgery',
            contact_id: contactId,
            verified: true
          });
          learnerId = result[0].id;
        }
        checkedLearnerIds.push(learnerId);
      } catch(e) { console.warn('Contact->learner creation failed:', e); }
    }

    // Insert new attendance records
    for (const learnerId of checkedLearnerIds) {
      try {
        await sbInsert('attendance', { session_id: sessionId, learner_id: learnerId, method: 'admin', status: 'approved' });
        logQI('attendance_admin_marked', { session_id: sessionId, metadata: { learner_id: learnerId } });
      } catch(e) { /* ignore duplicates */ }
    }
    // Soft-delete unchecked (set status to 'removed' instead of hard DELETE)
    for (const learnerId of uncheckedLearnerIds) {
      try {
        if (isDemoMode) { console.log('[DEMO] Would remove attendance for learner', learnerId); continue; }
        const existing = await sbGet('attendance', `session_id=eq.${sessionId}&learner_id=eq.${learnerId}&select=id`);
        for (const att of existing) {
          await sbUpdate('attendance', att.id, { status: 'removed', approved_by: currentUser?.name || 'admin', approved_at: new Date().toISOString() });
          logQI('attendance_removed', { session_id: sessionId, metadata: { learner_id: learnerId, attendance_id: att.id } });
        }
      } catch(e) { /* ignore */ }
    }
    closeModal('attendanceModal');
    showToast('Attendance saved — sending feedback requests...');
    // Auto-trigger feedback emails to all marked attendees
    autoSendFeedbackRequests(sessionId, checkedLearnerIds);
  } catch(e) { console.error('Save attendance failed:', e); showToast('Failed to save attendance'); }
}

async function autoSendFeedbackRequests(sessionId, learnerIds) {
  if (!learnerIds.length) return;
  const ev = events.find(e => e.id === sessionId);
  if (!ev) return;
  try {
    // Build set of emails already sent today for this session (per-learner dedup)
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    let alreadySentEmails = new Set();
    try {
      const existingSends = await sbGet('feedback_sends', `session_id=eq.${sessionId}&sent_at=gte.${todayStart.toISOString()}&select=recipients`);
      existingSends.forEach(s => (s.recipients || []).forEach(e => alreadySentEmails.add(e.toLowerCase())));
    } catch(e) { /* continue anyway */ }

    const learners = await sbGet('learners', 'select=id,name,email');
    const existingFeedback = await sbGet('feedback', `session_id=eq.${sessionId}&select=learner_id`);
    const alreadySubmitted = new Set(existingFeedback.map(f => f.learner_id));
    const recipients = learners.filter(l =>
      learnerIds.includes(l.id) && l.email &&
      !alreadySubmitted.has(l.id) &&
      !alreadySentEmails.has(l.email.toLowerCase())
    );
    if (!recipients.length) {
      if (alreadySentEmails.size > 0) showToast('All attendees already received feedback requests today');
      return;
    }
    const fbUrl = SITE_URL + '?feedback=' + sessionId;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(fbUrl)}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#003087;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <img src="${LOGO_URL}" alt="Southmead Surgical Teaching" style="height:60px;width:auto;margin-bottom:8px;">
        <h2 style="color:white;margin:0;font-size:18px;">Southmead Surgical Teaching</h2>
      </div>
      <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
        <p>Dear Colleague,</p>
        <p>Thank you for attending today's teaching session on <strong>${ev.topic || 'Surgery'}</strong>.</p>
        <p>Your feedback is essential to improving our teaching programme. <strong>${SIGNING_CONSULTANT}</strong> personally reviews all feedback as part of the programme's quality assurance.</p>
        <p><strong>By submitting feedback you will:</strong></p>
        <ul>
          <li>Confirm your attendance record</li>
          <li>Earn CPD hours for this session</li>
          <li>Receive a certificate of attendance</li>
        </ul>
        <div style="text-align:center;margin:20px 0;">
          <a href="${fbUrl}" style="display:inline-block;padding:14px 36px;background:#009639;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">Submit Feedback</a>
        </div>
        <div style="text-align:center;margin:16px 0;">
          <img src="${qrUrl}" alt="Feedback QR" style="width:150px;height:150px;">
          <p style="font-size:11px;color:#768692;margin:4px 0 0;">Or scan this QR code</p>
        </div>
        <p style="font-size:12px;color:#4c6272;">This takes less than 2 minutes. Your responses may be shared anonymously with the presenter.</p>
        <p>Best regards,<br>Southmead Surgical Teaching Team<br><em>Under the supervision of ${SIGNING_CONSULTANT}</em></p>
      </div>
    </div>`;
    const emails = recipients.map(r => r.email);
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ to: emails, subject: `Feedback Request: ${ev.topic || 'Teaching Session'} - ${ev.day} ${ev.date} ${ev.month}`, html })
    });
    // Log the send with per-learner recipients
    try { await sbInsert('feedback_sends', { session_id: sessionId, method: 'auto', sent_by: currentUser?.username || 'system', recipient_count: emails.length, recipients: emails.map(e => e.toLowerCase()) }); } catch(le) { console.warn('Log send failed:', le); }
    logQI('feedback_request_sent', { session_id: sessionId, metadata: { recipients: emails.length, method: 'auto' } });
    const skipped = alreadySentEmails.size;
    showToast(`Feedback sent to ${emails.length} attendee${emails.length!==1?'s':''}${skipped ? ` (${skipped} already sent today)` : ''}`);
  } catch(e) { console.warn('Auto feedback send failed:', e); }
}

// ===================== FEEDBACK SYSTEM (10-point scale) =====================
const FEEDBACK_FIELDS = ['content_useful','structured','overall','presentation','delivery','applicable'];
const FEEDBACK_LABELS = {
  content_useful: 'Content useful & interesting',
  structured: 'Structured & organized',
  overall: 'Overall session',
  presentation: 'Presentation',
  delivery: 'Delivery',
  applicable: 'Applicable to workplace'
};
let feedbackRatings = {};

function initScaleRatings() {
  FEEDBACK_FIELDS.forEach(field => {
    feedbackRatings[field] = 0;
    const container = document.querySelector(`.scale-rating[data-field="${field}"] .scale-buttons`);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scale-btn';
      btn.textContent = i;
      btn.dataset.value = i;
      btn.onclick = () => setScaleRating(field, i);
      container.appendChild(btn);
    }
    // Add labels below
    const labels = document.createElement('div');
    labels.className = 'scale-labels';
    labels.innerHTML = '<span>Poor</span><span>Excellent</span>';
    container.parentNode.appendChild(labels);
  });
}

function setScaleRating(field, value) {
  feedbackRatings[field] = value;
  const container = document.querySelector(`.scale-rating[data-field="${field}"] .scale-buttons`);
  if (!container) return;
  container.querySelectorAll('.scale-btn').forEach(btn => {
    const v = parseInt(btn.dataset.value);
    btn.classList.remove('selected','low','mid','high');
    if (v === value) {
      btn.classList.add('selected');
      if (value <= 3) btn.classList.add('low');
      else if (value <= 6) btn.classList.add('mid');
      else btn.classList.add('high');
    }
  });
}

function openFeedbackModal(sessionId) {
  if (!currentLearner) { showToast('Please login as a learner first'); openLearnerLoginModal(); return; }
  const ev = events.find(e => e.id === sessionId);
  if (!ev) { showToast('Session not found'); return; }
  document.getElementById('feedbackSessionId').value = sessionId;
  document.getElementById('feedbackSessionInfo').innerHTML = `<strong>${esc(ev.topic || 'Session')}</strong><br>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year} | ${esc(ev.teacher || 'TBD')}`;
  feedbackRatings = {};
  FEEDBACK_FIELDS.forEach(f => feedbackRatings[f] = 0);
  initScaleRatings();
  document.getElementById('feedbackGoodAspects').value = '';
  document.getElementById('feedbackImproveAspects').value = '';
  document.getElementById('feedbackAnonymous').checked = false;
  openModal('feedbackModal');
}

async function submitFeedback() {
  if (!currentLearner) { showToast('Please login first'); return; }
  const sessionId = parseInt(document.getElementById('feedbackSessionId').value);
  // Block teachers from reviewing their own sessions
  const ev = events.find(e => e.id === sessionId);
  if (ev && currentLearner && ev.teacherEmail && ev.teacherEmail.toLowerCase() === currentLearner.email.toLowerCase()) {
    showToast('You cannot submit feedback for a session you taught'); return;
  }
  if (currentTeacher && ev && ev.teacherEmail && ev.teacherEmail.toLowerCase() === currentTeacher.email.toLowerCase()) {
    showToast('You cannot submit feedback for a session you taught'); return;
  }
  if (!feedbackRatings.overall) { showToast('Please rate the session overall'); return; }
  const data = {
    session_id: sessionId,
    learner_id: currentLearner.id,
    anonymous: document.getElementById('feedbackAnonymous').checked,
    rating_content_useful: feedbackRatings.content_useful || null,
    rating_structured: feedbackRatings.structured || null,
    rating_overall: feedbackRatings.overall,
    rating_presentation: feedbackRatings.presentation || null,
    rating_delivery: feedbackRatings.delivery || null,
    rating_applicable: feedbackRatings.applicable || null,
    good_aspects: document.getElementById('feedbackGoodAspects').value.trim(),
    improve_aspects: document.getElementById('feedbackImproveAspects').value.trim()
  };
  try {
    await sbInsert('feedback', data);
    // Compute "hours from feedback request → submission" if any feedback_request_sent event exists
    let hoursAfterRequest = null;
    try {
      const sentEvts = await sbGet('qi_events', `session_id=eq.${sessionId}&event_type=eq.feedback_request_sent&order=created_at.asc&limit=1`);
      if (sentEvts && sentEvts.length) hoursAfterRequest = Math.round(((Date.now() - new Date(sentEvts[0].created_at).getTime()) / 36e5) * 10) / 10;
    } catch(e) { /* RLS blocks anon read of qi_events — that's fine, just don't compute */ }
    logQI('feedback_submitted', {
      session_id: sessionId,
      metadata: {
        anonymous: data.anonymous,
        ratings: { overall: data.rating_overall, content: data.rating_content_useful, structured: data.rating_structured, presentation: data.rating_presentation, delivery: data.rating_delivery, applicable: data.rating_applicable },
        good_aspects_len: (data.good_aspects || '').length,
        improve_aspects_len: (data.improve_aspects || '').length,
        hours_after_first_request: hoursAfterRequest
      }
    });
    closeModal('feedbackModal');
    showToast('Thank you for your feedback! Your attendance has been recorded.');
    // Auto-mark attendance if not already marked
    try {
      const existing = await sbGet('attendance', `session_id=eq.${sessionId}&learner_id=eq.${currentLearner.id}`);
      if (existing.length === 0) {
        await sbInsert('attendance', { session_id: sessionId, learner_id: currentLearner.id, method: 'feedback', status: 'approved' });
        logQI('attendance_via_feedback', { session_id: sessionId });
      }
    } catch(ae) { console.log('Auto-attendance skip:', ae); }
    // Offer inline rating on the feedback flow
    setTimeout(() => askInlineRating('feedback_form'), 600);
  } catch(e) {
    console.error('Submit feedback failed:', e);
    if (e.message && e.message.includes('409')) {
      showToast('You have already submitted feedback for this session');
    } else {
      showToast('Failed to submit feedback');
    }
  }
}

// ===================== FEEDBACK NUDGE =====================
let _nudgeSessionId = null;
async function checkFeedbackNudge() {
  if (!currentLearner) return;
  try {
    const [attendance, feedback] = await Promise.all([
      sbGet('attendance', `learner_id=eq.${currentLearner.id}&status=eq.approved&select=session_id`),
      sbGet('feedback', `learner_id=eq.${currentLearner.id}&select=session_id`)
    ]);
    const feedbackSids = new Set(feedback.map(f => f.session_id));
    const missing = attendance.filter(a => !feedbackSids.has(a.session_id));
    if (missing.length > 0) {
      const sid = missing[0].session_id;
      const ev = events.find(e => e.id === sid);
      if (ev) {
        _nudgeSessionId = sid;
        const banner = document.getElementById('feedbackNudgeBanner');
        document.getElementById('feedbackNudgeText').textContent =
          `📝 You attended "${ev.topic || 'a session'}" — please submit your feedback to receive your CPD certificate!`;
        banner.style.display = '';
      }
    }
  } catch(e) { console.log('Nudge check skipped:', e); }
}
function openNudgedFeedback() {
  document.getElementById('feedbackNudgeBanner').style.display = 'none';
  if (_nudgeSessionId) openFeedbackModal(_nudgeSessionId);
}

// ===================== FEEDBACK ADMIN VIEW (10-point) =====================
function fbAvg(items, field) {
  const vals = items.filter(f => f[field]).map(f => f[field]);
  return vals.length ? (vals.reduce((s,v) => s+v, 0) / vals.length).toFixed(1) : '-';
}
function fbScoreColor(score) {
  if (score <= 3) return '#da291c';
  if (score <= 6) return '#ed8b00';
  return 'var(--nhs-green)';
}
function fbScoreBar(label, score, max=10) {
  const pct = score !== '-' ? (parseFloat(score)/max*100) : 0;
  const color = score !== '-' ? fbScoreColor(parseFloat(score)) : '#ccc';
  return `<div class="score-bar"><span class="score-bar-label">${label}</span><div class="score-bar-track"><div class="score-bar-fill" style="width:${pct}%;background:${color};"></div></div><span class="score-bar-value" style="color:${color};">${score}/10</span></div>`;
}

async function loadFeedbackView(filterTeacher) {
  const container = document.getElementById(filterTeacher ? 'teacherDashView' : 'feedbackView');
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading feedback...</div>';
  try {
    let feedback = await sbGet('feedback', 'order=submitted_at.desc&select=*');
    const learners = await sbGet('learners', 'select=id,name');
    const learnerMap = {};
    learners.forEach(l => learnerMap[l.id] = l.name);

    // If teacher view, filter to their sessions only
    if (filterTeacher) {
      const teacherSessions = events.filter(e => e.teacherEmail && e.teacherEmail.toLowerCase() === filterTeacher.toLowerCase()).map(e => e.id);
      feedback = feedback.filter(f => teacherSessions.includes(f.session_id));
    }

    let html = filterTeacher
      ? '<h3 style="color:var(--nhs-dark-blue);margin-bottom:16px;">Your Session Feedback</h3>'
      : '<h3 style="color:var(--nhs-dark-blue);margin-bottom:16px;">Feedback Overview</h3>';

    if (feedback.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">No feedback submitted yet.</div>';
      container.innerHTML = html;
      return;
    }

    // Overall stats - 10-point scale
    const avgOverall = fbAvg(feedback, 'rating_overall');
    const avgContent = fbAvg(feedback, 'rating_content_useful');
    const avgStructured = fbAvg(feedback, 'rating_structured');
    const avgPresentation = fbAvg(feedback, 'rating_presentation');
    const avgDelivery = fbAvg(feedback, 'rating_delivery');
    const avgApplicable = fbAvg(feedback, 'rating_applicable');

    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:20px;">
      <div class="stat-card"><div class="stat-num" style="color:${fbScoreColor(parseFloat(avgOverall)||5)}">${avgOverall}</div><div class="stat-label">Overall /10</div></div>
      <div class="stat-card"><div class="stat-num">${avgContent}</div><div class="stat-label">Content /10</div></div>
      <div class="stat-card"><div class="stat-num">${avgDelivery}</div><div class="stat-label">Delivery /10</div></div>
      <div class="stat-card"><div class="stat-num">${avgPresentation}</div><div class="stat-label">Presentation /10</div></div>
      <div class="stat-card"><div class="stat-num">${feedback.length}</div><div class="stat-label">Responses</div></div>
    </div>`;

    // Score bars
    html += '<div class="dashboard-card" style="margin-bottom:16px;"><h4>Average Scores</h4>';
    html += fbScoreBar('Content useful & interesting', avgContent);
    html += fbScoreBar('Structured & organized', avgStructured);
    html += fbScoreBar('Overall session', avgOverall);
    html += fbScoreBar('Presentation', avgPresentation);
    html += fbScoreBar('Delivery', avgDelivery);
    html += fbScoreBar('Applicable to workplace', avgApplicable);
    html += '</div>';

    // Export button for teachers
    if (filterTeacher) {
      html += `<div style="margin-bottom:16px;display:flex;gap:8px;">
        <button class="btn" style="background:#003087;color:white;border:none;" onclick="exportTeacherFeedbackCSV('${filterTeacher}')">Export Feedback CSV</button>
        <button class="btn" style="background:#ed8b00;color:white;border:none;" onclick="generateTeacherCertificate()">Certificate (All Sessions)</button>
      </div>`;
    }

    // Filter controls
    html += `<div style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <select id="feedbackFilterSession" onchange="filterFeedbackCards()" style="padding:8px 12px;border:1.5px solid var(--nhs-pale-grey);border-radius:var(--radius);font-size:13px;">
        <option value="">All sessions</option>
        ${[...new Set(feedback.map(f => f.session_id))].map(sid => {
          const ev = events.find(e => e.id === sid);
          return `<option value="${sid}">${ev ? esc(ev.topic || ev.date + ' ' + ev.month) : 'Session #' + sid}</option>`;
        }).join('')}
      </select>
    </div>`;

    // Per-session breakdown
    const bySession = {};
    feedback.forEach(f => { if (!bySession[f.session_id]) bySession[f.session_id] = []; bySession[f.session_id].push(f); });

    html += '<div id="feedbackCards">';
    for (const [sid, items] of Object.entries(bySession)) {
      const ev = events.find(e => e.id === parseInt(sid));
      const sessionLabel = ev ? `${ev.topic || 'TBD'} - ${ev.day} ${ev.date} ${ev.month} ${ev.year}` : 'Session #' + sid;
      const sessionAvg = fbAvg(items, 'rating_overall');
      html += `<div class="feedback-session-group" data-session="${sid}">
        <div style="background:var(--nhs-bg);border-radius:8px;padding:12px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
          <div><strong>${esc(sessionLabel)}</strong><br><span style="font-size:12px;color:var(--nhs-grey);">${items.length} response${items.length!==1?'s':''}</span></div>
          <div style="font-size:20px;font-weight:700;color:${fbScoreColor(parseFloat(sessionAvg)||5)};">${sessionAvg}/10</div>
        </div>`;
      // Session score bars
      html += '<div style="padding:0 8px 12px;">';
      html += fbScoreBar('Content', fbAvg(items,'rating_content_useful'));
      html += fbScoreBar('Structured', fbAvg(items,'rating_structured'));
      html += fbScoreBar('Presentation', fbAvg(items,'rating_presentation'));
      html += fbScoreBar('Delivery', fbAvg(items,'rating_delivery'));
      html += fbScoreBar('Applicable', fbAvg(items,'rating_applicable'));
      html += '</div>';

      items.forEach(f => {
        const name = (filterTeacher || f.anonymous) ? 'Anonymous' : (learnerMap[f.learner_id] || 'Unknown');
        html += `<div class="feedback-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:600;color:var(--nhs-dark-blue);">${esc(name)}</span>
            <span style="font-size:11px;color:var(--nhs-grey);">${f.submitted_at ? new Date(f.submitted_at).toLocaleDateString() : ''}</span>
          </div>
          <div style="font-size:13px;display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
            <span style="background:${fbScoreColor(f.rating_overall||5)};color:white;padding:2px 8px;border-radius:4px;font-weight:600;">Overall: ${f.rating_overall||'-'}/10</span>
            ${f.rating_content_useful ? `<span style="font-size:12px;color:var(--nhs-grey);">Content: ${f.rating_content_useful}/10</span>` : ''}
            ${f.rating_delivery ? `<span style="font-size:12px;color:var(--nhs-grey);">Delivery: ${f.rating_delivery}/10</span>` : ''}
            ${f.rating_presentation ? `<span style="font-size:12px;color:var(--nhs-grey);">Presentation: ${f.rating_presentation}/10</span>` : ''}
          </div>
          ${f.good_aspects ? '<div style="font-size:13px;margin-top:6px;"><strong style="color:var(--nhs-green);">Good:</strong> ' + esc(f.good_aspects) + '</div>' : ''}
          ${f.improve_aspects ? '<div style="font-size:13px;margin-top:4px;"><strong style="color:#ed8b00;">Improve:</strong> ' + esc(f.improve_aspects) + '</div>' : ''}
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  } catch(e) { console.error('Load feedback failed:', e); container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">Failed to load feedback.</div>'; }
}

function filterFeedbackCards() {
  const sid = document.getElementById('feedbackFilterSession').value;
  document.querySelectorAll('.feedback-session-group').forEach(g => {
    g.style.display = (!sid || g.dataset.session === sid) ? '' : 'none';
  });
}

// ===================== TEACHER FEEDBACK EXPORT =====================
async function exportTeacherFeedbackCSV(teacherEmail) {
  const feedback = await sbGet('feedback', 'order=submitted_at.desc&select=*');
  const teacherSessions = events.filter(e => e.teacherEmail && e.teacherEmail.toLowerCase() === teacherEmail.toLowerCase()).map(e => e.id);
  const filtered = feedback.filter(f => teacherSessions.includes(f.session_id));
  const rows = [['Session','Date','Overall','Content','Structured','Presentation','Delivery','Applicable','Good Aspects','Areas to Improve','Submitted']];
  filtered.forEach(f => {
    const ev = events.find(e => e.id === f.session_id);
    rows.push([
      ev ? ev.topic : '', ev ? `${ev.date} ${ev.month} ${ev.year}` : '',
      f.rating_overall||'', f.rating_content_useful||'', f.rating_structured||'',
      f.rating_presentation||'', f.rating_delivery||'', f.rating_applicable||'',
      (f.good_aspects||'').replace(/"/g,'""'), (f.improve_aspects||'').replace(/"/g,'""'),
      f.submitted_at ? new Date(f.submitted_at).toLocaleDateString() : ''
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `feedback_${teacherEmail.split('@')[0]}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); showToast('Feedback exported');
}

// ===================== ADMIN DASHBOARD =====================
async function loadAdminDashboard() {
  const container = document.getElementById('adminDashView');
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading dashboard...</div>';

  try {
    // Gather counts
    const now = new Date(); now.setHours(0,0,0,0);
    const futureEvents = events.filter(e => isFutureEvent(e));
    const tbdSessions = futureEvents.filter(e => e.status === 'tbd' || (!e.teacher && e.published));
    const upcomingSessions = futureEvents.filter(e => e.status === 'upcoming' && e.published);
    const draftSessions = events.filter(e => !e.published && isFutureEvent(e));

    // Requests count
    let pendingRequests = 0;
    try {
      const reqs = await sbGet('session_requests', 'status=eq.pending&select=id');
      pendingRequests = reqs.length;
    } catch(e) {}

    // Approvals count
    let pendingApprovals = 0;
    try {
      const approvals = await sbGet('attendance', 'status=eq.pending&select=id');
      pendingApprovals = approvals.length;
    } catch(e) {}

    // Feedback count (recent 7 days)
    let recentFeedback = 0;
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const fb = await sbGet('feedback', `created_at=gte.${weekAgo}&select=id`);
      recentFeedback = fb.length;
    } catch(e) {}

    // This week sessions
    const today = new Date(); today.setHours(0,0,0,0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    const nextWeekEnd = new Date(endOfWeek);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

    const thisWeekSessions = futureEvents.filter(e => {
      const d = eventToDate(e);
      return d && d >= today && d <= nextWeekEnd && e.published;
    }).sort((a, b) => (eventToDate(a) || 0) - (eventToDate(b) || 0));

    // Build HTML
    let html = '';

    // ---- Action Centre ----
    html += '<div class="dash-section-header"><h3 style="font-size:16px;color:var(--nhs-dark-blue);border:none;padding:0;">Action Centre</h3></div>';
    html += '<div class="action-centre">';
    html += `<div class="action-card ${tbdSessions.length > 0 ? 'ac-warning' : 'ac-good'}" onclick="switchView('list');setFilter('tbd')">
      <div class="ac-count" style="color:${tbdSessions.length > 0 ? 'var(--nhs-orange)' : 'var(--nhs-green)'};">${tbdSessions.length}</div>
      <div class="ac-label">Needs Teacher</div></div>`;
    html += `<div class="action-card ${pendingRequests > 0 ? 'ac-urgent' : 'ac-good'}" onclick="switchViewFromDropdown('requests')">
      <div class="ac-count" style="color:${pendingRequests > 0 ? 'var(--nhs-red)' : 'var(--nhs-green)'};">${pendingRequests}</div>
      <div class="ac-label">Pending Requests</div></div>`;
    html += `<div class="action-card ${pendingApprovals > 0 ? 'ac-info' : 'ac-good'}" onclick="switchViewFromDropdown('approvals')">
      <div class="ac-count" style="color:${pendingApprovals > 0 ? 'var(--nhs-blue)' : 'var(--nhs-green)'};">${pendingApprovals}</div>
      <div class="ac-label">Pending Approvals</div></div>`;
    html += `<div class="action-card ac-info" onclick="switchViewFromDropdown('feedback')">
      <div class="ac-count" style="color:var(--nhs-blue);">${recentFeedback}</div>
      <div class="ac-label">Feedback (7 days)</div></div>`;
    html += `<div class="action-card ${draftSessions.length > 0 ? 'ac-warning' : 'ac-good'}" onclick="switchView('drafts')">
      <div class="ac-count" style="color:${draftSessions.length > 0 ? 'var(--nhs-orange)' : 'var(--nhs-green)'};">${draftSessions.length}</div>
      <div class="ac-label">Drafts</div></div>`;
    html += `<div class="action-card ac-good" onclick="switchView('list')">
      <div class="ac-count" style="color:var(--nhs-green);">${upcomingSessions.length}</div>
      <div class="ac-label">Upcoming</div></div>`;
    html += '</div>';

    // ---- Quick Actions ----
    html += '<div class="dash-section-header"><h3 style="font-size:16px;color:var(--nhs-dark-blue);border:none;padding:0;">Quick Actions</h3></div>';
    html += '<div class="quick-actions">';
    const isSuketu = (currentUser?.username || '').toLowerCase() === 'suketu' || (currentUser?.username || '').toLowerCase() === 'suketubatra';
    const actions = [
      { icon: '➕', text: 'Add Session',    action: "document.getElementById('addSessionBtn')?.click()" },
      { icon: '📧', text: 'Bulk Remind',    action: "openBulkEmailModal()" },
      { icon: '💬', text: 'WhatsApp',       action: "openBulkWhatsAppModal()" },
      { icon: '📋', text: 'Export CSV',     action: "exportCSV()" },
      { icon: '📥', text: 'Check Inbox',    action: "switchView('inbox')" },
      { icon: '👥', text: 'Contacts',       action: "switchView('contacts')" },
      { icon: '✅', text: 'Attendance',     action: "switchViewFromDropdown('attendanceChart')" },
      { icon: '📋', text: 'Roster',         action: "switchViewFromDropdown('roster')" },
      { icon: '💡', text: 'Topic Ideas',    action: "switchViewFromDropdown('ideas')" },
      { icon: '📊', text: 'QI Surveys',     action: "switchViewFromDropdown('surveyResults')" },
      ...(isSuketu ? [{ icon: '📈', text: 'QI Dashboard', action: "switchViewFromDropdown('qiDash')", highlight: true }] : []),
    ];
    actions.forEach(a => {
      const hl = a.highlight ? ' qa-tile-highlight' : '';
      html += `<div class="qa-tile${hl}" onclick="${a.action}"><div class="qa-icon">${a.icon}</div><div class="qa-text">${a.text}</div></div>`;
    });
    html += '</div>';

    // ---- This Week / Next Week ----
    html += '<div class="week-overview">';
    html += '<div class="dash-section-header"><h3>Coming Up</h3></div>';
    if (thisWeekSessions.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:var(--nhs-grey);font-size:13px;">No sessions scheduled for the next two weeks.</div>';
    } else {
      thisWeekSessions.forEach(s => {
        const d = eventToDate(s);
        const dayName = d ? d.toLocaleDateString('en-GB', { weekday: 'short' }) : '';
        const dateStr = d ? d.getDate() + '/' + (d.getMonth()+1) : '';
        const isToday = d && d.toDateString() === new Date().toDateString();
        const statusColor = s.status === 'upcoming' ? 'var(--nhs-aqua)' : s.status === 'tbd' ? 'var(--nhs-orange)' : s.status === 'completed' ? 'var(--nhs-green)' : 'var(--nhs-grey)';
        html += `<div class="week-session" onclick="showDetail(${s.id})">
          <div class="ws-date" style="${isToday ? 'background:var(--nhs-blue);color:white;border-radius:8px;padding:4px 8px;' : ''}">
            <div class="ws-day">${dayName}</div>${dateStr}
          </div>
          <div class="ws-info">
            <div class="ws-topic">${esc(s.topic || 'TBD')}</div>
            <div class="ws-meta">${esc(s.teacher || 'No teacher')} · ${esc(s.time || '')} · ${esc(s.room || '')}</div>
          </div>
          <span class="card-status" style="background:${statusColor}20;color:${statusColor};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;text-transform:uppercase;">${esc(s.status || 'tbd')}</span>
        </div>`;
      });
    }
    html += '</div>';

    // ---- Recent Activity Feed ----
    html += '<div class="activity-feed">';
    html += '<div class="dash-section-header"><h3>Recent Activity</h3></div>';

    // Build feed from multiple sources
    let feedItems = [];

    // Recent session changes (last edited)
    events.filter(e => e.lastEditedAt).sort((a, b) => new Date(b.lastEditedAt) - new Date(a.lastEditedAt)).slice(0, 5).forEach(e => {
      feedItems.push({
        icon: '✏️', bg: '#e0f5fa',
        text: `<strong>${esc(e.topic || 'Session')}</strong> updated${e.lastEditedBy ? ' by ' + esc(e.lastEditedBy) : ''}`,
        time: e.lastEditedAt ? timeAgo(new Date(e.lastEditedAt)) : '',
        ts: new Date(e.lastEditedAt || 0)
      });
    });

    // Pending requests
    try {
      const reqs = await sbGet('session_requests', 'order=created_at.desc&limit=3&select=*');
      reqs.forEach(r => {
        feedItems.push({
          icon: '📩', bg: '#fde8e8',
          text: `New request: <strong>${esc(r.topic || r.suggested_topic || 'Topic')}</strong> from ${esc(r.name || 'Anonymous')}`,
          time: r.created_at ? timeAgo(new Date(r.created_at)) : '',
          ts: new Date(r.created_at || 0)
        });
      });
    } catch(e) {}

    // Recent feedback
    try {
      const fb = await sbGet('feedback', 'order=created_at.desc&limit=3&select=*');
      fb.forEach(f => {
        feedItems.push({
          icon: '⭐', bg: '#fff4e0',
          text: `Feedback received${f.rating ? ' ('+f.rating+'/5)' : ''} for session #${f.session_id}`,
          time: f.created_at ? timeAgo(new Date(f.created_at)) : '',
          ts: new Date(f.created_at || 0)
        });
      });
    } catch(e) {}

    // Sort by time, show top 10
    feedItems.sort((a, b) => b.ts - a.ts);
    feedItems = feedItems.slice(0, 10);

    if (feedItems.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:var(--nhs-grey);font-size:13px;">No recent activity.</div>';
    } else {
      feedItems.forEach(item => {
        html += `<div class="feed-item">
          <div class="feed-icon" style="background:${item.bg};">${item.icon}</div>
          <div class="feed-text">${item.text}</div>
          <div class="feed-time">${item.time}</div>
        </div>`;
      });
    }
    html += '</div>';

    container.innerHTML = html;
  } catch(e) {
    console.error('Admin dashboard error:', e);
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">Failed to load dashboard.</div>';
  }
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ===================== LEARNER DASHBOARD =====================
async function loadDashboard() {
  const container = document.getElementById('dashboardView');
  if (!currentLearner) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">Please login as a learner to view your dashboard.</div>';
    return;
  }
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading dashboard...</div>';
  try {
    const attendance = await sbGet('attendance', `learner_id=eq.${currentLearner.id}&status=neq.removed&select=*`);
    const attendedSessionIds = attendance.map(a => a.session_id);
    const attendedSessions = events.filter(e => attendedSessionIds.includes(e.id));
    const totalHours = attendedSessions.length; // 1 hour per session default

    // Placement progress
    let placementProgress = 0;
    if (currentLearner.placement_start && currentLearner.placement_end) {
      const start = new Date(currentLearner.placement_start);
      const end = new Date(currentLearner.placement_end);
      const now = new Date();
      const total = end - start;
      const elapsed = now - start;
      placementProgress = Math.min(100, Math.max(0, Math.round(elapsed / total * 100)));
    }

    let html = `<h3 style="color:var(--nhs-dark-blue);margin-bottom:16px;">My Dashboard</h3>`;

    // Profile card
    html += `<div class="dashboard-card">
      <h4>Profile</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">
        <div><strong>Name:</strong> ${esc(currentLearner.name)}</div>
        <div><strong>Email:</strong> ${esc(currentLearner.email)}</div>
        <div><strong>Grade:</strong> ${esc(currentLearner.grade)}</div>
        <div><strong>Placement:</strong> ${esc(currentLearner.placement)}</div>
        ${currentLearner.placement_start ? '<div><strong>Start:</strong> ' + currentLearner.placement_start + '</div>' : ''}
        ${currentLearner.placement_end ? '<div><strong>End:</strong> ' + currentLearner.placement_end + '</div>' : ''}
      </div>
      ${currentLearner.placement_start && currentLearner.placement_end ? `
        <div style="margin-top:12px;">
          <div style="font-size:12px;color:var(--nhs-grey);margin-bottom:4px;">Placement Progress: ${placementProgress}%</div>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${placementProgress}%;"></div></div>
        </div>` : ''}
    </div>`;

    // CPD Stats
    html += `<div class="dashboard-card">
      <h4>CPD Summary</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;text-align:center;">
        <div class="stat-card"><div class="stat-num">${attendedSessions.length}</div><div class="stat-label">Sessions Attended</div></div>
        <div class="stat-card"><div class="stat-num">${totalHours}</div><div class="stat-label">CPD Hours</div></div>
      </div>
    </div>`;

    // Attendance list
    html += `<div class="dashboard-card">
      <h4>Sessions Attended</h4>`;
    if (attendedSessions.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:var(--nhs-grey);">No sessions attended yet. Mark your attendance on session cards!</div>';
    } else {
      html += '<table class="attendance-table"><thead><tr><th>Date</th><th>Topic</th><th>Teacher</th></tr></thead><tbody>';
      attendedSessions.sort((a, b) => { const da = eventToDate(a), db = eventToDate(b); return (db||0)-(da||0); });
      attendedSessions.forEach(s => {
        html += `<tr><td>${esc(s.day)} ${esc(s.date)} ${esc(s.month)} ${s.year}</td><td>${esc(s.topic || 'TBD')}</td><td>${esc(s.teacher || '-')}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    html += '</div>';

    // Generate Certificate button
    if (attendedSessions.length > 0) {
      html += `<div style="text-align:center;margin-top:16px;">
        <button class="btn btn-green" style="padding:12px 32px;font-size:14px;" onclick="generateCertificate()">Generate Certificate</button>
      </div>`;
    }

    container.innerHTML = html;
  } catch(e) { console.error('Load dashboard failed:', e); container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">Failed to load dashboard.</div>'; }
}

// ===================== ATTENDANCE APPROVAL =====================
async function approveAttendance(attendanceId, approve, sessionId) {
  try {
    await sbUpdate('attendance', attendanceId, {
      status: approve ? 'approved' : 'rejected',
      approved_by: currentUser ? currentUser.name : 'admin',
      approved_at: new Date().toISOString()
    });
    // No email — just update the record silently
    showToast(approve ? 'Attendance approved' : 'Attendance rejected');
    if (sessionId) openAttendanceModal(sessionId);
    if (currentView === 'approvals') loadApprovals();
  } catch(e) {
    console.error('Approve attendance failed:', e);
    showToast('Failed to update attendance');
  }
}

// ===================== APPROVALS VIEW =====================
async function loadApprovals() {
  const container = document.getElementById('approvalsView');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="loading-spinner"></div></div>';
  try {
    const [pending, recent] = await Promise.all([
      sbGet('attendance', 'status=eq.pending&select=*&order=marked_at.desc'),
      sbGet('attendance', 'status=in.(approved,rejected)&order=approved_at.desc.nullslast&limit=20&select=*')
    ]);
    const allLearnerIds = [...new Set([...pending, ...recent].map(a => a.learner_id))];
    let learnersMap = {};
    if (allLearnerIds.length > 0) {
      const learners = await sbGet('learners', `id=in.(${allLearnerIds.join(',')})&select=*`);
      learners.forEach(l => { learnersMap[l.id] = l; });
    }
    let html = '<h3 style="color:var(--nhs-dark-blue);margin-bottom:16px;">Attendance Approvals</h3>';

    // Pending
    html += '<h4 style="color:var(--nhs-orange);margin-bottom:10px;">Pending Approval (' + pending.length + ')</h4>';
    if (pending.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:var(--nhs-grey);background:white;border-radius:8px;margin-bottom:20px;">No pending approvals</div>';
    } else {
      html += '<div style="background:white;border-radius:8px;box-shadow:var(--shadow);margin-bottom:20px;overflow:hidden;">';
      pending.forEach(a => {
        const learner = learnersMap[a.learner_id] || {};
        const ev = events.find(e => e.id === a.session_id);
        const sessionLabel = ev ? `${esc(ev.topic || 'TBD')} - ${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}` : `Session #${a.session_id}`;
        const requestedDate = a.marked_at ? new Date(a.marked_at).toLocaleDateString('en-GB') : '';
        html += `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--nhs-pale-grey);flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <strong>${esc(learner.name || 'Unknown')}</strong> <span style="color:var(--nhs-grey);font-size:12px;">(${esc(learner.grade || '')} - ${esc(learner.placement || '')})</span>
            <div style="font-size:12px;color:var(--nhs-grey);margin-top:2px;">${sessionLabel}</div>
            <div style="font-size:11px;color:var(--nhs-grey);">Requested: ${requestedDate}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-green" style="padding:5px 14px;font-size:12px;" onclick="approveAttendance(${a.id}, true)">Approve</button>
            <button class="btn btn-red" style="padding:5px 14px;font-size:12px;" onclick="approveAttendance(${a.id}, false)">Reject</button>
          </div>
        </div>`;
      });
      html += '</div>';
    }

    // Recent
    html += '<h4 style="color:var(--nhs-grey);margin-bottom:10px;">Recently Processed</h4>';
    if (recent.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:var(--nhs-grey);background:white;border-radius:8px;">No recent approvals</div>';
    } else {
      html += '<div style="background:white;border-radius:8px;box-shadow:var(--shadow);overflow:hidden;">';
      recent.forEach(a => {
        const learner = learnersMap[a.learner_id] || {};
        const ev = events.find(e => e.id === a.session_id);
        const sessionLabel = ev ? `${esc(ev.topic || 'TBD')} - ${esc(ev.date)} ${esc(ev.month)}` : `Session #${a.session_id}`;
        const statusColor = a.status === 'approved' ? 'var(--nhs-green)' : 'var(--nhs-red)';
        const statusBg = a.status === 'approved' ? '#e6f4ea' : '#fde8e8';
        html += `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--nhs-pale-grey);">
          <div style="flex:1;">
            <strong style="font-size:13px;">${esc(learner.name || 'Unknown')}</strong>
            <span style="font-size:12px;color:var(--nhs-grey);"> - ${sessionLabel}</span>
          </div>
          <span style="background:${statusBg};color:${statusColor};font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;">${esc(a.status)}</span>
        </div>`;
      });
      html += '</div>';
    }
    container.innerHTML = html;
  } catch(e) {
    console.error('Load approvals failed:', e);
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-red);">Failed to load approvals.</div>';
  }
}

// ===================== MASTER ATTENDANCE CHART =====================
let attendanceChartMode = 'summary';
let _chartPlacementFilter = '';
let _chartDateFrom = '';
let _chartDateTo = '';

async function loadAttendanceChart() {
  const container = document.getElementById('attendanceChartView');
  // Preserve filter value before re-render
  const existingFilter = document.getElementById('chartPlacementFilter');
  if (existingFilter) _chartPlacementFilter = existingFilter.value;
  const existingFrom = document.getElementById('chartDateFrom');
  if (existingFrom) _chartDateFrom = existingFrom.value;
  const existingTo = document.getElementById('chartDateTo');
  if (existingTo) _chartDateTo = existingTo.value;
  container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="loading-spinner"></div></div>';
  try {
    const [learners, attendance] = await Promise.all([
      sbGet('learners', 'order=name.asc&select=*'),
      sbGet('attendance', 'status=eq.approved&select=*')
    ]);

    // Build attendance set
    const attendanceSet = new Set(attendance.map(a => `${a.learner_id}_${a.session_id}`));
    const pendingAttendance = new Set();
    // Also fetch pending for grid icons
    try {
      const pendingRecords = await sbGet('attendance', 'status=eq.pending&select=*');
      pendingRecords.forEach(a => pendingAttendance.add(`${a.learner_id}_${a.session_id}`));
    } catch(e) {}

    // Use shared rotation helper
    const currentRotationDates = getCurrentRotationDates();

    const allCompletedSessions = events.filter(e => e.status === 'completed' || !isFutureEvent(e));
    // Use custom date range if set, otherwise current rotation
    let filterStart = currentRotationDates.start;
    let filterEnd = currentRotationDates.end;
    if (_chartDateFrom) { filterStart = new Date(_chartDateFrom); filterStart.setHours(0,0,0,0); }
    if (_chartDateTo) { filterEnd = new Date(_chartDateTo); filterEnd.setHours(23,59,59,999); }
    const completedSessions = allCompletedSessions.filter(s => {
      const d = eventToDate(s);
      return d && d >= filterStart && d <= filterEnd;
    });
    completedSessions.sort((a, b) => { const da = eventToDate(a), db = eventToDate(b); return (da||0)-(db||0); });

    // Filter controls
    const fmtD = d => d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    const rangeLabel = (_chartDateFrom || _chartDateTo) ? `Custom: ${_chartDateFrom ? fmtD(new Date(_chartDateFrom)) : '...'} – ${_chartDateTo ? fmtD(new Date(_chartDateTo)) : '...'}` : `Current Rotation: ${fmtD(currentRotationDates.start)} – ${fmtD(currentRotationDates.end)}`;
    let html = `<h3 style="color:var(--nhs-dark-blue);margin-bottom:4px;">Master Attendance Chart</h3>`;
    html += `<p style="font-size:12px;color:var(--nhs-grey);margin-bottom:16px;">${rangeLabel} &middot; ${completedSessions.length} session(s)</p>`;
    html += '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">';
    html += `<select id="chartPlacementFilter" onchange="loadAttendanceChart()" style="padding:6px 12px;border:1.5px solid var(--nhs-pale-grey);border-radius:var(--radius);font-size:13px;">
      <option value="">All Placements</option>
      <option value="UGI" ${_chartPlacementFilter === 'UGI' ? 'selected' : ''}>UGI</option>
      <option value="LGI" ${_chartPlacementFilter === 'LGI' ? 'selected' : ''}>LGI</option>
      <option value="Transplant" ${_chartPlacementFilter === 'Transplant' ? 'selected' : ''}>Transplant</option>
      <option value="Vascular" ${_chartPlacementFilter === 'Vascular' ? 'selected' : ''}>Vascular</option>
    </select>`;
    html += `<button class="btn ${attendanceChartMode === 'summary' ? 'btn-green' : 'btn-outline'}" style="${attendanceChartMode !== 'summary' ? 'color:var(--nhs-grey);border-color:var(--nhs-pale-grey);' : ''}" onclick="attendanceChartMode='summary';loadAttendanceChart()">Summary View</button>`;
    html += `<button class="btn ${attendanceChartMode === 'grid' ? 'btn-green' : 'btn-outline'}" style="${attendanceChartMode !== 'grid' ? 'color:var(--nhs-grey);border-color:var(--nhs-pale-grey);' : ''}" onclick="attendanceChartMode='grid';loadAttendanceChart()">Grid View</button>`;
    html += `<span style="font-size:12px;color:var(--nhs-grey);margin-left:8px;">From</span>`;
    html += `<input type="date" id="chartDateFrom" value="${_chartDateFrom}" onchange="loadAttendanceChart()" style="padding:5px 8px;border:1.5px solid var(--nhs-pale-grey);border-radius:var(--radius);font-size:12px;">`;
    html += `<span style="font-size:12px;color:var(--nhs-grey);">To</span>`;
    html += `<input type="date" id="chartDateTo" value="${_chartDateTo}" onchange="loadAttendanceChart()" style="padding:5px 8px;border:1.5px solid var(--nhs-pale-grey);border-radius:var(--radius);font-size:12px;">`;
    html += `<button class="btn btn-outline" style="color:var(--nhs-grey);border-color:var(--nhs-pale-grey);font-size:11px;" onclick="_chartDateFrom='';_chartDateTo='';loadAttendanceChart()">Reset Dates</button>`;
    html += `<button class="btn btn-outline" style="color:var(--nhs-grey);border-color:var(--nhs-pale-grey);margin-left:auto;" onclick="exportAttendanceCSV()">Export CSV</button>`;
    html += '</div>';

    // Apply placement filter
    const placementFilter = _chartPlacementFilter;
    const filteredLearners = placementFilter ? learners.filter(l => l.placement === placementFilter) : learners;

    if (attendanceChartMode === 'grid') {
      // GRID VIEW
      html += '<div style="overflow-x:auto;background:white;border-radius:8px;box-shadow:var(--shadow);">';
      html += '<table style="border-collapse:collapse;font-size:12px;width:100%;">';
      html += '<thead><tr><th style="position:sticky;left:0;background:var(--nhs-dark-blue);color:white;padding:8px 12px;z-index:2;min-width:160px;text-align:left;">Learner</th>';
      completedSessions.forEach(s => {
        const d = eventToDate(s);
        const label = d ? `${d.getDate()}/${d.getMonth()+1}` : '';
        html += `<th style="background:var(--nhs-dark-blue);color:white;padding:6px 4px;font-size:10px;text-align:center;min-width:40px;writing-mode:vertical-lr;transform:rotate(180deg);" title="${esc(s.topic || 'TBD')}">${esc(s.topic ? s.topic.substring(0,15) : label)}</th>`;
      });
      html += '</tr></thead><tbody>';
      filteredLearners.forEach(l => {
        html += `<tr><td style="position:sticky;left:0;background:white;padding:6px 10px;border-bottom:1px solid var(--nhs-pale-grey);z-index:1;font-weight:600;white-space:nowrap;">${esc(l.name)} <span style="font-weight:400;color:var(--nhs-grey);font-size:10px;">(${esc(l.grade)})</span></td>`;
        completedSessions.forEach(s => {
          const key = `${l.id}_${s.id}`;
          let cell = '<span style="color:var(--nhs-pale-grey);">-</span>';
          if (attendanceSet.has(key)) cell = '<span style="color:var(--nhs-green);font-weight:700;">&#10003;</span>';
          else if (pendingAttendance.has(key)) cell = '<span style="color:var(--nhs-orange);">&#9201;</span>';
          // Check if session was during their placement
          if (l.placement_start && l.placement_end) {
            const sd = eventToDate(s);
            const ps = new Date(l.placement_start);
            const pe = new Date(l.placement_end);
            if (sd && (sd < ps || sd > pe)) cell = '<span style="color:var(--nhs-pale-grey);font-size:10px;">n/a</span>';
          }
          // But if they attended, always show the checkmark
          if (attendanceSet.has(key)) cell = '<span style="color:var(--nhs-green);font-weight:700;">&#10003;</span>';
          html += `<td style="text-align:center;padding:4px;border-bottom:1px solid var(--nhs-pale-grey);border-left:1px solid var(--nhs-pale-grey);">${cell}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    } else {
      // SUMMARY VIEW
      html += '<div style="background:white;border-radius:8px;box-shadow:var(--shadow);overflow-x:auto;">';
      html += '<table style="border-collapse:collapse;width:100%;font-size:13px;">';
      html += `<thead><tr>
        <th style="background:var(--nhs-dark-blue);color:white;padding:10px 12px;text-align:left;cursor:pointer;" onclick="sortAttendanceChart('name')">Name</th>
        <th style="background:var(--nhs-dark-blue);color:white;padding:10px 12px;text-align:left;cursor:pointer;" onclick="sortAttendanceChart('grade')">Grade</th>
        <th style="background:var(--nhs-dark-blue);color:white;padding:10px 12px;text-align:left;cursor:pointer;" onclick="sortAttendanceChart('placement')">Placement</th>
        <th style="background:var(--nhs-dark-blue);color:white;padding:10px 12px;text-align:left;cursor:pointer;" onclick="sortAttendanceChart('rotation')">Rotation</th>
        <th style="background:var(--nhs-dark-blue);color:white;padding:10px 12px;text-align:center;cursor:pointer;" onclick="sortAttendanceChart('attended')">Attended</th>
        <th style="background:var(--nhs-dark-blue);color:white;padding:10px 12px;text-align:center;cursor:pointer;" onclick="sortAttendanceChart('available')">Available</th>
        <th style="background:var(--nhs-dark-blue);color:white;padding:10px 12px;text-align:center;cursor:pointer;" onclick="sortAttendanceChart('percent')">Attendance %</th>
        <th style="background:var(--nhs-dark-blue);color:white;padding:10px 12px;text-align:center;">CPD Hours</th>
      </tr></thead><tbody>`;

      const rows = filteredLearners.map(l => {
        const attended = completedSessions.filter(s => attendanceSet.has(`${l.id}_${s.id}`)).length;
        let available = completedSessions.length;
        if (l.placement_start && l.placement_end) {
          const ps = new Date(l.placement_start); ps.setHours(0,0,0,0);
          const pe = new Date(l.placement_end); pe.setHours(23,59,59,999);
          available = completedSessions.filter(s => {
            const d = eventToDate(s);
            return d && d >= ps && d <= pe;
          }).length;
        }
        const pct = available > 0 ? Math.round((attended / available) * 100) : 0;
        const rotationLabels = { aug_dec: 'Aug-Dec', dec_apr: 'Dec-Apr', apr_aug: 'Apr-Aug' };
        return { learner: l, attended, available, pct, rotation: rotationLabels[l.rotation_block] || '-' };
      });

      // Sort if needed
      const sortField = window._attChartSortField || 'name';
      const sortDir = window._attChartSortDir || 'asc';
      rows.sort((a, b) => {
        let va, vb;
        if (sortField === 'name') { va = a.learner.name; vb = b.learner.name; }
        else if (sortField === 'grade') { va = a.learner.grade; vb = b.learner.grade; }
        else if (sortField === 'placement') { va = a.learner.placement; vb = b.learner.placement; }
        else if (sortField === 'rotation') { va = a.rotation; vb = b.rotation; }
        else if (sortField === 'attended') { va = a.attended; vb = b.attended; }
        else if (sortField === 'available') { va = a.available; vb = b.available; }
        else if (sortField === 'percent') { va = a.pct; vb = b.pct; }
        else { va = a.learner.name; vb = b.learner.name; }
        if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });

      rows.forEach(r => {
        const l = r.learner;
        let pctColor = 'var(--nhs-red)';
        let pctBg = '#fde8e8';
        if (r.pct >= 75) { pctColor = 'var(--nhs-green)'; pctBg = '#e6f4ea'; }
        else if (r.pct >= 50) { pctColor = 'var(--nhs-orange)'; pctBg = '#fff4e0'; }
        html += `<tr style="border-bottom:1px solid var(--nhs-pale-grey);">
          <td style="padding:8px 12px;font-weight:600;">${esc(l.name)}</td>
          <td style="padding:8px 12px;">${esc(l.grade || '-')}</td>
          <td style="padding:8px 12px;">${esc(l.placement || '-')}</td>
          <td style="padding:8px 12px;">${esc(r.rotation)}</td>
          <td style="padding:8px 12px;text-align:center;">${r.attended}</td>
          <td style="padding:8px 12px;text-align:center;">${r.available}</td>
          <td style="padding:8px 12px;text-align:center;"><span style="background:${pctBg};color:${pctColor};font-weight:700;padding:2px 10px;border-radius:10px;font-size:12px;">${r.pct}%</span></td>
          <td style="padding:8px 12px;text-align:center;">${r.attended}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    container.innerHTML = html;
  } catch(e) {
    console.error('Load attendance chart failed:', e);
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-red);">Failed to load attendance chart.</div>';
  }
}

function sortAttendanceChart(field) {
  if (window._attChartSortField === field) {
    window._attChartSortDir = window._attChartSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    window._attChartSortField = field;
    window._attChartSortDir = 'asc';
  }
  loadAttendanceChart();
}

function exportAttendanceCSV() {
  try {
    const table = document.querySelector('#attendanceChartView table');
    if (!table) { showToast('No data to export'); return; }
    let csv = '';
    table.querySelectorAll('tr').forEach(row => {
      const cells = [];
      row.querySelectorAll('th, td').forEach(cell => {
        cells.push('"' + cell.textContent.trim().replace(/"/g, '""') + '"');
      });
      csv += cells.join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'attendance_chart_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('CSV exported');
  } catch(e) {
    console.error('Export CSV failed:', e);
    showToast('Failed to export CSV');
  }
}

// ===================== CERTIFICATE GENERATION =====================
const CERT_STYLES = `
  @media print { body { margin: 0; padding: 0; } .no-print { display: none; } @page { size: A4 landscape; margin: 10mm; } }
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: white; color: #231f20; }
  .cert-container { max-width: 900px; margin: 0 auto; border: 3px solid #005eb8; padding: 30px 40px; position: relative; }
  .cert-container::before { content: ''; position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px; border: 1px solid #41b6e6; pointer-events: none; }
  .cert-header { text-align: center; background: linear-gradient(135deg, #003087, #005eb8); padding: 18px 20px 14px; border-radius: 8px; margin: -30px -40px 20px -40px; border-bottom: 3px solid #41b6e6; }
  .cert-logo { height: 50px; margin-bottom: 6px; }
  .cert-header h1 { color: white; font-size: 22px; margin: 0 0 4px; letter-spacing: 1px; }
  .cert-header h2 { color: rgba(255,255,255,0.9); font-size: 13px; margin: 0; font-weight: 400; }
  .cert-nhs { color: rgba(255,255,255,0.8); font-size: 11px; margin-top: 4px; }
  .cert-body { margin: 12px 0; }
  .cert-name { text-align: center; font-size: 22px; font-weight: 700; color: #003087; margin: 8px 0; padding: 6px; border-bottom: 2px solid #41b6e6; }
  .cert-details { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; font-size: 12px; margin: 10px 0; }
  .cert-details dt { font-weight: 600; color: #005eb8; }
  .cert-details dd { margin: 0; }
  .cert-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
  .cert-table th { background: #005eb8; color: white; padding: 4px 6px; text-align: left; }
  .cert-table td { padding: 3px 6px; border-bottom: 1px solid #e8edee; }
  .cert-table tr:nth-child(even) { background: #f0f4f5; }
  .cert-total { text-align: center; font-size: 14px; font-weight: 700; color: #005eb8; margin: 10px 0; padding: 8px; background: #f0f4f5; border-radius: 6px; }
  .cert-signature { display: flex; justify-content: center; gap: 80px; margin-top: 20px; text-align: center; }
  .cert-sig-block { min-width: 200px; }
  .cert-sig-line { border-top: 1px solid #231f20; margin-top: 20px; padding-top: 4px; font-size: 12px; font-weight: 600; }
  .cert-sig-title { font-size: 10px; color: #768692; white-space: pre-line; }
  .cert-date { text-align: center; font-size: 11px; color: #768692; margin-top: 10px; }
  .print-btn { display: block; margin: 10px auto; padding: 10px 24px; background: #005eb8; color: white; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
  .print-btn:hover { background: #003087; }`;
const CERT_LOGO_URL = LOGO_URL;

async function generateCertificate() {
  if (!currentLearner) return;
  try {
    const attendance = await sbGet('attendance', `learner_id=eq.${currentLearner.id}&status=eq.approved&select=*`);
    const attendedSessionIds = attendance.map(a => a.session_id);
    const attendedSessions = events.filter(e => attendedSessionIds.includes(e.id));
    attendedSessions.sort((a, b) => { const da = eventToDate(a), db = eventToDate(b); return (da||0)-(db||0); });
    const totalHours = attendedSessions.length;
    if (!totalHours) { showToast('No attended sessions to certify'); return; }
    logQI('certificate_generated', { metadata: { kind: 'learner_cumulative', sessions: totalHours, cpd_hours: totalHours } });
    logQI('certificate_downloaded',{ metadata: { kind: 'learner_cumulative', sessions: totalHours, cpd_hours: totalHours } });
    setTimeout(() => askInlineRating('certificate_flow'), 800);

    const certWindow = window.open('', '_blank');
    certWindow.document.write(`<!DOCTYPE html>
<html><head><title>Certificate of Attendance — ${esc(currentLearner.name)}</title>
<style>${CERT_STYLES}</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
<div class="cert-container">
  <div class="cert-header">
    <img src="${CERT_LOGO_URL}" alt="Southmead Surgical Teaching" class="cert-logo">
    <h1>CERTIFICATE OF ATTENDANCE</h1>
    <h2>Southmead Surgical Teaching Programme</h2>
    <div class="cert-nhs">North Bristol NHS Trust | Southmead Hospital</div>
  </div>
  <div class="cert-body">
    <div style="text-align:center;font-size:12px;color:#768692;">This is to certify that</div>
    <div class="cert-name">${esc(currentLearner.name)}</div>
    <div class="cert-details">
      <dt>Grade</dt><dd>${esc(currentLearner.grade)}</dd>
      <dt>Placement</dt><dd>${esc(currentLearner.placement)}</dd>
      ${currentLearner.placement_start ? '<dt>Period</dt><dd>' + new Date(currentLearner.placement_start).toLocaleDateString('en-GB') + ' to ' + (currentLearner.placement_end ? new Date(currentLearner.placement_end).toLocaleDateString('en-GB') : 'present') + '</dd>' : ''}
    </div>
    <div style="text-align:center;font-size:11px;color:#768692;margin:8px 0;">has attended the following surgical teaching sessions and is awarded <strong>${totalHours} CPD hour${totalHours!==1?'s':''}</strong>:</div>
    <table class="cert-table">
      <thead><tr><th>#</th><th>Date</th><th>Topic</th><th>Teacher</th></tr></thead>
      <tbody>${attendedSessions.map((s, i) => `<tr><td>${i+1}</td><td>${esc(s.day)} ${esc(s.date)} ${esc(s.month)} ${s.year}</td><td>${esc(s.topic || 'TBD')}</td><td>${esc(s.teacher || '-')}</td></tr>`).join('')}</tbody>
    </table>
    <div class="cert-total">Total CPD Hours Awarded: ${totalHours}</div>
  </div>
  <div class="cert-signature">
    <div class="cert-sig-block">
      <div class="cert-sig-line">${SIGNING_CONSULTANT}</div>
      <div class="cert-sig-title">${SIGNING_TITLE}</div>
    </div>
  </div>
  <div class="cert-date">Date of Issue: ${new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}</div>
</div>
</body></html>`);
    certWindow.document.close();
  } catch(e) { console.error('Generate certificate failed:', e); showToast('Failed to generate certificate'); }
}

// ===================== TEACHER CERTIFICATE =====================
async function generateTeacherCertificate() {
  if (!currentTeacher) return;
  try {
    const teacherSessions = events.filter(e => e.teacherEmail && e.teacherEmail.toLowerCase() === currentTeacher.email.toLowerCase() && (e.status === 'completed' || eventToDate(e) < new Date()));
    teacherSessions.sort((a, b) => { const da = eventToDate(a), db = eventToDate(b); return (da||0)-(db||0); });
    if (!teacherSessions.length) { showToast('No completed sessions found'); return; }

    // Get feedback summary
    const feedback = await sbGet('feedback', 'select=*');
    const sessionIds = new Set(teacherSessions.map(s => s.id));
    const teacherFeedback = feedback.filter(f => sessionIds.has(f.session_id));
    const avgOverall = teacherFeedback.length ? (teacherFeedback.reduce((s,f) => s+(f.rating_overall||0), 0) / teacherFeedback.length).toFixed(1) : 'N/A';
    logQI('certificate_generated', { metadata: { kind: 'teacher_cumulative', sessions: teacherSessions.length, mean_rating: avgOverall } });
    logQI('certificate_downloaded',{ metadata: { kind: 'teacher_cumulative', sessions: teacherSessions.length, mean_rating: avgOverall } });
    setTimeout(() => askInlineRating('certificate_flow'), 800);

    const certWindow = window.open('', '_blank');
    certWindow.document.write(`<!DOCTYPE html>
<html><head><title>Teaching Certificate — ${esc(currentTeacher.name)}</title>
<style>${CERT_STYLES}</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
<div class="cert-container">
  <div class="cert-header">
    <img src="${CERT_LOGO_URL}" alt="Southmead Surgical Teaching" class="cert-logo">
    <h1>CERTIFICATE OF TEACHING</h1>
    <h2>Southmead Surgical Teaching Programme</h2>
    <div class="cert-nhs">North Bristol NHS Trust | Southmead Hospital</div>
  </div>
  <div class="cert-body">
    <div style="text-align:center;font-size:12px;color:#768692;">This is to certify that</div>
    <div class="cert-name">${esc(currentTeacher.name)}</div>
    <div class="cert-details">
      <dt>Role</dt><dd>${esc(currentTeacher.role || 'Teacher')}</dd>
      <dt>Specialty</dt><dd>${esc(currentTeacher.specialty || '-')}</dd>
      <dt>Sessions Delivered</dt><dd>${teacherSessions.length}</dd>
      <dt>Average Feedback Score</dt><dd>${avgOverall}/10 (${teacherFeedback.length} responses)</dd>
    </div>
    <div style="text-align:center;font-size:11px;color:#768692;margin:8px 0;">has delivered the following surgical teaching sessions:</div>
    <table class="cert-table">
      <thead><tr><th>#</th><th>Date</th><th>Topic</th><th>Feedback Score</th></tr></thead>
      <tbody>${teacherSessions.map((s, i) => {
        const sf = teacherFeedback.filter(f => f.session_id === s.id);
        const sAvg = sf.length ? (sf.reduce((sum,f) => sum+(f.rating_overall||0),0)/sf.length).toFixed(1) : '-';
        return `<tr><td>${i+1}</td><td>${esc(s.day)} ${esc(s.date)} ${esc(s.month)} ${s.year}</td><td>${esc(s.topic || 'TBD')}</td><td>${sAvg}/10 (${sf.length})</td></tr>`;
      }).join('')}</tbody>
    </table>
    <div class="cert-total">Total Teaching Sessions: ${teacherSessions.length} | Total Teaching Hours: ${teacherSessions.length}</div>
  </div>
  <div class="cert-signature">
    <div class="cert-sig-block">
      <div class="cert-sig-line">${SIGNING_CONSULTANT}</div>
      <div class="cert-sig-title">${SIGNING_TITLE}</div>
    </div>
  </div>
  <div class="cert-date">Date of Issue: ${new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}</div>
</div>
</body></html>`);
    certWindow.document.close();
  } catch(e) { console.error('Generate teacher certificate failed:', e); showToast('Failed to generate certificate'); }
}

// ===================== SINGLE SESSION TEACHER CERTIFICATE =====================
async function generateSessionTeacherCert(sessionId) {
  if (!currentTeacher) return;
  const ev = events.find(e => e.id === sessionId);
  if (!ev) { showToast('Session not found'); return; }
  try {
    const feedback = await sbGet('feedback', `session_id=eq.${sessionId}&select=*`);
    const attendance = await sbGet('attendance', `session_id=eq.${sessionId}&status=eq.approved&select=*`);
    logQI('certificate_generated', { session_id: sessionId, metadata: { kind: 'teacher_session', topic: ev.topic } });
    logQI('certificate_downloaded',{ session_id: sessionId, metadata: { kind: 'teacher_session', topic: ev.topic } });
    const avgOverall = feedback.length ? (feedback.reduce((s,f) => s+(f.rating_overall||0), 0) / feedback.length).toFixed(1) : 'N/A';
    const sessionDate = `${ev.day} ${ev.date} ${ev.month} ${ev.year}`;

    const certWindow = window.open('', '_blank');
    certWindow.document.write(`<!DOCTYPE html>
<html><head><title>Teaching Certificate — ${esc(currentTeacher.name)} — ${esc(ev.topic)}</title>
<style>${CERT_STYLES}</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
<div class="cert-container">
  <div class="cert-header">
    <img src="${CERT_LOGO_URL}" alt="Southmead Surgical Teaching" class="cert-logo">
    <h1>CERTIFICATE OF TEACHING</h1>
    <h2>Southmead Surgical Teaching Programme</h2>
    <div class="cert-nhs">North Bristol NHS Trust | Southmead Hospital</div>
  </div>
  <div class="cert-body">
    <div style="text-align:center;font-size:12px;color:#768692;">This is to certify that</div>
    <div class="cert-name">${esc(currentTeacher.name)}</div>
    <div class="cert-details">
      <dt>Role</dt><dd>${esc(currentTeacher.role || 'Teacher')}</dd>
      <dt>Specialty</dt><dd>${esc(currentTeacher.specialty || '-')}</dd>
    </div>
    <div style="text-align:center;font-size:12px;color:#768692;margin:10px 0;">delivered the following surgical teaching session:</div>
    <table class="cert-table" style="font-size:12px;">
      <thead><tr><th>Date</th><th>Topic</th><th>Attendees</th><th>Feedback Score</th></tr></thead>
      <tbody><tr><td>${esc(sessionDate)}</td><td>${esc(ev.topic || 'TBD')}</td><td>${attendance.length}</td><td>${avgOverall}/10 (${feedback.length} responses)</td></tr></tbody>
    </table>
    <div class="cert-total">Teaching Hours: 1 | CPD Hours: 1</div>
    ${feedback.length > 0 ? '<div style="margin-top:12px;"><div style="font-size:12px;font-weight:600;color:#005eb8;margin-bottom:6px;">Feedback Summary</div><div class="cert-details" style="gap:2px;">' +
      (feedback.some(f=>f.rating_content_useful) ? '<dt>Content useful</dt><dd>' + (feedback.reduce((s,f)=>s+(f.rating_content_useful||0),0)/feedback.filter(f=>f.rating_content_useful).length).toFixed(1) + '/10</dd>' : '') +
      (feedback.some(f=>f.rating_structured) ? '<dt>Structured</dt><dd>' + (feedback.reduce((s,f)=>s+(f.rating_structured||0),0)/feedback.filter(f=>f.rating_structured).length).toFixed(1) + '/10</dd>' : '') +
      (feedback.some(f=>f.rating_presentation) ? '<dt>Presentation</dt><dd>' + (feedback.reduce((s,f)=>s+(f.rating_presentation||0),0)/feedback.filter(f=>f.rating_presentation).length).toFixed(1) + '/10</dd>' : '') +
      (feedback.some(f=>f.rating_delivery) ? '<dt>Delivery</dt><dd>' + (feedback.reduce((s,f)=>s+(f.rating_delivery||0),0)/feedback.filter(f=>f.rating_delivery).length).toFixed(1) + '/10</dd>' : '') +
      (feedback.some(f=>f.rating_applicable) ? '<dt>Applicable</dt><dd>' + (feedback.reduce((s,f)=>s+(f.rating_applicable||0),0)/feedback.filter(f=>f.rating_applicable).length).toFixed(1) + '/10</dd>' : '') +
    '</div></div>' : ''}
  </div>
  <div class="cert-signature">
    <div class="cert-sig-block">
      <div class="cert-sig-line">${SIGNING_CONSULTANT}</div>
      <div class="cert-sig-title">${SIGNING_TITLE}</div>
    </div>
  </div>
  <div class="cert-date">Date of Issue: ${new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}</div>
</div>
</body></html>`);
    certWindow.document.close();
  } catch(e) { console.error('Generate session cert failed:', e); showToast('Failed to generate certificate'); }
}

// ===================== TEACHER DASHBOARD =====================
async function loadTeacherDashboard() {
  if (!currentTeacher) return;
  const container = document.getElementById('teacherDashView');
  container.innerHTML = '<div style="text-align:center;padding:30px;"><div class="loading-spinner"></div> Loading dashboard...</div>';
  try {
    const teacherEmail = currentTeacher.email.toLowerCase();
    const teacherSessions = events.filter(e => e.teacherEmail && e.teacherEmail.toLowerCase() === teacherEmail);
    const upcoming = teacherSessions.filter(e => isFutureEvent(e) && e.status !== 'cancelled');
    const completed = teacherSessions.filter(e => !isFutureEvent(e) || e.status === 'completed');

    let html = `<h3 style="color:var(--nhs-dark-blue);margin-bottom:4px;">Welcome, ${esc(currentTeacher.name)}</h3>
    <p style="font-size:13px;color:var(--nhs-grey);margin:0 0 20px;">Teacher Dashboard — Southmead Surgical Teaching Programme</p>`;

    // Stats
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
      <div class="stat-card"><div class="stat-num">${teacherSessions.length}</div><div class="stat-label">Total Sessions</div></div>
      <div class="stat-card"><div class="stat-num">${upcoming.length}</div><div class="stat-label">Upcoming</div></div>
      <div class="stat-card"><div class="stat-num">${completed.length}</div><div class="stat-label">Completed</div></div>
    </div>`;

    // Upcoming sessions
    if (upcoming.length) {
      html += '<div class="dashboard-card"><h4>Upcoming Sessions</h4>';
      upcoming.forEach(s => {
        html += `<div style="padding:10px 0;border-bottom:1px solid var(--nhs-pale-grey);display:flex;justify-content:space-between;align-items:center;">
          <div><strong>${esc(s.topic || 'TBD')}</strong><br><span style="font-size:12px;color:var(--nhs-grey);">${esc(s.day)} ${esc(s.date)} ${esc(s.month)} ${s.year} | ${esc(s.time || 'TBC')} | ${esc(s.room || 'TBC')}</span></div>
          <span class="card-status status-pill-${s.status}">${s.status}</span>
        </div>`;
      });
      html += '</div>';
    }

    // Completed sessions with attendance & feedback counts
    if (completed.length) {
      html += '<div class="dashboard-card"><h4>Completed Sessions</h4>';
      const [allAttendance, allFeedback] = await Promise.all([
        sbGet('attendance', 'select=session_id,status'),
        sbGet('feedback', 'select=session_id')
      ]);
      completed.forEach(s => {
        const att = allAttendance.filter(a => a.session_id === s.id && a.status === 'approved').length;
        const fb = allFeedback.filter(f => f.session_id === s.id).length;
        html += `<div style="padding:10px 0;border-bottom:1px solid var(--nhs-pale-grey);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div><strong>${esc(s.topic || 'TBD')}</strong><br><span style="font-size:12px;color:var(--nhs-grey);">${esc(s.day)} ${esc(s.date)} ${esc(s.month)} ${s.year}</span></div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:12px;color:var(--nhs-green);">${att} attended</span>
            <span style="font-size:12px;color:var(--nhs-blue);">${fb} feedback</span>
            ${fb < att ? `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px;color:var(--nhs-orange);border-color:var(--nhs-orange);" onclick="closeModal('detailModal');openFeedbackRequestModal(${s.id})">Chase Feedback</button>` : ''}
            <button class="btn" style="font-size:11px;padding:3px 10px;background:#ed8b00;color:white;border:none;" onclick="generateSessionTeacherCert(${s.id})">Certificate</button>
            <button class="btn btn-outline" style="font-size:11px;padding:3px 10px;" onclick="showDetail(${s.id})">View</button>
          </div>
        </div>`;
      });
      html += '</div>';
    }

    // Action buttons
    html += `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
      <button class="btn" style="background:#ed8b00;color:white;border:none;" onclick="generateTeacherCertificate()">Certificate (All Sessions)</button>
      <button class="btn" style="background:#005eb8;color:white;border:none;" onclick="loadFeedbackView('${teacherEmail}')">View My Feedback</button>
      <button class="btn" style="background:#003087;color:white;border:none;" onclick="exportTeacherFeedbackCSV('${teacherEmail}')">Export Feedback CSV</button>
    </div>`;

    // Feedback summary section
    html += '<div id="teacherFeedbackSummary" style="margin-top:24px;"></div>';
    container.innerHTML = html;

    // Load feedback inline
    loadTeacherFeedbackSummary(teacherEmail);
  } catch(e) { console.error('Load teacher dashboard failed:', e); container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--nhs-red);">Failed to load dashboard.</div>'; }
}

async function loadTeacherFeedbackSummary(teacherEmail) {
  const container = document.getElementById('teacherFeedbackSummary');
  if (!container) return;
  try {
    const feedback = await sbGet('feedback', 'order=submitted_at.desc&select=*');
    const teacherSessions = events.filter(e => e.teacherEmail && e.teacherEmail.toLowerCase() === teacherEmail.toLowerCase()).map(e => e.id);
    const filtered = feedback.filter(f => teacherSessions.includes(f.session_id));
    // Log that teacher saw their own feedback — central QI metric ("did teachers look?")
    if (filtered.length) logQI('teacher_viewed_feedback', { metadata: { feedback_count: filtered.length, session_count: teacherSessions.length } });
    if (!filtered.length) { container.innerHTML = '<div class="dashboard-card"><h4>Feedback Summary</h4><p style="color:var(--nhs-grey);">No feedback received yet.</p></div>'; return; }

    let html = '<div class="dashboard-card"><h4>Anonymous Feedback Summary</h4>';
    html += fbScoreBar('Content useful & interesting', fbAvg(filtered, 'rating_content_useful'));
    html += fbScoreBar('Structured & organized', fbAvg(filtered, 'rating_structured'));
    html += fbScoreBar('Overall session', fbAvg(filtered, 'rating_overall'));
    html += fbScoreBar('Presentation', fbAvg(filtered, 'rating_presentation'));
    html += fbScoreBar('Delivery', fbAvg(filtered, 'rating_delivery'));
    html += fbScoreBar('Applicable to workplace', fbAvg(filtered, 'rating_applicable'));

    // Recent comments (anonymous)
    const withGood = filtered.filter(f => f.good_aspects);
    const withImprove = filtered.filter(f => f.improve_aspects);
    if (withGood.length) {
      html += '<div style="margin-top:16px;"><strong style="color:var(--nhs-green);">What went well:</strong>';
      withGood.slice(0, 5).forEach(f => { html += `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--nhs-pale-grey);">"${esc(f.good_aspects)}"</div>`; });
      html += '</div>';
    }
    if (withImprove.length) {
      html += '<div style="margin-top:12px;"><strong style="color:#ed8b00;">Areas to improve:</strong>';
      withImprove.slice(0, 5).forEach(f => { html += `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--nhs-pale-grey);">"${esc(f.improve_aspects)}"</div>`; });
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  } catch(e) { console.log('Feedback summary load failed:', e); }
}

// ===================== TAB LABEL LOGIC =====================
function updateSessionsTabLabel() {
  const tab = document.querySelector('.nav-tab[data-view="list"]');
  if (tab) {
    tab.textContent = (currentLearner || isAdmin) ? 'Sessions' : 'Upcoming Sessions';
  }
}

// ===================== LEARNER REGISTRATION AUTO-POPULATE FROM CONTACTS =====================
function setupRegEmailAutopopulate() {
  const regEmailField = document.getElementById('regEmail');
  if (!regEmailField) return;
  regEmailField.addEventListener('input', async function() {
    const email = this.value.trim().toLowerCase();
    const hint = document.getElementById('regContactHint');
    if (email.length < 5 || !email.includes('@')) {
      if (hint) hint.style.display = 'none';
      return;
    }
    try {
      const data = await sbGet('contacts', `email=ilike.${encodeURIComponent(email)}`);
      if (data.length > 0) {
        const contact = data[0];
        const nameField = document.getElementById('regName');
        if (nameField && !nameField.value.trim()) {
          nameField.value = contact.name || '';
        }
        if (!hint) {
          const hintEl = document.createElement('div');
          hintEl.id = 'regContactHint';
          hintEl.style.cssText = 'font-size:12px;color:var(--nhs-green);margin-top:4px;';
          hintEl.textContent = '✓ Found in contacts directory';
          this.parentNode.appendChild(hintEl);
        } else {
          hint.style.display = '';
          hint.textContent = '✓ Found in contacts directory';
        }
      } else {
        if (hint) hint.style.display = 'none';
      }
    } catch(e) { /* ignore lookup errors */ }
  });
}

// ===================== ROSTER MANAGEMENT =====================

const JUNIOR_GRADES = ['FY1','FY2','F1','F2','CT1','CT2','SHO','JCF','SCF','Clinical Fellow'];

function isJuniorGrade(grade) {
  if (!grade) return false;
  const g = grade.toUpperCase();
  return JUNIOR_GRADES.some(j => g.includes(j.toUpperCase()));
}

async function loadRosterView() {
  const container = document.getElementById('rosterView');
  container.innerHTML = '<div style="text-align:center;padding:30px;"><div class="loading-spinner"></div> Loading roster...</div>';
  try {
    const learners = await sbGet('learners', 'order=placement.asc,grade.asc,name.asc&select=*');
    const today = new Date().toISOString().split('T')[0];

    // Fetch attendance counts per learner (approved only)
    const attendanceData = await sbGet('attendance', 'status=eq.approved&select=learner_id,session_id');
    const attendanceCounts = {};
    attendanceData.forEach(a => {
      attendanceCounts[a.learner_id] = (attendanceCounts[a.learner_id] || 0) + 1;
    });

    // Count sessions during each learner's placement (for F1/F2 percentage)
    // Only count from 18 May 2026 onwards (site go-live date)
    const SITE_LIVE_DATE = new Date('2026-05-18');
    const allSessions = events.filter(e => e.published && e.status !== 'cancelled');

    function countSessionsDuringPlacement(learner) {
      if (!learner.placement_start || !learner.placement_end) return 0;
      const start = new Date(Math.max(new Date(learner.placement_start), SITE_LIVE_DATE));
      const end = new Date(learner.placement_end);
      const todayD = new Date(); todayD.setHours(0,0,0,0);
      return allSessions.filter(e => {
        const d = eventToDate(e);
        return d && d >= start && d <= end && d <= todayD;
      }).length;
    }

    function isF1F2(grade) {
      return grade && (grade === 'FY1' || grade === 'FY2' || grade === 'F1' || grade === 'F2');
    }

    function attendanceCell(learner) {
      const attended = attendanceCounts[learner.id] || 0;
      const total = countSessionsDuringPlacement(learner);
      const missed = Math.max(0, total - attended);
      if (total === 0) return '<span style="color:var(--nhs-grey);font-size:12px;">No sessions yet</span>';
      if (isF1F2(learner.grade)) {
        const pct = Math.round((attended / total) * 100);
        const color = pct >= 75 ? 'var(--nhs-green)' : pct >= 50 ? 'var(--nhs-orange)' : 'var(--nhs-red)';
        return `<span style="font-weight:700;color:${color};font-size:13px;">${pct}%</span> <span style="font-size:11px;color:var(--nhs-grey);">(${attended}/${total})</span>`;
      } else {
        return `<span style="font-size:12px;"><span style="color:var(--nhs-green);font-weight:600;">${attended}</span> attended, <span style="color:${missed>0?'var(--nhs-red)':'var(--nhs-grey)'};font-weight:600;">${missed}</span> missed</span>`;
      }
    }

    // Group by placement
    const currentRotation = learners.filter(l => l.placement_end && l.placement_end >= today && l.followup_eligible);
    const pastRotation = learners.filter(l => l.placement_end && l.placement_end < today && l.followup_eligible);
    const noDates = learners.filter(l => !l.placement_end && l.followup_eligible);
    const nonEligible = learners.filter(l => !l.followup_eligible);

    // Group current by placement
    const placements = {};
    currentRotation.forEach(l => {
      const p = l.placement || 'Unassigned';
      if (!placements[p]) placements[p] = [];
      placements[p].push(l);
    });

    let html = `<h3 style="color:var(--nhs-dark-blue);margin-bottom:6px;">Roster Management</h3>
      <p style="font-size:13px;color:var(--nhs-grey);margin-bottom:16px;">Manage who is on the current rotation. Expected attendees for each session are auto-generated from placement dates.</p>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <button class="btn" style="background:var(--nhs-dark-blue);color:white;border:none;" onclick="openRotationSetupModal()">New Rotation Setup</button>
        <button class="btn" style="background:var(--nhs-green);color:white;border:none;" onclick="openAddLearnerToRosterModal()">Add Learner</button>
        <button class="btn" style="background:var(--nhs-orange);color:white;border:none;" onclick="endCurrentRotation()">End Current Rotation</button>
        <button class="btn" style="background:var(--nhs-pale-grey);border:none;font-size:12px;" onclick="findDuplicateLearners()">Find Duplicates</button>
      </div>`;

    // Current rotation stats
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:20px;">
      <div class="stat-card"><div class="stat-num">${currentRotation.length}</div><div class="stat-label">Current Roster</div></div>
      <div class="stat-card"><div class="stat-num">${currentRotation.filter(l=>isF1F2(l.grade)).length}</div><div class="stat-label">FY1/FY2</div></div>
      <div class="stat-card"><div class="stat-num">${currentRotation.filter(l=>l.grade&&(l.grade.startsWith('CT')||l.grade==='SHO'||l.grade==='JCF'||l.grade==='SCF')).length}</div><div class="stat-label">CT/CF/SHO</div></div>
      <div class="stat-card"><div class="stat-num">${currentRotation.filter(l=>l.grade&&!isF1F2(l.grade)&&!l.grade.startsWith('CT')&&l.grade!=='SHO'&&l.grade!=='JCF'&&l.grade!=='SCF').length}</div><div class="stat-label">Other</div></div>
    </div>`;

    // Current rotation by placement
    if (Object.keys(placements).length === 0) {
      html += '<div class="dashboard-card"><p style="color:var(--nhs-grey);text-align:center;padding:20px;">No learners on current rotation. Use "New Rotation Setup" to add them.</p></div>';
    } else {
      for (const [placement, members] of Object.entries(placements)) {
        html += `<div class="dashboard-card" style="margin-bottom:12px;">
          <h4 style="color:var(--nhs-dark-blue);margin-bottom:10px;">${esc(placement)} <span style="font-weight:400;color:var(--nhs-grey);font-size:13px;">(${members.length})</span></h4>
          <div style="overflow-x:auto;"><table style="width:100%;font-size:13px;border-collapse:collapse;">
            <tr style="background:var(--nhs-bg);"><th style="padding:8px;text-align:left;">Name</th><th style="padding:8px;text-align:left;">Grade</th><th style="padding:8px;text-align:left;">Attendance</th><th style="padding:8px;text-align:left;">Dates</th><th style="padding:8px;">Actions</th></tr>`;
        members.forEach(l => {
          const dates = l.placement_start && l.placement_end ? `${l.placement_start} → ${l.placement_end}` : 'Not set';
          html += `<tr style="border-bottom:1px solid var(--nhs-pale-grey);">
            <td style="padding:8px;font-weight:600;">${esc(l.name)}</td>
            <td style="padding:8px;"><span style="background:#e0e7f5;color:#003087;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;">${esc(l.grade)}</span></td>
            <td style="padding:8px;">${attendanceCell(l)}</td>
            <td style="padding:8px;font-size:12px;">${dates}</td>
            <td style="padding:8px;text-align:center;">
              <button class="btn" style="padding:3px 10px;font-size:11px;background:var(--nhs-pale-grey);border:none;" onclick="editLearnerPlacement(${l.id})">Edit</button>
            </td>
          </tr>`;
        });
        html += '</table></div></div>';
      }
    }

    // Learners without dates
    if (noDates.length > 0) {
      html += `<details style="margin-top:16px;"><summary style="cursor:pointer;font-weight:600;color:var(--nhs-grey);font-size:14px;">Unassigned Learners (${noDates.length})</summary>
        <div class="dashboard-card" style="margin-top:8px;"><table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr style="background:var(--nhs-bg);"><th style="padding:8px;text-align:left;">Name</th><th style="padding:8px;text-align:left;">Grade</th><th style="padding:8px;text-align:left;">Email</th><th style="padding:8px;">Actions</th></tr>`;
      noDates.forEach(l => {
        html += `<tr style="border-bottom:1px solid var(--nhs-pale-grey);">
          <td style="padding:8px;">${esc(l.name)}</td><td style="padding:8px;">${esc(l.grade||'—')}</td><td style="padding:8px;font-size:12px;">${esc(l.email)}</td>
          <td style="padding:8px;text-align:center;"><button class="btn" style="padding:3px 10px;font-size:11px;background:var(--nhs-pale-grey);border:none;" onclick="editLearnerPlacement(${l.id})">Assign</button></td>
        </tr>`;
      });
      html += '</table></div></details>';
    }

    container.innerHTML = html;
  } catch(e) { console.error('Load roster failed:', e); container.innerHTML = '<div style="color:var(--nhs-red);padding:20px;">Failed to load roster.</div>'; }
}

async function editLearnerPlacement(learnerId) {
  try {
    const data = await sbGet('learners', `id=eq.${learnerId}&select=*`);
    if (data.length === 0) return;
    const l = data[0];
    const html = `<div style="max-width:400px;margin:0 auto;">
      <h3 style="color:var(--nhs-dark-blue);margin-bottom:16px;">Edit Placement: ${esc(l.name)}</h3>
      <label>Grade</label>
      <select id="editGrade">
        ${['FY1','FY2','CT1','CT2','SHO','JCF','SCF','ST3','ST4','ST5','ST6','ST7','ST8','SpR','Registrar','Consultant','ANP','Other'].map(g => `<option ${l.grade===g?'selected':''}>${g}</option>`).join('')}
      </select>
      <label>Placement</label>
      <select id="editPlacement">
        ${['UGI','LGI / Colorectal','Transplant','Vascular','Surgery','Other'].map(p => `<option ${l.placement===p?'selected':''}>${p}</option>`).join('')}
      </select>
      <label>Start Date</label>
      <input type="date" id="editPlacementStart" value="${l.placement_start||''}">
      <label>End Date</label>
      <input type="date" id="editPlacementEnd" value="${l.placement_end||''}">
      <label style="margin-top:8px;"><input type="checkbox" id="editFollowup" ${l.followup_eligible?'checked':''} style="width:auto;margin-right:6px;">Eligible for attendance follow-up emails</label>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;">
        <button class="btn btn-green" onclick="saveLearnerPlacement(${l.id})">Save</button>
        <button class="btn btn-outline" onclick="closeModal('editPlacementModal')">Cancel</button>
      </div>
    </div>`;
    // Use a dynamic modal
    let modal = document.getElementById('editPlacementModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'editPlacementModal';
      modal.setAttribute('role', 'dialog');
      modal.innerHTML = '<div class="modal"><div class="modal-header"><h3>Edit Placement</h3><button class="modal-close" onclick="closeModal(\'editPlacementModal\')">&times;</button></div><div class="modal-body" id="editPlacementModalBody"></div></div>';
      document.body.appendChild(modal);
    }
    document.getElementById('editPlacementModalBody').innerHTML = html;
    openModal('editPlacementModal');
  } catch(e) { showToast('Failed to load learner'); }
}

async function saveLearnerPlacement(learnerId) {
  const grade = document.getElementById('editGrade').value;
  const placement = document.getElementById('editPlacement').value;
  const start = document.getElementById('editPlacementStart').value;
  const end = document.getElementById('editPlacementEnd').value;
  const followup = document.getElementById('editFollowup').checked;
  try {
    await sbUpdate('learners', learnerId, {
      grade, placement,
      placement_start: start || null,
      placement_end: end || null,
      followup_eligible: followup
    });
    // Sync to linked contact if exists
    const learner = await sbGet('learners', `id=eq.${learnerId}&select=contact_id`);
    if (learner.length > 0 && learner[0].contact_id) {
      await sbUpdate('contacts', learner[0].contact_id, {
        role: grade,
        specialty: placement
      });
    }
    closeModal('editPlacementModal');
    showToast('Placement updated');
    loadRosterView();
  } catch(e) { showToast('Failed to save'); }
}

function openRotationSetupModal() {
  let modal = document.getElementById('rotationSetupModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'rotationSetupModal';
    modal.setAttribute('role', 'dialog');
    modal.innerHTML = `<div class="modal" style="max-width:600px;"><div class="modal-header"><h3>New Rotation Setup</h3><button class="modal-close" onclick="closeModal('rotationSetupModal')">&times;</button></div><div class="modal-body" id="rotationSetupBody"></div></div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('rotationSetupBody').innerHTML = `
    <p style="font-size:13px;color:var(--nhs-grey);margin-bottom:16px;">Set up the new rotation. This will update placement dates for all selected learners.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div><label>Rotation Block</label>
        <select id="newRotBlock" onchange="onNewRotBlockChange()">
          <option value="">-- Select --</option><option value="aug_dec">Aug – Dec</option><option value="dec_apr">Dec – Apr</option><option value="apr_aug">Apr – Aug</option>
        </select>
      </div>
      <div><label>Placement</label>
        <select id="newRotPlacement"><option value="UGI">UGI</option><option value="LGI / Colorectal">LGI / Colorectal</option><option value="Surgery">Surgery</option></select>
      </div>
      <div><label>Start Date</label><input type="date" id="newRotStart"></div>
      <div><label>End Date</label><input type="date" id="newRotEnd"></div>
    </div>
    <h4 style="margin-bottom:8px;">Add learners to this rotation:</h4>
    <p style="font-size:12px;color:var(--nhs-grey);margin-bottom:8px;">Paste names and emails (one per line: <code>Name, email@nhs.net, Grade</code>) or select from existing:</p>
    <textarea id="newRotBulkInput" rows="5" placeholder="Ellen Russell, ellen.russell@nbt.nhs.uk, FY1&#10;Anas Idris, anas.idris@nbt.nhs.uk, FY1" style="width:100%;font-size:13px;font-family:monospace;margin-bottom:12px;"></textarea>
    <div style="text-align:center;">
      <button class="btn btn-green" onclick="applyNewRotation()" style="padding:10px 30px;">Apply Rotation</button>
    </div>`;
  openModal('rotationSetupModal');
}

function onNewRotBlockChange() {
  const block = document.getElementById('newRotBlock').value;
  if (!block) return;
  const now = new Date();
  const yr = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const blocks = {
    aug_dec: { start: yr + '-08-01', end: yr + '-12-31' },
    dec_apr: { start: yr + '-12-01', end: (yr+1) + '-04-30' },
    apr_aug: { start: (yr+1) + '-04-01', end: (yr+1) + '-08-31' }
  };
  const d = blocks[block];
  if (d) {
    document.getElementById('newRotStart').value = d.start;
    document.getElementById('newRotEnd').value = d.end;
  }
}

async function applyNewRotation() {
  const placement = document.getElementById('newRotPlacement').value;
  const start = document.getElementById('newRotStart').value;
  const end = document.getElementById('newRotEnd').value;
  const block = document.getElementById('newRotBlock').value;
  const bulkText = document.getElementById('newRotBulkInput').value.trim();
  if (!start || !end) { showToast('Please set rotation dates'); return; }
  if (!bulkText) { showToast('Please add at least one learner'); return; }

  const lines = bulkText.split('\n').filter(l => l.trim());
  let count = 0;
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 2) continue;
    const name = parts[0];
    const email = parts[1].toLowerCase();
    const grade = parts[2] || 'FY1';
    try {
      // Check if learner exists
      const existing = await sbGet('learners', `email=ilike.${encodeURIComponent(email)}&select=*`);
      if (existing.length > 0) {
        await sbUpdate('learners', existing[0].id, {
          grade, placement, placement_start: start, placement_end: end,
          rotation_block: block || null, followup_eligible: true
        });
        // Sync to linked contact
        if (existing[0].contact_id) {
          try { await sbUpdate('contacts', existing[0].contact_id, { role: grade, specialty: placement }); } catch(ce) {}
        }
      } else {
        // Create new learner and auto-link to contact
        const pin = String(Math.floor(100000 + Math.random() * 900000));
        const hashedPin = await hashPassword(pin);
        const result = await sbInsert('learners', {
          name, email, grade, placement,
          placement_start: start, placement_end: end,
          rotation_block: block || null,
          pin_code: hashedPin, verified: true, followup_eligible: true
        });
        // Auto-link contact
        try {
          const contactMatch = await sbGet('contacts', `email=ilike.${encodeURIComponent(email)}&select=id`);
          if (contactMatch.length > 0 && result.length > 0) {
            await sbUpdate('learners', result[0].id, { contact_id: contactMatch[0].id });
            await sbUpdate('contacts', contactMatch[0].id, { role: grade, specialty: placement });
          }
        } catch(ce) {}
      }
      count++;
    } catch(e) { console.warn('Failed to process:', name, e); }
  }
  closeModal('rotationSetupModal');
  showToast(`Rotation applied — ${count} learner${count!==1?'s':''} updated`);
  loadRosterView();
}

async function endCurrentRotation() {
  if (!confirm('End the current rotation? This will clear placement dates for all current rotation learners. They will move to "Unassigned".')) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const current = await sbGet('learners', `placement_end=gte.${today}&followup_eligible=eq.true&select=id`);
    for (const l of current) {
      await sbUpdate('learners', l.id, { placement_start: null, placement_end: null, rotation_block: null });
    }
    showToast(`Rotation ended — ${current.length} learners moved to unassigned`);
    loadRosterView();
  } catch(e) { showToast('Failed to end rotation'); }
}

function openAddLearnerToRosterModal() {
  openRotationSetupModal(); // Same modal, just pre-fill dates from current rotation
}

async function findDuplicateLearners() {
  try {
    const learners = await sbGet('learners', 'select=id,name,email,grade,pin_code,contact_id');
    // Group by lowercase email OR same contact_id
    const byKey = {};
    learners.forEach(l => {
      // Group by email
      if (l.email) {
        const emailKey = 'email:' + l.email.toLowerCase();
        if (!byKey[emailKey]) byKey[emailKey] = [];
        if (!byKey[emailKey].find(x => x.id === l.id)) byKey[emailKey].push(l);
      }
      // Group by contact_id
      if (l.contact_id) {
        const cidKey = 'contact:' + l.contact_id;
        if (!byKey[cidKey]) byKey[cidKey] = [];
        if (!byKey[cidKey].find(x => x.id === l.id)) byKey[cidKey].push(l);
      }
    });
    // Deduplicate: merge groups that share any learner id
    const seen = new Set();
    const dupeGroups = [];
    for (const [, group] of Object.entries(byKey)) {
      if (group.length <= 1) continue;
      const ids = group.map(l => l.id).sort().join(',');
      if (seen.has(ids)) continue;
      seen.add(ids);
      dupeGroups.push([group[0].email || 'contact_id:' + group[0].contact_id, group]);
    }
    const dupes = dupeGroups;
    if (dupes.length === 0) {
      showToast('No duplicates found!');
      return;
    }
    let html = `<h3 style="color:var(--nhs-dark-blue);margin-bottom:12px;">Duplicate Learners Found</h3>
      <p style="font-size:13px;color:var(--nhs-grey);margin-bottom:16px;">These learners share the same email or contact link. Click "Merge" to keep the one with the most data and reassign records from the other.</p>`;
    dupes.forEach(([email, records]) => {
      html += `<div style="background:var(--nhs-bg);padding:12px;border-radius:8px;margin-bottom:10px;">
        <p style="font-weight:600;margin-bottom:6px;">${esc(email)}</p>`;
      records.forEach(r => {
        html += `<div style="font-size:12px;margin:4px 0;display:flex;justify-content:space-between;align-items:center;">
          <span>ID ${r.id}: ${esc(r.name)} (${esc(r.grade||'—')}) ${r.pin_code?'🔑':''} ${r.contact_id?'🔗':''}</span>
        </div>`;
      });
      // Auto-pick: prefer the one with pin_code, or highest id
      const keep = records.find(r => r.pin_code) || records[records.length - 1];
      const remove = records.filter(r => r.id !== keep.id);
      html += `<button class="btn btn-green" style="padding:4px 12px;font-size:11px;margin-top:6px;" onclick="mergeLearners(${keep.id}, [${remove.map(r=>r.id).join(',')}])">Merge → Keep #${keep.id} (${esc(keep.name)})</button>`;
      html += '</div>';
    });
    let modal = document.getElementById('duplicatesModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'duplicatesModal';
      modal.setAttribute('role', 'dialog');
      modal.innerHTML = '<div class="modal"><div class="modal-header"><h3>Duplicates</h3><button class="modal-close" onclick="closeModal(\'duplicatesModal\')">&times;</button></div><div class="modal-body" id="duplicatesModalBody"></div></div>';
      document.body.appendChild(modal);
    }
    document.getElementById('duplicatesModalBody').innerHTML = html;
    openModal('duplicatesModal');
  } catch(e) { showToast('Failed to scan for duplicates'); console.error(e); }
}

async function mergeLearners(keepId, removeIds) {
  if (!confirm(`Merge ${removeIds.length} duplicate(s) into learner #${keepId}? Attendance, feedback, and absence records will be reassigned.`)) return;
  try {
    for (const removeId of removeIds) {
      // Reassign attendance
      const att = await sbGet('attendance', `learner_id=eq.${removeId}&select=id,session_id`);
      for (const a of att) {
        const exists = await sbGet('attendance', `learner_id=eq.${keepId}&session_id=eq.${a.session_id}&select=id`);
        if (exists.length === 0) {
          await sbUpdate('attendance', a.id, { learner_id: keepId });
        }
      }
      // Reassign feedback
      const fb = await sbGet('feedback', `learner_id=eq.${removeId}&select=id,session_id`);
      for (const f of fb) {
        const exists = await sbGet('feedback', `learner_id=eq.${keepId}&session_id=eq.${f.session_id}&select=id`);
        if (exists.length === 0) {
          await sbUpdate('feedback', f.id, { learner_id: keepId });
        }
      }
      // Reassign absence_reasons
      const ar = await sbGet('absence_reasons', `learner_id=eq.${removeId}&select=id,session_id`);
      for (const a of ar) {
        const exists = await sbGet('absence_reasons', `learner_id=eq.${keepId}&session_id=eq.${a.session_id}&select=id`);
        if (exists.length === 0) {
          await sbUpdate('absence_reasons', a.id, { learner_id: keepId });
        }
      }
      // Delete leftover records and the duplicate learner
      await _originalFetch(`${SUPABASE_URL}/rest/v1/attendance?learner_id=eq.${removeId}`, { method: 'DELETE', headers });
      await _originalFetch(`${SUPABASE_URL}/rest/v1/feedback?learner_id=eq.${removeId}`, { method: 'DELETE', headers });
      await _originalFetch(`${SUPABASE_URL}/rest/v1/absence_reasons?learner_id=eq.${removeId}`, { method: 'DELETE', headers });
      await _originalFetch(`${SUPABASE_URL}/rest/v1/learners?id=eq.${removeId}`, { method: 'DELETE', headers });
    }
    showToast(`Merged ${removeIds.length} duplicate(s) into #${keepId}`);
    closeModal('duplicatesModal');
    loadRosterView();
  } catch(e) { showToast('Merge failed'); console.error(e); }
}

// ===================== EXPECTED ATTENDANCE (auto from placement dates) =====================

async function getExpectedAttendees(sessionId) {
  const ev = events.find(e => e.id === sessionId);
  if (!ev) return [];
  const sessionDate = eventToDate(ev);
  if (!sessionDate) return [];
  const dateStr = sessionDate.toISOString().split('T')[0];
  // All learners whose placement window includes this session date and are followup_eligible
  try {
    const learners = await sbGet('learners', `followup_eligible=eq.true&placement_start=lte.${dateStr}&placement_end=gte.${dateStr}&select=*`);
    return learners;
  } catch(e) { console.warn('Expected attendees query failed:', e); return []; }
}

// ===================== ABSENCE REASON HANDLING =====================

const ABSENCE_REASONS = {
  clinical: 'On call / clinical commitment',
  leave: 'On leave / day off',
  unaware: "Wasn't aware of the session",
  not_relevant: 'Topic not relevant to me',
  other: 'Other reason'
};

async function handleAbsenceURLParams() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('absence_token');
  const reason = params.get('reason');
  if (!token) return false;

  // Clear URL params
  window.history.replaceState({}, '', window.location.pathname);

  const container = document.getElementById('absenceLandingView');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="loading-spinner"></div></div>';
  switchView('absenceLanding');

  try {
    const records = await sbGet('absence_reasons', `token=eq.${encodeURIComponent(token)}&select=*`);
    if (records.length === 0) {
      container.innerHTML = renderAbsenceLanding('error', 'This link has expired or is invalid.');
      return true;
    }
    const record = records[0];
    if (record.submitted_at) {
      container.innerHTML = renderAbsenceLanding('already', 'You have already submitted your response. Thank you!');
      return true;
    }

    if (reason && reason !== 'other') {
      // Direct submission from email button
      await sbUpdate('absence_reasons', record.id, {
        reason: reason,
        submitted_at: new Date().toISOString()
      });
      container.innerHTML = renderAbsenceLanding('success', `Thank you for letting us know. Your response has been recorded: <strong>${ABSENCE_REASONS[reason] || reason}</strong>`);
    } else if (reason === 'other') {
      // Show text input form
      container.innerHTML = renderAbsenceOtherForm(token, record.id);
    } else {
      // Show all options (fallback)
      container.innerHTML = renderAbsenceChoices(token, record);
    }
  } catch(e) {
    console.error('Absence token error:', e);
    container.innerHTML = renderAbsenceLanding('error', 'Something went wrong. Please try again later.');
  }
  return true;
}

function renderAbsenceLanding(type, message) {
  const icon = type === 'success' ? '✅' : type === 'already' ? '👍' : '⚠️';
  const color = type === 'error' ? 'var(--nhs-red)' : 'var(--nhs-green)';
  return `<div style="max-width:500px;margin:60px auto;text-align:center;padding:30px;">
    <img src="${LOGO_URL}" alt="Logo" style="height:60px;margin-bottom:16px;">
    <div style="font-size:48px;margin-bottom:12px;">${icon}</div>
    <h2 style="color:var(--nhs-dark-blue);margin-bottom:12px;">Southmead Surgical Teaching</h2>
    <p style="font-size:15px;color:${color};">${message}</p>
    <p style="font-size:12px;color:var(--nhs-grey);margin-top:20px;">This helps us improve our teaching programme.</p>
  </div>`;
}

function renderAbsenceOtherForm(token, recordId) {
  return `<div style="max-width:500px;margin:60px auto;text-align:center;padding:30px;">
    <img src="${LOGO_URL}" alt="Logo" style="height:60px;margin-bottom:16px;">
    <h2 style="color:var(--nhs-dark-blue);margin-bottom:8px;">Southmead Surgical Teaching</h2>
    <p style="font-size:14px;color:var(--nhs-grey);margin-bottom:20px;">Please let us know why you couldn't attend:</p>
    <textarea id="absenceOtherText" rows="4" placeholder="Please briefly describe the reason..." style="width:100%;max-width:400px;padding:12px;font-size:14px;border:1.5px solid var(--nhs-pale-grey);border-radius:8px;margin-bottom:16px;"></textarea>
    <br>
    <button class="btn btn-green" style="padding:12px 36px;font-size:15px;" onclick="submitAbsenceOther(${recordId})">Submit</button>
  </div>`;
}

async function submitAbsenceOther(recordId) {
  const text = document.getElementById('absenceOtherText').value.trim();
  if (!text) { showToast('Please enter a reason'); return; }
  try {
    await sbUpdate('absence_reasons', recordId, {
      reason: 'other',
      other_text: text,
      submitted_at: new Date().toISOString()
    });
    document.getElementById('absenceLandingView').innerHTML = renderAbsenceLanding('success', 'Thank you for your feedback. Your response has been recorded.');
  } catch(e) { showToast('Failed to submit. Please try again.'); }
}

function renderAbsenceChoices(token, record) {
  let buttonsHtml = '';
  for (const [key, label] of Object.entries(ABSENCE_REASONS)) {
    if (key === 'other') {
      buttonsHtml += `<a href="?absence_token=${encodeURIComponent(token)}&reason=other" style="display:block;padding:14px;margin:6px 0;background:white;border:1.5px solid var(--nhs-pale-grey);border-radius:8px;text-decoration:none;color:var(--nhs-dark-blue);font-size:14px;text-align:center;">${label}</a>`;
    } else {
      buttonsHtml += `<a href="?absence_token=${encodeURIComponent(token)}&reason=${key}" style="display:block;padding:14px;margin:6px 0;background:white;border:1.5px solid var(--nhs-pale-grey);border-radius:8px;text-decoration:none;color:var(--nhs-dark-blue);font-size:14px;text-align:center;">${label}</a>`;
    }
  }
  return `<div style="max-width:500px;margin:60px auto;text-align:center;padding:30px;">
    <img src="${LOGO_URL}" alt="Logo" style="height:60px;margin-bottom:16px;">
    <h2 style="color:var(--nhs-dark-blue);margin-bottom:8px;">Southmead Surgical Teaching</h2>
    <p style="font-size:14px;color:var(--nhs-grey);margin-bottom:20px;">We noticed you couldn't make the session. Could you let us know why?</p>
    <div style="max-width:400px;margin:0 auto;">${buttonsHtml}</div>
  </div>`;
}

// ===================== ABSENCES ADMIN VIEW =====================

async function loadAbsencesView() {
  const container = document.getElementById('absencesView');
  container.innerHTML = '<div style="text-align:center;padding:30px;"><div class="loading-spinner"></div> Loading absence data...</div>';
  try {
    const [absences, learners] = await Promise.all([
      sbGet('absence_reasons', 'order=created_at.desc&select=*'),
      sbGet('learners', 'select=id,name,grade,placement')
    ]);
    const learnerMap = {};
    learners.forEach(l => { learnerMap[l.id] = l; });

    // Stats
    const submitted = absences.filter(a => a.submitted_at);
    const pending = absences.filter(a => !a.submitted_at);
    const reasonCounts = {};
    submitted.forEach(a => {
      const r = a.reason || 'unknown';
      reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    });

    let html = `<h3 style="color:var(--nhs-dark-blue);margin-bottom:16px;">Absence Tracking</h3>`;

    // Stats cards
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:20px;">
      <div class="stat-card"><div class="stat-num">${absences.length}</div><div class="stat-label">Total Sent</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--nhs-green);">${submitted.length}</div><div class="stat-label">Responded</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--nhs-orange);">${pending.length}</div><div class="stat-label">Awaiting</div></div>
      <div class="stat-card"><div class="stat-num">${submitted.length ? Math.round(submitted.length/absences.length*100) : 0}%</div><div class="stat-label">Response Rate</div></div>
    </div>`;

    // Reason breakdown
    if (submitted.length > 0) {
      html += '<div class="dashboard-card" style="margin-bottom:16px;"><h4>Reason Breakdown</h4>';
      const reasonLabels = { clinical: 'Clinical commitment', leave: 'On leave', unaware: 'Unaware of session', not_relevant: 'Not relevant', other: 'Other' };
      for (const [reason, count] of Object.entries(reasonCounts).sort((a,b) => b[1]-a[1])) {
        const pct = Math.round(count/submitted.length*100);
        html += `<div style="display:flex;align-items:center;gap:10px;margin:6px 0;">
          <span style="width:160px;font-size:13px;">${reasonLabels[reason]||reason}</span>
          <div style="flex:1;background:var(--nhs-pale-grey);border-radius:4px;height:20px;"><div style="width:${pct}%;background:var(--nhs-dark-blue);border-radius:4px;height:100%;"></div></div>
          <span style="font-size:13px;font-weight:600;width:50px;text-align:right;">${count} (${pct}%)</span>
        </div>`;
      }
      html += '</div>';
    }

    // Recent responses
    html += '<div class="dashboard-card"><h4>Recent Responses</h4>';
    if (submitted.length === 0) {
      html += '<p style="color:var(--nhs-grey);text-align:center;padding:16px;">No responses yet.</p>';
    } else {
      html += '<div style="max-height:400px;overflow-y:auto;">';
      submitted.slice(0, 30).forEach(a => {
        const learner = learnerMap[a.learner_id] || {};
        const ev = events.find(e => e.id === a.session_id);
        const sessionLabel = ev ? `${esc(ev.topic||'Session')} — ${esc(ev.date)} ${esc(ev.month)}` : `Session #${a.session_id}`;
        const reasonLabel = ABSENCE_REASONS[a.reason] || a.reason || '—';
        const otherNote = a.other_text ? ` — "${esc(a.other_text)}"` : '';
        html += `<div style="padding:10px 0;border-bottom:1px solid var(--nhs-pale-grey);font-size:13px;">
          <strong>${esc(learner.name||'Unknown')}</strong> <span style="color:var(--nhs-grey);">(${esc(learner.grade||'')})</span>
          <div style="color:var(--nhs-grey);font-size:12px;">${sessionLabel}</div>
          <div style="margin-top:4px;"><span style="background:#e0e7f5;color:#003087;font-size:11px;padding:2px 8px;border-radius:10px;">${reasonLabel}</span>${otherNote}</div>
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;
  } catch(e) { console.error('Load absences failed:', e); container.innerHTML = '<div style="color:var(--nhs-red);padding:20px;">Failed to load absence data.</div>'; }
}

// Southmead Surgical Teaching — learner.js
// Attendance, feedback, dashboards, approvals, attendance chart, certificates

// ===================== ATTENDANCE =====================
async function markSelfAttendance(sessionId) {
  if (!currentLearner) { showToast('Please login first'); return; }
  try {
    const ev = events.find(e => e.id === sessionId);
    const sessionDate = ev ? eventToDate(ev) : null;
    const today = new Date(); today.setHours(0,0,0,0);
    const isPast = sessionDate && sessionDate < today;
    const attData = {
      session_id: sessionId,
      learner_id: currentLearner.id,
      method: 'self',
      status: isPast ? 'pending' : 'approved',
      retrospective: isPast ? true : false
    };
    await sbInsert('attendance', attData);
    showToast(isPast ? 'Attendance submitted for approval' : 'Attendance marked!');
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
    const [learners, existing] = await Promise.all([
      sbGet('learners', 'order=name.asc&select=*'),
      sbGet('attendance', `session_id=eq.${sessionId}&select=*`)
    ]);
    const attendanceMap = {};
    existing.forEach(a => { attendanceMap[a.learner_id] = a; });
    const attendedIds = new Set(existing.map(a => a.learner_id));
    let html = `<input type="hidden" id="attendanceSessionId" value="${sessionId}">`;
    html += `<div style="margin-bottom:12px;font-size:13px;color:var(--nhs-grey);">${learners.length} registered learners</div>`;
    if (learners.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:var(--nhs-grey);">No learners registered yet.</div>';
    } else {
      html += '<div style="max-height:400px;overflow-y:auto;">';
      learners.forEach(l => {
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
        html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--nhs-pale-grey);">
          <input type="checkbox" id="att_${l.id}" value="${l.id}" ${attendedIds.has(l.id) ? 'checked' : ''} style="width:18px;height:18px;">
          <label for="att_${l.id}" style="margin:0;font-size:13px;cursor:pointer;flex:1;">
            <strong>${esc(l.name)}</strong> <span style="color:var(--nhs-grey);">(${esc(l.grade)} - ${esc(l.placement)})</span>
            ${statusBadge}${retroBadge}
          </label>
          ${approveButtons}
        </div>`;
      });
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
  const checkboxes = document.querySelectorAll('#attendanceModalBody input[type="checkbox"][id^="att_"]');
  const checkedIds = [];
  const uncheckedIds = [];
  checkboxes.forEach(cb => {
    if (cb.checked) checkedIds.push(parseInt(cb.value));
    else uncheckedIds.push(parseInt(cb.value));
  });
  try {
    // Insert new attendance records
    for (const learnerId of checkedIds) {
      try {
        await sbInsert('attendance', { session_id: sessionId, learner_id: learnerId, method: 'admin', status: 'approved' });
      } catch(e) { /* ignore duplicates */ }
    }
    // Remove unchecked (delete where session+learner match)
    for (const learnerId of uncheckedIds) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?session_id=eq.${sessionId}&learner_id=eq.${learnerId}`, { method: 'DELETE', headers });
      } catch(e) { /* ignore */ }
    }
    closeModal('attendanceModal');
    showToast('Attendance saved');
  } catch(e) { console.error('Save attendance failed:', e); showToast('Failed to save attendance'); }
}

// ===================== FEEDBACK SYSTEM =====================
let feedbackRatings = { content: 0, teaching: 0, relevance: 0, overall: 0 };

function initStarRatings() {
  document.querySelectorAll('.star-rating').forEach(container => {
    const field = container.dataset.field;
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = 'star';
      star.textContent = '☆';
      star.dataset.value = i;
      star.onclick = () => setStarRating(field, i);
      star.onmouseenter = () => highlightStars(field, i);
      star.onmouseleave = () => highlightStars(field, feedbackRatings[field]);
      container.appendChild(star);
    }
  });
}

function setStarRating(field, value) {
  feedbackRatings[field] = value;
  highlightStars(field, value);
}

function highlightStars(field, upTo) {
  const container = document.querySelector(`.star-rating[data-field="${field}"]`);
  if (!container) return;
  container.querySelectorAll('.star').forEach(star => {
    const v = parseInt(star.dataset.value);
    star.classList.toggle('filled', v <= upTo);
    star.textContent = v <= upTo ? '★' : '☆';
  });
}

function openFeedbackModal(sessionId) {
  if (!currentLearner) { showToast('Please login as a learner first'); openLearnerLoginModal(); return; }
  const ev = events.find(e => e.id === sessionId);
  if (!ev) { showToast('Session not found'); return; }
  document.getElementById('feedbackSessionId').value = sessionId;
  document.getElementById('feedbackSessionInfo').innerHTML = `<strong>${esc(ev.topic || 'Session')}</strong><br>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year} | ${esc(ev.teacher || 'TBD')}`;
  feedbackRatings = { content: 0, teaching: 0, relevance: 0, overall: 0 };
  initStarRatings();
  document.getElementById('feedbackLearned').value = '';
  document.getElementById('feedbackSuggestions').value = '';
  document.getElementById('feedbackComments').value = '';
  document.getElementById('feedbackRecommend').checked = true;
  document.getElementById('feedbackAnonymous').checked = false;
  document.getElementById('paceRight').checked = true;
  openModal('feedbackModal');
}

async function submitFeedback() {
  if (!currentLearner) { showToast('Please login first'); return; }
  const sessionId = parseInt(document.getElementById('feedbackSessionId').value);
  if (!feedbackRatings.overall) { showToast('Please rate the session overall'); return; }
  const pace = document.querySelector('input[name="feedbackPace"]:checked')?.value || 'just_right';
  const data = {
    session_id: sessionId,
    learner_id: currentLearner.id,
    anonymous: document.getElementById('feedbackAnonymous').checked,
    rating_content: feedbackRatings.content || null,
    rating_teaching: feedbackRatings.teaching || null,
    rating_relevance: feedbackRatings.relevance || null,
    rating_pace: pace,
    rating_overall: feedbackRatings.overall,
    learned_today: document.getElementById('feedbackLearned').value.trim(),
    suggestions: document.getElementById('feedbackSuggestions').value.trim(),
    comments: document.getElementById('feedbackComments').value.trim(),
    would_recommend: document.getElementById('feedbackRecommend').checked
  };
  try {
    await sbInsert('feedback', data);
    closeModal('feedbackModal');
    showToast('Thank you for your feedback!');
  } catch(e) {
    console.error('Submit feedback failed:', e);
    if (e.message && e.message.includes('409')) {
      showToast('You have already submitted feedback for this session');
    } else {
      showToast('Failed to submit feedback');
    }
  }
}

// ===================== FEEDBACK ADMIN VIEW =====================
async function loadFeedbackView() {
  const container = document.getElementById('feedbackView');
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading feedback...</div>';
  try {
    const [feedback, learners] = await Promise.all([
      sbGet('feedback', 'order=submitted_at.desc&select=*'),
      sbGet('learners', 'select=id,name')
    ]);
    const learnerMap = {};
    learners.forEach(l => learnerMap[l.id] = l.name);

    let html = '<h3 style="color:var(--nhs-dark-blue);margin-bottom:16px;">Feedback Overview</h3>';

    if (feedback.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">No feedback submitted yet.</div>';
      container.innerHTML = html;
      return;
    }

    // Overall stats
    const avgOverall = (feedback.reduce((s, f) => s + (f.rating_overall || 0), 0) / feedback.length).toFixed(1);
    const avgContent = (feedback.filter(f=>f.rating_content).reduce((s,f)=>s+f.rating_content,0) / (feedback.filter(f=>f.rating_content).length || 1)).toFixed(1);
    const avgTeaching = (feedback.filter(f=>f.rating_teaching).reduce((s,f)=>s+f.rating_teaching,0) / (feedback.filter(f=>f.rating_teaching).length || 1)).toFixed(1);
    const recommendPct = Math.round(feedback.filter(f => f.would_recommend).length / feedback.length * 100);

    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
      <div class="stat-card"><div class="stat-num">${avgOverall}</div><div class="stat-label">Overall Rating</div></div>
      <div class="stat-card"><div class="stat-num">${avgContent}</div><div class="stat-label">Content</div></div>
      <div class="stat-card"><div class="stat-num">${avgTeaching}</div><div class="stat-label">Teaching</div></div>
      <div class="stat-card"><div class="stat-num">${recommendPct}%</div><div class="stat-label">Would Recommend</div></div>
      <div class="stat-card"><div class="stat-num">${feedback.length}</div><div class="stat-label">Total Responses</div></div>
    </div>`;

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
      const sessionAvg = (items.reduce((s,f) => s + (f.rating_overall||0), 0) / items.length).toFixed(1);
      html += `<div class="feedback-session-group" data-session="${sid}">
        <div style="background:var(--nhs-bg);border-radius:8px;padding:12px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
          <div><strong>${esc(sessionLabel)}</strong><br><span style="font-size:12px;color:var(--nhs-grey);">${items.length} response${items.length!==1?'s':''}</span></div>
          <div style="font-size:20px;font-weight:700;color:var(--nhs-blue);">${sessionAvg} ★</div>
        </div>`;
      items.forEach(f => {
        const name = f.anonymous ? 'Anonymous' : (learnerMap[f.learner_id] || 'Unknown');
        html += `<div class="feedback-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:600;color:var(--nhs-dark-blue);">${esc(name)}</span>
            <span style="font-size:11px;color:var(--nhs-grey);">${f.submitted_at ? new Date(f.submitted_at).toLocaleDateString() : ''}</span>
          </div>
          <div style="font-size:13px;margin-bottom:6px;">
            Overall: ${'★'.repeat(f.rating_overall||0)}${'☆'.repeat(5-(f.rating_overall||0))}
            ${f.rating_content ? ' | Content: ' + '★'.repeat(f.rating_content) + '☆'.repeat(5-f.rating_content) : ''}
            ${f.rating_teaching ? ' | Teaching: ' + '★'.repeat(f.rating_teaching) + '☆'.repeat(5-f.rating_teaching) : ''}
          </div>
          ${f.rating_pace ? '<div style="font-size:12px;color:var(--nhs-grey);">Pace: ' + f.rating_pace.replace('_',' ') + '</div>' : ''}
          ${f.learned_today ? '<div style="font-size:13px;margin-top:6px;"><strong>Learned:</strong> ' + esc(f.learned_today) + '</div>' : ''}
          ${f.suggestions ? '<div style="font-size:13px;margin-top:4px;"><strong>Suggestions:</strong> ' + esc(f.suggestions) + '</div>' : ''}
          ${f.comments ? '<div style="font-size:13px;margin-top:4px;font-style:italic;color:#425563;">' + esc(f.comments) + '</div>' : ''}
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
    const actions = [
      { icon: '➕', text: 'Add Session', action: "document.getElementById('addSessionBtn')?.click()" },
      { icon: '📧', text: 'Bulk Remind', action: "openBulkEmailModal()" },
      { icon: '💬', text: 'WhatsApp', action: "openBulkWhatsAppModal()" },
      { icon: '📋', text: 'Export CSV', action: "exportCSV()" },
      { icon: '📥', text: 'Check Inbox', action: "switchView('inbox')" },
      { icon: '👥', text: 'Contacts', action: "switchView('contacts')" },
      { icon: '📊', text: 'Attendance', action: "switchViewFromDropdown('attendanceChart')" },
      { icon: '💡', text: 'Topic Ideas', action: "switchViewFromDropdown('ideas')" },
    ];
    actions.forEach(a => {
      html += `<div class="qa-tile" onclick="${a.action}"><div class="qa-icon">${a.icon}</div><div class="qa-text">${a.text}</div></div>`;
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
    const attendance = await sbGet('attendance', `learner_id=eq.${currentLearner.id}&select=*`);
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
    // Send email notification to learner
    try {
      const attRecords = await sbGet('attendance', `id=eq.${attendanceId}&select=*`);
      if (attRecords.length > 0) {
        const learnerRecords = await sbGet('learners', `id=eq.${attRecords[0].learner_id}&select=*`);
        if (learnerRecords.length > 0) {
          const learner = learnerRecords[0];
          const ev = events.find(e => e.id === attRecords[0].session_id);
          const sessionLabel = ev ? `${ev.topic || 'Session'} (${ev.day} ${ev.date} ${ev.month} ${ev.year})` : 'a teaching session';
          await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: learner.email,
              subject: `Attendance ${approve ? 'Approved' : 'Rejected'} - ${sessionLabel}`,
              body: `Dear ${learner.name},\n\nYour retrospective attendance for ${sessionLabel} has been ${approve ? 'approved' : 'rejected'}.\n\nRegards,\nSouthmead Surgical Teaching`
            })
          });
        }
      }
    } catch(emailErr) { console.warn('Email notification failed:', emailErr); }
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
      sbGet('attendance', 'status=eq.pending&select=*&order=created_at.desc'),
      sbGet('attendance', 'status=neq.pending&order=approved_at.desc&limit=20&select=*')
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
        const requestedDate = a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB') : '';
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
async function generateCertificate() {
  if (!currentLearner) return;
  try {
    const attendance = await sbGet('attendance', `learner_id=eq.${currentLearner.id}&select=*`);
    const attendedSessionIds = attendance.map(a => a.session_id);
    const attendedSessions = events.filter(e => attendedSessionIds.includes(e.id));
    attendedSessions.sort((a, b) => { const da = eventToDate(a), db = eventToDate(b); return (da||0)-(db||0); });
    const totalHours = attendedSessions.length;

    const certWindow = window.open('', '_blank');
    certWindow.document.write(`<!DOCTYPE html>
<html><head><title>Certificate of Attendance</title>
<style>
  @media print { body { margin: 0; } .no-print { display: none; } }
  body { font-family: Arial, sans-serif; margin: 0; padding: 40px; background: white; color: #231f20; }
  .cert-container { max-width: 900px; margin: 0 auto; border: 3px solid #005eb8; padding: 50px; position: relative; }
  .cert-container::before { content: ''; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 1px solid #41b6e6; pointer-events: none; }
  .cert-header { text-align: center; margin-bottom: 30px; }
  .cert-header h1 { color: #005eb8; font-size: 32px; margin: 0 0 8px; letter-spacing: 1px; }
  .cert-header h2 { color: #003087; font-size: 18px; margin: 0; font-weight: 400; }
  .cert-nhs { color: #005eb8; font-size: 14px; margin-top: 10px; }
  .cert-body { margin: 30px 0; }
  .cert-name { text-align: center; font-size: 26px; font-weight: 700; color: #003087; margin: 20px 0; padding: 10px; border-bottom: 2px solid #41b6e6; }
  .cert-details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; margin: 20px 0; }
  .cert-details dt { font-weight: 600; color: #005eb8; }
  .cert-details dd { margin: 0; }
  .cert-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
  .cert-table th { background: #005eb8; color: white; padding: 8px 10px; text-align: left; }
  .cert-table td { padding: 6px 10px; border-bottom: 1px solid #e8edee; }
  .cert-table tr:nth-child(even) { background: #f0f4f5; }
  .cert-footer { text-align: center; margin-top: 40px; font-size: 13px; color: #768692; }
  .cert-total { text-align: center; font-size: 18px; font-weight: 700; color: #005eb8; margin: 20px 0; padding: 14px; background: #f0f4f5; border-radius: 8px; }
  .print-btn { display: block; margin: 20px auto; padding: 12px 30px; background: #005eb8; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
  .print-btn:hover { background: #003087; }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
<div class="cert-container">
  <div class="cert-header">
    <h1>CERTIFICATE OF ATTENDANCE</h1>
    <h2>Southmead Surgical Teaching Programme</h2>
    <div class="cert-nhs">North Bristol NHS Trust | Southmead Hospital</div>
  </div>
  <div class="cert-body">
    <div style="text-align:center;font-size:14px;color:#768692;">This is to certify that</div>
    <div class="cert-name">${esc(currentLearner.name)}</div>
    <div class="cert-details">
      <dt>Grade</dt><dd>${esc(currentLearner.grade)}</dd>
      <dt>Placement</dt><dd>${esc(currentLearner.placement)}</dd>
      ${currentLearner.placement_start ? '<dt>Period</dt><dd>' + currentLearner.placement_start + ' to ' + (currentLearner.placement_end || 'present') + '</dd>' : ''}
    </div>
    <div style="text-align:center;font-size:14px;color:#768692;margin:20px 0;">has attended the following teaching sessions:</div>
    <table class="cert-table">
      <thead><tr><th>#</th><th>Date</th><th>Topic</th><th>Teacher</th></tr></thead>
      <tbody>${attendedSessions.map((s, i) => `<tr><td>${i+1}</td><td>${esc(s.day)} ${esc(s.date)} ${esc(s.month)} ${s.year}</td><td>${esc(s.topic || 'TBD')}</td><td>${esc(s.teacher || '-')}</td></tr>`).join('')}</tbody>
    </table>
    <div class="cert-total">Total CPD Hours: ${totalHours} hour${totalHours !== 1 ? 's' : ''}</div>
  </div>
  <div class="cert-footer">
    <div style="margin-bottom:20px;">Certified by: <strong>Southmead Surgical Teaching Programme</strong></div>
    <div>Date of Issue: ${new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}</div>
  </div>
</div>
</body></html>`);
    certWindow.document.close();
  } catch(e) { console.error('Generate certificate failed:', e); showToast('Failed to generate certificate'); }
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

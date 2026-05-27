// Southmead Surgical Teaching — sessions.js
// Navigation, rendering, calendar, session CRUD, contacts, ideas, activity log, requests, site feedback

// ===================== NAVIGATION & VIEW SWITCHING =====================

// ===================== VIEW SWITCHING =====================
function toggleNavDropdown(e) {
  e.preventDefault();
  e.stopPropagation();
  const dd = document.getElementById('navDropdown');
  const isOpen = dd.classList.contains('show');
  if (!isOpen) {
    // Position dropdown below the More button (desktop only — mobile CSS overrides to fixed full-width)
    const btn = document.querySelector('.nav-more-btn');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      dd.style.top = rect.bottom + 'px';
      dd.style.left = Math.max(0, rect.right - 200) + 'px'; // right-align, 200 = min-width
    }
  }
  dd.classList.toggle('show', !isOpen);
}
function switchViewFromDropdown(view) {
  document.getElementById('navDropdown').classList.remove('show');
  switchView(view);
}
// Close dropdown when clicking outside.
// NB: as of v3.5.6 the .nav-dropdown lives OUTSIDE .nav-more-wrapper so we
// must check both for the click target before deciding to close.
document.addEventListener('click', (e) => {
  const wrapper = document.querySelector('.nav-more-wrapper');
  const dd = document.getElementById('navDropdown');
  if (!dd) return;
  if (wrapper && wrapper.contains(e.target)) return; // clicked the More button area
  if (dd.contains(e.target)) return;                  // clicked an item inside the dropdown
  dd.classList.remove('show');
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  // Update dropdown items active state
  document.querySelectorAll('.nav-dropdown-item').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  // Highlight "More" button if a dropdown view is active
  const moreBtn = document.querySelector('.nav-more-btn');
  const dropdownViews = ['all','ideas','requests','feedback','approvals','attendanceChart','roster','absences','siteFeedback','surveyResults','errorLog','qiDash','log'];
  // Close nav dropdown on any view switch
  const dd = document.getElementById('navDropdown');
  if (dd) dd.classList.remove('show');
  if (moreBtn) moreBtn.classList.toggle('has-active', dropdownViews.includes(view));
  // Restore nav bar visibility (may have been hidden by action landing)
  document.querySelector('.nav-bar').style.display = '';
  document.getElementById('listView').style.display = 'none';
  document.getElementById('calendarView').style.display = 'none';
  document.getElementById('topicIdeasView').style.display = 'none';
  document.getElementById('activityLogView').style.display = 'none';
  document.getElementById('requestsView').style.display = 'none';
  document.getElementById('contactsView').style.display = 'none';
  document.getElementById('feedbackView').style.display = 'none';
  document.getElementById('approvalsView').style.display = 'none';
  document.getElementById('attendanceChartView').style.display = 'none';
  document.getElementById('siteFeedbackView').style.display = 'none';
  document.getElementById('adminDashView').style.display = 'none';
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('inboxView').style.display = 'none';
  document.getElementById('teacherDashView').style.display = 'none';
  document.getElementById('actionLandingView').style.display = 'none';
  document.getElementById('rosterView').style.display = 'none';
  document.getElementById('absencesView').style.display = 'none';
  document.getElementById('absenceLandingView').style.display = 'none';
  document.getElementById('surveyView').style.display = 'none';
  document.getElementById('surveyResultsView').style.display = 'none';
  const errorLogEl = document.getElementById('errorLogView'); if (errorLogEl) errorLogEl.style.display = 'none';
  const qiDashEl = document.getElementById('qiDashView'); if (qiDashEl) qiDashEl.style.display = 'none';
  const filtersBar = document.getElementById('filtersBar');
  const statsBar = document.getElementById('statsBar');
  const welcomeBanner = document.getElementById('welcomeBanner');

  if (view === 'calendar') {
    document.getElementById('calendarView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    renderCalendar();
  } else if (view === 'ideas') {
    document.getElementById('topicIdeasView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    renderIdeas();
  } else if (view === 'log') {
    document.getElementById('activityLogView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadActivityLog();
  } else if (view === 'requests') {
    document.getElementById('requestsView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadRequests();
  } else if (view === 'contacts') {
    document.getElementById('contactsView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadContacts();
  } else if (view === 'feedback') {
    document.getElementById('feedbackView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadFeedbackView();
  } else if (view === 'approvals') {
    document.getElementById('approvalsView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadApprovals();
  } else if (view === 'attendanceChart') {
    document.getElementById('attendanceChartView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadAttendanceChart();
  } else if (view === 'adminDash') {
    document.getElementById('adminDashView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadAdminDashboard();
  } else if (view === 'dashboard') {
    document.getElementById('dashboardView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadDashboard();
  } else if (view === 'inbox') {
    document.getElementById('inboxView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadInbox();
  } else if (view === 'siteFeedback') {
    document.getElementById('siteFeedbackView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadSiteFeedbackView();
  } else if (view === 'teacherDash') {
    document.getElementById('teacherDashView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    if (currentTeacher) loadTeacherDashboard();
  } else if (view === 'roster') {
    document.getElementById('rosterView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadRosterView();
  } else if (view === 'absences') {
    document.getElementById('absencesView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadAbsencesView();
  } else if (view === 'actionLanding') {
    document.getElementById('actionLandingView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
  } else if (view === 'absenceLanding') {
    document.getElementById('absenceLandingView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    document.querySelector('.nav-bar').style.display = 'none';
  } else if (view === 'survey') {
    document.getElementById('surveyView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
  } else if (view === 'surveyResults') {
    document.getElementById('surveyResultsView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    renderSurveyResults();
  } else if (view === 'errorLog') {
    document.getElementById('errorLogView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    if (typeof loadErrorLog === 'function') loadErrorLog();
  } else if (view === 'qiDash') {
    document.getElementById('qiDashView').style.display = 'block';
    filtersBar.style.display = 'none'; statsBar.style.display = 'none'; welcomeBanner.style.display = 'none';
    loadQIDashboard();
  } else {
    document.getElementById('listView').style.display = 'block';
    filtersBar.style.display = '';
    if (isAdmin) statsBar.style.display = '';
    welcomeBanner.style.display = (isAdmin || currentLearner) ? 'none' : '';
    renderEvents();
  }
}

// ===================== FILTERING =====================
function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
  renderEvents();
}

function getFilteredEvents() {
  const search = document.getElementById('searchBox').value.toLowerCase();
  const monthFilter = document.getElementById('monthSelect').value;
  let filtered = [...events];

  // Non-admin (or admin in learner view): show only current rotation, exclude cancelled & TBD
  if (!isAdmin || adminViewAsLearner) {
    filtered = filtered.filter(e => e.published && isInCurrentRotation(e) && e.status !== 'cancelled' && e.status !== 'tbd');
  } else if (!adminViewAsLearner && (currentView === 'list' || currentView === 'all')) {
    // Admin: upcoming/all/tbd show future sessions (including drafts & TBD)
    if (currentFilter === 'all' || currentFilter === 'upcoming' || currentFilter === 'tbd') {
      filtered = filtered.filter(e => isFutureEvent(e));
    }
  } else if (!adminViewAsLearner && currentView === 'drafts') {
    filtered = filtered.filter(e => !e.published && isFutureEvent(e));
  }
  if (currentFilter !== 'all') {
    if (!isAdmin || adminViewAsLearner) {
      if (currentFilter === 'upcoming') {
        // Upcoming = future sessions only (regardless of DB status)
        filtered = filtered.filter(e => isFutureEvent(e));
      } else if (currentFilter === 'completed') {
        // Completed = past sessions or explicitly marked completed
        filtered = filtered.filter(e => e.status === 'completed' || !isFutureEvent(e));
      }
    } else {
      // Admin upcoming = all future (drafts + TBD + upcoming), don't filter by status
      if (currentFilter !== 'upcoming') {
        filtered = filtered.filter(e => e.status === currentFilter);
      }
    }
  }
  if (search) {
    filtered = filtered.filter(e =>
      (e.topic || '').toLowerCase().includes(search) ||
      (e.teacher || '').toLowerCase().includes(search) ||
      (e.room || '').toLowerCase().includes(search) ||
      (e.notes || '').toLowerCase().includes(search)
    );
  }
  if (monthFilter) {
    const [m, y] = monthFilter.split('|');
    filtered = filtered.filter(e => e.month === m && String(e.year) === y);
  }
  // Filter by learner placement dates (non-admin only)
  if (!isAdmin && currentLearner && currentLearner.placement_start && currentLearner.placement_end) {
    const pStart = new Date(currentLearner.placement_start); pStart.setHours(0,0,0,0);
    const pEnd = new Date(currentLearner.placement_end); pEnd.setHours(23,59,59,999);
    filtered = filtered.filter(e => {
      const d = eventToDate(e);
      if (!d) return true;
      return d >= pStart && d <= pEnd;
    });
  }
  filtered.sort((a, b) => {
    const da = eventToDate(a), db = eventToDate(b);
    if (!da || !db) return 0;
    return da - db;
  });
  return filtered;
}

// ===================== RENDER SESSIONS LIST & STATS =====================

// ===================== RENDER =====================
function renderAll() { updateStats(); populateMonthSelect(); renderEvents(); }

function updateStats() {
  const src = (isAdmin && !adminViewAsLearner) ? events : events.filter(e => e.published && isInCurrentRotation(e) && e.status !== 'cancelled' && e.status !== 'tbd');
  document.getElementById('statTotal').textContent = src.length;
  document.getElementById('statUpcoming').textContent = src.filter(e => e.status === 'upcoming').length;
  document.getElementById('statCompleted').textContent = src.filter(e => e.status === 'completed').length;
  document.getElementById('statCancelled').textContent = src.filter(e => e.status === 'cancelled').length;
  document.getElementById('statTbd').textContent = events.filter(e => e.status === 'tbd').length;
  document.getElementById('statDraft').textContent = events.filter(e => !e.published).length;
}

function populateMonthSelect() {
  const sel = document.getElementById('monthSelect');
  const months = new Set();
  events.forEach(e => months.add(e.month + '|' + e.year));
  const sorted = [...months].sort((a, b) => {
    const [am, ay] = a.split('|'); const [bm, by] = b.split('|');
    return (parseInt(ay) - parseInt(by)) || (monthIndex(am) - monthIndex(bm));
  });
  sel.innerHTML = '<option value="">All months</option>';
  sorted.forEach(m => { const [mn, yr] = m.split('|'); sel.innerHTML += `<option value="${m}">${mn} ${yr}</option>`; });
}

function renderEvents() {
  const container = document.getElementById('listView');
  const filtered = getFilteredEvents();
  updateStats();
  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">No sessions found.</div>';
    return;
  }
  const groups = {};
  filtered.forEach(e => { const key = e.month + ' ' + e.year; if (!groups[key]) groups[key] = []; groups[key].push(e); });
  let html = '';
  for (const [monthLabel, evts] of Object.entries(groups)) {
    html += `<div class="month-group"><h3>${monthLabel}</h3>`;
    evts.forEach(e => {
      const isDraft = !e.published;
      const topicDisplay = e.topic || (e.teacher ? e.teacher : 'TBD');
      html += `<div class="event-card status-${e.status}${isDraft ? ' draft' : ''}" onclick="showDetail(${e.id})">
        <div class="card-top">
          <div>
            <div class="card-date">${e.day} ${e.date} ${e.month} ${e.year}${e.time ? ' | ' + e.time : ''}</div>
            <div class="card-topic">${esc(topicDisplay)}${isDraft ? '<span class="card-draft-badge">DRAFT</span>' : ''}</div>
            <div class="card-details">
              ${e.teacher ? '<span>&#128100; ' + esc(e.teacher) + '</span>' : ''}
              ${e.backupTeacher ? '<span style="color:var(--nhs-orange);font-size:12px;">&#128260; ' + esc(e.backupTeacher) + '</span>' : ''}
              ${e.room ? '<span>&#128205; ' + esc(e.room) + '</span>' : ''}
            </div>
            ${e.notes ? '<div class="card-notes">' + esc(e.notes) + '</div>' : ''}
          </div>
          <span class="card-status status-pill-${e.status}">${e.status}</span>
        </div>
        ${(isAdmin && e.lastEditBy) ? '<div class="last-edit-info">Last edited by ' + esc(e.lastEditBy) + (e.lastEditAt ? ' at ' + new Date(e.lastEditAt).toLocaleString() : '') + '</div>' : ''}
        ${e.status !== 'cancelled' && (e.status === 'completed' || (eventToDate(e) && eventToDate(e) < new Date())) ? '<div style="margin-top:8px;display:flex;gap:6px;">' + (currentLearner ? '<button class="btn btn-green" style="font-size:11px;padding:4px 10px;" onclick="event.stopPropagation();markSelfAttendance(' + e.id + ')">I Attended</button>' : '') + '<button class="btn btn-white" style="font-size:11px;padding:4px 10px;border:1px solid var(--nhs-blue);color:var(--nhs-blue);" onclick="event.stopPropagation();openFeedbackModal(' + e.id + ')">Give Feedback</button></div>' : ''}
      </div>`;
    });
    html += '</div>';
  }
  container.innerHTML = html;
}

function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ===================== CALENDAR =====================

// ===================== CALENDAR =====================
function renderCalendar() {
  const container = document.getElementById('calendarView');
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();
  const monthEvents = events.filter(e => monthIndex(e.month) === calMonth && e.year === calYear);
  let html = `<div class="cal-header">
    <button class="cal-nav-btn" onclick="calPrev()">&laquo; Prev</button>
    <h3>${MONTHS[calMonth]} ${calYear}</h3>
    <button class="cal-nav-btn" onclick="calNext()">Next &raquo;</button>
  </div><div class="cal-grid">`;
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { html += `<div class="cal-day-header">${d}</div>`; });
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = (d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear());
    const cellDate = new Date(calYear, calMonth, d);
    const dayOfWeek = cellDate.getDay(); // 0=Sun, 2=Tue, 3=Wed
    const isTueWed = (dayOfWeek === 2 || dayOfWeek === 3);
    const bankHol = getBankHoliday(calYear, calMonth, d);
    const dayEvents = monthEvents.filter(e => parseDateNum(e.date) === d);
    // Check if this Tue/Wed has an empty/tbd slot (not on bank holidays)
    const hasEmptySlot = isTueWed && !bankHol && cellDate >= today && dayEvents.some(e => e.status !== 'cancelled' && (!e.topic || !e.teacher));
    const isEmptyTueWed = isTueWed && !bankHol && cellDate >= today && dayEvents.length === 0;
    html += `<div class="cal-cell${isToday ? ' today' : ''}${(hasEmptySlot || isEmptyTueWed) ? ' has-empty-slot' : ''}${bankHol ? ' bank-holiday' : ''}"><div class="cal-date">${d}</div>`;
    if (bankHol) {
      html += `<div style="font-size:10px;color:#d5281b;font-weight:600;padding:1px 4px;background:#fde8e8;border-radius:3px;margin-bottom:2px;line-height:1.2;">${esc(bankHol)}</div>`;
    }
    dayEvents.forEach(e => {
      if (!isAdmin && (!e.published || e.status === 'cancelled' || e.status === 'tbd')) return;
      const label = e.topic || e.teacher || e.status;
      html += `<div class="cal-event status-${e.status}" onclick="event.stopPropagation();showDetail(${e.id})" title="${esc(label)}">${esc(label)}</div>`;
    });
    // Show clickable "available" slot on empty Tue/Wed
    if ((hasEmptySlot || isEmptyTueWed) && cellDate >= today) {
      const ordinal = getOrdinal(d);
      const slotLabel = `${dayOfWeek === 2 ? 'Tues' : 'Wed'} ${ordinal} ${MONTHS[calMonth]} ${calYear}`;
      if (isAdmin) {
        // Managers: click to add session directly
        const emptyEv = dayEvents.find(e => e.status === 'tbd' && !e.topic && !e.teacher);
        if (emptyEv) {
          html += `<div class="cal-empty-slot" onclick="event.stopPropagation();openEditModal(${emptyEv.id})" title="Fill this slot">+ Fill slot</div>`;
        } else {
          html += `<div class="cal-empty-slot" onclick="event.stopPropagation();openAddModalPrefilled('${dayOfWeek === 2 ? 'Tues' : 'Wed'}','${ordinal}','${MONTHS[calMonth]}',${calYear})" title="Add session">+ Add session</div>`;
        }
      } else {
        // Public: click to request
        html += `<div class="cal-empty-slot" onclick="event.stopPropagation();openRequestForSlot('${slotLabel}')" title="Request this slot">+ Available</div>`;
      }
    }
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function getOrdinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

async function openAddModalPrefilled(day, date, month, year) {
  editingEventId = null;
  document.getElementById('eventModalTitle').textContent = 'Add Session';
  document.getElementById('evDeleteBtn').style.display = 'none';
  document.getElementById('evDay').value = day;
  document.getElementById('evDate').value = date;
  document.getElementById('evMonth').value = month;
  document.getElementById('evYear').value = year;
  ['evTime','evRoom','evTopic','evTeacher','evTeacherEmail','evBackupTeacher','evBackupEmail','evNotes'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('evStatus').value = 'upcoming';
  document.getElementById('evPublished').checked = true;
  openModal('eventModal');
  await ensureContactsLoaded();
  populateTeacherDatalist();
}

function openRequestForSlot(slotLabel) {
  showRequestSessionModal(slotLabel);
}
function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); }

// ===================== TOPIC IDEAS =====================

// ===================== TOPIC IDEAS =====================
async function renderIdeas() {
  const container = document.getElementById('topicIdeasView');
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading ideas...</div>';
  try {
    const ideas = await sbGet('ideas', 'order=id.asc&select=*');
    const groups = {};
    ideas.forEach(i => { const cat = i.category || 'General Ideas'; if (!groups[cat]) groups[cat] = []; groups[cat].push(i); });
    let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">';
    html += '<h3 style="color:var(--nhs-dark-blue);margin:0;">Topic Ideas</h3>';
    if (isAdmin) html += '<button class="btn btn-green" style="font-size:0.85rem;padding:8px 16px;" onclick="showAddIdeaModal()">+ Add Idea</button>';
    html += '</div>';
    const categoryOrder = ['Core Topics (Tuesday)', 'Clinical Skills (Wednesday)', 'General Ideas', "Lydia's Suggestions", 'Junior Doctor Requests', 'Planning Notes'];
    const sortedCats = Object.keys(groups).sort((a, b) => {
      const ai = categoryOrder.indexOf(a), bi = categoryOrder.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi; if (ai >= 0) return -1; if (bi >= 0) return 1; return a.localeCompare(b);
    });
    sortedCats.forEach(cat => {
      const hasCheckmarks = cat.includes('Core Topics') || cat.includes('Clinical Skills');
      html += '<div class="ideas-section"><h3>' + esc(cat) + '</h3>';
      groups[cat].forEach(i => {
        if (hasCheckmarks) {
          html += '<div class="idea-item"><span class="' + (i.done ? 'idea-done' : 'idea-pending') + '">' + (i.done ? '&#10003;' : '&#9675;') + '</span><span style="flex:1;">' + esc(i.topic) + '</span>' + (i.assigned ? '<span class="idea-assigned">' + esc(i.assigned) + '</span>' : '') + (isAdmin ? '<button onclick="toggleIdeaDone(' + i.id + ',' + !i.done + ')" style="background:none;border:none;color:var(--nhs-blue);cursor:pointer;font-size:11px;padding:2px 6px;" title="Toggle">' + (i.done ? 'undo' : 'done') + '</button><button onclick="deleteIdea(' + i.id + ')" style="background:none;border:none;color:var(--nhs-red);cursor:pointer;font-size:1rem;padding:2px 6px;opacity:0.5;" title="Delete">&times;</button>' : '') + '</div>';
        } else {
          html += '<div class="idea-list-item" style="display:flex;align-items:center;gap:8px;"><span style="flex:1;">' + esc(i.topic) + '</span>' + (isAdmin ? '<button onclick="deleteIdea(' + i.id + ')" style="background:none;border:none;color:var(--nhs-red);cursor:pointer;font-size:1rem;padding:2px 6px;opacity:0.5;" title="Delete">&times;</button>' : '') + '</div>';
        }
      });
      html += '</div>';
    });
    container.innerHTML = html;
  } catch(e) {
    console.error('Failed to load ideas:', e);
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">Failed to load ideas.</div>';
  }
}

function showAddIdeaModal() {
  document.getElementById('ideaCategory').value = 'General Ideas';
  document.getElementById('ideaTopic').value = '';
  document.getElementById('ideaAssigned').value = '';
  openModal('addIdeaModal');
  setTimeout(() => document.getElementById('ideaTopic').focus(), 100);
}

async function submitIdea() {
  const topic = document.getElementById('ideaTopic').value.trim();
  const category = document.getElementById('ideaCategory').value;
  const assigned = document.getElementById('ideaAssigned').value.trim();
  if (!topic) { showToast('Please enter a topic'); return; }
  try {
    await sbInsert('ideas', { topic, category, assigned, done: false, added_by: currentUser?.name || 'Unknown' });
    closeModal('addIdeaModal'); showToast('Idea added');
    logAction('Added idea: ' + topic);
    renderIdeas();
  } catch(e) { console.error('Add idea failed', e); showToast('Failed to add idea'); }
}

async function deleteIdea(id) {
  if (!confirm('Delete this idea?')) return;
  try {
    await sbDelete('ideas', id);
    showToast('Idea deleted'); logAction('Deleted idea #' + id); renderIdeas();
  } catch(e) { console.error('Delete idea failed', e); showToast('Failed to delete idea'); }
}

async function toggleIdeaDone(id, done) {
  try {
    await sbUpdate('ideas', id, { done });
    renderIdeas();
  } catch(e) { console.error('Toggle idea failed', e); }
}

// ===================== ACTIVITY LOG =====================

// ===================== ACTIVITY LOG =====================
async function loadActivityLog() {
  const container = document.getElementById('activityLogView');
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading activity...</div>';
  try {
    const data = await sbGet('log', 'order=timestamp.desc&limit=50&select=*');
    let html = '<h3 style="color:var(--nhs-dark-blue);margin-bottom:14px;">Recent Activity</h3>';
    if (data.length === 0) {
      html += '<div style="text-align:center;padding:30px;color:var(--nhs-grey);">No activity recorded yet.</div>';
    } else {
      data.forEach(entry => {
        html += `<div class="log-entry">
          <div class="log-time">${entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}</div>
          <div class="log-user">${esc(entry.user_display || '')}</div>
          <div class="log-action">${esc(entry.action || '')} ${entry.detail ? '- ' + esc(entry.detail) : ''}</div>
        </div>`;
      });
    }
    container.innerHTML = html;
  } catch(e) {
    console.error('Failed to load log:', e);
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">Failed to load activity log.</div>';
  }
}

async function logAction(action, detail = '') {
  try {
    await sbInsert('log', {
      user_display: currentUser?.name || 'System',
      action: action,
      detail: detail
    });
  } catch(e) { console.warn('Log failed:', e); }
}

// ===================== SESSION DETAIL MODAL =====================

// ===================== DETAIL MODAL =====================
function showDetail(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  const body = document.getElementById('detailBody');
  const footer = document.getElementById('detailFooter');
  const topicDisplay = ev.topic || ev.teacher || 'TBD';
  const isAdminView = isAdmin && !adminViewAsLearner;

  let html = '';

  /* ---- Admin/Teacher action bar at top ---- */
  const canAttend = typeof canMarkAttendance === 'function' && canMarkAttendance(ev.id);
  if (isAdminView) {
    html += `<div class="detail-actions-row">
      <button class="btn btn-orange" onclick="closeModal('detailModal');openEditModal(${ev.id})">&#9998; Edit</button>
      <button class="btn btn-outline" style="color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="togglePublish(${ev.id})">${ev.published ? 'Unpublish' : 'Publish'}</button>
      <button class="btn btn-outline" style="color:var(--nhs-green);border-color:var(--nhs-green);" onclick="closeModal('detailModal');openAttendanceModal(${ev.id})">Attendance</button>
    </div>`;
  } else if (canAttend) {
    html += `<div class="detail-actions-row">
      <button class="btn btn-outline" style="color:var(--nhs-green);border-color:var(--nhs-green);" onclick="closeModal('detailModal');openAttendanceModal(${ev.id})">Mark Attendance</button>
    </div>`;
  }

  /* ---- QR Code for feedback (visible to admin/teacher for past sessions) ---- */
  const evDateQR = eventToDate(ev);
  const isPastQR = evDateQR && evDateQR < new Date();
  if ((isAdminView || canAttend) && (isPastQR || ev.status === 'completed')) {
    const fbUrl = encodeURIComponent(SITE_URL + '?feedback=' + ev.id);
    html += `<div style="text-align:center;margin:12px 0;padding:16px;background:var(--nhs-bg);border-radius:8px;">
      <div style="font-size:13px;font-weight:600;color:var(--nhs-dark-blue);margin-bottom:8px;">Feedback QR Code — display at end of session</div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&amp;data=${fbUrl}" alt="Feedback QR" style="width:180px;height:180px;border-radius:4px;">
      <div style="font-size:11px;color:var(--nhs-grey);margin-top:6px;">Scan to submit feedback</div>
    </div>`;
  }

  /* ---- Session info ---- */
  html += `
    <div class="detail-field"><div class="detail-label">Date &amp; Time</div><div class="detail-value">${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}${ev.time ? ' | ' + esc(ev.time) : ''}</div></div>
    <div class="detail-field"><div class="detail-label">Topic</div><div class="detail-value" style="font-size:18px;font-weight:700;color:var(--nhs-dark-blue);">${esc(topicDisplay)}</div></div>
  `;
  if (ev.teacher) {
    html += `<div class="detail-field"><div class="detail-label">Teacher</div><div class="detail-value">${esc(ev.teacher)}${isAdminView && ev.teacherEmail ? ' <span style="color:var(--nhs-grey);font-size:12px;">(' + esc(ev.teacherEmail) + ')</span>' : ''}</div></div>`;
  }
  if (ev.backupTeacher) {
    html += `<div class="detail-field"><div class="detail-label">Backup Teacher</div><div class="detail-value" style="color:var(--nhs-orange);">${esc(ev.backupTeacher)}${isAdminView && ev.backupTeacherEmail ? ' <span style="color:var(--nhs-grey);font-size:12px;">(' + esc(ev.backupTeacherEmail) + ')</span>' : ''}</div></div>`;
  }
  if (ev.room) {
    html += `<div class="detail-field"><div class="detail-label">Room</div><div class="detail-value">${esc(ev.room)}</div></div>`;
  }
  html += `<div class="detail-field"><div class="detail-label">Status</div><div class="detail-value"><span class="card-status status-pill-${ev.status}" style="font-size:12px;">${ev.status}</span>${!ev.published ? ' <span class="card-draft-badge">DRAFT</span>' : ''}</div></div>`;
  if (ev.notes) {
    html += `<div class="detail-field"><div class="detail-label">Notes</div><div class="detail-value" style="color:var(--nhs-orange);font-style:italic;">${esc(ev.notes)}</div></div>`;
  }
  if (ev.lastEditBy) {
    html += `<div class="detail-field"><div class="detail-label">Last Edited</div><div class="detail-value" style="font-size:12px;color:var(--nhs-grey);">By ${esc(ev.lastEditBy)}${ev.lastEditAt ? ' at ' + new Date(ev.lastEditAt).toLocaleString() : ''}</div></div>`;
  }

  /* ---- Quick-assign teacher from contacts (admin, no teacher yet) ---- */
  if (isAdminView && (!ev.teacher || ev.status === 'tbd')) {
    html += `<div class="teacher-picker-wrap">
      <label>Quick Assign Teacher</label>
      <select id="quickTeacherPicker" onchange="quickAssignTeacher(${ev.id},this)">
        <option value="">-- Select from contacts --</option>
      </select>
    </div>`;
  }

  /* ---- Attendance summary (loaded async) ---- */
  html += `<div id="detailAttendanceSummary"></div>`;

  body.innerHTML = html;

  /* Populate teacher picker */
  if (isAdminView && (!ev.teacher || ev.status === 'tbd')) {
    populateTeacherPicker('quickTeacherPicker');
  }

  /* Load attendance summary */
  loadDetailAttendance(ev.id);

  /* ---- Footer buttons ---- */
  let footerHtml = '';
  if (isAdminView) {
    if (ev.teacherEmail || ev.teacher) {
      footerHtml += `<button class="btn btn-white" style="border:1px solid var(--nhs-blue);color:var(--nhs-blue);" onclick="closeModal('detailModal');sendSessionEmail(${ev.id},'confirmation')">Send Confirmation</button>`;
      footerHtml += `<button class="btn btn-white" style="border:1px solid var(--nhs-orange);color:var(--nhs-orange);" onclick="closeModal('detailModal');sendSessionEmail(${ev.id},'reminder')">Send Reminder</button>`;
      footerHtml += `<button class="btn btn-white" style="border:1px solid #25D366;color:#25D366;" onclick="closeModal('detailModal');openWhatsAppModal(${ev.id})">WhatsApp</button>`;
    }
    if (!ev.teacher || ev.status === 'tbd') {
      footerHtml += `<button class="btn btn-white" style="border:1px solid var(--nhs-aqua);color:var(--nhs-aqua);" onclick="closeModal('detailModal');requestTeacherForSession(${ev.id})">Request Teacher</button>`;
    }
    const evDateAdmin = eventToDate(ev);
    const isPastAdmin = evDateAdmin && evDateAdmin < new Date();
    if (isPastAdmin || ev.status === 'completed') {
      footerHtml += `<button class="btn btn-white" style="border:1px solid var(--nhs-green);color:var(--nhs-green);" onclick="closeModal('detailModal');openFeedbackRequestModal(${ev.id})">Request Feedback</button>`;
    }
  }
  // Teacher actions for past sessions
  if (canAttend && !isAdminView) {
    const evDateT = eventToDate(ev);
    const isPastT = evDateT && evDateT < new Date();
    if (isPastT || ev.status === 'completed') {
      footerHtml += `<button class="btn btn-white" style="border:1px solid var(--nhs-green);color:var(--nhs-green);" onclick="closeModal('detailModal');openFeedbackRequestModal(${ev.id})">Request Feedback</button>`;
    }
  }
  if (currentLearner && ev.status !== 'cancelled') {
    const evDate = eventToDate(ev);
    const isPast = evDate && evDate < new Date();
    if (isPast || ev.status === 'completed') {
      footerHtml += `<button class="btn btn-green" onclick="closeModal('detailModal');markSelfAttendance(${ev.id})">I Attended</button>`;
      footerHtml += `<button class="btn btn-white" style="border:1px solid var(--nhs-blue);color:var(--nhs-blue);" onclick="closeModal('detailModal');openFeedbackModal(${ev.id})">Give Feedback</button>`;
    }
  }
  footerHtml += `<button class="btn btn-outline" style="color:var(--nhs-grey);border-color:var(--nhs-pale-grey);" onclick="closeModal('detailModal')">Close</button>`;
  footer.innerHTML = footerHtml;
  openModal('detailModal');
}

/* ---- Teacher picker helpers ---- */
async function populateTeacherPicker(selectId) {
  try {
    let contacts = window._contactsData || [];
    if (!contacts.length) {
      contacts = await sbGet('contacts', 'order=name.asc&select=*');
      window._contactsData = contacts;
    }
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const teachers = contacts.filter(c => c.role && (c.role.includes('Consultant') || c.role.includes('Registrar') || c.role.includes('Fellow') || c.role.includes('ANP')));
    const others = contacts.filter(c => !teachers.includes(c));
    if (teachers.length) {
      const og = document.createElement('optgroup');
      og.label = 'Consultants / Registrars / Fellows';
      teachers.forEach(c => { const o = document.createElement('option'); o.value = JSON.stringify({name:c.name,email:c.email}); o.textContent = `${c.name} (${c.role})`; og.appendChild(o); });
      sel.appendChild(og);
    }
    if (others.length) {
      const og = document.createElement('optgroup');
      og.label = 'Other Contacts';
      others.forEach(c => { const o = document.createElement('option'); o.value = JSON.stringify({name:c.name,email:c.email}); o.textContent = `${c.name} (${c.role||''})`; og.appendChild(o); });
      sel.appendChild(og);
    }
  } catch(e) { console.error('Picker load failed:', e); }
}

async function quickAssignTeacher(sessionId, selectEl) {
  if (!selectEl.value) return;
  try {
    const { name, email } = JSON.parse(selectEl.value);
    await sbUpdate('schedule', sessionId, {
      teacher: name, teacher_email: email,
      last_edit_by: currentUser?.name || 'Unknown',
      last_edit_at: new Date().toISOString()
    });
    showToast('Teacher assigned: ' + name);
    await loadEvents();
    closeModal('detailModal');
    showDetail(sessionId);
  } catch(e) { console.error('Quick assign failed:', e); showToast('Failed to assign teacher'); }
}

async function loadDetailAttendance(sessionId) {
  const container = document.getElementById('detailAttendanceSummary');
  if (!container) return;
  try {
    const att = await sbGet('attendance', `session_id=eq.${sessionId}&status=neq.removed&select=learner_id`);
    if (att.length === 0) { container.innerHTML = ''; return; }
    const ids = att.map(a => a.learner_id);
    const learners = await sbGet('learners', `id=in.(${ids.join(',')})&select=id,name`);
    const nameMap = {}; learners.forEach(l => nameMap[l.id] = l.name);
    const names = ids.map(id => nameMap[id] || 'Unknown').sort();
    container.innerHTML = `<div class="attendance-summary">
      <h4>Attendance (${names.length})</h4>
      <div>${names.map(n => '<span class="att-name-chip">' + esc(n) + '</span>').join('')}</div>
    </div>`;
  } catch(e) { container.innerHTML = ''; }
}

// ===================== SESSION ADD/EDIT/DELETE =====================

// ===================== ADD/EDIT =====================
function populateTeacherDatalist() {
  const contacts = window._contactsData || [];
  ['evTeacherList','evBackupList'].forEach(dlId => {
    const dl = document.getElementById(dlId);
    if (!dl) return;
    dl.innerHTML = '';
    contacts.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = `${c.name} — ${c.role || ''} (${c.email})`;
      dl.appendChild(opt);
    });
  });
}

function onTeacherPick(inputEl, emailFieldId) {
  const contacts = window._contactsData || [];
  const match = contacts.find(c => c.name === inputEl.value);
  if (match) document.getElementById(emailFieldId).value = match.email;
}

async function ensureContactsLoaded() {
  if (!window._contactsData || !window._contactsData.length) {
    try { window._contactsData = await sbGet('contacts', 'order=name.asc&select=*'); } catch(e) { window._contactsData = []; }
  }
}

async function openAddModal() {
  editingEventId = null;
  document.getElementById('eventModalTitle').textContent = 'Add Session';
  document.getElementById('evDeleteBtn').style.display = 'none';
  ['evDay','evDate','evTime','evRoom','evTopic','evTeacher','evTeacherEmail','evBackupTeacher','evBackupEmail','evNotes'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('evMonth').value = MONTHS[new Date().getMonth()];
  document.getElementById('evYear').value = new Date().getFullYear();
  document.getElementById('evStatus').value = 'upcoming';
  document.getElementById('evPublished').checked = true;
  openModal('eventModal');
  await ensureContactsLoaded();
  populateTeacherDatalist();
}

async function openEditModal(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  editingEventId = id;
  document.getElementById('eventModalTitle').textContent = 'Edit Session';
  document.getElementById('evDeleteBtn').style.display = '';
  document.getElementById('evDay').value = ev.day || 'Tues';
  document.getElementById('evDate').value = ev.date || '';
  document.getElementById('evMonth').value = ev.month || 'January';
  document.getElementById('evYear').value = ev.year || 2026;
  document.getElementById('evTime').value = ev.time || '';
  document.getElementById('evRoom').value = ev.room || '';
  document.getElementById('evTopic').value = ev.topic || '';
  document.getElementById('evTeacher').value = ev.teacher || '';
  document.getElementById('evTeacherEmail').value = ev.teacherEmail || '';
  document.getElementById('evBackupTeacher').value = ev.backupTeacher || '';
  document.getElementById('evBackupEmail').value = ev.backupTeacherEmail || '';
  document.getElementById('evStatus').value = ev.status || 'upcoming';
  document.getElementById('evNotes').value = ev.notes || '';
  document.getElementById('evPublished').checked = ev.published !== false;
  openModal('eventModal');
  await ensureContactsLoaded();
  populateTeacherDatalist();
}

async function saveEvent() {
  const evData = {
    day: document.getElementById('evDay').value,
    date: document.getElementById('evDate').value.trim(),
    month: document.getElementById('evMonth').value,
    year: parseInt(document.getElementById('evYear').value),
    time: document.getElementById('evTime').value.trim(),
    room: document.getElementById('evRoom').value.trim(),
    topic: document.getElementById('evTopic').value.trim(),
    teacher: document.getElementById('evTeacher').value.trim(),
    teacher_email: document.getElementById('evTeacherEmail').value.trim(),
    backup_teacher: document.getElementById('evBackupTeacher').value.trim(),
    backup_teacher_email: document.getElementById('evBackupEmail').value.trim(),
    status: document.getElementById('evStatus').value,
    notes: document.getElementById('evNotes').value.trim(),
    published: document.getElementById('evPublished').checked,
    last_edit_by: currentUser?.name || 'Unknown',
    last_edit_at: new Date().toISOString(),
  };
  if (!evData.date || !evData.month || !evData.year) { showToast('Date, month and year are required'); return; }

  try {
    if (editingEventId) {
      await sbUpdate('schedule', editingEventId, evData);
      showToast('Session updated');
      logAction('Updated session', evData.topic || evData.date);
      logQI('session_edited', { session_id: editingEventId, metadata: { topic: evData.topic, status: evData.status, teacher: evData.teacher } });
      if (evData.status === 'cancelled') logQI('session_cancelled', { session_id: editingEventId, metadata: { topic: evData.topic, reason: evData.notes || null } });
      if (evData.status === 'completed') logQI('session_completed', { session_id: editingEventId, metadata: { topic: evData.topic } });
    } else {
      evData.event_id = 'EVT' + Date.now();
      const inserted = await sbInsert('schedule', evData);
      const newId = inserted && inserted[0] && inserted[0].id;
      showToast('Session added');
      logAction('Added session', evData.topic || evData.date);
      logQI('session_created', { session_id: newId || null, metadata: { topic: evData.topic, teacher: evData.teacher, status: evData.status, published: evData.published } });
    }
    await loadEvents();
    closeModal('eventModal');
    renderAll();
  } catch(e) {
    console.error('Save failed:', e);
    showToast('Failed to save - check connection');
  }
}

async function deleteEvent() {
  if (!editingEventId) return;
  if (!confirm('Delete this session?')) return;
  const ev = events.find(e => e.id === editingEventId);
  try {
    await sbDelete('schedule', editingEventId);
    showToast('Session deleted');
    logAction('Deleted session', ev?.topic || ev?.date || '');
    logQI('session_deleted', { session_id: editingEventId, metadata: { topic: ev?.topic } });
    await loadEvents();
    closeModal('eventModal');
    renderAll();
  } catch(e) {
    console.error('Delete failed:', e);
    showToast('Failed to delete');
  }
}

async function togglePublish(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  try {
    await sbUpdate('schedule', id, {
      published: !ev.published,
      last_edit_by: currentUser?.name || 'Unknown',
      last_edit_at: new Date().toISOString()
    });
    closeModal('detailModal');
    showToast(ev.published ? 'Unpublished' : 'Published');
    logAction((ev.published ? 'Unpublished' : 'Published') + ' session', ev.topic || ev.date);
    logQI(ev.published ? 'session_unpublished' : 'session_published', { session_id: id, metadata: { topic: ev.topic } });
    await loadEvents();
    renderAll();
  } catch(e) { console.error('Toggle publish failed:', e); showToast('Failed to update'); }
}

// ===================== SITE FEEDBACK =====================

// ===================== SITE FEEDBACK =====================
function openSiteFeedbackModal() {
  document.getElementById('siteFbForm').style.display = '';
  document.getElementById('siteFbSuccess').style.display = 'none';
  document.getElementById('siteFbType').value = 'feature';
  document.getElementById('siteFbSubject').value = '';
  document.getElementById('siteFbDetail').value = '';
  // Pre-fill name/email if logged in
  const name = currentLearner?.name || currentUser?.name || '';
  const email = currentLearner?.email || currentUser?.email || '';
  document.getElementById('siteFbName').value = name;
  document.getElementById('siteFbEmail').value = email;
  updateSiteFbPlaceholder();
  openModal('siteFeedbackModal');
}

function updateSiteFbPlaceholder() {
  const type = document.getElementById('siteFbType').value;
  const subj = document.getElementById('siteFbSubject');
  const det = document.getElementById('siteFbDetail');
  const titles = { feature: 'Send Us Feedback', bug: 'Report a Bug', feedback: 'Send Us Feedback', grievance: 'Raise a Concern' };
  document.getElementById('siteFbTitle').textContent = titles[type] || 'Send Us Feedback';
  const placeholders = {
    feature: { s: 'e.g. Add calendar export to Google Calendar', d: 'Describe the feature you\'d like and how it would help...' },
    bug: { s: 'e.g. Calendar not loading on mobile', d: 'What happened? What did you expect? Steps to reproduce...' },
    feedback: { s: 'e.g. Love the new attendance chart!', d: 'Any thoughts, suggestions, or comments...' },
    grievance: { s: 'Brief summary of your concern', d: 'Please describe your concern. All submissions are reviewed confidentially.' }
  };
  const p = placeholders[type] || placeholders.feedback;
  subj.placeholder = p.s;
  det.placeholder = p.d;
}

async function submitSiteFeedback() {
  const type = document.getElementById('siteFbType').value;
  const subject = document.getElementById('siteFbSubject').value.trim();
  const detail = document.getElementById('siteFbDetail').value.trim();
  const name = document.getElementById('siteFbName').value.trim();
  const email = document.getElementById('siteFbEmail').value.trim();

  if (!subject) { showToast('Please enter a subject'); return; }

  const btn = document.getElementById('siteFbSubmitBtn');
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  let role = 'Public';
  if (isAdmin) role = 'Admin';
  else if (currentLearner) role = currentLearner.grade || 'Learner';

  try {
    await sbInsert('site_feedback', {
      type, subject, detail: detail || null,
      submitted_by: name || null, email: email || null, role
    });
    document.getElementById('siteFbForm').style.display = 'none';
    document.getElementById('siteFbSuccess').style.display = '';
  } catch(e) {
    console.error('Feedback submit error:', e);
    showToast('Failed to submit. Please try again.');
  } finally {
    btn.textContent = 'Submit';
    btn.disabled = false;
  }
}

async function loadSiteFeedbackView() {
  const container = document.getElementById('siteFeedbackView');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="loading-spinner"></div></div>';
  try {
    const items = await sbGet('site_feedback', 'order=created_at.desc&select=*');
    const typeIcons = { feature: '🚀', bug: '🐛', feedback: '💡', grievance: '⚠️' };
    const typeLabels = { feature: 'Feature Request', bug: 'Bug Report', feedback: 'Feedback', grievance: 'Grievance' };
    const statusColors = { new: 'var(--nhs-blue)', reviewed: 'var(--nhs-orange)', resolved: 'var(--nhs-green)', dismissed: 'var(--nhs-grey)' };

    let html = '<h3 style="color:var(--nhs-dark-blue);margin-bottom:16px;">Site Feedback & Bug Reports (' + items.length + ')</h3>';
    if (items.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">No feedback submitted yet.</div>';
    } else {
      html += '<div style="background:white;border-radius:8px;box-shadow:var(--shadow);overflow:hidden;">';
      items.forEach(item => {
        const d = new Date(item.created_at);
        const dateStr = d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
        const icon = typeIcons[item.type] || '💬';
        const label = typeLabels[item.type] || item.type;
        const sc = statusColors[item.status] || 'var(--nhs-grey)';
        html += `<div style="padding:14px 16px;border-bottom:1px solid var(--nhs-pale-grey);display:flex;gap:12px;align-items:flex-start;">
          <span style="font-size:20px;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
              <strong style="font-size:14px;">${esc(item.subject)}</strong>
              <div style="display:flex;gap:6px;align-items:center;">
                <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${sc};color:white;">${item.status || 'new'}</span>
                <select onchange="updateFeedbackStatus(${item.id}, this.value)" style="font-size:11px;padding:2px 6px;border:1px solid var(--nhs-pale-grey);border-radius:4px;">
                  <option value="new" ${item.status === 'new' ? 'selected' : ''}>New</option>
                  <option value="reviewed" ${item.status === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                  <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                  <option value="dismissed" ${item.status === 'dismissed' ? 'selected' : ''}>Dismissed</option>
                </select>
              </div>
            </div>
            <div style="font-size:12px;color:var(--nhs-grey);margin-top:2px;">${label} &middot; ${dateStr}${item.submitted_by ? ' &middot; ' + esc(item.submitted_by) : ''}${item.role ? ' (' + esc(item.role) + ')' : ''}${item.email ? ' &middot; ' + esc(item.email) : ''}</div>
            ${item.detail ? '<div style="font-size:13px;color:var(--nhs-black);margin-top:6px;white-space:pre-wrap;">' + esc(item.detail) + '</div>' : ''}
          </div>
        </div>`;
      });
      html += '</div>';
    }
    container.innerHTML = html;
  } catch(e) {
    console.error('Load site feedback failed:', e);
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-red);">Failed to load feedback.</div>';
  }
}

async function updateFeedbackStatus(id, status) {
  try {
    await sbUpdate('site_feedback', id, { status });
    showToast('Status updated');
  } catch(e) { showToast('Update failed'); }
}

// ===================== EXPORT CSV =====================

// ===================== EXPORT =====================
function exportCSV() {
  const headers = ['Day','Date','Month','Year','Time','Room','Topic','Teacher','Email','Backup Teacher','Backup Email','Status','Published','Notes'];
  const rows = events.map(e => [
    e.day, e.date, e.month, e.year, e.time, e.room, e.topic, e.teacher, e.teacherEmail, e.backupTeacher, e.backupTeacherEmail, e.status, e.published ? 'Yes' : 'No', e.notes
  ].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'southmead-teaching-export.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported');
}

// ===================== SESSION REQUESTS =====================

// ===================== REQUESTS =====================
function showRequestSessionModal(preselectedSlot) {
  ['reqName','reqEmail','reqPhone','reqTopic','reqMessage'].forEach(id => document.getElementById(id).value = '');
  // Populate available slots dropdown
  const sel = document.getElementById('reqSlot');
  const today = new Date(); today.setHours(0,0,0,0);
  // Generate ALL future Tues/Wed dates through end of academic year
  const DAYNAMES = ['Sun','Mon','Tues','Wed','Thurs','Fri','Sat'];
  const endDate = new Date(today.getFullYear() + 1, 11, 31); // rolling to end of next year
  const allSlots = [];
  const d = new Date(today);
  while (d <= endDate) {
    const dow = d.getDay();
    if (dow === 2 || dow === 3) { // Tues or Wed
      const bankHol = getBankHoliday(d.getFullYear(), d.getMonth(), d.getDate());
      if (bankHol) { d.setDate(d.getDate() + 1); continue; } // skip bank holidays
      const dateStr = getOrdinal(d.getDate());
      const monthStr = MONTHS[d.getMonth()];
      const yearStr = String(d.getFullYear());
      const dayName = DAYNAMES[dow];
      // Check if there's already a fully-booked event on this date
      const existing = events.filter(e => {
        const ed = eventToDate(e);
        return ed && ed.getTime() === d.getTime();
      });
      const fullyBooked = existing.length > 0 && existing.every(e => e.topic && e.teacher && e.status !== 'cancelled');
      if (!fullyBooked) {
        const partial = existing.find(e => e.status !== 'cancelled');
        const info = partial ? (partial.topic ? ` [Topic: ${partial.topic}]` : partial.teacher ? ` [Teacher: ${partial.teacher}]` : '') : '';
        const time = partial?.time || '';
        const room = partial?.room || '';
        allSlots.push({ dayName, dateStr, monthStr, yearStr, time, room, info });
      }
    }
    d.setDate(d.getDate() + 1);
  }

  sel.innerHTML = '<option value="">-- Choose an available date --</option>';
  allSlots.forEach(s => {
    const label = `${s.dayName} ${s.dateStr} ${s.monthStr} ${s.yearStr}${s.time ? ' (' + s.time + ')' : ''}${s.room ? ' - ' + s.room : ''}${s.info}`;
    sel.innerHTML += `<option value="${label}">${label}</option>`;
  });

  if (allSlots.length === 0) {
    sel.innerHTML = '<option value="">No available slots right now</option>';
  }

  // Pre-select if clicked from calendar
  if (preselectedSlot) {
    const match = [...sel.options].find(o => o.value.includes(preselectedSlot.split(' ').slice(0,4).join(' ')));
    if (match) match.selected = true;
  }

  // Slot info display
  sel.onchange = function() {
    const info = document.getElementById('reqSlotInfo');
    if (this.value) {
      info.style.display = 'block';
      info.innerHTML = '&#9989; <strong>' + esc(this.value) + '</strong>';
    } else {
      info.style.display = 'none';
    }
  };
  sel.dispatchEvent(new Event('change'));

  openModal('requestSessionModal');
  setTimeout(() => document.getElementById('reqName').focus(), 100);
}

async function submitSessionRequest() {
  const name = document.getElementById('reqName').value.trim();
  const email = document.getElementById('reqEmail').value.trim();
  const phone = document.getElementById('reqPhone').value.trim();
  const slot = document.getElementById('reqSlot').value;
  const topic = document.getElementById('reqTopic').value.trim();
  const message = document.getElementById('reqMessage').value.trim();
  if (!name || !email) { showToast('Please enter your name and email'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email'); return; }
  if (!slot) { showToast('Please select an available slot'); return; }
  if (!topic) { showToast('Please enter a topic'); return; }
  try {
    await sbInsert('requests', { name, email, phone, topic, preferred_date: slot, message, status: 'pending' });
    logQI('session_requested', { actor_email: email || null, actor_name: name || null, metadata: { topic, preferred_date: slot } });
    closeModal('requestSessionModal');
    showToast("Request submitted! The teaching team will get back to you.");
  } catch(e) { console.error('Submit request failed:', e); showToast('Failed to submit request'); }
}

async function loadRequests() {
  const container = document.getElementById('requestsView');
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading requests...</div>';
  try {
    const data = await sbGet('requests', 'order=created_at.desc&select=*');
    if (data.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">No session requests yet.</div>';
      return;
    }
    const pending = data.filter(r => r.status === 'pending');
    const resolved = data.filter(r => r.status !== 'pending');
    let html = '<h3 style="color:var(--nhs-dark-blue);margin-bottom:16px;">Session Requests</h3>';
    if (pending.length > 0) {
      html += '<div style="margin-bottom:24px;"><h4 style="color:var(--nhs-orange);margin-bottom:10px;">Pending (' + pending.length + ')</h4>';
      pending.forEach(r => { html += renderRequestCard(r); }); html += '</div>';
    }
    if (resolved.length > 0) {
      html += '<div><h4 style="color:var(--nhs-grey);margin-bottom:10px;">Resolved (' + resolved.length + ')</h4>';
      resolved.forEach(r => { html += renderRequestCard(r); }); html += '</div>';
    }
    container.innerHTML = html;
  } catch(e) { console.error('Load requests failed:', e); container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">Failed to load requests.</div>'; }
}

function renderRequestCard(r) {
  const statusColors = { pending: '#ed8b00', accepted: '#009639', rejected: '#d5281b' };
  const statusColor = statusColors[r.status] || '#768692';
  return `<div style="background:white;border-radius:8px;padding:18px 20px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid ${statusColor};">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:700;color:var(--nhs-dark-blue);font-size:1rem;">${esc(r.name)}</div>
        <div style="font-size:0.85rem;color:var(--nhs-grey);margin-top:2px;">${esc(r.email)}${r.phone ? ' &middot; ' + esc(r.phone) : ''}</div>
        ${r.topic ? '<div style="margin-top:8px;font-size:0.9rem;"><strong>Topic:</strong> ' + esc(r.topic) + '</div>' : ''}
        ${r.preferred_date ? '<div style="font-size:0.9rem;"><strong>Preferred date:</strong> ' + esc(r.preferred_date) + '</div>' : ''}
        ${r.message ? '<div style="font-size:0.85rem;color:#425563;margin-top:6px;font-style:italic;">"' + esc(r.message) + '"</div>' : ''}
        <div style="font-size:0.78rem;color:var(--nhs-grey);margin-top:8px;">Submitted: ${r.created_at ? new Date(r.created_at).toLocaleString() : ''}</div>
        ${r.responded_by ? '<div style="font-size:0.78rem;color:var(--nhs-grey);">Responded by ' + esc(r.responded_by) + ' on ' + (r.responded_at ? new Date(r.responded_at).toLocaleString() : '') + '</div>' : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:0.78rem;font-weight:600;color:white;background:${statusColor};">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
        ${r.status === 'pending' ? '<button class="btn btn-white" style="font-size:0.82rem;padding:6px 14px;border:1px solid var(--nhs-pale-grey);" onclick="showRespondModal(' + r.id + ')">Respond</button>' : ''}
      </div>
    </div>
  </div>`;
}

async function showRespondModal(id) {
  try {
    const data = await sbGet('requests', `id=eq.${id}&select=*`);
    if (data.length === 0) return;
    const r = data[0];
    document.getElementById('respondId').value = r.id;
    document.getElementById('respondMessage').value = '';
    document.getElementById('respondDetails').innerHTML = `<div style="background:var(--nhs-pale-grey);border-radius:8px;padding:14px;font-size:0.9rem;">
      <div><strong>From:</strong> ${esc(r.name)} (${esc(r.email)})</div>
      ${r.topic ? '<div><strong>Topic:</strong> ' + esc(r.topic) + '</div>' : ''}
      ${r.preferred_date ? '<div><strong>Preferred Date:</strong> ' + esc(r.preferred_date) + '</div>' : ''}
      ${r.message ? '<div style="margin-top:6px;font-style:italic;color:#425563;">"' + esc(r.message) + '"</div>' : ''}
    </div>`;
    openModal('respondModal');
  } catch(e) { console.error('Show respond modal failed:', e); }
}

async function respondToRequest(response) {
  const requestId = document.getElementById('respondId').value;
  const responseNote = document.getElementById('respondMessage').value.trim();
  if (!requestId) return;
  try {
    await sbUpdate('requests', requestId, {
      status: response,
      responded_by: currentUser?.name || 'Unknown',
      response_note: responseNote,
      responded_at: new Date().toISOString()
    });
    closeModal('respondModal');
    showToast('Request ' + response + '!');
    logAction((response === 'accepted' ? 'Accepted' : 'Rejected') + ' session request', '#' + requestId);
    loadRequests();
  } catch(e) { console.error('Respond failed:', e); showToast('Failed to respond'); }
}

// ===================== CONTACTS =====================

// ===================== CONTACTS =====================
async function loadContacts() {
  const container = document.getElementById('contactsView');
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading contacts...</div>';
  try {
    const data = await sbGet('contacts', 'order=name.asc&select=*');
    let html = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">';
    html += '<h3 style="color:var(--nhs-dark-blue);margin:0;">Contacts Directory</h3>';
    html += '<div style="display:flex;gap:10px;align-items:center;">';
    html += '<input type="text" id="contactSearch" placeholder="Search contacts..." oninput="filterContacts()" style="padding:8px 14px;border:1.5px solid var(--nhs-pale-grey);border-radius:var(--radius);font-size:13px;width:220px;">';
    html += '<button class="btn btn-green" onclick="showContactModal()">+ Add Contact</button>';
    html += '</div></div>';
    if (data.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">No contacts yet. Add your first contact above.</div>';
    } else {
      html += '<div id="contactsList">';
      data.forEach(c => { html += renderContactCard(c); });
      html += '</div>';
    }
    container.innerHTML = html;
    window._contactsData = data;
  } catch(e) { console.error('Load contacts failed:', e); container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">Failed to load contacts.</div>'; }
}

function renderContactCard(c) {
  const initials = (c.name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  const colors = ['#005eb8','#009639','#ed8b00','#7C2855','#330072','#41B6E6','#003087'];
  const color = colors[c.id % colors.length];
  return `<div class="contact-card" data-name="${esc(c.name).toLowerCase()}" data-role="${esc(c.role||'').toLowerCase()}" data-specialty="${esc(c.specialty||'').toLowerCase()}" style="background:white;border-radius:8px;padding:16px 20px;margin-bottom:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06);display:flex;align-items:center;gap:16px;">
    <div style="width:44px;height:44px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">${initials}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:700;color:var(--nhs-dark-blue);font-size:0.95rem;">${esc(c.name)}</div>
      <div style="font-size:0.82rem;color:var(--nhs-grey);">${[c.role, c.specialty].filter(Boolean).map(esc).join(' · ')}</div>
      <div style="font-size:0.82rem;color:#425563;margin-top:3px;">
        ${c.email ? '<span style="margin-right:14px;">✉ ' + esc(c.email) + '</span>' : ''}
        ${c.phone ? '<span>☎ ' + esc(c.phone) + '</span>' : ''}
      </div>
      ${c.notes ? '<div style="font-size:0.78rem;color:var(--nhs-grey);margin-top:4px;font-style:italic;">' + esc(c.notes) + '</div>' : ''}
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;">
      <button class="btn btn-white" style="font-size:0.78rem;padding:5px 12px;" onclick="showContactModal(${c.id})">Edit</button>
      <button class="btn btn-red" style="font-size:0.78rem;padding:5px 12px;" onclick="deleteContact(${c.id})">Delete</button>
    </div>
  </div>`;
}

function filterContacts() {
  const q = (document.getElementById('contactSearch')?.value || '').toLowerCase();
  document.querySelectorAll('.contact-card').forEach(card => {
    const match = card.dataset.name.includes(q) || card.dataset.role.includes(q) || card.dataset.specialty.includes(q);
    card.style.display = match ? '' : 'none';
  });
}

function showContactModal(editId) {
  ['ctName','ctRole','ctEmail','ctPhone','ctSpecialty','ctNotes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ctId').value = '';
  if (editId && window._contactsData) {
    const c = window._contactsData.find(x => x.id === editId);
    if (c) {
      document.getElementById('ctName').value = c.name || '';
      document.getElementById('ctRole').value = c.role || '';
      document.getElementById('ctEmail').value = c.email || '';
      document.getElementById('ctPhone').value = c.phone || '';
      document.getElementById('ctSpecialty').value = c.specialty || '';
      document.getElementById('ctNotes').value = c.notes || '';
      document.getElementById('ctId').value = c.id;
      document.getElementById('contactModalTitle').textContent = 'Edit Contact';
    }
  } else {
    document.getElementById('contactModalTitle').textContent = 'Add Contact';
  }
  openModal('contactModal');
  setTimeout(() => document.getElementById('ctName').focus(), 100);
}

async function saveContact() {
  const name = document.getElementById('ctName').value.trim();
  if (!name) { showToast('Please enter a name'); return; }
  const obj = {
    name,
    role: document.getElementById('ctRole').value.trim(),
    email: document.getElementById('ctEmail').value.trim(),
    phone: document.getElementById('ctPhone').value.trim(),
    specialty: document.getElementById('ctSpecialty').value.trim(),
    notes: document.getElementById('ctNotes').value.trim(),
    added_by: currentUser?.name || ''
  };
  const editId = document.getElementById('ctId').value;
  try {
    if (editId) {
      await sbUpdate('contacts', editId, obj);
      await logAction('Edited contact: ' + name);
    } else {
      await sbInsert('contacts', obj);
      await logAction('Added contact: ' + name);
    }
    closeModal('contactModal');
    showToast(editId ? 'Contact updated' : 'Contact added');
    loadContacts();
  } catch(e) { console.error('Save contact failed:', e); showToast('Failed to save contact'); }
}

async function deleteContact(id) {
  if (!confirm('Delete this contact?')) return;
  try {
    const c = window._contactsData?.find(x => x.id === id);
    await sbDelete('contacts', id);
    await logAction('Deleted contact: ' + (c?.name || id));
    showToast('Contact deleted');
    loadContacts();
  } catch(e) { console.error('Delete contact failed:', e); showToast('Failed to delete contact'); }
}

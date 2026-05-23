// Southmead Surgical Teaching — app.js
// Demo system, keyboard shortcuts, init & push notifications

// ===================== DEMO FETCH INTERCEPTOR =====================
const _originalFetch = window.fetch;
window.fetch = function(url, options) {
  if (isDemoMode && typeof url === 'string' && url.includes('/functions/v1/')) {
    const fn = url.split('/functions/v1/')[1];
    showDemoToast(`API call to "${fn}"`);
    return Promise.resolve(new Response(JSON.stringify({ ok: true, demo: true, message: 'Simulated in demo mode' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
  }
  return _originalFetch.apply(this, arguments);
};

// ===================== DEMO TOUR =====================
let demoTourCurrentStep = 0;
const demoTourSteps = [
  {
    title: 'Welcome to Demo Mode!',
    text: 'This guided tour will walk you through every feature of the admin panel. All actions are simulated — nothing will change your real data. Let\'s explore!',
    target: null
  },
  {
    title: 'Admin Dashboard',
    text: 'This is your command centre. The Action Cards show items needing attention — pending requests, sessions without teachers, unreviewed approvals. Click any card to jump straight to that view.',
    target: '.action-centre'
  },
  {
    title: 'Quick Actions',
    text: 'One-click access to your most common tasks: add sessions, send reminders, check inbox, export data. Everything you need without navigating through tabs.',
    target: '.quick-actions'
  },
  {
    title: 'Navigation Tabs',
    text: 'The main tabs give you quick access to Sessions, Calendar, Drafts, Contacts, and Inbox. Click "More" to find additional views like Feedback, Approvals, Requests, and Attendance.',
    target: '.nav-bar'
  },
  {
    title: 'Session Cards',
    text: 'Each card shows a teaching session with its date, topic, teacher, room, and status. The coloured left border indicates status: blue = upcoming, green = completed, orange = TBD, red = cancelled. Click any card to see full details.',
    target: '.event-card'
  },
  {
    title: 'Create a New Session',
    text: 'Click the "+ Add Session" button to create a new teaching session. You can set the date, topic, teacher, room, and more. In demo mode, the session won\'t actually be saved.',
    target: '#addSessionBtn',
    action: null
  },
  {
    title: 'Search & Filters',
    text: 'Use the search box to find sessions by topic or teacher name. The filter chips let you quickly show only Upcoming, Completed, TBD, or Cancelled sessions. The month dropdown narrows results by date.',
    target: '.filters-bar'
  },
  {
    title: 'Export CSV',
    text: 'Click "Export CSV" to download all session data as a spreadsheet. Useful for reports and record-keeping. In demo mode this still works — try it!',
    target: null,
    findButton: 'Export CSV'
  },
  {
    title: 'Bulk Remind',
    text: 'Send email reminders to all teachers with upcoming sessions in one click. The system composes personalised emails with session details and confirm/decline links.',
    target: null,
    findButton: 'Bulk Remind'
  },
  {
    title: 'WhatsApp Messaging',
    text: 'Send WhatsApp messages to teachers via wa.me links. Click the green "WhatsApp" button to open the bulk messaging panel, or use the WhatsApp button inside any session detail.',
    target: null,
    findButton: 'WhatsApp'
  },
  {
    title: 'Calendar View',
    text: 'Switch to Calendar view to see sessions laid out by month. Click any date to see its sessions. Great for spotting gaps in the schedule!',
    target: '.nav-tab[data-view="calendar"]',
    action: () => switchView('calendar')
  },
  {
    title: 'Drafts & Planning',
    text: 'The Drafts tab shows sessions that aren\'t published yet. Use this to plan ahead — draft sessions are invisible to learners until you publish them.',
    target: '.nav-tab[data-view="drafts"]',
    action: () => switchView('drafts')
  },
  {
    title: 'Topic Ideas Bank',
    text: 'Collect and manage teaching topic suggestions here. Great for planning future sessions based on learner interests and curriculum needs.',
    target: '.nav-tab[data-view="ideas"]',
    action: () => switchView('ideas')
  },
  {
    title: 'Session Requests',
    text: 'Learners and staff can request specific teaching sessions using the public form. Requests appear here for you to review and convert into actual sessions.',
    target: '.nav-tab[data-view="requests"]',
    action: () => switchView('requests')
  },
  {
    title: 'Contacts Directory',
    text: 'Manage your teacher contacts here — add emails, phone numbers, and specialties. These are used for email reminders, WhatsApp messages, and the teacher picker when creating sessions.',
    target: '.nav-tab[data-view="contacts"]',
    action: () => switchView('contacts')
  },
  {
    title: 'Feedback Collection',
    text: 'View feedback submitted by learners after sessions. Each response includes ratings and free-text comments. Use this to track teaching quality and identify areas for improvement.',
    target: '.nav-tab[data-view="feedback"]',
    action: () => switchView('feedback')
  },
  {
    title: 'Email Inbox',
    text: 'Read and reply to emails directly from this panel. Teacher replies to reminder emails appear as threaded conversations. You can also see WhatsApp message threads here.',
    target: '.nav-tab[data-view="inbox"]',
    action: () => switchView('inbox')
  },
  {
    title: 'Approvals Queue',
    text: 'When teachers confirm or decline via email links, their responses show up here. You can quickly approve or reassign sessions from this view.',
    target: '.nav-tab[data-view="approvals"]',
    action: () => switchView('approvals')
  },
  {
    title: 'Attendance Chart',
    text: 'Visual analytics showing attendance trends over time. See which sessions are most popular and track learner engagement across the rotation.',
    target: '.nav-tab[data-view="attendanceChart"]',
    action: () => switchView('attendanceChart')
  },
  {
    title: 'Learner View Toggle',
    text: 'Click "Learner View" to see exactly what learners see — the public-facing version with no admin controls. Useful for checking how things look before publishing.',
    target: '#viewToggleBtn'
  },
  {
    title: 'Tour Complete!',
    text: 'You\'ve seen all the main features! Remember: in demo mode, you can click anything and try every feature without affecting real data. Explore at your own pace. Click "Exit Demo" in the orange banner when you\'re done.',
    target: null,
    action: () => switchView('list')
  }
];

function startDemoTour() {
  demoTourCurrentStep = 0;
  document.getElementById('resumeTourBtn').style.display = 'none';
  showDemoTourStep();
}

function resumeDemoTour() {
  // Resume from where user left off
  document.getElementById('resumeTourBtn').style.display = 'none';
  showDemoTourStep();
}

function showDemoTourStep() {
  const overlay = document.getElementById('demoTourOverlay');
  const spotlight = document.getElementById('demoTourSpotlight');
  const card = document.getElementById('demoTourCard');
  const stepNum = document.getElementById('demoTourStep');
  const title = document.getElementById('demoTourTitle');
  const text = document.getElementById('demoTourText');
  const dotsContainer = document.getElementById('demoTourDots');
  const nextBtn = document.getElementById('demoTourNext');

  const step = demoTourSteps[demoTourCurrentStep];
  overlay.style.display = 'block';
  stepNum.textContent = demoTourCurrentStep + 1;
  title.textContent = step.title;
  text.textContent = step.text;

  // Update dots — show groups of 5 around current step for compactness
  const total = demoTourSteps.length;
  dotsContainer.innerHTML = `<span style="font-size:11px;color:#768692;">${demoTourCurrentStep + 1} / ${total}</span>`;

  // Last step button text
  nextBtn.textContent = demoTourCurrentStep === demoTourSteps.length - 1 ? 'Finish' : 'Next →';

  // Find target element
  let targetEl = null;
  if (step.target) {
    targetEl = document.querySelector(step.target);
  } else if (step.findButton) {
    document.querySelectorAll('.btn, button').forEach(btn => {
      if (btn.textContent.trim() === step.findButton || btn.textContent.trim().includes(step.findButton)) {
        targetEl = btn;
      }
    });
  }

  // Position spotlight and card — use getBoundingClientRect which is viewport-relative
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const pad = 8;
    spotlight.style.display = 'block';
    // Use fixed positioning (overlay is fixed), so use viewport coords directly
    spotlight.style.left = (rect.left - pad) + 'px';
    spotlight.style.top = (rect.top - pad) + 'px';
    spotlight.style.width = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';

    // Position card below or above the target
    const cardWidth = 380;
    let cardLeft = Math.min(rect.left, window.innerWidth - cardWidth - 20);
    cardLeft = Math.max(10, cardLeft);
    let cardTop = rect.bottom + pad + 12;
    if (rect.bottom + 250 > window.innerHeight) {
      cardTop = rect.top - 250;
    }
    card.style.left = cardLeft + 'px';
    card.style.top = cardTop + 'px';
    card.style.transform = 'none';
  } else {
    // Center the card, hide spotlight
    spotlight.style.display = 'none';
    card.style.left = '50%';
    card.style.top = '50%';
    card.style.transform = 'translate(-50%, -50%)';
  }
}

function nextDemoTourStep() {
  const step = demoTourSteps[demoTourCurrentStep];
  // Execute action if any
  if (step.action) {
    try { step.action(); } catch(e) { console.warn('Tour action error:', e); }
  }

  demoTourCurrentStep++;
  if (demoTourCurrentStep >= demoTourSteps.length) {
    endDemoTour(true);
    return;
  }

  // Small delay if there's a view switch to let it render
  const nextStep = demoTourSteps[demoTourCurrentStep];
  if (nextStep.action || step.action) {
    setTimeout(showDemoTourStep, 300);
  } else {
    showDemoTourStep();
  }
}

function endDemoTour(completed) {
  document.getElementById('demoTourOverlay').style.display = 'none';
  if (completed) {
    demoTourCurrentStep = 0;
    document.getElementById('resumeTourBtn').style.display = 'none';
    switchView('list');
    showToast('Tour complete! Explore freely — all changes are simulated.', 4000);
  } else {
    // Skipped mid-tour — show resume button
    document.getElementById('resumeTourBtn').style.display = 'inline-block';
    showToast('Tour paused. Click "Resume Tour" to continue.', 3000);
  }
}

// ===================== KEYBOARD =====================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
  if (e.key === 'Enter' && document.getElementById('loginModal').classList.contains('show')) doLogin();
});

// ===================== INIT =====================
async function init() {
  // Dynamically set nav-bar sticky position based on header height
  function updateNavBarPosition() {
    const header = document.querySelector('.header');
    const navBar = document.querySelector('.nav-bar');
    if (header && navBar) {
      navBar.style.top = header.offsetHeight + 'px';
    }
  }
  updateNavBarPosition();
  window.addEventListener('resize', updateNavBarPosition);

  checkSession();
  checkLearnerSession();
  checkTeacherSession();
  await Promise.all([loadEvents(), fetchBankHolidays()]);
  renderAll();
  updateSessionsTabLabel();
  setupRegEmailAutopopulate();
  // Handle action URL params (confirm/decline/reschedule from email links)
  const params = new URLSearchParams(window.location.search);
  const hasAction = await handleActionParams();
  if (hasAction) {
    // Clean URL without reloading
    window.history.replaceState({}, document.title, window.location.pathname);
    return; // Don't switch to default view
  }
  // Handle absence reason URL params (one-click from email)
  const hasAbsence = await handleAbsenceURLParams();
  if (hasAbsence) return;
  // Handle learner URL params
  const pendingAttend = params.get('attend');
  const pendingFeedback = params.get('feedback');
  if (pendingAttend || pendingFeedback) {
    // Store params so they survive URL cleanup
    if (pendingAttend) window._pendingAttend = pendingAttend;
    if (pendingFeedback) window._pendingFeedback = pendingFeedback;
    // Clean URL without reloading
    window.history.replaceState({}, document.title, window.location.pathname);
    if (currentLearner) {
      handleLearnerURLParams();
    } else {
      openLearnerLoginModal();
    }
  }
  switchView(isAdmin ? 'adminDash' : (currentTeacher ? 'teacherDash' : 'list'));
  // Register push notifications for admins
  if (isAdmin) {
    registerPushNotifications();
    setTimeout(checkTodayReminder, 3000);
  }
  // Feedback nudge for learners
  if (currentLearner) {
    setTimeout(checkFeedbackNudge, 2000);
  }
}

// ===================== PWA NOTIFICATIONS =====================
async function registerPushNotifications() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
  }
  if (Notification.permission !== 'granted') return;
  // Check for new items periodically (every 5 min)
  setInterval(checkForNotifications, 5 * 60 * 1000);
}

async function checkForNotifications() {
  if (!isAdmin || isDemoMode) return;
  try {
    const lastCheck = sessionStorage.getItem('sst_last_notify') || new Date(Date.now() - 300000).toISOString();
    // Check new requests
    const newReqs = await sbGet('session_requests', `created_at=gte.${lastCheck}&status=eq.pending&select=id,topic,suggested_topic,name`);
    newReqs.forEach(r => {
      new Notification('New Session Request', { body: `${r.name || 'Someone'} requested: ${r.topic || r.suggested_topic || 'a session'}`, icon: 'logo_transparent.png', tag: 'req-' + r.id });
    });
    // Check new feedback
    const newFb = await sbGet('feedback', `created_at=gte.${lastCheck}&select=id,session_id,rating`);
    newFb.forEach(f => {
      new Notification('New Feedback', { body: `Feedback received for session #${f.session_id}${f.rating ? ' (' + f.rating + '/5)' : ''}`, icon: 'logo_transparent.png', tag: 'fb-' + f.id });
    });
    sessionStorage.setItem('sst_last_notify', new Date().toISOString());
  } catch(e) { console.warn('Notification check failed:', e); }
}

// Check for today's sessions on load
async function checkTodayReminder() {
  if (!isAdmin || isDemoMode) return;
  if (Notification.permission !== 'granted') return;
  const shown = sessionStorage.getItem('sst_today_reminded');
  if (shown === new Date().toDateString()) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const todaySessions = events.filter(e => {
    const d = eventToDate(e); return d && d.toDateString() === today.toDateString() && e.published;
  });
  if (todaySessions.length > 0) {
    const tbd = todaySessions.filter(e => e.status === 'tbd' || !e.teacher);
    let body = `${todaySessions.length} session${todaySessions.length > 1 ? 's' : ''} today`;
    if (tbd.length > 0) body += ` (${tbd.length} still need a teacher!)`;
    new Notification('Today\'s Sessions', { body, icon: 'logo_transparent.png', tag: 'today-reminder' });
  }
  sessionStorage.setItem('sst_today_reminded', today.toDateString());
}

init();

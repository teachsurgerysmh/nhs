// Southmead Surgical Teaching — auth.js
// Admin authentication, learner authentication, registration, view toggle

// ── Admin Auth ──
// Password hashing moved server-side (authenticate Edge Function) — v3.6.8

async function doLogin() {
  const user = document.getElementById('loginUser').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value.trim();
  if (!user || !pass) { showToast('Enter username and password'); return; }

  // Demo mode login
  if (user === DEMO_CREDENTIALS.username && pass === DEMO_CREDENTIALS.password) {
    isDemoMode = true;
    currentUser = { id: 0, username: 'demo', name: 'Demo User', role: 'admin' };
    setAuthSession('sst_user', JSON.stringify(currentUser));
    sessionStorage.setItem('sst_demo', 'true');
    setAdmin(true);
    closeModal('loginModal');
    document.getElementById('demoBanner').style.display = 'block';
    document.querySelector('.header').style.top = '36px';
    document.querySelector('.nav-bar').style.top = 'calc(72px + 36px)';
    showToast('Welcome to Demo Mode! Explore all features safely.');
    await loadEvents();
    renderAll();
    switchView('adminDash');
    // Start the guided tour after a short delay
    setTimeout(startDemoTour, 1200);
    return;
  }

  try {
    const result = await callAuth({ action: 'login', type: 'admin', username: user, password: pass });
    if (result.access_token) setAuthToken(result.access_token);
    const u = result.user;
    currentUser = { id: u.id, username: u.username, name: u.display_name, role: u.role };
    setAuthSession('sst_user', JSON.stringify(currentUser));
    setAdmin(true);
    closeModal('loginModal');
    showToast('Welcome, ' + currentUser.name);
    await loadEvents();
    renderAll();
    logAction('Logged in');
    logQI('admin_login', { metadata: { username: currentUser.username } });
    switchView('adminDash');
  } catch(e) {
    console.error('Login error:', e);
    logQI('admin_login', { metadata: { result: 'failed', username: user } });
    showToast(e.message || 'Login failed - check connection');
  }
}

function endDemoMode() {
  isDemoMode = false;
  sessionStorage.removeItem('sst_demo');
  document.getElementById('demoBanner').style.display = 'none';
  document.getElementById('demoTourOverlay').style.display = 'none';
  document.querySelector('.header').style.top = '';
  document.querySelector('.nav-bar').style.top = '';
  demoTourCurrentStep = 0;
  doLogout();
}

function doLogout() {
  // Clean up demo state if active
  if (isDemoMode) {
    isDemoMode = false;
    sessionStorage.removeItem('sst_demo');
    document.getElementById('demoBanner').style.display = 'none';
    document.getElementById('demoTourOverlay').style.display = 'none';
    document.querySelector('.header').style.top = '';
    document.querySelector('.nav-bar').style.top = '';
    demoTourCurrentStep = 0;
  }
  logAction('Logged out');
  if (currentUser) logQI('admin_logout', { metadata: { username: currentUser.username } });
  currentUser = null;
  currentLearner = null;
  currentTeacher = null;
  setAuthToken(null);
  clearAuthSession('sst_user');
  clearAuthSession('sst_learner');
  clearAuthSession('sst_teacher');
  document.body.classList.remove('is-learner');
  setAdmin(false);
  switchView('list');
  showToast('Logged out');
  loadEvents().then(() => renderAll());
}

function setAdmin(val) {
  isAdmin = val;
  document.body.classList.toggle('is-admin', val);
  updateHeaderButtons();
  // Deep analytics tabs — Suketu only (not managers, not demo)
  const u = (currentUser?.username || '').toLowerCase();
  const isSuketu = val && !isDemoMode && (u === 'suketu' || u === 'suketubatra');
  const restrictedTabs = ['logTab', 'qiDashTab', 'errorLogTab', 'surveyResultsTab', 'inboxTab'];
  restrictedTabs.forEach(tabId => {
    const tab = document.getElementById(tabId);
    if (tab) tab.style.cssText = isSuketu ? '' : 'display:none !important;';
  });
  // Auto-link admin to learner + teacher records
  if (val && currentUser) {
    linkAdminToLearner();
    linkAdminToTeacher();
  }
}

async function linkAdminToLearner() {
  if (!currentUser) return;
  if (isDemoMode) {
    // Use synthetic demo learner — never query real DB
    currentLearner = { id: 8001, name: 'Demo Admin', email: 'demo@nbt.nhs.uk', grade: 'Consultant', placement: 'Admin', verified: true };
    setAuthSession('sst_learner', JSON.stringify(currentLearner));
    document.body.classList.add('is-learner');
    updateHeaderButtons();
    return;
  }
  // Admin email mapping
  const adminEmails = {
    suketu: 'Suketu.Batra@nbt.nhs.uk',
    ilgin: 'Ilgin.Kilic@nbt.nhs.uk',
    rob: 'rob@nbt.nhs.uk',
    nitin: 'Nitin.Arvind@nbt.nhs.uk'
  };
  const email = (adminEmails[currentUser.username] || (currentUser.username + '@nbt.nhs.uk')).toLowerCase();
  try {
    const data = await sbGet('learners', `email=ilike.${encodeURIComponent(email)}&select=${LEARNER_FIELDS}`);
    if (data.length > 0) {
      currentLearner = data[0];
    } else {
      // Create a learner record for this admin
      // Find matching contact for auto-link
      let adminContactId = null;
      try {
        const contactMatch = await sbGet('contacts', `email=ilike.${encodeURIComponent(email)}&select=id`);
        if (contactMatch.length > 0) adminContactId = contactMatch[0].id;
      } catch(e) {}
      const result = await sbInsert('learners', {
        name: currentUser.name,
        email: email,
        grade: 'Consultant',
        placement: 'Admin',
        pin_code: null,
        contact_id: adminContactId,
        verified: true
      });
      currentLearner = result[0];
    }
    setAuthSession('sst_learner', JSON.stringify(currentLearner));
    document.body.classList.add('is-learner');
    // Show My Dashboard tab for admins
    updateHeaderButtons();
  } catch(e) {
    console.warn('Could not link admin to learner:', e);
  }
}

async function linkAdminToTeacher() {
  if (!currentUser) return;
  if (isDemoMode) {
    currentTeacher = { id: 9001, name: 'Demo Teacher', email: 'demo@nhs.net', specialty: 'General Surgery', is_manager: true };
    setAuthSession('sst_teacher', JSON.stringify(currentTeacher));
    updateHeaderButtons();
    return;
  }
  const adminEmails = {
    suketu: 'Suketu.Batra@nbt.nhs.uk',
    ilgin: 'Ilgin.Kilic@nbt.nhs.uk',
    nitin: 'Nitin.Arvind@nbt.nhs.uk'
  };
  const email = (adminEmails[currentUser.username] || '').toLowerCase();
  if (!email) return;
  try {
    const data = await sbGet('contacts', `email=ilike.${encodeURIComponent(email)}&select=${CONTACT_FIELDS}`);
    if (data.length > 0) {
      currentTeacher = data[0];
      setAuthSession('sst_teacher', JSON.stringify(data[0]));
      updateHeaderButtons();
    }
  } catch(e) { console.warn('Could not link admin to teacher:', e); }
}

function updateHeaderButtons() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const learnerLoginBtn = document.getElementById('learnerLoginBtn');
  const learnerLogoutBtn = document.getElementById('learnerLogoutBtn');
  const teacherLoginBtn = document.getElementById('teacherLoginBtn');
  const teacherLogoutBtn = document.getElementById('teacherLogoutBtn');
  const adminBadge = document.getElementById('adminBadge');
  const learnerBadge = document.getElementById('learnerBadge');
  const teacherBadge = document.getElementById('teacherBadge');
  const dashboardTab = document.getElementById('dashboardTab');
  const teacherDashTab = document.getElementById('teacherDashTab');

  // Hide all first
  [loginBtn, logoutBtn, learnerLoginBtn, learnerLogoutBtn, teacherLoginBtn, teacherLogoutBtn].forEach(b => { if(b) b.style.display = 'none'; });
  [adminBadge, learnerBadge, teacherBadge].forEach(b => { if(b) b.classList.remove('show'); });
  if (dashboardTab) dashboardTab.style.display = 'none';
  if (teacherDashTab) teacherDashTab.style.display = 'none';

  if (isAdmin) {
    logoutBtn.style.display = '';
    logoutBtn.textContent = 'Admin Logout';
    adminBadge.classList.add('show');
    if (dashboardTab) dashboardTab.style.display = '';
    // Show teacher dashboard tab if admin is also a teacher
    if (currentTeacher && teacherDashTab) {
      teacherDashTab.style.display = '';
      teacherBadge.classList.add('show');
      teacherBadge.textContent = currentTeacher.name.split(' ').pop();
    }
    // Show learner badge if admin is also a learner
    if (currentLearner) {
      learnerBadge.classList.add('show');
      learnerBadge.textContent = currentLearner.name.split(' ')[0];
    }
  } else if (currentTeacher) {
    teacherLogoutBtn.style.display = '';
    teacherBadge.classList.add('show');
    teacherBadge.textContent = currentTeacher.name.split(' ').pop();
    if (teacherDashTab) teacherDashTab.style.display = '';
    // If also a learner, show learner dashboard tab too
    if (currentLearner && dashboardTab) {
      dashboardTab.style.display = '';
      learnerBadge.classList.add('show');
      learnerBadge.textContent = currentLearner.name.split(' ')[0];
    }
  } else if (currentLearner) {
    learnerLogoutBtn.style.display = '';
    learnerBadge.classList.add('show');
    learnerBadge.textContent = currentLearner.name.split(' ')[0];
    if (dashboardTab) dashboardTab.style.display = '';
    // If also a teacher, show teacher dashboard tab too
    if (currentTeacher && teacherDashTab) {
      teacherDashTab.style.display = '';
      teacherBadge.classList.add('show');
      teacherBadge.textContent = currentTeacher.name.split(' ').pop();
    }
  } else {
    loginBtn.style.display = '';
    learnerLoginBtn.style.display = '';
    teacherLoginBtn.style.display = '';
  }
}

function checkSession() {
  restoreAuthToken(); // Restore JWT from sessionStorage
  const stored = getAuthSession('sst_user');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      setAdmin(true);
      // Restore demo mode if it was active
      if (sessionStorage.getItem('sst_demo') === 'true') {
        isDemoMode = true;
        document.getElementById('demoBanner').style.display = 'block';
        document.querySelector('.header').style.top = '36px';
        document.querySelector('.nav-bar').style.top = 'calc(72px + 36px)';
        // Show resume tour button if tour was in progress
        if (demoTourCurrentStep > 0) {
          document.getElementById('resumeTourBtn').style.display = 'inline-block';
        }
      }
    } catch(e) {}
  }
}

// ── Learner Auth ──

function openLearnerLoginModal() {
  showLearnerLoginForm();
  document.getElementById('learnerEmail').value = '';
  document.getElementById('learnerPin').value = '';
  openModal('learnerLoginModal');
  setTimeout(() => document.getElementById('learnerEmail').focus(), 100);
  initPasskeyUI();
}

function showLearnerLoginForm() {
  document.getElementById('learnerLoginForm').style.display = '';
  document.getElementById('learnerRegisterForm').style.display = 'none';
  document.getElementById('learnerPinDisplay').style.display = 'none';
  document.getElementById('learnerModalTitle').textContent = 'Learner Login';
}

function showLearnerRegister() {
  document.getElementById('learnerLoginForm').style.display = 'none';
  document.getElementById('learnerRegisterForm').style.display = '';
  document.getElementById('learnerPinDisplay').style.display = 'none';
  document.getElementById('learnerModalTitle').textContent = 'Learner Registration';
  // Denominator for the registration funnel. learner_register only ever fires
  // on success, so before this there was no way to see people who opened the
  // form and gave up — which is exactly what a mandatory-fields change risks.
  try { logQI('registration_started'); } catch(_) {}
}

// After a successful login/setup, send the user back to the gated page that
// sent them here (e.g. induction.html), if one was recorded. Returns true if
// a redirect happened (caller should stop further post-login UI work).
function redirectAfterAuth() {
  const returnTo = sessionStorage.getItem('sst_return_to');
  const ts = Number(sessionStorage.getItem('sst_return_to_ts') || 0);
  sessionStorage.removeItem('sst_return_to');
  sessionStorage.removeItem('sst_return_to_ts');
  if (!returnTo || (Date.now() - ts) > 15 * 60 * 1000) return false; // stale intent (>15 min) — ignore
  window.location.href = returnTo;
  return true;
}

async function doLearnerLogin() {
  const email = document.getElementById('learnerEmail').value.trim().toLowerCase();
  const pin = document.getElementById('learnerPin').value.trim();
  if (!email || !pin) { showToast('Enter email and password'); return; }
  try {
    const result = await callAuth({ action: 'login', type: 'learner', email, password: pin });
    if (result.needs_setup) {
      showSetupPinForm(result.user, pin);
      return;
    }
    if (result.access_token) setAuthToken(result.access_token);
    const learner = result.user;
    currentLearner = learner;
    setAuthSession('sst_learner', JSON.stringify(currentLearner));
    setLearnerUI(true);
    logQI('learner_login', { metadata: { grade: learner.grade, placement: learner.placement } });
    await linkLearnerToTeacher();
    closeModal('learnerLoginModal');
    if (redirectAfterAuth()) return;
    showToast('Welcome, ' + learner.name + '!');
    updateHeaderButtons();
    handleLearnerURLParams();
    setTimeout(maybeOfferPasskey, 1200);
  } catch(e) { console.error('Learner login error:', e); showToast(e.message || 'Login failed'); }
}

function showSetupPinForm(learner, attemptedPin) {
  const body = document.getElementById('learnerLoginForm');
  body.innerHTML = `
    <div style="text-align:center;padding:10px 0;">
      <div style="font-size:36px;margin-bottom:8px;">👋</div>
      <h3 style="color:var(--nhs-dark-blue);margin-bottom:4px;">Welcome, ${esc(learner.name)}!</h3>
      <p style="color:var(--nhs-grey);font-size:13px;margin-bottom:16px;">Your account has been pre-created. Set a 6-digit PIN to get started.</p>
    </div>
    <label>Choose a password</label>
    <input type="password" id="setupPin1" placeholder="Enter password" autocomplete="new-password" style="margin-bottom:8px;">
    <label>Confirm password</label>
    <input type="password" id="setupPin2" placeholder="Confirm password" autocomplete="new-password">
    <label style="margin-top:12px;">Grade</label>
    <select id="setupGrade"><option value="FY1">FY1</option><option value="FY2">FY2</option><option value="CT1">CT1</option><option value="CT2">CT2</option><option value="ST3">ST3</option><option value="ST4">ST4</option><option value="ST5">ST5</option><option value="ST6">ST6</option><option value="ST7">ST7</option><option value="ST8">ST8</option><option value="Registrar">Registrar</option><option value="Consultant">Consultant</option><option value="Other">Other</option></select>
    <label>Placement / Firm</label>
    <select id="setupPlacement"><option value="">-- Select --</option><option value="UGI">UGI</option><option value="LGI / Colorectal">LGI / Colorectal</option><option value="Transplant">Transplant</option><option value="Vascular">Vascular</option><option value="Other">Other</option></select>
    <label>Rotation Block</label>
    <select id="setupRotation" onchange="onSetupRotationChange()"><option value="">-- Select --</option><option value="aug_dec">Aug – Dec</option><option value="dec_apr">Dec – Apr</option><option value="apr_aug">Apr – Aug</option></select>
    <input type="hidden" id="setupStart" value="">
    <input type="hidden" id="setupEnd" value="">
    <input type="hidden" id="setupEmail" value="${esc(learner.email)}">
    <div style="margin-top:16px;text-align:center;">
      <button class="btn btn-green" onclick="completeAccountSetup(${learner.id})">Set Up Account</button>
    </div>
  `;
}

function onSetupRotationChange() {
  const block = document.getElementById('setupRotation').value;
  if (!block) return;
  const now = new Date();
  const yr = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const blocks = {
    aug_dec: { start: yr + '-08-01', end: yr + '-12-31' },
    dec_apr: { start: yr + '-12-01', end: (yr+1) + '-04-30' },
    apr_aug: { start: (yr+1) + '-04-01', end: (yr+1) + '-08-31' }
  };
  const d = blocks[block];
  if (d) { document.getElementById('setupStart').value = d.start; document.getElementById('setupEnd').value = d.end; }
}

async function completeAccountSetup(learnerId) {
  const pin1 = document.getElementById('setupPin1').value.trim();
  const pin2 = document.getElementById('setupPin2').value.trim();
  const grade = document.getElementById('setupGrade').value;
  const placement = document.getElementById('setupPlacement').value;
  const rotation = document.getElementById('setupRotation').value;
  const pStart = document.getElementById('setupStart').value;
  const pEnd = document.getElementById('setupEnd').value;

  if (!pin1 || pin1.length < 4) { showToast('Password must be at least 4 characters'); return; }
  if (pin1 !== pin2) { showToast('PINs do not match'); return; }
  if (!placement) { showToast('Please select a placement'); return; }

  // NOTE: email must come from #setupEmail (a hidden field set when this
  // form was built), not #learnerEmail — showSetupPinForm() replaces the
  // whole #learnerLoginForm innerHTML, which destroys the original
  // #learnerEmail input from the login form. Reading it here always
  // silently returned '' (optional chaining swallowed the missing
  // element), so every pre-created-account setup sent an empty email to
  // the edge function, which correctly rejected it — surfaced to the user
  // as a generic, always-happens "Setup failed. Please try again."
  const setupEmail = document.getElementById('setupEmail')?.value?.trim()?.toLowerCase() || '';
  try {
    // Set password via server-side Edge Function
    const authResult = await callAuth({ action: 'setup', type: 'learner', email: setupEmail, password: pin1 });
    if (authResult.access_token) setAuthToken(authResult.access_token);
    // Update profile fields directly (non-sensitive data)
    const updates = { verified: true, grade, placement, rotation_block: rotation || null };
    if (pStart) updates.placement_start = pStart;
    if (pEnd) updates.placement_end = pEnd;
    await sbUpdate('learners', learnerId, updates);

    currentLearner = { ...authResult.user, ...updates };
    setAuthSession('sst_learner', JSON.stringify(currentLearner));
    setLearnerUI(true);

    // Show success with PIN reminder
    document.getElementById('learnerLoginForm').innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:36px;margin-bottom:8px;">✅</div>
        <h3 style="color:var(--nhs-green);">Account Set Up!</h3>
        <p style="color:var(--nhs-grey);font-size:13px;margin-top:8px;">Your password has been set. Use it with your email to log in next time.</p>
        <button class="btn btn-green" style="margin-top:16px;" onclick="closeModal('learnerLoginModal');if(!redirectAfterAuth())location.reload();">Continue</button>
      </div>`;
  } catch(e) {
    console.error('Account setup error:', e);
    showToast('Setup failed. Please try again.');
  }
}

function showForgotPassword() {
  document.getElementById('learnerLoginForm').style.display = 'none';
  document.getElementById('learnerRegisterForm').style.display = 'none';
  document.getElementById('learnerPinDisplay').style.display = 'none';
  document.getElementById('learnerModalTitle').textContent = 'Reset Password';
  // Create forgot password form
  let fpDiv = document.getElementById('forgotPasswordForm');
  if (!fpDiv) {
    fpDiv = document.createElement('div');
    fpDiv.id = 'forgotPasswordForm';
    document.getElementById('learnerModalBody').appendChild(fpDiv);
  }
  fpDiv.style.display = '';
  fpDiv.innerHTML = `
    <p style="font-size:13px;color:var(--nhs-grey);margin-bottom:16px;">Enter your NHS email to reset your password.</p>
    <label>NHS Email</label>
    <input type="email" id="fpEmail" placeholder="name@nhs.net or name@nbt.nhs.uk">
    <div id="fpNewFields" style="display:none;margin-top:12px;">
      <label>New Password</label>
      <input type="password" id="fpNewPin1" placeholder="Enter new password" autocomplete="new-password">
      <label>Confirm Password</label>
      <input type="password" id="fpNewPin2" placeholder="Confirm new password" autocomplete="new-password">
    </div>
    <div style="margin-top:14px;text-align:center;">
      <button class="btn btn-green" id="fpSubmitBtn" onclick="handleForgotPassword()" style="width:100%;">Verify Email</button>
    </div>
    <div style="margin-top:12px;text-align:center;font-size:13px;color:var(--nhs-grey);">
      <a href="#" onclick="showLearnerLoginForm();document.getElementById('forgotPasswordForm').style.display='none';return false;">Back to login</a>
    </div>`;
}

async function handleForgotPassword() {
  const email = document.getElementById('fpEmail').value.trim().toLowerCase();
  if (!email) { showToast('Please enter your email'); return; }
  const newFields = document.getElementById('fpNewFields');
  if (newFields.style.display === 'none') {
    // Step 1: verify email exists (server-side)
    try {
      const result = await callAuth({ action: 'verify_email', type: 'learner', email });
      newFields.style.display = '';
      document.getElementById('fpEmail').setAttribute('readonly', true);
      document.getElementById('fpSubmitBtn').textContent = 'Reset Password';
      document.getElementById('fpSubmitBtn').setAttribute('onclick', `doResetPassword('${email}', ${result.id})`);
      showToast('Email verified! Set your new password.');
    } catch(e) { showToast('No account found with that email'); }
  }
}

async function doResetPassword(email, learnerId) {
  const p1 = document.getElementById('fpNewPin1').value.trim();
  const p2 = document.getElementById('fpNewPin2').value.trim();
  if (!p1 || p1.length < 4) { showToast('Password must be at least 4 characters'); return; }
  if (p1 !== p2) { showToast('Passwords do not match'); return; }
  try {
    await callAuth({ action: 'reset_password', type: 'learner', email, new_password: p1 });
    logQI('password_reset', { actor_type: 'learner', actor_email: email, metadata: { who: 'learner' } });
    showToast('Password reset! You can now log in.');
    document.getElementById('forgotPasswordForm').style.display = 'none';
    showLearnerLoginForm();
    document.getElementById('learnerEmail').value = email;
  } catch(e) { showToast('Reset failed. Try again.'); }
}

// ── Admin/Learner View Toggle ──

let adminViewAsLearner = false;

function toggleAdminLearnerView() {
  adminViewAsLearner = !adminViewAsLearner;
  if (adminViewAsLearner) {
    // Switch to learner view
    document.body.classList.remove('is-admin');
    document.body.classList.add('is-learner');
    document.getElementById('adminBadge').textContent = 'Learner View';
    document.getElementById('adminBadge').style.background = 'var(--nhs-green)';
    document.getElementById('viewToggleBtn').textContent = 'Admin View';
    // Hide admin nav tabs
    document.querySelectorAll('.nav-tab[data-view="drafts"], .nav-tab[data-view="all"], .nav-tab[data-view="inbox"], .nav-tab[data-view="approvals"]').forEach(t => t.style.display = 'none');
  } else {
    // Switch back to admin view
    document.body.classList.add('is-admin');
    document.body.classList.remove('is-learner');
    document.getElementById('adminBadge').textContent = 'Admin';
    document.getElementById('adminBadge').style.background = '';
    document.getElementById('viewToggleBtn').textContent = 'Learner View';
    // Show admin nav tabs
    document.querySelectorAll('.nav-tab[data-view="drafts"], .nav-tab[data-view="all"], .nav-tab[data-view="inbox"], .nav-tab[data-view="approvals"]').forEach(t => t.style.display = '');
  }
  switchView('list');
  renderAll();
}

function onRotationBlockChange() {
  const block = document.getElementById('regRotationBlock').value;
  const startField = document.getElementById('regPlacementStart');
  const endField = document.getElementById('regPlacementEnd');
  if (!block) {
    startField.removeAttribute('readonly');
    endField.removeAttribute('readonly');
    return;
  }
  // Determine academic year: if current month >= August, year starts this year; else last year
  const now = new Date();
  const academicYearStart = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const blocks = {
    aug_dec: { start: `${academicYearStart}-08-01`, end: `${academicYearStart}-12-31` },
    dec_apr: { start: `${academicYearStart}-12-01`, end: `${academicYearStart + 1}-04-30` },
    apr_aug: { start: `${academicYearStart + 1}-04-01`, end: `${academicYearStart + 1}-08-31` }
  };
  const dates = blocks[block];
  if (dates) {
    startField.value = dates.start;
    endField.value = dates.end;
    startField.setAttribute('readonly', true);
    endField.setAttribute('readonly', true);
  }
}

// ── Verified-access tier ──
// Registration accepts any email domain, so "logged in" no longer proves the
// person works here. RLS (auth_nhs_verified()) is what actually withholds the
// personal-data tables; everything below is signposting so an unverified user
// understands why the app looks empty instead of assuming it's broken.

function isLearnerVerified(l) {
  // Absent property = a session stored before this change, all of which were
  // NHS-only registrations. Treat as verified, matching the SQL helper.
  return !l || l.nhs_verified === undefined || l.nhs_verified === true;
}

function renderPendingNotice(learner) {
  if (isLearnerVerified(learner)) return;
  const host = document.getElementById('learnerPinDisplay');
  if (!host || document.getElementById('pendingApprovalNotice')) return;
  const div = document.createElement('div');
  div.id = 'pendingApprovalNotice';
  div.style.cssText = 'margin-top:16px;padding:14px;border-radius:8px;background:#fff4e5;border:1px solid var(--nhs-warm-yellow,#ffb81c);text-align:left;';
  div.innerHTML = `
    <div style="font-weight:700;color:var(--nhs-dark-blue);font-size:14px;margin-bottom:6px;">⏳ Awaiting approval</div>
    <div style="font-size:13px;color:var(--nhs-grey);line-height:1.6;">
      You registered with a non-NHS email, so your account needs approving by the
      teaching team before it can show contact details, learner lists or feedback.
      You can browse the teaching timetable in the meantime.<br><br>
      To be approved instantly, register again with an <strong>@nhs.net</strong> or
      <strong>@nbt.nhs.uk</strong> address once you have one.
    </div>`;
  host.appendChild(div);
}

// Persistent banner for an unverified learner anywhere in the app.
function refreshPendingBanner() {
  const existing = document.getElementById('pendingBanner');
  if (isLearnerVerified(currentLearner) || !currentLearner) { if (existing) existing.remove(); return; }
  if (existing) return;
  const bar = document.createElement('div');
  bar.id = 'pendingBanner';
  bar.style.cssText = 'background:#fff4e5;border-bottom:1px solid #ffb81c;color:#425563;font-size:13px;padding:10px 16px;text-align:center;';
  bar.innerHTML = '⏳ <strong>Account awaiting approval</strong> — you can see the teaching timetable, but contact details and learner data stay hidden until the teaching team approves you.';
  document.body.insertBefore(bar, document.body.firstChild);
}

// ── Invite links ──
// A time-limited link that lets someone without an NHS account register as
// verified. It is a bearer credential — whoever holds it gets in — so it is
// bounded three ways server-side (expiry, use cap, revocable) and every account
// it admits is stamped in approved_by for audit. See create_invite/consume_invite.

const INVITE_KEY = 'sst_invite_token';

function getStoredInvite() {
  try { return sessionStorage.getItem(INVITE_KEY) || null; } catch (_) { return null; }
}

async function handleInviteLink() {
  const params = new URLSearchParams(window.location.search);
  const token = (params.get('invite') || '').trim();
  if (!token) return;

  // Strip it from the address bar immediately: a bearer token has no business
  // sitting in browser history, or being copied out of the URL bar and shared
  // further than intended.
  window.history.replaceState({}, document.title, window.location.pathname);

  let info = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_invite`, {
      method: 'POST', headers, body: JSON.stringify({ p_token: token })
    });
    if (res.ok) { const rows = await res.json(); info = rows && rows[0]; }
  } catch (e) { console.warn('invite check failed', e); }

  if (!info || !info.valid) {
    const why = { expired: 'This invite link has expired.',
                  revoked: 'This invite link has been withdrawn.',
                  exhausted: 'This invite link has already been used the maximum number of times.',
                  not_found: 'That invite link is not recognised.' }[info && info.reason] ||
                'That invite link is no longer valid.';
    showToast(why + ' Please ask the teaching team for a new one.', 6000);
    logQI('invite_link_rejected', { metadata: { reason: (info && info.reason) || 'unknown' } });
    return;
  }

  try { sessionStorage.setItem(INVITE_KEY, token); } catch (_) {}
  logQI('invite_link_opened', { metadata: { label: info.label || null } });

  // Already signed in but stuck pending? Upgrade in place rather than making
  // them register a second account.
  if (currentLearner && !isLearnerVerified(currentLearner)) {
    await redeemInviteForCurrentLearner(token);
    return;
  }
  if (currentLearner) { showToast('You already have full access — no need for the invite link.', 4000); return; }

  showInviteBanner(info);
  setTimeout(() => { openLearnerLoginModal(); showLearnerRegister(); }, 400);
}

async function redeemInviteForCurrentLearner(token) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_invite`, {
      method: 'POST', headers,
      body: JSON.stringify({ p_token: token, p_email: currentLearner.email })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const row = (await res.json())[0] || {};
    if (row.ok) {
      currentLearner.nhs_verified = true;
      setAuthSession('sst_learner', JSON.stringify(currentLearner));
      refreshPendingBanner();
      logQI('invite_link_redeemed', { metadata: { mode: 'upgrade' } });
      showToast('Your account has been approved — you now have full access.', 5000);
      // The JWT still carries nhs_verified:false until it is reissued, and RLS
      // reads the token, not the row. Sign back in to pick up the new claim.
      setTimeout(() => {
        showToast('Please sign in again to finish activating your access.', 6000);
        if (typeof doLearnerLogout === 'function') doLearnerLogout();
      }, 2500);
    } else {
      showToast('That invite link could not be applied to your account.', 5000);
    }
  } catch (e) {
    console.error('claim_invite failed', e);
    showToast('Could not apply the invite link. Please try again.', 4000);
  }
}

function showInviteBanner(info) {
  if (document.getElementById('inviteBanner')) return;
  const bar = document.createElement('div');
  bar.id = 'inviteBanner';
  bar.style.cssText = 'background:#e8f5e9;border-bottom:1px solid var(--nhs-green,#009639);color:#22543d;font-size:13px;padding:10px 16px;text-align:center;';
  const expires = info.expires_at ? new Date(info.expires_at) : null;
  const when = expires ? expires.toLocaleString('en-GB', { weekday:'short', hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' }) : null;
  bar.innerHTML = '✅ <strong>Invite link accepted</strong> — you can register with a personal email and get full access straight away.' +
                  (when ? ' <span style="opacity:.75;">Valid until ' + when + '.</span>' : '');
  document.body.insertBefore(bar, document.body.firstChild);
}

// ── Learner Registration ──

async function doLearnerRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const personalEmail = document.getElementById('regPersonalEmail').value.trim().toLowerCase();
  const phone = document.getElementById('regPhone').value.trim();
  const grade = document.getElementById('regGrade').value;
  const placement = document.getElementById('regPlacement').value;
  const placementStart = document.getElementById('regPlacementStart').value;
  const placementEnd = document.getElementById('regPlacementEnd').value;
  const rotationBlock = document.getElementById('regRotationBlock').value;

  // Every field is mandatory except two deliberate cases:
  //  - Rotation block: its empty value MEANS "custom dates", and picking a
  //    block just auto-fills the two date fields — so the dates are required
  //    instead, which covers both routes.
  //  - Personal email: only required when the login email is an NHS address.
  //    New starters often have no @nhs.net account on day one, so demanding
  //    one blocked exactly the people we're onboarding. When someone registers
  //    with a personal address the "personal" field is redundant by definition.
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const isNhsEmail = /@(nhs\.net|nbt\.nhs\.uk)$/.test(email);

  if (!name || !email || !phone || !grade || !placement || !placementStart || !placementEnd) {
    showToast('Please fill in all fields'); return;
  }
  if (!EMAIL_RE.test(email)) { showToast('Please enter a valid email address'); return; }
  if (isNhsEmail && !personalEmail) {
    showToast('Please add a personal email as well, so we can still reach you if NHS mail bounces', 4500); return;
  }
  if (personalEmail && !EMAIL_RE.test(personalEmail)) { showToast('Please enter a valid personal email'); return; }
  if (personalEmail && personalEmail === email) { showToast('Your personal email must be different from your main email'); return; }
  if (phone.replace(/\D/g, '').length < 10) { showToast('Please enter a valid mobile number'); return; }
  if (placementEnd < placementStart) { showToast('Placement end date must be after the start date'); return; }

  // Check for existing learner with same email (case-insensitive).
  // anon can't SELECT learners directly (RLS) — use SECURITY DEFINER RPC,
  // otherwise this guard silently passes and the INSERT fails on the unique
  // email constraint with a confusing generic "Registration failed".
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/lookup_feedback_learner`, {
      method: 'POST', headers, body: JSON.stringify({ email_val: email })
    });
    const existing = r.ok ? await r.json() : [];
    if (existing.length > 0) {
      showToast('An account with this email already exists. Please log in instead.', 4000);
      return;
    }
  } catch(_) { /* non-fatal: fall through, the insert still guards via unique constraint */ }

  // Generate 6-digit PIN
  const pin = String(Math.floor(100000 + Math.random() * 900000));

  try {
    // Register without password first, then set password server-side.
    // Uses the register_learner RPC, not a raw sbInsert: anon can INSERT
    // into learners under RLS, but sbInsert always asks for the row back
    // (Prefer: return=representation), which also needs a SELECT policy —
    // anon has none on learners (only authenticated does) — so a direct
    // insert fails with 42501 even though the insert itself is permitted.
    const regRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_learner`, {
      method: 'POST', headers,
      body: JSON.stringify({
        p_name: name, p_email: email, p_grade: grade, p_placement: placement,
        p_placement_start: placementStart || null,
        p_placement_end: placementEnd || null,
        p_rotation_block: rotationBlock || null,
        p_phone: phone, p_personal_email: personalEmail,
        // Ignored server-side for an NHS address, and a stale/expired token
        // degrades to an ordinary pending registration rather than an error.
        p_invite_token: getStoredInvite()
      })
    });
    if (!regRes.ok) {
      const errBody = await regRes.text();
      throw new Error(`Registration failed: ${regRes.status}${errBody ? ' — ' + errBody : ''}`);
    }
    const result = await regRes.json();
    // Set password server-side
    await callAuth({ action: 'setup', type: 'learner', email, password: pin });
    currentLearner = result[0];
    setAuthSession('sst_learner', JSON.stringify(currentLearner));
    setLearnerUI(true);
    // Contactability is a QI outcome in its own right: an unreachable learner
    // can't be reminded, chased for feedback, or sent a certificate. Record
    // WHETHER each channel was captured — never the number or address itself,
    // which is personal data and has no business sitting in an event log.
    logQI('learner_register', { metadata: {
      grade, placement, rotation_block: rotationBlock || null,
      has_phone: !!phone,
      has_personal_email: !!personalEmail,
      contact_channels: 1 + (phone ? 1 : 0) + (personalEmail ? 1 : 0)
    } });

    // Auto-link to contact if email matches
    try {
      const contactMatch = await sbGet('contacts', `email=ilike.${encodeURIComponent(email)}&select=${CONTACT_FIELDS}`);
      if (contactMatch.length > 0) {
        await sbUpdate('learners', currentLearner.id, { contact_id: contactMatch[0].id });
        currentLearner.contact_id = contactMatch[0].id;
        setAuthSession('sst_learner', JSON.stringify(currentLearner));
      }
    } catch(linkErr) { console.warn('Contact link skipped:', linkErr); }

    // Show PIN
    document.getElementById('learnerLoginForm').style.display = 'none';
    document.getElementById('learnerRegisterForm').style.display = 'none';
    document.getElementById('learnerPinDisplay').style.display = '';
    document.getElementById('generatedPin').textContent = pin;
    document.getElementById('learnerModalTitle').textContent = 'Registration Complete';

    // An account registered with a non-NHS address starts unverified: it can
    // see the timetable but RLS returns nothing from the personal-data tables
    // until an admin approves it. Say so plainly here rather than letting them
    // discover it as a mysteriously empty app.
    renderPendingNotice(currentLearner);
    // Burnt on success — stops a shared device carrying the token into a
    // second, unintended registration.
    if (currentLearner && currentLearner.nhs_verified) {
      try { sessionStorage.removeItem(INVITE_KEY); } catch (_) {}
      logQI('invite_link_redeemed', { metadata: { mode: 'register' } });
    }
  } catch(e) {
    console.error('Registration error:', e);
    if (e.message && e.message.includes('409')) {
      showToast('An account with this email already exists. Please login.');
    } else {
      showToast('Registration failed. Please try again.');
    }
  }
}

function doLearnerLogout() {
  if (currentLearner) logQI('learner_logout');
  currentLearner = null;
  setAuthToken(null);
  clearAuthSession('sst_learner');
  setLearnerUI(false);
  updateSessionsTabLabel();
  if (currentView === 'dashboard') switchView('list');
  showToast('Learner logged out');
}

function setLearnerUI(loggedIn) {
  document.body.classList.toggle('is-learner', loggedIn);
  updateHeaderButtons();
  // Update sessions tab label
  updateSessionsTabLabel();
  try { refreshPendingBanner(); } catch(_) {}
}

function checkLearnerSession() {
  const stored = getAuthSession('sst_learner');
  if (stored) {
    try {
      currentLearner = JSON.parse(stored);
      setLearnerUI(true);
      updateSessionsTabLabel();
    } catch(e) { clearAuthSession('sst_learner'); }
  }
}

function handleLearnerURLParams() {
  const params = new URLSearchParams(window.location.search);
  const attendId = params.get('attend') || window._pendingAttend;
  const feedbackId = params.get('feedback') || window._pendingFeedback;
  // Clear stored params
  delete window._pendingAttend;
  delete window._pendingFeedback;
  if (attendId && currentLearner) {
    markSelfAttendance(parseInt(attendId));
  }
  if (feedbackId && currentLearner) {
    openFeedbackModal(parseInt(feedbackId));
  }
}

// ── Teacher Auth ──

function openTeacherLoginModal() {
  showTeacherLoginForm();
  openModal('teacherLoginModal');
  initPasskeyUI();
}

function showTeacherLoginForm() {
  document.getElementById('teacherLoginForm').style.display = '';
  document.getElementById('teacherSetupForm').style.display = 'none';
  document.getElementById('teacherModalTitle').textContent = 'Teacher Login';
}

function showTeacherSetup() {
  document.getElementById('teacherLoginForm').style.display = 'none';
  document.getElementById('teacherSetupForm').style.display = '';
  document.getElementById('teacherModalTitle').textContent = 'Set Up Teacher Account';
}

async function doTeacherLogin() {
  const email = document.getElementById('teacherEmail').value.trim().toLowerCase();
  const pin = document.getElementById('teacherPin').value.trim();
  if (!email || !pin) { showToast('Please enter email and password'); return; }
  try {
    const result = await callAuth({ action: 'login', type: 'teacher', email, password: pin });
    if (result.needs_setup) { showToast('Account not set up yet. Please use "Set up your account" first.'); return; }
    if (result.access_token) setAuthToken(result.access_token);
    const teacher = result.user;
    currentTeacher = teacher;
    setAuthSession('sst_teacher', JSON.stringify(teacher));
    closeModal('teacherLoginModal');
    if (redirectAfterAuth()) return;
    logQI('teacher_login', { metadata: { specialty: teacher.specialty || null } });
    await linkTeacherToLearner();
    updateHeaderButtons();
    showToast(`Welcome, ${teacher.name}!`);
    switchView('teacherDash');
    setTimeout(maybeOfferPasskey, 1200);
  } catch(e) { console.error('Teacher login failed:', e); showToast(e.message || 'Login failed'); }
}

async function doTeacherSetup() {
  const email = document.getElementById('teacherSetupEmail').value.trim().toLowerCase();
  const pin = document.getElementById('teacherSetupPin').value.trim();
  const pinConfirm = document.getElementById('teacherSetupPinConfirm').value.trim();
  if (!email || !pin) { showToast('Please fill all fields'); return; }
  if (pin !== pinConfirm) { showToast('Passwords do not match'); return; }
  if (pin.length < 4) { showToast('Password must be at least 4 characters'); return; }
  try {
    const result = await callAuth({ action: 'setup', type: 'teacher', email, password: pin });
    if (result.access_token) setAuthToken(result.access_token);
    const teacher = result.user;
    currentTeacher = teacher;
    setAuthSession('sst_teacher', JSON.stringify(teacher));
    closeModal('teacherLoginModal');
    if (redirectAfterAuth()) return;
    logQI('teacher_setup', { metadata: { specialty: teacher.specialty || null } });
    await linkTeacherToLearner();
    updateHeaderButtons();
    showToast(`Account set up! Welcome, ${teacher.name}!`);
    switchView('teacherDash');
  } catch(e) { console.error('Teacher setup failed:', e); showToast(e.message || 'Setup failed'); }
}

async function linkTeacherToLearner() {
  if (!currentTeacher) return;
  const email = currentTeacher.email.toLowerCase();
  try {
    const data = await sbGet('learners', `email=ilike.${encodeURIComponent(email)}&select=${LEARNER_FIELDS}`);
    if (data.length > 0) {
      currentLearner = data[0];
      setAuthSession('sst_learner', JSON.stringify(currentLearner));
      document.body.classList.add('is-learner');
    }
  } catch(e) { console.warn('Could not link teacher to learner:', e); }
}

async function linkLearnerToTeacher() {
  if (!currentLearner) return;
  const email = currentLearner.email.toLowerCase();
  try {
    const data = await sbGet('contacts', `email=ilike.${encodeURIComponent(email)}&select=${CONTACT_FIELDS}`);
    if (data.length > 0) {
      currentTeacher = data[0];
      setAuthSession('sst_teacher', JSON.stringify(data[0]));
    }
  } catch(e) { console.warn('Could not link learner to teacher:', e); }
}

function doTeacherLogout() {
  if (currentTeacher) logQI('teacher_logout');
  currentTeacher = null;
  currentLearner = null;
  setAuthToken(null);
  clearAuthSession('sst_teacher');
  clearAuthSession('sst_learner');
  document.body.classList.remove('is-learner');
  updateHeaderButtons();
  if (currentView === 'teacherDash') switchView('list');
  showToast('Logged out');
}

function checkTeacherSession() {
  const stored = getAuthSession('sst_teacher');
  if (stored) {
    try {
      currentTeacher = JSON.parse(stored);
      updateHeaderButtons();
    } catch(e) { clearAuthSession('sst_teacher'); }
  }
}

function isManager() {
  if (isAdmin) return true;
  if (currentTeacher && currentTeacher.is_manager) return true;
  if (currentTeacher && MANAGERS.includes(currentTeacher.email.toLowerCase())) return true;
  return false;
}

function isTeacherForSession(sessionId) {
  if (!currentTeacher) return false;
  const ev = events.find(e => e.id === sessionId);
  if (!ev) return false;
  return ev.teacherEmail && ev.teacherEmail.toLowerCase() === currentTeacher.email.toLowerCase();
}

function canMarkAttendance(sessionId) {
  if (isAdmin) return true;
  if (isManager()) return true;
  if (isTeacherForSession(sessionId)) return true;
  return false;
}

// ===================== PASSKEYS — Face ID / Touch ID =====================
// ADDITIVE to password login. Every function here fails soft: if anything
// goes wrong (unsupported browser, cancelled prompt, network, expired
// challenge) we surface a message and the password form is still sitting
// right there. Nothing in here can lock anyone out.
//
// Backend: `passkey` Edge Function. Its auth_verify mints a token with the
// same claims as `authenticate`, so downstream state is identical whether
// you signed in with a password or a face.
//
// RP ID is teachsurgerysmh.github.io. Moving to a custom domain would
// invalidate every enrolled passkey — see database/edge-function-passkey.ts.

const PASSKEY_FN = SUPABASE_URL + '/functions/v1/passkey';

function passkeySupported() {
  return !!(window.PublicKeyCredential && navigator.credentials &&
            navigator.credentials.create && navigator.credentials.get);
}

// True only where there's a built-in biometric authenticator (Face ID,
// Touch ID, Windows Hello). Used to decide whether to show the buttons at
// all, so we never advertise something the device can't do.
async function passkeyPlatformAvailable() {
  try {
    if (!passkeySupported()) return false;
    if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) { return false; }
}

function _pkB64uToBuf(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function _pkBufToB64u(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _pkDeviceLabel() {
  const ua = navigator.userAgent || '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Passkey';
}

function _pkCloseModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

async function callPasskey(body, useAuth) {
  const tok = useAuth ? getAuthSession('sst_token') : null;
  const res = await fetch(PASSKEY_FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + (tok || SUPABASE_KEY)
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Passkey request failed');
  return data;
}

// Mirrors the tail of doLearnerLogin / doTeacherLogin exactly — same state,
// same session keys, same QI events — so the rest of the app can't tell
// which method was used.
async function _applyPasskeySession(result) {
  if (result.access_token) setAuthToken(result.access_token);
  if (result.login_type === 'teacher') {
    currentTeacher = result.user;
    setAuthSession('sst_teacher', JSON.stringify(currentTeacher));
    _pkCloseModal('teacherLoginModal');
    _pkCloseModal('learnerLoginModal');
    if (redirectAfterAuth()) return;
    logQI('teacher_login', { metadata: { specialty: currentTeacher.specialty || null, method: 'passkey' } });
    await linkTeacherToLearner();
    updateHeaderButtons();
    showToast('Welcome, ' + currentTeacher.name + '!');
    switchView('teacherDash');
  } else {
    currentLearner = result.user;
    setAuthSession('sst_learner', JSON.stringify(currentLearner));
    setLearnerUI(true);
    _pkCloseModal('learnerLoginModal');
    _pkCloseModal('teacherLoginModal');
    if (redirectAfterAuth()) return;
    logQI('learner_login', { metadata: { grade: currentLearner.grade, placement: currentLearner.placement, method: 'passkey' } });
    await linkLearnerToTeacher();
    showToast('Welcome, ' + currentLearner.name + '!');
    updateHeaderButtons();
    handleLearnerURLParams();
  }
}

// email is optional. Omit it and the browser offers whatever passkey it
// holds for this site — no typing at all. mediation 'conditional' drives
// the iOS autofill-style suggestion above the keyboard.
async function doPasskeyLogin(email, mediation) {
  const options = await callPasskey({ action: 'auth_options', email: email || '' }, false);
  const pk = Object.assign({}, options);
  pk.challenge = _pkB64uToBuf(options.challenge);
  if (options.allowCredentials && options.allowCredentials.length) {
    pk.allowCredentials = options.allowCredentials.map(c => Object.assign({}, c, { id: _pkB64uToBuf(c.id) }));
  } else {
    delete pk.allowCredentials;
  }
  const getOpts = { publicKey: pk };
  if (mediation) getOpts.mediation = mediation;
  const a = await navigator.credentials.get(getOpts);
  if (!a) return false;
  const payload = {
    id: a.id,
    rawId: _pkBufToB64u(a.rawId),
    type: a.type,
    clientExtensionResults: a.getClientExtensionResults ? a.getClientExtensionResults() : {},
    response: {
      clientDataJSON: _pkBufToB64u(a.response.clientDataJSON),
      authenticatorData: _pkBufToB64u(a.response.authenticatorData),
      signature: _pkBufToB64u(a.response.signature),
      userHandle: a.response.userHandle ? _pkBufToB64u(a.response.userHandle) : undefined
    }
  };
  const result = await callPasskey({ action: 'auth_verify', response: payload }, false);
  await _applyPasskeySession(result);
  return true;
}

async function passkeyLoginClick(kind) {
  const emailEl = document.getElementById(kind === 'teacher' ? 'teacherEmail' : 'learnerEmail');
  const email = (emailEl && emailEl.value.trim().toLowerCase()) || '';
  try {
    await doPasskeyLogin(email);
  } catch (e) {
    // NotAllowedError = user dismissed the sheet. Not an error worth shouting about.
    if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return;
    console.error('Passkey login failed:', e);
    showToast(e.message || 'Passkey sign-in failed — use your password');
    try { logError('passkey_login_failed', { message: String(e && e.message || e) }); } catch (_) {}
  }
}

// Enrol the current device. Requires an existing signed-in session — you
// add a passkey to an account you've already proved you own.
async function enrolPasskey(silent) {
  try {
    if (!(await passkeyPlatformAvailable())) {
      if (!silent) showToast('This device does not support Face ID / Touch ID sign-in');
      return false;
    }
    const who = currentTeacher || currentLearner || {};
    const label = _pkDeviceLabel();
    const options = await callPasskey({
      action: 'register_options', display_name: who.name || '', device_label: label
    }, true);
    options.challenge = _pkB64uToBuf(options.challenge);
    options.user.id = _pkB64uToBuf(options.user.id);
    if (options.excludeCredentials && options.excludeCredentials.length) {
      options.excludeCredentials = options.excludeCredentials.map(
        c => Object.assign({}, c, { id: _pkB64uToBuf(c.id) }));
    } else {
      delete options.excludeCredentials;
    }
    const cred = await navigator.credentials.create({ publicKey: options });
    if (!cred) return false;
    const payload = {
      id: cred.id,
      rawId: _pkBufToB64u(cred.rawId),
      type: cred.type,
      clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
      response: {
        clientDataJSON: _pkBufToB64u(cred.response.clientDataJSON),
        attestationObject: _pkBufToB64u(cred.response.attestationObject),
        transports: cred.response.getTransports ? cred.response.getTransports() : undefined
      }
    };
    await callPasskey({ action: 'register_verify', response: payload, device_label: label }, true);
    showToast('Face ID sign-in is set up on this ' + label + ' 🎉');
    try { logQI('passkey_enrolled', { metadata: { device: label } }); } catch (_) {}
    return true;
  } catch (e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return false;
    console.error('Passkey enrol failed:', e);
    if (!silent) showToast(e.message || 'Could not set up Face ID sign-in');
    try { logError('passkey_enrol_failed', { message: String(e && e.message || e) }); } catch (_) {}
    return false;
  }
}

// Adds the "Sign in with Face ID" button to both login modals, and starts
// the iOS autofill-style passkey suggestion if the browser supports it.
async function initPasskeyUI() {
  if (!(await passkeyPlatformAvailable())) return;
  [['learnerPasskeyRow', 'learner'], ['teacherPasskeyRow', 'teacher']].forEach(pair => {
    const row = document.getElementById(pair[0]);
    if (!row || row.dataset.pkReady) return;
    row.dataset.pkReady = '1';
    row.style.display = '';
    row.innerHTML =
      '<button type="button" class="btn btn-outline" style="width:100%;" onclick="passkeyLoginClick(\'' + pair[1] + '\')">' +
      'Sign in with Face ID / Touch ID</button>' +
      '<div style="text-align:center;font-size:12px;color:var(--nhs-grey);margin-top:6px;">' +
      'Set one up after signing in with your password once.</div>';
  });
  // Conditional mediation: the passkey appears as an autofill suggestion on
  // the email field. Silently unsupported on older browsers.
  try {
    if (PublicKeyCredential.isConditionalMediationAvailable &&
        await PublicKeyCredential.isConditionalMediationAvailable()) {
      doPasskeyLogin('', 'conditional').catch(() => {});
    }
  } catch (e) { /* no conditional UI here */ }
}

// Offered once, after a successful password login, when the account has no
// passkey yet. Deliberately a real prompt rather than a toast, because a
// toast can't carry a button.
async function maybeOfferPasskey() {
  try {
    if (!(await passkeyPlatformAvailable())) return;
    if (localStorage.getItem('sst_pk_declined') === '1') return;
    const who = currentTeacher || currentLearner;
    if (!who || !who.email) return;
    const { has } = await callPasskey({ action: 'has_passkeys', email: who.email }, false);
    if (has) return;
    _showPasskeyOffer(_pkDeviceLabel());
  } catch (e) { /* never block login on this */ }
}

function _showPasskeyOffer(label) {
  if (document.getElementById('pkOffer')) return;
  const d = document.createElement('div');
  d.id = 'pkOffer';
  d.style.cssText = 'position:fixed;inset:0;z-index:4000;background:rgba(0,24,60,.55);display:flex;align-items:center;justify-content:center;padding:20px;';
  d.innerHTML =
    '<div style="background:#fff;border-radius:12px;max-width:380px;width:100%;padding:24px;text-align:center;font-family:inherit;">' +
    '<div style="font-size:34px;line-height:1;margin-bottom:10px;">🔐</div>' +
    '<h3 style="margin:0 0 8px;color:var(--nhs-dark-blue);">Skip the password next time?</h3>' +
    '<p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:var(--nhs-grey);">' +
    'Use Face ID or Touch ID on this ' + label + ' to sign in. Your password still works as a backup.</p>' +
    '<button class="btn btn-green" style="width:100%;" id="pkOfferYes">Set up Face ID</button>' +
    '<button class="btn btn-outline" style="width:100%;margin-top:8px;color:var(--nhs-grey);border-color:var(--nhs-pale-grey);" id="pkOfferNo">Not now</button>' +
    '</div>';
  document.body.appendChild(d);
  document.getElementById('pkOfferYes').onclick = async () => {
    d.remove();
    await enrolPasskey(false);
  };
  document.getElementById('pkOfferNo').onclick = () => {
    try { localStorage.setItem('sst_pk_declined', '1'); } catch (e) {}
    d.remove();
  };
}

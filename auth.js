// Southmead Surgical Teaching — auth.js
// Admin authentication, learner authentication, registration, view toggle

// ── Admin Auth ──

async function hashPassword(pwd) {
  const data = new TextEncoder().encode(pwd + 'sst_nbt_2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function doLogin() {
  const user = document.getElementById('loginUser').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value.trim();
  if (!user || !pass) { showToast('Enter username and password'); return; }

  // Demo mode login
  if (user === DEMO_CREDENTIALS.username && pass === DEMO_CREDENTIALS.password) {
    isDemoMode = true;
    currentUser = { id: 0, username: 'demo', name: 'Demo User', role: 'admin' };
    sessionStorage.setItem('sst_user', JSON.stringify(currentUser));
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
    const u = result.user;
    currentUser = { id: u.id, username: u.username, name: u.display_name, role: u.role };
    sessionStorage.setItem('sst_user', JSON.stringify(currentUser));
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
  sessionStorage.removeItem('sst_user');
  sessionStorage.removeItem('sst_learner');
  sessionStorage.removeItem('sst_teacher');
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
  // Activity log only visible to admin role (not managers)
  const logTab = document.getElementById('logTab');
  if (val && currentUser?.role === 'admin') {
    logTab.style.cssText = '';
  } else {
    logTab.style.cssText = 'display:none !important;';
  }
  // QI Dashboard tab — restricted to Suketu only
  const qiDashTab = document.getElementById('qiDashTab');
  if (qiDashTab) {
    const u = (currentUser?.username || '').toLowerCase();
    const isSuketu = val && (u === 'suketu' || u === 'suketubatra');
    qiDashTab.style.cssText = isSuketu ? '' : 'display:none !important;';
  }
  // Auto-link admin to learner + teacher records
  if (val && currentUser) {
    linkAdminToLearner();
    linkAdminToTeacher();
  }
}

async function linkAdminToLearner() {
  if (!currentUser) return;
  // Admin email mapping
  const adminEmails = {
    suketu: 'Suketu.Batra@nbt.nhs.uk',
    ilgin: 'Ilgin.Kilic@nbt.nhs.uk',
    rob: 'rob@nbt.nhs.uk',
    nitin: 'Nitin.Arvind@nbt.nhs.uk'
  };
  const email = (adminEmails[currentUser.username] || (currentUser.username + '@nbt.nhs.uk')).toLowerCase();
  try {
    const data = await sbGet('learners', `email=ilike.${encodeURIComponent(email)}&select=*`);
    if (data.length > 0) {
      currentLearner = data[0];
    } else {
      // Create a learner record for this admin
      const adminPin = String(Math.floor(100000 + Math.random() * 900000));
      const hashedAdminPin = await hashPassword(adminPin);
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
        pin_code: hashedAdminPin,
        contact_id: adminContactId,
        verified: true
      });
      currentLearner = result[0];
    }
    sessionStorage.setItem('sst_learner', JSON.stringify(currentLearner));
    document.body.classList.add('is-learner');
    // Show My Dashboard tab for admins
    updateHeaderButtons();
  } catch(e) {
    console.warn('Could not link admin to learner:', e);
  }
}

async function linkAdminToTeacher() {
  if (!currentUser) return;
  const adminEmails = {
    suketu: 'Suketu.Batra@nbt.nhs.uk',
    ilgin: 'Ilgin.Kilic@nbt.nhs.uk',
    nitin: 'Nitin.Arvind@nbt.nhs.uk'
  };
  const email = (adminEmails[currentUser.username] || '').toLowerCase();
  if (!email) return;
  try {
    const data = await sbGet('contacts', `email=ilike.${encodeURIComponent(email)}&select=*`);
    if (data.length > 0) {
      currentTeacher = data[0];
      sessionStorage.setItem('sst_teacher', JSON.stringify(data[0]));
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
  const stored = sessionStorage.getItem('sst_user');
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
    const learner = result.user;
    currentLearner = learner;
    sessionStorage.setItem('sst_learner', JSON.stringify(currentLearner));
    setLearnerUI(true);
    logQI('learner_login', { metadata: { grade: learner.grade, placement: learner.placement } });
    await linkLearnerToTeacher();
    closeModal('learnerLoginModal');
    showToast('Welcome, ' + learner.name + '!');
    updateHeaderButtons();
    handleLearnerURLParams();
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
    <input type="password" id="setupPin1" placeholder="Enter password" style="margin-bottom:8px;">
    <label>Confirm password</label>
    <input type="password" id="setupPin2" placeholder="Confirm password">
    <label style="margin-top:12px;">Grade</label>
    <select id="setupGrade"><option value="FY1">FY1</option><option value="FY2">FY2</option><option value="CT1">CT1</option><option value="CT2">CT2</option><option value="ST3">ST3</option><option value="ST4">ST4</option><option value="ST5">ST5</option><option value="ST6">ST6</option><option value="ST7">ST7</option><option value="ST8">ST8</option><option value="Registrar">Registrar</option><option value="Consultant">Consultant</option><option value="Other">Other</option></select>
    <label>Placement / Firm</label>
    <select id="setupPlacement"><option value="">-- Select --</option><option value="UGI">UGI</option><option value="LGI / Colorectal">LGI / Colorectal</option><option value="Transplant">Transplant</option><option value="Vascular">Vascular</option><option value="Other">Other</option></select>
    <label>Rotation Block</label>
    <select id="setupRotation" onchange="onSetupRotationChange()"><option value="">-- Select --</option><option value="aug_dec">Aug – Dec</option><option value="dec_apr">Dec – Apr</option><option value="apr_aug">Apr – Aug</option></select>
    <input type="hidden" id="setupStart" value="">
    <input type="hidden" id="setupEnd" value="">
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

  try {
    // Set password via server-side Edge Function
    const authResult = await callAuth({ action: 'setup', type: 'learner', email: document.getElementById('learnerEmail')?.value?.trim()?.toLowerCase() || '', password: pin1 });
    // Update profile fields directly (non-sensitive data)
    const updates = { verified: true, grade, placement, rotation_block: rotation || null };
    if (pStart) updates.placement_start = pStart;
    if (pEnd) updates.placement_end = pEnd;
    await sbUpdate('learners', learnerId, updates);

    currentLearner = { ...authResult.user, ...updates };
    sessionStorage.setItem('sst_learner', JSON.stringify(currentLearner));
    setLearnerUI(true);

    // Show success with PIN reminder
    document.getElementById('learnerLoginForm').innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:36px;margin-bottom:8px;">✅</div>
        <h3 style="color:var(--nhs-green);">Account Set Up!</h3>
        <p style="color:var(--nhs-grey);font-size:13px;margin-top:8px;">Your password has been set. Use it with your email to log in next time.</p>
        <button class="btn btn-green" style="margin-top:16px;" onclick="closeModal('learnerLoginModal');location.reload();">Continue</button>
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
      <input type="password" id="fpNewPin1" placeholder="Enter new password">
      <label>Confirm Password</label>
      <input type="password" id="fpNewPin2" placeholder="Confirm new password">
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

// ── Learner Registration ──

async function doLearnerRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const grade = document.getElementById('regGrade').value;
  const placement = document.getElementById('regPlacement').value;
  const placementStart = document.getElementById('regPlacementStart').value;
  const placementEnd = document.getElementById('regPlacementEnd').value;
  const rotationBlock = document.getElementById('regRotationBlock').value;

  if (!name || !email || !grade || !placement) { showToast('Please fill in all required fields'); return; }
  if (!email.endsWith('@nhs.net') && !email.endsWith('@nbt.nhs.uk')) { showToast('Please use an NHS email (@nhs.net or @nbt.nhs.uk)'); return; }

  // Check for existing learner with same email (case-insensitive)
  const existing = await sbGet('learners', `email=ilike.${encodeURIComponent(email)}&select=*`);
  if (existing.length > 0) {
    showToast('An account with this email already exists. Please log in instead.', 4000);
    return;
  }

  // Generate 6-digit PIN
  const pin = String(Math.floor(100000 + Math.random() * 900000));

  try {
    // Register without password first, then set password server-side
    const result = await sbInsert('learners', {
      name, email, grade, specialty: '', placement,
      placement_start: placementStart || null,
      placement_end: placementEnd || null,
      rotation_block: rotationBlock || null,
      pin_code: null, verified: true
    });
    // Set password server-side
    await callAuth({ action: 'setup', type: 'learner', email, password: pin });
    currentLearner = result[0];
    sessionStorage.setItem('sst_learner', JSON.stringify(currentLearner));
    setLearnerUI(true);
    logQI('learner_register', { metadata: { grade, placement, rotation_block: rotationBlock || null } });

    // Auto-link to contact if email matches
    try {
      const contactMatch = await sbGet('contacts', `email=ilike.${encodeURIComponent(email)}&select=*`);
      if (contactMatch.length > 0) {
        await sbUpdate('learners', currentLearner.id, { contact_id: contactMatch[0].id });
        currentLearner.contact_id = contactMatch[0].id;
        sessionStorage.setItem('sst_learner', JSON.stringify(currentLearner));
      }
    } catch(linkErr) { console.warn('Contact link skipped:', linkErr); }

    // Show PIN
    document.getElementById('learnerLoginForm').style.display = 'none';
    document.getElementById('learnerRegisterForm').style.display = 'none';
    document.getElementById('learnerPinDisplay').style.display = '';
    document.getElementById('generatedPin').textContent = pin;
    document.getElementById('learnerModalTitle').textContent = 'Registration Complete';
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
  sessionStorage.removeItem('sst_learner');
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
}

function checkLearnerSession() {
  const stored = sessionStorage.getItem('sst_learner');
  if (stored) {
    try {
      currentLearner = JSON.parse(stored);
      setLearnerUI(true);
      updateSessionsTabLabel();
    } catch(e) { sessionStorage.removeItem('sst_learner'); }
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
    const teacher = result.user;
    currentTeacher = teacher;
    sessionStorage.setItem('sst_teacher', JSON.stringify(teacher));
    closeModal('teacherLoginModal');
    logQI('teacher_login', { metadata: { specialty: teacher.specialty || null } });
    await linkTeacherToLearner();
    updateHeaderButtons();
    showToast(`Welcome, ${teacher.name}!`);
    switchView('teacherDash');
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
    const teacher = result.user;
    currentTeacher = teacher;
    sessionStorage.setItem('sst_teacher', JSON.stringify(teacher));
    closeModal('teacherLoginModal');
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
    const data = await sbGet('learners', `email=ilike.${encodeURIComponent(email)}&select=*`);
    if (data.length > 0) {
      currentLearner = data[0];
      sessionStorage.setItem('sst_learner', JSON.stringify(currentLearner));
      document.body.classList.add('is-learner');
    }
  } catch(e) { console.warn('Could not link teacher to learner:', e); }
}

async function linkLearnerToTeacher() {
  if (!currentLearner) return;
  const email = currentLearner.email.toLowerCase();
  try {
    const data = await sbGet('contacts', `email=ilike.${encodeURIComponent(email)}&select=*`);
    if (data.length > 0 && data[0].pin_code) {
      currentTeacher = data[0];
      sessionStorage.setItem('sst_teacher', JSON.stringify(data[0]));
    }
  } catch(e) { console.warn('Could not link learner to teacher:', e); }
}

function doTeacherLogout() {
  if (currentTeacher) logQI('teacher_logout');
  currentTeacher = null;
  currentLearner = null;
  sessionStorage.removeItem('sst_teacher');
  sessionStorage.removeItem('sst_learner');
  document.body.classList.remove('is-learner');
  updateHeaderButtons();
  if (currentView === 'teacherDash') switchView('list');
  showToast('Logged out');
}

function checkTeacherSession() {
  const stored = sessionStorage.getItem('sst_teacher');
  if (stored) {
    try {
      currentTeacher = JSON.parse(stored);
      updateHeaderButtons();
    } catch(e) { sessionStorage.removeItem('sst_teacher'); }
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

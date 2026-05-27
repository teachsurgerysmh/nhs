// Southmead Surgical Teaching — auth.js
// v3.7.0 — Email-verified registration + reset. Single unified learner flow.
// Admin authentication, learner authentication, registration, view toggle.

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
    setTimeout(startDemoTour, 1200);
    return;
  }

  try {
    const result = await callAuth({ action: 'login', type: 'admin', username: user, password: pass });
    if (result.access_token) setAuthToken(result.access_token);
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
    if (window.logError) logError('warn','auth_failure','Admin login failed', { username: user, error: e.message });
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
  const logTab = document.getElementById('logTab');
  if (val && currentUser?.role === 'admin') {
    logTab.style.cssText = '';
  } else {
    logTab.style.cssText = 'display:none !important;';
  }
  const errorLogTab = document.getElementById('errorLogTab');
  if (errorLogTab) {
    errorLogTab.style.cssText = (val && currentUser?.role === 'admin') ? '' : 'display:none !important;';
  }
  const qiDashTab = document.getElementById('qiDashTab');
  if (qiDashTab) {
    const u = (currentUser?.username || '').toLowerCase();
    const isSuketu = val && (u === 'suketu' || u === 'suketubatra');
    qiDashTab.style.cssText = isSuketu ? '' : 'display:none !important;';
  }
  if (val && currentUser) {
    linkAdminToLearner();
    linkAdminToTeacher();
  }
}

async function linkAdminToLearner() {
  if (!currentUser) return;
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
    sessionStorage.setItem('sst_learner', JSON.stringify(currentLearner));
    document.body.classList.add('is-learner');
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

  [loginBtn, logoutBtn, learnerLoginBtn, learnerLogoutBtn, teacherLoginBtn, teacherLogoutBtn].forEach(b => { if(b) b.style.display = 'none'; });
  [adminBadge, learnerBadge, teacherBadge].forEach(b => { if(b) b.classList.remove('show'); });
  if (dashboardTab) dashboardTab.style.display = 'none';
  if (teacherDashTab) teacherDashTab.style.display = 'none';

  if (isAdmin) {
    logoutBtn.style.display = '';
    logoutBtn.textContent = 'Admin Logout';
    adminBadge.classList.add('show');
    if (dashboardTab) dashboardTab.style.display = '';
    if (currentTeacher && teacherDashTab) {
      teacherDashTab.style.display = '';
      teacherBadge.classList.add('show');
      teacherBadge.textContent = currentTeacher.name.split(' ').pop();
    }
    if (currentLearner) {
      learnerBadge.classList.add('show');
      learnerBadge.textContent = currentLearner.name.split(' ')[0];
    }
  } else if (currentTeacher) {
    teacherLogoutBtn.style.display = '';
    teacherBadge.classList.add('show');
    teacherBadge.textContent = currentTeacher.name.split(' ').pop();
    if (teacherDashTab) teacherDashTab.style.display = '';
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
  restoreAuthToken();
  const stored = sessionStorage.getItem('sst_user');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      setAdmin(true);
      if (sessionStorage.getItem('sst_demo') === 'true') {
        isDemoMode = true;
        document.getElementById('demoBanner').style.display = 'block';
        document.querySelector('.header').style.top = '36px';
        document.querySelector('.nav-bar').style.top = 'calc(72px + 36px)';
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
  if (window.logInteraction) logInteraction('open_learner_login', {});
}

function showLearnerLoginForm() {
  document.getElementById('learnerLoginForm').style.display = '';
  document.getElementById('learnerRegisterForm').style.display = 'none';
  document.getElementById('learnerPinDisplay').style.display = 'none';
  const fp = document.getElementById('forgotPasswordForm'); if (fp) fp.style.display = 'none';
  const vc = document.getElementById('verifyCodeForm'); if (vc) vc.style.display = 'none';
  const ns = document.getElementById('newSetPasswordForm'); if (ns) ns.style.display = 'none';
  document.getElementById('learnerModalTitle').textContent = 'Learner Login';
}

function showLearnerRegister() {
  document.getElementById('learnerLoginForm').style.display = 'none';
  document.getElementById('learnerRegisterForm').style.display = '';
  document.getElementById('learnerPinDisplay').style.display = 'none';
  const fp = document.getElementById('forgotPasswordForm'); if (fp) fp.style.display = 'none';
  const vc = document.getElementById('verifyCodeForm'); if (vc) vc.style.display = 'none';
  const ns = document.getElementById('newSetPasswordForm'); if (ns) ns.style.display = 'none';
  document.getElementById('learnerModalTitle').textContent = 'Learner Registration';
  if (window.logInteraction) logInteraction('open_learner_register', {});
}

async function doLearnerLogin() {
  const email = document.getElementById('learnerEmail').value.trim().toLowerCase();
  const pin = document.getElementById('learnerPin').value.trim();
  if (!email || !pin) { showToast('Enter email and password'); return; }
  try {
    const result = await callAuth({ action: 'login', type: 'learner', email, password: pin });
    if (result.needs_setup) {
      // Account exists but no password yet — go through verified setup flow
      showToast('Welcome — let\'s verify your email and set a password');
      window._verifyFlow = { mode: 'setup_existing', email, name: result.user?.name || '' };
      await sendVerificationCode(email, 'register');
      return;
    }
    if (result.access_token) setAuthToken(result.access_token);
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
  } catch(e) {
    console.error('Learner login error:', e);
    if (window.logError) logError('warn','auth_failure','Learner login failed', { email, error: e.message, not_found: !!e._notFound });
    // Detect "account not found" → offer to register with email verification
    if (e._notFound || (e.message && /Account not found/i.test(e.message))) {
      offerRegistrationForUnknownEmail(email);
      return;
    }
    showToast(e.message || 'Login failed');
  }
}

// When login finds no account, slide into the registration form pre-filled.
function offerRegistrationForUnknownEmail(email) {
  showLearnerRegister();
  const e = document.getElementById('regEmail'); if (e) e.value = email;
  showToast('No account found — let\'s create one. Fill in your details below.', 4000);
}

// ============================================================
// REGISTRATION VIA EMAIL VERIFICATION
// Step 1: collect profile details → request code
// Step 2: enter 6-digit code from email
// Step 3: set password (atomic create+verify)
// ============================================================
async function doLearnerRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const grade = document.getElementById('regGrade').value;
  const placement = document.getElementById('regPlacement').value;
  const placementStart = document.getElementById('regPlacementStart').value;
  const placementEnd = document.getElementById('regPlacementEnd').value;
  const rotationBlock = document.getElementById('regRotationBlock').value;

  if (!name || !email || !grade || !placement) { showToast('Please fill in all required fields'); return; }
  if (!email.endsWith('@nhs.net') && !email.endsWith('@nbt.nhs.uk')) {
    showToast('Please use an NHS email (@nhs.net or @nbt.nhs.uk)'); return;
  }

  // Stash profile fields — they'll be sent with register_with_code
  window._verifyFlow = {
    mode: 'register_new', email, name, grade, placement,
    placementStart, placementEnd, rotationBlock
  };
  await sendVerificationCode(email, 'register');
}

// Sends the 6-digit code and shifts the modal to the code-entry view.
async function sendVerificationCode(email, purpose) {
  try {
    const result = await callAuth({ action: 'request_email_code', type: 'learner', email, purpose });
    if (result.already_registered) {
      showToast('An account already exists for this email. Please log in instead.', 4000);
      showLearnerLoginForm();
      const f = document.getElementById('learnerEmail'); if (f) f.value = email;
      return;
    }
    logQI('email_code_requested', { actor_type: 'learner', actor_email: email, metadata: { purpose, sent: !!result.sent } });
    if (window.logInteraction) logInteraction('email_code_requested', { email, purpose, sent: !!result.sent });
    showVerifyCodeForm(email, purpose, result.ttl_minutes || 15);
  } catch(e) {
    console.error('Request code failed:', e);
    if (window.logError) logError('warn','auth_failure','Verification code request failed', { email, error: e.message });
    showToast(e.message || 'Could not send verification code. Please try again.');
  }
}

function showVerifyCodeForm(email, purpose, ttlMin) {
  document.getElementById('learnerLoginForm').style.display = 'none';
  document.getElementById('learnerRegisterForm').style.display = 'none';
  document.getElementById('learnerPinDisplay').style.display = 'none';
  const fp = document.getElementById('forgotPasswordForm'); if (fp) fp.style.display = 'none';
  const ns = document.getElementById('newSetPasswordForm'); if (ns) ns.style.display = 'none';
  document.getElementById('learnerModalTitle').textContent =
    purpose === 'reset' ? 'Reset Password — Verify Email' : 'Verify Email';

  let vc = document.getElementById('verifyCodeForm');
  if (!vc) {
    vc = document.createElement('div');
    vc.id = 'verifyCodeForm';
    document.getElementById('learnerModalBody').appendChild(vc);
  }
  vc.style.display = '';
  vc.innerHTML = `
    <div style="background:#e0f5fa;border-left:3px solid var(--nhs-aqua);padding:10px 12px;border-radius:0 6px 6px 0;margin-bottom:14px;font-size:13px;color:#231f20;">
      We've sent a 6-digit code to <strong>${esc(email)}</strong>. It expires in ${ttlMin} minutes.<br>
      Check your inbox (and spam folder).
    </div>
    <label>6-digit code</label>
    <input type="text" id="verifyCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="e.g. 123456" style="font-size:20px;letter-spacing:6px;text-align:center;">
    <div style="margin-top:14px;text-align:center;">
      <button class="btn btn-green" id="verifyCodeBtn" onclick="doVerifyCode()" style="width:100%;">Verify Code</button>
    </div>
    <div style="margin-top:12px;text-align:center;font-size:13px;color:var(--nhs-grey);">
      Didn't receive it? <a href="#" onclick="resendVerificationCode('${esc(email)}','${esc(purpose)}');return false;">Resend code</a>
    </div>
    <div style="margin-top:8px;text-align:center;font-size:12px;color:var(--nhs-grey);">
      <a href="#" onclick="showLearnerLoginForm();return false;">Back to login</a>
    </div>`;
  setTimeout(() => document.getElementById('verifyCode')?.focus(), 100);
}

async function resendVerificationCode(email, purpose) {
  try {
    await callAuth({ action: 'request_email_code', type: 'learner', email, purpose });
    showToast('Code resent. Check your inbox.');
  } catch(e) {
    showToast(e.message || 'Could not resend code');
  }
}

async function doVerifyCode() {
  const flow = window._verifyFlow || {};
  const code = (document.getElementById('verifyCode').value || '').trim();
  if (!code || code.length < 4) { showToast('Enter the 6-digit code'); return; }
  const email = flow.email;
  const purpose = flow.mode === 'reset' ? 'reset' : 'register';
  try {
    const result = await callAuth({ action: 'verify_email_code', type: 'learner', email, code, purpose });
    if (!result.verification_token) { showToast('Could not verify code'); return; }
    flow.verification_token = result.verification_token;
    window._verifyFlow = flow;
    if (window.logInteraction) logInteraction('email_code_verified', { email, purpose });
    showSetPasswordForm(email, purpose);
  } catch(e) {
    if (window.logError) logError('warn','auth_failure','Email code verification failed', { email, error: e.message });
    showToast(e.message || 'Code incorrect or expired');
  }
}

function showSetPasswordForm(email, purpose) {
  const vc = document.getElementById('verifyCodeForm'); if (vc) vc.style.display = 'none';
  document.getElementById('learnerModalTitle').textContent =
    purpose === 'reset' ? 'Reset Password' : 'Set a Password';
  let ns = document.getElementById('newSetPasswordForm');
  if (!ns) {
    ns = document.createElement('div');
    ns.id = 'newSetPasswordForm';
    document.getElementById('learnerModalBody').appendChild(ns);
  }
  ns.style.display = '';
  ns.innerHTML = `
    <div style="background:#e6f4ea;border-left:3px solid var(--nhs-green);padding:10px 12px;border-radius:0 6px 6px 0;margin-bottom:14px;font-size:13px;color:#231f20;">
      ✓ Email verified. Set your password to ${purpose === 'reset' ? 'reset your account' : 'complete sign-up'}.
    </div>
    <label>New password (min 6 characters)</label>
    <input type="password" id="newPwd1" placeholder="Choose a password" autocomplete="new-password">
    <label>Confirm password</label>
    <input type="password" id="newPwd2" placeholder="Re-enter password" autocomplete="new-password">
    <div style="margin-top:14px;text-align:center;">
      <button class="btn btn-green" onclick="doFinishVerifiedFlow()" style="width:100%;">${purpose === 'reset' ? 'Reset Password' : 'Create Account'}</button>
    </div>`;
  setTimeout(() => document.getElementById('newPwd1')?.focus(), 100);
}

async function doFinishVerifiedFlow() {
  const flow = window._verifyFlow || {};
  const p1 = document.getElementById('newPwd1').value.trim();
  const p2 = document.getElementById('newPwd2').value.trim();
  if (!p1 || p1.length < 6) { showToast('Password must be at least 6 characters'); return; }
  if (p1 !== p2) { showToast('Passwords do not match'); return; }
  try {
    if (flow.mode === 'reset') {
      await callAuth({
        action: 'reset_password', type: 'learner',
        email: flow.email, new_password: p1,
        verification_token: flow.verification_token
      });
      logQI('password_reset', { actor_type: 'learner', actor_email: flow.email, metadata: { who: 'learner', verified: true } });
      showToast('Password reset! You can now log in.');
      showLearnerLoginForm();
      const ef = document.getElementById('learnerEmail'); if (ef) ef.value = flow.email;
      window._verifyFlow = null;
      return;
    }
    // register_new OR setup_existing — both use register_with_code
    const payload = {
      action: 'register_with_code', type: 'learner',
      email: flow.email, password: p1,
      verification_token: flow.verification_token,
      name: flow.name, grade: flow.grade, placement: flow.placement,
      placement_start: flow.placementStart || null,
      placement_end: flow.placementEnd || null,
      rotation_block: flow.rotationBlock || null,
    };
    const result = await callAuth(payload);
    if (result.access_token) setAuthToken(result.access_token);
    currentLearner = result.user;
    sessionStorage.setItem('sst_learner', JSON.stringify(currentLearner));
    setLearnerUI(true);
    logQI('learner_register', { metadata: { grade: flow.grade, placement: flow.placement, rotation_block: flow.rotationBlock || null, verified: true } });
    if (window.logInteraction) logInteraction('learner_registered', { email: flow.email });
    closeModal('learnerLoginModal');
    showToast('Welcome, ' + (currentLearner.name || 'colleague') + '! Your account is ready.');
    updateHeaderButtons();
    window._verifyFlow = null;
    handleLearnerURLParams();
  } catch(e) {
    console.error('Finish verified flow failed:', e);
    if (window.logError) logError('error','auth_failure','Verified registration/reset failed', { email: flow.email, mode: flow.mode, error: e.message });
    showToast(e.message || 'Could not complete. Please try again.');
  }
}

// ============================================================
// FORGOT PASSWORD — now via verification code
// ============================================================
function showForgotPassword() {
  document.getElementById('learnerLoginForm').style.display = 'none';
  document.getElementById('learnerRegisterForm').style.display = 'none';
  document.getElementById('learnerPinDisplay').style.display = 'none';
  const vc = document.getElementById('verifyCodeForm'); if (vc) vc.style.display = 'none';
  const ns = document.getElementById('newSetPasswordForm'); if (ns) ns.style.display = 'none';
  document.getElementById('learnerModalTitle').textContent = 'Reset Password';
  let fp = document.getElementById('forgotPasswordForm');
  if (!fp) {
    fp = document.createElement('div');
    fp.id = 'forgotPasswordForm';
    document.getElementById('learnerModalBody').appendChild(fp);
  }
  fp.style.display = '';
  fp.innerHTML = `
    <p style="font-size:13px;color:var(--nhs-grey);margin-bottom:16px;">Enter your NHS email. We'll send a 6-digit verification code so we know it's really you.</p>
    <label>NHS Email</label>
    <input type="email" id="fpEmail" placeholder="name@nhs.net or name@nbt.nhs.uk" autocomplete="email">
    <div style="margin-top:14px;text-align:center;">
      <button class="btn btn-green" id="fpSubmitBtn" onclick="handleForgotPassword()" style="width:100%;">Send Verification Code</button>
    </div>
    <div style="margin-top:12px;text-align:center;font-size:13px;color:var(--nhs-grey);">
      <a href="#" onclick="showLearnerLoginForm();return false;">Back to login</a>
    </div>`;
  setTimeout(() => document.getElementById('fpEmail')?.focus(), 100);
}

async function handleForgotPassword() {
  const email = (document.getElementById('fpEmail').value || '').trim().toLowerCase();
  if (!email) { showToast('Please enter your email'); return; }
  if (!email.endsWith('@nhs.net') && !email.endsWith('@nbt.nhs.uk')) {
    showToast('Please use an NHS email (@nhs.net or @nbt.nhs.uk)'); return;
  }
  window._verifyFlow = { mode: 'reset', email };
  try {
    await callAuth({ action: 'request_email_code', type: 'learner', email, purpose: 'reset' });
    logQI('password_reset_requested', { actor_type: 'learner', actor_email: email });
    if (window.logInteraction) logInteraction('password_reset_requested', { email });
    // Note: response is intentionally identical for known/unknown email (don't leak existence).
    document.getElementById('forgotPasswordForm').style.display = 'none';
    showVerifyCodeForm(email, 'reset', 15);
  } catch(e) {
    if (window.logError) logError('warn','auth_failure','Forgot-password code request failed', { email, error: e.message });
    showToast(e.message || 'Could not send code. Please try again.');
  }
}

// ============================================================
// ADMIN/LEARNER VIEW TOGGLE
// ============================================================
let adminViewAsLearner = false;
function toggleAdminLearnerView() {
  adminViewAsLearner = !adminViewAsLearner;
  if (adminViewAsLearner) {
    document.body.classList.remove('is-admin');
    document.body.classList.add('is-learner');
    document.getElementById('adminBadge').textContent = 'Learner View';
    document.getElementById('adminBadge').style.background = 'var(--nhs-green)';
    document.getElementById('viewToggleBtn').textContent = 'Admin View';
    document.querySelectorAll('.nav-tab[data-view="drafts"], .nav-tab[data-view="all"], .nav-tab[data-view="inbox"], .nav-tab[data-view="approvals"]').forEach(t => t.style.display = 'none');
  } else {
    document.body.classList.add('is-admin');
    document.body.classList.remove('is-learner');
    document.getElementById('adminBadge').textContent = 'Admin';
    document.getElementById('adminBadge').style.background = '';
    document.getElementById('viewToggleBtn').textContent = 'Learner View';
    document.querySelectorAll('.nav-tab[data-view="drafts"], .nav-tab[data-view="all"], .nav-tab[data-view="inbox"], .nav-tab[data-view="approvals"]').forEach(t => t.style.display = '');
  }
  switchView('list');
  renderAll();
}

function onRotationBlockChange() {
  const block = document.getElementById('regRotationBlock').value;
  const startField = document.getElementById('regPlacementStart');
  const endField = document.getElementById('regPlacementEnd');
  if (!block) { startField.removeAttribute('readonly'); endField.removeAttribute('readonly'); return; }
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

function doLearnerLogout() {
  if (currentLearner) logQI('learner_logout');
  currentLearner = null;
  setAuthToken(null);
  sessionStorage.removeItem('sst_learner');
  setLearnerUI(false);
  updateSessionsTabLabel();
  if (currentView === 'dashboard') switchView('list');
  showToast('Learner logged out');
}

function setLearnerUI(loggedIn) {
  document.body.classList.toggle('is-learner', loggedIn);
  updateHeaderButtons();
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
  delete window._pendingAttend;
  delete window._pendingFeedback;
  if (attendId && currentLearner) { markSelfAttendance(parseInt(attendId)); }
  if (feedbackId && currentLearner) { openFeedbackModal(parseInt(feedbackId)); }
}

// ============================================================
// TEACHER AUTH (unchanged from v3.6.10 — teachers are admin-created)
// ============================================================
function openTeacherLoginModal() { showTeacherLoginForm(); openModal('teacherLoginModal'); }
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
    sessionStorage.setItem('sst_teacher', JSON.stringify(teacher));
    closeModal('teacherLoginModal');
    logQI('teacher_login', { metadata: { specialty: teacher.specialty || null } });
    await linkTeacherToLearner();
    updateHeaderButtons();
    showToast(`Welcome, ${teacher.name}!`);
    switchView('teacherDash');
  } catch(e) {
    console.error('Teacher login failed:', e);
    if (window.logError) logError('warn','auth_failure','Teacher login failed', { email, error: e.message });
    showToast(e.message || 'Login failed');
  }
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
    sessionStorage.setItem('sst_teacher', JSON.stringify(teacher));
    closeModal('teacherLoginModal');
    logQI('teacher_setup', { metadata: { specialty: teacher.specialty || null } });
    await linkTeacherToLearner();
    updateHeaderButtons();
    showToast(`Account set up! Welcome, ${teacher.name}!`);
    switchView('teacherDash');
  } catch(e) {
    console.error('Teacher setup failed:', e);
    if (window.logError) logError('warn','auth_failure','Teacher setup failed', { email, error: e.message });
    showToast(e.message || 'Setup failed');
  }
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
  setAuthToken(null);
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
    try { currentTeacher = JSON.parse(stored); updateHeaderButtons(); } catch(e) { sessionStorage.removeItem('sst_teacher'); }
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

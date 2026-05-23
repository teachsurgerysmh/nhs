// Southmead Surgical Teaching — messaging.js
// Email system, WhatsApp, feedback request emails, teacher request emails, inbox

// ===================== EMAIL & WHATSAPP =====================

// ===================== EMAIL =====================
function openEmailModal(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  const to = ev.teacherEmail || '';
  const subject = encodeURIComponent('Teaching Reminder: ' + (ev.topic || 'Session') + ' - ' + ev.day + ' ' + ev.date + ' ' + ev.month);
  const body = encodeURIComponent(
    'Dear ' + (ev.teacher || 'Colleague') + ',\n\nThis is a reminder about your upcoming teaching session:\n\nTopic: ' + (ev.topic || 'TBD') + '\nDate: ' + ev.day + ' ' + ev.date + ' ' + ev.month + ' ' + ev.year + '\nTime: ' + (ev.time || 'TBC') + '\nRoom: ' + (ev.room || 'TBC') + '\n\nPlease confirm your availability.\n\nBest regards,\nSouthmead Surgical Teaching Team'
  );
  document.getElementById('emailBody').innerHTML = `
    <p style="font-size:13px;color:var(--nhs-grey);margin-bottom:10px;">Click the button below to open your email client with a pre-filled reminder.</p>
    <div class="email-preview">To: ${esc(to || '(no email on file)')}\nSubject: Teaching Reminder: ${esc(ev.topic || 'Session')}\n\nDear ${esc(ev.teacher || 'Colleague')},\n\nThis is a reminder about your upcoming teaching session:\n\nTopic: ${esc(ev.topic || 'TBD')}\nDate: ${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}\nTime: ${esc(ev.time || 'TBC')}\nRoom: ${esc(ev.room || 'TBC')}\n\nPlease confirm your availability.\n\nBest regards,\nSouthmead Surgical Teaching Team</div>
    <div style="margin-top:14px;text-align:center;">
      <a href="mailto:${to}?subject=${subject}&body=${body}" class="btn btn-green" style="display:inline-flex;text-decoration:none;color:white;padding:10px 24px;">Open Email Client</a>
    </div>
  `;
  openModal('emailModal');
}

async function sendSessionEmail(id, type) {
  const ev = events.find(e => e.id === id);
  if (!ev) { showToast('Session not found'); return; }
  const to = ev.teacherEmail;
  if (!to) { showToast('No email on file for teacher. Opening email preview instead.'); openEmailModal(id); return; }

  const isConfirm = type === 'confirmation';
  const subject = isConfirm
    ? `Teaching Session Confirmation: ${ev.topic || 'Session'} - ${ev.day} ${ev.date} ${ev.month} ${ev.year}`
    : `Teaching Reminder: ${ev.topic || 'Session'} - ${ev.day} ${ev.date} ${ev.month} ${ev.year}`;

  // Generate action token and links
  const actionToken = btoa(ev.id + ':' + (to || ''));
  const siteUrl = SITE_URL;
  const confirmLink = `${siteUrl}?action=confirm&session=${ev.id}&token=${encodeURIComponent(actionToken)}`;
  const declineLink = `${siteUrl}?action=decline&session=${ev.id}&token=${encodeURIComponent(actionToken)}`;
  const rescheduleLink = `${siteUrl}?action=reschedule&session=${ev.id}&token=${encodeURIComponent(actionToken)}`;

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#003087;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
      <img src="${LOGO_URL}" alt="Southmead Surgical Teaching" style="height:60px;width:auto;margin-bottom:8px;">
      <h2 style="color:white;margin:0;font-size:18px;">Southmead Surgical Teaching</h2>
    </div>
    <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
      <p>Dear ${ev.teacher || 'Colleague'},</p>
      <p>${isConfirm ? 'Thank you for agreeing to teach. Please find the details of your session below:' : 'This is a friendly reminder about your upcoming teaching session:'}</p>
      <table style="margin:16px 0;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Topic:</td><td>${ev.topic || 'TBD'}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Date:</td><td>${ev.day} ${ev.date} ${ev.month} ${ev.year}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Time:</td><td>${ev.time || 'TBC'}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Room:</td><td>${ev.room || 'TBC'}</td></tr>
      </table>
      <p style="margin-bottom:8px;"><strong>Please let us know your availability:</strong></p>
      <div style="margin:20px 0;text-align:center;">
        <a href="${confirmLink}" style="display:inline-block;padding:12px 24px;background:#009639;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;margin:0 6px 8px;">I Can Attend</a>
        <a href="${declineLink}" style="display:inline-block;padding:12px 24px;background:#da291c;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;margin:0 6px 8px;">I Cannot Attend</a>
        <a href="${rescheduleLink}" style="display:inline-block;padding:12px 24px;background:#ed8b00;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;margin:0 6px 8px;">Reschedule</a>
      </div>
      <div style="margin:20px 0;text-align:center;padding:16px;background:#f0f4f5;border-radius:8px;">
        <p style="margin:0 0 8px;font-weight:bold;font-size:14px;">Session Feedback QR Code</p>
        <p style="margin:0 0 12px;font-size:12px;color:#4c6272;">Display at the end of your session for learners to scan and submit feedback</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(SITE_URL + '?feedback=' + ev.id)}" alt="Feedback QR Code" style="width:180px;height:180px;">
        <p style="margin:8px 0 0;font-size:11px;color:#768692;">You can also log in to your Teacher Dashboard to view feedback and generate certificates</p>
      </div>
      ${isConfirm ? '<p>If you have any questions or need to make changes, please reply to this email.</p>' : '<p>If you can no longer attend, please let us know as soon as possible so we can arrange cover.</p>'}
      <p>Best regards,<br>Southmead Surgical Teaching Team</p>
    </div>
  </div>`;

  showToast(`Sending ${type}...`);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'apikey': SUPABASE_KEY
      },
      body: JSON.stringify({ to: [to], subject, html })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`${isConfirm ? 'Confirmation' : 'Reminder'} sent to ${ev.teacher}!`);
      logAction(`Sent ${type} email`, `${ev.topic || 'Session'} → ${ev.teacher}`);
      // Track email in local storage for inbox view
      trackSentEmail(ev.id, to, subject, type, ev.topic, ev.teacher, ev.day + ' ' + ev.date + ' ' + ev.month + ' ' + ev.year);
    } else {
      console.warn('Send failed:', result);
      showToast(`Send failed: ${result.error || 'Unknown error'}. Try email client instead.`);
      openEmailModal(id);
    }
  } catch(e) {
    console.warn('Send error:', e);
    showToast('Send failed. Opening email client...');
    openEmailModal(id);
  }
}

function openBulkEmailModal() {
  const upcoming = events.filter(e => isFutureEvent(e) && e.status === 'upcoming' && e.teacher && e.published);
  const body = document.getElementById('bulkEmailBody');
  if (upcoming.length === 0) {
    body.innerHTML = '<p style="color:var(--nhs-grey);text-align:center;">No upcoming sessions with teachers to remind.</p>';
    openModal('bulkEmailModal'); return;
  }
  let html = '<p style="font-size:13px;color:var(--nhs-grey);margin-bottom:12px;">Upcoming sessions with assigned teachers:</p>';
  upcoming.slice(0, 20).forEach(ev => {
    const to = ev.teacherEmail || '';
    const subject = encodeURIComponent('Teaching Reminder: ' + (ev.topic || 'Session') + ' - ' + ev.day + ' ' + ev.date + ' ' + ev.month);
    const emailBody = encodeURIComponent(
      'Dear ' + (ev.teacher || 'Colleague') + ',\n\nReminder: you have a teaching session on ' + ev.day + ' ' + ev.date + ' ' + ev.month + ' ' + ev.year +
      (ev.time ? ' at ' + ev.time : '') + (ev.room ? ' in ' + ev.room : '') + '.\n\nTopic: ' + (ev.topic || 'TBD') + '\n\nPlease confirm.\n\nBest,\nSurgical Teaching Team'
    );
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--nhs-pale-grey);font-size:13px;">
      <div><strong>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)}</strong> - ${esc(ev.topic || 'TBD')} (${esc(ev.teacher)})</div>
      <a href="mailto:${to}?subject=${subject}&body=${emailBody}" class="btn btn-white" style="font-size:11px;padding:4px 10px;border:1px solid var(--nhs-pale-grey);text-decoration:none;">Email</a>
    </div>`;
  });
  body.innerHTML = html;
  openModal('bulkEmailModal');
}

// ===================== WHATSAPP =====================
function getTeacherPhone(ev) {
  // Try to find phone from contacts data
  const contacts = window._contactsData || [];
  if (ev.teacher) {
    const contact = contacts.find(c => c.name && c.name.toLowerCase() === ev.teacher.toLowerCase());
    if (contact && contact.phone) return contact.phone;
  }
  return null;
}

function openWhatsAppModal(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  const phone = getTeacherPhone(ev);
  const msg = `Dear ${ev.teacher || 'Colleague'},\n\nThis is a reminder about your teaching session:\n\nTopic: ${ev.topic || 'TBD'}\nDate: ${ev.day} ${ev.date} ${ev.month} ${ev.year}\nTime: ${ev.time || 'TBC'}\nRoom: ${ev.room || 'TBC'}\n\nPlease reply YES to confirm or NO if unavailable.\n\nSouthmead Surgical Teaching Team`;

  const body = document.getElementById('whatsappBody');
  body.innerHTML = `
    <div style="background:#ECE5DD;border-radius:8px;padding:16px;margin-bottom:16px;font-size:13px;white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.5;">${esc(msg)}</div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
      <label style="font-size:13px;font-weight:600;white-space:nowrap;">To:</label>
      <span style="font-size:13px;">${esc(ev.teacher || 'Unknown')} ${phone ? '(' + esc(phone) + ')' : '<span style="color:#da291c;">(no phone on file)</span>'}</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
      ${phone ? `<a href="https://wa.me/${normalizePhoneForLink(phone)}?text=${encodeURIComponent(msg)}" target="_blank" class="btn" style="background:#25D366;color:white;border:none;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Open in WhatsApp
      </a>` : '<span style="color:#da291c;font-size:13px;">Add a phone number in Contacts to send WhatsApp messages.</span>'}
      <button class="btn btn-white" style="border:1px solid var(--nhs-pale-grey);color:var(--nhs-grey);font-size:12px;" onclick="copyWhatsAppMsg(this)" data-msg="${esc(msg.replace(/"/g,'&quot;'))}">Copy Message</button>
    </div>
  `;
  openModal('whatsappModal');
}

function copyWhatsAppMsg(btn) {
  const msg = btn.dataset.msg;
  navigator.clipboard.writeText(msg).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Message'; }, 1500);
  });
}

function normalizePhoneForLink(phone) {
  let p = phone.replace(/[\s\-\(\)\+]/g, '');
  if (p.startsWith('07') && p.length === 11) p = '44' + p.substring(1);
  if (p.length === 10 && p.startsWith('7')) p = '44' + p;
  return p;
}

async function sendWhatsAppReminder(id, mode) {
  const ev = events.find(e => e.id === id);
  if (!ev) { showToast('Session not found'); return; }
  const phone = getTeacherPhone(ev);
  if (!phone) { showToast('No phone number on file for this teacher.'); return; }

  const msg = `Dear ${ev.teacher || 'Colleague'},\n\nThis is a reminder about your teaching session:\n\n*Topic:* ${ev.topic || 'TBD'}\n*Date:* ${ev.day} ${ev.date} ${ev.month} ${ev.year}\n*Time:* ${ev.time || 'TBC'}\n*Room:* ${ev.room || 'TBC'}\n\nPlease reply *YES* to confirm or *NO* if unavailable.\n\nSouthmead Surgical Teaching Team`;

  showToast('Sending WhatsApp message...');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY },
      body: JSON.stringify({
        action: 'send_text',
        to: phone,
        text: msg,
        session_id: ev.id,
        to_name: ev.teacher,
        sent_by: currentUser?.name || 'admin'
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`WhatsApp sent to ${ev.teacher}!`);
      logAction('Sent WhatsApp reminder', `${ev.topic || 'Session'} → ${ev.teacher}`);
      closeModal('whatsappModal');
    } else {
      showToast(`WhatsApp failed: ${result.error || result.wa_response?.error?.message || 'Unknown error'}`);
    }
  } catch(e) {
    console.warn('WhatsApp send error:', e);
    showToast('WhatsApp send failed. Check console for details.');
  }
}

function openBulkWhatsAppModal() {
  const upcoming = events.filter(e => isFutureEvent(e) && e.status === 'upcoming' && e.teacher && e.published);
  const body = document.getElementById('bulkWhatsAppBody');
  if (upcoming.length === 0) {
    body.innerHTML = '<p style="color:var(--nhs-grey);text-align:center;padding:20px;">No upcoming sessions with teachers to message.</p>';
    openModal('bulkWhatsAppModal'); return;
  }

  const contacts = window._contactsData || [];
  let withPhone = 0, withoutPhone = 0;
  let html = '<p style="font-size:13px;color:var(--nhs-grey);margin-bottom:12px;">Tap each teacher to open WhatsApp with a pre-filled reminder:</p>';

  upcoming.slice(0, 20).forEach(ev => {
    const contact = contacts.find(c => c.name && c.name.toLowerCase() === (ev.teacher || '').toLowerCase());
    const phone = contact?.phone || null;
    if (phone) withPhone++; else withoutPhone++;
    const phoneDisplay = phone ? esc(phone) : '<span style="color:#da291c;">no phone</span>';
    const msg = `Dear ${ev.teacher || 'Colleague'},\n\nReminder about your teaching session:\n\nTopic: ${ev.topic || 'TBD'}\nDate: ${ev.day} ${ev.date} ${ev.month} ${ev.year}${ev.time ? '\nTime: ' + ev.time : ''}${ev.room ? '\nRoom: ' + ev.room : ''}\n\nPlease reply YES to confirm or NO if unavailable.\n\nSouthmead Surgical Teaching Team`;

    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--nhs-pale-grey);font-size:13px;">
      <div>
        <strong>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)}</strong> - ${esc(ev.topic || 'TBD')}
        <div style="font-size:11px;color:var(--nhs-grey);">${esc(ev.teacher)} &middot; ${phoneDisplay}</div>
      </div>
      ${phone ? `<a href="https://wa.me/${normalizePhoneForLink(phone)}?text=${encodeURIComponent(msg)}" target="_blank" class="btn btn-white" style="font-size:11px;padding:4px 10px;border:1px solid #25D366;color:#25D366;text-decoration:none;">WhatsApp</a>` : '<span style="font-size:11px;color:var(--nhs-pale-grey);">—</span>'}
    </div>`;
  });

  html += `<div style="margin-top:16px;padding:12px;background:#f0faf0;border-radius:8px;font-size:12px;">
    <strong>${withPhone}</strong> teacher${withPhone !== 1 ? 's' : ''} with phone numbers &middot; <strong>${withoutPhone}</strong> without
    <div style="font-size:11px;color:var(--nhs-grey);margin-top:4px;">Each link opens WhatsApp with a pre-filled message. Tap send in WhatsApp to confirm.</div>
  </div>`;

  body.innerHTML = html;
  openModal('bulkWhatsAppModal');
}

async function sendBulkWhatsApp() {
  const upcoming = events.filter(e => isFutureEvent(e) && e.status === 'upcoming' && e.teacher && e.published);
  const contacts = window._contactsData || [];
  const recipients = [];

  for (const ev of upcoming) {
    const contact = contacts.find(c => c.name && c.name.toLowerCase() === (ev.teacher || '').toLowerCase());
    if (contact?.phone) {
      recipients.push({
        phone: contact.phone,
        name: ev.teacher,
        sessionId: ev.id,
        topic: ev.topic,
        dateStr: `${ev.day} ${ev.date} ${ev.month} ${ev.year}`,
        time: ev.time || 'TBC',
        room: ev.room || 'TBC'
      });
    }
  }

  if (recipients.length === 0) { showToast('No teachers with phone numbers found.'); return; }
  showToast(`Sending ${recipients.length} WhatsApp messages...`);

  let sent = 0, failed = 0;
  for (const r of recipients) {
    const msg = `Dear ${r.name},\n\nReminder about your teaching session:\n\n*Topic:* ${r.topic || 'TBD'}\n*Date:* ${r.dateStr}\n*Time:* ${r.time}\n*Room:* ${r.room}\n\nPlease reply *YES* to confirm or *NO* if unavailable.\n\nSouthmead Surgical Teaching Team`;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({
          action: 'send_text', to: r.phone, text: msg,
          session_id: r.sessionId, to_name: r.name, sent_by: currentUser?.name || 'admin'
        })
      });
      const result = await res.json();
      if (result.success) sent++; else failed++;
    } catch(e) { failed++; }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  showToast(`WhatsApp: ${sent} sent, ${failed} failed`);
  logAction('Bulk WhatsApp reminders', `${sent} sent, ${failed} failed`);
  closeModal('bulkWhatsAppModal');
}

// ===================== FEEDBACK REQUEST & TEACHER REQUEST =====================

// ===================== FEEDBACK REQUEST (RETROSPECTIVE) =====================
let fbReqSessionId = null;
let fbReqAttendees = [];

async function openFeedbackRequestModal(sessionId) {
  fbReqSessionId = sessionId;
  const ev = events.find(e => e.id === sessionId);
  if (!ev) { showToast('Session not found'); return; }

  // Generate feedback link — always use SITE_URL so links work from email
  const feedbackUrl = `${SITE_URL}?feedback=${sessionId}`;
  document.getElementById('fbReqLink').value = feedbackUrl;
  document.getElementById('fbReqSessionInfo').innerHTML = `<strong>${esc(ev.topic || 'Session')}</strong><br>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year} | ${esc(ev.teacher || 'TBD')}`;

  // Load contacts and attendance for this session
  let contacts = window._contactsData || [];
  if (!contacts.length) {
    try { contacts = await sbGet('contacts', 'order=name.asc&select=*'); } catch(e) { contacts = []; }
  }
  try {
    const att = await sbGet('attendance', `session_id=eq.${sessionId}&status=neq.removed&select=learner_id`);
    fbReqAttendees = att.map(a => a.learner_id);
  } catch(e) { fbReqAttendees = []; }

  // Also load learners to match attendees to emails and to show as recipients
  let learners = [];
  try { learners = await sbGet('learners', 'select=id,name,email'); } catch(e) {}
  const attendeeEmails = new Set(learners.filter(l => fbReqAttendees.includes(l.id)).map(l => l.email?.toLowerCase()));

  // Build combined list: contacts + registered learners not already in contacts
  const contactEmails = new Set(contacts.map(c => c.email?.toLowerCase()).filter(Boolean));
  const extraLearners = learners.filter(l => l.email && !contactEmails.has(l.email.toLowerCase()));

  // Render contacts list with checkboxes
  let html = '';
  if (extraLearners.length > 0) {
    html += '<div style="font-size:11px;font-weight:600;color:var(--nhs-grey);padding:4px 8px;text-transform:uppercase;letter-spacing:0.5px;">Registered Learners</div>';
    extraLearners.forEach(l => {
      const isAttendee = fbReqAttendees.includes(l.id);
      html += `<label class="fb-req-contact" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;" data-role="Learner" data-name="${esc(l.name?.toLowerCase() || '')}" data-email="${esc(l.email?.toLowerCase() || '')}" data-attended="${isAttendee}">
        <input type="checkbox" class="fb-req-check" value="${esc(l.email)}" style="width:16px;height:16px;">
        <span style="flex:1;">${esc(l.name || l.email)}</span>
        <span style="font-size:11px;color:var(--nhs-grey);">Learner</span>
        ${isAttendee ? '<span style="font-size:10px;background:var(--nhs-green);color:white;padding:2px 6px;border-radius:10px;">attended</span>' : ''}
      </label>`;
    });
    html += '<div style="font-size:11px;font-weight:600;color:var(--nhs-grey);padding:4px 8px;margin-top:8px;text-transform:uppercase;letter-spacing:0.5px;">Contacts</div>';
  }
  contacts.forEach(c => {
    const isAttendee = attendeeEmails.has(c.email?.toLowerCase());
    html += `<label class="fb-req-contact" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;" data-role="${esc(c.role || '')}" data-name="${esc(c.name?.toLowerCase() || '')}" data-email="${esc(c.email?.toLowerCase() || '')}" data-attended="${isAttendee}">
      <input type="checkbox" class="fb-req-check" value="${esc(c.email)}" style="width:16px;height:16px;">
      <span style="flex:1;">${esc(c.name)}</span>
      <span style="font-size:11px;color:var(--nhs-grey);">${esc(c.role || '')}</span>
      ${isAttendee ? '<span style="font-size:10px;background:var(--nhs-green);color:white;padding:2px 6px;border-radius:10px;">attended</span>' : ''}
    </label>`;
  });
  document.getElementById('fbReqContactsList').innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--nhs-grey);">No contacts or learners found. Add contacts in the Contacts tab.</div>';
  document.getElementById('fbReqSearch').value = '';
  updateFbReqCount();

  // Show last reminder info
  let lastSendHtml = '';
  try {
    const sends = await sbGet('feedback_sends', `session_id=eq.${sessionId}&order=sent_at.desc&limit=3&select=*`);
    if (sends.length > 0) {
      const items = sends.map(s => {
        const t = new Date(s.sent_at);
        const methodLabel = s.method === 'auto' ? '🔄 Auto (attendance)' : s.method === 'cron' ? '⏰ Daily reminder' : '✉️ Manual';
        return `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;"><span>${methodLabel}</span><span>${t.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} ${t.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} — ${s.recipient_count} recipient${s.recipient_count!==1?'s':''}</span></div>`;
      }).join('');
      const isToday = new Date(sends[0].sent_at).toDateString() === new Date().toDateString();
      const borderColor = isToday ? '#ed8b00' : '#005eb8';
      lastSendHtml = `<div id="fbReqLastSend" style="background:#fff8e8;border-left:4px solid ${borderColor};padding:10px 14px;margin-bottom:12px;border-radius:0 6px 6px 0;">
        <div style="font-size:12px;font-weight:600;color:#231f20;margin-bottom:4px;">${isToday ? '⚠️ Reminder already sent today' : 'Recent reminders'}</div>
        ${items}
      </div>`;
    }
  } catch(e) { console.warn('Could not load send history:', e); }
  const infoEl = document.getElementById('fbReqSessionInfo');
  const existingBanner = document.getElementById('fbReqLastSend');
  if (existingBanner) existingBanner.remove();
  if (lastSendHtml) infoEl.insertAdjacentHTML('afterend', lastSendHtml);

  openModal('feedbackRequestModal');
}

function fbReqSelectGroup(group) {
  const checks = document.querySelectorAll('.fb-req-check');
  checks.forEach(cb => {
    const label = cb.closest('.fb-req-contact');
    if (group === 'all') { cb.checked = label.style.display !== 'none'; }
    else if (group === 'none') { cb.checked = false; }
    else if (group === 'attended') { cb.checked = label.dataset.attended === 'true' && label.style.display !== 'none'; }
    else { cb.checked = label.dataset.role === group && label.style.display !== 'none'; }
  });
  updateFbReqCount();
}

function filterFbReqContacts() {
  const q = document.getElementById('fbReqSearch').value.toLowerCase();
  document.querySelectorAll('.fb-req-contact').forEach(label => {
    const name = label.dataset.name || '';
    const email = label.dataset.email || '';
    const role = label.dataset.role?.toLowerCase() || '';
    label.style.display = (!q || name.includes(q) || email.includes(q) || role.includes(q)) ? 'flex' : 'none';
  });
}

function updateFbReqCount() {
  const count = document.querySelectorAll('.fb-req-check:checked').length;
  document.getElementById('fbReqSelectedCount').textContent = count;
}
// Attach change listener
document.addEventListener('change', (e) => { if (e.target.classList.contains('fb-req-check')) updateFbReqCount(); });

function getSelectedFbEmails() {
  return Array.from(document.querySelectorAll('.fb-req-check:checked')).map(cb => cb.value).filter(Boolean);
}

function copyFeedbackLink() {
  const link = document.getElementById('fbReqLink').value;
  navigator.clipboard.writeText(link).then(() => showToast('Feedback link copied!')).catch(() => {
    const inp = document.getElementById('fbReqLink'); inp.select(); document.execCommand('copy'); showToast('Link copied!');
  });
}

function copyFeedbackEmails() {
  const emails = getSelectedFbEmails();
  if (!emails.length) { showToast('No recipients selected'); return; }
  navigator.clipboard.writeText(emails.join('; ')).then(() => showToast(`${emails.length} email(s) copied!`)).catch(() => showToast('Failed to copy'));
}

async function sendFeedbackEmails() {
  const emails = getSelectedFbEmails();
  if (!emails.length) { showToast('No recipients selected'); return; }

  // Check if feedback was already sent today for this session
  try {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const existingSends = await sbGet('feedback_sends', `session_id=eq.${fbReqSessionId}&sent_at=gte.${todayStart.toISOString()}&select=*&order=sent_at.desc`);
    if (existingSends.length > 0) {
      const last = existingSends[0];
      const lastTime = new Date(last.sent_at).toLocaleString('en-GB', {hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'});
      const methodLabel = last.method === 'auto' ? 'auto (on attendance)' : last.method === 'cron' ? 'daily reminder (8am)' : 'manual';
      if (!confirm(`⚠️ A feedback reminder was already sent today at ${lastTime} via ${methodLabel} to ${last.recipient_count} recipient(s).\n\nSend again now anyway?`)) {
        showToast('Cancelled — no duplicate sent');
        return;
      }
    }
  } catch(e) { console.warn('Could not check send history:', e); }

  const ev = events.find(e => e.id === fbReqSessionId);
  const topic = ev?.topic || 'Teaching Session';
  const date = ev ? `${ev.day} ${ev.date} ${ev.month} ${ev.year}` : '';
  const link = document.getElementById('fbReqLink').value;
  const subject = `Feedback Request: ${topic} (${date})`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#003087;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
      <img src="${LOGO_URL}" alt="Southmead Surgical Teaching" style="height:60px;width:auto;margin-bottom:8px;">
      <h2 style="color:white;margin:0;font-size:18px;">Southmead Surgical Teaching</h2>
    </div>
    <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
      <p>Hi,</p>
      <p>Please take a moment to provide feedback for the recent teaching session:</p>
      <table style="margin:16px 0;font-size:14px;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Topic:</td><td>${topic}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date:</td><td>${date}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Teacher:</td><td>${ev?.teacher || 'N/A'}</td></tr>
      </table>
      <a href="${link}" style="display:inline-block;background:#009639;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0;">Submit Feedback</a>
      <div style="background:#e6f4ea;border-left:4px solid #009639;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
        <p style="font-size:13px;color:#231f20;margin:0;"><strong>Providing feedback will mark your attendance for this session.</strong> Use this to confirm you attended and help us improve the programme.</p>
      </div>
      <p style="font-size:13px;color:#666;margin-top:12px;">It only takes 2 minutes.</p>
      <p>Thank you,<br>Southmead Surgical Teaching Team</p>
    </div>
  </div>`;

  // Send via Edge Function
  const btn = document.querySelector('#feedbackRequestModal .btn-green');
  const originalText = btn.textContent;
  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'apikey': SUPABASE_KEY
      },
      body: JSON.stringify({ to: emails, subject, html })
    });
    const result = await res.json();
    if (result.success) {
      // Log the send with recipients
      try { await sbInsert('feedback_sends', { session_id: fbReqSessionId, method: 'manual', sent_by: currentUser?.username || currentTeacher?.name || 'unknown', recipient_count: emails.length, recipients: emails.map(e => e.toLowerCase()) }); } catch(le) { console.warn('Log send failed:', le); }
      showToast(`Feedback request sent to ${emails.length} recipient(s)!`);
      closeModal('feedbackRequestModal');
    } else {
      console.warn('Edge function failed:', result);
      const errMsg = result.error || 'Unknown error';
      if (confirm(`Direct send failed: ${errMsg}\n\nWould you like to open your email client instead?`)) {
        sendFeedbackMailto(emails, subject, topic, date, ev, link);
      }
    }
  } catch(e) {
    console.warn('Send failed:', e);
    if (confirm(`Direct send failed: ${e.message}\n\nWould you like to open your email client instead?`)) {
      sendFeedbackMailto(emails, subject, topic, date, ev, link);
    }
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function sendFeedbackMailto(emailsArg, subjectArg, topicArg, dateArg, evArg, linkArg) {
  const emails = emailsArg || getSelectedFbEmails();
  if (!emails.length) { showToast('No recipients selected'); return; }
  const ev = evArg || events.find(e => e.id === fbReqSessionId);
  const topic = topicArg || ev?.topic || 'Teaching Session';
  const date = dateArg || (ev ? `${ev.day} ${ev.date} ${ev.month} ${ev.year}` : '');
  const link = linkArg || document.getElementById('fbReqLink').value;
  const subject = subjectArg || `Feedback Request: ${topic} (${date})`;
  const body = encodeURIComponent(`Hi,\n\nPlease take a moment to provide feedback for the recent teaching session:\n\nTopic: ${topic}\nDate: ${date}\nTeacher: ${ev?.teacher || 'N/A'}\n\nClick here to submit your feedback:\n${link}\n\nIMPORTANT: Providing feedback will mark your attendance for this session. Use this to confirm you attended and help us improve the programme.\n\nIt only takes 2 minutes.\n\nThank you,\nSouthmead Surgical Teaching Team`);
  const bcc = emails.join(',');
  window.open(`mailto:?bcc=${bcc}&subject=${encodeURIComponent(subject)}&body=${body}`, '_self');
  showToast('Opening email client...');
}

// ===================== REQUEST TEACHER =====================
let trSessionId = null;

async function requestTeacherForSession(sessionId) {
  trSessionId = sessionId;
  const ev = events.find(e => e.id === sessionId);
  if (!ev) { showToast('Session not found'); return; }

  document.getElementById('trSessionInfo').innerHTML = `<strong>${esc(ev.topic || 'TBD')}</strong><br>${esc(ev.day)} ${esc(ev.date)} ${esc(ev.month)} ${ev.year}${ev.time ? ' | ' + esc(ev.time) : ''}${ev.room ? ' | ' + esc(ev.room) : ''}`;

  // Load contacts
  let contacts = window._contactsData || [];
  if (!contacts.length) {
    try { contacts = await sbGet('contacts', 'order=name.asc&select=*'); } catch(e) { contacts = []; }
  }

  let html = '';
  contacts.forEach(c => {
    if (!c.email) return; // Skip contacts without email
    html += `<label class="tr-contact" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;" data-role="${esc(c.role || '')}" data-name="${esc(c.name?.toLowerCase() || '')}" data-email="${esc(c.email?.toLowerCase() || '')}">
      <input type="checkbox" class="tr-check" value="${esc(c.email)}" data-contact-name="${esc(c.name || '')}" style="width:16px;height:16px;">
      <span style="flex:1;">${esc(c.name)}</span>
      <span style="font-size:11px;color:var(--nhs-grey);">${esc(c.role || '')}${c.specialty ? ' · ' + esc(c.specialty) : ''}</span>
    </label>`;
  });
  document.getElementById('trContactsList').innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--nhs-grey);">No contacts with email found. Add contacts in the Contacts tab.</div>';
  document.getElementById('trSearch').value = '';
  updateTrCount();
  openModal('teacherRequestModal');
}

function trSelectGroup(group) {
  document.querySelectorAll('.tr-check').forEach(cb => {
    const label = cb.closest('.tr-contact');
    if (group === 'all') { cb.checked = label.style.display !== 'none'; }
    else if (group === 'none') { cb.checked = false; }
    else { cb.checked = label.dataset.role === group && label.style.display !== 'none'; }
  });
  updateTrCount();
}

function filterTrContacts() {
  const q = document.getElementById('trSearch').value.toLowerCase();
  document.querySelectorAll('.tr-contact').forEach(label => {
    const name = label.dataset.name || '';
    const email = label.dataset.email || '';
    const role = label.dataset.role?.toLowerCase() || '';
    label.style.display = (!q || name.includes(q) || email.includes(q) || role.includes(q)) ? 'flex' : 'none';
  });
}

function updateTrCount() {
  const count = document.querySelectorAll('.tr-check:checked').length;
  document.getElementById('trSelectedCount').textContent = count;
}
document.addEventListener('change', (e) => { if (e.target.classList.contains('tr-check')) updateTrCount(); });

async function sendTeacherRequestEmails() {
  const checked = Array.from(document.querySelectorAll('.tr-check:checked'));
  if (!checked.length) { showToast('No recipients selected'); return; }
  const ev = events.find(e => e.id === trSessionId);
  if (!ev) { showToast('Session not found'); return; }

  const recipients = checked.map(cb => ({ email: cb.value, name: cb.dataset.contactName || '' }));
  const topic = ev.topic || 'TBD';
  const dateStr = `${ev.day} ${ev.date} ${ev.month} ${ev.year}`;
  const siteUrl = SITE_URL;

  const btn = document.querySelector('#teacherRequestModal .btn-green');
  const originalText = btn.textContent;
  btn.textContent = 'Sending...';
  btn.disabled = true;

  let sentCount = 0;
  for (const r of recipients) {
    const actionToken = btoa(ev.id + ':' + r.email);
    const confirmLink = `${siteUrl}?action=confirm&session=${ev.id}&token=${encodeURIComponent(actionToken)}`;
    const declineLink = `${siteUrl}?action=decline&session=${ev.id}&token=${encodeURIComponent(actionToken)}`;
    const rescheduleLink = `${siteUrl}?action=reschedule&session=${ev.id}&token=${encodeURIComponent(actionToken)}`;

    const subject = `Teaching Invitation: ${topic} - ${dateStr}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#003087;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <img src="${LOGO_URL}" alt="Southmead Surgical Teaching" style="height:60px;width:auto;margin-bottom:8px;">
        <h2 style="color:white;margin:0;font-size:18px;">Southmead Surgical Teaching</h2>
      </div>
      <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
        <p>Dear ${r.name || 'Colleague'},</p>
        <p>We are looking for a teacher for the following session and would like to invite you:</p>
        <table style="margin:16px 0;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Topic:</td><td>${topic}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Date:</td><td>${dateStr}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Time:</td><td>${ev.time || 'TBC'}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Room:</td><td>${ev.room || 'TBC'}</td></tr>
        </table>
        <p style="margin-bottom:8px;"><strong>Would you be available to teach this session?</strong></p>
        <div style="margin:20px 0;text-align:center;">
          <a href="${confirmLink}" style="display:inline-block;padding:12px 24px;background:#009639;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;margin:0 6px 8px;">I Can Teach</a>
          <a href="${declineLink}" style="display:inline-block;padding:12px 24px;background:#da291c;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;margin:0 6px 8px;">Unable to Attend</a>
          <a href="${rescheduleLink}" style="display:inline-block;padding:12px 24px;background:#ed8b00;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;margin:0 6px 8px;">Suggest Another Date</a>
        </div>
        <p>If you have any questions, please reply to this email or contact <a href="mailto:teachsurgerysmh@gmail.com">teachsurgerysmh@gmail.com</a>.</p>
        <p>Best regards,<br>Southmead Surgical Teaching Team</p>
      </div>
    </div>`;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ to: [r.email], subject, html })
      });
      const result = await res.json();
      if (result.success) sentCount++;
    } catch(e) { console.warn('Send failed for', r.email, e); }
  }

  btn.textContent = originalText;
  btn.disabled = false;

  if (sentCount > 0) {
    showToast(`Teacher invitation sent to ${sentCount} contact(s)!`);
    logAction('Sent teacher request', `${topic} (${dateStr}) → ${sentCount} contacts`);
    closeModal('teacherRequestModal');
  } else {
    showToast('Failed to send invitations. Check email configuration.');
  }
}

// ===================== INBOX =====================

// ===================== INBOX =====================
function trackSentEmail(sessionId, to, subject, type, topic, teacher, dateStr) {
  const entry = {
    sessionId,
    to,
    subject,
    type,
    topic: topic || 'Session',
    teacher: teacher || 'Unknown',
    dateStr,
    sentAt: new Date().toISOString(),
    sentBy: currentUser?.name || 'Admin'
  };
  // Save to localStorage
  const log = JSON.parse(localStorage.getItem('sst_email_log') || '[]');
  log.push(entry);
  if (log.length > 200) log.splice(0, log.length - 200);
  localStorage.setItem('sst_email_log', JSON.stringify(log));
  // Also save to Supabase for cross-device persistence
  try {
    sbInsert('email_log', {
      session_id: sessionId,
      to_email: to,
      subject: subject,
      email_type: type,
      topic: entry.topic,
      teacher: entry.teacher,
      date_str: dateStr,
      sent_by: entry.sentBy
    });
  } catch(e) { console.warn('DB email log failed:', e); }
}

function getEmailLog() {
  return JSON.parse(localStorage.getItem('sst_email_log') || '[]');
}

// Repair UTF-8 strings that were decoded as Latin-1 upstream
// (turns "Ã¢Â€Â"" back into "—", "Ã©" back into "é", etc.)
function fixMojibake(s) {
  if (!s || typeof s !== 'string') return s || '';
  if (!/[Â-Ã]/.test(s)) return s;
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch (e) {
    return s;
  }
}

// Gmail-style thread row helpers
function _inboxAvatarColor(seed) {
  const colors = ['#005eb8','#009639','#ed8b00','#7C2855','#330072','#00a9ce','#003087','#41b6e6','#da291c','#005c8a'];
  const s = String(seed || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}
function _inboxInitials(name) {
  const parts = String(name || '').replace(/[<>"'@.]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function _inboxDateLabel(d) {
  if (!d) return '';
  const date = (d instanceof Date) ? d : new Date(d);
  if (isNaN(date)) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}
function _renderInboxRow(opts) {
  const { onclick, active, unread, name, subject, snippet, date, color } = opts;
  const initials = _inboxInitials(name);
  const bg = color || _inboxAvatarColor(name);
  return `<div class="inbox-thread-item${active?' active':''}${unread?' unread':''}" onclick="${onclick}">
    <div class="inbox-thread-avatar" style="background:${bg};">${esc(initials)}</div>
    <div class="inbox-thread-body">
      <div class="inbox-thread-row1">
        <div class="inbox-thread-from">${esc(name || 'Unknown')}</div>
        <div class="inbox-thread-date">${esc(date || '')}</div>
      </div>
      <div class="inbox-thread-subject">${esc(subject || '(No subject)')}</div>
      ${snippet ? `<div class="inbox-thread-snippet">${esc(snippet)}</div>` : ''}
    </div>
  </div>`;
}
// Show detail pane (mobile single-pane switch)
function _showInboxDetail() {
  const c = document.querySelector('.inbox-container');
  if (c) c.classList.add('show-detail');
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function backToInboxList() {
  const c = document.querySelector('.inbox-container');
  if (c) c.classList.remove('show-detail');
}

async function loadInbox() {
  const container = document.getElementById('inboxView');
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading inbox...</div>';

  // Try fetching real Gmail threads
  let gmailThreads = [];
  let gmailAvailable = false;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/read-inbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ action: 'list', query: 'in:inbox OR in:sent subject:(Teaching OR Surgical OR Reminder OR Confirmation)', maxResults: 30 })
    });
    const data = await res.json();
    if (data.success && data.threads) {
      gmailThreads = data.threads;
      gmailAvailable = true;
    }
  } catch(e) { console.warn('Gmail inbox not available:', e); }

  // Fallback to Supabase email_log (then localStorage) if Gmail not available
  if (!gmailAvailable) {
    let emailLog = [];
    try {
      const dbLog = await sbGet('email_log', 'order=created_at.desc&limit=200&select=*');
      emailLog = dbLog.map(r => ({
        sessionId: r.session_id,
        to: r.to_email,
        subject: r.subject,
        type: r.email_type,
        topic: r.topic || 'Session',
        teacher: r.teacher || 'Unknown',
        dateStr: r.date_str,
        sentAt: r.created_at,
        sentBy: r.sent_by || 'Admin'
      }));
    } catch(e) {
      console.warn('DB email log fetch failed, using localStorage:', e);
      emailLog = getEmailLog();
    }
    const sessionGroups = {};
    emailLog.forEach(entry => {
      const key = entry.sessionId || 'unknown';
      if (!sessionGroups[key]) {
        sessionGroups[key] = { sessionId: entry.sessionId, topic: entry.topic, teacher: entry.teacher, dateStr: entry.dateStr, emails: [] };
      }
      sessionGroups[key].emails.push(entry);
    });
    const groups = Object.values(sessionGroups).sort((a, b) => {
      const lastA = a.emails[a.emails.length - 1]?.sentAt || '';
      const lastB = b.emails[b.emails.length - 1]?.sentAt || '';
      return lastB.localeCompare(lastA);
    });

    let sidebarHtml = '<div class="inbox-sidebar-header">Sent Emails (' + groups.length + ')</div>';
    if (groups.length === 0) {
      sidebarHtml += '<div style="padding:20px;text-align:center;color:var(--nhs-grey);font-size:13px;">No emails sent yet.</div>';
    } else {
      groups.forEach((g, i) => {
        const lastEmail = g.emails[g.emails.length - 1];
        const timeStr = _inboxDateLabel(lastEmail?.sentAt);
        const countTag = g.emails.length > 1 ? ` (${g.emails.length})` : '';
        sidebarHtml += _renderInboxRow({
          onclick: `selectInboxThread(${i})`,
          active: i === 0,
          name: (g.teacher || 'Unknown') + countTag,
          subject: g.topic || '(No subject)',
          snippet: lastEmail?.subject || '',
          date: timeStr
        });
      });
    }
    container.innerHTML = `
      <div class="inbox-notice"><strong>Note:</strong> Gmail inbox reading not yet connected. Showing locally tracked sent emails only. To enable full inbox, re-run the Gmail setup page to grant read access.</div>
      <div class="inbox-container"><div class="inbox-sidebar">${sidebarHtml}</div><div class="inbox-main" id="inboxMain">${groups.length > 0 ? '' : '<div class="inbox-empty">No emails sent yet</div>'}</div></div>`;
    window._inboxGroups = groups;
    window._inboxMode = 'local';
    if (groups.length > 0) selectInboxThread(0);
    return;
  }

  // Fetch WhatsApp log for sidebar
  let waLog = [];
  try {
    waLog = await sbGet('whatsapp_log', 'order=created_at.desc&limit=50&select=*');
  } catch(e) { console.warn('WhatsApp log fetch failed:', e); }

  // Gmail threads available — render them
  let sidebarHtml = '<div class="inbox-sidebar-header">Gmail Inbox (' + gmailThreads.length + ' threads)</div>';
  if (gmailThreads.length === 0) {
    sidebarHtml += '<div style="padding:20px;text-align:center;color:var(--nhs-grey);font-size:13px;">No teaching-related emails found.</div>';
  } else {
    gmailThreads.forEach((t, i) => {
      const firstMsg = t.messages?.[0] || {};
      const lastMsg = t.messages?.[t.messages.length - 1] || firstMsg;
      const subject = fixMojibake(firstMsg.subject) || '(No subject)';
      const from = fixMojibake((lastMsg.from || firstMsg.from || '').replace(/<.*>/, '').trim()) || 'Unknown';
      const snippet = fixMojibake(lastMsg.snippet || firstMsg.snippet || '').slice(0, 110);
      const dateStr = _inboxDateLabel(lastMsg.date || firstMsg.date);
      const unread = t.messages?.some(m => m.labelIds?.includes('UNREAD'));
      const countTag = t.messagesCount > 1 ? ` (${t.messagesCount})` : '';
      sidebarHtml += _renderInboxRow({
        onclick: `selectGmailThread('${t.id}', ${i})`,
        active: i === 0,
        unread,
        name: from + countTag,
        subject,
        snippet,
        date: dateStr
      });
    });
  }

  // Add WhatsApp log to sidebar
  if (waLog.length > 0) {
    sidebarHtml += '<div class="inbox-sidebar-header" style="background:linear-gradient(135deg,#25D366,#128C7E);color:white;margin-top:4px;">WhatsApp (' + waLog.length + ')</div>';
    const waGroups = {};
    waLog.forEach(w => {
      const key = w.to_phone || 'unknown';
      if (!waGroups[key]) waGroups[key] = { phone: w.to_phone, name: w.to_name, messages: [] };
      waGroups[key].messages.push(w);
    });
    Object.values(waGroups).forEach((g, i) => {
      const last = g.messages[0];
      const hasInbound = g.messages.some(m => m.direction === 'inbound');
      const timeStr = _inboxDateLabel(last?.created_at);
      const statusIcon = last?.status === 'read' ? '✓✓' : last?.status === 'delivered' ? '✓✓' : last?.status === 'sent' ? '✓' : last?.status === 'received' ? '↙' : '';
      const countTag = g.messages.length > 1 ? ` (${g.messages.length})` : '';
      sidebarHtml += `<div class="inbox-thread-item" onclick="selectWhatsAppThread('${g.phone}')" data-wa-phone="${g.phone}">
        <div class="inbox-thread-avatar" style="background:#25D366;">${esc(_inboxInitials(g.name || g.phone))}</div>
        <div class="inbox-thread-body">
          <div class="inbox-thread-row1">
            <div class="inbox-thread-from">${esc(g.name || g.phone)}${esc(countTag)}</div>
            <div class="inbox-thread-date">${esc(timeStr)}</div>
          </div>
          <div class="inbox-thread-subject">${statusIcon} ${esc(last?.message_body || g.phone)}</div>
          ${hasInbound ? '<div class="inbox-thread-snippet" style="color:var(--nhs-green);">↙ Replied</div>' : ''}
        </div>
      </div>`;
    });
  }

  container.innerHTML = `
    <div class="inbox-container">
      <div class="inbox-sidebar">${sidebarHtml}</div>
      <div class="inbox-main" id="inboxMain"><div class="inbox-empty">Select a thread to view the conversation</div></div>
    </div>`;

  window._gmailThreads = gmailThreads;
  window._waLog = waLog;
  window._inboxMode = 'gmail';

  if (gmailThreads.length > 0) selectGmailThread(gmailThreads[0].id, 0);
}

async function selectGmailThread(threadId, index) {
  // Update sidebar active state
  document.querySelectorAll('.inbox-thread-item').forEach((el, i) => el.classList.toggle('active', i === index));
  _showInboxDetail();

  const mainEl = document.getElementById('inboxMain');
  mainEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading thread...</div>';

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/read-inbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ action: 'thread', threadId })
    });
    const data = await res.json();

    if (!data.success || !data.messages) {
      mainEl.innerHTML = '<div class="inbox-empty">Failed to load thread</div>';
      return;
    }

    const messages = data.messages;
    const subject = fixMojibake(messages[0]?.subject) || '(No subject)';
    let lastFrom = '';

    let messagesHtml = '';
    messages.forEach(m => {
      const from = fixMojibake((m.from || '').replace(/<.*>/, '').trim());
      const fromEmail = (m.from || '').match(/<(.+?)>/)?.[1] || m.from || '';
      const isSent = fromEmail.toLowerCase().includes('teachsurgerysmh');
      const dateStr = m.date ? new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + new Date(m.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
      lastFrom = isSent ? '' : fromEmail;
      const bodyText = m.body ? fixMojibake(m.body) : esc(fixMojibake(m.snippet));

      messagesHtml += `
        <div class="inbox-message ${isSent ? 'sent' : 'received'}">
          <div class="msg-header">
            <span class="msg-from">${isSent ? 'Sent' : 'From: ' + esc(from)}</span>
            <span class="msg-time">${dateStr}</span>
          </div>
          <div class="msg-body">${bodyText}</div>
        </div>`;
    });

    const replyTo = lastFrom || messages[messages.length - 1]?.from?.match(/<(.+?)>/)?.[1] || '';

    mainEl.innerHTML = `
      <div class="inbox-main-header">
        <button class="inbox-back-btn" onclick="backToInboxList()" aria-label="Back to inbox">←</button>
        <div class="inbox-main-header-text">
          <h4>${esc(subject)}</h4>
          <div class="inbox-meta">${messages.length} message${messages.length !== 1 ? 's' : ''} in thread</div>
        </div>
      </div>
      <div class="inbox-messages">${messagesHtml}</div>
      <div class="inbox-reply-box">
        <textarea id="inboxReplyText" placeholder="Type a reply..."></textarea>
        <div class="inbox-reply-actions">
          <span class="reply-from-label">From: teachsurgerysmh@gmail.com</span>
          <button class="btn btn-green" onclick="sendGmailReply('${esc(replyTo)}', '${esc(subject)}')">Send Reply</button>
        </div>
      </div>`;
  } catch(e) {
    console.error('Load thread error:', e);
    mainEl.innerHTML = '<div class="inbox-empty">Failed to load thread. Check your connection.</div>';
  }
}

function selectWhatsAppThread(phone) {
  // Deselect all threads, select this one
  document.querySelectorAll('.inbox-thread-item').forEach(el => el.classList.remove('active'));
  _showInboxDetail();
  const el = document.querySelector(`[data-wa-phone="${phone}"]`);
  if (el) el.classList.add('active');

  const mainEl = document.getElementById('inboxMain');
  const waLog = window._waLog || [];
  const messages = waLog.filter(w => w.to_phone === phone).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const contactName = messages[0]?.to_name || phone;

  let html = `<div class="inbox-main-header">
    <button class="inbox-back-btn" onclick="backToInboxList()" aria-label="Back to inbox">←</button>
    <div style="width:36px;height:36px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></div>
    <div class="inbox-main-header-text"><strong>${esc(contactName)}</strong><div style="font-size:11px;color:var(--nhs-grey);">${esc(phone)} &middot; WhatsApp</div></div>
  </div>`;

  html += '<div style="padding:16px 20px;background:#ECE5DD;min-height:300px;max-height:500px;overflow-y:auto;">';
  messages.forEach(m => {
    const isOutbound = m.direction === 'outbound';
    const time = m.created_at ? new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    const date = m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    const statusIcon = m.status === 'read' ? '✓✓' : m.status === 'delivered' ? '✓✓' : m.status === 'sent' ? '✓' : '';
    const statusColor = m.status === 'read' ? '#53bdeb' : '#8696a0';

    html += `<div style="display:flex;justify-content:${isOutbound ? 'flex-end' : 'flex-start'};margin-bottom:6px;">
      <div style="max-width:75%;padding:8px 12px;border-radius:8px;background:${isOutbound ? '#dcf8c6' : 'white'};font-size:13px;white-space:pre-wrap;box-shadow:0 1px 1px rgba(0,0,0,.1);position:relative;">
        ${esc(m.message_body || '')}
        <div style="font-size:10px;color:#8696a0;text-align:right;margin-top:4px;">${date} ${time} ${isOutbound ? '<span style="color:' + statusColor + ';">' + statusIcon + '</span>' : ''}</div>
      </div>
    </div>`;
  });
  html += '</div>';

  // Reply box
  html += `<div style="padding:12px 20px;border-top:1px solid var(--nhs-pale-grey);display:flex;gap:8px;align-items:center;">
    <input type="text" id="waReplyText" placeholder="Type a message..." style="flex:1;padding:8px 12px;border:1.5px solid var(--nhs-pale-grey);border-radius:20px;font-size:13px;" onkeydown="if(event.key==='Enter')sendWhatsAppReply('${phone}','${esc(contactName)}')">
    <button class="btn" style="background:#25D366;color:white;border:none;border-radius:50%;width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;" onclick="sendWhatsAppReply('${phone}','${esc(contactName)}')">➤</button>
  </div>`;

  mainEl.innerHTML = html;
}

async function sendWhatsAppReply(phone, name) {
  const input = document.getElementById('waReplyText');
  const text = input?.value?.trim();
  if (!text) { showToast('Please type a message'); return; }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY },
      body: JSON.stringify({
        action: 'send_text', to: phone, text,
        to_name: name, sent_by: currentUser?.name || 'admin'
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast('WhatsApp message sent!');
      input.value = '';
      // Refresh inbox to show new message
      loadInbox();
    } else {
      showToast('Send failed: ' + (result.error || 'Unknown error'));
    }
  } catch(e) {
    showToast('WhatsApp send failed');
  }
}

async function sendGmailReply(toEmail, subject) {
  const replyText = document.getElementById('inboxReplyText')?.value?.trim();
  if (!replyText) { showToast('Please type a message'); return; }
  if (!toEmail) { showToast('No recipient found'); return; }

  const reSubject = subject.startsWith('Re:') ? subject : 'Re: ' + subject;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#003087;padding:16px 20px;border-radius:8px 8px 0 0;text-align:center;">
      <img src="${LOGO_URL}" alt="Southmead Surgical Teaching" style="height:48px;width:auto;margin-bottom:6px;">
      <h3 style="color:white;margin:0;font-size:16px;">Southmead Surgical Teaching</h3>
    </div>
    <div style="padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
      <p>${replyText.replace(/\n/g, '<br>')}</p>
      <p style="color:#768692;font-size:13px;margin-top:16px;">Best regards,<br>Southmead Surgical Teaching Team</p>
    </div>
  </div>`;

  showToast('Sending reply...');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ to: [toEmail], subject: reSubject, html })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Reply sent!');
      document.getElementById('inboxReplyText').value = '';
      logAction('Sent reply email', `${reSubject} → ${toEmail}`);
      setTimeout(() => loadInbox(), 1000);
    } else {
      showToast('Send failed: ' + (result.error || 'Unknown error'));
    }
  } catch(e) {
    console.error('Reply send error:', e);
    showToast('Failed to send reply.');
  }
}

function selectInboxThread(index) {
  const groups = window._inboxGroups || [];
  if (index >= groups.length) return;
  const g = groups[index];

  // Update sidebar active state
  document.querySelectorAll('.inbox-thread-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
  _showInboxDetail();

  const mainEl = document.getElementById('inboxMain');

  let messagesHtml = '';
  g.emails.forEach(email => {
    const sentDate = new Date(email.sentAt);
    const timeStr = sentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
                    sentDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    messagesHtml += `
      <div class="inbox-message sent">
        <div class="msg-header">
          <span class="msg-from">To: ${esc(email.to)} (sent by ${esc(email.sentBy || 'Admin')})</span>
          <span class="msg-time">${timeStr}</span>
        </div>
        <div class="msg-body">
          <strong>${esc(email.type === 'confirmation' ? 'Confirmation' : 'Reminder')}</strong> for "${esc(email.topic)}" on ${esc(email.dateStr || '')}
        </div>
      </div>`;
  });

  // Check for teacher_confirmed status
  const ev = events.find(e => String(e.id) === String(g.sessionId));
  let statusNote = '';
  if (ev) {
    // We can check the field via a fresh fetch but for now show what we have
    statusNote = `<div style="padding:8px 16px;background:#f0f4f5;border-radius:var(--radius);margin-top:8px;font-size:12px;color:var(--nhs-grey);">
      Session status: <strong>${esc(ev.status)}</strong>
    </div>`;
  }

  mainEl.innerHTML = `
    <div class="inbox-main-header">
      <button class="inbox-back-btn" onclick="backToInboxList()" aria-label="Back to inbox">←</button>
      <div class="inbox-main-header-text">
        <h4>${esc(g.topic)}</h4>
        <div class="inbox-meta">${esc(g.teacher)} &middot; ${esc(g.dateStr || '')}</div>
        ${statusNote}
      </div>
    </div>
    <div class="inbox-messages">${messagesHtml}</div>
    <div class="inbox-reply-box">
      <textarea id="inboxReplyText" placeholder="Type a reply to ${esc(g.teacher)}..."></textarea>
      <div class="inbox-reply-actions">
        <span class="reply-from-label">From: teachsurgerysmh@gmail.com</span>
        <button class="btn btn-green" data-sid="${g.sessionId}" data-to="${esc(g.emails[0]?.to || '')}" data-topic="${esc(g.topic)}" onclick="sendInboxReply(+this.dataset.sid, this.dataset.to, this.dataset.topic)">Send Reply</button>
      </div>
    </div>`;
}

async function sendInboxReply(sessionId, toEmail, topic) {
  const replyText = document.getElementById('inboxReplyText')?.value?.trim();
  if (!replyText) { showToast('Please type a message'); return; }
  if (!toEmail) { showToast('No recipient email found'); return; }

  const subject = `Re: Teaching Session - ${topic}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#003087;padding:16px 20px;border-radius:8px 8px 0 0;text-align:center;">
      <img src="${LOGO_URL}" alt="Southmead Surgical Teaching" style="height:48px;width:auto;margin-bottom:6px;">
      <h3 style="color:white;margin:0;font-size:16px;">Southmead Surgical Teaching</h3>
    </div>
    <div style="padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
      <p>${replyText.replace(/\n/g, '<br>')}</p>
      <p style="color:#768692;font-size:13px;margin-top:16px;">Best regards,<br>Southmead Surgical Teaching Team</p>
    </div>
  </div>`;

  showToast('Sending reply...');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'apikey': SUPABASE_KEY
      },
      body: JSON.stringify({ to: [toEmail], subject, html })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Reply sent!');
      trackSentEmail(sessionId, toEmail, subject, 'reply', topic, '', '');
      document.getElementById('inboxReplyText').value = '';
      logAction('Sent reply email', `${topic} → ${toEmail}`);
      // Reload inbox to show the new message
      setTimeout(() => loadInbox(), 500);
    } else {
      showToast('Send failed: ' + (result.error || 'Unknown error'));
    }
  } catch(e) {
    console.error('Reply send error:', e);
    showToast('Failed to send reply. Check your connection.');
  }
}

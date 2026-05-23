// Southmead Surgical Teaching — surveys.js
// QI Baseline Survey System: public survey page, email one-click, admin results

// ===================== SURVEY QUESTION DEFINITIONS =====================
const SURVEY_FORMS = {
  staff: {
    title: 'Previous Teaching Programme Organisers',
    subtitle: 'BEFORE the digital teaching platform was introduced (pre-May 2026)',
    icon: '📋',
    timeEstimate: '5–10 minutes',
    respondentFields: [
      { id: 'name', label: 'Your name', type: 'text', placeholder: 'e.g. Dr John Smith' },
      { id: 'grade', label: 'Your grade at the time', type: 'single',
        options: ['F1','F2','CT1','CT2','ST3','ST4','ST5','ST6','ST7','ST8','JCF','SCF','Consultant','ANP','ACP'] },
      { id: 'period', label: 'Period you managed teaching', type: 'text', placeholder: 'e.g. Aug 2024 – Apr 2025' },
    ],
    sections: [
      { id: 'A', title: 'How Sessions Were Organised', questions: [
        { id: 'A1', text: 'How did you schedule teaching sessions?', type: 'multi',
          options: ['Email to individuals','WhatsApp group','Word of mouth / in person','Noticeboard / poster','Fixed rota at start of block','Spreadsheet / shared doc'], other: true },
        { id: 'A2', text: 'How far in advance were sessions typically arranged?', type: 'single',
          options: ['Day of','1–2 days before','3–7 days before','1–2 weeks before','>2 weeks / term planned'] },
        { id: 'A3', text: 'How did you recruit teachers for sessions?', type: 'multi',
          options: ['Asked in person on ward/in theatre','Individual emails to specific people','Group email or WhatsApp asking who\'s available','Fixed teaching rota assigned at start of block','Relied on people volunteering'], other: true },
        { id: 'A4', text: 'When a teacher cancelled or didn\'t show up, what typically happened?', type: 'multi',
          options: ['Session was cancelled','Last-minute replacement found','I (the organiser) taught the session','Another trainee stepped in','Learners turned up and found out on the day','Session was rescheduled'] },
        { id: 'A5', text: 'What proportion of scheduled sessions actually took place as planned?', type: 'single',
          options: ['<25%','25–50%','50–75%','75–90%','>90%','Don\'t know'] },
        { id: 'A6', text: 'How much time per week did you spend on teaching admin?', type: 'single',
          options: ['<15 min','15–30 min','30–60 min','1–2 hours','>2 hours','Don\'t know'] },
        { id: 'A7', text: 'What were the biggest challenges in managing the programme?', type: 'multi',
          options: ['Getting teachers to commit to sessions','Short-notice cancellations by teachers','Low learner attendance','Clinical duties clashing with teaching time','No data on attendance or feedback','Lack of teaching rooms / booking issues','No handover from previous organiser','Fitting admin around my own clinical work'], other: true },
      ]},
      { id: 'B', title: 'Attendance', questions: [
        { id: 'B1', text: 'Was attendance at teaching formally recorded?', type: 'single',
          options: ['Yes, always','Sometimes','Rarely','Never'] },
        { id: 'B2', text: 'If recorded, how? (tick all that apply)', type: 'multi',
          options: ['Paper sign-in sheet','Spreadsheet (Excel/Google Sheets)','Online form','Not recorded'], other: true },
        { id: 'B3', text: 'Was attendance data reported to anyone?', type: 'single',
          options: ['Yes, routinely','Occasionally','Never','Don\'t know'] },
        { id: 'B4', text: 'What was the typical attendance at a session?', type: 'single',
          options: ['<25% of expected learners','25–50%','50–75%','>75%','Varied hugely','Don\'t know'] },
        { id: 'B5', text: 'Were learners ever held accountable for non-attendance?', type: 'single',
          options: ['Yes','No','Don\'t know'] },
      ]},
      { id: 'C', title: 'Feedback & Quality', questions: [
        { id: 'C1', text: 'Was structured feedback collected from learners after sessions? (tick all that apply)', type: 'multi',
          options: ['Yes, centrally for the programme','Individual teachers collected their own','Occasionally','Never'] },
        { id: 'C2', text: 'If collected, what method was used? (tick all that apply)', type: 'multi',
          options: ['Paper forms','Google Forms / online survey','Verbal feedback only','Not collected'], other: true },
        { id: 'C3', text: 'Was feedback shared with session teachers?', type: 'single',
          options: ['Yes, routinely','Sometimes','Never','N/A'] },
        { id: 'C4', text: 'Was feedback ever used to change anything about the programme?', type: 'single',
          options: ['Yes','No','Don\'t know'] },
        { id: 'C4_detail', text: 'If yes, briefly what changed?', type: 'text', placeholder: 'Optional — what changed based on feedback?', optional: true },
      ]},
      { id: 'D', title: 'Documentation & Handover', questions: [
        { id: 'D1', text: 'Were teaching certificates or CPD evidence provided to learners?', type: 'single',
          options: ['Yes, routinely','On request only','Never'] },
        { id: 'D2', text: 'Were teaching certificates provided to consultants for their appraisals?', type: 'single',
          options: ['Yes, routinely','On request only','Never'] },
        { id: 'D3', text: 'Was there a formal handover when you finished managing the programme?', type: 'single',
          options: ['Yes, detailed handover','Brief/informal handover','No handover','N/A (still in role)'] },
        { id: 'D4', text: 'What records existed that could be handed over?', type: 'multi',
          options: ['Session schedule/timetable','Teacher contact list','Attendance records','Feedback data','None'], other: true },
      ]},
      { id: 'E', title: 'Overall', questions: [
        { id: 'E1', text: 'How effective was the surgical teaching programme during your time?', type: 'scale',
          scaleMin: 1, scaleMax: 10, minLabel: 'Very ineffective', maxLabel: 'Very effective' },
        { id: 'E2', text: 'How administratively burdensome was managing the programme?', type: 'scale',
          scaleMin: 1, scaleMax: 10, minLabel: 'Minimal', maxLabel: 'Extremely burdensome' },
        { id: 'E3', text: 'If you could have had one tool or system to help, what would it have done?', type: 'multi',
          options: ['Automated email reminders to learners','One-click teacher confirmation system','Automatic attendance tracking','Structured feedback collection','Certificate generation','A scheduling dashboard'], other: true },
        { id: 'E4', text: 'Anything else you\'d like to share about the programme before the digital platform?', type: 'text', placeholder: 'Optional — any other thoughts', long: true, optional: true },
      ]},
    ]
  },

  teacher: {
    title: 'Session Teachers',
    subtitle: 'Your experience of teaching coordination BEFORE the digital platform (pre-May 2026)',
    icon: '👨‍🏫',
    timeEstimate: 'under 5 minutes',
    respondentFields: [
      { id: 'name', label: 'Your name', type: 'text', placeholder: 'e.g. Mr Arvind / Dr Smith' },
      { id: 'grade', label: 'Your grade', type: 'single',
        options: ['F1','F2','CT1','CT2','ST3','ST4','ST5','ST6','ST7','ST8','JCF','SCF','Consultant','ANP','ACP'] },
      { id: 'specialty', label: 'Specialty', type: 'single',
        options: ['Upper GI','Lower GI','Transplant','Vascular'], other: true },
      { id: 'sessions_taught', label: 'Approx. sessions taught (last 3 yrs)', type: 'single',
        options: ['1–3','4–10','11–20','>20'] },
    ],
    sections: [
      { id: 'A', title: 'How You Were Contacted', questions: [
        { id: 'A1', text: 'How were you typically asked to teach?', type: 'multi',
          options: ['Asked in person on the ward or in theatre','Individual email','Group email asking for volunteers','WhatsApp message','Fixed rota — I was assigned dates'], other: true },
        { id: 'A2', text: 'How much notice were you usually given before a session?', type: 'single',
          options: ['Day of','1–2 days','3–7 days','1–2 weeks','>2 weeks'] },
        { id: 'A3', text: 'How easy was it to confirm or decline a teaching request?', type: 'single',
          options: ['Very easy','Fairly easy','Somewhat difficult','Very difficult'] },
        { id: 'A3_detail', text: 'If difficult, why?', type: 'text', placeholder: 'Optional', optional: true },
      ]},
      { id: 'B', title: 'Barriers to Teaching', questions: [
        { id: 'B1', text: 'What has prevented you from teaching when you wanted to?', type: 'multi',
          options: ['Theatre list / operating commitments','Clinic commitments','On-call duties','Too short notice','Administrative workload','Request lost in emails','Forgot about the session','No suitable room booked','Nothing — I\'ve always been able to teach when asked'], other: true },
        { id: 'B2', text: 'Have you ever cancelled a session at short notice?', type: 'single',
          options: ['Yes','No'] },
        { id: 'B3', text: 'If yes, what were the reasons? (tick all that apply)', type: 'multi',
          options: ['Emergency case / clinical duty','Forgot','Double-booked','Leave','N/A'] },
      ]},
      { id: 'C', title: 'Feedback on Your Teaching', questions: [
        { id: 'C1', text: 'Have you received structured feedback from learners on your teaching sessions?', type: 'single',
          options: ['Yes, routinely','Occasionally','Rarely','Never'] },
        { id: 'C2', text: 'If you received feedback, was it useful for improving your teaching?', type: 'single',
          options: ['Very useful','Somewhat useful','Not useful','N/A — never received'] },
        { id: 'C3', text: 'Would you value receiving regular anonymous feedback from learners?', type: 'single',
          options: ['Yes, very much','Yes, somewhat','Neutral','No'] },
        { id: 'C4', text: 'Have you ever received a certificate or formal record of your teaching contribution?', type: 'single',
          options: ['Yes','No'] },
      ]},
      { id: 'D', title: 'Overall', questions: [
        { id: 'D1', text: 'How would you rate the overall organisation of surgical teaching at Southmead?', type: 'scale',
          scaleMin: 1, scaleMax: 10, minLabel: 'Very disorganised', maxLabel: 'Very well organised' },
        { id: 'D2', text: 'What one thing would most improve the teaching programme from a teacher\'s perspective?', type: 'multi',
          options: ['More notice before sessions','Easier way to confirm/decline (e.g., one-click email)','Regular feedback on my teaching','Teaching certificates for appraisal','Better coordination of topics to avoid repetition','Protected teaching time in job plans'], other: true },
        { id: 'D3', text: 'Any other comments?', type: 'text', placeholder: 'Optional', long: true, optional: true },
      ]},
    ]
  },

  trainee: {
    title: 'Current & Previous Surgical Trainees',
    subtitle: 'Your experience of teaching BEFORE the digital platform (pre-May 2026)',
    icon: '🩺',
    timeEstimate: 'under 5 minutes',
    respondentFields: [
      { id: 'name', label: 'Your name', type: 'text', placeholder: 'e.g. Dr Jane Doe' },
      { id: 'grade', label: 'Grade during placement', type: 'single',
        options: ['F1','F2','CT1','CT2','ST3','ST4','ST5','ST6','ST7','ST8','JCF','SCF','ANP','ACP'] },
      { id: 'placement', label: 'Surgical placement', type: 'single',
        options: ['Upper GI','Lower GI','Transplant','Vascular'], other: true },
      { id: 'period', label: 'When were you at SMH?', type: 'text', placeholder: 'e.g. Aug 2024 – Dec 2024' },
    ],
    sections: [
      { id: 'A', title: 'Awareness of Teaching', questions: [
        { id: 'A1', text: 'How did you find out about upcoming teaching sessions?', type: 'multi',
          options: ['Email from teaching organiser','WhatsApp group','Word of mouth from colleagues','Noticeboard','Rota/timetable','Didn\'t know sessions were happening'], other: true },
        { id: 'A2', text: 'How much notice did you typically get before a session?', type: 'single',
          options: ['Day of','1–2 days','3–7 days','>1 week','Varied'] },
        { id: 'A3', text: 'Did you receive reminders about upcoming sessions?', type: 'single',
          options: ['Yes, regularly','Occasionally','Rarely','Never'] },
        { id: 'A4', text: 'Were sessions ever cancelled without you being told?', type: 'single',
          options: ['Frequently','Sometimes','Rarely','Never'] },
      ]},
      { id: 'B', title: 'Attendance', questions: [
        { id: 'B1', text: 'What proportion of teaching sessions did you attend?', type: 'single',
          options: ['<25%','25–50%','50–75%','>75%','Don\'t know'] },
        { id: 'B2', text: 'Main reasons you missed sessions?', type: 'multi',
          options: ['On-call / bleeped away','Ward too busy to leave','In theatre or clinic','Didn\'t know it was happening','Annual leave','Topic not relevant to me','Forgot'], other: true },
        { id: 'B3', text: 'Was your attendance formally recorded?', type: 'single',
          options: ['Yes, always','Sometimes','Rarely','Never','Don\'t know'] },
        { id: 'B4', text: 'Were you ever asked why you missed a session?', type: 'single',
          options: ['Yes','No'] },
      ]},
      { id: 'C', title: 'Feedback & Quality', questions: [
        { id: 'C1', text: 'Were you asked to give feedback after teaching sessions?', type: 'single',
          options: ['Yes, routinely','Occasionally','Rarely','Never'] },
        { id: 'C2', text: 'If feedback was collected, how? (tick all that apply)', type: 'multi',
          options: ['Paper form','Online form (Google Forms etc.)','Verbal','Not collected'], other: true },
        { id: 'C3', text: 'Did you feel your feedback made any difference?', type: 'single',
          options: ['Yes','Somewhat','No','N/A — never gave feedback'] },
        { id: 'C4', text: 'Overall quality of surgical teaching during your placement?', type: 'scale',
          scaleMin: 1, scaleMax: 10, minLabel: 'Very poor', maxLabel: 'Excellent' },
      ]},
      { id: 'D', title: 'CPD & Portfolio', questions: [
        { id: 'D1', text: 'Did you receive certificates for attending teaching?', type: 'single',
          options: ['Yes, for every session','Summary certificate at end','On request only','Never'] },
        { id: 'D2', text: 'Were you able to use teaching attendance as portfolio evidence?', type: 'single',
          options: ['Yes, easily','Yes, with difficulty','No','Didn\'t try'] },
      ]},
      { id: 'E', title: 'Overall', questions: [
        { id: 'E1', text: 'What were the biggest barriers to engaging with surgical teaching? (tick all that apply)', type: 'multi',
          options: ['Clinical duties clashing','Not knowing when sessions were happening','Sessions being cancelled','Topics not relevant to my training','No incentive to attend (no tracking, no certificates)'], other: true },
        { id: 'E2', text: 'What would have most improved the teaching experience? (tick all that apply)', type: 'multi',
          options: ['Advance notice of session schedule','Automated reminders','Attendance certificates for portfolio','Ability to give feedback easily','Protected time for teaching','Better variety of topics'], other: true },
        { id: 'E3', text: 'Any other comments?', type: 'text', placeholder: 'Optional', long: true, optional: true },
      ]},
    ]
  }
};

// ===================== SURVEY STATE =====================
let surveyState = {
  formType: null,
  token: null,
  currentSection: -1, // -1 = respondent info, 0+ = sections
  answers: {},         // { questionId: answer }
  saving: false,
};

// ===================== SURVEY TOKEN =====================
function generateSurveyToken() {
  return 'sv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

// ===================== LAUNCH SURVEY =====================
function openSurvey(formType, token) {
  const form = SURVEY_FORMS[formType];
  if (!form) { showToast('Unknown survey type'); return; }
  surveyState = {
    formType,
    token: token || generateSurveyToken(),
    currentSection: -1,
    answers: {},
    saving: false,
  };
  renderSurvey();
  switchView('survey');
  document.querySelector('.nav-bar').style.display = 'none';
}

// ===================== RENDER SURVEY =====================
function renderSurvey() {
  const form = SURVEY_FORMS[surveyState.formType];
  const container = document.getElementById('surveyView');
  const totalSections = form.sections.length + 1; // +1 for respondent info
  const currentIdx = surveyState.currentSection + 1; // -1 becomes 0
  const progress = Math.round((currentIdx / totalSections) * 100);

  let html = `
    <div class="survey-container">
      <div class="survey-header">
        <div style="font-size:32px;margin-bottom:6px;">${form.icon}</div>
        <h2>Pre-Platform Baseline Survey</h2>
        <p>${form.title}</p>
        <p style="opacity:0.9;font-size:12px;margin-top:4px;background:rgba(255,255,255,0.15);display:inline-block;padding:3px 12px;border-radius:12px;">⏪ About your experience BEFORE the teaching website</p>
        <div class="survey-progress">
          <div class="survey-progress-bar" style="width:${progress}%"></div>
        </div>
        <div class="survey-progress-label">${currentIdx} of ${totalSections} sections completed</div>
      </div>
      <div class="survey-body">`;

  if (surveyState.currentSection === -1) {
    // Respondent info section
    html += renderRespondentSection(form);
  } else if (surveyState.currentSection < form.sections.length) {
    // Question sections
    html += renderQuestionSection(form.sections[surveyState.currentSection]);
  } else {
    // Complete
    html += renderSurveyComplete(form);
  }

  html += `</div></div>`;
  container.innerHTML = html;
}

function renderRespondentSection(form) {
  let html = `
    <div class="survey-section">
      <div class="survey-section-header">Your Details</div>
      <div style="font-size:13px;color:var(--nhs-dark-blue);margin-bottom:12px;padding:10px 14px;background:#e0f5fa;border-radius:var(--radius);border-left:3px solid var(--nhs-blue);">
        <strong>Important:</strong> This survey asks about your experience <strong>before</strong> the Southmead Surgical Teaching website was introduced in May 2026. Please answer based on how things worked before the platform.
      </div>
      <p style="font-size:13px;color:var(--nhs-grey);margin-bottom:16px;">All responses are anonymised. This data will be used in a QI project report.</p>`;

  form.respondentFields.forEach(field => {
    const req = !field.optional ? ' <span class="survey-required">*</span>' : '';
    html += `<div class="survey-question" data-field-id="_${field.id}">
      <label class="survey-q-label">${field.label}${req}</label>`;

    if (field.type === 'single' && field.options) {
      html += `<div class="survey-options">`;
      field.options.forEach(opt => {
        const sel = surveyState.answers['_' + field.id] === opt ? 'selected' : '';
        html += `<button class="survey-opt-btn ${sel}" onclick="selectSurveyAnswer('_${field.id}', '${esc(opt)}', 'single', this)">${esc(opt)}</button>`;
      });
      if (field.other) {
        html += `<div class="survey-other-wrap">
          <button class="survey-opt-btn ${(surveyState.answers['_' + field.id] || '').startsWith('Other:') ? 'selected' : ''}" onclick="toggleSurveyOther('_${field.id}', this)">Other</button>
          <input type="text" class="survey-other-input" id="other__${field.id}" placeholder="Please specify..."
            value="${((surveyState.answers['_' + field.id] || '').startsWith('Other:') ? surveyState.answers['_' + field.id].substring(7) : '')}"
            oninput="updateSurveyOther('_${field.id}', this.value)"
            style="display:${(surveyState.answers['_' + field.id] || '').startsWith('Other:') ? 'block' : 'none'}">
        </div>`;
      }
      html += `</div>`;
    } else if (field.type === 'text') {
      html += `<input type="text" class="survey-text-input" placeholder="${esc(field.placeholder || '')}"
        value="${esc(surveyState.answers['_' + field.id] || '')}"
        oninput="surveyState.answers['_${field.id}']=this.value;clearSurveyError('_${field.id}')">`;
    }

    html += `</div>`;
  });

  html += `<div class="survey-nav">
    <div></div>
    <button class="btn btn-green survey-next-btn" onclick="surveyNextSection()">Next Section →</button>
  </div></div>`;
  return html;
}

function renderQuestionSection(section) {
  let html = `
    <div class="survey-section">
      <div class="survey-section-header">Section ${section.id}: ${section.title}</div>`;

  section.questions.forEach(q => {
    const req = !q.optional ? ' <span class="survey-required">*</span>' : '';
    html += `<div class="survey-question" data-q-id="${q.id}">
      <label class="survey-q-label">${q.id}. ${esc(q.text)}${req}</label>`;

    if (q.type === 'single') {
      html += `<div class="survey-options">`;
      q.options.forEach(opt => {
        const sel = surveyState.answers[q.id] === opt ? 'selected' : '';
        html += `<button class="survey-opt-btn ${sel}" onclick="selectSurveyAnswer('${q.id}', '${esc(opt)}', 'single', this)">${esc(opt)}</button>`;
      });
      if (q.other) {
        html += renderOtherInput(q.id);
      }
      html += `</div>`;
    } else if (q.type === 'multi') {
      html += `<div class="survey-options">
        <div style="font-size:11px;color:var(--nhs-grey);margin-bottom:6px;">Tick all that apply</div>`;
      q.options.forEach(opt => {
        const answers = surveyState.answers[q.id] ? surveyState.answers[q.id].split('||') : [];
        const sel = answers.includes(opt) ? 'selected' : '';
        html += `<button class="survey-opt-btn ${sel}" onclick="selectSurveyAnswer('${q.id}', '${esc(opt)}', 'multi', this)">${esc(opt)}</button>`;
      });
      if (q.other) {
        html += renderOtherInput(q.id);
      }
      html += `</div>`;
    } else if (q.type === 'scale') {
      html += `<div class="survey-scale">
        <span class="survey-scale-label">${q.minLabel}</span>
        <div class="survey-scale-btns">`;
      for (let i = q.scaleMin; i <= q.scaleMax; i++) {
        const sel = surveyState.answers[q.id] === String(i) ? 'selected' : '';
        const colorClass = i <= 3 ? 'low' : (i <= 6 ? 'mid' : 'high');
        html += `<button class="scale-btn ${sel} ${sel ? colorClass : ''}" onclick="selectSurveyAnswer('${q.id}', '${i}', 'single', this)">${i}</button>`;
      }
      html += `</div>
        <span class="survey-scale-label">${q.maxLabel}</span>
      </div>`;
    } else if (q.type === 'text') {
      if (q.long) {
        html += `<textarea class="survey-text-area" rows="3" placeholder="${esc(q.placeholder || '')}"
          oninput="surveyState.answers['${q.id}']=this.value;clearSurveyError('${q.id}')">${esc(surveyState.answers[q.id] || '')}</textarea>`;
      } else {
        html += `<input type="text" class="survey-text-input" placeholder="${esc(q.placeholder || '')}"
          value="${esc(surveyState.answers[q.id] || '')}"
          oninput="surveyState.answers['${q.id}']=this.value;clearSurveyError('${q.id}')">`;
      }
    }

    html += `</div>`;
  });

  const form = SURVEY_FORMS[surveyState.formType];
  const isLast = surveyState.currentSection === form.sections.length - 1;

  html += `<div class="survey-nav">
    <button class="btn btn-outline survey-back-btn" style="color:var(--nhs-grey);border-color:var(--nhs-pale-grey);" onclick="surveyPrevSection()">← Back</button>
    <button class="btn ${isLast ? 'btn-green' : 'btn-green'} survey-next-btn" onclick="${isLast ? 'submitSurvey()' : 'surveyNextSection()'}">
      ${isLast ? 'Submit Survey ✓' : 'Next Section →'}
    </button>
  </div></div>`;
  return html;
}

function renderOtherInput(qId) {
  const currentVal = surveyState.answers[qId] || '';
  const multiVals = currentVal.split('||');
  const hasOther = multiVals.some(v => v.startsWith('Other:'));
  const otherText = hasOther ? multiVals.find(v => v.startsWith('Other:')).substring(7) : '';

  return `<div class="survey-other-wrap">
    <button class="survey-opt-btn ${hasOther ? 'selected' : ''}" onclick="toggleSurveyOther('${qId}', this)">Other</button>
    <input type="text" class="survey-other-input" id="other_${qId}" placeholder="Please specify..."
      value="${esc(otherText)}"
      oninput="updateSurveyOther('${qId}', this.value)"
      style="display:${hasOther ? 'block' : 'none'}">
  </div>`;
}

function renderSurveyComplete(form) {
  return `
    <div class="survey-complete">
      <div style="font-size:48px;margin-bottom:12px;">✅</div>
      <h3>Thank You!</h3>
      <p>Your responses have been recorded. All data will be anonymised in any publications or presentations.</p>
      <p style="font-size:13px;color:var(--nhs-grey);margin-top:12px;">Project Lead: Dr Suketu Batra — supervised by Mr Nitin Arvind, Surgical Tutor</p>
      <button class="btn btn-green" style="margin-top:20px;padding:12px 32px;" onclick="closeSurvey()">Close</button>
    </div>`;
}

// ===================== ANSWER HANDLING =====================
function selectSurveyAnswer(qId, value, type, btn) {
  clearSurveyError(qId);
  if (type === 'single') {
    surveyState.answers[qId] = value;
    // Visual: deselect siblings, select this
    btn.parentElement.querySelectorAll('.survey-opt-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    // For scales, add color class
    if (btn.classList.contains('scale-btn')) {
      const num = parseInt(value);
      btn.classList.add(num <= 3 ? 'low' : (num <= 6 ? 'mid' : 'high'));
    }
  } else if (type === 'multi') {
    let current = surveyState.answers[qId] ? surveyState.answers[qId].split('||') : [];
    if (current.includes(value)) {
      current = current.filter(v => v !== value);
      btn.classList.remove('selected');
    } else {
      current.push(value);
      btn.classList.add('selected');
    }
    surveyState.answers[qId] = current.filter(v => v).join('||');
  }
  // Auto-save this answer
  saveSurveyAnswer(qId);
}

function toggleSurveyOther(qId, btn) {
  const input = document.getElementById('other_' + qId) || document.getElementById('other_' + qId.substring(1));
  if (!input) return;
  const isSelected = btn.classList.contains('selected');

  if (isSelected) {
    btn.classList.remove('selected');
    input.style.display = 'none';
    // Remove Other from answer
    let current = (surveyState.answers[qId] || '').split('||');
    current = current.filter(v => !v.startsWith('Other:'));
    surveyState.answers[qId] = current.filter(v => v).join('||');
    saveSurveyAnswer(qId);
  } else {
    btn.classList.add('selected');
    input.style.display = 'block';
    input.focus();
  }
}

function updateSurveyOther(qId, text) {
  let current = (surveyState.answers[qId] || '').split('||');
  current = current.filter(v => !v.startsWith('Other:'));
  if (text.trim()) current.push('Other: ' + text.trim());
  surveyState.answers[qId] = current.filter(v => v).join('||');
  // Debounce save
  clearTimeout(window._surveyOtherTimer);
  window._surveyOtherTimer = setTimeout(() => saveSurveyAnswer(qId), 500);
}

// ===================== SAVE INDIVIDUAL ANSWER =====================
async function saveSurveyAnswer(qId) {
  if (isDemoMode) { showDemoToast('Save survey answer'); return; }
  const answer = surveyState.answers[qId];
  if (!answer) return;

  // Determine grade and placement from respondent fields
  const grade = surveyState.answers['_grade'] || '';
  const placement = surveyState.answers['_placement'] || surveyState.answers['_specialty'] || '';

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/survey_responses`, {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({
        form_type: surveyState.formType,
        respondent_token: surveyState.token,
        question_id: qId,
        answer: answer,
        grade: grade,
        placement: placement,
        source: 'web',
      })
    });
    if (!res.ok) console.warn('Survey save warning:', res.status);
  } catch(e) {
    console.error('Survey save error:', e);
  }
}

// ===================== VALIDATION =====================
function validateCurrentSection() {
  const form = SURVEY_FORMS[surveyState.formType];
  const missing = [];

  if (surveyState.currentSection === -1) {
    // Validate respondent fields
    form.respondentFields.forEach(field => {
      if (field.optional) return;
      const val = surveyState.answers['_' + field.id];
      if (!val || !val.trim()) missing.push('_' + field.id);
    });
  } else if (surveyState.currentSection < form.sections.length) {
    // Validate question section
    const section = form.sections[surveyState.currentSection];
    section.questions.forEach(q => {
      if (q.optional) return;
      const val = surveyState.answers[q.id];
      if (!val || !val.trim()) missing.push(q.id);
    });
  }

  return missing;
}

function showValidationErrors(missingIds) {
  // Clear previous errors
  document.querySelectorAll('.survey-question.error').forEach(el => el.classList.remove('error'));

  // Add error class to missing questions
  missingIds.forEach(id => {
    const el = document.querySelector(`[data-field-id="${id}"], [data-q-id="${id}"]`);
    if (el) el.classList.add('error');
  });

  // Scroll to first error
  const firstError = document.querySelector('.survey-question.error');
  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showToast('Please answer all required questions');
}

function clearSurveyError(qId) {
  const el = document.querySelector(`[data-field-id="${qId}"], [data-q-id="${qId}"]`);
  if (el) el.classList.remove('error');
}

// ===================== NAVIGATION =====================
function surveyNextSection() {
  const form = SURVEY_FORMS[surveyState.formType];

  // Validate current section before advancing
  const missing = validateCurrentSection();
  if (missing.length) {
    showValidationErrors(missing);
    return;
  }

  if (surveyState.currentSection < form.sections.length) {
    // Save all respondent fields if leaving respondent section
    if (surveyState.currentSection === -1) {
      form.respondentFields.forEach(f => {
        if (surveyState.answers['_' + f.id]) saveSurveyAnswer('_' + f.id);
      });
    }
    surveyState.currentSection++;
    renderSurvey();
    window.scrollTo(0, 0);
  }
}

function surveyPrevSection() {
  if (surveyState.currentSection > -1) {
    surveyState.currentSection--;
    renderSurvey();
    window.scrollTo(0, 0);
  }
}

async function submitSurvey() {
  const form = SURVEY_FORMS[surveyState.formType];

  // Validate last section before submitting
  const missing = validateCurrentSection();
  if (missing.length) {
    showValidationErrors(missing);
    return;
  }

  // Save any remaining text fields
  const lastSection = form.sections[form.sections.length - 1];
  lastSection.questions.forEach(q => {
    if ((q.type === 'text') && surveyState.answers[q.id]) {
      saveSurveyAnswer(q.id);
    }
  });

  // Mark completion
  surveyState.currentSection = form.sections.length;
  renderSurvey();
  window.scrollTo(0, 0);
}

function closeSurvey() {
  document.querySelector('.nav-bar').style.display = '';
  switchView(isAdmin ? 'adminDash' : 'list');
}

// ===================== EMAIL ONE-CLICK HANDLER =====================
async function handleSurveyEmailClick() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get('survey_answer')) return false;

  const formType = params.get('form');
  const qId = params.get('q');
  const answer = params.get('a');
  const token = params.get('token');

  if (!formType || !qId || !answer || !token) {
    showActionLanding('Invalid Survey Link', 'This link appears to be invalid. Please use the full survey form instead.', 'error');
    return true;
  }

  // Save this single answer
  if (!isDemoMode) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/survey_responses`, {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          form_type: formType,
          respondent_token: token,
          question_id: qId,
          answer: decodeURIComponent(answer),
          source: 'email',
        })
      });
    } catch(e) { console.error('Email survey save error:', e); }
  }

  // Show confirmation and link to full survey
  const form = SURVEY_FORMS[formType];
  const formTitle = form ? form.title : formType;
  showActionLanding(
    'Answer Recorded!',
    `<p>Thank you — your response has been saved.</p>
     <p style="font-size:13px;color:var(--nhs-grey);margin-top:8px;">Question: <strong>${esc(qId)}</strong><br>Your answer: <strong>${esc(decodeURIComponent(answer))}</strong></p>
     <div style="margin-top:20px;padding:16px;background:var(--nhs-bg);border-radius:8px;text-align:center;">
       <p style="font-size:14px;font-weight:600;color:var(--nhs-dark-blue);margin-bottom:10px;">Want to complete the full survey?</p>
       <p style="font-size:13px;color:var(--nhs-grey);margin-bottom:12px;">It takes ${form ? form.timeEstimate : 'a few minutes'} — mostly tick-box questions.</p>
       <button class="btn btn-green" style="padding:10px 28px;" onclick="document.querySelector('.nav-bar').style.display='none';openSurvey('${formType}','${esc(token)}')">Complete Full Survey</button>
     </div>`,
    'success'
  );
  return true;
}

// ===================== HOMEPAGE CARD =====================
function renderSurveyCard() {
  return `
    <div class="survey-home-card" id="surveyHomeCard">
      <div class="survey-home-card-inner">
        <div style="font-size:24px;">📊</div>
        <div>
          <strong>Pre-Platform Baseline Survey</strong>
          <p style="font-size:12px;color:var(--nhs-grey);margin:2px 0 0;">How did surgical teaching work <strong>before</strong> this website? Help us capture the baseline — takes under 5 minutes.</p>
        </div>
      </div>
      <div class="survey-home-links">
        <button class="btn btn-outline" style="font-size:12px;padding:6px 14px;color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="openSurvey('staff')">Staff/Organiser</button>
        <button class="btn btn-outline" style="font-size:12px;padding:6px 14px;color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="openSurvey('teacher')">Session Teacher</button>
        <button class="btn btn-outline" style="font-size:12px;padding:6px 14px;color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="openSurvey('trainee')">Trainee</button>
      </div>
    </div>`;
}

// ===================== ADMIN RESULTS VIEW =====================
async function renderSurveyResults() {
  const container = document.getElementById('surveyResultsView');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-grey);">Loading survey results...</div>';

  let responses = [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/survey_responses?select=*&order=submitted_at.desc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    responses = await res.json();
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--nhs-red);">Failed to load results.</div>';
    return;
  }

  if (!responses.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;">
        <div style="font-size:36px;margin-bottom:12px;">📊</div>
        <h3 style="color:var(--nhs-dark-blue);">No Survey Responses Yet</h3>
        <p style="color:var(--nhs-grey);font-size:13px;">Share the survey links with staff, teachers, and trainees to start collecting baseline data.</p>
        <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-outline" style="font-size:12px;color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="copySurveyLink('staff')">Copy Staff Link</button>
          <button class="btn btn-outline" style="font-size:12px;color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="copySurveyLink('teacher')">Copy Teacher Link</button>
          <button class="btn btn-outline" style="font-size:12px;color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="copySurveyLink('trainee')">Copy Trainee Link</button>
        </div>
        <button class="btn btn-green" style="font-size:13px;margin-top:16px;padding:10px 24px;" onclick="openSurveyEmailGenerator()">📧 Generate Survey Email</button>
      </div>`;
    return;
  }

  // Group by form type
  const byForm = { staff: [], teacher: [], trainee: [] };
  responses.forEach(r => { if (byForm[r.form_type]) byForm[r.form_type].push(r); });

  // Count unique respondents
  const uniqueRespondents = (arr) => new Set(arr.map(r => r.respondent_token)).size;

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <h3 style="color:var(--nhs-dark-blue);margin:0;">Pre-Platform Baseline Survey Results</h3>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline" style="font-size:12px;color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="copySurveyLink('staff')">Copy Staff Link</button>
        <button class="btn btn-outline" style="font-size:12px;color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="copySurveyLink('teacher')">Copy Teacher Link</button>
        <button class="btn btn-outline" style="font-size:12px;color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="copySurveyLink('trainee')">Copy Trainee Link</button>
        <button class="btn btn-green" style="font-size:12px;" onclick="openSurveyEmailGenerator()">📧 Generate Email</button>
        <button class="btn btn-green" style="font-size:12px;" onclick="exportSurveyCSV()">Export CSV</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
      <div class="stat-card" style="text-align:center;padding:16px;">
        <div class="stat-num">${responses.length}</div>
        <div class="stat-label">Total Answers</div>
      </div>
      <div class="stat-card" style="text-align:center;padding:16px;">
        <div class="stat-num">${uniqueRespondents(responses)}</div>
        <div class="stat-label">Unique Respondents</div>
      </div>
      <div class="stat-card" style="text-align:center;padding:16px;">
        <div class="stat-num">${uniqueRespondents(byForm.staff)}</div>
        <div class="stat-label">Staff Forms</div>
      </div>
      <div class="stat-card" style="text-align:center;padding:16px;">
        <div class="stat-num">${uniqueRespondents(byForm.teacher)}</div>
        <div class="stat-label">Teacher Forms</div>
      </div>
      <div class="stat-card" style="text-align:center;padding:16px;">
        <div class="stat-num">${uniqueRespondents(byForm.trainee)}</div>
        <div class="stat-label">Trainee Forms</div>
      </div>
    </div>`;

  // Show per-question breakdown for each form
  ['staff', 'teacher', 'trainee'].forEach(ft => {
    const form = SURVEY_FORMS[ft];
    const data = byForm[ft];
    if (!data.length) return;

    html += `<div class="survey-results-form">
      <h4 style="color:var(--nhs-dark-blue);margin-bottom:12px;">${form.icon} ${form.title} (${uniqueRespondents(data)} respondents)</h4>`;

    // Group answers by question_id
    const byQ = {};
    data.forEach(r => {
      if (!byQ[r.question_id]) byQ[r.question_id] = [];
      byQ[r.question_id].push(r.answer);
    });

    form.sections.forEach(section => {
      html += `<div style="margin-bottom:16px;">
        <div style="font-weight:600;font-size:13px;color:var(--nhs-blue);margin-bottom:8px;">Section ${section.id}: ${section.title}</div>`;
      section.questions.forEach(q => {
        const answers = byQ[q.id] || [];
        if (!answers.length) return;

        html += `<div style="margin-bottom:12px;padding:10px 14px;background:white;border-radius:var(--radius);border:1px solid var(--nhs-pale-grey);">
          <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${q.id}. ${esc(q.text)}</div>`;

        if (q.type === 'scale') {
          const nums = answers.map(Number).filter(n => !isNaN(n));
          const avg = nums.length ? (nums.reduce((a,b) => a+b, 0) / nums.length).toFixed(1) : '—';
          const med = nums.length ? nums.sort((a,b) => a-b)[Math.floor(nums.length/2)] : '—';
          html += `<div style="font-size:13px;color:var(--nhs-grey);">n=${nums.length} · Mean: <strong>${avg}</strong> · Median: <strong>${med}</strong></div>`;
        } else if (q.type === 'single' || q.type === 'multi') {
          // Tally
          const tally = {};
          answers.forEach(a => {
            const parts = a.split('||');
            parts.forEach(p => { tally[p] = (tally[p] || 0) + 1; });
          });
          const sorted = Object.entries(tally).sort((a,b) => b[1] - a[1]);
          html += `<div style="font-size:12px;">`;
          sorted.forEach(([val, count]) => {
            const pct = answers.length ? Math.round((count / answers.length) * 100) : 0;
            html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
              <div style="width:120px;height:8px;background:var(--nhs-pale-grey);border-radius:4px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:var(--nhs-blue);border-radius:4px;"></div>
              </div>
              <span style="min-width:30px;text-align:right;">${pct}%</span>
              <span>${esc(val)} (${count})</span>
            </div>`;
          });
          html += `</div>`;
        } else {
          // Text answers
          html += `<div style="font-size:12px;color:var(--nhs-grey);">${answers.length} response(s)</div>`;
          answers.slice(0, 5).forEach(a => {
            html += `<div style="font-size:12px;padding:4px 8px;background:var(--nhs-bg);border-radius:4px;margin-top:4px;">"${esc(a)}"</div>`;
          });
          if (answers.length > 5) html += `<div style="font-size:11px;color:var(--nhs-grey);margin-top:4px;">...and ${answers.length - 5} more</div>`;
        }

        html += `</div>`;
      });
      html += `</div>`;
    });

    html += `</div>`;
  });

  container.innerHTML = html;
}

// ===================== UTILITIES =====================
function copySurveyLink(formType) {
  const url = SITE_URL + '?view=survey&type=' + formType;
  navigator.clipboard.writeText(url).then(() => showToast('Survey link copied!'));
}

// ===================== EMAIL GENERATOR =====================
const SURVEY_EMAIL_QUESTIONS = {
  teacher: { id: 'A2', text: 'How much notice were you usually given before a session?',
    options: ['Day of','1–2 days','3–7 days','1–2 weeks','>2 weeks'] },
  trainee: { id: 'B1', text: 'What proportion of teaching sessions did you attend?',
    options: ['<25%','25–50%','50–75%','>75%','Don\'t know'] },
  staff:   { id: 'A5', text: 'What proportion of scheduled sessions actually took place as planned?',
    options: ['<25%','25–50%','50–75%','75–90%','>90%','Don\'t know'] },
};

const SURVEY_CROSS_LINKS = {
  teacher: { text: 'Were you also on a surgical placement as a trainee?', link: 'trainee', label: 'Trainee Survey' },
  trainee: { text: 'Did you also teach any sessions during your time here?', link: 'teacher', label: 'Teacher Survey' },
  staff:   null, // organisers get both links manually
};

function openSurveyEmailGenerator() {
  const modal = document.getElementById('detailModal');
  let html = `
    <div style="max-width:540px;margin:0 auto;">
      <h3 style="color:var(--nhs-dark-blue);margin-bottom:16px;">Generate Survey Email</h3>
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Recipient name</label>
          <input type="text" id="surveyEmailName" class="text-input" placeholder="e.g. Mr Arvind" style="width:100%;">
        </div>
        <div style="flex:1;min-width:160px;">
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Survey type</label>
          <select id="surveyEmailType" class="text-input" style="width:100%;" onchange="previewSurveyEmail()">
            <option value="teacher">Teacher</option>
            <option value="trainee">Trainee</option>
            <option value="staff">Staff / Organiser</option>
          </select>
        </div>
      </div>
      <button class="btn btn-green" style="margin-bottom:16px;" onclick="previewSurveyEmail()">Generate Preview</button>
      <div id="surveyEmailPreview" style="border:1px solid var(--nhs-pale-grey);border-radius:var(--radius);padding:16px;background:white;margin-bottom:12px;font-size:13px;line-height:1.6;display:none;"></div>
      <div id="surveyEmailActions" style="display:none;gap:8px;">
        <button class="btn btn-green" onclick="copySurveyEmailHTML()">Copy HTML</button>
        <button class="btn btn-outline" style="color:var(--nhs-blue);border-color:var(--nhs-blue);" onclick="copySurveyEmailPlain()">Copy Plain Text</button>
      </div>
    </div>`;
  document.getElementById('detailBody').innerHTML = html;
  modal.querySelector('.modal-header h3').textContent = '📧 Survey Email Generator';
  document.getElementById('detailFooter').innerHTML = '';
  openModal('detailModal');
}

function previewSurveyEmail() {
  const name = document.getElementById('surveyEmailName').value.trim() || '[Name]';
  const formType = document.getElementById('surveyEmailType').value;
  const token = generateSurveyToken();
  const form = SURVEY_FORMS[formType];
  const eq = SURVEY_EMAIL_QUESTIONS[formType];
  const cross = SURVEY_CROSS_LINKS[formType];

  // Store token for copy
  window._surveyEmailToken = token;
  window._surveyEmailFormType = formType;
  window._surveyEmailName = name;

  const fullLink = `${SITE_URL}?view=survey&type=${formType}&token=${token}`;

  // Build inline question buttons
  let optionsHtml = eq.options.map(opt => {
    const url = `${SITE_URL}?survey_answer=1&form=${formType}&q=${eq.id}&a=${encodeURIComponent(opt)}&token=${token}`;
    return `<a href="${url}" style="display:inline-block;padding:8px 16px;margin:4px;background:#005eb8;color:white;text-decoration:none;border-radius:20px;font-size:13px;">${opt}</a>`;
  }).join('\n          ');

  let crossHtml = '';
  if (cross) {
    const crossLink = `${SITE_URL}?view=survey&type=${cross.link}`;
    crossHtml = `<p style="font-size:12px;color:#768692;margin-top:16px;padding-top:12px;border-top:1px solid #e8edee;">
      ${cross.text} If so, please also fill the <a href="${crossLink}" style="color:#005eb8;">${cross.label}</a> — it covers a separate set of questions.</p>`;
  } else {
    // Staff get both links
    crossHtml = `<p style="font-size:12px;color:#768692;margin-top:16px;padding-top:12px;border-top:1px solid #e8edee;">
      If you also taught sessions or were on placement as a trainee, please fill those forms too:<br>
      <a href="${SITE_URL}?view=survey&type=teacher" style="color:#005eb8;">Teacher Survey</a> ·
      <a href="${SITE_URL}?view=survey&type=trainee" style="color:#005eb8;">Trainee Survey</a></p>`;
  }

  const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;color:#231f20;line-height:1.6;">
    <p>Hi ${esc(name)},</p>
    <p>As part of a QI project on surgical teaching at Southmead, I'm collecting baseline data on how things worked <strong>before</strong> the teaching website was introduced.</p>
    <p>Quick question to start — <strong>${esc(eq.text)}</strong></p>
    <div style="text-align:center;margin:16px 0;">
      ${optionsHtml}
    </div>
    <p style="font-size:12px;color:#768692;text-align:center;">Just tap one — your answer is saved instantly.</p>
    <div style="margin:20px 0;padding:16px;background:#f0f4f5;border-radius:8px;text-align:center;">
      <p style="font-size:14px;font-weight:600;color:#003087;margin-bottom:8px;">Complete the full survey</p>
      <p style="font-size:12px;color:#768692;margin-bottom:12px;">Mostly tick-box, takes ${form.timeEstimate}.</p>
      <a href="${fullLink}" style="display:inline-block;padding:10px 28px;background:#009639;color:white;text-decoration:none;border-radius:6px;font-weight:600;">Open Full Survey →</a>
    </div>
    <p style="font-size:12px;color:#768692;">All responses are anonymised. This data will be used in a QI project report supervised by Mr Nitin Arvind.</p>
    ${crossHtml}
    <p style="margin-top:16px;">Thanks,<br>Suketu</p>
  </div>`;

  document.getElementById('surveyEmailPreview').innerHTML = emailHtml;
  document.getElementById('surveyEmailPreview').style.display = 'block';
  document.getElementById('surveyEmailActions').style.display = 'flex';
}

function copySurveyEmailHTML() {
  const html = document.getElementById('surveyEmailPreview').innerHTML;
  const blob = new Blob([html], { type: 'text/html' });
  const plainBlob = new Blob([document.getElementById('surveyEmailPreview').innerText], { type: 'text/plain' });
  navigator.clipboard.write([
    new ClipboardItem({
      'text/html': blob,
      'text/plain': plainBlob,
    })
  ]).then(() => showToast('Email copied — paste into Gmail compose'));
}

function copySurveyEmailPlain() {
  const formType = window._surveyEmailFormType;
  const name = window._surveyEmailName || '[Name]';
  const token = window._surveyEmailToken;
  const form = SURVEY_FORMS[formType];
  const eq = SURVEY_EMAIL_QUESTIONS[formType];
  const cross = SURVEY_CROSS_LINKS[formType];
  const fullLink = `${SITE_URL}?view=survey&type=${formType}&token=${token}`;

  let text = `Hi ${name},\n\nAs part of a QI project on surgical teaching at Southmead, I'm collecting baseline data on how things worked before the teaching website was introduced.\n\n`;
  text += `Quick question: ${eq.text}\n\n`;
  eq.options.forEach(opt => {
    text += `→ ${opt}: ${SITE_URL}?survey_answer=1&form=${formType}&q=${eq.id}&a=${encodeURIComponent(opt)}&token=${token}\n`;
  });
  text += `\nFull survey (${form.timeEstimate}, mostly tick-box):\n${fullLink}\n\n`;
  text += `All responses are anonymised. QI report supervised by Mr Nitin Arvind.\n\n`;
  if (cross) {
    text += `${cross.text} If so, also fill: ${SITE_URL}?view=survey&type=${cross.link}\n\n`;
  } else {
    text += `If you also taught sessions or were on placement:\nTeacher: ${SITE_URL}?view=survey&type=teacher\nTrainee: ${SITE_URL}?view=survey&type=trainee\n\n`;
  }
  text += `Thanks,\nSuketu`;

  navigator.clipboard.writeText(text).then(() => showToast('Plain text email copied'));
}

async function exportSurveyCSV() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/survey_responses?select=*&order=submitted_at.asc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const data = await res.json();
    if (!data.length) { showToast('No data to export'); return; }

    const csvHeaders = ['form_type','respondent_token','question_id','answer','grade','placement','source','submitted_at'];
    let csv = csvHeaders.join(',') + '\n';
    data.forEach(r => {
      csv += csvHeaders.map(h => {
        let val = (r[h] || '').toString().replace(/"/g, '""');
        return `"${val}"`;
      }).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qi_survey_responses_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('CSV exported');
  } catch(e) {
    showToast('Export failed');
    console.error(e);
  }
}

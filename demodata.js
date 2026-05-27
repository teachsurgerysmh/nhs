// Southmead Surgical Teaching — demodata.js
// Synthetic data for demo mode. Replaces ALL real DB reads so no real PII is exposed.

const DEMO_CONTACTS = [
  { id: 9001, name: 'Mr James Whitfield', email: 'james.whitfield@nhs.net', phone: '07700 900001', specialty: 'Upper GI', role: 'Consultant', notes: 'Available Tuesdays', pin_code: null, is_manager: false },
  { id: 9002, name: 'Ms Sarah Chen', email: 'sarah.chen@nhs.net', phone: '07700 900002', specialty: 'Colorectal', role: 'Consultant', notes: '', pin_code: null, is_manager: false },
  { id: 9003, name: 'Mr David Okonkwo', email: 'david.okonkwo@nhs.net', phone: '07700 900003', specialty: 'Vascular', role: 'Consultant', notes: 'Prefers afternoons', pin_code: null, is_manager: false },
  { id: 9004, name: 'Ms Priya Sharma', email: 'priya.sharma@nhs.net', phone: '07700 900004', specialty: 'Transplant', role: 'Registrar', notes: '', pin_code: null, is_manager: false },
  { id: 9005, name: 'Mr Tom Bradley', email: 'tom.bradley@nhs.net', phone: '07700 900005', specialty: 'Upper GI', role: 'Registrar', notes: '', pin_code: null, is_manager: false },
  { id: 9006, name: 'Ms Rachel Foster', email: 'rachel.foster@nhs.net', phone: '07700 900006', specialty: 'Colorectal', role: 'Consultant', notes: 'On sabbatical Jul-Aug', pin_code: null, is_manager: true },
  { id: 9007, name: 'Mr Ahmed Hassan', email: 'ahmed.hassan@nhs.net', phone: '07700 900007', specialty: 'Breast', role: 'Consultant', notes: '', pin_code: null, is_manager: false },
  { id: 9008, name: 'Ms Emily Watson', email: 'emily.watson@nhs.net', phone: '07700 900008', specialty: 'Endocrine', role: 'Registrar', notes: '', pin_code: null, is_manager: false },
];

const DEMO_LEARNERS = [
  { id: 8001, name: 'Dr Alex Morgan', email: 'alex.morgan@nbt.nhs.uk', grade: 'FY1', placement: 'UGI', pin_code: 'set', contact_id: null, placement_start: '2026-04-01', placement_end: '2026-08-31', rotation_block: 'apr_aug', verified: true },
  { id: 8002, name: 'Dr Beth Taylor', email: 'beth.taylor@nbt.nhs.uk', grade: 'FY1', placement: 'LGI', pin_code: 'set', contact_id: null, placement_start: '2026-04-01', placement_end: '2026-08-31', rotation_block: 'apr_aug', verified: true },
  { id: 8003, name: 'Dr Chris Patel', email: 'chris.patel@nbt.nhs.uk', grade: 'FY2', placement: 'Vascular', pin_code: 'set', contact_id: null, placement_start: '2026-04-01', placement_end: '2026-08-31', rotation_block: 'apr_aug', verified: true },
  { id: 8004, name: 'Dr Diana Reyes', email: 'diana.reyes@nbt.nhs.uk', grade: 'FY2', placement: 'Transplant', pin_code: 'set', contact_id: null, placement_start: '2026-04-01', placement_end: '2026-08-31', rotation_block: 'apr_aug', verified: true },
  { id: 8005, name: 'Dr Ethan Brooks', email: 'ethan.brooks@nbt.nhs.uk', grade: 'FY1', placement: 'UGI', pin_code: 'set', contact_id: null, placement_start: '2026-04-01', placement_end: '2026-08-31', rotation_block: 'apr_aug', verified: true },
  { id: 8006, name: 'Dr Fatima Ali', email: 'fatima.ali@nbt.nhs.uk', grade: 'CT1', placement: 'LGI', pin_code: 'set', contact_id: null, placement_start: '2026-04-01', placement_end: '2026-08-31', rotation_block: 'apr_aug', verified: true },
  { id: 8007, name: 'Dr George Kim', email: 'george.kim@nbt.nhs.uk', grade: 'FY1', placement: 'UGI', pin_code: 'set', contact_id: null, placement_start: '2025-12-01', placement_end: '2026-04-30', rotation_block: 'dec_apr', verified: true },
  { id: 8008, name: 'Dr Hannah Lewis', email: 'hannah.lewis@nbt.nhs.uk', grade: 'FY2', placement: 'Vascular', pin_code: 'set', contact_id: null, placement_start: '2025-12-01', placement_end: '2026-04-30', rotation_block: 'dec_apr', verified: true },
];

const DEMO_SCHEDULE = [
  { id: 7001, event_id: 'DEMO-001', day: 'Tues', date: '6th', month: 'May', year: 2026, time: '0800-0900', room: 'Seacole L2', topic: 'Acute Abdomen Assessment', teacher: 'Mr James Whitfield', teacher_email: 'james.whitfield@nhs.net', status: 'completed', published: true, notes: '', backup_teacher: '', backup_teacher_email: '', last_edit_by: 'admin', last_edit_at: '2026-05-06' },
  { id: 7002, event_id: 'DEMO-002', day: 'Tues', date: '13th', month: 'May', year: 2026, time: '0800-0900', room: 'Seacole L2', topic: 'Hernias: Diagnosis & Management', teacher: 'Ms Sarah Chen', teacher_email: 'sarah.chen@nhs.net', status: 'completed', published: true, notes: '', backup_teacher: 'Mr Tom Bradley', backup_teacher_email: 'tom.bradley@nhs.net', last_edit_by: 'admin', last_edit_at: '2026-05-13' },
  { id: 7003, event_id: 'DEMO-003', day: 'Tues', date: '20th', month: 'May', year: 2026, time: '0800-0900', room: 'Seacole L2', topic: 'Peripheral Vascular Disease', teacher: 'Mr David Okonkwo', teacher_email: 'david.okonkwo@nhs.net', status: 'completed', published: true, notes: 'Great turnout', backup_teacher: '', backup_teacher_email: '', last_edit_by: 'admin', last_edit_at: '2026-05-20' },
  { id: 7004, event_id: 'DEMO-004', day: 'Tues', date: '27th', month: 'May', year: 2026, time: '0800-0900', room: 'Seacole L2', topic: 'Renal Transplant Basics', teacher: 'Ms Priya Sharma', teacher_email: 'priya.sharma@nhs.net', status: 'upcoming', published: true, notes: '', backup_teacher: '', backup_teacher_email: '', last_edit_by: 'admin', last_edit_at: '2026-05-25' },
  { id: 7005, event_id: 'DEMO-005', day: 'Tues', date: '3rd', month: 'June', year: 2026, time: '0800-0900', room: 'Seacole L2', topic: 'Breast Lumps: A Systematic Approach', teacher: 'Mr Ahmed Hassan', teacher_email: 'ahmed.hassan@nhs.net', status: 'upcoming', published: true, notes: '', backup_teacher: '', backup_teacher_email: '', last_edit_by: 'admin', last_edit_at: '2026-05-26' },
  { id: 7006, event_id: 'DEMO-006', day: 'Tues', date: '10th', month: 'June', year: 2026, time: '0800-0900', room: 'Seacole L2', topic: 'Thyroid Surgery & Complications', teacher: 'Ms Emily Watson', teacher_email: 'emily.watson@nhs.net', status: 'upcoming', published: true, notes: '', backup_teacher: '', backup_teacher_email: '', last_edit_by: '', last_edit_at: '' },
  { id: 7007, event_id: 'DEMO-007', day: 'Tues', date: '17th', month: 'June', year: 2026, time: '0800-0900', room: 'Seacole L2', topic: 'TBD', teacher: '', teacher_email: '', status: 'tbd', published: true, notes: 'Need to find a teacher', backup_teacher: '', backup_teacher_email: '', last_edit_by: '', last_edit_at: '' },
  { id: 7008, event_id: 'DEMO-008', day: 'Tues', date: '24th', month: 'June', year: 2026, time: '0800-0900', room: 'Seacole L2', topic: 'Colorectal Cancer Screening', teacher: 'Ms Rachel Foster', teacher_email: 'rachel.foster@nhs.net', status: 'upcoming', published: true, notes: '', backup_teacher: 'Ms Sarah Chen', backup_teacher_email: 'sarah.chen@nhs.net', last_edit_by: '', last_edit_at: '' },
  { id: 7009, event_id: 'DEMO-009', day: 'Wed', date: '28th', month: 'May', year: 2026, time: '1300-1330', room: 'Gate 36', topic: 'Suturing Skills Workshop', teacher: 'Mr Tom Bradley', teacher_email: 'tom.bradley@nhs.net', status: 'upcoming', published: true, notes: 'Bring suture kits', backup_teacher: '', backup_teacher_email: '', last_edit_by: '', last_edit_at: '' },
  { id: 7010, event_id: 'DEMO-010', day: 'Tues', date: '29th', month: 'April', year: 2026, time: '0800-0900', room: 'Seacole L2', topic: 'Gallstone Disease', teacher: 'Mr James Whitfield', teacher_email: 'james.whitfield@nhs.net', status: 'completed', published: true, notes: '', backup_teacher: '', backup_teacher_email: '', last_edit_by: 'admin', last_edit_at: '2026-04-29' },
  // Unpublished draft
  { id: 7011, event_id: 'DEMO-011', day: 'Tues', date: '1st', month: 'July', year: 2026, time: '0800-0900', room: 'TBC', topic: 'Trauma & Orthopaedics Overview', teacher: '', teacher_email: '', status: 'tbd', published: false, notes: 'Planning for next month', backup_teacher: '', backup_teacher_email: '', last_edit_by: '', last_edit_at: '' },
  // Cancelled
  { id: 7012, event_id: 'DEMO-012', day: 'Tues', date: '22nd', month: 'April', year: 2026, time: '0800-0900', room: 'Seacole L2', topic: 'Abdominal Aortic Aneurysm', teacher: 'Mr David Okonkwo', teacher_email: 'david.okonkwo@nhs.net', status: 'cancelled', published: true, notes: 'Teacher unavailable — bank holiday week', backup_teacher: '', backup_teacher_email: '', last_edit_by: 'admin', last_edit_at: '2026-04-20' },
];

// Generate attendance for completed sessions
const DEMO_ATTENDANCE = [];
const completedDemoSessions = DEMO_SCHEDULE.filter(s => s.status === 'completed');
let attId = 6001;
completedDemoSessions.forEach(session => {
  // Random 4-6 learners attended each session
  const shuffled = [...DEMO_LEARNERS].sort(() => Math.random() - 0.5);
  const count = 4 + Math.floor(Math.random() * 3);
  shuffled.slice(0, count).forEach(learner => {
    DEMO_ATTENDANCE.push({
      id: attId++,
      session_id: session.id,
      learner_id: learner.id,
      learner_name: learner.name,
      learner_email: learner.email,
      status: 'approved',
      created_at: session.last_edit_at + 'T08:30:00Z',
      contact_id: learner.contact_id
    });
  });
});

// Generate feedback for completed sessions
const DEMO_FEEDBACK = [];
let fbId = 5001;
const goodComments = [
  'Really clear explanation of the key concepts.',
  'Excellent case-based approach, very practical.',
  'Good use of imaging to illustrate points.',
  'Would have liked more time for questions.',
  'Very relevant to our clinical practice.',
  'The interactive element was great.',
  'Well paced and informative session.',
];
const improveComments = [
  'Could include more hands-on practice.',
  'Slides were a bit text-heavy.',
  'Would benefit from a handout or summary sheet.',
  'More clinical scenarios would help.',
  'Nothing specific — great session.',
  'Perhaps a pre-reading list would be helpful.',
  '',
];
DEMO_ATTENDANCE.forEach(att => {
  if (Math.random() > 0.3) { // ~70% feedback rate
    DEMO_FEEDBACK.push({
      id: fbId++,
      session_id: att.session_id,
      learner_id: att.learner_id,
      content_useful: 6 + Math.floor(Math.random() * 5),
      structured: 6 + Math.floor(Math.random() * 5),
      overall: 7 + Math.floor(Math.random() * 4),
      presentation: 6 + Math.floor(Math.random() * 5),
      delivery: 7 + Math.floor(Math.random() * 4),
      applicable: 6 + Math.floor(Math.random() * 5),
      good_aspects: goodComments[Math.floor(Math.random() * goodComments.length)],
      improve_aspects: improveComments[Math.floor(Math.random() * improveComments.length)],
      anonymous: Math.random() > 0.5,
      created_at: att.created_at,
    });
  }
});

const DEMO_IDEAS = [
  { id: 4001, category: 'Core Topics (Tuesday)', topic: 'Emergency Laparotomy', assigned_to: 'Mr James Whitfield', created_at: '2026-05-01T10:00:00Z' },
  { id: 4002, category: 'Core Topics (Tuesday)', topic: 'Bowel Obstruction Management', assigned_to: '', created_at: '2026-05-05T14:00:00Z' },
  { id: 4003, category: 'Clinical Skills (Wednesday)', topic: 'Chest Drain Insertion', assigned_to: 'Ms Priya Sharma', created_at: '2026-05-08T09:00:00Z' },
  { id: 4004, category: 'Junior Doctor Requests', topic: 'MRCS Exam Tips', assigned_to: '', created_at: '2026-05-15T11:00:00Z' },
  { id: 4005, category: 'General Ideas', topic: 'Surgical Audit & QI Projects', assigned_to: '', created_at: '2026-05-20T16:00:00Z' },
];

const DEMO_REQUESTS = [
  { id: 3001, name: 'Dr Alex Morgan', email: 'alex.morgan@nbt.nhs.uk', phone: '', topic: 'Appendicitis: When to Operate', suggested_topic: 'Appendicitis: When to Operate', slot_id: null, message: 'Would love a session on this — common on call.', status: 'pending', created_at: '2026-05-22T09:30:00Z' },
  { id: 3002, name: 'Dr Chris Patel', email: 'chris.patel@nbt.nhs.uk', phone: '', topic: 'DVT Prophylaxis in Surgery', suggested_topic: 'DVT Prophylaxis in Surgery', slot_id: null, message: '', status: 'accepted', created_at: '2026-05-10T14:00:00Z' },
];

const DEMO_EMAIL_LOG = [
  { id: 2001, to_address: 'james.whitfield@nhs.net', subject: 'Teaching Reminder: Acute Abdomen Assessment', status: 'sent', created_at: '2026-05-05T15:00:00Z', session_id: 7001 },
  { id: 2002, to_address: 'sarah.chen@nhs.net', subject: 'Teaching Reminder: Hernias', status: 'sent', created_at: '2026-05-12T15:00:00Z', session_id: 7002 },
  { id: 2003, to_address: 'alex.morgan@nbt.nhs.uk', subject: 'Feedback Request: Acute Abdomen Assessment', status: 'sent', created_at: '2026-05-06T09:00:00Z', session_id: 7001 },
];

const DEMO_LOG = [
  { id: 1001, action: 'Created session: Acute Abdomen Assessment', user: 'admin', created_at: '2026-04-28T10:00:00Z' },
  { id: 1002, action: 'Sent reminder to Mr James Whitfield', user: 'admin', created_at: '2026-05-05T15:00:00Z' },
  { id: 1003, action: 'Marked attendance for session #7001', user: 'admin', created_at: '2026-05-06T08:45:00Z' },
  { id: 1004, action: 'Created session: Hernias', user: 'admin', created_at: '2026-05-01T11:00:00Z' },
  { id: 1005, action: 'Teacher confirmed: Peripheral Vascular Disease', user: 'system', created_at: '2026-05-18T09:00:00Z' },
];

const DEMO_SITE_FEEDBACK = [
  { id: 1101, type: 'feature', subject: 'Dark mode option', detail: 'Would be nice for night shifts', name: 'Dr Beth Taylor', email: 'beth.taylor@nbt.nhs.uk', created_at: '2026-05-15T22:00:00Z' },
  { id: 1102, type: 'feedback', subject: 'Great app!', detail: 'Really easy to use on mobile between patients.', name: '', email: '', created_at: '2026-05-20T12:00:00Z' },
];

const DEMO_ABSENCE_REASONS = [
  { id: 1201, session_id: 7001, learner_id: 8003, reason: 'on_call', details: '', token: 'demo-abs-1', created_at: '2026-05-06T10:00:00Z' },
  { id: 1202, session_id: 7002, learner_id: 8005, reason: 'annual_leave', details: 'Pre-booked holiday', token: 'demo-abs-2', created_at: '2026-05-13T10:00:00Z' },
];

const DEMO_FEEDBACK_TOKENS = [];
const DEMO_QI_EVENTS = [];
const DEMO_SURVEY_RESPONSES = [];
const DEMO_EXPECTED_ATTENDANCE = [];
const DEMO_WHATSAPP_LOG = [];
const DEMO_ERROR_LOG = [
  { id: 1301, level: 'error', message: 'Demo error example', context: 'demo', url: 'https://example.com', user_agent: 'Demo', created_at: '2026-05-26T10:00:00Z' }
];

// ── Demo sbGet interceptor ──
// Maps table names to their demo dataset. Supports basic PostgREST-style filtering.
const DEMO_TABLES = {
  schedule: DEMO_SCHEDULE,
  contacts: DEMO_CONTACTS,
  learners: DEMO_LEARNERS,
  attendance: DEMO_ATTENDANCE,
  feedback: DEMO_FEEDBACK,
  ideas: DEMO_IDEAS,
  requests: DEMO_REQUESTS,
  session_requests: DEMO_REQUESTS,
  email_log: DEMO_EMAIL_LOG,
  log: DEMO_LOG,
  site_feedback: DEMO_SITE_FEEDBACK,
  absence_reasons: DEMO_ABSENCE_REASONS,
  feedback_tokens: DEMO_FEEDBACK_TOKENS,
  feedback_sends: [],
  qi_events: DEMO_QI_EVENTS,
  qi_pdsa_cycles: [],
  survey_responses: DEMO_SURVEY_RESPONSES,
  expected_attendance: DEMO_EXPECTED_ATTENDANCE,
  whatsapp_log: DEMO_WHATSAPP_LOG,
  error_log: DEMO_ERROR_LOG,
  users: [],
  login_attempts: [],
};

function demoFilter(data, queryString) {
  if (!queryString) return [...data];
  let result = [...data];
  const parts = queryString.split('&');
  for (const part of parts) {
    // select=... or order=... or limit=... — skip
    if (part.startsWith('select=') || part.startsWith('order=') || part.startsWith('limit=')) {
      if (part.startsWith('limit=')) {
        const lim = parseInt(part.split('=')[1]);
        if (!isNaN(lim)) result = result.slice(0, lim);
      }
      continue;
    }
    // field=eq.value
    const eqMatch = part.match(/^([^=]+)=eq\.(.+)$/);
    if (eqMatch) {
      const [, field, val] = eqMatch;
      result = result.filter(r => String(r[field]) === decodeURIComponent(val));
      continue;
    }
    // field=ilike.value (case-insensitive)
    const ilikeMatch = part.match(/^([^=]+)=ilike\.(.+)$/);
    if (ilikeMatch) {
      const [, field, val] = ilikeMatch;
      const target = decodeURIComponent(val).toLowerCase();
      result = result.filter(r => r[field] && String(r[field]).toLowerCase() === target);
      continue;
    }
    // field=gte.value
    const gteMatch = part.match(/^([^=]+)=gte\.(.+)$/);
    if (gteMatch) {
      const [, field, val] = gteMatch;
      result = result.filter(r => r[field] >= decodeURIComponent(val));
      continue;
    }
    // field=in.(val1,val2,...)
    const inMatch = part.match(/^([^=]+)=in\.\((.+)\)$/);
    if (inMatch) {
      const [, field, vals] = inMatch;
      const allowed = vals.split(',').map(v => decodeURIComponent(v.trim()));
      result = result.filter(r => allowed.includes(String(r[field])));
      continue;
    }
  }
  return result;
}

// Override sbGet when in demo mode — called from config.js wrapper
function demoSbGet(table, query) {
  const dataset = DEMO_TABLES[table];
  if (!dataset) return Promise.resolve([]);
  return Promise.resolve(demoFilter(dataset, query || ''));
}

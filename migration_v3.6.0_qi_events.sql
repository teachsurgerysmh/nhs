-- =====================================================
-- Migration v3.6.0 — QI Engagement & Activity Logging
-- Run in Supabase SQL editor (one shot)
-- =====================================================

-- ─── 1. EVENTS TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS qi_events (
  id              BIGSERIAL PRIMARY KEY,
  event_type      TEXT NOT NULL,
  actor_type      TEXT,                            -- 'admin' | 'learner' | 'teacher' | 'public' | 'system' | 'cron'
  actor_id        BIGINT,                          -- learners.id / contacts.id when known
  actor_email     TEXT,
  actor_name      TEXT,
  session_id      BIGINT,                          -- schedule.id when relevant
  metadata        JSONB DEFAULT '{}'::jsonb,
  source          TEXT DEFAULT 'web',              -- 'web' | 'email' | 'qr' | 'cron' | 'demo'
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qi_events_type        ON qi_events(event_type);
CREATE INDEX IF NOT EXISTS idx_qi_events_session     ON qi_events(session_id);
CREATE INDEX IF NOT EXISTS idx_qi_events_created     ON qi_events(created_at);
CREATE INDEX IF NOT EXISTS idx_qi_events_actor_email ON qi_events(actor_email);
CREATE INDEX IF NOT EXISTS idx_qi_events_actor_type  ON qi_events(actor_type);

-- ─── 2. PDSA CYCLE ANNOTATIONS ─────────────────────
CREATE TABLE IF NOT EXISTS qi_pdsa_cycles (
  id              BIGSERIAL PRIMARY KEY,
  cycle_number    INT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  intervention    TEXT,                            -- what changed
  hypothesis      TEXT,                            -- what we expected
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  app_version     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed PDSA cycle 0 — baseline (everything before v3.6.0)
INSERT INTO qi_pdsa_cycles (cycle_number, title, intervention, hypothesis, started_at, app_version, notes)
SELECT 0, 'Baseline – platform launch', 'Web app replaced email/WhatsApp chasing',
       'Centralised platform will lift teacher confirmation rate and feedback collection vs ad-hoc methods',
       '2026-05-01'::timestamptz, 'v3.0–v3.5', 'Auto-seeded by migration v3.6.0'
WHERE NOT EXISTS (SELECT 1 FROM qi_pdsa_cycles WHERE cycle_number = 0);

-- ─── 3. ROW LEVEL SECURITY ─────────────────────────
-- Logging is open to anon (so the app can fire-and-forget events).
-- Reading is denied to anon (so QI data is private to the dashboard, which uses
-- the qi-dashboard Edge Function with the service role key).
ALTER TABLE qi_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE qi_pdsa_cycles  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qi_events_anon_insert ON qi_events;
CREATE POLICY qi_events_anon_insert ON qi_events
  FOR INSERT TO anon WITH CHECK (true);

-- Authenticated users (including service_role) bypass via separate policies;
-- service_role bypasses RLS by default. No SELECT policy = no anon reads.

DROP POLICY IF EXISTS qi_pdsa_anon_read ON qi_pdsa_cycles;
CREATE POLICY qi_pdsa_anon_read ON qi_pdsa_cycles
  FOR SELECT TO anon USING (false);  -- denied; only service_role reads cycles

-- ─── 4. ANALYTICAL VIEWS ───────────────────────────
-- All views inherit RLS from their base tables. Service role sees them all.

-- 4a. Per-session funnel (one row per session): invited → confirmed → completed → attended → feedback
CREATE OR REPLACE VIEW qi_session_funnel AS
SELECT
  s.id                                                                                          AS session_id,
  s.topic,
  s.teacher,
  s.teacher_email,
  s.day || ' ' || s.date || ' ' || s.month || ' ' || s.year                                     AS date_display,
  s.status,
  s.teacher_confirmed,
  s.published,
  -- Invitation
  (SELECT MIN(created_at) FROM qi_events WHERE session_id = s.id AND event_type = 'invitation_sent')        AS first_invite_at,
  (SELECT COUNT(*)        FROM qi_events WHERE session_id = s.id AND event_type = 'invitation_sent')        AS invite_count,
  -- Reminders
  (SELECT COUNT(*)        FROM qi_events WHERE session_id = s.id AND event_type = 'reminder_sent')          AS reminder_count,
  -- Teacher response
  (SELECT MIN(created_at) FROM qi_events WHERE session_id = s.id AND event_type = 'invitation_confirmed')   AS confirmed_at,
  (SELECT MIN(created_at) FROM qi_events WHERE session_id = s.id AND event_type = 'invitation_declined')    AS declined_at,
  -- Time to respond (hours)
  EXTRACT(EPOCH FROM (
    COALESCE(
      (SELECT MIN(created_at) FROM qi_events WHERE session_id = s.id AND event_type = 'invitation_confirmed'),
      (SELECT MIN(created_at) FROM qi_events WHERE session_id = s.id AND event_type = 'invitation_declined')
    ) -
    (SELECT MIN(created_at) FROM qi_events WHERE session_id = s.id AND event_type = 'invitation_sent')
  )) / 3600.0                                                                                   AS hours_to_respond,
  -- Attendance
  (SELECT COUNT(*) FROM attendance WHERE session_id = s.id AND status = 'approved')             AS attendance_count,
  -- Time-to-attendance: hours between session creation and first attendance log
  EXTRACT(EPOCH FROM (
    (SELECT MIN(marked_at) FROM attendance WHERE session_id = s.id AND status = 'approved')
    - (SELECT MIN(created_at) FROM qi_events WHERE session_id = s.id AND event_type = 'session_created')
  )) / 3600.0                                                                                   AS hours_session_to_first_attendance,
  -- Feedback
  (SELECT COUNT(*) FROM feedback   WHERE session_id = s.id)                                     AS feedback_count,
  -- Feedback request emails sent (initial + reminders)
  (SELECT COUNT(*) FROM qi_events  WHERE session_id = s.id AND event_type = 'feedback_request_sent')        AS feedback_requests_sent,
  (SELECT COUNT(*) FROM qi_events  WHERE session_id = s.id AND event_type = 'feedback_reminder_sent')       AS feedback_reminders_sent,
  -- Time-to-feedback: hours between first feedback_request_sent and first feedback submission
  EXTRACT(EPOCH FROM (
    (SELECT MIN(submitted_at) FROM feedback WHERE session_id = s.id)
    - (SELECT MIN(created_at) FROM qi_events WHERE session_id = s.id AND event_type = 'feedback_request_sent')
  )) / 3600.0                                                                                   AS hours_request_to_first_feedback,
  -- Feedback completion rate (% of attendees who gave feedback)
  CASE
    WHEN (SELECT COUNT(*) FROM attendance WHERE session_id = s.id AND status = 'approved') = 0 THEN NULL
    ELSE ROUND(
      100.0 * (SELECT COUNT(*) FROM feedback WHERE session_id = s.id)::numeric
            / (SELECT COUNT(*) FROM attendance WHERE session_id = s.id AND status = 'approved')::numeric, 1)
  END                                                                                           AS feedback_pct,
  -- Mean overall rating
  (SELECT ROUND(AVG(rating_overall)::numeric, 2) FROM feedback WHERE session_id = s.id)         AS mean_overall_rating,
  -- Certificate issuance
  (SELECT COUNT(*) FROM qi_events WHERE session_id = s.id AND event_type = 'certificate_downloaded') AS cert_downloads,
  -- Did the teacher actually look at their feedback for this session?
  (SELECT MIN(created_at) FROM qi_events
     WHERE session_id = s.id AND event_type IN ('teacher_viewed_feedback','teacher_viewed_session_feedback'))
                                                                                                 AS teacher_viewed_feedback_at
FROM schedule s
WHERE s.published = TRUE;

-- 4b. Top-line KPIs (one row, current snapshot)
CREATE OR REPLACE VIEW qi_kpis AS
SELECT
  (SELECT COUNT(*) FROM schedule WHERE published = TRUE AND status != 'cancelled')                       AS total_sessions,
  (SELECT COUNT(*) FROM schedule WHERE published = TRUE AND status = 'completed')                        AS completed_sessions,
  (SELECT COUNT(*) FROM schedule WHERE published = TRUE AND status = 'cancelled')                        AS cancelled_sessions,
  (SELECT COUNT(*) FROM schedule WHERE published = TRUE AND status = 'tbd')                              AS tbd_sessions,

  (SELECT COUNT(*) FROM qi_events WHERE event_type = 'invitation_sent')                                  AS invitations_sent,
  (SELECT COUNT(*) FROM qi_events WHERE event_type = 'invitation_confirmed')                             AS invitations_confirmed,
  (SELECT COUNT(*) FROM qi_events WHERE event_type = 'invitation_declined')                              AS invitations_declined,
  CASE WHEN (SELECT COUNT(*) FROM qi_events WHERE event_type = 'invitation_sent') = 0 THEN NULL
       ELSE ROUND(100.0 *
         (SELECT COUNT(*) FROM qi_events WHERE event_type = 'invitation_confirmed')::numeric /
         (SELECT COUNT(*) FROM qi_events WHERE event_type = 'invitation_sent')::numeric, 1)
  END                                                                                                    AS confirmation_rate_pct,

  -- Median hours to respond
  (SELECT ROUND(
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_to_respond)::numeric, 1)
    FROM qi_session_funnel WHERE hours_to_respond IS NOT NULL AND hours_to_respond >= 0
  )                                                                                                      AS median_hours_to_respond,
  -- Median hours from session_created to first attendance log
  (SELECT ROUND(
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_session_to_first_attendance)::numeric, 1)
    FROM qi_session_funnel WHERE hours_session_to_first_attendance IS NOT NULL AND hours_session_to_first_attendance >= 0
  )                                                                                                      AS median_hours_to_first_attendance,
  -- Median hours from feedback request to first feedback submission
  (SELECT ROUND(
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_request_to_first_feedback)::numeric, 1)
    FROM qi_session_funnel WHERE hours_request_to_first_feedback IS NOT NULL AND hours_request_to_first_feedback >= 0
  )                                                                                                      AS median_hours_to_feedback,
  -- Mean reminders sent before feedback comes in
  (SELECT ROUND(AVG(feedback_reminders_sent)::numeric, 2)
    FROM qi_session_funnel WHERE feedback_count > 0
  )                                                                                                      AS mean_reminders_before_feedback,
  -- Teacher feedback views — did teachers actually look?
  (SELECT COUNT(*) FROM qi_events WHERE event_type IN ('teacher_viewed_feedback','teacher_viewed_session_feedback'))
                                                                                                         AS teacher_feedback_views,
  (SELECT COUNT(DISTINCT actor_email) FROM qi_events WHERE event_type IN ('teacher_viewed_feedback','teacher_viewed_session_feedback'))
                                                                                                         AS unique_teachers_viewed_feedback,

  (SELECT COUNT(DISTINCT learner_id) FROM attendance WHERE status = 'approved')                          AS unique_attendees,
  (SELECT COUNT(*) FROM attendance WHERE status = 'approved')                                            AS total_attendances,
  (SELECT COUNT(*) FROM feedback)                                                                        AS feedback_submitted,
  CASE WHEN (SELECT COUNT(*) FROM attendance WHERE status = 'approved') = 0 THEN NULL
       ELSE ROUND(100.0 *
         (SELECT COUNT(*) FROM feedback)::numeric /
         (SELECT COUNT(*) FROM attendance WHERE status = 'approved')::numeric, 1)
  END                                                                                                    AS feedback_completion_rate_pct,
  (SELECT ROUND(AVG(rating_overall)::numeric, 2) FROM feedback)                                          AS mean_overall_rating,

  (SELECT COUNT(*) FROM learners)                                                                        AS registered_learners,
  (SELECT COUNT(*) FROM contacts)                                                                        AS contacts_total,
  (SELECT COUNT(*) FROM contacts WHERE pin_code IS NOT NULL)                                             AS teachers_active,
  (SELECT COUNT(*) FROM qi_events WHERE event_type = 'certificate_downloaded')                           AS certificates_issued,
  (SELECT COUNT(DISTINCT respondent_token) FROM survey_responses)                                        AS baseline_survey_respondents;

-- 4c. Weekly time-series (one row per ISO week)
CREATE OR REPLACE VIEW qi_weekly_metrics AS
WITH weeks AS (
  SELECT DISTINCT DATE_TRUNC('week', created_at)::date AS wk FROM qi_events
  UNION
  SELECT DISTINCT DATE_TRUNC('week', submitted_at)::date FROM feedback
  UNION
  SELECT DISTINCT DATE_TRUNC('week', marked_at)::date FROM attendance WHERE marked_at IS NOT NULL
)
SELECT
  wk                                                                                                     AS week_start,
  (SELECT COUNT(*) FROM qi_events e WHERE DATE_TRUNC('week', e.created_at)::date = wk
     AND e.event_type = 'invitation_sent')                                                               AS invites_sent,
  (SELECT COUNT(*) FROM qi_events e WHERE DATE_TRUNC('week', e.created_at)::date = wk
     AND e.event_type = 'invitation_confirmed')                                                          AS invites_confirmed,
  (SELECT COUNT(*) FROM qi_events e WHERE DATE_TRUNC('week', e.created_at)::date = wk
     AND e.event_type = 'invitation_declined')                                                           AS invites_declined,
  (SELECT COUNT(*) FROM attendance a WHERE DATE_TRUNC('week', a.marked_at)::date = wk
     AND a.status = 'approved')                                                                          AS attendances,
  (SELECT COUNT(*) FROM feedback f WHERE DATE_TRUNC('week', f.submitted_at)::date = wk)                  AS feedback_count,
  (SELECT ROUND(AVG(rating_overall)::numeric, 2) FROM feedback f
     WHERE DATE_TRUNC('week', f.submitted_at)::date = wk)                                                AS mean_rating,
  (SELECT COUNT(*) FROM qi_events e WHERE DATE_TRUNC('week', e.created_at)::date = wk
     AND e.event_type IN ('learner_login','teacher_login','admin_login'))                                AS logins,
  (SELECT COUNT(*) FROM qi_events e WHERE DATE_TRUNC('week', e.created_at)::date = wk
     AND e.event_type = 'certificate_downloaded')                                                        AS certs_issued
FROM weeks
ORDER BY wk;

-- 4d. Per-teacher engagement
CREATE OR REPLACE VIEW qi_teacher_engagement AS
SELECT
  c.id                                                                                                   AS contact_id,
  c.name                                                                                                 AS teacher_name,
  c.email                                                                                                AS teacher_email,
  COUNT(DISTINCT s.id) FILTER (WHERE LOWER(s.teacher_email) = LOWER(c.email))                            AS assigned_sessions,
  (SELECT COUNT(*) FROM qi_events e WHERE LOWER(e.actor_email) = LOWER(c.email)
     AND e.event_type = 'invitation_confirmed')                                                          AS confirmed_count,
  (SELECT COUNT(*) FROM qi_events e WHERE LOWER(e.actor_email) = LOWER(c.email)
     AND e.event_type = 'invitation_declined')                                                           AS declined_count,
  (SELECT COUNT(*) FROM qi_events e WHERE LOWER(e.actor_email) = LOWER(c.email)
     AND e.event_type = 'reschedule_requested')                                                          AS reschedule_count,
  (SELECT ROUND(AVG(f.rating_overall)::numeric, 2) FROM feedback f
     JOIN schedule s2 ON f.session_id = s2.id
     WHERE LOWER(s2.teacher_email) = LOWER(c.email))                                                     AS mean_rating_received,
  (SELECT COUNT(*) FROM feedback f
     JOIN schedule s2 ON f.session_id = s2.id
     WHERE LOWER(s2.teacher_email) = LOWER(c.email))                                                     AS feedback_received_count
FROM contacts c
LEFT JOIN schedule s ON LOWER(s.teacher_email) = LOWER(c.email)
GROUP BY c.id, c.name, c.email;

-- 4e. Per-learner engagement (active learners only — those with placement dates)
CREATE OR REPLACE VIEW qi_learner_engagement AS
SELECT
  l.id                                                                                                   AS learner_id,
  l.name                                                                                                 AS learner_name,
  l.email                                                                                                AS learner_email,
  l.grade,
  l.placement,
  l.placement_start,
  l.placement_end,
  (SELECT COUNT(*) FROM attendance a WHERE a.learner_id = l.id AND a.status = 'approved')                AS sessions_attended,
  (SELECT COUNT(*) FROM feedback f WHERE f.learner_id = l.id)                                            AS feedback_given,
  (SELECT COUNT(*) FROM qi_events e WHERE e.actor_id = l.id AND e.actor_type = 'learner'
     AND e.event_type = 'learner_login')                                                                 AS login_count,
  (SELECT COUNT(*) FROM qi_events e WHERE e.actor_id = l.id AND e.actor_type = 'learner'
     AND e.event_type = 'certificate_downloaded')                                                        AS certs_downloaded,
  (SELECT MAX(e.created_at) FROM qi_events e WHERE e.actor_id = l.id AND e.actor_type = 'learner')       AS last_seen_at
FROM learners l;

-- 4e2. Inline micro-feedback ("rate this feature") aggregated per feature
CREATE OR REPLACE VIEW qi_inline_ratings AS
SELECT
  COALESCE(metadata->>'feature', 'unknown')                                                              AS feature,
  COUNT(*)                                                                                               AS rating_count,
  ROUND(AVG((metadata->>'rating')::numeric), 2)                                                          AS mean_rating,
  COUNT(*) FILTER (WHERE (metadata->>'rating')::int = 5)                                                 AS count_5,
  COUNT(*) FILTER (WHERE (metadata->>'rating')::int = 4)                                                 AS count_4,
  COUNT(*) FILTER (WHERE (metadata->>'rating')::int = 3)                                                 AS count_3,
  COUNT(*) FILTER (WHERE (metadata->>'rating')::int = 2)                                                 AS count_2,
  COUNT(*) FILTER (WHERE (metadata->>'rating')::int = 1)                                                 AS count_1,
  COUNT(*) FILTER (WHERE COALESCE(metadata->>'comment','') <> '')                                        AS comments_count,
  MAX(created_at)                                                                                        AS last_rated_at
FROM qi_events
WHERE event_type = 'inline_rating_submitted'
GROUP BY metadata->>'feature'
ORDER BY rating_count DESC;

-- 4f. Event type counts (handy for debug & taxonomy verification)
CREATE OR REPLACE VIEW qi_event_type_counts AS
SELECT event_type, actor_type, COUNT(*) AS event_count,
       MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
FROM qi_events
GROUP BY event_type, actor_type
ORDER BY event_count DESC;

-- 4g. PDSA cycle comparison — bucket all events into their cycle
CREATE OR REPLACE VIEW qi_pdsa_metrics AS
SELECT
  p.cycle_number,
  p.title,
  p.app_version,
  p.started_at,
  p.ended_at,
  (SELECT COUNT(*) FROM qi_events e
     WHERE e.created_at >= p.started_at
       AND (p.ended_at IS NULL OR e.created_at < p.ended_at)
       AND e.event_type = 'invitation_sent')                                                             AS invites_sent,
  (SELECT COUNT(*) FROM qi_events e
     WHERE e.created_at >= p.started_at
       AND (p.ended_at IS NULL OR e.created_at < p.ended_at)
       AND e.event_type = 'invitation_confirmed')                                                        AS invites_confirmed,
  CASE WHEN (SELECT COUNT(*) FROM qi_events e
     WHERE e.created_at >= p.started_at
       AND (p.ended_at IS NULL OR e.created_at < p.ended_at)
       AND e.event_type = 'invitation_sent') = 0 THEN NULL
  ELSE ROUND(100.0 *
       (SELECT COUNT(*) FROM qi_events e
         WHERE e.created_at >= p.started_at
           AND (p.ended_at IS NULL OR e.created_at < p.ended_at)
           AND e.event_type = 'invitation_confirmed')::numeric /
       (SELECT COUNT(*) FROM qi_events e
         WHERE e.created_at >= p.started_at
           AND (p.ended_at IS NULL OR e.created_at < p.ended_at)
           AND e.event_type = 'invitation_sent')::numeric, 1)
  END                                                                                                    AS confirmation_rate_pct,
  (SELECT COUNT(*) FROM attendance a
     WHERE a.marked_at >= p.started_at
       AND (p.ended_at IS NULL OR a.marked_at < p.ended_at)
       AND a.status = 'approved')                                                                        AS attendances,
  (SELECT COUNT(*) FROM feedback f
     WHERE f.submitted_at >= p.started_at
       AND (p.ended_at IS NULL OR f.submitted_at < p.ended_at))                                          AS feedback_count,
  (SELECT ROUND(AVG(rating_overall)::numeric, 2) FROM feedback f
     WHERE f.submitted_at >= p.started_at
       AND (p.ended_at IS NULL OR f.submitted_at < p.ended_at))                                          AS mean_rating
FROM qi_pdsa_cycles p
ORDER BY p.cycle_number;

-- ─── 5. PERMISSIONS ────────────────────────────────
-- Allow anon to use the INSERT policy on qi_events:
GRANT INSERT ON qi_events TO anon;
GRANT USAGE, SELECT ON SEQUENCE qi_events_id_seq TO anon;
-- Views remain readable only to service_role (anon SELECT was never granted):
REVOKE ALL ON qi_session_funnel, qi_kpis, qi_weekly_metrics,
              qi_teacher_engagement, qi_learner_engagement,
              qi_event_type_counts, qi_pdsa_metrics, qi_inline_ratings
       FROM anon, public;

-- ─── 6. SANITY CHECK ───────────────────────────────
-- After running, verify with these (as service_role / SQL editor):
-- SELECT * FROM qi_kpis;
-- SELECT * FROM qi_weekly_metrics ORDER BY week_start DESC LIMIT 8;
-- SELECT * FROM qi_event_type_counts;

-- Daily Feedback Reminder — Supabase Scheduled Function Setup
-- This sends reminder emails to learners who attended a session but haven't submitted feedback
-- Schedule: Every day at 8:00 AM UK time
-- Dedup: Skips learners who already received a reminder today (from any source)
--
-- SETUP INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Run this SQL to create the function
-- 3. Go to Database → Extensions → Enable pg_cron if not already enabled
-- 4. Run the cron schedule SQL at the bottom

-- Create the function that sends daily feedback reminders
CREATE OR REPLACE FUNCTION send_daily_feedback_reminders()
RETURNS void AS $$
DECLARE
  rec RECORD;
  session_rec RECORD;
  email_body TEXT;
  feedback_url TEXT;
  site_url TEXT := 'https://teachsurgerysmh.github.io/nhs/';
  logo_url TEXT := 'https://teachsurgerysmh.github.io/nhs/logo_transparent.png';
  sent_emails TEXT[] := '{}';
  sent_count INT := 0;
  already_sent_today TEXT[];
  feedback_token TEXT;
BEGIN
  -- Find all learners who attended a session (approved) but haven't submitted feedback
  -- Only for sessions in the last 14 days (don't nag forever)
  FOR rec IN
    SELECT DISTINCT l.id AS learner_id, l.email, l.name, a.session_id
    FROM attendance a
    JOIN learners l ON l.id = a.learner_id
    LEFT JOIN feedback f ON f.session_id = a.session_id AND f.learner_id = a.learner_id
    JOIN schedule s ON s.id = a.session_id
    WHERE a.status = 'approved'
      AND f.id IS NULL
      AND l.email IS NOT NULL
      AND a.created_at > NOW() - INTERVAL '14 days'
    ORDER BY a.session_id
  LOOP
    -- Check if this learner was already sent a reminder today for this session (from any source)
    SELECT COALESCE(
      (SELECT array_agg(DISTINCT unnest_email)
       FROM feedback_sends fs,
       LATERAL unnest(fs.recipients) AS unnest_email
       WHERE fs.session_id = rec.session_id
         AND fs.sent_at >= CURRENT_DATE),
      '{}'
    ) INTO already_sent_today;

    IF LOWER(rec.email) = ANY(already_sent_today) THEN
      CONTINUE; -- Skip, already sent today
    END IF;

    -- Get session details
    SELECT * INTO session_rec FROM schedule WHERE id = rec.session_id;

    -- Issue (or reuse) a magic-link token for this (session, learner) pair so the
    -- recipient can submit feedback in one click, no login.
    INSERT INTO feedback_tokens (session_id, learner_id, token)
    VALUES (rec.session_id, rec.learner_id, encode(gen_random_bytes(24), 'hex'))
    ON CONFLICT (session_id, learner_id) DO UPDATE SET created_at = feedback_tokens.created_at
    RETURNING token INTO feedback_token;

    feedback_url := site_url || '?feedback=' || rec.session_id || '&token=' || feedback_token;

    -- Call the send-email edge function via pg_net
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'),
        'apikey', current_setting('app.supabase_anon_key')
      ),
      body := jsonb_build_object(
        'to', jsonb_build_array(rec.email),
        'subject', 'Reminder: Feedback for ' || COALESCE(session_rec.topic, 'Teaching Session') || ' with ' || COALESCE(session_rec.teacher, 'the teacher') || ' - ' || COALESCE(session_rec.date, '') || ' ' || COALESCE(session_rec.month, ''),
        'html', '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
          || '<div style="background:#003087;padding:20px;border-radius:8px 8px 0 0;text-align:center;">'
          || '<img src="' || logo_url || '" alt="Southmead Surgical Teaching" style="height:60px;width:auto;margin-bottom:8px;">'
          || '<h2 style="color:white;margin:0;font-size:18px;">Southmead Surgical Teaching</h2></div>'
          || '<div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">'
          || '<p>Dear ' || COALESCE(rec.name, 'Colleague') || ',</p>'
          || '<p>This is a friendly reminder to submit feedback for the teaching session below, delivered by <strong>' || COALESCE(session_rec.teacher, 'the teacher') || '</strong>:</p>'
          || '<table style="margin:12px 0 16px;font-size:14px;border-collapse:collapse;">'
          || '<tr><td style="padding:4px 16px 4px 0;font-weight:bold;color:#4c6272;">Topic:</td><td>' || COALESCE(session_rec.topic, 'Teaching Session') || '</td></tr>'
          || '<tr><td style="padding:4px 16px 4px 0;font-weight:bold;color:#4c6272;">Teacher:</td><td>' || COALESCE(session_rec.teacher, 'the teacher') || '</td></tr>'
          || '<tr><td style="padding:4px 16px 4px 0;font-weight:bold;color:#4c6272;">Date:</td><td>' || COALESCE(session_rec.day, '') || ' ' || COALESCE(session_rec.date, '') || ' ' || COALESCE(session_rec.month, '') || ' ' || COALESCE(session_rec.year::text, '') || '</td></tr>'
          || '<tr><td style="padding:4px 16px 4px 0;font-weight:bold;color:#4c6272;">Time:</td><td>' || COALESCE(session_rec.time, 'TBC') || '</td></tr>'
          || '</table>'
          || '<p><strong>Mr Nitin Arvind</strong>, Surgical Tutor & Programme Supervisor, personally reviews all feedback as part of our quality assurance process.</p>'
          || '<p><strong>By submitting feedback you will:</strong></p>'
          || '<ul><li>Confirm your attendance record</li><li>Earn CPD hours for this session</li><li>Receive a certificate of attendance</li></ul>'
          || '<div style="text-align:center;margin:24px 0;">'
          || '<a href="' || feedback_url || '" style="display:inline-block;padding:14px 36px;background:#009639;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">Submit Feedback Now</a></div>'
          || '<p style="font-size:12px;color:#768692;">This takes less than 2 minutes. It will not be sent again once you have submitted.</p>'
          || '<p>Best regards,<br>Southmead Surgical Teaching Team<br><em>Under the supervision of Mr Nitin Arvind</em></p>'
          || '</div></div>'
      )
    );

    sent_emails := array_append(sent_emails, LOWER(rec.email));
    sent_count := sent_count + 1;
  END LOOP;

  -- Log all cron sends in one row per session
  IF sent_count > 0 THEN
    INSERT INTO feedback_sends (session_id, method, sent_by, recipient_count, recipients)
    SELECT DISTINCT rec2.session_id, 'cron', 'pg_cron',
      (SELECT COUNT(*) FROM unnest(sent_emails)),
      sent_emails
    FROM (SELECT DISTINCT a.session_id FROM attendance a
          JOIN learners l ON l.id = a.learner_id
          LEFT JOIN feedback f ON f.session_id = a.session_id AND f.learner_id = a.learner_id
          WHERE a.status = 'approved' AND f.id IS NULL AND l.email IS NOT NULL
            AND a.created_at > NOW() - INTERVAL '14 days'
            AND LOWER(l.email) = ANY(sent_emails)) rec2;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule the function to run daily at 8:00 AM UTC (adjust for BST if needed)
-- UK is UTC+1 in summer (BST), UTC+0 in winter (GMT)
-- To hit 8am UK time year-round, use 7am UTC (close enough, or adjust seasonally)
SELECT cron.schedule(
  'daily-feedback-reminder',
  '0 7 * * *',  -- 7:00 AM UTC = 8:00 AM BST
  'SELECT send_daily_feedback_reminders()'
);

-- To check scheduled jobs:
-- SELECT * FROM cron.job;
-- To remove:
-- SELECT cron.unschedule('daily-feedback-reminder');

// Supabase Edge Function: qi-dashboard
// Path in Supabase dashboard: Functions → New function → name: qi-dashboard
// REQUIRED ENV VAR: QI_DASHBOARD_PIN  (set under Project Settings → Edge Functions → Secrets)
//
// Purpose: returns aggregated QI metrics (KPIs, weekly trends, funnel, teacher/learner
// engagement, PDSA comparison) in one JSON payload. Uses service_role internally so it
// can read the qi_* views which are RLS-blocked from anon callers. Caller must supply
// the QI dashboard pin (Suketu only) in the request body.
//
// Deploy: copy this file's contents into the Supabase Function editor and click Deploy.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const pin = String(body.pin || "");

    const expectedPin = Deno.env.get("QI_DASHBOARD_PIN") || "";
    if (!expectedPin) {
      return json({ error: "Server not configured: QI_DASHBOARD_PIN missing" }, 500);
    }
    if (pin !== expectedPin) {
      return json({ error: "Invalid pin" }, 401);
    }

    const supabaseUrl     = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Fetch everything in parallel
    const [
      kpis,
      weekly,
      funnel,
      teacherEng,
      learnerEng,
      eventCounts,
      pdsa,
      pdsaCycles,
      inlineRatings,
      recentEvents,
    ] = await Promise.all([
      sb.from("qi_kpis").select("*").single(),
      sb.from("qi_weekly_metrics").select("*").order("week_start", { ascending: true }),
      sb.from("qi_session_funnel").select("*").order("session_id", { ascending: false }).limit(200),
      sb.from("qi_teacher_engagement").select("*").order("assigned_sessions", { ascending: false }),
      sb.from("qi_learner_engagement").select("*").order("sessions_attended", { ascending: false }).limit(200),
      sb.from("qi_event_type_counts").select("*"),
      sb.from("qi_pdsa_metrics").select("*").order("cycle_number", { ascending: true }),
      sb.from("qi_pdsa_cycles").select("*").order("cycle_number", { ascending: true }),
      sb.from("qi_inline_ratings").select("*").order("rating_count", { ascending: false }),
      sb.from("qi_events").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    const errors = [
      kpis.error, weekly.error, funnel.error, teacherEng.error,
      learnerEng.error, eventCounts.error, pdsa.error, pdsaCycles.error,
      inlineRatings.error, recentEvents.error
    ].filter(Boolean);
    if (errors.length) {
      console.error("qi-dashboard query errors:", errors);
      return json({ error: "Query failed", details: errors.map(e => e?.message) }, 500);
    }

    return json({
      generated_at: new Date().toISOString(),
      kpis:           kpis.data ?? {},
      weekly:         weekly.data ?? [],
      sessions:       funnel.data ?? [],
      teachers:       teacherEng.data ?? [],
      learners:       learnerEng.data ?? [],
      event_counts:   eventCounts.data ?? [],
      pdsa_metrics:   pdsa.data ?? [],
      pdsa_cycles:    pdsaCycles.data ?? [],
      inline_ratings: inlineRatings.data ?? [],
      recent_events:  recentEvents.data ?? [],
    });
  } catch (e) {
    console.error("qi-dashboard error:", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

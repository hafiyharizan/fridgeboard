// POST /api/cron/tick
// Called every minute by Supabase Cron (pg_cron + pg_net; see
// supabase/migrations/20261119000000_notification_jobs.sql). Queues every
// alert that has come due (event reminders, athan, morning summary, grocery
// reminder) and delivers the queue. See lib/notify/.
//
// Auth: Authorization: Bearer <CRON_SECRET>

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { deliverDueJobs, planDueJobs } from "@/lib/notify/queue";
import { createSupabaseServiceClient } from "@/lib/supabase-admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const now = new Date();
  const planned = await planDueJobs(db, now);
  const delivered = await deliverDueJobs(db, now);

  const errors = [...planned.errors, ...("error" in delivered && delivered.error ? [delivered.error] : [])];
  if (errors.length) console.error("[cron/tick]", errors.join(" | "));
  return Response.json({ ...planned, ...delivered, errors }, { status: errors.length ? 500 : 200 });
}

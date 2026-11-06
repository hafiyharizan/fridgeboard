// POST /api/cron/tick
// Sends calendar reminders and athan pushes that are due now.
//
// Called by Supabase (pg_cron + pg_net, see the cron_tick migration) only when
// its once-a-minute database check finds something due, so on a quiet minute
// the app isn't woken at all.
//
// Auth: Authorization: Bearer <CRON_SECRET>

import { runAthan } from "@/lib/athan";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { sendDueReminders } from "@/lib/reminders";
import { createSupabaseServiceClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const now = new Date();

  // Run both even if one fails, so a reminder problem can't block the athan.
  const [reminders, athan] = await Promise.allSettled([
    sendDueReminders(supabase, now),
    runAthan(supabase, now),
  ]);

  const failed = [reminders, athan].filter((result) => result.status === "rejected");
  for (const result of failed) console.error("[tick]", result.reason);

  return Response.json(
    {
      reminders: reminders.status === "fulfilled" ? reminders.value : { error: "failed" },
      athan: athan.status === "fulfilled" ? athan.value : { error: "failed" },
    },
    { status: failed.length ? 500 : 200 },
  );
}

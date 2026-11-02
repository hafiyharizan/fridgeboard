// 07:00 Perth (23:00 UTC): push today's events and grocery count.
import { callCronRoute } from "../lib/call-cron-route";

export default async function handler() {
  return callCronRoute("/api/push/remind?mode=summary");
}

export const config = { schedule: "0 23 * * *" };

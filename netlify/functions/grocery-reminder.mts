// 08:00 Perth (00:00 UTC): push a reminder if groceries are still unchecked.
import { callCronRoute } from "../lib/call-cron-route";

export default async function handler() {
  return callCronRoute("/api/push/remind?mode=grocery");
}

export const config = { schedule: "0 0 * * *" };

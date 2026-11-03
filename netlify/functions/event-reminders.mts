// Every minute: send calendar reminders that are due.
import { callCronRoute } from "../lib/call-cron-route";

export default async function handler() {
  return callCronRoute("/api/notifications");
}

export const config = { schedule: "* * * * *" };

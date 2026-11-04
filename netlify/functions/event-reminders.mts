// Every minute: send calendar reminders and athan alerts that are due.
import { callCronRoute } from "../lib/call-cron-route";

export default async function handler() {
  const [reminders] = await Promise.all([
    callCronRoute("/api/notifications"),
    callCronRoute("/api/push/prayer"),
  ]);
  return reminders;
}

export const config = { schedule: "* * * * *" };

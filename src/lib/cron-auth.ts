import { timingSafeEqual } from "node:crypto";

/**
 * Checks `Authorization: Bearer <CRON_SECRET>` for cron-triggered routes.
 * Fails closed: if CRON_SECRET isn't configured, every request is rejected,
 * so a missing env var can't leave the route open to the internet.
 */
export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  secret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!secret || !authorizationHeader) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorizationHeader);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Invite codes: 8 characters from an alphabet without look-alikes (no 0/O, 1/I).
// Shown to people as XXXX-XXXX. Must match the check in household_invites.code.
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

const VALID_CODE = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/** Uppercase and strip anything that isn't a letter or digit (dashes, spaces). */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, INVITE_CODE_LENGTH);
}

export function isValidInviteCode(input: string): boolean {
  return VALID_CODE.test(normalizeInviteCode(input));
}

/** Format for display while typing or showing: ABCD-EFGH. */
export function formatInviteCode(input: string): string {
  const code = normalizeInviteCode(input);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

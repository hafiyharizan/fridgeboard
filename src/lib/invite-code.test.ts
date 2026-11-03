import { describe, expect, it } from "vitest";
import {
  INVITE_CODE_ALPHABET,
  formatInviteCode,
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/invite-code";

describe("invite codes", () => {
  it("uses a 32-character alphabet without look-alike characters", () => {
    expect(INVITE_CODE_ALPHABET).toHaveLength(32);
    for (const ch of ["0", "O", "1", "I"]) {
      expect(INVITE_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it("normalizes case, dashes and spaces", () => {
    expect(normalizeInviteCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizeInviteCode("ab cd ef gh jk")).toBe("ABCDEFGH");
  });

  it("validates only full codes from the alphabet", () => {
    expect(isValidInviteCode("ABCD-EFGH")).toBe(true);
    expect(isValidInviteCode("abcd efgh")).toBe(true);
    expect(isValidInviteCode("ABCD-EFG")).toBe(false);
    expect(isValidInviteCode("ABCD-EFG0")).toBe(false);
    expect(isValidInviteCode("1234")).toBe(false);
  });

  it("formats as XXXX-XXXX", () => {
    expect(formatInviteCode("abcdefgh")).toBe("ABCD-EFGH");
    expect(formatInviteCode("abc")).toBe("ABC");
    expect(formatInviteCode("abcde")).toBe("ABCD-E");
  });
});

import { describe, expect, it } from "vitest";
import {
  getCalendarImportOptions,
  getCalendarSourceEvents,
  getSupportedCalendarImportYears,
  isCalendarImportSupported,
} from "@/lib/calendar-sources";

describe("calendar sources", () => {
  it("lists supported calendar sources", () => {
    const options = getCalendarImportOptions();
    expect(options.map((option) => option.source)).toEqual([
      "islamic",
      "malaysia_public_holiday",
      "wa_public_holiday",
    ]);
  });

  it("returns JAKIM Islamic dates for 2026", () => {
    const events = getCalendarSourceEvents("islamic", 2026);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_date: "2026-02-19", title: "Awal Ramadan" }),
        expect.objectContaining({ event_date: "2026-05-27", title: "Hari Raya Aidiladha" }),
      ]),
    );
  });

  it("includes substitute WA holidays for 2027", () => {
    const events = getCalendarSourceEvents("wa_public_holiday", 2027);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_date: "2027-12-27", title: "Christmas Day (observed)" }),
        expect.objectContaining({ event_date: "2027-12-28", title: "Boxing Day (observed)" }),
      ]),
    );
  });

  it("includes Malaysia public holiday substitute dates for 2026", () => {
    const events = getCalendarSourceEvents("malaysia_public_holiday", 2026);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_date: "2026-03-20", title: "Hari Raya Aidilfitri (additional holiday)" }),
        expect.objectContaining({ event_date: "2026-03-23", title: "Hari Raya Aidilfitri (observed)" }),
        expect.objectContaining({ event_date: "2026-11-09", title: "Deepavali (observed)" }),
      ]),
    );
  });

  it("reports which years are supported per source", () => {
    expect(getSupportedCalendarImportYears("islamic")).toEqual([2026, 2027]);
    expect(isCalendarImportSupported("malaysia_public_holiday", 2027)).toBe(false);
  });

  it("throws for unsupported years", () => {
    expect(() => getCalendarSourceEvents("malaysia_public_holiday", 2027)).toThrow(
      "Malaysia public holidays are not available for 2027 yet.",
    );
  });
});

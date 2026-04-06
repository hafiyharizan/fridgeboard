import type { CalendarEventType, CalendarImportSource, StickyColor } from "@/lib/types";

type CalendarImportSeed = {
  event_date: string;
  title: string;
  note?: string;
  event_type?: CalendarEventType;
  color?: StickyColor;
  source_event_id: string;
};

type CalendarSourceDefinition = {
  label: string;
  description: string;
  defaultColor: StickyColor;
  defaultType: CalendarEventType;
  yearNotes?: Partial<Record<number, string>>;
  eventsByYear: Partial<Record<number, CalendarImportSeed[]>>;
};

export type CalendarImportOption = {
  source: CalendarImportSource;
  label: string;
  description: string;
  supportedYears: number[];
};

const MALAYSIA_FEDERAL_NOTE =
  "Federal and nationwide observances for Malaysia. Some states have extra holidays or different substitutions.";

const definitions: Record<CalendarImportSource, CalendarSourceDefinition> = {
  islamic: {
    label: "Islamic events",
    description: "Major Islamic dates for Malaysia from JAKIM's official takwim.",
    defaultColor: "green",
    defaultType: "event",
    yearNotes: {
      2026: "JAKIM important Islamic dates for Malaysia (1447-1448H). Starred dates in the source remain subject to official announcement.",
      2027: "JAKIM important Islamic dates for Malaysia (1448-1449H). Starred dates in the source remain subject to official announcement.",
    },
    eventsByYear: {
      2026: [
        { event_date: "2026-01-17", title: "Israk and Mikraj", source_event_id: "2026-israk-mikraj" },
        { event_date: "2026-02-19", title: "Awal Ramadan", source_event_id: "2026-awal-ramadan" },
        { event_date: "2026-03-07", title: "Nuzul al-Quran", source_event_id: "2026-nuzul-quran" },
        { event_date: "2026-03-21", title: "Hari Raya Aidilfitri", source_event_id: "2026-aidilfitri" },
        { event_date: "2026-05-18", title: "Awal Zulhijjah", source_event_id: "2026-awal-zulhijjah" },
        { event_date: "2026-05-27", title: "Hari Raya Aidiladha", source_event_id: "2026-aidiladha" },
        { event_date: "2026-06-17", title: "Awal Muharram", source_event_id: "2026-awal-muharram" },
        { event_date: "2026-08-25", title: "Maulidur Rasul", source_event_id: "2026-maulidur-rasul" },
      ],
      2027: [
        { event_date: "2027-01-06", title: "Israk and Mikraj", source_event_id: "2027-israk-mikraj-january" },
        { event_date: "2027-02-08", title: "Awal Ramadan", source_event_id: "2027-awal-ramadan" },
        { event_date: "2027-02-24", title: "Nuzul al-Quran", source_event_id: "2027-nuzul-quran" },
        { event_date: "2027-03-10", title: "Hari Raya Aidilfitri", source_event_id: "2027-aidilfitri" },
        { event_date: "2027-05-08", title: "Awal Zulhijjah", source_event_id: "2027-awal-zulhijjah" },
        { event_date: "2027-05-17", title: "Hari Raya Aidiladha", source_event_id: "2027-aidiladha" },
        { event_date: "2027-06-06", title: "Awal Muharram", source_event_id: "2027-awal-muharram" },
        { event_date: "2027-08-15", title: "Maulidur Rasul", source_event_id: "2027-maulidur-rasul" },
        { event_date: "2027-12-26", title: "Israk and Mikraj", source_event_id: "2027-israk-mikraj-december" },
      ],
    },
  },
  wa_public_holiday: {
    label: "Western Australia public holidays",
    description: "Official WA public holiday dates, including observed substitute days.",
    defaultColor: "blue",
    defaultType: "event",
    yearNotes: {
      2026: "Whole-of-state WA dates. Some regional areas observe an alternative King's Birthday.",
      2027: "Whole-of-state WA dates. Some regional areas observe an alternative King's Birthday.",
    },
    eventsByYear: {
      2026: [
        { event_date: "2026-01-01", title: "New Year's Day", source_event_id: "2026-new-years-day" },
        { event_date: "2026-01-26", title: "Australia Day", source_event_id: "2026-australia-day" },
        { event_date: "2026-03-02", title: "Labour Day", source_event_id: "2026-labour-day" },
        { event_date: "2026-04-03", title: "Good Friday", source_event_id: "2026-good-friday" },
        { event_date: "2026-04-05", title: "Easter Sunday", source_event_id: "2026-easter-sunday" },
        { event_date: "2026-04-06", title: "Easter Monday", source_event_id: "2026-easter-monday" },
        { event_date: "2026-04-25", title: "Anzac Day", source_event_id: "2026-anzac-day" },
        { event_date: "2026-04-27", title: "Anzac Day (observed)", source_event_id: "2026-anzac-day-observed" },
        { event_date: "2026-06-01", title: "Western Australia Day", source_event_id: "2026-wa-day" },
        { event_date: "2026-09-28", title: "King's Birthday", source_event_id: "2026-kings-birthday" },
        { event_date: "2026-12-25", title: "Christmas Day", source_event_id: "2026-christmas-day" },
        { event_date: "2026-12-26", title: "Boxing Day", source_event_id: "2026-boxing-day" },
        { event_date: "2026-12-28", title: "Boxing Day (observed)", source_event_id: "2026-boxing-day-observed" },
      ],
      2027: [
        { event_date: "2027-01-01", title: "New Year's Day", source_event_id: "2027-new-years-day" },
        { event_date: "2027-01-26", title: "Australia Day", source_event_id: "2027-australia-day" },
        { event_date: "2027-03-01", title: "Labour Day", source_event_id: "2027-labour-day" },
        { event_date: "2027-03-26", title: "Good Friday", source_event_id: "2027-good-friday" },
        { event_date: "2027-03-28", title: "Easter Sunday", source_event_id: "2027-easter-sunday" },
        { event_date: "2027-03-29", title: "Easter Monday", source_event_id: "2027-easter-monday" },
        { event_date: "2027-04-25", title: "Anzac Day", source_event_id: "2027-anzac-day" },
        { event_date: "2027-04-26", title: "Anzac Day (observed)", source_event_id: "2027-anzac-day-observed" },
        { event_date: "2027-06-07", title: "Western Australia Day", source_event_id: "2027-wa-day" },
        { event_date: "2027-09-27", title: "King's Birthday", source_event_id: "2027-kings-birthday" },
        { event_date: "2027-12-25", title: "Christmas Day", source_event_id: "2027-christmas-day" },
        { event_date: "2027-12-27", title: "Christmas Day (observed)", source_event_id: "2027-christmas-day-observed" },
        { event_date: "2027-12-26", title: "Boxing Day", source_event_id: "2027-boxing-day" },
        { event_date: "2027-12-28", title: "Boxing Day (observed)", source_event_id: "2027-boxing-day-observed" },
      ],
    },
  },
  malaysia_public_holiday: {
    label: "Malaysia public holidays",
    description: "Federal and nationwide Malaysia public holidays, with observed substitutes where applicable.",
    defaultColor: "amber",
    defaultType: "event",
    yearNotes: {
      2026: MALAYSIA_FEDERAL_NOTE,
    },
    eventsByYear: {
      2026: [
        { event_date: "2026-01-01", title: "New Year's Day", source_event_id: "2026-new-years-day" },
        { event_date: "2026-02-17", title: "Chinese New Year", source_event_id: "2026-chinese-new-year-day-1" },
        { event_date: "2026-02-18", title: "Chinese New Year (2nd day)", source_event_id: "2026-chinese-new-year-day-2" },
        {
          event_date: "2026-03-20",
          title: "Hari Raya Aidilfitri (additional holiday)",
          source_event_id: "2026-hari-raya-aidilfitri-additional",
        },
        { event_date: "2026-03-21", title: "Hari Raya Aidilfitri", source_event_id: "2026-hari-raya-aidilfitri-day-1" },
        {
          event_date: "2026-03-22",
          title: "Hari Raya Aidilfitri (2nd day)",
          source_event_id: "2026-hari-raya-aidilfitri-day-2",
        },
        {
          event_date: "2026-03-23",
          title: "Hari Raya Aidilfitri (observed)",
          source_event_id: "2026-hari-raya-aidilfitri-observed",
        },
        { event_date: "2026-05-01", title: "Labour Day", source_event_id: "2026-labour-day" },
        { event_date: "2026-05-27", title: "Hari Raya Aidiladha", source_event_id: "2026-hari-raya-aidiladha" },
        { event_date: "2026-05-31", title: "Wesak Day", source_event_id: "2026-wesak-day" },
        {
          event_date: "2026-06-01",
          title: "Birthday of the Yang di-Pertuan Agong",
          source_event_id: "2026-agong-birthday",
        },
        { event_date: "2026-06-17", title: "Awal Muharram", source_event_id: "2026-awal-muharram" },
        { event_date: "2026-08-25", title: "Maulidur Rasul", source_event_id: "2026-maulidur-rasul" },
        { event_date: "2026-08-31", title: "National Day", source_event_id: "2026-national-day" },
        { event_date: "2026-09-16", title: "Malaysia Day", source_event_id: "2026-malaysia-day" },
        { event_date: "2026-11-08", title: "Deepavali", source_event_id: "2026-deepavali" },
        { event_date: "2026-11-09", title: "Deepavali (observed)", source_event_id: "2026-deepavali-observed" },
        { event_date: "2026-12-25", title: "Christmas Day", source_event_id: "2026-christmas-day" },
      ],
    },
  },
};

export function getCalendarImportOptions(): CalendarImportOption[] {
  return (Object.entries(definitions) as [CalendarImportSource, CalendarSourceDefinition][])
    .map(([source, definition]) => ({
      source,
      label: definition.label,
      description: definition.description,
      supportedYears: getSupportedCalendarImportYears(source),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getSupportedCalendarImportYears(source: CalendarImportSource): number[] {
  return Object.keys(definitions[source].eventsByYear)
    .map(Number)
    .sort((left, right) => left - right);
}

export function isCalendarImportSupported(source: CalendarImportSource, year: number): boolean {
  return Boolean(definitions[source].eventsByYear[year]?.length);
}

export function getCalendarSourceEvents(source: CalendarImportSource, year: number) {
  const definition = definitions[source];
  const items = definition.eventsByYear[year];

  if (!items?.length) {
    throw new Error(`${definition.label} are not available for ${year} yet.`);
  }

  const note = definition.yearNotes?.[year];

  return items.map((item) => ({
    event_date: item.event_date,
    title: item.title,
    note: item.note ?? note,
    event_type: item.event_type ?? definition.defaultType,
    color: item.color ?? definition.defaultColor,
    source_event_id: item.source_event_id,
    source_label: definition.label,
  }));
}

export function getCalendarImportLabel(source: CalendarImportSource): string {
  return definitions[source].label;
}

export function normalizeCalendarTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

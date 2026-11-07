export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type FridgeList = {
  created_at: string;
  id: string;
  name: string;
  pin_code: string;
};

export type Item = {
  checked_at: string | null;
  created_at: string;
  id: string;
  is_checked: boolean;
  list_id: string;
  text: string;
  /** Member who added the item; null for items added before tracking began. */
  created_by?: string | null;
  /** Member credited on a shared device ("who's adding?"); null = created_by. */
  added_by?: string | null;
  /** A to-do that comes back: ticking it records last_done_at instead of checking it off. */
  is_routine?: boolean;
  /** Optional "every N days" for a routine; null = just track when it was last done. */
  repeat_days?: number | null;
  last_done_at?: string | null;
  last_done_by?: string | null;
};

export type PrayerMethod =
  | "MuslimWorldLeague"
  | "Egyptian"
  | "Karachi"
  | "UmmAlQura"
  | "Dubai"
  | "MoonsightingCommittee"
  | "NorthAmerica"
  | "Kuwait"
  | "Qatar"
  | "Singapore"
  | "Tehran"
  | "Turkey";

export type HouseholdSettings = {
  pin_code: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  prayer_enabled: boolean;
  prayer_method: PrayerMethod;
  prayer_madhab: "shafi" | "hanafi";
  athan_enabled: boolean;
  updated_at: string;
};

/** Someone who signed up and joined the household (household_members()). */
export type HouseholdMember = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  /** When they joined (missing before the household_people migration). */
  joined_at?: string | null;
  /** Can manage the household: admins, members, people without an account. */
  is_admin?: boolean;
};

/** Colour a person is shown in (tags, chips, avatars). */
export type PersonColor = "sage" | "clay" | "blue" | "lilac" | "sand" | "rose";

/**
 * Someone the household plans around. With user_id: an account member's
 * colour (their name comes from their profile). Without: a person with no
 * account, such as a child.
 */
export type HouseholdPerson = {
  id: string;
  pin_code: string;
  user_id: string | null;
  name: string;
  color: PersonColor;
  created_at: string;
};

export type CalendarEventType = "event" | "reminder" | "todo";
export type StickyColor = "amber" | "blue" | "rose" | "green" | "purple";
export type Recurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
export type NotifyChannel = "email" | "telegram" | "webhook";
export type CalendarSourceType = "manual" | "islamic" | "wa_public_holiday" | "malaysia_public_holiday";
export type CalendarImportSource = Exclude<CalendarSourceType, "manual">;

export type CalendarEvent = {
  id: string;
  pin_code: string;
  event_date: string;
  /** Time in HH:MM (24-hour) format. Null for all-day events. */
  event_time: string | null;
  title: string;
  note: string | null;
  event_type: CalendarEventType;
  color: StickyColor;
  is_done: boolean;
  recurrence: Recurrence;
  recurrence_end: string | null;
  /** Last day of a multi-day event (YYYY-MM-DD); null = single day. */
  end_date: string | null;
  notify_before: number;
  notify_channels: NotifyChannel[];
  created_at: string;
  source_type: CalendarSourceType;
  source_label: string | null;
  source_event_id: string | null;
  /** Member who added the event; null for imports and older events. */
  created_by?: string | null;
  /** Whose event it is; null = the whole household. */
  owner_id?: string | null;
  /** Whose event it is, for someone without an account (household_people). */
  owner_person_id?: string | null;
};

/** Where a shift happens. "other" is a named location (`WorkShift.location`). */
export type WorkPlace = "office" | "home" | "other";

/** One member's work hours on one day. End at or before start = overnight. */
export type WorkShift = {
  id: string;
  pin_code: string;
  user_id: string;
  /** YYYY-MM-DD */
  shift_date: string;
  /** HH:MM (24-hour) */
  start_time: string;
  /** HH:MM (24-hour) */
  end_time: string;
  note: string | null;
  /** Null = not said (shifts saved before places existed). */
  work_place: WorkPlace | null;
  /** Name of the place when `work_place` is "other". */
  location: string | null;
  created_at: string;
};

/** A virtual occurrence of a recurring event expanded onto a specific date. */
export type ExpandedCalendarEvent = CalendarEvent & {
  /** The date this occurrence falls on (may differ from event_date for recurring). */
  occurrence_date: string;
  /** True if this is a generated occurrence, not the original row. */
  is_recurrence: boolean;
  /** 1-based day of a multi-day event this entry falls on (1 for single-day). */
  day_index: number;
  /** Total days the event spans (1 for single-day). */
  day_count: number;
};

export type NotificationChannelConfig = {
  id: string;
  pin_code: string;
  channel_type: NotifyChannel;
  channel_value: string;
  label: string | null;
  is_enabled: boolean;
  created_at: string;
};

export type PushSubscriptionRecord = {
  id: string;
  pin_code: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  /** Member who owns this device; null for rows registered before tracking began. */
  user_id: string | null;
  created_at: string;
};

export type CalendarSyncToken = {
  pin_code: string;
  token: string;
  created_at: string;
};

export type Household = {
  pin_code: string;
  created_by: string | null;
  created_at: string;
};

export type UserProfile = {
  id: string;
  user_id: string;
  pin_code: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type NotificationLog = {
  id: string;
  event_id: string;
  channel_type: string;
  sent_at: string;
  status: string;
};

export type Database = {
  public: {
    Tables: {
      calendar_events: {
        Row: CalendarEvent;
        Insert: {
          id?: string;
          pin_code: string;
          event_date: string;
          event_time?: string | null;
          title: string;
          note?: string | null;
          event_type?: CalendarEventType;
          color?: StickyColor;
          is_done?: boolean;
          recurrence?: Recurrence;
          recurrence_end?: string | null;
          end_date?: string | null;
          notify_before?: number;
          notify_channels?: NotifyChannel[];
          created_at?: string;
          source_type?: CalendarSourceType;
          source_label?: string | null;
          source_event_id?: string | null;
          owner_id?: string | null;
          owner_person_id?: string | null;
        };
        Update: {
          id?: string;
          pin_code?: string;
          event_date?: string;
          event_time?: string | null;
          title?: string;
          note?: string | null;
          event_type?: CalendarEventType;
          color?: StickyColor;
          is_done?: boolean;
          recurrence?: Recurrence;
          recurrence_end?: string | null;
          end_date?: string | null;
          notify_before?: number;
          notify_channels?: NotifyChannel[];
          created_at?: string;
          source_type?: CalendarSourceType;
          source_label?: string | null;
          source_event_id?: string | null;
          owner_id?: string | null;
          owner_person_id?: string | null;
        };
        Relationships: [];
      };
      work_shifts: {
        Row: WorkShift;
        Insert: {
          id?: string;
          pin_code: string;
          user_id: string;
          shift_date: string;
          start_time: string;
          end_time: string;
          note?: string | null;
          work_place?: WorkPlace | null;
          location?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<WorkShift, "id" | "created_at">>;
        Relationships: [];
      };
      calendar_sync_tokens: {
        Row: CalendarSyncToken;
        Insert: {
          pin_code: string;
          token?: string;
          created_at?: string;
        };
        Update: {
          pin_code?: string;
          token?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_sync_tokens_pin_code_fkey";
            columns: ["pin_code"];
            isOneToOne: true;
            referencedRelation: "households";
            referencedColumns: ["pin_code"];
          },
        ];
      };
      push_subscriptions: {
        Row: PushSubscriptionRecord;
        Insert: {
          id?: string;
          pin_code: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          pin_code?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notification_channels: {
        Row: NotificationChannelConfig;
        Insert: {
          id?: string;
          pin_code: string;
          channel_type: NotifyChannel;
          channel_value: string;
          label?: string | null;
          is_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          pin_code?: string;
          channel_type?: NotifyChannel;
          channel_value?: string;
          label?: string | null;
          is_enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      items: {
        Row: Item;
        Insert: {
          checked_at?: string | null;
          created_at?: string;
          id?: string;
          is_checked?: boolean;
          list_id: string;
          text: string;
          created_by?: string | null;
          added_by?: string | null;
          is_routine?: boolean;
          repeat_days?: number | null;
          last_done_at?: string | null;
          last_done_by?: string | null;
        };
        Update: {
          checked_at?: string | null;
          created_at?: string;
          id?: string;
          is_checked?: boolean;
          list_id?: string;
          text?: string;
          is_routine?: boolean;
          repeat_days?: number | null;
          last_done_at?: string | null;
          last_done_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "items_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
      household_people: {
        Row: HouseholdPerson;
        Insert: {
          id?: string;
          pin_code: string;
          user_id?: string | null;
          name: string;
          color?: PersonColor;
          created_at?: string;
        };
        Update: { name?: string; color?: PersonColor };
        Relationships: [];
      };
      household_settings: {
        Row: HouseholdSettings;
        Insert: Partial<Omit<HouseholdSettings, "pin_code">> & { pin_code: string };
        Update: Partial<HouseholdSettings>;
        Relationships: [];
      };
      prayer_push_log: {
        Row: { pin_code: string; prayer: string; prayer_date: string; sent_at: string };
        Insert: { pin_code: string; prayer: string; prayer_date: string; sent_at?: string };
        Update: { pin_code?: string; prayer?: string; prayer_date?: string; sent_at?: string };
        Relationships: [];
      };
      item_push_log: {
        Row: { item_id: string; sent_at: string };
        Insert: { item_id: string; sent_at?: string };
        Update: { item_id?: string; sent_at?: string };
        Relationships: [];
      };
      households: {
        Row: Household;
        Insert: {
          pin_code: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          pin_code?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      lists: {
        Row: FridgeList;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          pin_code: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          pin_code?: string;
        };
        Relationships: [];
      };
      notification_log: {
        Row: NotificationLog;
        Insert: {
          id?: string;
          event_id: string;
          channel_type: string;
          sent_at?: string;
          status: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          channel_type?: string;
          sent_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: UserProfile;
        // pin_code is set only by create_household / join_household_with_invite.
        Insert: {
          user_id: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        // pin_code is set only by create_household / join_household_with_invite.
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_household: {
        Args: {
          profile_display_name?: string | null;
          profile_avatar_url?: string | null;
        };
        Returns: string;
      };
      ensure_calendar_sync_token: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_user_pin: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      set_household_admin: {
        Args: { member: string; make_admin: boolean };
        Returns: undefined;
      };
      remove_household_member: {
        Args: { member: string };
        Returns: undefined;
      };
      household_members: {
        Args: Record<string, never>;
        Returns: HouseholdMember[];
      };
      get_calendar_feed: {
        Args: {
          feed_token: string;
        };
        Returns: CalendarEvent[];
      };
      join_household_with_invite: {
        Args: {
          invite_code: string;
          profile_display_name?: string | null;
          profile_avatar_url?: string | null;
        };
        Returns: string;
      };
      create_household_invite: {
        Args: Record<string, never>;
        Returns: { code: string; expires_at: string }[];
      };
      validate_calendar_sync_token: {
        Args: {
          feed_token: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

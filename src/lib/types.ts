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
  notify_before: number;
  notify_channels: NotifyChannel[];
  created_at: string;
  source_type: CalendarSourceType;
  source_label: string | null;
  source_event_id: string | null;
  /** Who the event is for (household_people ids). Empty means the whole family. */
  person_ids?: string[];
};

export type PersonColor = "sage" | "peach" | "sky" | "lilac" | "sand" | "rose";

/** Someone the household plans around; they don't need an account. */
export type HouseholdPerson = {
  id: string;
  pin_code: string;
  name: string;
  color: PersonColor;
  sort_order: number;
  created_at: string;
};

/** A virtual occurrence of a recurring event expanded onto a specific date. */
export type ExpandedCalendarEvent = CalendarEvent & {
  /** The date this occurrence falls on (may differ from event_date for recurring). */
  occurrence_date: string;
  /** True if this is a generated occurrence, not the original row. */
  is_recurrence: boolean;
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
          notify_before?: number;
          notify_channels?: NotifyChannel[];
          person_ids?: string[];
          created_at?: string;
          source_type?: CalendarSourceType;
          source_label?: string | null;
          source_event_id?: string | null;
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
          notify_before?: number;
          notify_channels?: NotifyChannel[];
          person_ids?: string[];
          created_at?: string;
          source_type?: CalendarSourceType;
          source_label?: string | null;
          source_event_id?: string | null;
        };
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
        };
        Update: {
          checked_at?: string | null;
          created_at?: string;
          id?: string;
          is_checked?: boolean;
          list_id?: string;
          text?: string;
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
      household_people: {
        Row: HouseholdPerson;
        Insert: {
          pin_code: string;
          name: string;
          color?: PersonColor;
          sort_order?: number;
        };
        Update: {
          name?: string;
          color?: PersonColor;
          sort_order?: number;
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

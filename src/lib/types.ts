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
};

export type CalendarEventType = "event" | "reminder" | "todo";
export type StickyColor = "amber" | "blue" | "rose" | "green" | "purple";
export type Recurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
export type NotifyChannel = "email" | "telegram" | "webhook";
export type CalendarSourceType =
  | "manual"
  | "islamic"
  | "wa_public_holiday"
  | "malaysia_public_holiday"
  | "google_calendar"
  | "caldav";
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
  google_event_id: string | null;
  updated_at: string;
};

export type GoogleCalendarToken = {
  pin_code: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  google_calendar_id: string;
  sync_token: string | null;
  watch_channel_id: string | null;
  watch_resource_id: string | null;
  watch_expiration: string | null;
  created_at: string;
  updated_at: string;
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
          created_at?: string;
          source_type?: CalendarSourceType;
          source_label?: string | null;
          source_event_id?: string | null;
          google_event_id?: string | null;
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
          created_at?: string;
          updated_at?: string;
          source_type?: CalendarSourceType;
          source_label?: string | null;
          source_event_id?: string | null;
          google_event_id?: string | null;
        };
        Relationships: [];
      };
      google_calendar_tokens: {
        Row: GoogleCalendarToken;
        Insert: {
          pin_code: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          google_calendar_id?: string;
          sync_token?: string | null;
          watch_channel_id?: string | null;
          watch_resource_id?: string | null;
          watch_expiration?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          pin_code?: string;
          access_token?: string;
          refresh_token?: string;
          expires_at?: string;
          google_calendar_id?: string;
          sync_token?: string | null;
          watch_channel_id?: string | null;
          watch_resource_id?: string | null;
          watch_expiration?: string | null;
          updated_at?: string;
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
          created_at?: string;
        };
        Update: {
          id?: string;
          pin_code?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
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
        Insert: {
          id?: string;
          user_id: string;
          pin_code?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pin_code?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
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
      join_household: {
        Args: {
          target_pin: string;
          profile_display_name?: string | null;
          profile_avatar_url?: string | null;
        };
        Returns: string;
      };
      validate_calendar_sync_token: {
        Args: {
          feed_token: string;
        };
        Returns: boolean;
      };
      pin_for_sync_token: {
        Args: { feed_token: string };
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

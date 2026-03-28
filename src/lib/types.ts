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

export type CalendarEvent = {
  id: string;
  pin_code: string;
  event_date: string;
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

export type Database = {
  public: {
    Tables: {
      calendar_events: {
        Row: CalendarEvent;
        Insert: {
          id?: string;
          pin_code: string;
          event_date: string;
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
        };
        Update: {
          id?: string;
          pin_code?: string;
          event_date?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

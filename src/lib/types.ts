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

export type Database = {
  public: {
    Tables: {
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

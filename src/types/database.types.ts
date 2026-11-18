export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'completed' | 'cancelled';
export type NotificationMode = 'ring' | 'blink' | 'both' | 'silent';
export type AlarmSoundId = 'chime' | 'bell' | 'pulse' | 'gentle';

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          description: string | null;
          scheduled_at: string | null;
          timezone: string;
          priority: TaskPriority;
          status: TaskStatus;
          snoozed_until: string | null;
          last_reminded_at: string | null;
          reminder_dismissed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          description?: string | null;
          scheduled_at?: string | null;
          timezone?: string;
          priority?: TaskPriority;
          status?: TaskStatus;
          snoozed_until?: string | null;
          last_reminded_at?: string | null;
          reminder_dismissed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          description?: string | null;
          scheduled_at?: string | null;
          timezone?: string;
          priority?: TaskPriority;
          status?: TaskStatus;
          snoozed_until?: string | null;
          last_reminded_at?: string | null;
          reminder_dismissed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      notes: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          content: string;
          is_pinned: boolean;
          category: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title?: string;
          content?: string;
          is_pinned?: boolean;
          category?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          content?: string;
          is_pinned?: boolean;
          category?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          enabled: boolean;
          mode: NotificationMode;
          sound: AlarmSoundId;
          volume: number;
          browser_notifications_enabled: boolean;
          push_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          mode?: NotificationMode;
          sound?: AlarmSoundId;
          volume?: number;
          browser_notifications_enabled?: boolean;
          push_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          enabled?: boolean;
          mode?: NotificationMode;
          sound?: AlarmSoundId;
          volume?: number;
          browser_notifications_enabled?: boolean;
          push_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      reminder_delivery_logs: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          scheduled_for: string;
          channel: string;
          status: string;
          delivered_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          scheduled_for: string;
          channel?: string;
          status?: string;
          delivered_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          scheduled_for?: string;
          channel?: string;
          status?: string;
          delivered_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_delivery_logs_task_id_fkey";
            columns: ["task_id"];
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type Task = Database['public']['Tables']['tasks']['Row'];
export type CreateTaskInput = Omit<Database['public']['Tables']['tasks']['Insert'], 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type UpdateTaskInput = Partial<CreateTaskInput>;

export type Note = Database['public']['Tables']['notes']['Row'];
export type CreateNoteInput = Omit<Database['public']['Tables']['notes']['Insert'], 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type UpdateNoteInput = Partial<CreateNoteInput>;

export type NotificationPreferences = Omit<
  Database['public']['Tables']['notification_preferences']['Row'],
  'user_id' | 'created_at' | 'updated_at'
>;

export interface TaskSummary {
  total: number;
  pending: number;
  completed: number;
  upcoming: Task[];
}

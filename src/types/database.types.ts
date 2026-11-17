export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'completed' | 'cancelled';

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          scheduled_at: string | null;
          timezone: string;
          priority: TaskPriority;
          status: TaskStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          scheduled_at?: string | null;
          timezone?: string;
          priority?: TaskPriority;
          status?: TaskStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          scheduled_at?: string | null;
          timezone?: string;
          priority?: TaskPriority;
          status?: TaskStatus;
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
          user_id: string;
          title: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
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

export interface TaskSummary {
  total: number;
  pending: number;
  completed: number;
  upcoming: Task[];
}

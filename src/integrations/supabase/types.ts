export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_machines: {
        Row: {
          audit_id: string
          machine_id: string
        }
        Insert: {
          audit_id: string
          machine_id: string
        }
        Update: {
          audit_id?: string
          machine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_machines_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_responses: {
        Row: {
          audit_id: string
          comment: string | null
          created_at: string
          criteria_id: string
          gap: string | null
          id: string
          photo_url: string | null
          question_id: string
          score: number | null
          suggested_action: string | null
        }
        Insert: {
          audit_id: string
          comment?: string | null
          created_at?: string
          criteria_id: string
          gap?: string | null
          id?: string
          photo_url?: string | null
          question_id: string
          score?: number | null
          suggested_action?: string | null
        }
        Update: {
          audit_id?: string
          comment?: string | null
          created_at?: string
          criteria_id?: string
          gap?: string | null
          id?: string
          photo_url?: string | null
          question_id?: string
          score?: number | null
          suggested_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_responses_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_responses_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          audit_date: string
          auditor: string
          created_at: string
          global_score: number | null
          id: string
          status: string
          workshop_id: string | null
          zone_id: string | null
        }
        Insert: {
          audit_date?: string
          auditor: string
          created_at?: string
          global_score?: number | null
          id?: string
          status?: string
          workshop_id?: string | null
          zone_id?: string | null
        }
        Update: {
          audit_date?: string
          auditor?: string
          created_at?: string
          global_score?: number | null
          id?: string
          status?: string
          workshop_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audits_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          audit_id: string | null
          completed_at: string | null
          created_at: string
          criteria_id: string | null
          description: string
          due_date: string | null
          id: string
          responsible: string | null
          status: string
        }
        Insert: {
          audit_id?: string | null
          completed_at?: string | null
          created_at?: string
          criteria_id?: string | null
          description: string
          due_date?: string | null
          id?: string
          responsible?: string | null
          status?: string
        }
        Update: {
          audit_id?: string | null
          completed_at?: string | null
          created_at?: string
          criteria_id?: string | null
          description?: string
          due_date?: string | null
          id?: string
          responsible?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      criteria: {
        Row: {
          code: string
          description: string | null
          id: string
          name: string
          order_index: number
          weight: number
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          weight?: number
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          weight?: number
        }
        Relationships: []
      }
      machines: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
          status: string | null
          zone_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string | null
          zone_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          criteria_id: string
          id: string
          order_index: number
          text: string
        }
        Insert: {
          criteria_id: string
          id?: string
          order_index?: number
          text: string
        }
        Update: {
          criteria_id?: string
          id?: string
          order_index?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          created_at: string
          description: string | null
          id: string
          manager: string | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          manager?: string | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          manager?: string | null
          name?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          created_at: string
          id: string
          name: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      customer_snapshots: {
        Row: {
          created_at: string
          customer_id: number
          id: number
          month: string
          mrr: number
          plan_handle: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: number
          id?: never
          month: string
          mrr?: number
          plan_handle?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: number
          id?: never
          month?: string
          mrr?: number
          plan_handle?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_snapshots_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          churn_date: string | null
          clickup_folder_id: string | null
          created_at: string
          cvr: string | null
          email: string | null
          frisbii_handle: string
          hubspot_company_id: string | null
          id: number
          match_confidence: string
          name: string
          partner: string | null
          plan_handle: string | null
          segment: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          churn_date?: string | null
          clickup_folder_id?: string | null
          created_at?: string
          cvr?: string | null
          email?: string | null
          frisbii_handle: string
          hubspot_company_id?: string | null
          id?: never
          match_confidence?: string
          name: string
          partner?: string | null
          plan_handle?: string | null
          segment?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          churn_date?: string | null
          clickup_folder_id?: string | null
          created_at?: string
          cvr?: string | null
          email?: string | null
          frisbii_handle?: string
          hubspot_company_id?: string | null
          id?: never
          match_confidence?: string
          name?: string
          partner?: string | null
          plan_handle?: string | null
          segment?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          created_at: string
          eur_rate: number
          id: number
          locked_at: string
          month: string
          usd_rate: number
        }
        Insert: {
          created_at?: string
          eur_rate: number
          id?: never
          locked_at?: string
          month: string
          usd_rate: number
        }
        Update: {
          created_at?: string
          eur_rate?: number
          id?: never
          locked_at?: string
          month?: string
          usd_rate?: number
        }
        Relationships: []
      }
      metric_snapshots: {
        Row: {
          arpc: number
          arr: number
          churn_rate: number
          created_at: string
          currency: string
          customer_count: number
          date: string
          id: number
          mrr: number
          net_new_mrr: number
          updated_at: string
        }
        Insert: {
          arpc: number
          arr: number
          churn_rate: number
          created_at?: string
          currency?: string
          customer_count: number
          date: string
          id?: never
          mrr: number
          net_new_mrr: number
          updated_at?: string
        }
        Update: {
          arpc?: number
          arr?: number
          churn_rate?: number
          created_at?: string
          currency?: string
          customer_count?: number
          date?: string
          id?: never
          mrr?: number
          net_new_mrr?: number
          updated_at?: string
        }
        Relationships: []
      }
      monthly_snapshots: {
        Row: {
          arpa: number
          arr: number
          churned_logos: number
          churned_mrr: number
          contraction_mrr: number
          created_at: string
          customer_count: number
          executive_summary: string | null
          expansion_mrr: number
          grr: number | null
          highlights: string | null
          id: number
          logo_retention_rate: number | null
          lowlights: string | null
          month: string
          mrr: number
          mrr_growth_mom: number | null
          mrr_growth_yoy: number | null
          net_new_mrr: number
          new_logos: number
          new_mrr: number
          non_recurring_revenue: number
          nrr: number | null
          quick_ratio: number | null
          top10_concentration: number | null
          updated_at: string
          whats_ahead: string | null
        }
        Insert: {
          arpa?: number
          arr?: number
          churned_logos?: number
          churned_mrr?: number
          contraction_mrr?: number
          created_at?: string
          customer_count?: number
          executive_summary?: string | null
          expansion_mrr?: number
          grr?: number | null
          highlights?: string | null
          id?: never
          logo_retention_rate?: number | null
          lowlights?: string | null
          month: string
          mrr?: number
          mrr_growth_mom?: number | null
          mrr_growth_yoy?: number | null
          net_new_mrr?: number
          new_logos?: number
          new_mrr?: number
          non_recurring_revenue?: number
          nrr?: number | null
          quick_ratio?: number | null
          top10_concentration?: number | null
          updated_at?: string
          whats_ahead?: string | null
        }
        Update: {
          arpa?: number
          arr?: number
          churned_logos?: number
          churned_mrr?: number
          contraction_mrr?: number
          created_at?: string
          customer_count?: number
          executive_summary?: string | null
          expansion_mrr?: number
          grr?: number | null
          highlights?: string | null
          id?: never
          logo_retention_rate?: number | null
          lowlights?: string | null
          month?: string
          mrr?: number
          mrr_growth_mom?: number | null
          mrr_growth_yoy?: number | null
          net_new_mrr?: number
          new_logos?: number
          new_mrr?: number
          non_recurring_revenue?: number
          nrr?: number | null
          quick_ratio?: number | null
          top10_concentration?: number | null
          updated_at?: string
          whats_ahead?: string | null
        }
        Relationships: []
      }
      pipeline_snapshots: {
        Row: {
          avg_deal_size: number
          avg_sales_cycle_days: number
          created_at: string
          deals_json: Json | null
          deals_lost: number
          deals_open: number
          deals_won: number
          id: number
          month: string
          total_pipeline_value: number
          updated_at: string
          weighted_pipeline: number
          win_rate: number | null
        }
        Insert: {
          avg_deal_size?: number
          avg_sales_cycle_days?: number
          created_at?: string
          deals_json?: Json | null
          deals_lost?: number
          deals_open?: number
          deals_won?: number
          id?: never
          month: string
          total_pipeline_value?: number
          updated_at?: string
          weighted_pipeline?: number
          win_rate?: number | null
        }
        Update: {
          avg_deal_size?: number
          avg_sales_cycle_days?: number
          created_at?: string
          deals_json?: Json | null
          deals_lost?: number
          deals_open?: number
          deals_won?: number
          id?: never
          month?: string
          total_pipeline_value?: number
          updated_at?: string
          weighted_pipeline?: number
          win_rate?: number | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          employee_count: number | null
          id: number
          month: string
          notes: string | null
          total_cac: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_count?: number | null
          id?: never
          month: string
          notes?: string | null
          total_cac?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_count?: number | null
          id?: never
          month?: string
          notes?: string | null
          total_cac?: number | null
          updated_at?: string | null
        }
        Relationships: []
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

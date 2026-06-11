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
      activity_snapshots: {
        Row: {
          calls_made: number | null
          created_at: string | null
          date: string
          emails_sent: number | null
          id: number
          meetings_booked: number | null
          owner_id: string
          owner_name: string | null
        }
        Insert: {
          calls_made?: number | null
          created_at?: string | null
          date: string
          emails_sent?: number | null
          id?: number
          meetings_booked?: number | null
          owner_id: string
          owner_name?: string | null
        }
        Update: {
          calls_made?: number | null
          created_at?: string | null
          date?: string
          emails_sent?: number | null
          id?: number
          meetings_booked?: number | null
          owner_id?: string
          owner_name?: string | null
        }
        Relationships: []
      }
      alert_events: {
        Row: {
          created_at: string
          emailed_at: string | null
          id: number
          message: string
          month: string
          rule: string
          severity: string
        }
        Insert: {
          created_at?: string
          emailed_at?: string | null
          id?: never
          message: string
          month: string
          rule: string
          severity: string
        }
        Update: {
          created_at?: string
          emailed_at?: string | null
          id?: never
          message?: string
          month?: string
          rule?: string
          severity?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          changed_at: string
          changed_by: string
          entity_id: string
          entity_type: string
          field: string
          id: number
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string
          entity_id: string
          entity_type: string
          field: string
          id?: never
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          entity_id?: string
          entity_type?: string
          field?: string
          id?: never
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      channel_metrics: {
        Row: {
          avg_deal_size: number | null
          avg_sales_cycle_days: number | null
          cac: number | null
          channel: string
          created_at: string | null
          deals_created: number | null
          deals_lost: number | null
          deals_won: number | null
          id: number
          month: string
          new_logos: number | null
          new_mrr: number | null
          pipeline_value: number | null
          win_rate: number | null
        }
        Insert: {
          avg_deal_size?: number | null
          avg_sales_cycle_days?: number | null
          cac?: number | null
          channel: string
          created_at?: string | null
          deals_created?: number | null
          deals_lost?: number | null
          deals_won?: number | null
          id?: number
          month: string
          new_logos?: number | null
          new_mrr?: number | null
          pipeline_value?: number | null
          win_rate?: number | null
        }
        Update: {
          avg_deal_size?: number | null
          avg_sales_cycle_days?: number | null
          cac?: number | null
          channel?: string
          created_at?: string | null
          deals_created?: number | null
          deals_lost?: number | null
          deals_won?: number | null
          id?: number
          month?: string
          new_logos?: number | null
          new_mrr?: number | null
          pipeline_value?: number | null
          win_rate?: number | null
        }
        Relationships: []
      }
      customer_links: {
        Row: {
          canonical_handle: string
          confidence: string
          created_at: string
          created_by: string
          cvr: string | null
          id: number
          linked_handle: string
          match_method: string
          status: string
          updated_at: string
        }
        Insert: {
          canonical_handle: string
          confidence?: string
          created_at?: string
          created_by?: string
          cvr?: string | null
          id?: never
          linked_handle: string
          match_method: string
          status?: string
          updated_at?: string
        }
        Update: {
          canonical_handle?: string
          confidence?: string
          created_at?: string
          created_by?: string
          cvr?: string | null
          id?: never
          linked_handle?: string
          match_method?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_snapshots: {
        Row: {
          created_at: string
          customer_id: number
          id: number
          month: string
          mrr: number
          plan_handle: string | null
          plan_name: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: number
          id?: never
          month: string
          mrr?: number
          plan_handle?: string | null
          plan_name?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: number
          id?: never
          month?: string
          mrr?: number
          plan_handle?: string | null
          plan_name?: string | null
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
          company_name: string | null
          created_at: string
          cvr: string | null
          email: string | null
          excluded: boolean
          frisbii_handle: string
          hubspot_company_id: string | null
          id: number
          lead_source: string | null
          match_confidence: string
          name: string
          partner: string | null
          plan_handle: string | null
          plan_name: string | null
          scope_override: string | null
          segment: string | null
          start_date: string | null
          status: string
          tier_override: string | null
          updated_at: string
        }
        Insert: {
          churn_date?: string | null
          clickup_folder_id?: string | null
          company_name?: string | null
          created_at?: string
          cvr?: string | null
          email?: string | null
          excluded?: boolean
          frisbii_handle: string
          hubspot_company_id?: string | null
          id?: never
          lead_source?: string | null
          match_confidence?: string
          name: string
          partner?: string | null
          plan_handle?: string | null
          plan_name?: string | null
          scope_override?: string | null
          segment?: string | null
          start_date?: string | null
          status?: string
          tier_override?: string | null
          updated_at?: string
        }
        Update: {
          churn_date?: string | null
          clickup_folder_id?: string | null
          company_name?: string | null
          created_at?: string
          cvr?: string | null
          email?: string | null
          excluded?: boolean
          frisbii_handle?: string
          hubspot_company_id?: string | null
          id?: never
          lead_source?: string | null
          match_confidence?: string
          name?: string
          partner?: string | null
          plan_handle?: string | null
          plan_name?: string | null
          scope_override?: string | null
          segment?: string | null
          start_date?: string | null
          status?: string
          tier_override?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      digest_sends: {
        Row: {
          id: number
          month: string
          recipients: string
          resend_id: string | null
          sent_at: string
        }
        Insert: {
          id?: never
          month: string
          recipients: string
          resend_id?: string | null
          sent_at?: string
        }
        Update: {
          id?: never
          month?: string
          recipients?: string
          resend_id?: string | null
          sent_at?: string
        }
        Relationships: []
      }
      discount_snapshots: {
        Row: {
          created_at: string | null
          customer_id: number | null
          discount_amount: number | null
          discount_handle: string
          discount_name: string | null
          discount_percentage: number | null
          discount_type: string | null
          expires_at: string | null
          id: number
          month: string
          monthly_impact: number | null
          subscription_handle: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: number | null
          discount_amount?: number | null
          discount_handle: string
          discount_name?: string | null
          discount_percentage?: number | null
          discount_type?: string | null
          expires_at?: string | null
          id?: never
          month: string
          monthly_impact?: number | null
          subscription_handle: string
        }
        Update: {
          created_at?: string | null
          customer_id?: number | null
          discount_amount?: number | null
          discount_handle?: string
          discount_name?: string | null
          discount_percentage?: number | null
          discount_type?: string | null
          expires_at?: string | null
          id?: never
          month?: string
          monthly_impact?: number | null
          subscription_handle?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_snapshots_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_assumptions: {
        Row: {
          avg_new_deal_size: number
          created_at: string | null
          id: number
          monthly_churn_pct: number
          monthly_expansion_pct: number
          new_logos_per_month: number
          pipeline_conversion_pct: number
          scenario: string
          updated_at: string | null
        }
        Insert: {
          avg_new_deal_size?: number
          created_at?: string | null
          id?: never
          monthly_churn_pct?: number
          monthly_expansion_pct?: number
          new_logos_per_month?: number
          pipeline_conversion_pct?: number
          scenario: string
          updated_at?: string | null
        }
        Update: {
          avg_new_deal_size?: number
          created_at?: string | null
          id?: never
          monthly_churn_pct?: number
          monthly_expansion_pct?: number
          new_logos_per_month?: number
          pipeline_conversion_pct?: number
          scenario?: string
          updated_at?: string | null
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
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          token?: string
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
          churned_mrr_event: number
          contraction_mrr: number
          created_at: string
          customer_count: number
          executive_summary: string | null
          expansion_mrr: number
          grr: number | null
          highlights: string | null
          id: number
          locked_at: string | null
          logo_retention_rate: number | null
          lowlights: string | null
          month: string
          mrr: number
          mrr_growth_mom: number | null
          mrr_growth_yoy: number | null
          net_new_mrr: number
          new_logos: number
          new_paying_logos: number | null
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
          churned_mrr_event?: number
          contraction_mrr?: number
          created_at?: string
          customer_count?: number
          executive_summary?: string | null
          expansion_mrr?: number
          grr?: number | null
          highlights?: string | null
          id?: never
          locked_at?: string | null
          logo_retention_rate?: number | null
          lowlights?: string | null
          month: string
          mrr?: number
          mrr_growth_mom?: number | null
          mrr_growth_yoy?: number | null
          net_new_mrr?: number
          new_logos?: number
          new_paying_logos?: number | null
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
          churned_mrr_event?: number
          contraction_mrr?: number
          created_at?: string
          customer_count?: number
          executive_summary?: string | null
          expansion_mrr?: number
          grr?: number | null
          highlights?: string | null
          id?: never
          locked_at?: string | null
          logo_retention_rate?: number | null
          lowlights?: string | null
          month?: string
          mrr?: number
          mrr_growth_mom?: number | null
          mrr_growth_yoy?: number | null
          net_new_mrr?: number
          new_logos?: number
          new_paying_logos?: number | null
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
      budget_entries: {
        Row: {
          budget: number | null
          created_at: string
          id: number
          metric_key: string
          month: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          id?: number
          metric_key: string
          month: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          id?: number
          metric_key?: string
          month?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_targets: {
        Row: {
          created_at: string | null
          id: number
          month: string
          target_calls: number | null
          target_meetings: number | null
          target_new_logos: number | null
          target_new_mrr: number | null
          target_pipeline: number | null
          updated_at: string | null
          use_hubspot_defaults: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          month: string
          target_calls?: number | null
          target_meetings?: number | null
          target_new_logos?: number | null
          target_new_mrr?: number | null
          target_pipeline?: number | null
          updated_at?: string | null
          use_hubspot_defaults?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: number
          month?: string
          target_calls?: number | null
          target_meetings?: number | null
          target_new_logos?: number | null
          target_new_mrr?: number | null
          target_pipeline?: number | null
          updated_at?: string | null
          use_hubspot_defaults?: boolean | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          cac_inbound: number | null
          cac_outbound: number | null
          cac_partner: number | null
          created_at: string | null
          employee_count: number | null
          gross_margin_pct: number | null
          id: number
          month: string
          monthly_burn: number | null
          monthly_cogs: number | null
          notes: string | null
          total_cac: number | null
          updated_at: string | null
        }
        Insert: {
          cac_inbound?: number | null
          cac_outbound?: number | null
          cac_partner?: number | null
          created_at?: string | null
          employee_count?: number | null
          gross_margin_pct?: number | null
          id?: never
          month: string
          monthly_burn?: number | null
          monthly_cogs?: number | null
          notes?: string | null
          total_cac?: number | null
          updated_at?: string | null
        }
        Update: {
          cac_inbound?: number | null
          cac_outbound?: number | null
          cac_partner?: number | null
          created_at?: string | null
          employee_count?: number | null
          gross_margin_pct?: number | null
          id?: never
          month?: string
          monthly_burn?: number | null
          monthly_cogs?: number | null
          notes?: string | null
          total_cac?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_exclusions: {
        Row: {
          created_at: string
          customer_handle: string
          excluded_by: string
          id: number
          reason: string
          replacement_subscription_handle: string | null
          subscription_handle: string
        }
        Insert: {
          created_at?: string
          customer_handle: string
          excluded_by: string
          id?: never
          reason: string
          replacement_subscription_handle?: string | null
          subscription_handle: string
        }
        Update: {
          created_at?: string
          customer_handle?: string
          excluded_by?: string
          id?: never
          reason?: string
          replacement_subscription_handle?: string | null
          subscription_handle?: string
        }
        Relationships: []
      }
      sync_audit_log: {
        Row: {
          actual_value: string | null
          check_name: string
          created_at: string
          delta: number | null
          details: string | null
          expected_value: string | null
          id: number
          month: string
          status: string
          sync_run_at: string
        }
        Insert: {
          actual_value?: string | null
          check_name: string
          created_at?: string
          delta?: number | null
          details?: string | null
          expected_value?: string | null
          id?: never
          month: string
          status: string
          sync_run_at: string
        }
        Update: {
          actual_value?: string | null
          check_name?: string
          created_at?: string
          delta?: number | null
          details?: string | null
          expected_value?: string | null
          id?: never
          month?: string
          status?: string
          sync_run_at?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: number
          metadata: Json | null
          module: string
          month: string | null
          records_fetched: number | null
          records_upserted: number | null
          started_at: string
          status: string
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: number
          metadata?: Json | null
          module: string
          month?: string | null
          records_fetched?: number | null
          records_upserted?: number | null
          started_at?: string
          status: string
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: number
          metadata?: Json | null
          module?: string
          month?: string | null
          records_fetched?: number | null
          records_upserted?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      ticket_snapshots: {
        Row: {
          category: string | null
          closed_date: string | null
          created_at: string | null
          created_date: string | null
          customer_id: number | null
          hubspot_ticket_id: string
          id: number
          month: string
          owner_id: string | null
          priority: string | null
          resolution_time_hours: number | null
          status: string | null
          subject: string | null
        }
        Insert: {
          category?: string | null
          closed_date?: string | null
          created_at?: string | null
          created_date?: string | null
          customer_id?: number | null
          hubspot_ticket_id: string
          id?: never
          month: string
          owner_id?: string | null
          priority?: string | null
          resolution_time_hours?: number | null
          status?: string | null
          subject?: string | null
        }
        Update: {
          category?: string | null
          closed_date?: string | null
          created_at?: string | null
          created_date?: string | null
          customer_id?: number | null
          hubspot_ticket_id?: string
          id?: never
          month?: string
          owner_id?: string | null
          priority?: string | null
          resolution_time_hours?: number | null
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_snapshots_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          invited_at: string | null
          invited_by: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          invited_at?: string | null
          invited_by?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: never; Returns: string }
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

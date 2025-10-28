export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_sessions: {
        Row: {
          client_id: string
          created_at: string | null
          expires_at: string
          id: string
          ip_address: unknown | null
          last_activity_at: string | null
          metadata: Json | null
          theme: string | null
          updated_at: string | null
          user_agent: string | null
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          expires_at: string
          id: string
          ip_address?: unknown | null
          last_activity_at?: string | null
          metadata?: Json | null
          theme?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          last_activity_at?: string | null
          metadata?: Json | null
          theme?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string | null
          crm_type: string
          id: string
          org_contact: string | null
          org_name: string
          setup_complete: boolean
          tenant_shop: string
          updated_at: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          crm_type: string
          id?: string
          org_contact?: string | null
          org_name: string
          setup_complete?: boolean
          tenant_shop: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          crm_type?: string
          id?: string
          org_contact?: string | null
          org_name?: string
          setup_complete?: boolean
          tenant_shop?: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      club_enrollments: {
        Row: {
          c7_membership_id: string | null
          club_stage_id: string
          created_at: string | null
          customer_id: string
          enrolled_at: string
          expires_at: string
          id: string
          qualifying_order_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          c7_membership_id?: string | null
          club_stage_id: string
          created_at?: string | null
          customer_id: string
          enrolled_at: string
          expires_at: string
          id?: string
          qualifying_order_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          c7_membership_id?: string | null
          club_stage_id?: string
          created_at?: string | null
          customer_id?: string
          enrolled_at?: string
          expires_at?: string
          id?: string
          qualifying_order_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_enrollments_club_stage_id_fkey"
            columns: ["club_stage_id"]
            isOneToOne: false
            referencedRelation: "club_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_enrollments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_enrollments_qualifying_order_id_fkey"
            columns: ["qualifying_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      club_extensions: {
        Row: {
          created_at: string | null
          enrollment_id: string
          extended_at: string
          extended_from_stage_id: string | null
          extended_to_stage_id: string
          extension_type: string
          id: string
          new_expires_at: string
          order_id: string | null
        }
        Insert: {
          created_at?: string | null
          enrollment_id: string
          extended_at?: string
          extended_from_stage_id?: string | null
          extended_to_stage_id: string
          extension_type: string
          id?: string
          new_expires_at: string
          order_id?: string | null
        }
        Update: {
          created_at?: string | null
          enrollment_id?: string
          extended_at?: string
          extended_from_stage_id?: string | null
          extended_to_stage_id?: string
          extension_type?: string
          id?: string
          new_expires_at?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_extensions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "club_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_extensions_extended_from_stage_id_fkey"
            columns: ["extended_from_stage_id"]
            isOneToOne: false
            referencedRelation: "club_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_extensions_extended_to_stage_id_fkey"
            columns: ["extended_to_stage_id"]
            isOneToOne: false
            referencedRelation: "club_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_extensions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      club_programs: {
        Row: {
          client_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_programs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      club_stage_promotions: {
        Row: {
          club_stage_id: string
          created_at: string | null
          crm_id: string
          crm_type: string
          description: string | null
          id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          club_stage_id: string
          created_at?: string | null
          crm_id: string
          crm_type: string
          description?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          club_stage_id?: string
          created_at?: string | null
          crm_id?: string
          crm_type?: string
          description?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_stage_promotions_club_stage_id_fkey"
            columns: ["club_stage_id"]
            isOneToOne: false
            referencedRelation: "club_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      club_stages: {
        Row: {
          c7_club_id: string | null
          club_program_id: string
          created_at: string | null
          duration_months: number
          id: string
          is_active: boolean | null
          min_purchase_amount: number
          name: string
          platform_discount_id: string | null
          platform_tag_id: string | null
          stage_order: number
          updated_at: string | null
        }
        Insert: {
          c7_club_id?: string | null
          club_program_id: string
          created_at?: string | null
          duration_months: number
          id?: string
          is_active?: boolean | null
          min_purchase_amount: number
          name: string
          platform_discount_id?: string | null
          platform_tag_id?: string | null
          stage_order: number
          updated_at?: string | null
        }
        Update: {
          c7_club_id?: string | null
          club_program_id?: string
          created_at?: string | null
          duration_months?: number
          id?: string
          is_active?: boolean | null
          min_purchase_amount?: number
          name?: string
          platform_discount_id?: string | null
          platform_tag_id?: string | null
          stage_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_stages_club_program_id_fkey"
            columns: ["club_program_id"]
            isOneToOne: false
            referencedRelation: "club_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_configs: {
        Row: {
          client_id: string
          created_at: string | null
          email_api_key: string | null
          email_from_address: string | null
          email_from_name: string | null
          email_list_id: string | null
          email_provider: string | null
          id: string
          send_expiration_warnings: boolean | null
          send_monthly_status: boolean | null
          sms_api_key: string | null
          sms_from_number: string | null
          sms_provider: string | null
          updated_at: string | null
          warning_days_before: number | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          email_api_key?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_list_id?: string | null
          email_provider?: string | null
          id?: string
          send_expiration_warnings?: boolean | null
          send_monthly_status?: boolean | null
          sms_api_key?: string | null
          sms_from_number?: string | null
          sms_provider?: string | null
          updated_at?: string | null
          warning_days_before?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          email_api_key?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_list_id?: string | null
          email_provider?: string | null
          id?: string
          send_expiration_warnings?: boolean | null
          send_monthly_status?: boolean | null
          sms_api_key?: string | null
          sms_from_number?: string | null
          sms_provider?: string | null
          updated_at?: string | null
          warning_days_before?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_log: {
        Row: {
          channel: string
          clicked_at: string | null
          client_id: string
          created_at: string | null
          customer_id: string
          delivered_at: string | null
          error_message: string | null
          id: string
          opened_at: string | null
          provider: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
          template_type: string
          to_address: string
          updated_at: string | null
        }
        Insert: {
          channel: string
          clicked_at?: string | null
          client_id: string
          created_at?: string | null
          customer_id: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          provider: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          template_type: string
          to_address: string
          updated_at?: string | null
        }
        Update: {
          channel?: string
          clicked_at?: string | null
          client_id?: string
          created_at?: string | null
          customer_id?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          provider?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          template_type?: string
          to_address?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_preferences: {
        Row: {
          created_at: string | null
          customer_id: string
          email_expiration_warnings: boolean | null
          email_monthly_status: boolean | null
          email_promotions: boolean | null
          id: string
          sms_expiration_warnings: boolean | null
          sms_monthly_status: boolean | null
          sms_promotions: boolean | null
          unsubscribed_all: boolean | null
          unsubscribed_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          email_expiration_warnings?: boolean | null
          email_monthly_status?: boolean | null
          email_promotions?: boolean | null
          id?: string
          sms_expiration_warnings?: boolean | null
          sms_monthly_status?: boolean | null
          sms_promotions?: boolean | null
          unsubscribed_all?: boolean | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          email_expiration_warnings?: boolean | null
          email_monthly_status?: boolean | null
          email_promotions?: boolean | null
          id?: string
          sms_expiration_warnings?: boolean | null
          sms_monthly_status?: boolean | null
          sms_promotions?: boolean | null
          unsubscribed_all?: boolean | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          available_variables: Json | null
          channel: string
          client_id: string
          created_at: string | null
          html_body: string | null
          id: string
          is_active: boolean | null
          provider_template_id: string | null
          subject: string | null
          template_type: string
          text_body: string | null
          updated_at: string | null
        }
        Insert: {
          available_variables?: Json | null
          channel: string
          client_id: string
          created_at?: string | null
          html_body?: string | null
          id?: string
          is_active?: boolean | null
          provider_template_id?: string | null
          subject?: string | null
          template_type: string
          text_body?: string | null
          updated_at?: string | null
        }
        Update: {
          available_variables?: Json | null
          channel?: string
          client_id?: string
          created_at?: string | null
          html_body?: string | null
          id?: string
          is_active?: boolean | null
          provider_template_id?: string | null
          subject?: string | null
          template_type?: string
          text_body?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sync_queue: {
        Row: {
          action_type: string
          attempts: number | null
          client_id: string
          created_at: string | null
          customer_crm_id: string
          enrollment_id: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number | null
          next_retry_at: string | null
          old_stage_id: string | null
          stage_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          action_type: string
          attempts?: number | null
          client_id: string
          created_at?: string | null
          customer_crm_id: string
          enrollment_id?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          old_stage_id?: string | null
          stage_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          attempts?: number | null
          client_id?: string
          created_at?: string | null
          customer_crm_id?: string
          enrollment_id?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          old_stage_id?: string | null
          stage_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_sync_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sync_queue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "club_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sync_queue_old_stage_id_fkey"
            columns: ["old_stage_id"]
            isOneToOne: false
            referencedRelation: "club_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sync_queue_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "club_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          client_id: string
          created_at: string | null
          crm_id: string | null
          cumulative_membership_days: number
          current_club_stage_id: string | null
          email: string
          first_name: string | null
          id: string
          is_club_member: boolean | null
          last_name: string | null
          loyalty_earning_active: boolean
          loyalty_eligible_since: string | null
          loyalty_points_balance: number
          loyalty_points_lifetime: number
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          crm_id?: string | null
          cumulative_membership_days?: number
          current_club_stage_id?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_club_member?: boolean | null
          last_name?: string | null
          loyalty_earning_active?: boolean
          loyalty_eligible_since?: string | null
          loyalty_points_balance?: number
          loyalty_points_lifetime?: number
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          crm_id?: string | null
          cumulative_membership_days?: number
          current_club_stage_id?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_club_member?: boolean | null
          last_name?: string | null
          loyalty_earning_active?: boolean
          loyalty_eligible_since?: string | null
          loyalty_points_balance?: number
          loyalty_points_lifetime?: number
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_current_club_stage_id_fkey"
            columns: ["current_club_stage_id"]
            isOneToOne: false
            referencedRelation: "club_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          client_id: string
          code: string
          created_at: string | null
          crm_id: string
          ends_at: string | null
          id: string
          is_active: boolean | null
          starts_at: string | null
          type: string
          updated_at: string | null
          usage_count: number | null
          usage_limit: number | null
          value: number
        }
        Insert: {
          client_id: string
          code: string
          created_at?: string | null
          crm_id: string
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          starts_at?: string | null
          type: string
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          value: number
        }
        Update: {
          client_id?: string
          code?: string
          created_at?: string | null
          crm_id?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          starts_at?: string | null
          type?: string
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_point_rules: {
        Row: {
          bonus_points_percentage: number | null
          client_id: string
          created_at: string | null
          deprecated: boolean | null
          deprecated_at: string | null
          id: string
          is_active: boolean | null
          max_points_per_order: number | null
          min_membership_days: number
          min_points_for_redemption: number | null
          point_dollar_value: number
          points_per_dollar: number
          replacement_note: string | null
          updated_at: string | null
        }
        Insert: {
          bonus_points_percentage?: number | null
          client_id: string
          created_at?: string | null
          deprecated?: boolean | null
          deprecated_at?: string | null
          id?: string
          is_active?: boolean | null
          max_points_per_order?: number | null
          min_membership_days?: number
          min_points_for_redemption?: number | null
          point_dollar_value?: number
          points_per_dollar?: number
          replacement_note?: string | null
          updated_at?: string | null
        }
        Update: {
          bonus_points_percentage?: number | null
          client_id?: string
          created_at?: string | null
          deprecated?: boolean | null
          deprecated_at?: string | null
          id?: string
          is_active?: boolean | null
          max_points_per_order?: number | null
          min_membership_days?: number
          min_points_for_redemption?: number | null
          point_dollar_value?: number
          points_per_dollar?: number
          replacement_note?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_point_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          available_from: string | null
          available_until: string | null
          client_id: string
          created_at: string | null
          description: string | null
          exclusive_tier_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          min_tier_order: number | null
          name: string
          points_required: number
          quantity_available: number | null
          quantity_redeemed: number | null
          regular_price: number | null
          reward_type: string
          tier_restricted: boolean | null
          updated_at: string | null
          wine_crm_id: string | null
          wine_sku: string | null
          wine_title: string | null
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          client_id: string
          created_at?: string | null
          description?: string | null
          exclusive_tier_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          min_tier_order?: number | null
          name: string
          points_required: number
          quantity_available?: number | null
          quantity_redeemed?: number | null
          regular_price?: number | null
          reward_type: string
          tier_restricted?: boolean | null
          updated_at?: string | null
          wine_crm_id?: string | null
          wine_sku?: string | null
          wine_title?: string | null
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          client_id?: string
          created_at?: string | null
          description?: string | null
          exclusive_tier_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          min_tier_order?: number | null
          name?: string
          points_required?: number
          quantity_available?: number | null
          quantity_redeemed?: number | null
          regular_price?: number | null
          reward_type?: string
          tier_restricted?: boolean | null
          updated_at?: string | null
          wine_crm_id?: string | null
          wine_sku?: string | null
          wine_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string
          created_at: string | null
          crm_id: string
          customer_id: string | null
          id: string
          is_club_shipment: boolean | null
          shipment_date: string | null
          status: string | null
          total: number
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          crm_id: string
          customer_id?: string | null
          id?: string
          is_club_shipment?: boolean | null
          shipment_date?: string | null
          status?: string | null
          total: number
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          crm_id?: string
          customer_id?: string | null
          id?: string
          is_club_shipment?: boolean | null
          shipment_date?: string | null
          status?: string | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_sessions: {
        Row: {
          access_token: string
          client_id: string
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          client_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          client_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          balance_after: number
          created_at: string | null
          created_by: string | null
          customer_id: string
          description: string | null
          id: string
          order_id: string | null
          points: number
          reward_id: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          balance_after: number
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          description?: string | null
          id?: string
          order_id?: string | null
          points: number
          reward_id?: string | null
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          balance_after?: number
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          order_id?: string | null
          points?: number
          reward_id?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          client_id: string
          created_at: string | null
          crm_id: string
          description: string | null
          id: string
          image_url: string | null
          price: number | null
          sku: string | null
          title: string
          updated_at: string | null
          varietal: string | null
          vintage: number | null
          wine_type: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          crm_id: string
          description?: string | null
          id?: string
          image_url?: string | null
          price?: number | null
          sku?: string | null
          title: string
          updated_at?: string | null
          varietal?: string | null
          vintage?: number | null
          wine_type?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          crm_id?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price?: number | null
          sku?: string | null
          title?: string
          updated_at?: string | null
          varietal?: string | null
          vintage?: number | null
          wine_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          created_at: string | null
          customer_id: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          notes: string | null
          point_transaction_id: string
          points_spent: number
          redeemed_at: string
          reward_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          notes?: string | null
          point_transaction_id: string
          points_spent: number
          redeemed_at?: string
          reward_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          notes?: string | null
          point_transaction_id?: string
          points_spent?: number
          redeemed_at?: string
          reward_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_point_transaction_id_fkey"
            columns: ["point_transaction_id"]
            isOneToOne: false
            referencedRelation: "point_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_loyalty_config: {
        Row: {
          c7_loyalty_tier_id: string
          club_stage_id: string
          created_at: string | null
          earn_rate: number | null
          id: string
          initial_points_bonus: number | null
          is_active: boolean | null
          tier_title: string | null
          updated_at: string | null
        }
        Insert: {
          c7_loyalty_tier_id: string
          club_stage_id: string
          created_at?: string | null
          earn_rate?: number | null
          id?: string
          initial_points_bonus?: number | null
          is_active?: boolean | null
          tier_title?: string | null
          updated_at?: string | null
        }
        Update: {
          c7_loyalty_tier_id?: string
          club_stage_id?: string
          created_at?: string | null
          earn_rate?: number | null
          id?: string
          initial_points_bonus?: number | null
          is_active?: boolean | null
          tier_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tier_loyalty_config_club_stage_id_fkey"
            columns: ["club_stage_id"]
            isOneToOne: true
            referencedRelation: "club_stages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_app_sessions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


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
      abandoned_carts: {
        Row: {
          business_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          customer_user_id: string | null
          id: string
          items: Json | null
          recovered: boolean
          total: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string | null
          id?: string
          items?: Json | null
          recovered?: boolean
          total?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string | null
          id?: string
          items?: Json | null
          recovered?: boolean
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          ad_copies: Json | null
          audiences: Json | null
          business_id: string
          campaign: Json | null
          created_at: string
          creatives: Json | null
          generated_at: string | null
          id: string
          objective: string | null
          platform: string
          updated_at: string
        }
        Insert: {
          ad_copies?: Json | null
          audiences?: Json | null
          business_id: string
          campaign?: Json | null
          created_at?: string
          creatives?: Json | null
          generated_at?: string | null
          id?: string
          objective?: string | null
          platform: string
          updated_at?: string
        }
        Update: {
          ad_copies?: Json | null
          audiences?: Json | null
          business_id?: string
          campaign?: Json | null
          created_at?: string
          creatives?: Json | null
          generated_at?: string | null
          id?: string
          objective?: string | null
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_logs: {
        Row: {
          agent: string
          business_id: string | null
          cost_usd: number | null
          created_at: string
          error: string | null
          id: string
          latency_ms: number | null
          model: string | null
          provider: string | null
          status: string | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          agent: string
          business_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          provider?: string | null
          status?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          agent?: string
          business_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          provider?: string | null
          status?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          business_id: string
          created_at: string
          detail: string | null
          id: string
          status: string
          trigger: string
        }
        Insert: {
          automation_id: string
          business_id: string
          created_at?: string
          detail?: string | null
          id?: string
          status: string
          trigger: string
        }
        Update: {
          automation_id?: string
          business_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          status?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action: string
          action_config: Json
          business_id: string
          conditions: Json
          created_at: string
          enabled: boolean
          id: string
          name: string
          trigger: string
          updated_at: string
        }
        Insert: {
          action: string
          action_config?: Json
          business_id: string
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          trigger: string
          updated_at?: string
        }
        Update: {
          action?: string
          action_config?: Json
          business_id?: string
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      before_after: {
        Row: {
          after_url: string
          before_url: string
          business_id: string
          created_at: string
          id: string
          sort: number
          title: string | null
        }
        Insert: {
          after_url: string
          before_url: string
          business_id: string
          created_at?: string
          id?: string
          sort?: number
          title?: string | null
        }
        Update: {
          after_url?: string
          before_url?: string
          business_id?: string
          created_at?: string
          id?: string
          sort?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "before_after_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          body: string | null
          business_id: string
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          business_id: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          business_id?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_services: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price: number | null
          sort: number
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          price?: number | null
          sort?: number
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price?: number | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_settings: {
        Row: {
          auto_confirm: boolean
          buffer_minutes: number
          business_id: string
          cancel_notice_hours: number
          created_at: string
          days_ahead: number
          enabled: boolean
          hours: Json | null
          ics_feed_token: string
          id: string
          min_notice_hours: number
          services: Json | null
          slot_minutes: number
          updated_at: string
        }
        Insert: {
          auto_confirm?: boolean
          buffer_minutes?: number
          business_id: string
          cancel_notice_hours?: number
          created_at?: string
          days_ahead?: number
          enabled?: boolean
          hours?: Json | null
          ics_feed_token?: string
          id?: string
          min_notice_hours?: number
          services?: Json | null
          slot_minutes?: number
          updated_at?: string
        }
        Update: {
          auto_confirm?: boolean
          buffer_minutes?: number
          business_id?: string
          cancel_notice_hours?: number
          created_at?: string
          days_ahead?: number
          enabled?: boolean
          hours?: Json | null
          ics_feed_token?: string
          id?: string
          min_notice_hours?: number
          services?: Json | null
          slot_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_staff: {
        Row: {
          active: boolean
          business_id: string
          color: string | null
          created_at: string
          email: string | null
          hours: Json | null
          id: string
          name: string
          phone: string | null
          role_title: string | null
          sort: number
        }
        Insert: {
          active?: boolean
          business_id: string
          color?: string | null
          created_at?: string
          email?: string | null
          hours?: Json | null
          id?: string
          name: string
          phone?: string | null
          role_title?: string | null
          sort?: number
        }
        Update: {
          active?: boolean
          business_id?: string
          color?: string | null
          created_at?: string
          email?: string | null
          hours?: Json | null
          id?: string
          name?: string
          phone?: string | null
          role_title?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_staff_services: {
        Row: {
          business_id: string
          service_id: string
          staff_id: string
        }
        Insert: {
          business_id: string
          service_id: string
          staff_id: string
        }
        Update: {
          business_id?: string
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_staff_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "booking_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_waitlist: {
        Row: {
          business_id: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          date: string
          id: string
          notified_at: string | null
          service_id: string | null
          staff_id: string | null
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          date: string
          id?: string
          notified_at?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          date?: string
          id?: string
          notified_at?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_waitlist_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "booking_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          business_id: string
          cancel_token: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          duration_minutes: number | null
          ends_at: string | null
          id: string
          no_show: boolean
          notes: string | null
          recurrence: string | null
          recurrence_group: string | null
          reminder_1h_sent_at: string | null
          reminder_sent_at: string | null
          service: string | null
          service_id: string | null
          staff_id: string | null
          staff_key: string | null
          starts_at: string
          status: string
        }
        Insert: {
          business_id: string
          cancel_token?: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          customer_user_id?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          no_show?: boolean
          notes?: string | null
          recurrence?: string | null
          recurrence_group?: string | null
          reminder_1h_sent_at?: string | null
          reminder_sent_at?: string | null
          service?: string | null
          service_id?: string | null
          staff_id?: string | null
          staff_key?: string | null
          starts_at: string
          status?: string
        }
        Update: {
          business_id?: string
          cancel_token?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          customer_user_id?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          no_show?: boolean
          notes?: string | null
          recurrence?: string | null
          recurrence_group?: string | null
          reminder_1h_sent_at?: string | null
          reminder_sent_at?: string | null
          service?: string | null
          service_id?: string | null
          staff_id?: string | null
          staff_key?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "booking_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          hours: string | null
          id: string
          image_url: string | null
          map_url: string | null
          name: string
          phone: string | null
          sort: number
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          hours?: string | null
          id?: string
          image_url?: string | null
          map_url?: string | null
          name: string
          phone?: string | null
          sort?: number
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          hours?: string | null
          id?: string
          image_url?: string | null
          map_url?: string | null
          name?: string
          phone?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "branches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          brand_name: string | null
          brand_voice: string | null
          business_id: string
          color_palette: Json | null
          created_at: string
          generated_at: string | null
          id: string
          logo_prompt: string | null
          logo_url: string | null
          mission: string | null
          personality: Json | null
          slogan: string | null
          typography: Json | null
          updated_at: string
          vision: string | null
        }
        Insert: {
          brand_name?: string | null
          brand_voice?: string | null
          business_id: string
          color_palette?: Json | null
          created_at?: string
          generated_at?: string | null
          id?: string
          logo_prompt?: string | null
          logo_url?: string | null
          mission?: string | null
          personality?: Json | null
          slogan?: string | null
          typography?: Json | null
          updated_at?: string
          vision?: string | null
        }
        Update: {
          brand_name?: string | null
          brand_voice?: string | null
          business_id?: string
          color_palette?: Json | null
          created_at?: string
          generated_at?: string | null
          id?: string
          logo_prompt?: string | null
          logo_url?: string | null
          mission?: string | null
          personality?: Json | null
          slogan?: string | null
          typography?: Json | null
          updated_at?: string
          vision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_events: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          staff_id: string | null
          starts_at: string
          title: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          staff_id?: string | null
          starts_at: string
          title: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          staff_id?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "booking_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      business_insights: {
        Row: {
          business_id: string
          content: Json
          generated_at: string
          overall_score: number | null
        }
        Insert: {
          business_id: string
          content: Json
          generated_at?: string
          overall_score?: number | null
        }
        Update: {
          business_id?: string
          content?: Json
          generated_at?: string
          overall_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_insights_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_integrations: {
        Row: {
          business_id: string
          category: string
          connected_at: string
          credentials_enc: string
          id: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          category: string
          connected_at?: string
          credentials_enc: string
          id?: string
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string
          connected_at?: string
          credentials_enc?: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_member_invites: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_member_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          business_id: string
          business_model: Json | null
          created_at: string
          customer_segments: Json | null
          executive_summary: string | null
          generated_at: string | null
          id: string
          launch_plan: Json | null
          pricing_strategy: Json | null
          revenue_streams: Json | null
          updated_at: string
          value_proposition: string | null
        }
        Insert: {
          business_id: string
          business_model?: Json | null
          created_at?: string
          customer_segments?: Json | null
          executive_summary?: string | null
          generated_at?: string | null
          id?: string
          launch_plan?: Json | null
          pricing_strategy?: Json | null
          revenue_streams?: Json | null
          updated_at?: string
          value_proposition?: string | null
        }
        Update: {
          business_id?: string
          business_model?: Json | null
          created_at?: string
          customer_segments?: Json | null
          executive_summary?: string | null
          generated_at?: string | null
          id?: string
          launch_plan?: Json | null
          pricing_strategy?: Json | null
          revenue_streams?: Json | null
          updated_at?: string
          value_proposition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_score_snapshots: {
        Row: {
          business_id: string
          created_at: string
          dimensions: Json
          id: string
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string
          dimensions: Json
          id?: string
          total: number
        }
        Update: {
          business_id?: string
          created_at?: string
          dimensions?: Json
          id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_score_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          ai_nav_classified_at: string | null
          announcement_bar: string | null
          bank_details: Json | null
          bit_phone: string | null
          budget: number | null
          business_tax_id: string | null
          catalog_only: boolean
          created_at: string
          description: string
          design_tier: string | null
          email_from_name: string | null
          email_reply_to: string | null
          free_shipping_threshold: number | null
          hidden_nav_keys: string[]
          id: string
          industry: string | null
          is_existing: boolean
          location: string | null
          loyalty_earn: number
          loyalty_enabled: boolean
          loyalty_value: number
          module_config: Json
          name: string | null
          next_invoice_number: number
          owner_id: string
          payment_link: string | null
          payment_methods: Json
          paypal_link: string | null
          popup_coupon: string | null
          popup_enabled: boolean
          popup_text: string | null
          popup_title: string | null
          referral_enabled: boolean
          referral_points: number
          revenue_goal: number | null
          shipping_fee: number | null
          site_mode: string
          size_guide: Json | null
          status: Database["public"]["Enums"]["business_status"]
          store_chat_enabled: boolean
          target_audience: string | null
          type: string | null
          updated_at: string
          vat_rate: number
        }
        Insert: {
          ai_nav_classified_at?: string | null
          announcement_bar?: string | null
          bank_details?: Json | null
          bit_phone?: string | null
          budget?: number | null
          business_tax_id?: string | null
          catalog_only?: boolean
          created_at?: string
          description: string
          design_tier?: string | null
          email_from_name?: string | null
          email_reply_to?: string | null
          free_shipping_threshold?: number | null
          hidden_nav_keys?: string[]
          id?: string
          industry?: string | null
          is_existing?: boolean
          location?: string | null
          loyalty_earn?: number
          loyalty_enabled?: boolean
          loyalty_value?: number
          module_config?: Json
          name?: string | null
          next_invoice_number?: number
          owner_id: string
          payment_link?: string | null
          payment_methods?: Json
          paypal_link?: string | null
          popup_coupon?: string | null
          popup_enabled?: boolean
          popup_text?: string | null
          popup_title?: string | null
          referral_enabled?: boolean
          referral_points?: number
          revenue_goal?: number | null
          shipping_fee?: number | null
          site_mode?: string
          size_guide?: Json | null
          status?: Database["public"]["Enums"]["business_status"]
          store_chat_enabled?: boolean
          target_audience?: string | null
          type?: string | null
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          ai_nav_classified_at?: string | null
          announcement_bar?: string | null
          bank_details?: Json | null
          bit_phone?: string | null
          budget?: number | null
          business_tax_id?: string | null
          catalog_only?: boolean
          created_at?: string
          description?: string
          design_tier?: string | null
          email_from_name?: string | null
          email_reply_to?: string | null
          free_shipping_threshold?: number | null
          hidden_nav_keys?: string[]
          id?: string
          industry?: string | null
          is_existing?: boolean
          location?: string | null
          loyalty_earn?: number
          loyalty_enabled?: boolean
          loyalty_value?: number
          module_config?: Json
          name?: string | null
          next_invoice_number?: number
          owner_id?: string
          payment_link?: string | null
          payment_methods?: Json
          paypal_link?: string | null
          popup_coupon?: string | null
          popup_enabled?: boolean
          popup_text?: string | null
          popup_title?: string | null
          referral_enabled?: boolean
          referral_points?: number
          revenue_goal?: number | null
          shipping_fee?: number | null
          site_mode?: string
          size_guide?: Json | null
          status?: Database["public"]["Enums"]["business_status"]
          store_chat_enabled?: boolean
          target_audience?: string | null
          type?: string | null
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      calendar_entries: {
        Row: {
          business_id: string
          content_type: string
          created_at: string
          id: string
          idea: string | null
          platform: string
          scheduled_for: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          content_type: string
          created_at?: string
          id?: string
          idea?: string | null
          platform: string
          scheduled_for: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          content_type?: string
          created_at?: string
          id?: string
          idea?: string | null
          platform?: string
          scheduled_for?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_messages: {
        Row: {
          business_id: string
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          business_id: string
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          business_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          business_id: string
          created_at: string
          id: string
          image_url: string | null
          issuer: string | null
          sort: number
          title: string
          year: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          issuer?: string | null
          sort?: number
          title: string
          year?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          issuer?: string | null
          sort?: number
          title?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          business_id: string
          content: string
          created_at: string
          cta: string | null
          generated_at: string | null
          hashtags: Json | null
          id: string
          title: string | null
          topic: string | null
          type: string
          updated_at: string
        }
        Insert: {
          business_id: string
          content: string
          created_at?: string
          cta?: string | null
          generated_at?: string | null
          hashtags?: Json | null
          id?: string
          title?: string | null
          topic?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          content?: string
          created_at?: string
          cta?: string | null
          generated_at?: string | null
          hashtags?: Json | null
          id?: string
          title?: string | null
          topic?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          business_id: string
          code: string
          created_at: string
          customer_phone: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          min_order: number | null
          type: string
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          business_id: string
          code: string
          created_at?: string
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order?: number | null
          type?: string
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          business_id?: string
          code?: string
          created_at?: string
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order?: number | null
          type?: string
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          description: string | null
          duration: string | null
          id: string
          image_url: string | null
          level: string | null
          price: number | null
          sort: number
          title: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          image_url?: string | null
          level?: string | null
          price?: number | null
          sort?: number
          title: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          image_url?: string | null
          level?: string | null
          price?: number | null
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          business_id: string
          content: string
          created_at: string
          customer_id: string | null
          id: string
          kind: string
          lead_id: string | null
        }
        Insert: {
          business_id: string
          content: string
          created_at?: string
          customer_id?: string | null
          id?: string
          kind: string
          lead_id?: string | null
        }
        Update: {
          business_id?: string
          content?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customers: {
        Row: {
          birthday: string | null
          business_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          birthday?: string | null
          business_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          birthday?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          business_id: string
          contact_name: string | null
          created_at: string
          customer_id: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          business_id: string
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          business_id?: string
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          business_id: string
          converted_customer_id: string | null
          created_at: string
          email: string | null
          id: string
          last_contacted_at: string | null
          lost_reason: string | null
          name: string
          next_follow_up_at: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          converted_customer_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          lost_reason?: string | null
          name: string
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          converted_customer_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          lost_reason?: string | null
          name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          done: boolean
          due_date: string | null
          id: string
          lead_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          notes: string | null
          phone: string
          recipient_name: string
          street: string
          user_id: string
          zip: string | null
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          notes?: string | null
          phone: string
          recipient_name: string
          street: string
          user_id: string
          zip?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          notes?: string | null
          phone?: string
          recipient_name?: string
          street?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: []
      }
      customer_payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          label: string | null
          last4: string | null
          provider: string | null
          provider_token: string | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          last4?: string | null
          provider?: string | null
          provider_token?: string | null
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          last4?: string | null
          provider?: string | null
          provider_token?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          referral_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          referral_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          referral_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_briefs: {
        Row: {
          brief_date: string
          business_id: string
          content: Json
          created_at: string
          id: string
        }
        Insert: {
          brief_date?: string
          business_id: string
          content: Json
          created_at?: string
          id?: string
        }
        Update: {
          brief_date?: string
          business_id?: string
          content?: Json
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_briefs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          description: string | null
          goal_amount: number | null
          id: string
          image_url: string | null
          raised_amount: number
          sort: number
          title: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          description?: string | null
          goal_amount?: number | null
          id?: string
          image_url?: string | null
          raised_amount?: number
          sort?: number
          title: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          description?: string | null
          goal_amount?: number | null
          id?: string
          image_url?: string | null
          raised_amount?: number
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      downloads: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          image_url: string | null
          price: number | null
          sort: number
          storage_path: string | null
          title: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          price?: number | null
          sort?: number
          storage_path?: string | null
          title: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          price?: number | null
          sort?: number
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "downloads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          business_id: string | null
          created_at: string
          error: string | null
          id: string
          kind: string
          provider_id: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          provider_id?: string | null
          status: string
          subject: string
          to_email: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          provider_id?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          active: boolean
          business_id: string
          capacity: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          location: string | null
          sort: number
          starts_at: string | null
          title: string
        }
        Insert: {
          active?: boolean
          business_id: string
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          sort?: number
          starts_at?: string | null
          title: string
        }
        Update: {
          active?: boolean
          business_id?: string
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          sort?: number
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      external_invoices: {
        Row: {
          business_id: string
          created_at: string
          doc_type: string
          error: string | null
          external_id: string | null
          id: string
          number: string | null
          order_id: string | null
          provider: string
          status: string
          url: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          doc_type: string
          error?: string | null
          external_id?: string | null
          id?: string
          number?: string | null
          order_id?: string | null
          provider: string
          status?: string
          url?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          doc_type?: string
          error?: string | null
          external_id?: string | null
          id?: string
          number?: string | null
          order_id?: string | null
          provider?: string
          status?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string | null
          business_id: string
          created_at: string
          id: string
          image_url: string | null
          question: string
          sort: number
        }
        Insert: {
          answer?: string | null
          business_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          question: string
          sort?: number
        }
        Update: {
          answer?: string | null
          business_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          question?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "faqs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_items: {
        Row: {
          business_id: string
          caption: string | null
          created_at: string
          id: string
          image_url: string
          sort: number
          title: string | null
        }
        Insert: {
          business_id: string
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          sort?: number
          title?: string | null
        }
        Update: {
          business_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          sort?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          balance: number
          business_id: string
          code: string
          created_at: string
          id: string
          initial_amount: number
          recipient_name: string | null
          status: string
        }
        Insert: {
          balance: number
          business_id: string
          code: string
          created_at?: string
          id?: string
          initial_amount: number
          recipient_name?: string | null
          status?: string
        }
        Update: {
          balance?: number
          business_id?: string
          code?: string
          created_at?: string
          id?: string
          initial_amount?: number
          recipient_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_roles: {
        Row: {
          business_id: string
          content: Json
          created_at: string
          id: string
          title: string
        }
        Insert: {
          business_id: string
          content: Json
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          business_id?: string
          content?: Json
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          description: string | null
          employment_type: string | null
          id: string
          image_url: string | null
          location: string | null
          sort: number
          title: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          sort?: number
          title: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_openings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          business_id: string
          created_at: string
          error: string | null
          id: string
          payload: Json | null
          result: Json | null
          status: Database["public"]["Enums"]["job_status"]
          type: Database["public"]["Enums"]["job_type"]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: Database["public"]["Enums"]["job_status"]
          type: Database["public"]["Enums"]["job_type"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: Database["public"]["Enums"]["job_status"]
          type?: Database["public"]["Enums"]["job_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          business_id: string
          customer_user_id: string
          id: string
          points: number
          updated_at: string
        }
        Insert: {
          business_id: string
          customer_user_id: string
          id?: string
          points?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          customer_user_id?: string
          id?: string
          points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      market_research: {
        Row: {
          business_id: string
          competitors: Json | null
          created_at: string
          generated_at: string | null
          id: string
          opportunities: Json | null
          positioning: string | null
          swot: Json | null
          updated_at: string
        }
        Insert: {
          business_id: string
          competitors?: Json | null
          created_at?: string
          generated_at?: string | null
          id?: string
          opportunities?: Json | null
          positioning?: string | null
          swot?: Json | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          competitors?: Json | null
          created_at?: string
          generated_at?: string | null
          id?: string
          opportunities?: Json | null
          positioning?: string | null
          swot?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_research_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          business_id: string
          created_at: string
          highlight: boolean
          id: string
          image_url: string | null
          name: string
          period: string | null
          perks: Json | null
          price: number | null
          sort: number
        }
        Insert: {
          business_id: string
          created_at?: string
          highlight?: boolean
          id?: string
          image_url?: string | null
          name: string
          period?: string | null
          perks?: Json | null
          price?: number | null
          sort?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          highlight?: boolean
          id?: string
          image_url?: string | null
          name?: string
          period?: string | null
          perks?: Json | null
          price?: number | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number | null
          section: string | null
          sort: number
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: number | null
          section?: string | null
          sort?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number | null
          section?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          business_id: string
          created_at: string
          email: string
          id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_invoices: {
        Row: {
          business_id: string
          customer_name: string
          customer_tax_id: string | null
          discount: number
          id: string
          invoice_number: string
          issued_at: string
          lines: Json | null
          order_id: string
          subtotal: number
          total: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          business_id: string
          customer_name: string
          customer_tax_id?: string | null
          discount?: number
          id?: string
          invoice_number: string
          issued_at?: string
          lines?: Json | null
          order_id: string
          subtotal?: number
          total?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          business_id?: string
          customer_name?: string
          customer_tax_id?: string | null
          discount?: number
          id?: string
          invoice_number?: string
          issued_at?: string
          lines?: Json | null
          order_id?: string
          subtotal?: number
          total?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          business_id: string
          created_at: string
          engraving: string | null
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number | null
          variant: string | null
          variant_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          engraving?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number | null
          variant?: string | null
          variant_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          engraving?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number | null
          variant?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refunds: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          id: string
          order_id: string
          reason: string | null
          status: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          id?: string
          order_id: string
          reason?: string | null
          status?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          id?: string
          order_id?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          business_id: string
          coupon_code: string | null
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          points_used: number
          product_id: string | null
          product_name: string
          quantity: number
          referral_code: string | null
          shipped_at: string | null
          shipping_details: string | null
          shipping_method: string | null
          shipping_price: number | null
          status: string
          supplier_ordered_at: string | null
          total: number | null
          tracking_carrier: string | null
          tracking_number: string | null
          variant: string | null
        }
        Insert: {
          business_id: string
          coupon_code?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          customer_user_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          points_used?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          referral_code?: string | null
          shipped_at?: string | null
          shipping_details?: string | null
          shipping_method?: string | null
          shipping_price?: number | null
          status?: string
          supplier_ordered_at?: string | null
          total?: number | null
          tracking_carrier?: string | null
          tracking_number?: string | null
          variant?: string | null
        }
        Update: {
          business_id?: string
          coupon_code?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          customer_user_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          points_used?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          referral_code?: string | null
          shipped_at?: string | null
          shipping_details?: string | null
          shipping_method?: string | null
          shipping_price?: number | null
          status?: string
          supplier_ordered_at?: string | null
          total?: number | null
          tracking_carrier?: string | null
          tracking_number?: string | null
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          business_id: string
          created_at: string
          id: string
          link: string | null
          logo_url: string | null
          name: string
          sort: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          link?: string | null
          logo_url?: string | null
          name: string
          sort?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          link?: string | null
          logo_url?: string | null
          name?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "partners_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_charges: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string
          provider_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          business_id: string
          created_at: string
          features: Json | null
          highlight: boolean
          id: string
          image_url: string | null
          name: string
          period: string | null
          price: number | null
          sort: number
        }
        Insert: {
          business_id: string
          created_at?: string
          features?: Json | null
          highlight?: boolean
          id?: string
          image_url?: string | null
          name: string
          period?: string | null
          price?: number | null
          sort?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          features?: Json | null
          highlight?: boolean
          id?: string
          image_url?: string | null
          name?: string
          period?: string | null
          price?: number | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      process_steps: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          sort: number
          title: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          sort?: number
          title: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_steps_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          business_id: string
          color: string | null
          created_at: string
          id: string
          product_id: string
          size: string | null
          sku: string | null
          sort: number
          stock_qty: number
        }
        Insert: {
          barcode?: string | null
          business_id: string
          color?: string | null
          created_at?: string
          id?: string
          product_id: string
          size?: string | null
          sku?: string | null
          sort?: number
          stock_qty?: number
        }
        Update: {
          barcode?: string | null
          business_id?: string
          color?: string | null
          created_at?: string
          id?: string
          product_id?: string
          size?: string | null
          sku?: string | null
          sort?: number
          stock_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          attributes: Json
          barcode: string | null
          brand: string | null
          business_id: string
          category: string | null
          colors: Json | null
          cost_price: number | null
          created_at: string
          description: string | null
          engraving: Json | null
          full_description: string | null
          id: string
          image_url: string | null
          images: Json | null
          in_stock: boolean
          low_stock_threshold: number | null
          name: string
          preorder: boolean
          price: number | null
          sale_price: number | null
          sizes: Json | null
          sku: string | null
          sort_order: number
          status: string
          stock_qty: number | null
          subcategory: string | null
          tags: Json | null
          track_inventory: boolean
          updated_at: string
          video_url: string | null
          wholesale_price: number | null
        }
        Insert: {
          active?: boolean
          attributes?: Json
          barcode?: string | null
          brand?: string | null
          business_id: string
          category?: string | null
          colors?: Json | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          engraving?: Json | null
          full_description?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          in_stock?: boolean
          low_stock_threshold?: number | null
          name: string
          preorder?: boolean
          price?: number | null
          sale_price?: number | null
          sizes?: Json | null
          sku?: string | null
          sort_order?: number
          status?: string
          stock_qty?: number | null
          subcategory?: string | null
          tags?: Json | null
          track_inventory?: boolean
          updated_at?: string
          video_url?: string | null
          wholesale_price?: number | null
        }
        Update: {
          active?: boolean
          attributes?: Json
          barcode?: string | null
          brand?: string | null
          business_id?: string
          category?: string | null
          colors?: Json | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          engraving?: Json | null
          full_description?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          in_stock?: boolean
          low_stock_threshold?: number | null
          name?: string
          preorder?: boolean
          price?: number | null
          sale_price?: number | null
          sizes?: Json | null
          sku?: string | null
          sort_order?: number
          status?: string
          stock_qty?: number | null
          subcategory?: string | null
          tags?: Json | null
          track_inventory?: boolean
          updated_at?: string
          video_url?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          assignee: string | null
          business_id: string
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          priority: string | null
          project_id: string | null
          staff_id: string | null
          status: string
          title: string
        }
        Insert: {
          assignee?: string | null
          business_id: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          staff_id?: string | null
          status?: string
          title: string
        }
        Update: {
          assignee?: string | null
          business_id?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          staff_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "booking_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          name: string
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          status?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchased_addons: {
        Row: {
          addon_key: string
          canceled_at: string | null
          created_at: string
          id: string
          status: string
          stripe_item_id: string | null
          stripe_subscription_id: string
          user_id: string
        }
        Insert: {
          addon_key: string
          canceled_at?: string | null
          created_at?: string
          id?: string
          status?: string
          stripe_item_id?: string | null
          stripe_subscription_id: string
          user_id: string
        }
        Update: {
          addon_key?: string
          canceled_at?: string | null
          created_at?: string
          id?: string
          status?: string
          stripe_item_id?: string | null
          stripe_subscription_id?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          discount: number
          id: string
          items: Json
          notes: string | null
          public_token: string
          status: string
          tax_rate: number
          title: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          discount?: number
          id?: string
          items?: Json
          notes?: string | null
          public_token?: string
          status?: string
          tax_rate?: number
          title: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          id?: string
          items?: Json
          notes?: string | null
          public_token?: string
          status?: string
          tax_rate?: number
          title?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_callback_claims: {
        Row: {
          business_id: string
          created_at: string
          order_id: string
          provider: string
          provider_ref: string
        }
        Insert: {
          business_id: string
          created_at?: string
          order_id: string
          provider: string
          provider_ref: string
        }
        Update: {
          business_id?: string
          created_at?: string
          order_id?: string
          provider?: string
          provider_ref?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          business_id: string
          created_at: string
          id: string
          points_awarded: number
          referred_phone: string | null
          referred_user_id: string | null
          referrer_user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          points_awarded?: number
          referred_phone?: string | null
          referred_user_id?: string | null
          referrer_user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          points_awarded?: number
          referred_phone?: string | null
          referred_user_id?: string | null
          referrer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_booking_events: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          booking_id: string | null
          business_id: string
          created_at: string
          details: Json
          id: string
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          booking_id?: string | null
          business_id: string
          created_at?: string
          details?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          booking_id?: string | null
          business_id?: string
          created_at?: string
          details?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "rental_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_booking_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_bookings: {
        Row: {
          block_reason: string | null
          booking_no: number
          business_id: string
          cancelled_at: string | null
          check_in: string
          check_out: string
          created_at: string
          crm_customer_id: string | null
          customer_user_id: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          guests: number
          hold_expires_at: string | null
          id: string
          kind: string
          nights: number
          notes: string | null
          paid_at: string | null
          payment_status: string
          price_per_night: number
          source: string
          status: string
          total: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          block_reason?: string | null
          booking_no?: number
          business_id: string
          cancelled_at?: string | null
          check_in: string
          check_out: string
          created_at?: string
          crm_customer_id?: string | null
          customer_user_id?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests?: number
          hold_expires_at?: string | null
          id?: string
          kind?: string
          nights?: number
          notes?: string | null
          paid_at?: string | null
          payment_status?: string
          price_per_night?: number
          source?: string
          status?: string
          total?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          block_reason?: string | null
          booking_no?: number
          business_id?: string
          cancelled_at?: string | null
          check_in?: string
          check_out?: string
          created_at?: string
          crm_customer_id?: string | null
          customer_user_id?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests?: number
          hold_expires_at?: string | null
          id?: string
          kind?: string
          nights?: number
          notes?: string | null
          paid_at?: string | null
          payment_status?: string
          price_per_night?: number
          source?: string
          status?: string
          total?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_bookings_crm_customer_id_fkey"
            columns: ["crm_customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_bookings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "rental_units"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_unit_types: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          sort: number
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "rental_unit_types_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_units: {
        Row: {
          active: boolean
          amenities: string[] | null
          business_id: string
          code: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          images: string[] | null
          max_guests: number
          name: string
          nightly_price: number
          sort: number
          unit_type_id: string | null
        }
        Insert: {
          active?: boolean
          amenities?: string[] | null
          business_id: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          max_guests?: number
          name: string
          nightly_price?: number
          sort?: number
          unit_type_id?: string | null
        }
        Update: {
          active?: boolean
          amenities?: string[] | null
          business_id?: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          max_guests?: number
          name?: string
          nightly_price?: number
          sort?: number
          unit_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_units_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_units_unit_type_id_fkey"
            columns: ["unit_type_id"]
            isOneToOne: false
            referencedRelation: "rental_unit_types"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          business_id: string
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          item: string | null
          kind: string
          order_id: string | null
          reason: string | null
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          item?: string | null
          kind?: string
          order_id?: string | null
          reason?: string | null
          status?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          item?: string | null
          kind?: string
          order_id?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          approved: boolean
          business_id: string
          content: string
          created_at: string
          customer_name: string
          id: string
          image_url: string | null
          rating: number
          verified: boolean
        }
        Insert: {
          approved?: boolean
          business_id: string
          content: string
          created_at?: string
          customer_name: string
          id?: string
          image_url?: string | null
          rating: number
          verified?: boolean
        }
        Update: {
          approved?: boolean
          business_id?: string
          content?: string
          created_at?: string
          customer_name?: string
          id?: string
          image_url?: string | null
          rating?: number
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_methods: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          details: Json | null
          eta: string | null
          free_over: number | null
          id: string
          name: string
          price: number
          sort: number
          type: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          details?: Json | null
          eta?: string | null
          free_over?: number | null
          id?: string
          name: string
          price?: number
          sort?: number
          type?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          details?: Json | null
          eta?: string | null
          free_over?: number | null
          id?: string
          name?: string
          price?: number
          sort?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_methods_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          business_id: string
          created_at: string
          id: string
          path: string | null
          referrer: string | null
          slug: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          path?: string | null
          referrer?: string | null
          slug: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          path?: string | null
          referrer?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          best_times: Json | null
          bio: string | null
          business_id: string
          content_pillars: Json | null
          created_at: string
          generated_at: string | null
          growth_tips: Json | null
          hashtag_sets: Json | null
          id: string
          platform: string
          posting_frequency: string | null
          sample_posts: Json | null
          updated_at: string
        }
        Insert: {
          best_times?: Json | null
          bio?: string | null
          business_id: string
          content_pillars?: Json | null
          created_at?: string
          generated_at?: string | null
          growth_tips?: Json | null
          hashtag_sets?: Json | null
          id?: string
          platform: string
          posting_frequency?: string | null
          sample_posts?: Json | null
          updated_at?: string
        }
        Update: {
          best_times?: Json | null
          bio?: string | null
          business_id?: string
          content_pillars?: Json | null
          created_at?: string
          generated_at?: string | null
          growth_tips?: Json | null
          hashtag_sets?: Json | null
          id?: string
          platform?: string
          posting_frequency?: string | null
          sample_posts?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stats: {
        Row: {
          business_id: string
          created_at: string
          id: string
          image_url: string | null
          label: string
          sort: number
          suffix: string | null
          value: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          label: string
          sort?: number
          suffix?: string | null
          value: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          sort?: number
          suffix?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "stats_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      store_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "store_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      store_chat_sessions: {
        Row: {
          business_id: string
          created_at: string
          id: string
          visitor_key: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          visitor_key: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          visitor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_chat_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_connections: {
        Row: {
          business_id: string
          created_at: string
          credentials_encrypted: string | null
          enabled: boolean
          id: string
          meta: Json
          provider: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          credentials_encrypted?: string | null
          enabled?: boolean
          id?: string
          meta?: Json
          provider: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          credentials_encrypted?: string | null
          enabled?: boolean
          id?: string
          meta?: Json
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payment_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string
          provider_ref: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          provider_ref?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          provider_ref?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          bio: string | null
          business_id: string
          created_at: string
          id: string
          name: string
          photo_url: string | null
          role: string | null
          sort: number
        }
        Insert: {
          bio?: string | null
          business_id: string
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          role?: string | null
          sort?: number
        }
        Update: {
          bio?: string | null
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          role?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          author: string
          business_id: string
          created_at: string
          id: string
          photo_url: string | null
          quote: string
          rating: number | null
          role: string | null
          sort: number
        }
        Insert: {
          author: string
          business_id: string
          created_at?: string
          id?: string
          photo_url?: string | null
          quote: string
          rating?: number | null
          role?: string | null
          sort?: number
        }
        Update: {
          author?: string
          business_id?: string
          created_at?: string
          id?: string
          photo_url?: string | null
          quote?: string
          rating?: number | null
          role?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          ai_chat_msgs: number
          ai_cost_usd: number
          ai_generations: number
          business_id: string
          period: string
        }
        Insert: {
          ai_chat_msgs?: number
          ai_cost_usd?: number
          ai_generations?: number
          business_id: string
          period: string
        }
        Update: {
          ai_chat_msgs?: number
          ai_cost_usd?: number
          ai_generations?: number
          business_id?: string
          period?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          business_id: string
          created_at: string
          generated_at: string | null
          hero_image_url: string | null
          hero_particles_enabled: boolean
          hero_style: string
          id: string
          landing_settings: Json
          layout_style: string
          page_about: Json | null
          page_contact: Json | null
          page_faq: Json | null
          page_home: Json | null
          page_landing: Json | null
          page_services: Json | null
          published: boolean
          seo_meta: Json | null
          slug: string | null
          social_links: Json
          theme: string
          tracking: Json
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          generated_at?: string | null
          hero_image_url?: string | null
          hero_particles_enabled?: boolean
          hero_style?: string
          id?: string
          landing_settings?: Json
          layout_style?: string
          page_about?: Json | null
          page_contact?: Json | null
          page_faq?: Json | null
          page_home?: Json | null
          page_landing?: Json | null
          page_services?: Json | null
          published?: boolean
          seo_meta?: Json | null
          slug?: string | null
          social_links?: Json
          theme?: string
          tracking?: Json
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          generated_at?: string | null
          hero_image_url?: string | null
          hero_particles_enabled?: boolean
          hero_style?: string
          id?: string
          landing_settings?: Json
          layout_style?: string
          page_about?: Json | null
          page_contact?: Json | null
          page_faq?: Json | null
          page_home?: Json | null
          page_landing?: Json | null
          page_services?: Json | null
          published?: boolean
          seo_meta?: Json | null
          slug?: string | null
          social_links?: Json
          theme?: string
          tracking?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "websites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          access_token: string | null
          app_secret: string | null
          business_id: string
          connected: boolean
          created_at: string
          display_phone: string | null
          enabled: boolean
          faq: Json | null
          generated_at: string | null
          goals: Json | null
          greeting: string | null
          id: string
          phone_number_id: string | null
          tone: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          app_secret?: string | null
          business_id: string
          connected?: boolean
          created_at?: string
          display_phone?: string | null
          enabled?: boolean
          faq?: Json | null
          generated_at?: string | null
          goals?: Json | null
          greeting?: string | null
          id?: string
          phone_number_id?: string | null
          tone?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          app_secret?: string | null
          business_id?: string
          connected?: boolean
          created_at?: string
          display_phone?: string | null
          enabled?: boolean
          faq?: Json | null
          generated_at?: string | null
          goals?: Json | null
          greeting?: string | null
          id?: string
          phone_number_id?: string | null
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          business_id: string
          contact_name: string | null
          contact_phone: string
          created_at: string
          handled_at: string | null
          id: string
          last_message_at: string | null
          needs_reply: boolean
          needs_reply_since: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          handled_at?: string | null
          id?: string
          last_message_at?: string | null
          needs_reply?: boolean
          needs_reply_since?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          handled_at?: string | null
          id?: string
          last_message_at?: string | null
          needs_reply?: boolean
          needs_reply_since?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          business_id: string
          content: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          wa_message_id: string | null
        }
        Insert: {
          business_id: string
          content: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          wa_message_id?: string | null
        }
        Update: {
          business_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_ai_cost: {
        Args: { p_amount: number; p_business_id: string; p_period: string }
        Returns: number
      }
      adjust_coupon_use: {
        Args: { p_coupon_id: string; p_delta: number }
        Returns: number
      }
      adjust_loyalty_points_guarded: {
        Args: {
          p_business_id: string
          p_customer_user_id: string
          p_delta: number
        }
        Returns: number
      }
      bump_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      bump_usage: {
        Args: { p_business_id: string; p_field: string; p_period: string }
        Returns: number
      }
      decrement_variant_stock: {
        Args: {
          p_allow_negative?: boolean
          p_qty: number
          p_variant_id: string
        }
        Returns: boolean
      }
      get_business_report: {
        Args: {
          p_bucket?: string
          p_business_id: string
          p_from: string
          p_to: string
        }
        Returns: {
          bookings_count: number
          bucket_start: string
          leads_count: number
          orders_count: number
          revenue: number
          visits_count: number
        }[]
      }
      increment_loyalty_points: {
        Args: {
          p_business_id: string
          p_customer_user_id: string
          p_delta: number
        }
        Returns: number
      }
      is_business_owner: { Args: { b_id: string }; Returns: boolean }
      is_business_owner_or_admin: { Args: { b_id: string }; Returns: boolean }
      next_invoice_number: { Args: { p_business_id: string }; Returns: number }
      restock_variant_stock: {
        Args: { p_qty: number; p_variant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      business_status: "draft" | "generating" | "ready" | "archived"
      deal_stage: "lead" | "proposal" | "negotiation" | "won" | "lost"
      job_status: "queued" | "running" | "succeeded" | "failed"
      job_type:
        | "business_plan"
        | "market_research"
        | "branding"
        | "website"
        | "content"
        | "content_calendar"
        | "social_media"
        | "whatsapp"
        | "site_design"
        | "ads"
      lead_status: "new" | "contacted" | "qualified" | "lost"
      plan_tier: "free" | "starter" | "pro" | "business"
      task_priority: "low" | "medium" | "high"
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
    Enums: {
      business_status: ["draft", "generating", "ready", "archived"],
      deal_stage: ["lead", "proposal", "negotiation", "won", "lost"],
      job_status: ["queued", "running", "succeeded", "failed"],
      job_type: [
        "business_plan",
        "market_research",
        "branding",
        "website",
        "content",
        "content_calendar",
        "social_media",
        "whatsapp",
        "site_design",
        "ads",
      ],
      lead_status: ["new", "contacted", "qualified", "lost"],
      plan_tier: ["free", "starter", "pro", "business"],
      task_priority: ["low", "medium", "high"],
    },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────
// Convenience aliases — hand-written, kept in sync with the table/enum list
// above. Most other files import row types from here rather than reaching
// for `Tables<'...'>` directly.
// ─────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────
export type BusinessStatus = Enums<"business_status">;
export type DealStage = Enums<"deal_stage">;
export type JobStatus = Enums<"job_status">;
export type JobType = Enums<"job_type">;
export type LeadStatus = Enums<"lead_status">;
export type PlanTier = Enums<"plan_tier">;
export type TaskPriority = Enums<"task_priority">;

// ── Table row aliases ───────────────────────────────────────────────────
export type AbandonedCart = Tables<"abandoned_carts">;
export type AdCampaign = Tables<"ad_campaigns">;
export type Automation = Tables<"automations">;
export type AutomationRun = Tables<"automation_runs">;
export type BeforeAfter = Tables<"before_after">;
export type BlogPost = Tables<"blog_posts">;
export type Booking = Tables<"bookings">;
export type BookingService = Tables<"booking_services">;
export type BookingSettings = Tables<"booking_settings">;
export type BookingStaff = Tables<"booking_staff">;
export type BookingWaitlistEntry = Tables<"booking_waitlist">;
export type Branch = Tables<"branches">;
export type BrandAssets = Tables<"brand_assets">;
export type Business = Tables<"businesses">;
export type BusinessEvent = Tables<"business_events">;
export type BusinessProfile = Tables<"business_profiles">;
export type CalendarEntry = Tables<"calendar_entries">;
export type CeoMessage = Tables<"ceo_messages">;
export type Certification = Tables<"certifications">;
export type ContentItem = Tables<"content_items">;
export type Coupon = Tables<"coupons">;
export type Course = Tables<"courses">;
export type CrmActivity = Tables<"crm_activities">;
export type CrmCustomer = Tables<"crm_customers">;
export type CrmDeal = Tables<"crm_deals">;
export type CrmLead = Tables<"crm_leads">;
export type CrmTask = Tables<"crm_tasks">;
export type CustomerAddress = Tables<"customer_addresses">;
export type CustomerPaymentMethod = Tables<"customer_payment_methods">;
export type CustomerProfile = Tables<"customer_profiles">;
export type DailyBrief = Tables<"daily_briefs">;
export type Donation = Tables<"donations">;
export type DownloadItem = Tables<"downloads">;
export type EventItem = Tables<"events">;
export type ExternalInvoice = Tables<"external_invoices">;
export type Faq = Tables<"faqs">;
export type GalleryItem = Tables<"gallery_items">;
export type GiftCard = Tables<"gift_cards">;
export type HrRole = Tables<"hr_roles">;
export type Job = Tables<"jobs">;
export type JobOpening = Tables<"job_openings">;
export type MarketResearch = Tables<"market_research">;
export type Membership = Tables<"memberships">;
export type MenuItem = Tables<"menu_items">;
export type NewsletterSubscriber = Tables<"newsletter_subscribers">;
export type Order = Tables<"orders">;
export type OrderInvoice = Tables<"order_invoices">;
export type OrderItem = Tables<"order_items">;
export type OrderRefund = Tables<"order_refunds">;
export type Partner = Tables<"partners">;
export type PlatformCharge = Tables<"platform_charges">;
export type PricingPlan = Tables<"pricing_plans">;
export type ProcessStep = Tables<"process_steps">;
export type Product = Omit<
  Tables<"products">,
  "colors" | "sizes" | "engraving" | "images" | "tags" | "attributes"
> & {
  colors: ProductColor[] | null;
  sizes: string[] | null;
  engraving: ProductEngraving | null;
  images: string[] | null;
  tags: string[] | null;
  attributes: Record<string, string>;
};
export type ProductVariant = Tables<"product_variants">;
export type Profile = Tables<"profiles">;
export type Project = Tables<"projects">;
export type ProjectTask = Tables<"project_tasks">;
export type Quote = Omit<Tables<"quotes">, "items"> & {
  items: QuoteItem[];
};
export type RentalBooking = Tables<"rental_bookings">;
export type RentalUnit = Tables<"rental_units">;
export type RentalUnitType = Tables<"rental_unit_types">;
export type Return = Tables<"returns">;
export type Review = Tables<"reviews">;
export type ShippingMethod = Tables<"shipping_methods">;
export type SocialProfile = Tables<"social_profiles">;
export type StatItem = Tables<"stats">;
export type TeamMember = Tables<"team_members">;
export type Testimonial = Tables<"testimonials">;
export type Warehouse = Tables<"warehouses">;
export type Website = Tables<"websites">;
export type WhatsappConfig = Tables<"whatsapp_config">;
export type WhatsappConversation = Tables<"whatsapp_conversations">;
export type WhatsappMessage = Tables<"whatsapp_messages">;

// ── Custom shapes (not 1:1 with a table row or Postgres enum) ─────────────

/** One swatch in `products.colors` (jsonb array): a named colour + its hex. */
export type ProductColor = {
  name: string;
  hex: string;
};

/** `products.engraving` (jsonb): personalization config for a product. */
export type ProductEngraving = {
  enabled: true;
  label?: string;
  maxChars?: number;
  required?: boolean;
  fields?: number;
};

/** One line item inside `quotes.items` (jsonb array). */
export type QuoteItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

/**
 * `rental_bookings.status` — a text column with a CHECK constraint, not a
 * Postgres enum. A "block" row may only be "blocked" | "cancelled"; a real
 * booking may be any of the other values (see 0089_rentals_pms.sql).
 */
export type RentalBookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show"
  | "blocked";

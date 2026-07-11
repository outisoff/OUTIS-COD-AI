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
      ai_chat_conversations: {
        Row: {
          created_at: string
          id: string
          model: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          order_id: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          order_id?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          order_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_rules: {
        Row: {
          agent_name: string
          created_at: string
          days_of_week: number[] | null
          end_date: string | null
          end_hour: number | null
          id: string
          is_active: boolean
          match_value: string
          priority: number
          rule_type: string
          start_date: string | null
          start_hour: number | null
          updated_at: string
        }
        Insert: {
          agent_name: string
          created_at?: string
          days_of_week?: number[] | null
          end_date?: string | null
          end_hour?: number | null
          id?: string
          is_active?: boolean
          match_value: string
          priority?: number
          rule_type: string
          start_date?: string | null
          start_hour?: number | null
          updated_at?: string
        }
        Update: {
          agent_name?: string
          created_at?: string
          days_of_week?: number[] | null
          end_date?: string | null
          end_hour?: number | null
          id?: string
          is_active?: boolean
          match_value?: string
          priority?: number
          rule_type?: string
          start_date?: string | null
          start_hour?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      assignment_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      auto_confirmation_logs: {
        Row: {
          ai_decision: string
          ai_reason: string | null
          checks_result: Json | null
          conversation_history: Json | null
          conversation_status: string | null
          created_at: string
          customer_phone: string
          customer_reply: string | null
          final_status: string | null
          id: string
          last_message_at: string | null
          order_id: string | null
          order_number: string
          updated_at: string
          whatsapp_message_sent: boolean | null
          whatsapp_response: string | null
        }
        Insert: {
          ai_decision: string
          ai_reason?: string | null
          checks_result?: Json | null
          conversation_history?: Json | null
          conversation_status?: string | null
          created_at?: string
          customer_phone: string
          customer_reply?: string | null
          final_status?: string | null
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          order_number: string
          updated_at?: string
          whatsapp_message_sent?: boolean | null
          whatsapp_response?: string | null
        }
        Update: {
          ai_decision?: string
          ai_reason?: string | null
          checks_result?: Json | null
          conversation_history?: Json | null
          conversation_status?: string | null
          created_at?: string
          customer_phone?: string
          customer_reply?: string | null
          final_status?: string | null
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          order_number?: string
          updated_at?: string
          whatsapp_message_sent?: boolean | null
          whatsapp_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_confirmation_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      charge_categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          label: string
          updated_at?: string
          value: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      charge_subcategories: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      charges: {
        Row: {
          amount: number
          category: string
          charge_date: string
          charge_date_to: string | null
          charge_type: string
          created_at: string
          frequency: string
          id: string
          is_recurring: boolean
          name: string
          notes: string | null
          order_id: string | null
          product_id: string | null
          product_ids: string[] | null
          store_id: string | null
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          charge_date?: string
          charge_date_to?: string | null
          charge_type?: string
          created_at?: string
          frequency?: string
          id?: string
          is_recurring?: boolean
          name: string
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          product_ids?: string[] | null
          store_id?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          charge_date?: string
          charge_date_to?: string | null
          charge_type?: string
          created_at?: string
          frequency?: string
          id?: string
          is_recurring?: boolean
          name?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          product_ids?: string[] | null
          store_id?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_notes: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "meta_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          commune: string | null
          created_at: string
          id: string
          last_order_date: string | null
          name: string
          notes: string | null
          phone: string
          status: Database["public"]["Enums"]["customer_status"]
          total_orders: number
          total_spent: number
          updated_at: string
          wilaya: string
        }
        Insert: {
          address?: string | null
          commune?: string | null
          created_at?: string
          id?: string
          last_order_date?: string | null
          name: string
          notes?: string | null
          phone: string
          status?: Database["public"]["Enums"]["customer_status"]
          total_orders?: number
          total_spent?: number
          updated_at?: string
          wilaya: string
        }
        Update: {
          address?: string | null
          commune?: string | null
          created_at?: string
          id?: string
          last_order_date?: string | null
          name?: string
          notes?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["customer_status"]
          total_orders?: number
          total_spent?: number
          updated_at?: string
          wilaya?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          carrier: string | null
          created_at: string | null
          delivery_situation: string | null
          delivery_status: string | null
          id: string
          last_update: string | null
          livreur_poll_msg_id: string | null
          livreur_poll_to: string | null
          order_id: string | null
          tracking_number: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          delivery_situation?: string | null
          delivery_status?: string | null
          id?: string
          last_update?: string | null
          livreur_poll_msg_id?: string | null
          livreur_poll_to?: string | null
          order_id?: string | null
          tracking_number?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          delivery_situation?: string | null
          delivery_status?: string | null
          id?: string
          last_update?: string | null
          livreur_poll_msg_id?: string | null
          livreur_poll_to?: string | null
          order_id?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_company_fees: {
        Row: {
          created_at: string
          delivery_company: string
          home_delivery_fee: number
          id: string
          return_fee: number
          stop_desk_fee: number
          swap_diff_wilaya_fee: number
          swap_same_wilaya_fee: number
          updated_at: string
          wilaya_code: string
          wilaya_name: string
        }
        Insert: {
          created_at?: string
          delivery_company: string
          home_delivery_fee?: number
          id?: string
          return_fee?: number
          stop_desk_fee?: number
          swap_diff_wilaya_fee?: number
          swap_same_wilaya_fee?: number
          updated_at?: string
          wilaya_code: string
          wilaya_name: string
        }
        Update: {
          created_at?: string
          delivery_company?: string
          home_delivery_fee?: number
          id?: string
          return_fee?: number
          stop_desk_fee?: number
          swap_diff_wilaya_fee?: number
          swap_same_wilaya_fee?: number
          updated_at?: string
          wilaya_code?: string
          wilaya_name?: string
        }
        Relationships: []
      }
      delivery_fees: {
        Row: {
          created_at: string
          home_delivery_fee: number
          id: string
          stop_desk_fee: number
          updated_at: string
          wilaya_code: string
          wilaya_name: string
        }
        Insert: {
          created_at?: string
          home_delivery_fee?: number
          id?: string
          stop_desk_fee?: number
          updated_at?: string
          wilaya_code: string
          wilaya_name: string
        }
        Update: {
          created_at?: string
          home_delivery_fee?: number
          id?: string
          stop_desk_fee?: number
          updated_at?: string
          wilaya_code?: string
          wilaya_name?: string
        }
        Relationships: []
      }
      delivery_promotions: {
        Row: {
          applies_to: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          applies_to: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value?: number
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          access_token: string
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          api_key: string | null
          api_secret: string | null
          created_at: string
          id: string
          integration_type: string
          is_enabled: boolean
          name: string
          settings: Json | null
          spreadsheet_id: string | null
          store_url: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          id?: string
          integration_type: string
          is_enabled?: boolean
          name: string
          settings?: Json | null
          spreadsheet_id?: string | null
          store_url?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          id?: string
          integration_type?: string
          is_enabled?: boolean
          name?: string
          settings?: Json | null
          spreadsheet_id?: string | null
          store_url?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      local_livreurs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string
          return_tarif: number
          tarif: number
          updated_at: string
          wilaya: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone: string
          return_tarif?: number
          tarif?: number
          updated_at?: string
          wilaya?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string
          return_tarif?: number
          tarif?: number
          updated_at?: string
          wilaya?: string | null
        }
        Relationships: []
      }
      meta_conversations: {
        Row: {
          conversation_type: string
          created_at: string | null
          id: string
          is_read: boolean | null
          last_message_at: string | null
          page_id: string
          platform: string
          post_id: string | null
          sender_id: string
          sender_name: string | null
          sender_profile_pic: string | null
          thread_id: string | null
          updated_at: string | null
        }
        Insert: {
          conversation_type?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          last_message_at?: string | null
          page_id: string
          platform: string
          post_id?: string | null
          sender_id: string
          sender_name?: string | null
          sender_profile_pic?: string | null
          thread_id?: string | null
          updated_at?: string | null
        }
        Update: {
          conversation_type?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          last_message_at?: string | null
          page_id?: string
          platform?: string
          post_id?: string | null
          sender_id?: string
          sender_name?: string | null
          sender_profile_pic?: string | null
          thread_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meta_integration: {
        Row: {
          app_id: string | null
          app_secret_encrypted: string | null
          auto_reply_comments: boolean
          auto_reply_messages: boolean
          created_at: string
          facebook_connected: boolean
          id: string
          instagram_connected: boolean
          is_connected: boolean
          page_access_token_encrypted: string | null
          page_id: string | null
          updated_at: string
          verify_token: string
        }
        Insert: {
          app_id?: string | null
          app_secret_encrypted?: string | null
          auto_reply_comments?: boolean
          auto_reply_messages?: boolean
          created_at?: string
          facebook_connected?: boolean
          id?: string
          instagram_connected?: boolean
          is_connected?: boolean
          page_access_token_encrypted?: string | null
          page_id?: string | null
          updated_at?: string
          verify_token?: string
        }
        Update: {
          app_id?: string | null
          app_secret_encrypted?: string | null
          auto_reply_comments?: boolean
          auto_reply_messages?: boolean
          created_at?: string
          facebook_connected?: boolean
          id?: string
          instagram_connected?: boolean
          is_connected?: boolean
          page_access_token_encrypted?: string | null
          page_id?: string | null
          updated_at?: string
          verify_token?: string
        }
        Relationships: []
      }
      meta_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          direction: string
          id: string
          is_comment: boolean | null
          media_type: string | null
          media_url: string | null
          meta_message_id: string | null
          parent_comment_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          direction?: string
          id?: string
          is_comment?: boolean | null
          media_type?: string | null
          media_url?: string | null
          meta_message_id?: string | null
          parent_comment_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          direction?: string
          id?: string
          is_comment?: boolean | null
          media_type?: string | null
          media_url?: string | null
          meta_message_id?: string | null
          parent_comment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "meta_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pages: {
        Row: {
          created_at: string
          id: string
          integration_id: string | null
          is_active: boolean
          page_access_token_encrypted: string | null
          page_id: string
          page_name: string
          platform: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id?: string | null
          is_active?: boolean
          page_access_token_encrypted?: string | null
          page_id: string
          page_name: string
          platform: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string | null
          is_active?: boolean
          page_access_token_encrypted?: string | null
          page_id?: string
          page_name?: string
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "meta_integration"
            referencedColumns: ["id"]
          },
        ]
      }
      order_history: {
        Row: {
          changed_by: string | null
          changed_by_user_id: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["order_status"]
          notes: string | null
          old_status: Database["public"]["Enums"]["order_status"] | null
          order_id: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["order_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id: string
        }
        Update: {
          changed_by?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
          variant: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
          variant?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
          variant?: string | null
        }
        Relationships: [
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
        ]
      }
      orders: {
        Row: {
          alert: string | null
          assigned_agent: string | null
          cancelled_at: string | null
          commune: string | null
          confirmed_at: string | null
          created_at: string
          customer_address: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivered_paid_at: string | null
          delivery_company: string | null
          delivery_fee: number
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          discount: number
          id: string
          notes: string | null
          order_number: string
          pending_at: string | null
          preparing_at: string | null
          remarks: string | null
          returned_at: string | null
          shipped_at: string | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          store_id: string | null
          total_price: number
          tracking_number: string | null
          updated_at: string
          wilaya: string
        }
        Insert: {
          alert?: string | null
          assigned_agent?: string | null
          cancelled_at?: string | null
          commune?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_address: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivered_paid_at?: string | null
          delivery_company?: string | null
          delivery_fee?: number
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          discount?: number
          id?: string
          notes?: string | null
          order_number: string
          pending_at?: string | null
          preparing_at?: string | null
          remarks?: string | null
          returned_at?: string | null
          shipped_at?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          total_price?: number
          tracking_number?: string | null
          updated_at?: string
          wilaya: string
        }
        Update: {
          alert?: string | null
          assigned_agent?: string | null
          cancelled_at?: string | null
          commune?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_address?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivered_paid_at?: string | null
          delivery_company?: string | null
          delivery_fee?: number
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          discount?: number
          id?: string
          notes?: string | null
          order_number?: string
          pending_at?: string | null
          preparing_at?: string | null
          remarks?: string | null
          returned_at?: string | null
          shipped_at?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          total_price?: number
          tracking_number?: string | null
          updated_at?: string
          wilaya?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_packs: {
        Row: {
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          free_delivery: boolean
          gift_product_id: string | null
          gift_quantity: number
          id: string
          is_active: boolean
          min_quantity: number
          name: string
          price_tiers: Json | null
          product_id: string | null
          required_product_ids: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          free_delivery?: boolean
          gift_product_id?: string | null
          gift_quantity?: number
          id?: string
          is_active?: boolean
          min_quantity?: number
          name: string
          price_tiers?: Json | null
          product_id?: string | null
          required_product_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          free_delivery?: boolean
          gift_product_id?: string | null
          gift_quantity?: number
          id?: string
          is_active?: boolean
          min_quantity?: number
          name?: string
          price_tiers?: Json | null
          product_id?: string | null
          required_product_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_packs_gift_product_id_fkey"
            columns: ["gift_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_packs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          name: string
          product_id: string
          stock: number
          variant_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id: string
          stock?: number
          variant_type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          stock?: number
          variant_type?: string
        }
        Relationships: [
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
          ai_confirmation: boolean
          average_purchase_price: number | null
          barcode: string | null
          category: string
          created_at: string
          current_stock: number
          custom_home_delivery_fee: number | null
          custom_stop_desk_fee: number | null
          delivery_pricing_tier: string
          description: string | null
          free_delivery: boolean
          id: string
          name: string
          purchase_price: number
          reorder_level: number
          reserved_stock: number
          selling_price: number
          sku: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          ai_confirmation?: boolean
          average_purchase_price?: number | null
          barcode?: string | null
          category: string
          created_at?: string
          current_stock?: number
          custom_home_delivery_fee?: number | null
          custom_stop_desk_fee?: number | null
          delivery_pricing_tier?: string
          description?: string | null
          free_delivery?: boolean
          id?: string
          name: string
          purchase_price?: number
          reorder_level?: number
          reserved_stock?: number
          selling_price?: number
          sku: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_confirmation?: boolean
          average_purchase_price?: number | null
          barcode?: string | null
          category?: string
          created_at?: string
          current_stock?: number
          custom_home_delivery_fee?: number | null
          custom_stop_desk_fee?: number | null
          delivery_pricing_tier?: string
          description?: string | null
          free_delivery?: boolean
          id?: string
          name?: string
          purchase_price?: number
          reorder_level?: number
          reserved_stock?: number
          selling_price?: number
          sku?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_approved?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      special_delivery_fees: {
        Row: {
          created_at: string
          home_delivery_fee: number
          id: string
          stop_desk_fee: number
          updated_at: string
          wilaya_code: string
          wilaya_name: string
        }
        Insert: {
          created_at?: string
          home_delivery_fee?: number
          id?: string
          stop_desk_fee?: number
          updated_at?: string
          wilaya_code: string
          wilaya_name: string
        }
        Update: {
          created_at?: string
          home_delivery_fee?: number
          id?: string
          stop_desk_fee?: number
          updated_at?: string
          wilaya_code?: string
          wilaya_name?: string
        }
        Relationships: []
      }
      special_delivery_fees_2: {
        Row: {
          created_at: string
          home_delivery_fee: number
          id: string
          stop_desk_fee: number
          updated_at: string
          wilaya_code: string
          wilaya_name: string
        }
        Insert: {
          created_at?: string
          home_delivery_fee?: number
          id?: string
          stop_desk_fee?: number
          updated_at?: string
          wilaya_code: string
          wilaya_name: string
        }
        Update: {
          created_at?: string
          home_delivery_fee?: number
          id?: string
          stop_desk_fee?: number
          updated_at?: string
          wilaya_code?: string
          wilaya_name?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_stock: number
          previous_stock: number
          product_id: string
          purchase_price: number | null
          quantity: number
          reason: string | null
          reference: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_stock: number
          previous_stock: number
          product_id: string
          purchase_price?: number | null
          quantity: number
          reason?: string | null
          reference?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          new_stock?: number
          previous_stock?: number
          product_id?: string
          purchase_price?: number | null
          quantity?: number
          reason?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          contact_name: string | null
          created_at: string
          has_whatsapp: boolean
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          has_whatsapp?: boolean
          id?: string
          phone: string
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          has_whatsapp?: boolean
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      call_internal_function: {
        Args: { _function_name: string; _payload: Json }
        Returns: undefined
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      update_customer_stats: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      update_order_status_attributed: {
        Args: {
          _changed_by: string
          _delivered_at?: string
          _order_id: string
          _status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "confirmateur" | "stock_manager"
      customer_status: "new" | "regular" | "vip" | "blacklisted" | "at_risk"
      delivery_type: "home" | "stop_desk"
      order_source: "facebook" | "instagram" | "website" | "phone" | "other"
      order_status:
        | "new"
        | "validated"
        | "confirmed"
        | "cancelled"
        | "failed_1"
        | "failed_2"
        | "failed_3"
        | "no_answer"
        | "wrong_number"
        | "postponed"
        | "to_reconfirm"
        | "callback"
        | "duplicate"
        | "out_of_stock"
        | "shipped"
        | "delivered"
        | "returned"
        | "exchange"
        | "ready"
        | "at_station"
        | "preparing"
        | "delivered_paid"
        | "erreur"
        | "to_station"
        | "au_bureau"
        | "Échec_de_livraison"
        | "en_livraison"
        | "alerte"
        | "failed_4"
        | "failed_5"
        | "failed_6"
      stock_movement_type: "entry" | "exit" | "adjustment" | "sale" | "return"
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
      app_role: ["admin", "confirmateur", "stock_manager"],
      customer_status: ["new", "regular", "vip", "blacklisted", "at_risk"],
      delivery_type: ["home", "stop_desk"],
      order_source: ["facebook", "instagram", "website", "phone", "other"],
      order_status: [
        "new",
        "validated",
        "confirmed",
        "cancelled",
        "failed_1",
        "failed_2",
        "failed_3",
        "no_answer",
        "wrong_number",
        "postponed",
        "to_reconfirm",
        "callback",
        "duplicate",
        "out_of_stock",
        "shipped",
        "delivered",
        "returned",
        "exchange",
        "ready",
        "at_station",
        "preparing",
        "delivered_paid",
        "erreur",
        "to_station",
        "au_bureau",
        "Échec_de_livraison",
        "en_livraison",
        "alerte",
        "failed_4",
        "failed_5",
        "failed_6",
      ],
      stock_movement_type: ["entry", "exit", "adjustment", "sale", "return"],
    },
  },
} as const

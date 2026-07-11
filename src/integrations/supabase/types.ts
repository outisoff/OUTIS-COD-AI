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
          product_ids: string[] | null
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
          product_ids?: string[] | null
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
          product_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
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
      stock_movement_type: ["entry", "exit", "adjustment", "sale", "return"],
    },
  },
} as const

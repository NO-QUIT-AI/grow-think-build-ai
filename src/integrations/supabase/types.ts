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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ad_impressions: {
        Row: {
          created_at: string
          id: string
          page: string | null
          slot: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page?: string | null
          slot: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page?: string | null
          slot?: string
          user_id?: string | null
        }
        Relationships: []
      }
      artifacts: {
        Row: {
          content: Json
          created_at: string
          id: string
          kind: string
          title: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          kind: string
          title: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          kind?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      call_invites: {
        Row: {
          call_type: string
          created_at: string
          from_user: string
          id: string
          room_id: string
          status: string
          to_user: string
        }
        Insert: {
          call_type: string
          created_at?: string
          from_user: string
          id?: string
          room_id: string
          status?: string
          to_user: string
        }
        Update: {
          call_type?: string
          created_at?: string
          from_user?: string
          id?: string
          room_id?: string
          status?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_invites_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invites_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          app_link: string | null
          category: string
          comments_count: number
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number
          user_id: string
        }
        Insert: {
          app_link?: string | null
          category?: string
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          user_id: string
        }
        Update: {
          app_link?: string | null
          category?: string
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          user_id?: string
        }
        Relationships: []
      }
      community_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cv_documents: {
        Row: {
          created_at: string
          data: Json
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dm_conversations: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      dm_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          text: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          text: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      genesis_budgets: {
        Row: {
          monthly_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          monthly_usd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          monthly_usd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      genesis_patches: {
        Row: {
          applied_at: string | null
          created_at: string
          id: string
          new_content: string
          patch_description: string
          previous_content: string
          status: string
          target_file: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          id?: string
          new_content: string
          patch_description?: string
          previous_content?: string
          status?: string
          target_file: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          id?: string
          new_content?: string
          patch_description?: string
          previous_content?: string
          status?: string
          target_file?: string
          user_id?: string
        }
        Relationships: []
      }
      genesis_plans: {
        Row: {
          created_at: string
          id: string
          status: string
          steps: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          steps: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          steps?: Json
          user_id?: string
        }
        Relationships: []
      }
      hd_redirect_clicks: {
        Row: {
          created_at: string
          id: string
          partner: string
          reason: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          partner: string
          reason: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          partner?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      jalsa_messages: {
        Row: {
          created_at: string
          delivery: string
          id: string
          owner_id: string
          peer_id: string
          sender_id: string
          text: string
        }
        Insert: {
          created_at: string
          delivery: string
          id: string
          owner_id: string
          peer_id: string
          sender_id: string
          text: string
        }
        Update: {
          created_at?: string
          delivery?: string
          id?: string
          owner_id?: string
          peer_id?: string
          sender_id?: string
          text?: string
        }
        Relationships: []
      }
      knowledge: {
        Row: {
          confidence: number
          content: string
          created_at: string
          id: string
          source: string
          tags: string[]
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          content: string
          created_at?: string
          id?: string
          source?: string
          tags?: string[]
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          content?: string
          created_at?: string
          id?: string
          source?: string
          tags?: string[]
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          blueprint: Json
          code: string
          created_at: string
          custom_domain: string | null
          domain_status: string
          id: string
          liked: boolean
          parent_id: string | null
          project_type: string
          prompt: string
          subdomain: string | null
          subdomain_edits: number
          summary: string
          user_id: string
          version: number
        }
        Insert: {
          blueprint?: Json
          code?: string
          created_at?: string
          custom_domain?: string | null
          domain_status?: string
          id?: string
          liked?: boolean
          parent_id?: string | null
          project_type?: string
          prompt: string
          subdomain?: string | null
          subdomain_edits?: number
          summary?: string
          user_id: string
          version?: number
        }
        Update: {
          blueprint?: Json
          code?: string
          created_at?: string
          custom_domain?: string | null
          domain_status?: string
          id?: string
          liked?: boolean
          parent_id?: string | null
          project_type?: string
          prompt?: string
          subdomain?: string | null
          subdomain_edits?: number
          summary?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "memories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          reasoning: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          reasoning?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          reasoning?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mind_thoughts: {
        Row: {
          created_at: string
          id: string
          is_auto: boolean
          source_chat: string | null
          thought: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_auto?: boolean
          source_chat?: string | null
          thought: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_auto?: boolean
          source_chat?: string | null
          thought?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          id: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      nqai_mining: {
        Row: {
          is_mining: boolean
          last_claim_time: string | null
          mining_rate: number
          session_start: string | null
          total_coins: number
          total_invites: number
          updated_at: string
          user_id: string
        }
        Insert: {
          is_mining?: boolean
          last_claim_time?: string | null
          mining_rate?: number
          session_start?: string | null
          total_coins?: number
          total_invites?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          is_mining?: boolean
          last_claim_time?: string | null
          mining_rate?: number
          session_start?: string | null
          total_coins?: number
          total_invites?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nqai_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      nqai_wallets: {
        Row: {
          balance: number
          last_mined_at: string | null
          last_share_at: string | null
          streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          last_mined_at?: string | null
          last_share_at?: string | null
          streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          last_mined_at?: string | null
          last_share_at?: string | null
          streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      owners: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          custom_domain: string | null
          display_name: string | null
          domain_status: string | null
          id: string
          invite_code: string | null
          reputation_points: number
          subdomain: string | null
          total_apps_built: number
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          custom_domain?: string | null
          display_name?: string | null
          domain_status?: string | null
          id: string
          invite_code?: string | null
          reputation_points?: number
          subdomain?: string | null
          total_apps_built?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          custom_domain?: string | null
          display_name?: string | null
          domain_status?: string | null
          id?: string
          invite_code?: string | null
          reputation_points?: number
          subdomain?: string | null
          total_apps_built?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          invited_user_id: string
          inviter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_user_id: string
          inviter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_user_id?: string
          inviter_id?: string
        }
        Relationships: []
      }
      tool_audit_log: {
        Row: {
          args: Json | null
          created_at: string
          id: string
          ok: boolean
          result: Json | null
          tool: string
          user_id: string
        }
        Insert: {
          args?: Json | null
          created_at?: string
          id?: string
          ok?: boolean
          result?: Json | null
          tool: string
          user_id: string
        }
        Update: {
          args?: Json | null
          created_at?: string
          id?: string
          ok?: boolean
          result?: Json | null
          tool?: string
          user_id?: string
        }
        Relationships: []
      }
      tool_permission_grants: {
        Row: {
          created_at: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          scope: string
          user_id: string
        }
        Update: {
          created_at?: string
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      usage: {
        Row: {
          cost_kind: string
          created_at: string
          id: string
          status: string
          tokens: number | null
          tool: string
          usd: number
          user_id: string
        }
        Insert: {
          cost_kind?: string
          created_at?: string
          id?: string
          status?: string
          tokens?: number | null
          tool: string
          usd?: number
          user_id: string
        }
        Update: {
          cost_kind?: string
          created_at?: string
          id?: string
          status?: string
          tokens?: number | null
          tool?: string
          usd?: number
          user_id?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      viral_videos: {
        Row: {
          bonus_awarded: boolean
          created_at: string
          id: string
          memory_id: string | null
          r2_key: string
          title: string
          url: string
          user_id: string
          views: number
          watermarked: boolean
        }
        Insert: {
          bonus_awarded?: boolean
          created_at?: string
          id?: string
          memory_id?: string | null
          r2_key: string
          title?: string
          url: string
          user_id: string
          views?: number
          watermarked?: boolean
        }
        Update: {
          bonus_awarded?: boolean
          created_at?: string
          id?: string
          memory_id?: string | null
          r2_key?: string
          title?: string
          url?: string
          user_id?: string
          views?: number
          watermarked?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ad_stats: { Args: never; Returns: Json }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      check_subdomain_availability: {
        Args: { _subdomain: string }
        Returns: boolean
      }
      gen_invite_code: { Args: never; Returns: string }
      genesis_confirm_patch: { Args: { p_id: string }; Returns: Json }
      genesis_reserve_usage: {
        Args: { p_tool: string; p_usd: number; p_user: string }
        Returns: string
      }
      genesis_save_summary: {
        Args: {
          p_content: string
          p_source: string
          p_tags: string[]
          p_topic: string
        }
        Returns: Json
      }
      get_site_by_subdomain: { Args: { _subdomain: string }; Returns: string }
      is_owner: { Args: { _uid: string }; Returns: boolean }
      nqai_award: {
        Args: { _amount: number; _reason: string; _user: string }
        Returns: undefined
      }
      nqai_claim_mining: { Args: never; Returns: Json }
      nqai_invite_multiplier: { Args: { _user: string }; Returns: number }
      nqai_mine: { Args: never; Returns: Json }
      nqai_mine_ad: { Args: { _ad_watched: boolean }; Returns: Json }
      nqai_mining_state: { Args: never; Returns: Json }
      nqai_my_invite_code: { Args: never; Returns: string }
      nqai_redeem_invite: { Args: { _code: string }; Returns: Json }
      nqai_share_bonus: { Args: never; Returns: Json }
      nqai_start_mining: { Args: never; Returns: Json }
      publish_build: { Args: { _build_id: string }; Returns: string }
      rename_build_subdomain: {
        Args: { _build_id: string; _subdomain: string }
        Returns: string
      }
      slugify: { Args: { _t: string }; Returns: string }
      subdomain_valid: { Args: { _s: string }; Returns: boolean }
      sync_jalsa_messages: { Args: { items: Json }; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

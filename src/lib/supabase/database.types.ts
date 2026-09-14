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
      attachments: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          id: string
          message_id: string | null
          mime_type: string
          occurrence_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
          uploaded_by_reporter: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name: string
          id?: string
          message_id?: string | null
          mime_type: string
          occurrence_id: string
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
          uploaded_by_reporter?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string | null
          mime_type?: string
          occurrence_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
          uploaded_by_reporter?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "attachments_message_fk"
            columns: ["message_id", "company_id"]
            isOneToOne: false
            referencedRelation: "occurrence_messages"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "attachments_occurrence_fk"
            columns: ["occurrence_id", "company_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "attachments_uploader_fk"
            columns: ["uploaded_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          changes: Json
          company_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          changes?: Json
          company_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          changes?: Json
          company_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      branches: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          internal_code: string | null
          is_headquarters: boolean
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["record_status"]
          tax_id: string | null
          trade_name: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          internal_code?: string | null
          is_headquarters?: boolean
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tax_id?: string | null
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          internal_code?: string | null
          is_headquarters?: boolean
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tax_id?: string | null
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          email: string
          id: string
          legal_name: string
          logo_url: string | null
          phone: string | null
          plan_id: string | null
          slug: string
          status: Database["public"]["Enums"]["company_status"]
          tax_id: string
          trade_name: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          email: string
          id?: string
          legal_name: string
          logo_url?: string | null
          phone?: string | null
          plan_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["company_status"]
          tax_id: string
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          email?: string
          id?: string
          legal_name?: string
          logo_url?: string | null
          phone?: string | null
          plan_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["company_status"]
          tax_id?: string
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          allow_anonymous: boolean
          allow_attachments: boolean
          allow_rating: boolean
          channel_name: string | null
          company_id: string
          created_at: string
          default_sla_days: number
          intro_text: string | null
          logo_url: string | null
          max_attachment_mb: number
          notification_email: string | null
          primary_color: string
          privacy_policy_text: string | null
          secondary_color: string
          sla_warning_days: number
          updated_at: string
        }
        Insert: {
          allow_anonymous?: boolean
          allow_attachments?: boolean
          allow_rating?: boolean
          channel_name?: string | null
          company_id: string
          created_at?: string
          default_sla_days?: number
          intro_text?: string | null
          logo_url?: string | null
          max_attachment_mb?: number
          notification_email?: string | null
          primary_color?: string
          privacy_policy_text?: string | null
          secondary_color?: string
          sla_warning_days?: number
          updated_at?: string
        }
        Update: {
          allow_anonymous?: boolean
          allow_attachments?: boolean
          allow_rating?: boolean
          channel_name?: string | null
          company_id?: string
          created_at?: string
          default_sla_days?: number
          intro_text?: string | null
          logo_url?: string | null
          max_attachment_mb?: number
          notification_email?: string | null
          primary_color?: string
          privacy_policy_text?: string | null
          secondary_color?: string
          sla_warning_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_events: {
        Row: {
          actor_id: string | null
          actor_label: string
          company_id: string
          created_at: string
          description: string
          event_type: string
          id: string
          metadata: Json
          occurrence_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string
          company_id: string
          created_at?: string
          description: string
          event_type: string
          id?: string
          metadata?: Json
          occurrence_id: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string
          company_id?: string
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurrence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_events_actor_fk"
            columns: ["actor_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "occurrence_events_occurrence_fk"
            columns: ["occurrence_id", "company_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      occurrence_messages: {
        Row: {
          author: Database["public"]["Enums"]["message_author"]
          author_id: string | null
          body: string
          company_id: string
          created_at: string
          id: string
          is_internal: boolean
          occurrence_id: string
          read_at: string | null
        }
        Insert: {
          author: Database["public"]["Enums"]["message_author"]
          author_id?: string | null
          body: string
          company_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          occurrence_id: string
          read_at?: string | null
        }
        Update: {
          author?: Database["public"]["Enums"]["message_author"]
          author_id?: string | null
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          occurrence_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_messages_author_fk"
            columns: ["author_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "occurrence_messages_occurrence_fk"
            columns: ["occurrence_id", "company_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      occurrence_ratings: {
        Row: {
          comment: string | null
          company_id: string
          created_at: string
          occurrence_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          company_id: string
          created_at?: string
          occurrence_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          company_id?: string
          created_at?: string
          occurrence_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_ratings_occurrence_fk"
            columns: ["occurrence_id", "company_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      occurrence_tasks: {
        Row: {
          assignee_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_on: string | null
          id: string
          occurrence_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_on?: string | null
          id?: string
          occurrence_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_on?: string | null
          id?: string
          occurrence_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_tasks_assignee_fk"
            columns: ["assignee_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "occurrence_tasks_creator_fk"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "occurrence_tasks_occurrence_fk"
            columns: ["occurrence_id", "company_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      occurrence_types: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrences: {
        Row: {
          amount_involved: number | null
          answer: string | null
          answered_at: string | null
          assignee_id: string | null
          branch_id: string | null
          category_id: string | null
          closed_at: string | null
          closing_reason: string | null
          company_id: string
          created_at: string
          custom_fields: Json
          department_id: string | null
          description: string
          due_at: string
          first_response_at: string | null
          has_witnesses: boolean | null
          id: string
          is_anonymous: boolean
          occurred_at: string | null
          occurred_location: string | null
          opened_at: string
          people_involved: string | null
          protocol: string
          reporter_email: string | null
          reporter_name: string | null
          reporter_phone: string | null
          reporter_tax_id: string | null
          reporter_whatsapp: string | null
          resolution:
            | Database["public"]["Enums"]["occurrence_resolution"]
            | null
          status: Database["public"]["Enums"]["occurrence_status"]
          subject_id: string | null
          tracking_code_hash: string
          type_id: string | null
          updated_at: string
        }
        Insert: {
          amount_involved?: number | null
          answer?: string | null
          answered_at?: string | null
          assignee_id?: string | null
          branch_id?: string | null
          category_id?: string | null
          closed_at?: string | null
          closing_reason?: string | null
          company_id: string
          created_at?: string
          custom_fields?: Json
          department_id?: string | null
          description: string
          due_at: string
          first_response_at?: string | null
          has_witnesses?: boolean | null
          id?: string
          is_anonymous?: boolean
          occurred_at?: string | null
          occurred_location?: string | null
          opened_at?: string
          people_involved?: string | null
          protocol: string
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_phone?: string | null
          reporter_tax_id?: string | null
          reporter_whatsapp?: string | null
          resolution?:
            | Database["public"]["Enums"]["occurrence_resolution"]
            | null
          status?: Database["public"]["Enums"]["occurrence_status"]
          subject_id?: string | null
          tracking_code_hash: string
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_involved?: number | null
          answer?: string | null
          answered_at?: string | null
          assignee_id?: string | null
          branch_id?: string | null
          category_id?: string | null
          closed_at?: string | null
          closing_reason?: string | null
          company_id?: string
          created_at?: string
          custom_fields?: Json
          department_id?: string | null
          description?: string
          due_at?: string
          first_response_at?: string | null
          has_witnesses?: boolean | null
          id?: string
          is_anonymous?: boolean
          occurred_at?: string | null
          occurred_location?: string | null
          opened_at?: string
          people_involved?: string | null
          protocol?: string
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_phone?: string | null
          reporter_tax_id?: string | null
          reporter_whatsapp?: string | null
          resolution?:
            | Database["public"]["Enums"]["occurrence_resolution"]
            | null
          status?: Database["public"]["Enums"]["occurrence_status"]
          subject_id?: string | null
          tracking_code_hash?: string
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_assignee_fk"
            columns: ["assignee_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "occurrences_branch_fk"
            columns: ["branch_id", "company_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "occurrences_category_fk"
            columns: ["category_id", "company_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "occurrences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_department_fk"
            columns: ["department_id", "company_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "occurrences_subject_fk"
            columns: ["subject_id", "company_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "occurrences_type_fk"
            columns: ["type_id", "company_id"]
            isOneToOne: false
            referencedRelation: "occurrence_types"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_branches: number | null
          max_users: number | null
          monthly_price: number | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_users?: number | null
          monthly_price?: number | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_users?: number | null
          monthly_price?: number | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          job_title: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["record_status"]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          id: string
          job_title?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["record_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["record_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_counters: {
        Row: {
          company_id: string
          last_number: number
          year: number
        }
        Insert: {
          company_id: string
          last_number?: number
          year: number
        }
        Update: {
          company_id?: string
          last_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "protocol_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branches: {
        Row: {
          branch_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_manifestacao: {
        Args: {
          p_amount_involved?: number
          p_branch_id?: string
          p_category_id?: string
          p_company_slug: string
          p_description: string
          p_has_witnesses?: boolean
          p_is_anonymous?: boolean
          p_occurred_at?: string
          p_occurred_location?: string
          p_people_involved?: string
          p_reporter_email?: string
          p_reporter_name?: string
          p_reporter_phone?: string
          p_reporter_tax_id?: string
          p_reporter_whatsapp?: string
          p_subject_id?: string
          p_type_id?: string
        }
        Returns: Json
      }
      dashboard_breakdown: {
        Args: { p_days?: number; p_dimension: string }
        Returns: {
          rotulo: string
          total: number
        }[]
      }
      dashboard_summary: { Args: { p_days?: number }; Returns: Json }
      dashboard_timeseries: {
        Args: { p_days?: number }
        Returns: {
          dia: string
          total: number
        }[]
      }
      get_ouvidoria_channel: { Args: { p_company_slug: string }; Returns: Json }
      occurrence_sla_state: {
        Args: {
          p_closed_at: string
          p_due_at: string
          p_status: Database["public"]["Enums"]["occurrence_status"]
          p_warning_days?: number
        }
        Returns: Database["public"]["Enums"]["sla_state"]
      }
      provision_company: {
        Args: {
          p_admin_email?: string
          p_admin_name?: string
          p_admin_user_id?: string
          p_email: string
          p_headquarters?: string
          p_legal_name: string
          p_plan_slug?: string
          p_slug: string
          p_tax_id: string
          p_trade_name?: string
        }
        Returns: string
      }
      rate_manifestacao: {
        Args: {
          p_comment?: string
          p_company_slug: string
          p_protocol: string
          p_stars: number
          p_tracking_code: string
        }
        Returns: Json
      }
      reply_manifestacao: {
        Args: {
          p_body: string
          p_company_slug: string
          p_protocol: string
          p_tracking_code: string
        }
        Returns: Json
      }
      track_manifestacao: {
        Args: {
          p_company_slug: string
          p_protocol: string
          p_tracking_code: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "platform_admin"
        | "company_admin"
        | "ombudsman"
        | "manager"
        | "area_responsible"
      company_status: "ativa" | "suspensa" | "bloqueada" | "cancelada"
      message_author: "manifestante" | "operador"
      occurrence_resolution:
        | "procedente"
        | "improcedente"
        | "parcialmente_procedente"
        | "nao_conclusivo"
      occurrence_status:
        | "recebida"
        | "em_analise"
        | "em_tratamento"
        | "aguardando_informacoes"
        | "aguardando_resposta"
        | "respondida"
        | "encerrada"
        | "cancelada"
        | "descartada"
      record_status: "ativo" | "inativo"
      sla_state: "no_prazo" | "proximo_vencimento" | "em_atraso" | "concluida"
      task_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
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
    Enums: {
      app_role: [
        "platform_admin",
        "company_admin",
        "ombudsman",
        "manager",
        "area_responsible",
      ],
      company_status: ["ativa", "suspensa", "bloqueada", "cancelada"],
      message_author: ["manifestante", "operador"],
      occurrence_resolution: [
        "procedente",
        "improcedente",
        "parcialmente_procedente",
        "nao_conclusivo",
      ],
      occurrence_status: [
        "recebida",
        "em_analise",
        "em_tratamento",
        "aguardando_informacoes",
        "aguardando_resposta",
        "respondida",
        "encerrada",
        "cancelada",
        "descartada",
      ],
      record_status: ["ativo", "inativo"],
      sla_state: ["no_prazo", "proximo_vencimento", "em_atraso", "concluida"],
      task_status: ["pendente", "em_andamento", "concluida", "cancelada"],
    },
  },
} as const

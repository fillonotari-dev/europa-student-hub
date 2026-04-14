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
      assegnazioni: {
        Row: {
          camera_id: string
          candidatura_id: string
          created_at: string | null
          data_fine: string | null
          data_inizio: string | null
          id: string
          note: string | null
          posto: number
          stato: string | null
          studente_id: string
          updated_at: string | null
        }
        Insert: {
          camera_id: string
          candidatura_id: string
          created_at?: string | null
          data_fine?: string | null
          data_inizio?: string | null
          id?: string
          note?: string | null
          posto: number
          stato?: string | null
          studente_id: string
          updated_at?: string | null
        }
        Update: {
          camera_id?: string
          candidatura_id?: string
          created_at?: string | null
          data_fine?: string | null
          data_inizio?: string | null
          id?: string
          note?: string | null
          posto?: number
          stato?: string | null
          studente_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assegnazioni_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "camere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assegnazioni_candidatura_id_fkey"
            columns: ["candidatura_id"]
            isOneToOne: false
            referencedRelation: "candidature"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assegnazioni_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "studenti"
            referencedColumns: ["id"]
          },
        ]
      }
      camere: {
        Row: {
          created_at: string | null
          id: string
          note: string | null
          numero: string
          piano: number | null
          posti: number
          stato: string | null
          struttura_id: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          note?: string | null
          numero: string
          piano?: number | null
          posti: number
          stato?: string | null
          struttura_id: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string | null
          numero?: string
          piano?: number | null
          posti?: number
          stato?: string | null
          struttura_id?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camere_struttura_id_fkey"
            columns: ["struttura_id"]
            isOneToOne: false
            referencedRelation: "strutture"
            referencedColumns: ["id"]
          },
        ]
      }
      candidature: {
        Row: {
          anno_accademico: string | null
          anno_corso_snapshot: string | null
          corso_snapshot: string | null
          created_at: string | null
          id: string
          matricola_snapshot: string | null
          messaggio: string | null
          note_admin: string | null
          periodo_fine: string | null
          periodo_inizio: string | null
          stato: string | null
          struttura_preferita_id: string | null
          studente_id: string
          tipo_camera_preferito: string | null
          universita_snapshot: string | null
          updated_at: string | null
        }
        Insert: {
          anno_accademico?: string | null
          anno_corso_snapshot?: string | null
          corso_snapshot?: string | null
          created_at?: string | null
          id?: string
          matricola_snapshot?: string | null
          messaggio?: string | null
          note_admin?: string | null
          periodo_fine?: string | null
          periodo_inizio?: string | null
          stato?: string | null
          struttura_preferita_id?: string | null
          studente_id: string
          tipo_camera_preferito?: string | null
          universita_snapshot?: string | null
          updated_at?: string | null
        }
        Update: {
          anno_accademico?: string | null
          anno_corso_snapshot?: string | null
          corso_snapshot?: string | null
          created_at?: string | null
          id?: string
          matricola_snapshot?: string | null
          messaggio?: string | null
          note_admin?: string | null
          periodo_fine?: string | null
          periodo_inizio?: string | null
          stato?: string | null
          struttura_preferita_id?: string | null
          studente_id?: string
          tipo_camera_preferito?: string | null
          universita_snapshot?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidature_struttura_preferita_id_fkey"
            columns: ["struttura_preferita_id"]
            isOneToOne: false
            referencedRelation: "strutture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidature_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "studenti"
            referencedColumns: ["id"]
          },
        ]
      }
      documenti: {
        Row: {
          candidatura_id: string | null
          caricato_da: string | null
          created_at: string | null
          id: string
          nome_file: string
          studente_id: string
          tipo: string | null
          url: string
        }
        Insert: {
          candidatura_id?: string | null
          caricato_da?: string | null
          created_at?: string | null
          id?: string
          nome_file: string
          studente_id: string
          tipo?: string | null
          url: string
        }
        Update: {
          candidatura_id?: string | null
          caricato_da?: string | null
          created_at?: string | null
          id?: string
          nome_file?: string
          studente_id?: string
          tipo?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documenti_candidatura_id_fkey"
            columns: ["candidatura_id"]
            isOneToOne: false
            referencedRelation: "candidature"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documenti_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "studenti"
            referencedColumns: ["id"]
          },
        ]
      }
      log_stato_candidature: {
        Row: {
          cambiato_da: string | null
          candidatura_id: string
          created_at: string | null
          id: string
          note: string | null
          stato_nuovo: string
          stato_precedente: string | null
        }
        Insert: {
          cambiato_da?: string | null
          candidatura_id: string
          created_at?: string | null
          id?: string
          note?: string | null
          stato_nuovo: string
          stato_precedente?: string | null
        }
        Update: {
          cambiato_da?: string | null
          candidatura_id?: string
          created_at?: string | null
          id?: string
          note?: string | null
          stato_nuovo?: string
          stato_precedente?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_stato_candidature_candidatura_id_fkey"
            columns: ["candidatura_id"]
            isOneToOne: false
            referencedRelation: "candidature"
            referencedColumns: ["id"]
          },
        ]
      }
      strutture: {
        Row: {
          attiva: boolean | null
          created_at: string | null
          id: string
          indirizzo: string | null
          nome: string
          piani: number | null
          updated_at: string | null
        }
        Insert: {
          attiva?: boolean | null
          created_at?: string | null
          id?: string
          indirizzo?: string | null
          nome: string
          piani?: number | null
          updated_at?: string | null
        }
        Update: {
          attiva?: boolean | null
          created_at?: string | null
          id?: string
          indirizzo?: string | null
          nome?: string
          piani?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      studenti: {
        Row: {
          anno_di_corso: string | null
          auth_user_id: string | null
          codice_fiscale: string | null
          cognome: string
          corso_di_studi: string | null
          created_at: string | null
          data_nascita: string | null
          email: string
          id: string
          matricola: string | null
          nazionalita: string | null
          nome: string
          telefono: string | null
          universita: string | null
          updated_at: string | null
        }
        Insert: {
          anno_di_corso?: string | null
          auth_user_id?: string | null
          codice_fiscale?: string | null
          cognome: string
          corso_di_studi?: string | null
          created_at?: string | null
          data_nascita?: string | null
          email: string
          id?: string
          matricola?: string | null
          nazionalita?: string | null
          nome: string
          telefono?: string | null
          universita?: string | null
          updated_at?: string | null
        }
        Update: {
          anno_di_corso?: string | null
          auth_user_id?: string | null
          codice_fiscale?: string | null
          cognome?: string
          corso_di_studi?: string | null
          created_at?: string | null
          data_nascita?: string | null
          email?: string
          id?: string
          matricola?: string | null
          nazionalita?: string | null
          nome?: string
          telefono?: string | null
          universita?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "studente"
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
      app_role: ["admin", "studente"],
    },
  },
} as const

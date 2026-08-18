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
      anagrafiche_fatturazione: {
        Row: {
          codice_destinatario: string | null
          codice_fiscale: string | null
          cognome: string | null
          created_at: string
          denominazione: string | null
          email_recapito: string | null
          fic_entity_id: number | null
          id: string
          indirizzo_cap: string | null
          indirizzo_civico: string | null
          indirizzo_comune: string | null
          indirizzo_nazione: string
          indirizzo_provincia: string | null
          indirizzo_via: string | null
          nome: string | null
          note: string | null
          partita_iva: string | null
          pec: string | null
          studente_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          codice_destinatario?: string | null
          codice_fiscale?: string | null
          cognome?: string | null
          created_at?: string
          denominazione?: string | null
          email_recapito?: string | null
          fic_entity_id?: number | null
          id?: string
          indirizzo_cap?: string | null
          indirizzo_civico?: string | null
          indirizzo_comune?: string | null
          indirizzo_nazione?: string
          indirizzo_provincia?: string | null
          indirizzo_via?: string | null
          nome?: string | null
          note?: string | null
          partita_iva?: string | null
          pec?: string | null
          studente_id?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          codice_destinatario?: string | null
          codice_fiscale?: string | null
          cognome?: string | null
          created_at?: string
          denominazione?: string | null
          email_recapito?: string | null
          fic_entity_id?: number | null
          id?: string
          indirizzo_cap?: string | null
          indirizzo_civico?: string | null
          indirizzo_comune?: string | null
          indirizzo_nazione?: string
          indirizzo_provincia?: string | null
          indirizzo_via?: string | null
          nome?: string | null
          note?: string | null
          partita_iva?: string | null
          pec?: string | null
          studente_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anagrafiche_fatturazione_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "studenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anagrafiche_fatturazione_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "v_studenti_stadio"
            referencedColumns: ["studente_id"]
          },
        ]
      }
      assegnazioni: {
        Row: {
          camera_id: string
          candidatura_id: string
          created_at: string | null
          data_fine: string | null
          data_inizio: string
          id: string
          motivo_chiusura: string | null
          note: string | null
          posto: number
          stato: string
          studente_id: string
          updated_at: string | null
        }
        Insert: {
          camera_id: string
          candidatura_id: string
          created_at?: string | null
          data_fine?: string | null
          data_inizio: string
          id?: string
          motivo_chiusura?: string | null
          note?: string | null
          posto: number
          stato?: string
          studente_id: string
          updated_at?: string | null
        }
        Update: {
          camera_id?: string
          candidatura_id?: string
          created_at?: string | null
          data_fine?: string | null
          data_inizio?: string
          id?: string
          motivo_chiusura?: string | null
          note?: string | null
          posto?: number
          stato?: string
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
            foreignKeyName: "assegnazioni_candidatura_id_fkey"
            columns: ["candidatura_id"]
            isOneToOne: false
            referencedRelation: "v_studenti_stadio"
            referencedColumns: ["candidatura_id"]
          },
          {
            foreignKeyName: "assegnazioni_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "studenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assegnazioni_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "v_studenti_stadio"
            referencedColumns: ["studente_id"]
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
          stato: string
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
          stato?: string
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
          stato?: string
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
      candidatura_sessioni: {
        Row: {
          consumata_il: string | null
          created_at: string
          origine: string
          temp_id: string
          upload_count: number
        }
        Insert: {
          consumata_il?: string | null
          created_at?: string
          origine: string
          temp_id: string
          upload_count?: number
        }
        Update: {
          consumata_il?: string | null
          created_at?: string
          origine?: string
          temp_id?: string
          upload_count?: number
        }
        Relationships: []
      }
      candidature: {
        Row: {
          anno_accademico: string | null
          anno_corso_snapshot: string | null
          come_conosciuto: string | null
          come_conosciuto_altro: string | null
          completamento_token_hash: string | null
          completata_il: string | null
          corso_snapshot: string | null
          created_at: string | null
          data_arrivo_prevista: string | null
          dichiarazioni: Json
          documento_identita_n: string | null
          esito_email_inviata_il: string | null
          esito_email_nota: string | null
          fumatore: boolean | null
          garante_email: string | null
          garante_nome: string | null
          garante_relazione: string | null
          garante_telefono: string | null
          id: string
          lingua: string
          lingue_parlate: string | null
          matricola_snapshot: string | null
          messaggio: string | null
          note_admin: string | null
          orari: string | null
          ordine_pulizia: string | null
          periodo_fine: string | null
          periodo_inizio: string | null
          personalita: string | null
          personalita_altro: string | null
          preferenze_note: string | null
          presentazione: string | null
          priorita: number | null
          stato: string
          struttura_preferita_id: string | null
          studente_id: string
          tipo_camera_preferito: string | null
          tipo_studente: string | null
          tipo_studente_altro: string | null
          token_scade_il: string | null
          universita_snapshot: string | null
          updated_at: string | null
          versione_form: string
        }
        Insert: {
          anno_accademico?: string | null
          anno_corso_snapshot?: string | null
          come_conosciuto?: string | null
          come_conosciuto_altro?: string | null
          completamento_token_hash?: string | null
          completata_il?: string | null
          corso_snapshot?: string | null
          created_at?: string | null
          data_arrivo_prevista?: string | null
          dichiarazioni?: Json
          documento_identita_n?: string | null
          esito_email_inviata_il?: string | null
          esito_email_nota?: string | null
          fumatore?: boolean | null
          garante_email?: string | null
          garante_nome?: string | null
          garante_relazione?: string | null
          garante_telefono?: string | null
          id?: string
          lingua?: string
          lingue_parlate?: string | null
          matricola_snapshot?: string | null
          messaggio?: string | null
          note_admin?: string | null
          orari?: string | null
          ordine_pulizia?: string | null
          periodo_fine?: string | null
          periodo_inizio?: string | null
          personalita?: string | null
          personalita_altro?: string | null
          preferenze_note?: string | null
          presentazione?: string | null
          priorita?: number | null
          stato?: string
          struttura_preferita_id?: string | null
          studente_id: string
          tipo_camera_preferito?: string | null
          tipo_studente?: string | null
          tipo_studente_altro?: string | null
          token_scade_il?: string | null
          universita_snapshot?: string | null
          updated_at?: string | null
          versione_form?: string
        }
        Update: {
          anno_accademico?: string | null
          anno_corso_snapshot?: string | null
          come_conosciuto?: string | null
          come_conosciuto_altro?: string | null
          completamento_token_hash?: string | null
          completata_il?: string | null
          corso_snapshot?: string | null
          created_at?: string | null
          data_arrivo_prevista?: string | null
          dichiarazioni?: Json
          documento_identita_n?: string | null
          esito_email_inviata_il?: string | null
          esito_email_nota?: string | null
          fumatore?: boolean | null
          garante_email?: string | null
          garante_nome?: string | null
          garante_relazione?: string | null
          garante_telefono?: string | null
          id?: string
          lingua?: string
          lingue_parlate?: string | null
          matricola_snapshot?: string | null
          messaggio?: string | null
          note_admin?: string | null
          orari?: string | null
          ordine_pulizia?: string | null
          periodo_fine?: string | null
          periodo_inizio?: string | null
          personalita?: string | null
          personalita_altro?: string | null
          preferenze_note?: string | null
          presentazione?: string | null
          priorita?: number | null
          stato?: string
          struttura_preferita_id?: string | null
          studente_id?: string
          tipo_camera_preferito?: string | null
          tipo_studente?: string | null
          tipo_studente_altro?: string | null
          token_scade_il?: string | null
          universita_snapshot?: string | null
          updated_at?: string | null
          versione_form?: string
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
          {
            foreignKeyName: "candidature_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "v_studenti_stadio"
            referencedColumns: ["studente_id"]
          },
        ]
      }
      canoni: {
        Row: {
          aliquota_iva: number
          competenza: string
          contratto_id: string
          created_at: string
          id: string
          imponibile: number
          note: string | null
          scadenza: string
          stato: string
          totale: number | null
          updated_at: string
        }
        Insert: {
          aliquota_iva: number
          competenza: string
          contratto_id: string
          created_at?: string
          id?: string
          imponibile: number
          note?: string | null
          scadenza: string
          stato?: string
          totale?: number | null
          updated_at?: string
        }
        Update: {
          aliquota_iva?: number
          competenza?: string
          contratto_id?: string
          created_at?: string
          id?: string
          imponibile?: number
          note?: string | null
          scadenza?: string
          stato?: string
          totale?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canoni_contratto_id_fkey"
            columns: ["contratto_id"]
            isOneToOne: false
            referencedRelation: "contratti"
            referencedColumns: ["id"]
          },
        ]
      }
      contratti: {
        Row: {
          aliquota_iva: number
          anagrafica_fatturazione_id: string
          assegnazione_id: string | null
          canone_mensile: number
          canone_note: string | null
          contratto_precedente_id: string | null
          created_at: string
          data_fine: string
          data_inizio: string
          deposito_data_incasso: string | null
          deposito_importo: number | null
          deposito_importo_restituito: number | null
          deposito_modalita: string | null
          deposito_motivo_esenzione: string | null
          deposito_motivo_trattenuta: string | null
          deposito_richiesto: boolean
          deposito_stato: string | null
          file_firmato_path: string | null
          garante_email: string | null
          garante_nome: string | null
          garante_relazione: string | null
          garante_telefono: string | null
          id: string
          note: string | null
          stato: string
          struttura_id: string
          studente_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          aliquota_iva?: number
          anagrafica_fatturazione_id: string
          assegnazione_id?: string | null
          canone_mensile: number
          canone_note?: string | null
          contratto_precedente_id?: string | null
          created_at?: string
          data_fine: string
          data_inizio: string
          deposito_data_incasso?: string | null
          deposito_importo?: number | null
          deposito_importo_restituito?: number | null
          deposito_modalita?: string | null
          deposito_motivo_esenzione?: string | null
          deposito_motivo_trattenuta?: string | null
          deposito_richiesto?: boolean
          deposito_stato?: string | null
          file_firmato_path?: string | null
          garante_email?: string | null
          garante_nome?: string | null
          garante_relazione?: string | null
          garante_telefono?: string | null
          id?: string
          note?: string | null
          stato?: string
          struttura_id: string
          studente_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          aliquota_iva?: number
          anagrafica_fatturazione_id?: string
          assegnazione_id?: string | null
          canone_mensile?: number
          canone_note?: string | null
          contratto_precedente_id?: string | null
          created_at?: string
          data_fine?: string
          data_inizio?: string
          deposito_data_incasso?: string | null
          deposito_importo?: number | null
          deposito_importo_restituito?: number | null
          deposito_modalita?: string | null
          deposito_motivo_esenzione?: string | null
          deposito_motivo_trattenuta?: string | null
          deposito_richiesto?: boolean
          deposito_stato?: string | null
          file_firmato_path?: string | null
          garante_email?: string | null
          garante_nome?: string | null
          garante_relazione?: string | null
          garante_telefono?: string | null
          id?: string
          note?: string | null
          stato?: string
          struttura_id?: string
          studente_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratti_anagrafica_fatturazione_id_fkey"
            columns: ["anagrafica_fatturazione_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_fatturazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratti_assegnazione_id_fkey"
            columns: ["assegnazione_id"]
            isOneToOne: false
            referencedRelation: "assegnazioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratti_assegnazione_id_fkey"
            columns: ["assegnazione_id"]
            isOneToOne: false
            referencedRelation: "v_studenti_stadio"
            referencedColumns: ["assegnazione_id"]
          },
          {
            foreignKeyName: "contratti_contratto_precedente_id_fkey"
            columns: ["contratto_precedente_id"]
            isOneToOne: false
            referencedRelation: "contratti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratti_struttura_id_fkey"
            columns: ["struttura_id"]
            isOneToOne: false
            referencedRelation: "strutture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratti_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "studenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratti_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "v_studenti_stadio"
            referencedColumns: ["studente_id"]
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
            foreignKeyName: "documenti_candidatura_id_fkey"
            columns: ["candidatura_id"]
            isOneToOne: false
            referencedRelation: "v_studenti_stadio"
            referencedColumns: ["candidatura_id"]
          },
          {
            foreignKeyName: "documenti_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "studenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documenti_studente_id_fkey"
            columns: ["studente_id"]
            isOneToOne: false
            referencedRelation: "v_studenti_stadio"
            referencedColumns: ["studente_id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      impostazioni: {
        Row: {
          contatto_email: string | null
          contatto_orari: string | null
          contatto_telefono: string | null
          contatto_whatsapp: string | null
          id: number
          notifica_email: string | null
          updated_at: string
        }
        Insert: {
          contatto_email?: string | null
          contatto_orari?: string | null
          contatto_telefono?: string | null
          contatto_whatsapp?: string | null
          id?: number
          notifica_email?: string | null
          updated_at?: string
        }
        Update: {
          contatto_email?: string | null
          contatto_orari?: string | null
          contatto_telefono?: string | null
          contatto_whatsapp?: string | null
          id?: number
          notifica_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      listini: {
        Row: {
          created_at: string
          id: string
          importo_mensile: number
          struttura_id: string
          tipo_camera: string
          valido_al: string | null
          valido_dal: string
        }
        Insert: {
          created_at?: string
          id?: string
          importo_mensile: number
          struttura_id: string
          tipo_camera: string
          valido_al?: string | null
          valido_dal: string
        }
        Update: {
          created_at?: string
          id?: string
          importo_mensile?: number
          struttura_id?: string
          tipo_camera?: string
          valido_al?: string | null
          valido_dal?: string
        }
        Relationships: [
          {
            foreignKeyName: "listini_struttura_id_fkey"
            columns: ["struttura_id"]
            isOneToOne: false
            referencedRelation: "strutture"
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
          {
            foreignKeyName: "log_stato_candidature_candidatura_id_fkey"
            columns: ["candidatura_id"]
            isOneToOne: false
            referencedRelation: "v_studenti_stadio"
            referencedColumns: ["candidatura_id"]
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
          cf_non_disponibile: boolean
          codice_fiscale: string | null
          cognome: string
          corso_di_studi: string | null
          created_at: string | null
          data_nascita: string | null
          email: string
          id: string
          indirizzo_cap: string | null
          indirizzo_civico: string | null
          indirizzo_comune: string | null
          indirizzo_nazione: string | null
          indirizzo_provincia: string | null
          indirizzo_via: string | null
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
          cf_non_disponibile?: boolean
          codice_fiscale?: string | null
          cognome: string
          corso_di_studi?: string | null
          created_at?: string | null
          data_nascita?: string | null
          email: string
          id?: string
          indirizzo_cap?: string | null
          indirizzo_civico?: string | null
          indirizzo_comune?: string | null
          indirizzo_nazione?: string | null
          indirizzo_provincia?: string | null
          indirizzo_via?: string | null
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
          cf_non_disponibile?: boolean
          codice_fiscale?: string | null
          cognome?: string
          corso_di_studi?: string | null
          created_at?: string | null
          data_nascita?: string | null
          email?: string
          id?: string
          indirizzo_cap?: string | null
          indirizzo_civico?: string | null
          indirizzo_comune?: string | null
          indirizzo_nazione?: string | null
          indirizzo_provincia?: string | null
          indirizzo_via?: string | null
          matricola?: string | null
          nazionalita?: string | null
          nome?: string
          telefono?: string | null
          universita?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      v_studenti_stadio: {
        Row: {
          assegnazione_id: string | null
          camera_id: string | null
          camera_numero: string | null
          candidatura_id: string | null
          candidatura_stato: string | null
          cognome: string | null
          data_fine: string | null
          data_inizio: string | null
          email: string | null
          nome: string | null
          posto: number | null
          priorita: number | null
          stadio: string | null
          struttura_id: string | null
          studente_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assegnazioni_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "camere"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      camere_disponibilita: {
        Args: { p_al: string; p_dal: string; p_struttura_id?: string }
        Returns: {
          camera_id: string
          numero: string
          piano: number
          posti: number
          posti_liberi: number
          posti_occupati_numeri: number[]
          stato: string
          struttura_id: string
          tipo: string
        }[]
      }
      check_candidatura_sessione: {
        Args: { p_temp_id: string }
        Returns: boolean
      }
      consume_candidatura_sessione: {
        Args: { p_temp_id: string }
        Returns: undefined
      }
      consume_candidatura_upload_slot: {
        Args: { p_temp_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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

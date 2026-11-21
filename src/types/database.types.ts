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
    PostgrestVersion: "14.18"
  }
  auth: {
    Tables: {
      audit_log_entries: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string | null
          ip_address: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          id: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Relationships: []
      }
      custom_oauth_providers: {
        Row: {
          acceptable_client_ids: string[]
          attribute_mapping: Json
          authorization_params: Json
          authorization_url: string | null
          cached_discovery: Json | null
          client_id: string
          client_secret: string
          created_at: string
          custom_claims_allowlist: string[]
          discovery_cached_at: string | null
          discovery_url: string | null
          email_optional: boolean
          enabled: boolean
          id: string
          identifier: string
          issuer: string | null
          jwks_uri: string | null
          name: string
          pkce_enabled: boolean
          provider_type: string
          scopes: string[]
          skip_nonce_check: boolean
          token_url: string | null
          updated_at: string
          userinfo_url: string | null
        }
        Insert: {
          acceptable_client_ids?: string[]
          attribute_mapping?: Json
          authorization_params?: Json
          authorization_url?: string | null
          cached_discovery?: Json | null
          client_id: string
          client_secret: string
          created_at?: string
          custom_claims_allowlist?: string[]
          discovery_cached_at?: string | null
          discovery_url?: string | null
          email_optional?: boolean
          enabled?: boolean
          id?: string
          identifier: string
          issuer?: string | null
          jwks_uri?: string | null
          name: string
          pkce_enabled?: boolean
          provider_type: string
          scopes?: string[]
          skip_nonce_check?: boolean
          token_url?: string | null
          updated_at?: string
          userinfo_url?: string | null
        }
        Update: {
          acceptable_client_ids?: string[]
          attribute_mapping?: Json
          authorization_params?: Json
          authorization_url?: string | null
          cached_discovery?: Json | null
          client_id?: string
          client_secret?: string
          created_at?: string
          custom_claims_allowlist?: string[]
          discovery_cached_at?: string | null
          discovery_url?: string | null
          email_optional?: boolean
          enabled?: boolean
          id?: string
          identifier?: string
          issuer?: string | null
          jwks_uri?: string | null
          name?: string
          pkce_enabled?: boolean
          provider_type?: string
          scopes?: string[]
          skip_nonce_check?: boolean
          token_url?: string | null
          updated_at?: string
          userinfo_url?: string | null
        }
        Relationships: []
      }
      flow_state: {
        Row: {
          auth_code: string | null
          auth_code_issued_at: string | null
          authentication_method: string
          code_challenge: string | null
          code_challenge_method:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at: string | null
          email_optional: boolean
          id: string
          invite_token: string | null
          linking_target_id: string | null
          oauth_client_state_id: string | null
          provider_access_token: string | null
          provider_refresh_token: string | null
          provider_type: string
          referrer: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_code?: string | null
          auth_code_issued_at?: string | null
          authentication_method: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string | null
          email_optional?: boolean
          id: string
          invite_token?: string | null
          linking_target_id?: string | null
          oauth_client_state_id?: string | null
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type: string
          referrer?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_code?: string | null
          auth_code_issued_at?: string | null
          authentication_method?: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string | null
          email_optional?: boolean
          id?: string
          invite_token?: string | null
          linking_target_id?: string | null
          oauth_client_state_id?: string | null
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type?: string
          referrer?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      identities: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          identity_data: Json
          last_sign_in_at: string | null
          provider: string
          provider_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data: Json
          last_sign_in_at?: string | null
          provider: string
          provider_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data?: Json
          last_sign_in_at?: string | null
          provider?: string
          provider_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          created_at: string | null
          id: string
          raw_base_config: string | null
          updated_at: string | null
          uuid: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Relationships: []
      }
      mfa_amr_claims: {
        Row: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Update: {
          authentication_method?: string
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_amr_claims_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_challenges: {
        Row: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code: string | null
          verified_at: string | null
          web_authn_session_data: Json | null
        }
        Insert: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Update: {
          created_at?: string
          factor_id?: string
          id?: string
          ip_address?: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_challenges_auth_factor_id_fkey"
            columns: ["factor_id"]
            isOneToOne: false
            referencedRelation: "mfa_factors"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_factors: {
        Row: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name: string | null
          id: string
          last_challenged_at: string | null
          last_webauthn_challenge_data: Json | null
          phone: string | null
          secret: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid: string | null
          web_authn_credential: Json | null
        }
        Insert: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Update: {
          created_at?: string
          factor_type?: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id?: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status?: Database["auth"]["Enums"]["factor_status"]
          updated_at?: string
          user_id?: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_factors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_code_sets: {
        Row: {
          created_at: string
          failed_verification_count: number
          id: string
          mfa_factor_id: string
          updated_at: string
          user_id: string
          verification_locked_until: string | null
        }
        Insert: {
          created_at?: string
          failed_verification_count?: number
          id: string
          mfa_factor_id: string
          updated_at?: string
          user_id: string
          verification_locked_until?: string | null
        }
        Update: {
          created_at?: string
          failed_verification_count?: number
          id?: string
          mfa_factor_id?: string
          updated_at?: string
          user_id?: string
          verification_locked_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_recovery_code_sets_mfa_factor_id_fkey"
            columns: ["mfa_factor_id"]
            isOneToOne: true
            referencedRelation: "mfa_factors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfa_recovery_code_sets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          consumed_at: string | null
          created_at: string
          id: string
          mfa_recovery_code_set_id: string
        }
        Insert: {
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          id: string
          mfa_recovery_code_set_id: string
        }
        Update: {
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          mfa_recovery_code_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_recovery_codes_mfa_recovery_code_set_id_fkey"
            columns: ["mfa_recovery_code_set_id"]
            isOneToOne: false
            referencedRelation: "mfa_recovery_code_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorizations: {
        Row: {
          approved_at: string | null
          authorization_code: string | null
          authorization_id: string
          client_id: string
          code_challenge: string | null
          code_challenge_method:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at: string
          expires_at: string
          id: string
          nonce: string | null
          redirect_uri: string
          resource: string | null
          response_type: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state: string | null
          status: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id: string
          client_id: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id: string
          nonce?: string | null
          redirect_uri: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id?: string
          client_id?: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string | null
          redirect_uri?: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope?: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorizations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_client_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          id: string
          provider_type: string
        }
        Insert: {
          code_verifier?: string | null
          created_at: string
          id: string
          provider_type: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          id?: string
          provider_type?: string
        }
        Relationships: []
      }
      oauth_clients: {
        Row: {
          client_name: string | null
          client_secret_hash: string | null
          client_type: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri: string | null
          created_at: string
          deleted_at: string | null
          grant_types: string
          id: string
          logo_uri: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types: string
          id: string
          logo_uri?: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types?: string
          id?: string
          logo_uri?: string | null
          redirect_uris?: string
          registration_type?: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method?: string
          updated_at?: string
        }
        Relationships: []
      }
      oauth_consents: {
        Row: {
          client_id: string
          granted_at: string
          id: string
          revoked_at: string | null
          scopes: string
          user_id: string
        }
        Insert: {
          client_id: string
          granted_at?: string
          id: string
          revoked_at?: string | null
          scopes: string
          user_id: string
        }
        Update: {
          client_id?: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          scopes?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      one_time_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          link_token_hash: string | null
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id: string
          link_token_hash?: string | null
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          link_token_hash?: string | null
          relates_to?: string
          token_hash?: string
          token_type?: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refresh_tokens: {
        Row: {
          created_at: string | null
          id: number
          instance_id: string | null
          parent: string | null
          revoked: boolean | null
          session_id: string | null
          token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_providers: {
        Row: {
          attribute_mapping: Json | null
          created_at: string | null
          dedicated_scope: boolean | null
          entity_id: string
          id: string
          metadata_url: string | null
          metadata_xml: string
          name_id_format: string | null
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          attribute_mapping?: Json | null
          created_at?: string | null
          dedicated_scope?: boolean | null
          entity_id: string
          id: string
          metadata_url?: string | null
          metadata_xml: string
          name_id_format?: string | null
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          attribute_mapping?: Json | null
          created_at?: string | null
          dedicated_scope?: boolean | null
          entity_id?: string
          id?: string
          metadata_url?: string | null
          metadata_xml?: string
          name_id_format?: string | null
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_providers_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_relay_states: {
        Row: {
          created_at: string | null
          flow_state_id: string | null
          for_email: string | null
          id: string
          redirect_to: string | null
          request_id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id: string
          redirect_to?: string | null
          request_id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id?: string
          redirect_to?: string | null
          request_id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_relay_states_flow_state_id_fkey"
            columns: ["flow_state_id"]
            isOneToOne: false
            referencedRelation: "flow_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saml_relay_states_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          version: string
        }
        Insert: {
          version: string
        }
        Update: {
          version?: string
        }
        Relationships: []
      }
      scim_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          prefix: string
          revoked_at: string | null
          sso_provider_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id: string
          last_used_at?: string | null
          prefix: string
          revoked_at?: string | null
          sso_provider_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          prefix?: string
          revoked_at?: string | null
          sso_provider_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_tokens_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_users: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          external_id: string | null
          id: string
          resource: Json
          sso_provider_id: string
          updated_at: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          external_id?: string | null
          id: string
          resource: Json
          sso_provider_id: string
          updated_at?: string
          user_id?: string | null
          user_name?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          external_id?: string | null
          id?: string
          resource?: Json
          sso_provider_id?: string
          updated_at?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_users_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scim_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          aal: Database["auth"]["Enums"]["aal_level"] | null
          created_at: string | null
          factor_id: string | null
          id: string
          ip: unknown
          not_after: string | null
          oauth_client_id: string | null
          refresh_token_counter: number | null
          refresh_token_hmac_key: string | null
          refreshed_at: string | null
          scopes: string | null
          tag: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id: string
          ip?: unknown
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          scopes?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id?: string
          ip?: unknown
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          scopes?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_domains_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_providers: {
        Row: {
          created_at: string | null
          disabled: boolean | null
          id: string
          resource_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disabled?: boolean | null
          id: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disabled?: boolean | null
          id?: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          aud: string | null
          banned_until: string | null
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_change: string | null
          email_change_confirm_status: number | null
          email_change_sent_at: string | null
          email_change_token_current: string | null
          email_change_token_new: string | null
          email_confirmed_at: string | null
          encrypted_password: string | null
          id: string
          instance_id: string | null
          invited_at: string | null
          is_anonymous: boolean
          is_sso_user: boolean
          is_super_admin: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_change: string | null
          phone_change_sent_at: string | null
          phone_change_token: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          reauthentication_sent_at: string | null
          reauthentication_token: string | null
          recovery_sent_at: string | null
          recovery_token: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webauthn_challenges: {
        Row: {
          challenge_type: string
          created_at: string
          expires_at: string
          id: string
          session_data: Json
          user_id: string | null
        }
        Insert: {
          challenge_type: string
          created_at?: string
          expires_at: string
          id?: string
          session_data: Json
          user_id?: string | null
        }
        Update: {
          challenge_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          session_data?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_credentials: {
        Row: {
          aaguid: string | null
          attestation_type: string
          backed_up: boolean
          backup_eligible: boolean
          created_at: string
          credential_id: string
          friendly_name: string
          id: string
          last_used_at: string | null
          public_key: string
          sign_count: number
          transports: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          aaguid?: string | null
          attestation_type?: string
          backed_up?: boolean
          backup_eligible?: boolean
          created_at?: string
          credential_id: string
          friendly_name?: string
          id?: string
          last_used_at?: string | null
          public_key: string
          sign_count?: number
          transports?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          aaguid?: string | null
          attestation_type?: string
          backed_up?: boolean
          backup_eligible?: boolean
          created_at?: string
          credential_id?: string
          friendly_name?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          sign_count?: number
          transports?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      email: { Args: never; Returns: string }
      jwt: { Args: never; Returns: Json }
      role: { Args: never; Returns: string }
      uid: { Args: never; Returns: string }
    }
    Enums: {
      aal_level: "aal1" | "aal2" | "aal3"
      code_challenge_method: "s256" | "plain"
      factor_status: "unverified" | "verified"
      factor_type: "totp" | "webauthn" | "phone" | "recovery_code"
      oauth_authorization_status: "pending" | "approved" | "denied" | "expired"
      oauth_client_type: "public" | "confidential"
      oauth_registration_type: "dynamic" | "manual"
      oauth_response_type: "code"
      one_time_token_type:
        | "confirmation_token"
        | "reauthentication_token"
        | "recovery_token"
        | "email_change_token_new"
        | "email_change_token_current"
        | "phone_change_token"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type: string
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoice_attempts: {
        Row: {
          amount_cents: number
          attempt_number: number
          created_at: string
          external_attempt_id: string | null
          failure_code: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          metadata: Json
          provider: string
          status: string
          subscription_id: string
          tenant_id: string
        }
        Insert: {
          amount_cents: number
          attempt_number: number
          created_at?: string
          external_attempt_id?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          invoice_id: string
          metadata?: Json
          provider: string
          status: string
          subscription_id: string
          tenant_id: string
        }
        Update: {
          amount_cents?: number
          attempt_number?: number
          created_at?: string
          external_attempt_id?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string
          metadata?: Json
          provider?: string
          status?: string
          subscription_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoice_attempts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoice_attempts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoice_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount_cents: number
          attempt_count: number
          billing_cycle_key: string
          created_at: string
          currency: string
          due_date: string
          environment: string
          external_payment_id: string | null
          failed_at: string | null
          failure_code: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          invoice_number: string
          last_reconciled_at: string | null
          metadata: Json
          next_retry_at: string | null
          paid_at: string | null
          payment_method_label: string | null
          payment_method_type: string | null
          provider: string
          refunded_amount_cents: number
          refunded_at: string | null
          status: string
          subscription_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          attempt_count?: number
          billing_cycle_key: string
          created_at?: string
          currency?: string
          due_date: string
          environment?: string
          external_payment_id?: string | null
          failed_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          invoice_number: string
          last_reconciled_at?: string | null
          metadata?: Json
          next_retry_at?: string | null
          paid_at?: string | null
          payment_method_label?: string | null
          payment_method_type?: string | null
          provider?: string
          refunded_amount_cents?: number
          refunded_at?: string | null
          status?: string
          subscription_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          attempt_count?: number
          billing_cycle_key?: string
          created_at?: string
          currency?: string
          due_date?: string
          environment?: string
          external_payment_id?: string | null
          failed_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          invoice_number?: string
          last_reconciled_at?: string | null
          metadata?: Json
          next_retry_at?: string | null
          paid_at?: string | null
          payment_method_label?: string | null
          payment_method_type?: string | null
          provider?: string
          refunded_amount_cents?: number
          refunded_at?: string | null
          status?: string
          subscription_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_notifications_queue: {
        Row: {
          channel: string
          created_at: string
          id: string
          invoice_id: string | null
          notification_type: string
          payload: Json
          recipient_masked: string | null
          status: string
          subscription_id: string | null
          tenant_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          notification_type: string
          payload?: Json
          recipient_masked?: string | null
          status?: string
          subscription_id?: string | null
          tenant_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          notification_type?: string
          payload?: Json
          recipient_masked?: string | null
          status?: string
          subscription_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_notifications_queue_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_notifications_queue_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_notifications_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plan_history: {
        Row: {
          action: string
          changed_by: string | null
          changed_fields: Json
          created_at: string
          id: string
          new_amount_cents: number
          plan_id: string
          previous_amount_cents: number | null
          reason: string | null
          version: number
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_fields?: Json
          created_at?: string
          id?: string
          new_amount_cents: number
          plan_id: string
          previous_amount_cents?: number | null
          reason?: string | null
          version: number
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_fields?: Json
          created_at?: string
          id?: string
          new_amount_cents?: number
          plan_id?: string
          previous_amount_cents?: number | null
          reason?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_plan_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_plan_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          amount_cents: number
          archived_at: string | null
          billing_cycle: string
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          included_services: Json
          is_active: boolean
          is_demo: boolean
          name: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          amount_cents: number
          archived_at?: string | null
          billing_cycle?: string
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          included_services?: Json
          is_active?: boolean
          is_demo?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          amount_cents?: number
          archived_at?: string | null
          billing_cycle?: string
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          included_services?: Json
          is_active?: boolean
          is_demo?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscription_history: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          new_amount_cents: number | null
          new_status: string | null
          previous_amount_cents: number | null
          previous_status: string | null
          reason: string | null
          subscription_id: string
          tenant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          new_amount_cents?: number | null
          new_status?: string | null
          previous_amount_cents?: number | null
          previous_status?: string | null
          reason?: string | null
          subscription_id: string
          tenant_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          new_amount_cents?: number | null
          new_status?: string | null
          previous_amount_cents?: number | null
          previous_status?: string | null
          reason?: string | null
          subscription_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscription_history_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscription_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscription_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          activated_at: string | null
          activation_confirmed_at: string | null
          activation_confirmed_by: string | null
          admin_notes: string | null
          authorization_expires_at: string | null
          authorization_token_hash: string | null
          authorization_url: string | null
          authorized_at: string | null
          billing_cycle: string
          cancel_at_period_end: boolean
          cancellation_reason: string | null
          cancellation_requested_at: string | null
          cancelled_at: string | null
          consecutive_failed_charges: number
          contract_accepted_at: string | null
          contract_accepted_by_name: string | null
          contracted_amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          delinquent_since: string | null
          environment: string
          external_plan_id: string | null
          external_reference: string
          external_subscription_id: string | null
          grace_period_days: number
          id: string
          metadata: Json
          next_billing_date: string | null
          payment_method_brand: string | null
          payment_method_label: string | null
          payment_method_last4: string | null
          payment_method_type: string
          plan_id: string
          plan_name_snapshot: string
          plan_version_snapshot: number
          provider: string
          scheduled_start_date: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activation_confirmed_at?: string | null
          activation_confirmed_by?: string | null
          admin_notes?: string | null
          authorization_expires_at?: string | null
          authorization_token_hash?: string | null
          authorization_url?: string | null
          authorized_at?: string | null
          billing_cycle?: string
          cancel_at_period_end?: boolean
          cancellation_reason?: string | null
          cancellation_requested_at?: string | null
          cancelled_at?: string | null
          consecutive_failed_charges?: number
          contract_accepted_at?: string | null
          contract_accepted_by_name?: string | null
          contracted_amount_cents: number
          created_at?: string
          created_by?: string | null
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          delinquent_since?: string | null
          environment?: string
          external_plan_id?: string | null
          external_reference: string
          external_subscription_id?: string | null
          grace_period_days?: number
          id?: string
          metadata?: Json
          next_billing_date?: string | null
          payment_method_brand?: string | null
          payment_method_label?: string | null
          payment_method_last4?: string | null
          payment_method_type?: string
          plan_id: string
          plan_name_snapshot: string
          plan_version_snapshot: number
          provider?: string
          scheduled_start_date: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activation_confirmed_at?: string | null
          activation_confirmed_by?: string | null
          admin_notes?: string | null
          authorization_expires_at?: string | null
          authorization_token_hash?: string | null
          authorization_url?: string | null
          authorized_at?: string | null
          billing_cycle?: string
          cancel_at_period_end?: boolean
          cancellation_reason?: string | null
          cancellation_requested_at?: string | null
          cancelled_at?: string | null
          consecutive_failed_charges?: number
          contract_accepted_at?: string | null
          contract_accepted_by_name?: string | null
          contracted_amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          delinquent_since?: string | null
          environment?: string
          external_plan_id?: string | null
          external_reference?: string
          external_subscription_id?: string | null
          grace_period_days?: number
          id?: string
          metadata?: Json
          next_billing_date?: string | null
          payment_method_brand?: string | null
          payment_method_label?: string | null
          payment_method_last4?: string | null
          payment_method_type?: string
          plan_id?: string
          plan_name_snapshot?: string
          plan_version_snapshot?: number
          provider?: string
          scheduled_start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_activation_confirmed_by_fkey"
            columns: ["activation_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          environment: string
          error_message: string | null
          event_type: string
          external_event_id: string
          external_resource_id: string | null
          id: string
          invoice_id: string | null
          payload_summary: Json
          processed_at: string | null
          processing_status: string
          provider: string
          received_at: string
          resource_type: string
          signature_verified: boolean
          subscription_id: string | null
          tenant_id: string | null
        }
        Insert: {
          environment?: string
          error_message?: string | null
          event_type: string
          external_event_id: string
          external_resource_id?: string | null
          id?: string
          invoice_id?: string | null
          payload_summary?: Json
          processed_at?: string | null
          processing_status: string
          provider: string
          received_at?: string
          resource_type: string
          signature_verified?: boolean
          subscription_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          environment?: string
          error_message?: string | null
          event_type?: string
          external_event_id?: string
          external_resource_id?: string | null
          id?: string
          invoice_id?: string | null
          payload_summary?: Json
          processed_at?: string | null
          processing_status?: string
          provider?: string
          received_at?: string
          resource_type?: string
          signature_verified?: boolean
          subscription_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_webhook_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_webhook_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_contract_history: {
        Row: {
          action: string
          actor_user_id: string | null
          contract_id: string
          created_at: string
          id: string
          installment_id: string | null
          metadata: Json
          note: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          contract_id: string
          created_at?: string
          id?: string
          installment_id?: string | null
          metadata?: Json
          note?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          contract_id?: string
          created_at?: string
          id?: string
          installment_id?: string | null
          metadata?: Json
          note?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_contract_history_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_contract_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "implementation_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_contract_history_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "implementation_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_contract_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_contracts: {
        Row: {
          accepted_at: string | null
          accepted_by_name: string | null
          balance_percent: number
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          contract_code: string
          created_at: string
          created_by: string | null
          currency: string
          custom_terms_note: string | null
          delivery_confirmed_at: string | null
          delivery_confirmed_by: string | null
          entry_percent: number
          id: string
          project_started_at: string | null
          scope_summary: string
          status: string
          tenant_id: string
          title: string
          total_amount_cents: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          balance_percent?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          contract_code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_terms_note?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          entry_percent?: number
          id?: string
          project_started_at?: string | null
          scope_summary: string
          status?: string
          tenant_id: string
          title: string
          total_amount_cents: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          balance_percent?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          contract_code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_terms_note?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          entry_percent?: number
          id?: string
          project_started_at?: string | null
          scope_summary?: string
          status?: string
          tenant_id?: string
          title?: string
          total_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_contracts_delivery_confirmed_by_fkey"
            columns: ["delivery_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_installments: {
        Row: {
          amount_cents: number
          confirmation_note: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          contract_id: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          idempotency_confirm_key: string | null
          installment_kind: string
          label: string
          milestone_description: string
          receipt_attached_at: string | null
          receipt_attached_by: string | null
          receipt_file_name: string | null
          receipt_mime_type: string | null
          receipt_sha256: string | null
          receipt_size_bytes: number | null
          receipt_storage_path: string | null
          reported_payment_method: string | null
          sequence_number: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          confirmation_note?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          contract_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          idempotency_confirm_key?: string | null
          installment_kind: string
          label: string
          milestone_description: string
          receipt_attached_at?: string | null
          receipt_attached_by?: string | null
          receipt_file_name?: string | null
          receipt_mime_type?: string | null
          receipt_sha256?: string | null
          receipt_size_bytes?: number | null
          receipt_storage_path?: string | null
          reported_payment_method?: string | null
          sequence_number: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          confirmation_note?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          contract_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          idempotency_confirm_key?: string | null
          installment_kind?: string
          label?: string
          milestone_description?: string
          receipt_attached_at?: string | null
          receipt_attached_by?: string | null
          receipt_file_name?: string | null
          receipt_mime_type?: string | null
          receipt_sha256?: string | null
          receipt_size_bytes?: number | null
          receipt_storage_path?: string | null
          reported_payment_method?: string | null
          sequence_number?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_installments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "implementation_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_installments_receipt_attached_by_fkey"
            columns: ["receipt_attached_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_installments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          attempts: number
          blocked_until: string | null
          identifier: string
          scope: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          identifier: string
          scope: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          identifier?: string
          scope?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      retail_cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          tenant_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          tenant_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          tenant_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "retail_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "retail_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_cart_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "retail_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_carts: {
        Row: {
          cart_token_hash: string
          created_at: string
          expires_at: string
          id: string
          status: string
          store_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cart_token_hash: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          store_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cart_token_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          store_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "retail_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_carts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_order_items: {
        Row: {
          created_at: string
          id: string
          image_url_snapshot: string | null
          line_total_cents: number
          order_id: string
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          sku_snapshot: string
          tenant_id: string
          unit_price_cents: number
          variant_id: string | null
          variant_name_snapshot: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url_snapshot?: string | null
          line_total_cents: number
          order_id: string
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          sku_snapshot: string
          tenant_id: string
          unit_price_cents: number
          variant_id?: string | null
          variant_name_snapshot: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url_snapshot?: string | null
          line_total_cents?: number
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          sku_snapshot?: string
          tenant_id?: string
          unit_price_cents?: number
          variant_id?: string | null
          variant_name_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "retail_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "retail_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "retail_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_order_status_history: {
        Row: {
          changed_by_name_snapshot: string | null
          changed_by_user_id: string | null
          created_at: string
          from_status: string | null
          id: string
          order_id: string
          reason: string | null
          tenant_id: string
          to_status: string
        }
        Insert: {
          changed_by_name_snapshot?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          order_id: string
          reason?: string | null
          tenant_id: string
          to_status: string
        }
        Update: {
          changed_by_name_snapshot?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          order_id?: string
          reason?: string | null
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "retail_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_order_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          channel: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_mode: string
          discount_cents: number
          id: string
          idempotency_key: string | null
          notes: string | null
          order_number: string
          paid_amount_cents: number
          paid_at: string | null
          payment_share_expires_at: string | null
          payment_share_token_hash: string | null
          payment_status: string
          public_token_hash: string
          refunded_amount_cents: number
          shipping_fee_cents: number | null
          status: string
          stock_deducted: boolean
          store_id: string
          subtotal_cents: number
          tenant_id: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          channel?: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_address?: string | null
          delivery_mode?: string
          discount_cents?: number
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_number: string
          paid_amount_cents?: number
          paid_at?: string | null
          payment_share_expires_at?: string | null
          payment_share_token_hash?: string | null
          payment_status?: string
          public_token_hash: string
          refunded_amount_cents?: number
          shipping_fee_cents?: number | null
          status?: string
          stock_deducted?: boolean
          store_id: string
          subtotal_cents: number
          tenant_id: string
          total_cents: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          channel?: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: string | null
          delivery_mode?: string
          discount_cents?: number
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_number?: string
          paid_amount_cents?: number
          paid_at?: string | null
          payment_share_expires_at?: string | null
          payment_share_token_hash?: string | null
          payment_status?: string
          public_token_hash?: string
          refunded_amount_cents?: number
          shipping_fee_cents?: number | null
          status?: string
          stock_deducted?: boolean
          store_id?: string
          subtotal_cents?: number
          tenant_id?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_orders_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "retail_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "retail_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_payment_attempts: {
        Row: {
          amount_cents: number
          attempt_number: number
          checkout_url: string | null
          completed_at: string | null
          created_at: string
          currency: string
          expires_at: string | null
          external_attempt_id: string | null
          external_payment_id: string | null
          failure_code: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          metadata: Json
          order_id: string
          payment_id: string
          payment_method: string | null
          provider: string
          status: string
          store_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          attempt_number: number
          checkout_url?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          external_attempt_id?: string | null
          external_payment_id?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          order_id: string
          payment_id: string
          payment_method?: string | null
          provider: string
          status?: string
          store_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          attempt_number?: number
          checkout_url?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          external_attempt_id?: string | null
          external_payment_id?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          order_id?: string
          payment_id?: string
          payment_method?: string | null
          provider?: string
          status?: string
          store_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "retail_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payment_attempts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "retail_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payment_attempts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "retail_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payment_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_payment_connections: {
        Row: {
          access_token_encrypted: string | null
          connected_at: string | null
          connected_by_user_id: string | null
          created_at: string
          disconnected_at: string | null
          environment: string
          id: string
          last_verified_at: string | null
          metadata: Json
          provider: string
          public_key: string | null
          refresh_token_encrypted: string | null
          scopes: string[]
          seller_account_id: string | null
          seller_account_label: string | null
          status: string
          store_id: string
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
          webhook_secret_encrypted: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          connected_by_user_id?: string | null
          created_at?: string
          disconnected_at?: string | null
          environment?: string
          id?: string
          last_verified_at?: string | null
          metadata?: Json
          provider: string
          public_key?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[]
          seller_account_id?: string | null
          seller_account_label?: string | null
          status?: string
          store_id: string
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          connected_by_user_id?: string | null
          created_at?: string
          disconnected_at?: string | null
          environment?: string
          id?: string
          last_verified_at?: string | null
          metadata?: Json
          provider?: string
          public_key?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[]
          seller_account_id?: string | null
          seller_account_label?: string | null
          status?: string
          store_id?: string
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retail_payment_connections_connected_by_user_id_fkey"
            columns: ["connected_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payment_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "retail_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payment_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_payment_events: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          error_message: string | null
          event_type: string
          external_event_id: string
          id: string
          new_status: string | null
          order_id: string | null
          payload_summary: Json
          payment_id: string | null
          previous_status: string | null
          processed_at: string
          processing_status: string
          provider: string
          signature_verified: boolean
          store_id: string
          tenant_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          event_type: string
          external_event_id: string
          id?: string
          new_status?: string | null
          order_id?: string | null
          payload_summary?: Json
          payment_id?: string | null
          previous_status?: string | null
          processed_at?: string
          processing_status?: string
          provider: string
          signature_verified?: boolean
          store_id: string
          tenant_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          event_type?: string
          external_event_id?: string
          id?: string
          new_status?: string | null
          order_id?: string | null
          payload_summary?: Json
          payment_id?: string | null
          previous_status?: string | null
          processed_at?: string
          processing_status?: string
          provider?: string
          signature_verified?: boolean
          store_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "retail_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "retail_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payment_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "retail_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payment_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_payments: {
        Row: {
          amount_cents: number
          approved_at: string | null
          cancelled_at: string | null
          checkout_url: string | null
          connection_id: string | null
          created_at: string
          currency: string
          divergence_alert: string | null
          environment: string
          expired_at: string | null
          external_payment_id: string | null
          external_preference_id: string | null
          external_reference: string
          failed_at: string | null
          id: string
          idempotency_key: string
          last_reconciled_at: string | null
          metadata: Json
          order_id: string
          payer_email_masked: string | null
          payment_method: string | null
          payment_method_label: string | null
          provider: string
          refunded_amount_cents: number
          refunded_at: string | null
          seller_account_id: string
          status: string
          store_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          approved_at?: string | null
          cancelled_at?: string | null
          checkout_url?: string | null
          connection_id?: string | null
          created_at?: string
          currency?: string
          divergence_alert?: string | null
          environment?: string
          expired_at?: string | null
          external_payment_id?: string | null
          external_preference_id?: string | null
          external_reference: string
          failed_at?: string | null
          id?: string
          idempotency_key: string
          last_reconciled_at?: string | null
          metadata?: Json
          order_id: string
          payer_email_masked?: string | null
          payment_method?: string | null
          payment_method_label?: string | null
          provider: string
          refunded_amount_cents?: number
          refunded_at?: string | null
          seller_account_id: string
          status?: string
          store_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          approved_at?: string | null
          cancelled_at?: string | null
          checkout_url?: string | null
          connection_id?: string | null
          created_at?: string
          currency?: string
          divergence_alert?: string | null
          environment?: string
          expired_at?: string | null
          external_payment_id?: string | null
          external_preference_id?: string | null
          external_reference?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          last_reconciled_at?: string | null
          metadata?: Json
          order_id?: string
          payer_email_masked?: string | null
          payment_method?: string | null
          payment_method_label?: string | null
          provider?: string
          refunded_amount_cents?: number
          refunded_at?: string | null
          seller_account_id?: string
          status?: string
          store_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_payments_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "retail_payment_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "retail_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "retail_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_product_categories: {
        Row: {
          category_id: string
          created_at: string
          product_id: string
          tenant_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          product_id: string
          tenant_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "retail_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "retail_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string
          tenant_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
          tenant_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
          tenant_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retail_product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "retail_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_product_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "retail_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_product_options: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          product_id: string
          tenant_id: string
          updated_at: string
          values: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          product_id: string
          tenant_id: string
          updated_at?: string
          values?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          product_id?: string
          tenant_id?: string
          updated_at?: string
          values?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "retail_product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "retail_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_product_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          published_at: string | null
          slug: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          published_at?: string | null
          slug: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          published_at?: string | null
          slug?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_stores: {
        Row: {
          about_text: string | null
          accent_color: string | null
          announcement_bar: string | null
          brand_headline: string | null
          brand_subheadline: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          hero_badge: string | null
          hero_image_path: string | null
          id: string
          inventory_mode: string
          is_active: boolean
          secondary_color: string | null
          slug: string | null
          social_links: Json
          store_name: string
          template: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          about_text?: string | null
          accent_color?: string | null
          announcement_bar?: string | null
          brand_headline?: string | null
          brand_subheadline?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          hero_badge?: string | null
          hero_image_path?: string | null
          id?: string
          inventory_mode?: string
          is_active?: boolean
          secondary_color?: string | null
          slug?: string | null
          social_links?: Json
          store_name: string
          template?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          about_text?: string | null
          accent_color?: string | null
          announcement_bar?: string | null
          brand_headline?: string | null
          brand_subheadline?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          hero_badge?: string | null
          hero_image_path?: string | null
          id?: string
          inventory_mode?: string
          is_active?: boolean
          secondary_color?: string | null
          slug?: string | null
          social_links?: Json
          store_name?: string
          template?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_stores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_variants: {
        Row: {
          compare_at_price_cents: number | null
          created_at: string
          id: string
          is_available: boolean
          name: string
          options_summary: Json
          price_cents: number
          product_id: string
          sku: string
          sort_order: number
          stock_quantity: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          compare_at_price_cents?: number | null
          created_at?: string
          id?: string
          is_available?: boolean
          name: string
          options_summary?: Json
          price_cents: number
          product_id: string
          sku: string
          sort_order?: number
          stock_quantity?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          compare_at_price_cents?: number | null
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          options_summary?: Json
          price_cents?: number
          product_id?: string
          sku?: string
          sort_order?: number
          stock_quantity?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "retail_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["membership_role"]
          status: string
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["membership_role"]
          status?: string
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["membership_role"]
          status?: string
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["membership_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          brand_description: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          display_name: string
          locale: string
          monogram: string | null
          primary_color: string
          segment_label: string
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          brand_description?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name: string
          locale?: string
          monogram?: string | null
          primary_color?: string
          segment_label?: string
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          brand_description?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string
          locale?: string
          monogram?: string | null
          primary_color?: string
          segment_label?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_tenant_invitation: {
        Args: { p_token_hash: string; p_user_id: string }
        Returns: Json
      }
      cancel_retail_order: {
        Args: {
          p_actor_name?: string
          p_actor_user_id?: string
          p_order_id: string
          p_reason?: string
          p_tenant_id: string
        }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          channel: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_mode: string
          discount_cents: number
          id: string
          idempotency_key: string | null
          notes: string | null
          order_number: string
          paid_amount_cents: number
          paid_at: string | null
          payment_share_expires_at: string | null
          payment_share_token_hash: string | null
          payment_status: string
          public_token_hash: string
          refunded_amount_cents: number
          shipping_fee_cents: number | null
          status: string
          stock_deducted: boolean
          store_id: string
          subtotal_cents: number
          tenant_id: string
          total_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "retail_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_implementation_installment_tx: {
        Args: {
          p_actor_user_id: string
          p_confirmation_note?: string
          p_idempotency_key?: string
          p_installment_id: string
          p_reported_payment_method: string
        }
        Returns: Json
      }
      confirm_retail_order: {
        Args: {
          p_actor_name?: string
          p_actor_user_id?: string | null
          p_order_id: string
          p_reason?: string
          p_tenant_id: string
        }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          channel: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_mode: string
          discount_cents: number
          id: string
          idempotency_key: string | null
          notes: string | null
          order_number: string
          paid_amount_cents: number
          paid_at: string | null
          payment_share_expires_at: string | null
          payment_share_token_hash: string | null
          payment_status: string
          public_token_hash: string
          refunded_amount_cents: number
          shipping_fee_cents: number | null
          status: string
          stock_deducted: boolean
          store_id: string
          subtotal_cents: number
          tenant_id: string
          total_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "retail_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_rate_limit: {
        Args: {
          p_block_seconds?: number
          p_identifier: string
          p_max_attempts: number
          p_scope: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      create_public_retail_order: {
        Args: {
          p_cart_token_hash: string
          p_customer_email?: string
          p_customer_name: string
          p_customer_phone: string
          p_delivery_address?: string
          p_delivery_mode?: string
          p_idempotency_key?: string
          p_notes?: string
          p_order_number: string
          p_public_token_hash: string
          p_store_slug: string
        }
        Returns: Json
      }
      create_retail_payment_session_tx: {
        Args: {
          p_checkout_url: string
          p_expires_at?: string
          p_external_preference_id: string
          p_external_reference: string
          p_idempotency_key: string
          p_metadata?: Json
          p_order_id: string
          p_payer_email_masked?: string
          p_provider: string
          p_seller_account_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      create_tenant_with_owner: {
        Args: {
          p_actor_user_id: string
          p_display_name?: string
          p_locale?: string
          p_name: string
          p_owner_user_id: string
          p_slug: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_public_storefront: {
        Args: { p_slug: string }
        Returns: {
          about_text: string
          accent_color: string
          announcement_bar: string
          brand_headline: string
          brand_subheadline: string
          contact_email: string
          contact_phone: string
          currency: string
          hero_badge: string
          hero_image_path: string
          is_active: boolean
          secondary_color: string
          slug: string
          social_links: Json
          store_id: string
          store_name: string
          template: string
          tenant_id: string
        }[]
      }
      get_retail_payment_connection_summary: {
        Args: { p_tenant_id: string }
        Returns: {
          connected_at: string
          disconnected_at: string
          environment: string
          id: string
          last_verified_at: string
          provider: string
          public_key: string
          seller_account_id: string
          seller_account_label: string
          status: string
          store_id: string
          tenant_id: string
          token_expires_at: string
        }[]
      }
      has_tenant_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["membership_role"][]
          check_tenant_id: string
          check_user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: { check_user_id: string }; Returns: boolean }
      is_retail_active: { Args: { p_tenant_id: string }; Returns: boolean }
      is_tenant_active: { Args: { check_tenant_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { check_tenant_id: string; check_user_id: string }
        Returns: boolean
      }
      reconcile_billing_invoice_tx: {
        Args: {
          p_amount_cents: number
          p_authoritative_status: string
          p_billing_cycle_key: string
          p_currency: string
          p_due_date: string
          p_event_type: string
          p_external_event_id: string
          p_external_payment_id: string
          p_failure_code?: string
          p_failure_reason?: string
          p_payload_summary?: Json
          p_payment_method_label?: string
          p_payment_method_type?: string
          p_provider: string
          p_signature_verified: boolean
          p_subscription_id: string
        }
        Returns: Json
      }
      reconcile_retail_payment_tx: {
        Args: {
          p_authoritative_amount_cents: number
          p_authoritative_currency: string
          p_authoritative_status: string
          p_event_type: string
          p_external_event_id: string
          p_external_payment_id: string
          p_external_reference: string
          p_failure_code?: string
          p_failure_reason?: string
          p_payload_summary?: Json
          p_payment_id: string
          p_payment_method?: string
          p_payment_method_label?: string
          p_provider: string
          p_seller_account_id: string
          p_signature_verified: boolean
          p_tenant_id: string
        }
        Returns: Json
      }
      record_retail_payment_refund_tx: {
        Args: {
          p_actor_user_id?: string
          p_external_refund_id: string
          p_payload_summary?: Json
          p_payment_id: string
          p_provider: string
          p_reason?: string
          p_refund_amount_cents: number
          p_tenant_id: string
        }
        Returns: Json
      }
      reset_rate_limit: {
        Args: { p_identifier: string; p_scope: string }
        Returns: undefined
      }
      set_retail_order_shipping_fee: {
        Args: {
          p_actor_name?: string
          p_actor_user_id?: string
          p_order_id: string
          p_shipping_fee_cents: number
          p_tenant_id: string
        }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          channel: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_mode: string
          discount_cents: number
          id: string
          idempotency_key: string | null
          notes: string | null
          order_number: string
          paid_amount_cents: number
          paid_at: string | null
          payment_share_expires_at: string | null
          payment_share_token_hash: string | null
          payment_status: string
          public_token_hash: string
          refunded_amount_cents: number
          shipping_fee_cents: number | null
          status: string
          stock_deducted: boolean
          store_id: string
          subtotal_cents: number
          tenant_id: string
          total_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "retail_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_retail_order_status: {
        Args: {
          p_actor_name?: string
          p_actor_user_id?: string
          p_next_status: string
          p_order_id: string
          p_reason?: string
          p_tenant_id: string
        }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          channel: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_mode: string
          discount_cents: number
          id: string
          idempotency_key: string | null
          notes: string | null
          order_number: string
          paid_amount_cents: number
          paid_at: string | null
          payment_share_expires_at: string | null
          payment_share_token_hash: string | null
          payment_status: string
          public_token_hash: string
          refunded_amount_cents: number
          shipping_fee_cents: number | null
          status: string
          stock_deducted: boolean
          store_id: string
          subtotal_cents: number
          tenant_id: string
          total_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "retail_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      membership_role: "owner" | "manager" | "staff"
      tenant_status: "active" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      bucket_lifecycle_states: {
        Row: {
          bucket_id: string
          claim_id: string | null
          claim_until: string | null
          continuation: Json | null
          failure_count: number
          generation: string | null
          last_completed_at: string | null
          last_error: Json | null
          last_result: Json | null
          last_started_at: string | null
          last_success_at: string | null
          next_run_at: string | null
          updated_at: string
        }
        Insert: {
          bucket_id: string
          claim_id?: string | null
          claim_until?: string | null
          continuation?: Json | null
          failure_count?: number
          generation?: string | null
          last_completed_at?: string | null
          last_error?: Json | null
          last_result?: Json | null
          last_started_at?: string | null
          last_success_at?: string | null
          next_run_at?: string | null
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          claim_id?: string | null
          claim_until?: string | null
          continuation?: Json | null
          failure_count?: number
          generation?: string | null
          last_completed_at?: string | null
          last_error?: Json | null
          last_result?: Json | null
          last_started_at?: string | null
          last_success_at?: string | null
          next_run_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bucket_lifecycle_states_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: true
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          lifecycle_configuration: Json | null
          lifecycle_configuration_generation: string | null
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
          versioning_status: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          lifecycle_configuration?: Json | null
          lifecycle_configuration_generation?: string | null
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          lifecycle_configuration?: Json | null
          lifecycle_configuration_generation?: string | null
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      lifecycle_abandoned_artifacts: {
        Row: {
          attempted_at: string
          bucket_id: string
          key: string
          name: string
          version: string | null
        }
        Insert: {
          attempted_at?: string
          bucket_id: string
          key: string
          name: string
          version?: string | null
        }
        Update: {
          attempted_at?: string
          bucket_id?: string
          key?: string
          name?: string
          version?: string | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          archived_at: string | null
          bucket_id: string | null
          created_at: string | null
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_lifecycle_objects: {
        Args: { object_ids: string[] }
        Returns: {
          id: string
          is_delete_marker: boolean
          metadata: Json
        }[]
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: { delete_markers?: string; noncurrent_versions?: string }
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
          raw_prefix_param?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delete_markers?: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          next_token_archived_at?: string
          next_token_version?: string
          noncurrent_versions?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      operation: { Args: never; Returns: string }
      reconcile_lifecycle_state: {
        Args: { policy_changed: boolean; target_bucket_id: string }
        Returns: undefined
      }
      search: {
        Args: {
          bucketname: string
          delete_markers?: string
          levels?: number
          limits?: number
          noncurrent_versions?: string
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          delete_markers?: string
          noncurrent_versions?: string
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
          p_start_after_version?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          delete_markers?: string
          levels?: number
          limits?: number
          noncurrent_versions?: string
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
          start_after_archived_at?: string
          start_after_is_continuation?: boolean
          start_after_version?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  auth: {
    Enums: {
      aal_level: ["aal1", "aal2", "aal3"],
      code_challenge_method: ["s256", "plain"],
      factor_status: ["unverified", "verified"],
      factor_type: ["totp", "webauthn", "phone", "recovery_code"],
      oauth_authorization_status: ["pending", "approved", "denied", "expired"],
      oauth_client_type: ["public", "confidential"],
      oauth_registration_type: ["dynamic", "manual"],
      oauth_response_type: ["code"],
      one_time_token_type: [
        "confirmation_token",
        "reauthentication_token",
        "recovery_token",
        "email_change_token_new",
        "email_change_token_current",
        "phone_change_token",
      ],
    },
  },
  public: {
    Enums: {
      membership_role: ["owner", "manager", "staff"],
      tenant_status: ["active", "suspended"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

// ==============================================================================
// DevEssent Platform - Tipos de Conveniência Auxiliares
// ==============================================================================
export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type TenantMembership = Database["public"]["Tables"]["tenant_memberships"]["Row"];
export type TenantSettings = Database["public"]["Tables"]["tenant_settings"]["Row"];
export type PlatformAdmin = Database["public"]["Tables"]["platform_admins"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type TenantInvitation = Database["public"]["Tables"]["tenant_invitations"]["Row"];

export type TenantStatus = Database["public"]["Enums"]["tenant_status"];
export type MembershipRole = Database["public"]["Enums"]["membership_role"];
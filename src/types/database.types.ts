
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "auth": {
          Tables: {
            "audit_log_entries": {
                  Row: {
                    "created_at": string | null,"id": string,"instance_id": string | null,"ip_address": string,"payload": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id": string,"instance_id"?: string | null,"ip_address"?: string,"payload"?: Json | null
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"instance_id"?: string | null,"ip_address"?: string,"payload"?: Json | null
                  }
                  Relationships: [
                    
                  ]
                },"custom_oauth_providers": {
                  Row: {
                    "acceptable_client_ids": (string)[],"attribute_mapping": NonNullable<Json>,"authorization_params": NonNullable<Json>,"authorization_url": string | null,"cached_discovery": Json | null,"client_id": string,"client_secret": string,"created_at": string,"custom_claims_allowlist": (string)[],"discovery_cached_at": string | null,"discovery_url": string | null,"email_optional": boolean,"enabled": boolean,"id": string,"identifier": string,"issuer": string | null,"jwks_uri": string | null,"name": string,"pkce_enabled": boolean,"provider_type": string,"scopes": (string)[],"skip_nonce_check": boolean,"token_url": string | null,"updated_at": string,"userinfo_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acceptable_client_ids"?: (string)[],"attribute_mapping"?: NonNullable<Json>,"authorization_params"?: NonNullable<Json>,"authorization_url"?: string | null,"cached_discovery"?: Json | null,"client_id": string,"client_secret": string,"created_at"?: string,"custom_claims_allowlist"?: (string)[],"discovery_cached_at"?: string | null,"discovery_url"?: string | null,"email_optional"?: boolean,"enabled"?: boolean,"id"?: string,"identifier": string,"issuer"?: string | null,"jwks_uri"?: string | null,"name": string,"pkce_enabled"?: boolean,"provider_type": string,"scopes"?: (string)[],"skip_nonce_check"?: boolean,"token_url"?: string | null,"updated_at"?: string,"userinfo_url"?: string | null
                  }
                  Update: {
                    "acceptable_client_ids"?: (string)[],"attribute_mapping"?: NonNullable<Json>,"authorization_params"?: NonNullable<Json>,"authorization_url"?: string | null,"cached_discovery"?: Json | null,"client_id"?: string,"client_secret"?: string,"created_at"?: string,"custom_claims_allowlist"?: (string)[],"discovery_cached_at"?: string | null,"discovery_url"?: string | null,"email_optional"?: boolean,"enabled"?: boolean,"id"?: string,"identifier"?: string,"issuer"?: string | null,"jwks_uri"?: string | null,"name"?: string,"pkce_enabled"?: boolean,"provider_type"?: string,"scopes"?: (string)[],"skip_nonce_check"?: boolean,"token_url"?: string | null,"updated_at"?: string,"userinfo_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"flow_state": {
                  Row: {
                    "auth_code": string | null,"auth_code_issued_at": string | null,"authentication_method": string,"code_challenge": string | null,"code_challenge_method": Database["auth"]['Enums']["code_challenge_method"] | null,"created_at": string | null,"email_optional": boolean,"id": string,"invite_token": string | null,"linking_target_id": string | null,"oauth_client_state_id": string | null,"provider_access_token": string | null,"provider_refresh_token": string | null,"provider_type": string,"referrer": string | null,"updated_at": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_code"?: string | null,"auth_code_issued_at"?: string | null,"authentication_method": string,"code_challenge"?: string | null,"code_challenge_method"?: Database["auth"]['Enums']["code_challenge_method"] | null,"created_at"?: string | null,"email_optional"?: boolean,"id": string,"invite_token"?: string | null,"linking_target_id"?: string | null,"oauth_client_state_id"?: string | null,"provider_access_token"?: string | null,"provider_refresh_token"?: string | null,"provider_type": string,"referrer"?: string | null,"updated_at"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "auth_code"?: string | null,"auth_code_issued_at"?: string | null,"authentication_method"?: string,"code_challenge"?: string | null,"code_challenge_method"?: Database["auth"]['Enums']["code_challenge_method"] | null,"created_at"?: string | null,"email_optional"?: boolean,"id"?: string,"invite_token"?: string | null,"linking_target_id"?: string | null,"oauth_client_state_id"?: string | null,"provider_access_token"?: string | null,"provider_refresh_token"?: string | null,"provider_type"?: string,"referrer"?: string | null,"updated_at"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"identities": {
                  Row: {
                    "created_at": string | null,"email": string | null,"id": string,"identity_data": NonNullable<Json>,"last_sign_in_at": string | null,"provider": string,"provider_id": string,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"email"?: never,"id"?: string,"identity_data": NonNullable<Json>,"last_sign_in_at"?: string | null,"provider": string,"provider_id": string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"email"?: never,"id"?: string,"identity_data"?: NonNullable<Json>,"last_sign_in_at"?: string | null,"provider"?: string,"provider_id"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "identities_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"instances": {
                  Row: {
                    "created_at": string | null,"id": string,"raw_base_config": string | null,"updated_at": string | null,"uuid": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id": string,"raw_base_config"?: string | null,"updated_at"?: string | null,"uuid"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"raw_base_config"?: string | null,"updated_at"?: string | null,"uuid"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"mfa_amr_claims": {
                  Row: {
                    "authentication_method": string,"created_at": string,"id": string,"session_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "authentication_method": string,"created_at": string,"id": string,"session_id": string,"updated_at": string
                  }
                  Update: {
                    "authentication_method"?: string,"created_at"?: string,"id"?: string,"session_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mfa_amr_claims_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"mfa_challenges": {
                  Row: {
                    "created_at": string,"factor_id": string,"id": string,"ip_address": unknown,"otp_code": string | null,"verified_at": string | null,"web_authn_session_data": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": string,"factor_id": string,"id": string,"ip_address": unknown,"otp_code"?: string | null,"verified_at"?: string | null,"web_authn_session_data"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"factor_id"?: string,"id"?: string,"ip_address"?: unknown,"otp_code"?: string | null,"verified_at"?: string | null,"web_authn_session_data"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mfa_challenges_auth_factor_id_fkey"
      columns: ["factor_id"]
isOneToOne: false
      referencedRelation: "mfa_factors"
      referencedColumns: ["id"]
    }
                  ]
                },"mfa_factors": {
                  Row: {
                    "created_at": string,"factor_type": Database["auth"]['Enums']["factor_type"],"friendly_name": string | null,"id": string,"last_challenged_at": string | null,"last_webauthn_challenge_data": Json | null,"phone": string | null,"secret": string | null,"status": Database["auth"]['Enums']["factor_status"],"updated_at": string,"user_id": string,"web_authn_aaguid": string | null,"web_authn_credential": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": string,"factor_type": Database["auth"]['Enums']["factor_type"],"friendly_name"?: string | null,"id": string,"last_challenged_at"?: string | null,"last_webauthn_challenge_data"?: Json | null,"phone"?: string | null,"secret"?: string | null,"status": Database["auth"]['Enums']["factor_status"],"updated_at": string,"user_id": string,"web_authn_aaguid"?: string | null,"web_authn_credential"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"factor_type"?: Database["auth"]['Enums']["factor_type"],"friendly_name"?: string | null,"id"?: string,"last_challenged_at"?: string | null,"last_webauthn_challenge_data"?: Json | null,"phone"?: string | null,"secret"?: string | null,"status"?: Database["auth"]['Enums']["factor_status"],"updated_at"?: string,"user_id"?: string,"web_authn_aaguid"?: string | null,"web_authn_credential"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mfa_factors_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"mfa_recovery_code_sets": {
                  Row: {
                    "created_at": string,"failed_verification_count": number,"id": string,"mfa_factor_id": string,"updated_at": string,"user_id": string,"verification_locked_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"failed_verification_count"?: number,"id": string,"mfa_factor_id": string,"updated_at"?: string,"user_id": string,"verification_locked_until"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"failed_verification_count"?: number,"id"?: string,"mfa_factor_id"?: string,"updated_at"?: string,"user_id"?: string,"verification_locked_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mfa_recovery_code_sets_mfa_factor_id_fkey"
      columns: ["mfa_factor_id"]
isOneToOne: true
      referencedRelation: "mfa_factors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mfa_recovery_code_sets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"mfa_recovery_codes": {
                  Row: {
                    "code_hash": string,"consumed_at": string | null,"created_at": string,"id": string,"mfa_recovery_code_set_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code_hash": string,"consumed_at"?: string | null,"created_at"?: string,"id": string,"mfa_recovery_code_set_id": string
                  }
                  Update: {
                    "code_hash"?: string,"consumed_at"?: string | null,"created_at"?: string,"id"?: string,"mfa_recovery_code_set_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mfa_recovery_codes_mfa_recovery_code_set_id_fkey"
      columns: ["mfa_recovery_code_set_id"]
isOneToOne: false
      referencedRelation: "mfa_recovery_code_sets"
      referencedColumns: ["id"]
    }
                  ]
                },"oauth_authorizations": {
                  Row: {
                    "approved_at": string | null,"authorization_code": string | null,"authorization_id": string,"client_id": string,"code_challenge": string | null,"code_challenge_method": Database["auth"]['Enums']["code_challenge_method"] | null,"created_at": string,"expires_at": string,"id": string,"nonce": string | null,"redirect_uri": string,"resource": string | null,"response_type": Database["auth"]['Enums']["oauth_response_type"],"scope": string,"state": string | null,"status": Database["auth"]['Enums']["oauth_authorization_status"],"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"authorization_code"?: string | null,"authorization_id": string,"client_id": string,"code_challenge"?: string | null,"code_challenge_method"?: Database["auth"]['Enums']["code_challenge_method"] | null,"created_at"?: string,"expires_at"?: string,"id": string,"nonce"?: string | null,"redirect_uri": string,"resource"?: string | null,"response_type"?: Database["auth"]['Enums']["oauth_response_type"],"scope": string,"state"?: string | null,"status"?: Database["auth"]['Enums']["oauth_authorization_status"],"user_id"?: string | null
                  }
                  Update: {
                    "approved_at"?: string | null,"authorization_code"?: string | null,"authorization_id"?: string,"client_id"?: string,"code_challenge"?: string | null,"code_challenge_method"?: Database["auth"]['Enums']["code_challenge_method"] | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"nonce"?: string | null,"redirect_uri"?: string,"resource"?: string | null,"response_type"?: Database["auth"]['Enums']["oauth_response_type"],"scope"?: string,"state"?: string | null,"status"?: Database["auth"]['Enums']["oauth_authorization_status"],"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "oauth_authorizations_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "oauth_clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "oauth_authorizations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"oauth_client_states": {
                  Row: {
                    "code_verifier": string | null,"created_at": string,"id": string,"provider_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code_verifier"?: string | null,"created_at": string,"id": string,"provider_type": string
                  }
                  Update: {
                    "code_verifier"?: string | null,"created_at"?: string,"id"?: string,"provider_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"oauth_clients": {
                  Row: {
                    "client_name": string | null,"client_secret_hash": string | null,"client_type": Database["auth"]['Enums']["oauth_client_type"],"client_uri": string | null,"created_at": string,"deleted_at": string | null,"grant_types": string,"id": string,"logo_uri": string | null,"redirect_uris": string,"registration_type": Database["auth"]['Enums']["oauth_registration_type"],"token_endpoint_auth_method": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_name"?: string | null,"client_secret_hash"?: string | null,"client_type"?: Database["auth"]['Enums']["oauth_client_type"],"client_uri"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"grant_types": string,"id": string,"logo_uri"?: string | null,"redirect_uris": string,"registration_type": Database["auth"]['Enums']["oauth_registration_type"],"token_endpoint_auth_method": string,"updated_at"?: string
                  }
                  Update: {
                    "client_name"?: string | null,"client_secret_hash"?: string | null,"client_type"?: Database["auth"]['Enums']["oauth_client_type"],"client_uri"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"grant_types"?: string,"id"?: string,"logo_uri"?: string | null,"redirect_uris"?: string,"registration_type"?: Database["auth"]['Enums']["oauth_registration_type"],"token_endpoint_auth_method"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"oauth_consents": {
                  Row: {
                    "client_id": string,"granted_at": string,"id": string,"revoked_at": string | null,"scopes": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"granted_at"?: string,"id": string,"revoked_at"?: string | null,"scopes": string,"user_id": string
                  }
                  Update: {
                    "client_id"?: string,"granted_at"?: string,"id"?: string,"revoked_at"?: string | null,"scopes"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "oauth_consents_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "oauth_clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "oauth_consents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"one_time_tokens": {
                  Row: {
                    "created_at": string,"expires_at": string | null,"id": string,"relates_to": string,"token_hash": string,"token_type": Database["auth"]['Enums']["one_time_token_type"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string | null,"id": string,"relates_to": string,"token_hash": string,"token_type": Database["auth"]['Enums']["one_time_token_type"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string | null,"id"?: string,"relates_to"?: string,"token_hash"?: string,"token_type"?: Database["auth"]['Enums']["one_time_token_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "one_time_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"refresh_tokens": {
                  Row: {
                    "created_at": string | null,"id": number,"instance_id": string | null,"parent": string | null,"revoked": boolean | null,"session_id": string | null,"token": string | null,"updated_at": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: number,"instance_id"?: string | null,"parent"?: string | null,"revoked"?: boolean | null,"session_id"?: string | null,"token"?: string | null,"updated_at"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: number,"instance_id"?: string | null,"parent"?: string | null,"revoked"?: boolean | null,"session_id"?: string | null,"token"?: string | null,"updated_at"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "refresh_tokens_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"saml_providers": {
                  Row: {
                    "attribute_mapping": Json | null,"created_at": string | null,"entity_id": string,"id": string,"metadata_url": string | null,"metadata_xml": string,"name_id_format": string | null,"sso_provider_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attribute_mapping"?: Json | null,"created_at"?: string | null,"entity_id": string,"id": string,"metadata_url"?: string | null,"metadata_xml": string,"name_id_format"?: string | null,"sso_provider_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "attribute_mapping"?: Json | null,"created_at"?: string | null,"entity_id"?: string,"id"?: string,"metadata_url"?: string | null,"metadata_xml"?: string,"name_id_format"?: string | null,"sso_provider_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "saml_providers_sso_provider_id_fkey"
      columns: ["sso_provider_id"]
isOneToOne: false
      referencedRelation: "sso_providers"
      referencedColumns: ["id"]
    }
                  ]
                },"saml_relay_states": {
                  Row: {
                    "created_at": string | null,"flow_state_id": string | null,"for_email": string | null,"id": string,"redirect_to": string | null,"request_id": string,"sso_provider_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"flow_state_id"?: string | null,"for_email"?: string | null,"id": string,"redirect_to"?: string | null,"request_id": string,"sso_provider_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"flow_state_id"?: string | null,"for_email"?: string | null,"id"?: string,"redirect_to"?: string | null,"request_id"?: string,"sso_provider_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "saml_relay_states_flow_state_id_fkey"
      columns: ["flow_state_id"]
isOneToOne: false
      referencedRelation: "flow_state"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saml_relay_states_sso_provider_id_fkey"
      columns: ["sso_provider_id"]
isOneToOne: false
      referencedRelation: "sso_providers"
      referencedColumns: ["id"]
    }
                  ]
                },"schema_migrations": {
                  Row: {
                    "version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "version": string
                  }
                  Update: {
                    "version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"scim_tokens": {
                  Row: {
                    "created_at": string,"expires_at": string | null,"id": string,"last_used_at": string | null,"prefix": string,"revoked_at": string | null,"sso_provider_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string | null,"id": string,"last_used_at"?: string | null,"prefix": string,"revoked_at"?: string | null,"sso_provider_id": string,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string | null,"id"?: string,"last_used_at"?: string | null,"prefix"?: string,"revoked_at"?: string | null,"sso_provider_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scim_tokens_sso_provider_id_fkey"
      columns: ["sso_provider_id"]
isOneToOne: false
      referencedRelation: "sso_providers"
      referencedColumns: ["id"]
    }
                  ]
                },"scim_users": {
                  Row: {
                    "active": boolean,"created_at": string,"deleted_at": string | null,"external_id": string | null,"id": string,"resource": NonNullable<Json>,"sso_provider_id": string,"updated_at": string,"user_id": string | null,"user_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: never,"created_at"?: string,"deleted_at"?: string | null,"external_id"?: never,"id": string,"resource": NonNullable<Json>,"sso_provider_id": string,"updated_at"?: string,"user_id"?: string | null,"user_name"?: never
                  }
                  Update: {
                    "active"?: never,"created_at"?: string,"deleted_at"?: string | null,"external_id"?: never,"id"?: string,"resource"?: NonNullable<Json>,"sso_provider_id"?: string,"updated_at"?: string,"user_id"?: string | null,"user_name"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "scim_users_sso_provider_id_fkey"
      columns: ["sso_provider_id"]
isOneToOne: false
      referencedRelation: "sso_providers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scim_users_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "aal": Database["auth"]['Enums']["aal_level"] | null,"created_at": string | null,"factor_id": string | null,"id": string,"ip": unknown,"not_after": string | null,"oauth_client_id": string | null,"refresh_token_counter": number | null,"refresh_token_hmac_key": string | null,"refreshed_at": string | null,"scopes": string | null,"tag": string | null,"updated_at": string | null,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aal"?: Database["auth"]['Enums']["aal_level"] | null,"created_at"?: string | null,"factor_id"?: string | null,"id": string,"ip"?: unknown,"not_after"?: string | null,"oauth_client_id"?: string | null,"refresh_token_counter"?: number | null,"refresh_token_hmac_key"?: string | null,"refreshed_at"?: string | null,"scopes"?: string | null,"tag"?: string | null,"updated_at"?: string | null,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "aal"?: Database["auth"]['Enums']["aal_level"] | null,"created_at"?: string | null,"factor_id"?: string | null,"id"?: string,"ip"?: unknown,"not_after"?: string | null,"oauth_client_id"?: string | null,"refresh_token_counter"?: number | null,"refresh_token_hmac_key"?: string | null,"refreshed_at"?: string | null,"scopes"?: string | null,"tag"?: string | null,"updated_at"?: string | null,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_oauth_client_id_fkey"
      columns: ["oauth_client_id"]
isOneToOne: false
      referencedRelation: "oauth_clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"sso_domains": {
                  Row: {
                    "created_at": string | null,"domain": string,"id": string,"sso_provider_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"domain": string,"id": string,"sso_provider_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"domain"?: string,"id"?: string,"sso_provider_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sso_domains_sso_provider_id_fkey"
      columns: ["sso_provider_id"]
isOneToOne: false
      referencedRelation: "sso_providers"
      referencedColumns: ["id"]
    }
                  ]
                },"sso_providers": {
                  Row: {
                    "created_at": string | null,"disabled": boolean | null,"id": string,"resource_id": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"disabled"?: boolean | null,"id": string,"resource_id"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"disabled"?: boolean | null,"id"?: string,"resource_id"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"users": {
                  Row: {
                    "aud": string | null,"banned_until": string | null,"confirmation_sent_at": string | null,"confirmation_token": string | null,"confirmed_at": string | null,"created_at": string | null,"deleted_at": string | null,"email": string | null,"email_change": string | null,"email_change_confirm_status": number | null,"email_change_sent_at": string | null,"email_change_token_current": string | null,"email_change_token_new": string | null,"email_confirmed_at": string | null,"encrypted_password": string | null,"id": string,"instance_id": string | null,"invited_at": string | null,"is_anonymous": boolean,"is_sso_user": boolean,"is_super_admin": boolean | null,"last_sign_in_at": string | null,"phone": string | null,"phone_change": string | null,"phone_change_sent_at": string | null,"phone_change_token": string | null,"phone_confirmed_at": string | null,"raw_app_meta_data": Json | null,"raw_user_meta_data": Json | null,"reauthentication_sent_at": string | null,"reauthentication_token": string | null,"recovery_sent_at": string | null,"recovery_token": string | null,"role": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aud"?: string | null,"banned_until"?: string | null,"confirmation_sent_at"?: string | null,"confirmation_token"?: string | null,"confirmed_at"?: never,"created_at"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"email_change"?: string | null,"email_change_confirm_status"?: number | null,"email_change_sent_at"?: string | null,"email_change_token_current"?: string | null,"email_change_token_new"?: string | null,"email_confirmed_at"?: string | null,"encrypted_password"?: string | null,"id": string,"instance_id"?: string | null,"invited_at"?: string | null,"is_anonymous"?: boolean,"is_sso_user"?: boolean,"is_super_admin"?: boolean | null,"last_sign_in_at"?: string | null,"phone"?: string | null,"phone_change"?: string | null,"phone_change_sent_at"?: string | null,"phone_change_token"?: string | null,"phone_confirmed_at"?: string | null,"raw_app_meta_data"?: Json | null,"raw_user_meta_data"?: Json | null,"reauthentication_sent_at"?: string | null,"reauthentication_token"?: string | null,"recovery_sent_at"?: string | null,"recovery_token"?: string | null,"role"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "aud"?: string | null,"banned_until"?: string | null,"confirmation_sent_at"?: string | null,"confirmation_token"?: string | null,"confirmed_at"?: never,"created_at"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"email_change"?: string | null,"email_change_confirm_status"?: number | null,"email_change_sent_at"?: string | null,"email_change_token_current"?: string | null,"email_change_token_new"?: string | null,"email_confirmed_at"?: string | null,"encrypted_password"?: string | null,"id"?: string,"instance_id"?: string | null,"invited_at"?: string | null,"is_anonymous"?: boolean,"is_sso_user"?: boolean,"is_super_admin"?: boolean | null,"last_sign_in_at"?: string | null,"phone"?: string | null,"phone_change"?: string | null,"phone_change_sent_at"?: string | null,"phone_change_token"?: string | null,"phone_confirmed_at"?: string | null,"raw_app_meta_data"?: Json | null,"raw_user_meta_data"?: Json | null,"reauthentication_sent_at"?: string | null,"reauthentication_token"?: string | null,"recovery_sent_at"?: string | null,"recovery_token"?: string | null,"role"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"webauthn_challenges": {
                  Row: {
                    "challenge_type": string,"created_at": string,"expires_at": string,"id": string,"session_data": NonNullable<Json>,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_type": string,"created_at"?: string,"expires_at": string,"id"?: string,"session_data": NonNullable<Json>,"user_id"?: string | null
                  }
                  Update: {
                    "challenge_type"?: string,"created_at"?: string,"expires_at"?: string,"id"?: string,"session_data"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "webauthn_challenges_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"webauthn_credentials": {
                  Row: {
                    "aaguid": string | null,"attestation_type": string,"backed_up": boolean,"backup_eligible": boolean,"created_at": string,"credential_id": string,"friendly_name": string,"id": string,"last_used_at": string | null,"public_key": string,"sign_count": number,"transports": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aaguid"?: string | null,"attestation_type"?: string,"backed_up"?: boolean,"backup_eligible"?: boolean,"created_at"?: string,"credential_id": string,"friendly_name"?: string,"id"?: string,"last_used_at"?: string | null,"public_key": string,"sign_count"?: number,"transports"?: NonNullable<Json>,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "aaguid"?: string | null,"attestation_type"?: string,"backed_up"?: boolean,"backup_eligible"?: boolean,"created_at"?: string,"credential_id"?: string,"friendly_name"?: string,"id"?: string,"last_used_at"?: string | null,"public_key"?: string,"sign_count"?: number,"transports"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webauthn_credentials_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "email":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"jwt":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uid":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            "aal_level": "aal1"|"aal2"|"aal3","code_challenge_method": "s256"|"plain","factor_status": "unverified"|"verified","factor_type": "totp"|"webauthn"|"phone"|"recovery_code","oauth_authorization_status": "pending"|"approved"|"denied"|"expired","oauth_client_type": "public"|"confidential","oauth_registration_type": "dynamic"|"manual","oauth_response_type": "code","one_time_token_type": "confirmation_token"|"reauthentication_token"|"recovery_token"|"email_change_token_new"|"email_change_token_current"|"phone_change_token"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"created_at": string,"id": string,"metadata": NonNullable<Json>,"resource_id": string | null,"resource_type": string,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"resource_id"?: string | null,"resource_type": string,"tenant_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"resource_id"?: string | null,"resource_type"?: string,"tenant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_user_id_fkey"
      columns: ["actor_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_logs_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_admins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"full_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"full_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "attempts": number,"blocked_until": string | null,"identifier": string,"scope": string,"updated_at": string,"window_started_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"blocked_until"?: string | null,"identifier": string,"scope": string,"updated_at"?: string,"window_started_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"blocked_until"?: string | null,"identifier"?: string,"scope"?: string,"updated_at"?: string,"window_started_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"retail_categories": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"slug": string,"sort_order": number,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"slug": string,"sort_order"?: number,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"slug"?: string,"sort_order"?: number,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "retail_categories_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"retail_product_categories": {
                  Row: {
                    "category_id": string,"created_at": string,"product_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"created_at"?: string,"product_id": string,"tenant_id": string
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"product_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "retail_product_categories_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "retail_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "retail_product_categories_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "retail_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "retail_product_categories_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"retail_product_images": {
                  Row: {
                    "alt_text": string | null,"created_at": string,"id": string,"is_primary": boolean,"product_id": string,"sort_order": number,"storage_path": string,"tenant_id": string,"updated_at": string,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text"?: string | null,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"product_id": string,"sort_order"?: number,"storage_path": string,"tenant_id": string,"updated_at"?: string,"variant_id"?: string | null
                  }
                  Update: {
                    "alt_text"?: string | null,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"product_id"?: string,"sort_order"?: number,"storage_path"?: string,"tenant_id"?: string,"updated_at"?: string,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "retail_product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "retail_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "retail_product_images_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "retail_product_images_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "retail_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"retail_product_options": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"position": number,"product_id": string,"tenant_id": string,"updated_at": string,"values": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"position"?: number,"product_id": string,"tenant_id": string,"updated_at"?: string,"values"?: (string)[]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"position"?: number,"product_id"?: string,"tenant_id"?: string,"updated_at"?: string,"values"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "retail_product_options_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "retail_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "retail_product_options_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"retail_products": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"published_at": string | null,"slug": string,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"published_at"?: string | null,"slug": string,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"published_at"?: string | null,"slug"?: string,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "retail_products_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"retail_stores": {
                  Row: {
                    "about_text": string | null,"accent_color": string | null,"announcement_bar": string | null,"brand_headline": string | null,"brand_subheadline": string | null,"contact_email": string | null,"contact_phone": string | null,"created_at": string,"currency": string,"hero_badge": string | null,"hero_image_path": string | null,"id": string,"inventory_mode": string,"is_active": boolean,"secondary_color": string | null,"slug": string | null,"social_links": NonNullable<Json>,"store_name": string,"template": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "about_text"?: string | null,"accent_color"?: string | null,"announcement_bar"?: string | null,"brand_headline"?: string | null,"brand_subheadline"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"currency"?: string,"hero_badge"?: string | null,"hero_image_path"?: string | null,"id"?: string,"inventory_mode"?: string,"is_active"?: boolean,"secondary_color"?: string | null,"slug"?: string | null,"social_links"?: NonNullable<Json>,"store_name": string,"template"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "about_text"?: string | null,"accent_color"?: string | null,"announcement_bar"?: string | null,"brand_headline"?: string | null,"brand_subheadline"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"currency"?: string,"hero_badge"?: string | null,"hero_image_path"?: string | null,"id"?: string,"inventory_mode"?: string,"is_active"?: boolean,"secondary_color"?: string | null,"slug"?: string | null,"social_links"?: NonNullable<Json>,"store_name"?: string,"template"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "retail_stores_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"retail_variants": {
                  Row: {
                    "compare_at_price_cents": number | null,"created_at": string,"id": string,"is_available": boolean,"name": string,"options_summary": NonNullable<Json>,"price_cents": number,"product_id": string,"sku": string,"sort_order": number,"stock_quantity": number,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "compare_at_price_cents"?: number | null,"created_at"?: string,"id"?: string,"is_available"?: boolean,"name": string,"options_summary"?: NonNullable<Json>,"price_cents": number,"product_id": string,"sku": string,"sort_order"?: number,"stock_quantity"?: number,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "compare_at_price_cents"?: number | null,"created_at"?: string,"id"?: string,"is_available"?: boolean,"name"?: string,"options_summary"?: NonNullable<Json>,"price_cents"?: number,"product_id"?: string,"sku"?: string,"sort_order"?: number,"stock_quantity"?: number,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "retail_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "retail_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "retail_variants_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"retail_cart_items": {
                  Row: {
                    "cart_id": string,"created_at": string,"id": string,"product_id": string,"quantity": number,"tenant_id": string,"updated_at": string,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cart_id": string,"created_at"?: string,"id"?: string,"product_id": string,"quantity": number,"tenant_id": string,"updated_at"?: string,"variant_id": string
                  }
                  Update: {
                    "cart_id"?: string,"created_at"?: string,"id"?: string,"product_id"?: string,"quantity"?: number,"tenant_id"?: string,"updated_at"?: string,"variant_id"?: string
                  }
                  Relationships: []
                },"retail_carts": {
                  Row: {
                    "cart_token_hash": string,"created_at": string,"expires_at": string,"id": string,"status": string,"store_id": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cart_token_hash": string,"created_at"?: string,"expires_at"?: string,"id"?: string,"status"?: string,"store_id": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "cart_token_hash"?: string,"created_at"?: string,"expires_at"?: string,"id"?: string,"status"?: string,"store_id"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: []
                },"retail_order_items": {
                  Row: {
                    "created_at": string,"id": string,"image_url_snapshot": string | null,"line_total_cents": number,"order_id": string,"product_id": string | null,"product_name_snapshot": string,"quantity": number,"sku_snapshot": string,"tenant_id": string,"unit_price_cents": number,"variant_id": string | null,"variant_name_snapshot": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_url_snapshot"?: string | null,"line_total_cents": number,"order_id": string,"product_id"?: string | null,"product_name_snapshot": string,"quantity": number,"sku_snapshot": string,"tenant_id": string,"unit_price_cents": number,"variant_id"?: string | null,"variant_name_snapshot": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_url_snapshot"?: string | null,"line_total_cents"?: number,"order_id"?: string,"product_id"?: string | null,"product_name_snapshot"?: string,"quantity"?: number,"sku_snapshot"?: string,"tenant_id"?: string,"unit_price_cents"?: number,"variant_id"?: string | null,"variant_name_snapshot"?: string
                  }
                  Relationships: []
                },"retail_order_status_history": {
                  Row: {
                    "changed_by_name_snapshot": string | null,"changed_by_user_id": string | null,"created_at": string,"from_status": string | null,"id": string,"order_id": string,"reason": string | null,"tenant_id": string,"to_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_by_name_snapshot"?: string | null,"changed_by_user_id"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: string,"order_id": string,"reason"?: string | null,"tenant_id": string,"to_status": string
                  }
                  Update: {
                    "changed_by_name_snapshot"?: string | null,"changed_by_user_id"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: string,"order_id"?: string,"reason"?: string | null,"tenant_id"?: string,"to_status"?: string
                  }
                  Relationships: []
                },"retail_orders": {
                  Row: {
                    "cancellation_reason": string | null,"cancelled_at": string | null,"cart_id": string | null,"channel": string,"completed_at": string | null,"confirmed_at": string | null,"created_at": string,"currency": string,"customer_email": string | null,"customer_name": string,"customer_phone": string,"delivery_address": string | null,"delivery_mode": string,"id": string,"idempotency_key": string | null,"notes": string | null,"order_number": string,"public_token_hash": string,"status": string,"stock_deducted": boolean,"store_id": string,"subtotal_cents": number,"tenant_id": string,"total_cents": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cart_id"?: string | null,"channel"?: string,"completed_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"currency"?: string,"customer_email"?: string | null,"customer_name": string,"customer_phone": string,"delivery_address"?: string | null,"delivery_mode"?: string,"id"?: string,"idempotency_key"?: string | null,"notes"?: string | null,"order_number": string,"public_token_hash": string,"status"?: string,"stock_deducted"?: boolean,"store_id": string,"subtotal_cents": number,"tenant_id": string,"total_cents": number,"updated_at"?: string
                  }
                  Update: {
                    "cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cart_id"?: string | null,"channel"?: string,"completed_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"currency"?: string,"customer_email"?: string | null,"customer_name"?: string,"customer_phone"?: string,"delivery_address"?: string | null,"delivery_mode"?: string,"id"?: string,"idempotency_key"?: string | null,"notes"?: string | null,"order_number"?: string,"public_token_hash"?: string,"status"?: string,"stock_deducted"?: boolean,"store_id"?: string,"subtotal_cents"?: number,"tenant_id"?: string,"total_cents"?: number,"updated_at"?: string
                  }
                  Relationships: []
                },"tenant_invitations": {
                  Row: {
                    "created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"role": Database["public"]['Enums']["membership_role"],"status": string,"tenant_id": string,"token_hash": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by": string,"role"?: Database["public"]['Enums']["membership_role"],"status"?: string,"tenant_id": string,"token_hash": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"role"?: Database["public"]['Enums']["membership_role"],"status"?: string,"tenant_id"?: string,"token_hash"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tenant_invitations_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_memberships": {
                  Row: {
                    "created_at": string,"id": string,"role": Database["public"]['Enums']["membership_role"],"tenant_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["membership_role"],"tenant_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["membership_role"],"tenant_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_memberships_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tenant_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_settings": {
                  Row: {
                    "brand_description": string | null,"contact_email": string | null,"contact_phone": string | null,"created_at": string,"display_name": string,"locale": string,"monogram": string | null,"primary_color": string,"segment_label": string,"tenant_id": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_description"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"display_name": string,"locale"?: string,"monogram"?: string | null,"primary_color"?: string,"segment_label"?: string,"tenant_id": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "brand_description"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"display_name"?: string,"locale"?: string,"monogram"?: string | null,"primary_color"?: string,"segment_label"?: string,"tenant_id"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_settings_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"status": Database["public"]['Enums']["tenant_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"status"?: Database["public"]['Enums']["tenant_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["tenant_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_tenant_invitation":
{ Args: { "p_token_hash": string,"p_user_id": string }; Returns: Json
                           },
"cancel_retail_order":
{ Args: { "p_actor_name"?: string,"p_actor_user_id"?: string | null,"p_order_id": string,"p_reason"?: string,"p_tenant_id": string }; Returns: Database["public"]["Tables"]["retail_orders"]["Row"]
                           },
"confirm_retail_order":
{ Args: { "p_actor_name"?: string,"p_actor_user_id"?: string | null,"p_order_id": string,"p_reason"?: string,"p_tenant_id": string }; Returns: Database["public"]["Tables"]["retail_orders"]["Row"]
                           },
"consume_rate_limit":
{ Args: { "p_block_seconds"?: number,"p_identifier": string,"p_max_attempts": number,"p_scope": string,"p_window_seconds": number }; Returns: {
              "allowed": boolean,"remaining": number,"retry_after_seconds": number
            }[]
                           },
"create_public_retail_order":
{ Args: { "p_cart_token_hash": string,"p_customer_email"?: string,"p_customer_name": string,"p_customer_phone": string,"p_delivery_address"?: string,"p_delivery_mode"?: string,"p_idempotency_key"?: string,"p_notes"?: string,"p_order_number": string,"p_public_token_hash": string,"p_store_slug": string }; Returns: Json
                           },
"create_tenant_with_owner":
{ Args: { "p_actor_user_id": string,"p_display_name"?: string,"p_locale"?: string,"p_name": string,"p_owner_user_id": string,"p_slug": string,"p_timezone"?: string }; Returns: Json
                           },
"get_public_storefront":
{ Args: { "p_slug": string }; Returns: {
              "about_text": string,"accent_color": string,"announcement_bar": string,"brand_headline": string,"brand_subheadline": string,"contact_email": string,"contact_phone": string,"currency": string,"hero_badge": string,"hero_image_path": string,"is_active": boolean,"secondary_color": string,"slug": string,"social_links": Json,"store_id": string,"store_name": string,"template": string,"tenant_id": string
            }[]
                           },
"has_tenant_role":
{ Args: { "allowed_roles": (Database["public"]['Enums']["membership_role"])[],"check_tenant_id": string,"check_user_id": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: { "check_user_id": string }; Returns: boolean
                           },
"is_retail_active":
{ Args: { "p_tenant_id": string }; Returns: boolean
                           },
"is_tenant_active":
{ Args: { "check_tenant_id": string }; Returns: boolean
                           },
"is_tenant_member":
{ Args: { "check_tenant_id": string,"check_user_id": string }; Returns: boolean
                           },
"reset_rate_limit":
{ Args: { "p_identifier": string,"p_scope": string }; Returns: undefined
                           },
"transition_retail_order_status":
{ Args: { "p_actor_name"?: string,"p_actor_user_id"?: string | null,"p_next_status": string,"p_order_id": string,"p_reason"?: string,"p_tenant_id": string }; Returns: Database["public"]["Tables"]["retail_orders"]["Row"]
                           }
          }
          Enums: {
            "membership_role": "owner"|"manager"|"staff","tenant_status": "active"|"suspended"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"storage": {
          Tables: {
            "bucket_lifecycle_states": {
                  Row: {
                    "bucket_id": string,"claim_id": string | null,"claim_until": string | null,"continuation": Json | null,"failure_count": number,"generation": string | null,"last_completed_at": string | null,"last_error": Json | null,"last_result": Json | null,"last_started_at": string | null,"last_success_at": string | null,"next_run_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"claim_id"?: string | null,"claim_until"?: string | null,"continuation"?: Json | null,"failure_count"?: number,"generation"?: string | null,"last_completed_at"?: string | null,"last_error"?: Json | null,"last_result"?: Json | null,"last_started_at"?: string | null,"last_success_at"?: string | null,"next_run_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bucket_id"?: string,"claim_id"?: string | null,"claim_until"?: string | null,"continuation"?: Json | null,"failure_count"?: number,"generation"?: string | null,"last_completed_at"?: string | null,"last_error"?: Json | null,"last_result"?: Json | null,"last_started_at"?: string | null,"last_success_at"?: string | null,"next_run_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bucket_lifecycle_states_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: true
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"buckets": {
                  Row: {
                    "allowed_mime_types": (string)[] | null,"avif_autodetection": boolean | null,"created_at": string | null,"file_size_limit": number | null,"id": string,"lifecycle_configuration": Json | null,"lifecycle_configuration_generation": string | null,"name": string,"owner": string | null,"owner_id": string | null,"public": boolean | null,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string | null,"versioning_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id": string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name": string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Update: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id"?: string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name"?: string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_analytics": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"format": string,"id": string,"name": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_vectors": {
                  Row: {
                    "created_at": string,"id": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"iceberg_namespaces": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    }
                  ]
                },"iceberg_tables": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"location": string,"name": string,"namespace_id": string,"remote_table_id": string | null,"shard_id": string | null,"shard_key": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"location": string,"name": string,"namespace_id": string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"location"?: string,"name"?: string,"namespace_id"?: string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_tables_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "iceberg_tables_namespace_id_fkey"
      columns: ["namespace_id"]
isOneToOne: false
      referencedRelation: "iceberg_namespaces"
      referencedColumns: ["id"]
    }
                  ]
                },"lifecycle_abandoned_artifacts": {
                  Row: {
                    "attempted_at": string,"bucket_id": string,"key": string,"name": string,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempted_at"?: string,"bucket_id": string,"key": string,"name": string,"version"?: string | null
                  }
                  Update: {
                    "attempted_at"?: string,"bucket_id"?: string,"key"?: string,"name"?: string,"version"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"migrations": {
                  Row: {
                    "executed_at": string | null,"hash": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "executed_at"?: string | null,"hash": string,"id": number,"name": string
                  }
                  Update: {
                    "executed_at"?: string | null,"hash"?: string,"id"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"objects": {
                  Row: {
                    "archived_at": string | null,"bucket_id": string | null,"created_at": string | null,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string | null,"metadata": Json | null,"name": string | null,"owner": string | null,"owner_id": string | null,"path_tokens": (string)[] | null,"updated_at": string | null,"user_metadata": Json | null,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "objects_bucketId_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads": {
                  Row: {
                    "bucket_id": string,"created_at": string,"id": string,"in_progress_size": number,"key": string,"metadata": Json | null,"owner_id": string | null,"upload_signature": string,"user_metadata": Json | null,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"id": string,"in_progress_size"?: number,"key": string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature": string,"user_metadata"?: Json | null,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"id"?: string,"in_progress_size"?: number,"key"?: string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature"?: string,"user_metadata"?: Json | null,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads_parts": {
                  Row: {
                    "bucket_id": string,"created_at": string,"etag": string,"id": string,"key": string,"owner_id": string | null,"part_number": number,"size": number,"upload_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"etag": string,"id"?: string,"key": string,"owner_id"?: string | null,"part_number": number,"size"?: number,"upload_id": string,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"etag"?: string,"id"?: string,"key"?: string,"owner_id"?: string | null,"part_number"?: number,"size"?: number,"upload_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
      columns: ["upload_id"]
isOneToOne: false
      referencedRelation: "s3_multipart_uploads"
      referencedColumns: ["id"]
    }
                  ]
                },"vector_indexes": {
                  Row: {
                    "bucket_id": string,"created_at": string,"data_type": string,"dimension": number,"distance_metric": string,"id": string,"metadata_configuration": Json | null,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"data_type": string,"dimension": number,"distance_metric": string,"id"?: string,"metadata_configuration"?: Json | null,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"data_type"?: string,"dimension"?: number,"distance_metric"?: string,"id"?: string,"metadata_configuration"?: Json | null,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vector_indexes_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets_vectors"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "allow_any_operation":
{ Args: { "expected_operations": (string)[] }; Returns: boolean
                           },
"allow_only_operation":
{ Args: { "expected_operation": string }; Returns: boolean
                           },
"can_insert_object":
{ Args: { "bucketid": string,"metadata": Json,"name": string,"owner": string }; Returns: undefined
                           },
"delete_lifecycle_objects":
{ Args: { "object_ids": (string)[] }; Returns: {
              "id": string,"is_delete_marker": boolean,"metadata": Json
            }[]
                           },
"extension":
{ Args: { "name": string }; Returns: string
                           },
"filename":
{ Args: { "name": string }; Returns: string
                           },
"foldername":
{ Args: { "name": string }; Returns: (string)[]
                           },
"get_common_prefix":
{ Args: { "p_delimiter": string,"p_key": string,"p_prefix": string }; Returns: string
                           },
"get_size_by_bucket":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string }; Returns: {
              "bucket_id": string,"size": number
            }[]
                           },
"list_multipart_uploads_with_delimiter":
{ Args: { "bucket_id": string,"delimiter_param": string,"max_keys"?: number,"next_key_token"?: string,"next_upload_token"?: string,"prefix_param": string,"raw_prefix_param"?: string }; Returns: {
              "created_at": string,"id": string,"key": string
            }[]
                           },
"list_objects_with_delimiter":
{ Args: { "_bucket_id": string,"delete_markers"?: string,"delimiter_param": string,"max_keys"?: number,"next_token"?: string,"next_token_archived_at"?: string,"next_token_version"?: string,"noncurrent_versions"?: string,"prefix_param": string,"sort_order"?: string,"start_after"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"operation":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"reconcile_lifecycle_state":
{ Args: { "policy_changed": boolean,"target_bucket_id": string }; Returns: undefined
                           },
"search":
{ Args: { "bucketname": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"offsets"?: number,"prefix": string,"search"?: string,"sortcolumn"?: string,"sortorder"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_by_timestamp":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string,"p_bucket_id": string,"p_level": number,"p_limit": number,"p_prefix": string,"p_sort_column": string,"p_sort_column_after": string,"p_sort_order": string,"p_start_after": string,"p_start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_v2":
{ Args: { "bucket_name": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"prefix": string,"sort_column"?: string,"sort_column_after"?: string,"sort_order"?: string,"start_after"?: string,"start_after_archived_at"?: string,"start_after_is_continuation"?: boolean,"start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           }
          }
          Enums: {
            "buckettype": "STANDARD"|"ANALYTICS"|"VECTOR"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "auth": {
          Enums: {
            "aal_level": ["aal1", "aal2", "aal3"],"code_challenge_method": ["s256", "plain"],"factor_status": ["unverified", "verified"],"factor_type": ["totp", "webauthn", "phone", "recovery_code"],"oauth_authorization_status": ["pending", "approved", "denied", "expired"],"oauth_client_type": ["public", "confidential"],"oauth_registration_type": ["dynamic", "manual"],"oauth_response_type": ["code"],"one_time_token_type": ["confirmation_token", "reauthentication_token", "recovery_token", "email_change_token_new", "email_change_token_current", "phone_change_token"]
          }
        },"public": {
          Enums: {
            "membership_role": ["owner", "manager", "staff"],"tenant_status": ["active", "suspended"]
          }
        },"storage": {
          Enums: {
            "buckettype": ["STANDARD", "ANALYTICS", "VECTOR"]
          }
        }
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

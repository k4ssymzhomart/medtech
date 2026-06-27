// DB types for MedServicePrice.kz, derived from supabase/migrations (no DB
// credential needed). Mirrors the shape `supabase gen types typescript` would
// produce, so it drops into createClient<Database>. Regenerate from the live
// schema after apply if you want the canonical output:
//   supabase gen types typescript --project-id <ref> > web/lib/supabase/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SourceType = "html" | "pdf" | "docx" | "xlsx";
export type RunStatus =
  | "queued"
  | "running"
  | "success"
  | "partial"
  | "failed";
export type RunTrigger = "manual" | "scheduled";
export type LogLevel = "debug" | "info" | "warn" | "error";
export type QueueStatus = "pending" | "resolved" | "ignored";

export interface Database {
  public: {
    Tables: {
      service_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["service_categories"]["Insert"]>;
      };
      services_catalog: {
        Row: {
          id: string;
          canonical_name: string;
          category_id: string | null;
          synonyms: string[];
          slug: string;
          embedding: string | null; // pgvector, serialized as a string
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          canonical_name: string;
          category_id?: string | null;
          synonyms?: string[];
          slug: string;
          embedding?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["services_catalog"]["Insert"]>;
      };
      clinics: {
        Row: {
          id: string;
          name: string;
          city: string;
          address: string | null;
          geo: unknown | null; // postgis geography(point)
          phone: string | null;
          website_url: string | null;
          rating: number | null;
          reviews_count: number;
          has_online_booking: boolean;
          working_hours: Json | null;
          logo_url: string | null;
          is_active: boolean;
          archived_at: string | null;
          archive_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city: string;
          address?: string | null;
          geo?: unknown | null;
          phone?: string | null;
          website_url?: string | null;
          rating?: number | null;
          reviews_count?: number;
          has_online_booking?: boolean;
          working_hours?: Json | null;
          logo_url?: string | null;
          is_active?: boolean;
          archived_at?: string | null;
          archive_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clinics"]["Insert"]>;
      };
      sources: {
        Row: {
          id: string;
          name: string;
          default_clinic_id: string | null;
          url: string;
          source_type: SourceType;
          parse_config: Json;
          parse_frequency: string | null;
          is_active: boolean;
          last_run_at: string | null;
          next_run_at: string | null;
          consecutive_failures: number;
          archived_at: string | null;
          archive_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          default_clinic_id?: string | null;
          url: string;
          source_type?: SourceType;
          parse_config?: Json;
          parse_frequency?: string | null;
          is_active?: boolean;
          last_run_at?: string | null;
          next_run_at?: string | null;
          consecutive_failures?: number;
          archived_at?: string | null;
          archive_reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
      };
      parse_runs: {
        Row: {
          id: string;
          source_id: string;
          status: RunStatus;
          trigger: RunTrigger;
          started_at: string | null;
          finished_at: string | null;
          rows_found: number;
          rows_inserted: number;
          rows_updated: number;
          rows_unmatched: number;
          error_summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          status?: RunStatus;
          trigger?: RunTrigger;
          started_at?: string | null;
          finished_at?: string | null;
          rows_found?: number;
          rows_inserted?: number;
          rows_updated?: number;
          rows_unmatched?: number;
          error_summary?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["parse_runs"]["Insert"]>;
      };
      parse_logs: {
        Row: {
          id: string;
          run_id: string | null;
          source_id: string | null;
          level: LogLevel;
          message: string | null;
          detail: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id?: string | null;
          source_id?: string | null;
          level?: LogLevel;
          message?: string | null;
          detail?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["parse_logs"]["Insert"]>;
      };
      raw_documents: {
        Row: {
          id: string;
          source_id: string | null;
          run_id: string | null;
          storage_path: string | null;
          content_hash: string | null;
          http_status: number | null;
          mime_type: string | null;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          source_id?: string | null;
          run_id?: string | null;
          storage_path?: string | null;
          content_hash?: string | null;
          http_status?: number | null;
          mime_type?: string | null;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["raw_documents"]["Insert"]>;
      };
      raw_extractions: {
        Row: {
          id: string;
          raw_document_id: string | null;
          run_id: string | null;
          source_id: string | null;
          raw_service_name: string | null;
          raw_price: number | null;
          raw_currency: string | null;
          raw_duration: string | null;
          raw_meta: Json | null;
          extracted_at: string;
        };
        Insert: {
          id?: string;
          raw_document_id?: string | null;
          run_id?: string | null;
          source_id?: string | null;
          raw_service_name?: string | null;
          raw_price?: number | null;
          raw_currency?: string | null;
          raw_duration?: string | null;
          raw_meta?: Json | null;
          extracted_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["raw_extractions"]["Insert"]>;
      };
      price_offers: {
        Row: {
          id: string;
          clinic_id: string;
          service_id: string | null;
          source_id: string | null;
          price: number; // ALWAYS KZT
          currency: string;
          original_price: number | null;
          original_currency: string | null;
          duration_days: number | null;
          price_unit: string | null;
          raw_service_name: string | null;
          source_url: string | null;
          is_active: boolean;
          first_seen_at: string;
          last_seen_at: string;
          last_changed_at: string;
          archived_at: string | null;
          archive_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          service_id?: string | null;
          source_id?: string | null;
          price: number;
          currency?: string;
          original_price?: number | null;
          original_currency?: string | null;
          duration_days?: number | null;
          price_unit?: string | null;
          raw_service_name?: string | null;
          source_url?: string | null;
          is_active?: boolean;
          first_seen_at?: string;
          last_seen_at?: string;
          last_changed_at?: string;
          archived_at?: string | null;
          archive_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["price_offers"]["Insert"]>;
      };
      price_history: {
        Row: {
          id: string;
          price_offer_id: string;
          price: number;
          currency: string;
          recorded_at: string;
          parse_run_id: string | null;
        };
        Insert: {
          id?: string;
          price_offer_id: string;
          price: number;
          currency?: string;
          recorded_at?: string;
          parse_run_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["price_history"]["Insert"]>;
      };
      unmatched_queue: {
        Row: {
          id: string;
          raw_extraction_id: string | null;
          source_id: string | null;
          raw_service_name: string | null;
          suggested_service_id: string | null;
          confidence: number | null;
          status: QueueStatus;
          resolved_service_id: string | null;
          resolved_by: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          raw_extraction_id?: string | null;
          source_id?: string | null;
          raw_service_name?: string | null;
          suggested_service_id?: string | null;
          confidence?: number | null;
          status?: QueueStatus;
          resolved_service_id?: string | null;
          resolved_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["unmatched_queue"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// ---------------------------------------------------------------------------
// Convenience row aliases used across the app.
// ---------------------------------------------------------------------------
export type ServiceCategory = Database["public"]["Tables"]["service_categories"]["Row"];
export type ServiceCatalog = Database["public"]["Tables"]["services_catalog"]["Row"];
export type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
export type Source = Database["public"]["Tables"]["sources"]["Row"];
export type ParseRun = Database["public"]["Tables"]["parse_runs"]["Row"];
export type PriceOffer = Database["public"]["Tables"]["price_offers"]["Row"];
export type PriceHistory = Database["public"]["Tables"]["price_history"]["Row"];
export type UnmatchedQueue = Database["public"]["Tables"]["unmatched_queue"]["Row"];

/** A catalog row joined with its category (shape used by /poisk autocomplete). */
export type CatalogSuggestion = Pick<
  ServiceCatalog,
  "id" | "canonical_name" | "slug" | "category_id" | "synonyms" | "is_active"
> & {
  category: Pick<ServiceCategory, "name" | "icon"> | null;
};

-- MedServicePrice.kz — Phase 1 — Postgres extensions
-- Required by the architecture (§3): fuzzy name matching, semantic catalog
-- matching, and distance sorting for clinics.

-- Fuzzy name matching for the deterministic normalization stage (trigram).
create extension if not exists pg_trgm;

-- Semantic catalog matching (embeddings cosine search) for stage two.
create extension if not exists vector;

-- Distance sorting / geo for clinics (geography(point)).
create extension if not exists postgis;

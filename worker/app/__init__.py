"""MedServicePrice.kz parsing engine.

Phase 1: a runnable skeleton. It connects to Supabase and polls the parse_runs
job queue, but implements no fetch/parse/extract/normalize/write logic yet. Each
pipeline stage lives in its own subpackage (fetch, parse, extract, normalize,
write, robots) and is filled in during the "one source end-to-end" pass.
"""

__version__ = "0.1.0"

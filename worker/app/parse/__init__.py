"""Stage 2 — Parse to text/tables (NOT IMPLEMENTED in Phase 1).

Phase 2: pdfplumber / PyMuPDF for PDF, python-docx for DOCX, openpyxl / pandas for
Excel, readable text/tables for HTML. Output: clean text ready for LLM extraction.
"""


def parse(raw_document: dict) -> None:
    raise NotImplementedError("parse stage lands in the 'one source end-to-end' pass")

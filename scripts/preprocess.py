#!/usr/bin/env python3
"""
preprocess.py
─────────────
Step 1 of the CSV conversion pipeline.

Reads  : raw_product_export_data.csv  (multi-supplier, potentially misaligned)
Writes : scripts/intermediate.csv     (clean, normalised, ready for AI step)
         scripts/parse_errors.csv     (rows that could not be parsed)

Run from repo root:
    python scripts/preprocess.py
"""

import csv
import re
import sys
import os

# ── make sure we can import config from repo root regardless of cwd ──────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from config import (
    RAW_CSV, SUPPLIERS_CSV, BRANDS_CSV, INTERMEDIATE_CSV, ERROR_LOG,
    STOCK_LOW_MAX,
)

# ─────────────────────────────────────────────────────────────────────────────
# Load supplier registry
# ─────────────────────────────────────────────────────────────────────────────

def load_brands(path: str) -> list:
    """Return canonical brand names sorted longest-first for greedy word-boundary matching."""
    brands = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            b = row["brand"].strip()
            if b:
                brands.append(b)
    return sorted(brands, key=len, reverse=True)


def load_supplier_config(path: str) -> dict:
    """Return {supplier_name: {type, currency, eta, visibleCustomerTypes}}."""
    config = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            config[row["supplier_name"].strip()] = {
                "type":                 row["type"].strip(),
                "currency":             row["currency"].strip(),
                "eta":                  row["eta"].strip(),
                "visibleCustomerTypes": row["visibleCustomerTypes"].strip(),
            }
    return config

# ─────────────────────────────────────────────────────────────────────────────
# CSV parsing with misalignment recovery
# ─────────────────────────────────────────────────────────────────────────────

EXPECTED_HEADERS = ["Date", "Source", "Supplier", "Category", "Brand",
                    "Model", "Name", "Price", "Currency", "Stock", "MOQ", "Notes"]
KNOWN_CURRENCIES = {"USD", "AMD", "EUR", "RUB"}


def try_parse_row(raw_line: str) -> dict | None:
    """
    Parse a single raw CSV line into a dict keyed by EXPECTED_HEADERS.

    Strategy: anchor on the Currency field (always a known 3-letter code)
    scanning right-to-left, then reconstruct the Name field from whatever
    remains between the fixed left columns and the currency anchor.

    Returns None if the row cannot be reliably parsed.
    """
    # Fast path: try standard CSV parse first
    try:
        parts = next(csv.reader([raw_line]))
    except Exception:
        return None

    if len(parts) == len(EXPECTED_HEADERS):
        # Perfect alignment — zip directly
        return dict(zip(EXPECTED_HEADERS, parts))

    if len(parts) < len(EXPECTED_HEADERS):
        return None  # too few fields, unrecoverable

    # Misaligned (extra commas in Name). Find Currency anchor.
    # Fixed left columns: Date(0), Source(1), Supplier(2), Category(3), Brand(4), Model(5)
    # Fixed right columns: Price, Currency, Stock, MOQ, Notes  (5 columns from the right)
    # Name occupies everything between index 6 and the Currency anchor.

    # Search for Currency anchor from right side
    currency_idx = None
    for i in range(len(parts) - 1, 5, -1):
        if parts[i].strip().upper() in KNOWN_CURRENCIES:
            currency_idx = i
            break

    if currency_idx is None:
        return None  # can't find anchor

    # Right of currency: Stock, MOQ, Notes
    right = parts[currency_idx + 1:]
    if len(right) < 2:
        return None  # need at least Stock + MOQ

    stock_val  = right[0] if len(right) > 0 else ""
    moq_val    = right[1] if len(right) > 1 else ""
    notes_val  = right[2] if len(right) > 2 else ""

    # Price is just left of Currency
    price_val  = parts[currency_idx - 1]

    # Name: everything between index 6 and price_val index
    name_parts = parts[6 : currency_idx - 1]
    name_val   = ",".join(name_parts).strip()

    return {
        "Date":     parts[0],
        "Source":   parts[1],
        "Supplier": parts[2],
        "Category": parts[3],
        "Brand":    parts[4],
        "Model":    parts[5],
        "Name":     name_val,
        "Price":    price_val,
        "Currency": parts[currency_idx],
        "Stock":    stock_val,
        "MOQ":      moq_val,
        "Notes":    notes_val,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Field-level helpers
# ─────────────────────────────────────────────────────────────────────────────

def parse_moq(raw: str) -> int:
    raw = raw.strip().upper()
    if raw in ("NO", "", "N/A", "-"):
        return 0
    try:
        return max(0, int(float(raw)))
    except ValueError:
        return 0


def parse_stock_quantity(raw: str) -> int | None:
    try:
        return max(0, int(float(raw.strip())))
    except (ValueError, AttributeError):
        return None


def map_stock_status(quantity: int, supplier_type: str) -> str:
    """Map numeric stock to portal enum value."""
    if supplier_type == "local":
        return "in_stock"   # local suppliers always have stock available
    # international: use quantity thresholds
    if quantity >= 1 and quantity <= STOCK_LOW_MAX:
        return "low_stock"
    return "in_stock"       # quantity > STOCK_LOW_MAX


def extract_brand(brand_raw: str, name: str, known_brands: list) -> str:
    """
    Resolve brand name using a three-step priority:
    1. Brand column value matches a known canonical brand → return canonical casing.
    2. Scan the product name for a known brand (word-boundary, case-insensitive).
    3. Fallback: use Brand column as-is (even if not in list), or first token(s) from name.
    """
    brand_raw = brand_raw.strip()

    # Step 1 — Brand column is a recognised brand
    b_lower = brand_raw.lower()
    for kb in known_brands:
        if kb.lower() == b_lower:
            return kb

    # Step 2 — Scan name for a known brand (word-boundary match)
    name_lower = name.lower()
    for kb in known_brands:
        pattern = r"(?<!\w)" + re.escape(kb.lower()) + r"(?!\w)"
        if re.search(pattern, name_lower):
            return kb

    # Step 3 — Fallback
    if brand_raw:
        return brand_raw  # use Brand column verbatim even if unknown
    tokens = name.split()
    if tokens:
        first = tokens[0]
        if len(first) <= 3 and len(tokens) > 1 and tokens[1][0].isupper():
            return f"{first} {tokens[1]}"
        return first
    return ""


def is_separator_row(row: dict) -> bool:
    """Detect category-header rows mixed into data (Model=PN, Price=0)."""
    model = row.get("Model", "").strip().upper()
    try:
        price = float(row.get("Price", "0") or "0")
    except ValueError:
        price = 0.0
    return model == "PN" and price == 0.0


def is_zero_stock(row: dict) -> bool:
    qty = parse_stock_quantity(row.get("Stock", "0"))
    return qty is not None and qty == 0


# ─────────────────────────────────────────────────────────────────────────────
# Main processing
# ─────────────────────────────────────────────────────────────────────────────

INTERMEDIATE_HEADERS = [
    "supplier", "brand_raw", "model", "name_raw", "category_raw",
    "price_raw", "currency", "availableQuantity", "moq",
    "stock", "eta", "visibleCustomerTypes",
]

DEFAULT_SUPPLIER = {
    "type":                 "international",
    "currency":             "USD",
    "eta":                  "14-21 дней",
    "visibleCustomerTypes": "дилер;корпоративный;гос. учреждение",
}


def main():
    supplier_config = load_supplier_config(SUPPLIERS_CSV)
    print(f"Loaded {len(supplier_config)} supplier(s) from {SUPPLIERS_CSV}")
    known_brands = load_brands(BRANDS_CSV)
    print(f"Loaded {len(known_brands)} brand(s) from {BRANDS_CSV}")

    ok_rows    = []
    error_rows = []
    skipped    = 0
    total_raw  = 0

    with open(RAW_CSV, newline="", encoding="utf-8-sig") as f:
        lines = f.readlines()

    # First line is the header — skip it
    data_lines = lines[1:]
    total_raw  = len(data_lines)

    for lineno, line in enumerate(data_lines, start=2):
        line = line.rstrip("\n").rstrip("\r")
        if not line.strip():
            continue

        row = try_parse_row(line)
        if row is None:
            error_rows.append({"lineno": lineno, "raw": line, "reason": "parse_failed"})
            continue

        # ── Filter: separator rows ──
        if is_separator_row(row):
            skipped += 1
            continue

        # ── Filter: zero-stock products (user decision: exclude) ──
        if is_zero_stock(row):
            skipped += 1
            continue

        # ── Supplier lookup ──
        supplier_name = row.get("Supplier", "").strip()
        cfg = supplier_config.get(supplier_name)
        if cfg is None:
            print(f"  ⚠  Unknown supplier '{supplier_name}' on line {lineno} — using international defaults")
            cfg = DEFAULT_SUPPLIER.copy()

        # ── Field mapping ──
        quantity = parse_stock_quantity(row.get("Stock", "0")) or 0
        moq      = parse_moq(row.get("MOQ", "NO"))
        stock    = map_stock_status(quantity, cfg["type"])
        brand    = extract_brand(row.get("Brand", ""), row.get("Name", ""), known_brands)

        ok_rows.append({
            "supplier":             supplier_name,
            "brand_raw":            brand,
            "model":                row.get("Model", "").strip(),
            "name_raw":             row.get("Name", "").strip(),
            "category_raw":         row.get("Category", "").strip(),
            "price_raw":            row.get("Price", "0").strip(),
            "currency":             row.get("Currency", cfg["currency"]).strip().upper(),
            "availableQuantity":    quantity,
            "moq":                  moq,
            "stock":                stock,
            "eta":                  cfg["eta"],
            "visibleCustomerTypes": cfg["visibleCustomerTypes"],
        })

    # ── Write intermediate CSV ──
    with open(INTERMEDIATE_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=INTERMEDIATE_HEADERS)
        writer.writeheader()
        writer.writerows(ok_rows)

    # ── Write error log ──
    if error_rows:
        with open(ERROR_LOG, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=["lineno", "raw", "reason"])
            writer.writeheader()
            writer.writerows(error_rows)

    print(f"\n{'─'*50}")
    print(f"Raw lines processed : {total_raw}")
    print(f"Skipped (headers/zero-stock): {skipped}")
    print(f"Parse errors        : {len(error_rows)}  → {ERROR_LOG}")
    print(f"Output rows         : {len(ok_rows)}  → {INTERMEDIATE_CSV}")
    print(f"{'─'*50}")


if __name__ == "__main__":
    main()

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
import math
import re
import sys
import os

# ── make sure we can import config from repo root regardless of cwd ──────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from config import (
    RAW_CSV, SUPPLIERS_CSV, BRANDS_CSV, INTERMEDIATE_CSV, ERROR_LOG,
    STOCK_LOW_MAX,
    GLOBAL_BLOCKED_BRANDS,
    PHONIX_BLOCKED_BRANDS, PHONIX_BLOCKED_CATEGORIES,
    HUBX_BLOCKED_CATEGORIES,
    IMCOPEX_BLOCKED_BRANDS, IMCOPEX_BLOCKED_CATEGORIES,
    REFURB_KEYWORDS,
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
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            config[row["supplier_name"].strip()] = {
                "type":                 row["type"].strip(),
                "currency":             row["currency"].strip(),
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
    raw = raw.strip()
    # Handle range-prefixed values: "> 30" → 30, "< 10" → 10
    m = re.match(r'^[><]\s*(\d+)', raw)
    if m:
        return max(0, int(m.group(1)))
    try:
        return max(0, int(float(raw)))
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


# ── Offer-row SKU extraction ───────────────────────────────────────────────
# Used for suppliers (e.g. GHz Service S.r.l.) that pack qty + SKU +
# product name + price all into the Name field.
_OFFER_QTY_RE   = re.compile(r'^\d+\s*[Pp][Cc][Ss]?\s+')
_OFFER_PRICE_RE = re.compile(r'\s+\d+(?:[.,]\d+)?\s*(?:EUR|USD|GBP)\b.*$', re.IGNORECASE)
_OFFER_PN_RE    = re.compile(r'P/N\s*:?\s*([A-Z0-9][A-Z0-9\-\.\/]{3,})', re.IGNORECASE)
_PART_NUM_RE    = re.compile(r'^[A-Z0-9][A-Z0-9\-\.\/]{3,}$', re.IGNORECASE)
# Matches pure-numeric models including Excel scientific notation: "12345", "1.96E+11"
_NUMERIC_MODEL_RE = re.compile(r'^\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?$')

# ── ELKO Group offer-name patterns ────────────────────────────────────────
# Offer rows: Name is tab-separated "SKU\tProduct Name\tQty delivery_info"
# or "Long Product Name (SKU)\tSKU\tQty delivery_info"
# A token is treated as the SKU if it contains no spaces.
_ELKO_OFFER_SKU_RE = re.compile(r'^[A-Z0-9][A-Z0-9\-\.\/\+\#]{3,}$', re.IGNORECASE)

# ── Summit Sincerity Global LTD offer-name patterns ───────────────────────
_SUMMIT_AMD_BOX_RE  = re.compile(
    r'^AMD\s+Ryzen\s+(\S+)\s+(ENG|CN)\s+BOX$', re.IGNORECASE)
_SUMMIT_AMD_TRAY_RE = re.compile(
    r'^AMD\s+Ryzen\s+Tray\s+(\S+)$', re.IGNORECASE)
_SUMMIT_MOQ_RE      = re.compile(r'\bMOQ\s+(\d+)\s*pcs\b', re.IGNORECASE)
_SUMMIT_MOQ_STRIP   = re.compile(r'\s*Moq\s+\d+\s*pcs\b.*$', re.IGNORECASE)


def extract_sku_from_offer_name(name: str) -> str:
    """Extract manufacturer part number from an offer-style product name.

    Tries three strategies in order:
      1. Explicit P/N marker  — e.g. 'P/N : VCG507012TFXXPB1-O'
      2. First token after qty has digits — e.g. 'WDS100T2XHE', 'J8H61A', '82YU009XIX'
      3. Last alphanumeric token before price — fallback for 'KYOCERA ECOSYS MA5500IFX'
    Returns empty string if none match.
    """
    # 1. Explicit P/N marker — most reliable
    m = _OFFER_PN_RE.search(name)
    if m:
        return m.group(1).strip()

    # Strip leading quantity and trailing price for token analysis
    stripped = _OFFER_QTY_RE.sub('', name).strip()
    stripped = _OFFER_PRICE_RE.sub('', stripped).strip()
    if not stripped:
        return ""

    tokens = stripped.split()

    # 2. First token looks like a part number (contains at least one digit)
    if tokens:
        first = tokens[0]
        if re.search(r'\d', first) and _PART_NUM_RE.match(first):
            return first

    # 3. Last token that looks like a part number (brand-series-model format)
    for token in reversed(tokens):
        if re.search(r'\d', token) and _PART_NUM_RE.match(token):
            return token

    return ""


def clean_offer_name(name: str) -> str:
    """Strip leading quantity and trailing embedded price from offer-style names.

    '150Pcs J8H61A HP LASERJET M501DN 249.00 EUR'  →  'J8H61A HP LASERJET M501DN'
    '40PCS KYOCERA ECOSYS MA5500IFX 729.00 EUR'    →  'KYOCERA ECOSYS MA5500IFX'
    Returns original string unchanged if stripping leaves nothing.
    """
    cleaned = _OFFER_QTY_RE.sub('', name).strip()
    cleaned = _OFFER_PRICE_RE.sub('', cleaned).strip()
    return cleaned if cleaned else name


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
    "stock", "visibleCustomerTypes",
]

DEFAULT_SUPPLIER = {
    "type":                 "international",
    "currency":             "USD",
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

        # ── Global brand blocklist ────────────────────────────────────────────
        if row.get("Brand", "").strip().upper() in GLOBAL_BLOCKED_BRANDS:
            skipped += 1
            continue

        # ── Phonix: skip non-IT products (blocked brand, category, or refurb) ──
        if row.get("Supplier", "").strip() == "Phonix":
            if row.get("Category", "").strip().upper() in PHONIX_BLOCKED_CATEGORIES:
                skipped += 1
                continue
            if row.get("Brand", "").strip().upper() in PHONIX_BLOCKED_BRANDS:
                skipped += 1
                continue
            _phonix_text = (row.get("Name", "") + " " + row.get("Model", "")).upper()
            if any(kw in _phonix_text for kw in REFURB_KEYWORDS):
                skipped += 1
                continue

        # ── HubX: skip empty-category rows and refurb products ───────────────
        elif row.get("Supplier", "").strip() == "HubX":
            if row.get("Category", "").strip() in HUBX_BLOCKED_CATEGORIES:
                skipped += 1
                continue
            _hubx_text = (row.get("Name", "") + " " + row.get("Model", "")).upper()
            if any(kw in _hubx_text for kw in REFURB_KEYWORDS):
                skipped += 1
                continue

        # ── BitSet: only keep rows where Notes contains a manufacturer SKU ──
        elif row.get("Supplier", "").strip() == "BitSet":
            if "SKU: " not in row.get("Notes", ""):
                skipped += 1
                continue

        # ── Imcopex: skip non-IT categories and non-IT brands ────────────────
        elif row.get("Supplier", "").strip() == "Imcopex":
            if row.get("Category", "").strip() in IMCOPEX_BLOCKED_CATEGORIES:
                skipped += 1
                continue
            if row.get("Brand", "").strip() in IMCOPEX_BLOCKED_BRANDS:
                skipped += 1
                continue

        # ── ELKO Group: skip refurb/preowned products (GRADE A/A+, REFURB.) ──
        elif row.get("Supplier", "").strip() == "ELKO Group":
            _elko_text = (row.get("Name", "") + " " + row.get("Model", "")).upper()
            if any(kw in _elko_text for kw in REFURB_KEYWORDS):
                skipped += 1
                continue

        # ── Supplier lookup ──
        supplier_name = row.get("Supplier", "").strip()
        cfg = supplier_config.get(supplier_name)
        if cfg is None:
            print(f"  ⚠  Unknown supplier '{supplier_name}' on line {lineno} — using international defaults")
            cfg = DEFAULT_SUPPLIER.copy()

        # ── Field mapping ──
        qty_parsed = parse_stock_quantity(row.get("Stock", ""))
        if qty_parsed is None:
            # Supplier provided no stock info — estimate as ceil(5000 / price)
            try:
                price_val = float(row.get("Price", "0").strip())
                qty_parsed = math.ceil(5000.0 / price_val) if price_val > 0 else 0
            except (ValueError, TypeError):
                qty_parsed = 0
        quantity = qty_parsed
        moq      = parse_moq(row.get("MOQ", "NO"))
        stock    = map_stock_status(quantity, cfg["type"])
        brand    = extract_brand(row.get("Brand", ""), row.get("Name", ""), known_brands)

        model    = row.get("Model", "").strip()
        name_raw = row.get("Name",  "").strip()

        # ── Supplier-specific offer-name parsing ──────────────────────────────
        # GHz Service S.r.l. packs qty + SKU + product name + EUR price into
        # the Name field with no Model column.  Extract the SKU so it becomes
        # the cache key, and clean the name so Gemini gets tidy input.
        # Add elif blocks here for other offer-format suppliers as needed.
        if supplier_name == "GHz Service S.r.l.":
            if not model:
                model = extract_sku_from_offer_name(name_raw)
            name_raw = clean_offer_name(name_raw)

        elif supplier_name == "Summit Sincerity Global LTD":
            # Extract MOQ if embedded in name ("Moq 200pcs" / "MOQ 10pcs")
            moq_m = _SUMMIT_MOQ_RE.search(name_raw)
            if moq_m and not moq:
                moq = moq_m.group(1)

            if not model:
                # ── Crucial SSD: "CT4000P310SSD8 P310 PCIe Gen4 NVMe 2280 M.2 Moq 200pcs"
                ct_m = re.match(r'^(CT[A-Z0-9]+)', name_raw, re.IGNORECASE)
                if ct_m:
                    model    = ct_m.group(1)
                    name_raw = _SUMMIT_MOQ_STRIP.sub('', name_raw).strip()

                # ── AMD CPU boxed: "AMD Ryzen 9850x3d ENG BOX" / "AMD Ryzen 9850x3d CN BOX"
                #    ENG BOX and CN BOX have different retail SKUs → separate cache entries
                elif _SUMMIT_AMD_BOX_RE.match(name_raw):
                    m2       = _SUMMIT_AMD_BOX_RE.match(name_raw)
                    cpu_id   = m2.group(1).upper()
                    box_type = m2.group(2).upper()
                    model    = f"{cpu_id} {box_type} BOX"
                    name_raw = f"AMD Ryzen {cpu_id} {box_type} BOX"

                # ── AMD CPU tray: "AMD Ryzen Tray 9950X3D"
                #    Tray SKU differs from boxed → separate cache entry with TRAY suffix
                elif _SUMMIT_AMD_TRAY_RE.match(name_raw):
                    cpu_id   = _SUMMIT_AMD_TRAY_RE.match(name_raw).group(1).upper()
                    model    = f"{cpu_id} TRAY"
                    name_raw = f"AMD Ryzen {cpu_id} Tray"

                # ── AMD GPU offer: "AMD GPU Radeon Offer : (...MOQ 10pcs) Powercolor RX9070XT 16G-A -"
                elif name_raw.upper().startswith("AMD GPU RADEON OFFER"):
                    gpu_m = re.search(r'\)\s*(.+?)\s*-\s*$', name_raw)
                    if gpu_m:
                        gpu_part = gpu_m.group(1).strip()
                        name_raw = gpu_part
                        parts    = gpu_part.split(None, 1)
                        model    = parts[1].strip() if len(parts) > 1 else gpu_part

                # ── Intel CPU boxed/tray: "14900KF", "14700F tray", "Ultra 245 Tray"
                else:
                    model    = re.sub(r'\s+tray$', '', name_raw, flags=re.IGNORECASE).strip()
                    name_raw = model

        elif supplier_name == "Siewert & Kau":
            # Offer rows pack all data into Name as tab-separated fields:
            #   "CT1000P310SSD8\tSSD Crucial P310 M.2 1TB PCIe Gen4x4 2280\t100"
            # Price List rows already have Model/Name/Category populated — leave untouched.
            if row.get("Source", "").strip() == "Offer" and not model:
                parts = name_raw.split("\t")
                if len(parts) >= 2:
                    model    = parts[0].strip()
                    name_raw = parts[1].strip()
                    if len(parts) >= 3 and not moq:
                        moq = parts[2].strip()

        elif supplier_name == "BitSet":
            # Replace internal BitSet article number with the real manufacturer SKU
            # from Notes: "SKU: G27C4 E3 | Features: ..."
            m = re.search(r'SKU:\s*([^|]+)', row.get("Notes", ""))
            if m:
                model = m.group(1).strip()

        elif supplier_name == "ELKO Group":
            # Offer rows: Name is tab-separated "p1\tp2\tqty_delivery"
            # Pattern A: "1102Z43NL0\tKyocera ECOSYS MA4000CIX\t36 1-3 weeks"
            #   → p1 is SKU (no spaces, matches part-num pattern)
            # Pattern B: "HP LaserJet Pro M501dn (J8H61A#B19)\tJ8H61A#B19\t100 3-4 weeks"
            #   → p1 is product name, p2 is SKU
            # Price List rows already have Model populated — leave untouched.
            if row.get("Source", "").strip() == "Offer":
                parts = name_raw.split("\t")
                if len(parts) >= 2:
                    p1           = parts[0].strip()
                    p2           = parts[1].strip()
                    qty_delivery = parts[2].strip() if len(parts) >= 3 else ""

                    if _ELKO_OFFER_SKU_RE.match(p1):
                        # Pattern A: SKU first
                        model    = p1
                        name_raw = p2
                    else:
                        # Pattern B: name first, SKU second; strip "(SKU)" from name
                        model    = p2
                        name_raw = re.sub(
                            r'\s*\([A-Z0-9#][^)]*\)\s*$', '', p1,
                            flags=re.IGNORECASE,
                        ).strip() or p1

                    # Extract stock qty from "N delivery_info" (e.g. "36 1-3 weeks")
                    if qty_delivery:
                        qty_m = re.match(r'^(\d+)', qty_delivery)
                        if qty_m:
                            quantity = int(qty_m.group(1))
                            stock    = map_stock_status(quantity, cfg["type"])

        # ── Numeric-only model: prefix with brand to avoid cache collisions ──────
        # Also handles Excel scientific notation exports: "1.96E+11" → "microsoft-196000000000"
        if model and _NUMERIC_MODEL_RE.match(model.strip()) and brand:
            try:
                numeric_str = str(int(float(model.strip())))
            except (ValueError, OverflowError):
                numeric_str = model.strip()
            model = f"{brand.upper()}-{numeric_str}"

        ok_rows.append({
            "supplier":             supplier_name,
            "brand_raw":            brand,
            "model":                model,
            "name_raw":             name_raw,
            "category_raw":         row.get("Category", "").strip(),
            "price_raw":            row.get("Price", "0").strip(),
            "currency":             row.get("Currency", cfg["currency"]).strip().upper(),
            "availableQuantity":    quantity,
            "moq":                  moq,
            "stock":                stock,
            "visibleCustomerTypes": cfg["visibleCustomerTypes"],
        })

    # ── Write intermediate CSV ──
    with open(INTERMEDIATE_CSV, "w", newline="", encoding="utf-8-sig") as f:
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

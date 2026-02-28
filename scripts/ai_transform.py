#!/usr/bin/env python3
"""
ai_transform.py
───────────────
Step 2 of the CSV conversion pipeline.

Reads  : scripts/intermediate.csv    (output of preprocess.py)
Writes : scripts/output_import.csv   (ready to import into b2b.chip.am)

Uses Gemini API to normalise product names, clean SKUs and assign categories.
Fetches live USD→AMD exchange rate from Central Bank of Armenia.

Run from repo root:
    python scripts/ai_transform.py           # full run
    python scripts/ai_transform.py --test    # first 10 rows only
"""

import csv
import json
import math
import re
import sys
import time
import argparse
import requests
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from config import (
    GEMINI_API_KEY, GEMINI_MODEL, AI_BATCH_SIZE,
    CB_RATE_URL,
    INTL_SHIPPING_RATE, INTL_VAT_RATE, INTL_CUSTOMS_RATE, INTL_MARGIN,
    LOCAL_USD_MARGIN, LOCAL_AMD_MARGIN,
    INTERMEDIATE_CSV, OUTPUT_CSV, CATEGORIES,
    SUPPLIERS_CSV,
)

import google.generativeai as genai

# ─────────────────────────────────────────────────────────────────────────────
# Exchange rate
# ─────────────────────────────────────────────────────────────────────────────

def fetch_cb_rate() -> float:
    """Fetch live USD→AMD rate from Central Bank of Armenia."""
    resp = requests.get(CB_RATE_URL, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    rate = float(data["USD"])
    print(f"Central Bank rate: 1 USD = {rate} AMD")
    return rate


# ─────────────────────────────────────────────────────────────────────────────
# Price calculation
# ─────────────────────────────────────────────────────────────────────────────

def load_supplier_types(path: str) -> dict:
    """Return {supplier_name: type} from suppliers.csv."""
    types = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            types[row["supplier_name"].strip()] = row["type"].strip()
    return types


def calculate_price_amd(price_raw: str, currency: str, supplier_type: str,
                         cb_rate: float) -> int:
    """
    Convert raw supplier price to final AMD integer.

    international (USD):
        cost_usd = price × (1+SHIPPING) × (1+VAT) × (1+CUSTOMS)
        final    = cost_usd × cb_rate × (1+MARGIN)

    local USD:
        final = price_usd × cb_rate × (1+MARGIN)

    local AMD:
        final = price_amd × (1+MARGIN)
    """
    try:
        price = float(price_raw)
    except (ValueError, TypeError):
        return 0

    if price <= 0:
        return 0

    currency = currency.upper()

    if supplier_type == "international":
        # All international suppliers currently priced in USD
        cost_usd = price * (1 + INTL_SHIPPING_RATE) * (1 + INTL_VAT_RATE) * (1 + INTL_CUSTOMS_RATE)
        final    = cost_usd * cb_rate * (1 + INTL_MARGIN)

    elif supplier_type == "local" and currency == "USD":
        final = price * cb_rate * (1 + LOCAL_USD_MARGIN)

    elif supplier_type == "local" and currency == "AMD":
        final = price * (1 + LOCAL_AMD_MARGIN)

    else:
        # Fallback: treat as local USD
        final = price * cb_rate * (1 + LOCAL_USD_MARGIN)

    return max(0, int(round(final)))


# ─────────────────────────────────────────────────────────────────────────────
# Gemini API
# ─────────────────────────────────────────────────────────────────────────────

genai.configure(api_key=GEMINI_API_KEY)
_model = genai.GenerativeModel(GEMINI_MODEL)

SYSTEM_PROMPT = f"""You are a product data normaliser for an IT products B2B portal.
You will receive a JSON array of raw product records and must return a JSON array
(same length, same order) where each object has exactly these three fields:

  "name"     — Clean, concise English product name. Max 80 chars.
               Format: [Brand] [Series/Model hint] [Product type] [Key specs]
               Example: "Samsung 870 EVO SSD 500GB 2.5\\" SATA III"

  "sku"      — Cleaned part/model number. Remove region suffixes (/EU, /AP, /RU etc).
               Keep the core part number only.

  "category" — Exactly one value from this list (copy exactly, including Cyrillic):
{json.dumps(CATEGORIES, ensure_ascii=False, indent=14)}

Return ONLY the JSON array. No markdown, no explanation, no extra text.
If you cannot determine a field, use an empty string for name/sku or
"Аксессуары" as a safe fallback for category.
"""


def call_gemini(batch: list[dict]) -> list[dict]:
    """Send one batch to Gemini and return parsed JSON list."""
    payload = json.dumps(batch, ensure_ascii=False)

    for attempt in range(3):
        try:
            response = _model.generate_content(
                [SYSTEM_PROMPT, payload],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )
            text = response.text.strip()
            # Strip markdown code fences if present
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            result = json.loads(text)
            if isinstance(result, list) and len(result) == len(batch):
                return result
            print(f"  ⚠  Gemini returned {len(result)} items for {len(batch)} — retrying")
        except Exception as e:
            print(f"  ⚠  Gemini error (attempt {attempt+1}/3): {e}")
            time.sleep(2 ** attempt)

    # Fallback: return empty dicts so we don't lose the row
    return [{"name": r.get("name_raw", ""), "sku": r.get("model", ""), "category": "Аксессуары"}
            for r in batch]


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

OUTPUT_HEADERS = [
    "id", "name", "sku", "price", "stock", "eta", "description",
    "availableQuantity", "moq", "brand", "category", "visibleCustomerTypes",
]


def build_output_row(inter: dict, ai: dict, price_amd: int) -> dict:
    return {
        "id":                   "",
        "name":                 ai.get("name", inter["name_raw"]).strip(),
        "sku":                  ai.get("sku",  inter["model"]).strip(),
        "price":                price_amd,
        "stock":                inter["stock"],
        "eta":                  inter["eta"],
        "description":          "",
        "availableQuantity":    inter["availableQuantity"],
        "moq":                  inter["moq"],
        "brand":                inter["brand_raw"],
        "category":             ai.get("category", "Аксессуары"),
        "visibleCustomerTypes": inter["visibleCustomerTypes"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true",
                        help="Process only the first 10 rows (for inspection)")
    args = parser.parse_args()

    # Load intermediate rows
    with open(INTERMEDIATE_CSV, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if args.test:
        rows = rows[:10]
        print(f"🔬  TEST MODE — processing {len(rows)} rows only")

    print(f"Loaded {len(rows)} rows from {INTERMEDIATE_CSV}")

    # Live exchange rate
    cb_rate = fetch_cb_rate()

    # Supplier type map
    supplier_types = load_supplier_types(SUPPLIERS_CSV)

    # Process in batches
    output_rows = []
    n_batches = math.ceil(len(rows) / AI_BATCH_SIZE)

    for batch_idx in range(n_batches):
        batch_rows = rows[batch_idx * AI_BATCH_SIZE : (batch_idx + 1) * AI_BATCH_SIZE]

        # Build AI payload (only what Gemini needs)
        ai_payload = [
            {
                "brand":        r["brand_raw"],
                "model":        r["model"],
                "name_raw":     r["name_raw"],
                "category_raw": r["category_raw"],
            }
            for r in batch_rows
        ]

        print(f"  Batch {batch_idx + 1}/{n_batches} ({len(batch_rows)} products)...", end=" ", flush=True)
        ai_results = call_gemini(ai_payload)
        print("✓")

        for inter, ai in zip(batch_rows, ai_results):
            supplier_type = supplier_types.get(inter["supplier"], "international")
            price_amd = calculate_price_amd(
                inter["price_raw"], inter["currency"], supplier_type, cb_rate
            )
            output_rows.append(build_output_row(inter, ai, price_amd))

        # Small delay to avoid rate-limiting
        if batch_idx < n_batches - 1:
            time.sleep(0.5)

    # Write output
    out_path = OUTPUT_CSV if not args.test else OUTPUT_CSV.replace(".csv", "_test.csv")
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_HEADERS)
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"\n{'─'*50}")
    print(f"Products processed  : {len(output_rows)}")
    print(f"Output              : {out_path}")
    print(f"{'─'*50}")
    print("\nNext step: review output_import.csv then import into b2b.chip.am portal.")


if __name__ == "__main__":
    main()

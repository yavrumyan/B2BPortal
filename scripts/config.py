# =============================================================================
# config.py — Centralised settings for the CSV conversion pipeline
# Edit the TODO values before running the scripts.
# =============================================================================

import os
import pathlib


def _load_dotenv(path):
    """Minimal .env loader — no extra dependencies required."""
    p = pathlib.Path(path)
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())


_load_dotenv(pathlib.Path(__file__).parent / ".env")

# ── Price formula rates ───────────────────────────────────────────────────────
#
# INTERNATIONAL suppliers (foreign, USD pricing):
#   final_amd = price_usd × (1+SHIPPING) × (1+VAT) × (1+CUSTOMS) × cb_rate × (1+MARGIN)
#
INTL_SHIPPING_RATE = 0.07   # TODO: avg freight/logistics as % of product cost
INTL_VAT_RATE      = 0.20   # Armenia import VAT (20%)
INTL_CUSTOMS_RATE  = 0.05   # TODO: avg customs duty (varies by HS code — use category avg)
INTL_MARGIN        = 0.20   # TODO: dealer selling margin

# LOCAL suppliers, USD pricing (e.g. DG):
#   final_amd = price_usd × cb_rate × (1+MARGIN)
#
LOCAL_USD_MARGIN   = 0.15   # TODO: adjust margin

# LOCAL suppliers, AMD pricing (e.g. Compstyle LLC):
#   final_amd = price_amd × (1+MARGIN)
#
LOCAL_AMD_MARGIN   = 0.15   # TODO: adjust margin

# ── Central Bank of Armenia live rate ─────────────────────────────────────────
# GET https://cb.am/latest.json.php  →  {"USD": "377", "EUR": "...", ...}
# rate = float(response_json["USD"])  — AMD per 1 USD
#
CB_RATE_URL = "https://cb.am/latest.json.php"

# ── Gemini API ─────────────────────────────────────────────────────────────────
# Key is loaded from scripts/.env (gitignored) — never hardcode here.
# Set GEMINI_API_KEY=<your key> in scripts/.env before running.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY not set.\n"
        "Add it to scripts/.env:  GEMINI_API_KEY=<your key>\n"
        "Get a key at: https://aistudio.google.com/app/apikey"
    )
GEMINI_MODEL   = "gemini-2.5-flash-lite"
AI_BATCH_SIZE  = 50          # products per API call

# ── File paths (relative to repo root) ────────────────────────────────────────
RAW_CSV          = "raw_product_export_data.csv"
SUPPLIERS_CSV    = "scripts/suppliers.csv"
BRANDS_CSV       = "scripts/brands.csv"
INTERMEDIATE_CSV = "scripts/intermediate.csv"
OUTPUT_CSV       = "scripts/output_import.csv"
ERROR_LOG        = "scripts/parse_errors.csv"

# ── Stock thresholds (international suppliers only) ───────────────────────────
# Local suppliers are always set to "in_stock" regardless of quantity.
STOCK_LOW_MAX    = 9    # Stock 1–9  → "low_stock"
                        # Stock ≥ 10 → "in_stock"

# ── Target category list (must match portal exactly) ─────────────────────────
CATEGORIES = [
    "Ноутбуки",
    "Компьютеры",
    "Серверы",
    "Телефоны",
    "Планшеты",
    "Компоненты ПК/Серверов",
    "Мониторы",
    "Принтеры/Сканеры",
    "Проекторы и принадлежности",
    "ИБП (UPS)",
    "Аксессуары",
    "Хранение данных (СХД)",
    "Программное обеспечение",
    "Сетевое оборудование",
    "Кабели/Переходники",
    "Смарт-Гаджеты",
    "ТВ/Аудио/Фото/Видео техника",
    "Торговое оборудование",
    "Системы безопасности",
]

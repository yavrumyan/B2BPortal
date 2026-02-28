# =============================================================================
# config.py — Centralised settings for the CSV conversion pipeline
# Edit the TODO values before running the scripts.
# =============================================================================

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
GEMINI_API_KEY = "AIzaSyAtOxQEcdERwI6RWwrQFZGKJKba89ZhxEs"
GEMINI_MODEL   = "gemini-2.5-flash-lite"
AI_BATCH_SIZE  = 50          # products per API call

# ── File paths (relative to repo root) ────────────────────────────────────────
RAW_CSV          = "raw_product_export_data.csv"
SUPPLIERS_CSV    = "scripts/suppliers.csv"
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

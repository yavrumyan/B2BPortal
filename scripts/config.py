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
# INTERNATIONAL suppliers (USD pricing):
#   DP_USD  = [P + F + CD + CBF] × (1 + VAT_RATE + BTF_RATE) × (1 + Margin%)
#   final_amd = DP_USD × cb_rate  →  rounded UP to nearest 50 AMD
#
#   P   = supplier price (USD)
#   F   = freight: Air → weight_kg × rate_kg;  Ground/Sea → volume_cbm × rate_cbm
#   CD  = customs duty: P × duty%  (when region has customs AND product duty > 0)
#   CBF = customs broker fee: (P + F + CD) × INTL_CBF_RATE  (when region has customs)
#
INTL_VAT_RATE = 0.20    # Armenia import VAT
INTL_BTF_RATE = 0.005   # Bank transfer fee
INTL_CBF_RATE = 0.01    # Customs broker fee

# Region freight rates and customs applicability.
# Each mode entry: (rate_per_kg_or_None, rate_per_cbm_or_None, customs_applicable)
INTL_REGIONS = {
    "Russia":        {"air":   (4,    None, False), "ground": (None,  70, False)},
    "Europe":        {"air":   (15,   None, True),  "ground": (None, 150, True)},
    "Great Britain": {"air":   (15,   None, True),  "ground": (None, 200, True)},
    "UAE":           {"air":   (12.5, None, True),  "ground": (None, 200, True)},
    "America":       {"air":   (8,    None, True),  "sea":    (None, 200, True)},
    "China":         {"air":   (8,    None, True),  "sea":    (None, 200, True)},
    "India":         {"air":   (10,   None, True),  "sea":    (None, 200, True)},
}

# Product specs from international_suppliers_rates.xlsx — Assumptions sheet.
# Each entry: (weight_kg, volume_cbm, customs_duty_rate, preferred_ship, margin)
INTL_PRODUCT_SPECS = {
    "Laptops":                   (3,     0.015,  0,    "air",    0.20),
    "All-In-Ones":               (10,    0.08,   0,    "ground", 0.20),
    "Desktops":                  (12,    0.09,   0,    "ground", 0.20),
    "Mini PCs":                  (1.5,   0.005,  0,    "air",    0.20),
    "Servers":                   (18,    0.12,   0,    "ground", 0.25),
    "Smartphones":               (0.4,   0.001,  0.05, "air",    0.15),
    "Tablets":                   (0.8,   0.002,  0.05, "air",    0.20),
    "PC Case":                   (8,     0.08,   0,    "ground", 0.15),
    "PC PSU":                    (2.5,   0.008,  0,    "ground", 0.15),
    "Mainboards":                (1.5,   0.007,  0,    "ground", 0.15),
    "CPU":                       (0.05,  0.0002, 0,    "air",    0.08),
    "Coolers for CPU":           (1.2,   0.006,  0,    "ground", 0.0),
    "RAM":                       (0.1,   0.0002, 0,    "air",    0.10),
    "SSD":                       (0.1,   0.0003, 0,    "air",    0.10),
    "HDD":                       (0.6,   0.001,  0,    "air",    0.12),
    "Video Cards":               (2,     0.012,  0,    "air",    0.15),
    "Monitors":                  (7,     0.06,   0,    "ground", 0.15),
    "TVs":                       (15,    0.15,   0.05, "ground", 0.15),
    "Printers":                  (12,    0.1,    0,    "ground", 0.20),
    "Scanners":                  (3,     0.02,   0,    "ground", 0.20),
    "Projectors":                (4,     0.03,   0.05, "ground", 0.20),
    "Projector Screens":         (10,    0.04,   0.05, "ground", 0.15),
    "Monitor Mounting":          (3.5,   0.01,   0.05, "ground", 0.20),
    "Projector Mounting":        (1.5,   0.005,  0.05, "ground", 0.20),
    "UPS":                       (10,    0.025,  0.05, "ground", 0.20),
    "Battery for UPS":           (2.5,   0.002,  0.05, "ground", 0.20),
    "Keyboards":                 (1,     0.004,  0,    "ground", 0.15),
    "Mice":                      (0.3,   0.001,  0,    "ground", 0.15),
    "Speakers":                  (2.5,   0.015,  0.05, "ground", 0.15),
    "Headsets":                  (0.6,   0.005,  0,    "ground", 0.15),
    "Webcams":                   (0.2,   0.001,  0.05, "air",    0.15),
    "Gamepads":                  (0.4,   0.002,  0,    "ground", 0.15),
    "External HDD/SSD":          (0.3,   0.001,  0,    "air",    0.12),
    "Flash Drives/Memory Cards": (0.05,  0.0001, 0,    "air",    0.15),
    "Routers":                   (1,     0.006,  0,    "ground", 0.15),
    "Switches":                  (3.5,   0.015,  0,    "ground", 0.15),
    "Network Cards":             (0.2,   0.001,  0,    "ground", 0.15),
    "Network Cables":            (12,    0.032,  0,    "ground", 0.15),
    "Cables":                    (0.1,   0.0005, 0,    "ground", 0.20),
    "Adapters":                  (0.1,   0.001,  0,    "ground", 0.20),
    "Smart Gadgets":             (0.3,   0.001,  0.05, "air",    0.15),
    "Photo Cameras":             (1.5,   0.008,  0.05, "air",    0.15),
    "Video Cameras":             (1.5,   0.006,  0.05, "air",    0.15),
    "Drones":                    (2.5,   0.015,  0.05, "air",    0.25),
    "POS Systems":               (6,     0.04,   0,    "ground", 0.15),
    "Barcode Scanners":          (0.5,   0.002,  0,    "ground", 0.15),
    "Label/Barcode Printers":    (2.5,   0.015,  0,    "ground", 0.15),
    "Cash Drawers":              (7,     0.035,  0,    "ground", 0.15),
    "Surveillance Cameras":      (0.6,   0.003,  0.05, "ground", 0.15),
    "Default":                   (1.0,   0.005,  0,    "air",    0.15),
}

# Supplier → origin region mapping.
# Add a new entry here whenever a new international supplier is onboarded.
SUPPLIER_REGIONS = {
    "Proks SIA": "Europe",
}
SUPPLIER_REGIONS_DEFAULT = "Europe"  # fallback for unmapped international suppliers

# Gemini category → Excel product type (used for freight/margin lookup).
# Multi-value categories are further refined by detect_product_type() in ai_transform.py.
CATEGORY_TO_PRODUCT_TYPE = {
    "Ноутбуки":                    "Laptops",
    "Компьютеры":                  "Desktops",
    "Серверы":                     "Servers",
    "Телефоны":                    "Smartphones",
    "Планшеты":                    "Tablets",
    "Компоненты ПК/Серверов":      "RAM",           # overridden by keyword scan
    "Мониторы":                    "Monitors",
    "Принтеры/Сканеры":            "Printers",      # overridden by keyword scan
    "Проекторы и принадлежности":  "Projectors",    # overridden by keyword scan
    "ИБП (UPS)":                   "UPS",
    "Аксессуары":                  "Keyboards",     # overridden by keyword scan
    "Хранение данных (СХД)":       "External HDD/SSD",
    "Программное обеспечение":     "Default",
    "Сетевое оборудование":        "Routers",       # overridden by keyword scan
    "Кабели/Переходники":          "Cables",        # overridden by keyword scan
    "Смарт-Гаджеты":               "Smart Gadgets",
    "ТВ/Аудио/Фото/Видео техника": "TVs",           # overridden by keyword scan
    "Торговое оборудование":       "POS Systems",   # overridden by keyword scan
    "Системы безопасности":        "Surveillance Cameras",
    "":                            "Default",
}

# LOCAL suppliers, USD pricing (e.g. DG):
#   final_amd = price_usd × cb_rate × (1 + LOCAL_USD_MARGIN)
#
LOCAL_USD_MARGIN = 0.05

# LOCAL suppliers, AMD pricing (e.g. Compstyle LLC):
#   final_amd = price_amd × (1 + LOCAL_AMD_MARGIN)
#
LOCAL_AMD_MARGIN = 0.05

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

# ── File paths (absolute, resolved relative to this file's location) ──────────
# Scripts can be run from any working directory (repo root or scripts/).
_SCRIPTS_DIR = pathlib.Path(__file__).parent
_ROOT_DIR    = _SCRIPTS_DIR.parent

RAW_CSV            = str(_ROOT_DIR    / "raw_product_export_data.csv")
SUPPLIERS_CSV      = str(_SCRIPTS_DIR / "suppliers.csv")
BRANDS_CSV         = str(_SCRIPTS_DIR / "brands.csv")
DELIVERY_TIMES_CSV = str(_SCRIPTS_DIR / "delivery_times.csv")
INTERMEDIATE_CSV   = str(_SCRIPTS_DIR / "intermediate.csv")
OUTPUT_CSV         = str(_SCRIPTS_DIR / "output_import.csv")
ERROR_LOG          = str(_SCRIPTS_DIR / "parse_errors.csv")

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

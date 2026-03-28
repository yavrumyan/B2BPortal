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
    # (weight_kg, volume_cbm, customs_duty_rate, preferred_ship_mode, margin)
    # Values from international_suppliers_rates.xlsx — Assumptions sheet
    "Laptops":                         (3.07,  0.00858,  0,    "air",    0.20),
    "All-In-Ones":                     (12.35, 0.1001,   0,    "ground", 0.20),
    "Desktops":                        (10.8,  0.0675,   0,    "ground", 0.20),
    "Mini PCs":                        (1.88,  0.0075,   0,    "air",    0.20),
    "Servers":                         (27,    0.165,    0,    "ground", 0.25),
    "Smartphones":                     (0.51,  0.00113,  0.05, "air",    0.15),
    "Tablets":                         (0.94,  0.00294,  0.05, "air",    0.20),
    "PC Case":                         (10.6,  0.09275,  0,    "ground", 0.15),
    "PC PSU":                          (2.94,  0.01225,  0,    "ground", 0.15),
    "Mainboards":                      (1.41,  0.00705,  0,    "ground", 0.15),
    "CPU":                             (0.28,  0.00088,  0,    "air",    0.08),
    "Coolers for CPU":                 (1.3,   0.0065,   0,    "ground", 0.15),
    "RAM":                             (0.12,  0.00057,  0,    "air",    0.10),
    "SSD":                             (0.12,  0.00045,  0,    "air",    0.10),
    "HDD":                             (0.64,  0.00115,  0,    "air",    0.12),
    "Video Cards":                     (2.3,   0.01275,  0,    "air",    0.15),
    "Monitors":                        (8.29,  0.051,    0,    "ground", 0.15),
    "TVs":                             (24.23, 0.1995,   0.05, "ground", 0.15),
    "Printers":                        (13.5,  0.0975,   0,    "ground", 0.20),
    "Scanners":                        (5.85,  0.0364,   0,    "ground", 0.20),
    "Projectors":                      (5.2,   0.026,    0.05, "ground", 0.20),
    "Projector Screens":               (17.4,  0.174,    0.05, "ground", 0.15),
    "Monitor Mounting":                (3.9,   0.0156,   0.05, "ground", 0.20),
    "Projector Mounting":              (2.75,  0.0125,   0.05, "ground", 0.20),
    "UPS":                             (19.6,  0.049,    0.05, "ground", 0.20),
    "Battery for UPS":                 (7.02,  0.0153,   0.05, "ground", 0.20),
    "Keyboards":                       (0.94,  0.0047,   0,    "ground", 0.15),
    "Mice":                            (0.26,  0.00141,  0,    "ground", 0.15),
    "Speakers":                        (6.3,   0.042,    0.05, "ground", 0.15),
    "Headsets":                        (0.54,  0.0036,   0,    "ground", 0.15),
    "Webcams":                         (0.3,   0.00118,  0.05, "air",    0.15),
    "Gamepads":                        (0.42,  0.00177,  0,    "ground", 0.15),
    "External HDD/SSD":                (0.53,  0.00177,  0,    "air",    0.12),
    "Flash Drives/Memory Cards":       (0.06,  0.00023,  0,    "air",    0.15),
    "Routers":                         (1.17,  0.0065,   0,    "ground", 0.15),
    "Switches":                        (2.97,  0.0162,   0,    "ground", 0.15),
    "Network Cards":                   (0.24,  0.00118,  0,    "ground", 0.15),
    "Network Cables":                  (0.57,  0.00375,  0,    "ground", 0.15),
    "Cables":                          (0.38,  0.0025,   0,    "ground", 0.20),
    "Adapters":                        (0.23,  0.00123,  0,    "ground", 0.20),
    "Smart Gadgets":                   (1.2,   0.00675,  0.05, "air",    0.15),
    "Photo Cameras":                   (1.41,  0.00765,  0.05, "air",    0.15),
    "Video Cameras":                   (1.08,  0.0081,   0.05, "air",    0.15),
    "Drones":                          (2.32,  0.02175,  0.05, "air",    0.25),
    "POS Systems":                     (8.4,   0.056,    0,    "ground", 0.15),
    "Barcode Scanners":                (0.54,  0.0036,   0,    "ground", 0.15),
    "Label/Barcode Printers":          (3.51,  0.0243,   0,    "ground", 0.15),
    "Cash Drawers":                    (6.88,  0.035,    0,    "ground", 0.15),
    "Surveillance Cameras":            (0.88,  0.005,    0.05, "ground", 0.15),
    # ── New product types ─────────────────────────────────────────────────────
    "Accessories":                     (0.68,  0.00525,  0,    "ground", 0.25),
    "Alarm Systems":                   (1.56,  0.0104,   0,    "ground", 0.20),
    "Bags & Backpacks":                (1.23,  0.01225,  0,    "ground", 0.25),
    "EV Chargers":                     (8.45,  0.0234,   0,    "ground", 0.20),
    "Gaming Consoles":                 (5.15,  0.02205,  0,    "ground", 0.15),
    "Home & Lifestyle":                (3.0,   0.0225,   0,    "ground", 0.20),
    "Label Tapes":                     (0.17,  0.00055,  0,    "ground", 0.25),
    "Microphones & Audio Interfaces":  (1.76,  0.01215,  0,    "air",    0.15),
    "Network Cabinets":                (34.8,  0.261,    0,    "ground", 0.20),
    "Office Supplies":                 (0.25,  0.00125,  0.05, "ground", 0.20),
    "Optical Drives":                  (0.65,  0.00353,  0,    "ground", 0.15),
    "Presentation Remotes":            (0.21,  0.00113,  0,    "air",    0.12),
    "Printer Supplies":                (0.74,  0.00368,  0.05, "ground", 0.20),
    "Rack Accessories":                (2.43,  0.0135,   0.05, "ground", 0.20),
    "Digital Software":                (0,     0,        0,    "air",    0.08),
    "Vacuum Cleaners":                 (8.78,  0.06075,  0,    "ground", 0.15),
    "Watches":                         (0.23,  0.00113,  0,    "air",    0.15),
    "Default":                         (1.0,   0.005,    0,    "air",    0.15),
}

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
    "Программное обеспечение":     "Digital Software",
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
# POST SOAP request to api.cba.am — returns XML with all exchange rates.
# Parsed in fetch_cb_rate() in ai_transform.py.
CB_RATE_URL = "https://api.cba.am/exchangerates.asmx"

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
PRICE_DEBUG_CSV    = str(_SCRIPTS_DIR / "price_debug.csv")
PRODUCT_CACHE_CSV  = str(_SCRIPTS_DIR / "product_cache.csv")
ERROR_LOG          = str(_SCRIPTS_DIR / "parse_errors.csv")

# ── Global brand blocklist (applies to ALL suppliers) ─────────────────────
# Brands that are never IT/electronics — skip regardless of supplier.
GLOBAL_BLOCKED_BRANDS = {
    "RESTO", "ORAL-B",
}

# ── Phonix supplier — brand/category filter ────────────────────────────────
# Brands that are clearly not IT/electronics — skip their rows entirely.
PHONIX_BLOCKED_BRANDS = {
    "FUNKO", "LEGO", "NINJA", "HARRYS",
    "FIRMAN", "CHAMBERLAIN", "KWIKSET", "PACKED PARTY", "FOREO",
}
PHONIX_BLOCKED_CATEGORIES = {"VIDEOGAMES"}

# ── Shared refurbished-product keyword filter (applies to all suppliers) ───
REFURB_KEYWORDS = {
    "REFURBISHED", "GRADE A", "GRADE B", "GRADE C", "RECERTIFIED",
}

# ── HubX supplier — category filter (no brand column in their export) ──────
# Rows with empty category are uncategorisable — skip them.
HUBX_BLOCKED_CATEGORIES = {""}

# ── Imcopex supplier — brand/category filter ───────────────────────────────
# Block clearly non-IT categories (household, personal care, toys, garden…)
IMCOPEX_BLOCKED_CATEGORIES = {
    "Household Small Appliances", "Household & Garden", "Personal hygiene",
    "Toys", "Games & Leisure", "Beauty & Healthcare", "Coffee Machines",
    "Hand Tools", "Garden Tools", "Cookware", "Small Appliance Accessories",
    "Health Articles", "Garden Power Tools", "Major Domestic Appliances",
    "Kitchen Tools", "Parfum", "Bags",
}
# Block non-IT brands that may appear in otherwise-allowed categories
# (stationery, kitchen, personal care, leisure brands)
IMCOPEX_BLOCKED_BRANDS = {
    "LEGO", "Le Creuset", "Faber Castell", "Fiskars", "Leifheit",
    "Jumbo Spiele", "Cuckoo", "Victorinox", "SodaStream", "BaByliss",
    "Zwilling", "KitchenAid", "Delonghi", "Rommelsbacher", "Cosori",
    "Tefal", "Rowenta", "Weber", "WMF", "Kuvings", "George Foreman",
    "Gillette", "Escada", "Mugler", "Medicube", "Gardena", "Worx",
    "Ravensburger", "Singer", "Russel Hobbs", "UNOLD", "PEDRINI",
    "G3 FERRARI", "La Pavoni", "SMEG", "Krups", "Edding", "Pilot",
    "Avery Zweckform", "Stabilo", "Beurer", "Renpho", "Severin",
}

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

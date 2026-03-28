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
import pathlib
import re
import sys
import time
import argparse
import xml.etree.ElementTree as ET
import requests
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from config import (
    GEMINI_API_KEY, GEMINI_MODEL, AI_BATCH_SIZE,
    CB_RATE_URL,
    INTL_VAT_RATE, INTL_BTF_RATE, INTL_CBF_RATE,
    INTL_REGIONS, INTL_PRODUCT_SPECS,
    CATEGORY_TO_PRODUCT_TYPE,
    LOCAL_USD_MARGIN, LOCAL_AMD_MARGIN,
    INTERMEDIATE_CSV, OUTPUT_CSV, PRICE_DEBUG_CSV, PRODUCT_CACHE_CSV, CATEGORIES,
    SUPPLIERS_CSV, DELIVERY_TIMES_CSV,
)

from google import genai
from google.genai import types as genai_types

# ─────────────────────────────────────────────────────────────────────────────
# Exchange rate
# ─────────────────────────────────────────────────────────────────────────────

def fetch_cb_rate() -> float:
    """Fetch live USD→AMD rate from Central Bank of Armenia SOAP API."""
    soap_body = (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
        '<soap:Body><ExchangeRatesLatest xmlns="http://www.cba.am/"/></soap:Body>'
        '</soap:Envelope>'
    )
    resp = requests.post(
        CB_RATE_URL,
        data=soap_body.encode("utf-8"),
        headers={
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction":   '"http://www.cba.am/ExchangeRatesLatest"',
        },
        timeout=10,
    )
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    ns = {"cba": "http://www.cba.am/"}
    for node in root.iter():
        if node.tag.endswith("ExchangeRate"):
            iso = node.find("cba:ISO", ns)
            val = node.find("cba:Rate", ns)
            if iso is not None and iso.text == "USD" and val is not None:
                rate = float(val.text)
                print(f"Central Bank rate: 1 USD = {rate} AMD")
                return rate
    raise ValueError("USD rate not found in CBA API response")


# ─────────────────────────────────────────────────────────────────────────────
# Price calculation
# ─────────────────────────────────────────────────────────────────────────────

def load_suppliers(path: str) -> tuple:
    """Return (types, regions) dicts from suppliers.csv.

    types:   {supplier_name: "local" | "international"}
    regions: {supplier_name: "Europe" | "America" | "China" | ...}
    """
    types = {}
    regions = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            name = row["supplier_name"].strip()
            types[name]   = row["type"].strip()
            regions[name] = row.get("region", "").strip() or "Europe"
    return types, regions


def load_delivery_times(path: str) -> dict:
    """Return {"Europe (Air)": "14-21 дней", ...} from delivery_times.csv."""
    times = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            key = row["Region (Shipping method)"].strip()
            times[key] = row["Delivery time"].strip()
    return times


def get_intl_eta(region: str, category: str, product_name: str,
                 delivery_times: dict) -> str:
    """Look up delivery time for an international product based on its shipping route."""
    prod_type = detect_product_type(category, product_name)
    _, _, _, ship_mode, _ = INTL_PRODUCT_SPECS.get(prod_type, INTL_PRODUCT_SPECS["Default"])
    key = f"{region} ({ship_mode.capitalize()})"
    if key in delivery_times:
        return delivery_times[key]
    # Region has no ground route (e.g. America/China/India) — try alternate mode
    alt_mode = "sea" if ship_mode == "ground" else "ground"
    alt_key  = f"{region} ({alt_mode.capitalize()})"
    return delivery_times.get(alt_key, "14-21 дней")


def detect_product_type(category: str, name: str) -> str:
    """Map Gemini category + product name to an INTL_PRODUCT_SPECS key.

    When called with an AI-normalized name (e.g. "HDD Seagate IronWolf | 4TB | NAS")
    the leading word(s) are matched against _AI_PREFIX_MAP first — this is the primary
    and most reliable path.  Falls back to category keyword scan for ambiguous prefixes
    (e.g. "camera") or when only a raw supplier name is available.
    """
    n = name.lower().strip()
    parts = n.split()

    # ── 1. AI prefix map — try two-word prefix first, then single-word ─────────
    if len(parts) >= 2 and f"{parts[0]} {parts[1]}" in _AI_PREFIX_MAP:
        return _AI_PREFIX_MAP[f"{parts[0]} {parts[1]}"]
    if parts and parts[0] in _AI_PREFIX_MAP:
        return _AI_PREFIX_MAP[parts[0]]

    # ── 2. Category keyword scan (fallback for "camera" and raw names) ─────────
    if category == "Компоненты ПК/Серверов":
        if any(k in n for k in ("cpu", "processor", "xeon", "ryzen", "core i", "процессор")):
            return "CPU"
        if any(k in n for k in ("gpu", "geforce", "radeon", "video card", "graphics", "видеокарта")):
            return "Video Cards"
        if any(k in n for k in ("ddr", "dimm", "sodimm", "ram")):
            return "RAM"
        if any(k in n for k in ("ssd", "nvme", "m.2")):
            return "SSD"
        if any(k in n for k in ("hdd", "hard disk", "hard drive", "жёсткий")):
            return "HDD"
        if any(k in n for k in ("mainboard", "motherboard", "материнская")):
            return "Mainboards"
        if any(k in n for k in ("psu", "power supply", "блок питания")):
            return "PC PSU"
        if any(k in n for k in ("case", "корпус")):
            return "PC Case"
        if any(k in n for k in ("cooler", "кулер", "cooling")):
            return "Coolers for CPU"
        if any(k in n for k in ("optical", "dvd", "blu-ray", "bluray", "cd-rom", "dvd-rom", "odd")):
            return "Optical Drives"
        return "RAM"  # unknown component → conservative fallback

    if category == "Принтеры/Сканеры":
        if any(k in n for k in ("scanner", "сканер")):
            return "Scanners"
        if any(k in n for k in ("toner", "cartridge", "ink ", "тонер", "картридж")):
            return "Printer Supplies"
        return "Printers"

    if category == "Проекторы и принадлежности":
        if any(k in n for k in ("screen", "экран")):
            return "Projector Screens"
        if any(k in n for k in ("mount", "кронштейн")):
            return "Projector Mounting"
        return "Projectors"

    if category == "Аксессуары":
        if any(k in n for k in ("keyboard", "клавиатура")):
            return "Keyboards"
        if any(k in n for k in ("mouse", "мышь", "мышка")):
            return "Mice"
        if any(k in n for k in ("speaker", "колонка", "акустика")):
            return "Speakers"
        if any(k in n for k in ("headset", "headphone", "наушник")):
            return "Headsets"
        if any(k in n for k in ("webcam", "веб-камера")):
            return "Webcams"
        if any(k in n for k in ("gamepad", "controller", "геймпад")):
            return "Gamepads"
        if any(k in n for k in ("bag", "backpack", "сумка", "рюкзак")):
            return "Bags & Backpacks"
        if any(k in n for k in ("watch", "smartwatch", "часы")):
            return "Watches"
        return "Accessories"

    if category == "Сетевое оборудование":
        if any(k in n for k in ("cabinet", "шкаф", "стойка rack", "network cabinet")):
            return "Network Cabinets"
        return "Switches" if any(k in n for k in ("switch", "коммутатор")) else "Routers"

    if category == "Кабели/Переходники":
        return "Adapters" if any(k in n for k in ("adapter", "переходник", "адаптер")) else "Cables"

    if category == "ТВ/Аудио/Фото/Видео техника":
        if any(k in n for k in ("microphone", "микрофон", "audio interface")):
            return "Microphones & Audio Interfaces"
        if any(k in n for k in ("photo", "camera", "фото", "фотоаппарат")):
            return "Photo Cameras"
        if any(k in n for k in ("video camera", "видеокамера")):
            return "Video Cameras"
        if any(k in n for k in ("drone", "дрон")):
            return "Drones"
        return "TVs"

    if category == "Системы безопасности":
        if any(k in n for k in ("alarm", "сигнализация")):
            return "Alarm Systems"
        return "Surveillance Cameras"

    if category == "Торговое оборудование":
        if any(k in n for k in ("barcode", "штрих-код")):
            return "Barcode Scanners"
        if any(k in n for k in ("label", "этикетка")):
            return "Label Tapes" if "tape" in n else "Label/Barcode Printers"
        if any(k in n for k in ("cash drawer", "денежный ящик")):
            return "Cash Drawers"
        return "POS Systems"

    return CATEGORY_TO_PRODUCT_TYPE.get(category, "Default")


def calculate_price_amd(price_raw: str, currency: str, supplier_type: str,
                        cb_rate: float, region: str = "Europe",
                        category: str = "", product_name: str = "") -> int:
    """
    Convert raw supplier price to final AMD, rounded UP to nearest 50.

    International (USD):
        DP_USD  = [P + F + CD + CBF] × (1 + VAT_RATE + BTF_RATE) × (1 + Margin%)
        final_amd = DP_USD × cb_rate

    Local USD:  price_usd × cb_rate × (1 + LOCAL_USD_MARGIN)
    Local AMD:  price_amd × (1 + LOCAL_AMD_MARGIN)
    """
    try:
        price = float(price_raw)
    except (ValueError, TypeError):
        return 0

    if price <= 0:
        return 0

    currency = currency.upper()

    if supplier_type == "international":
        prod_type = detect_product_type(category, product_name)
        weight, volume, duty_rate, ship_mode, margin = INTL_PRODUCT_SPECS.get(
            prod_type, INTL_PRODUCT_SPECS["Default"]
        )

        region_data = INTL_REGIONS.get(region, INTL_REGIONS["Europe"])
        mode_data = region_data.get(ship_mode)
        if mode_data is None:
            # ground-preferred product to America/China/India → use sea instead
            alt = "sea" if ship_mode == "ground" else "ground"
            mode_data = region_data.get(alt, list(region_data.values())[0])
        rate_kg, rate_cbm, customs_applicable = mode_data

        F   = weight * rate_kg if rate_kg else volume * rate_cbm
        CD  = price * duty_rate if (customs_applicable and duty_rate > 0) else 0.0
        CBF = (price + F + CD) * INTL_CBF_RATE if customs_applicable else 0.0

        TLC    = price + F + CD + CBF
        DP_USD = TLC * (1 + INTL_VAT_RATE + INTL_BTF_RATE) * (1 + margin)
        final  = DP_USD * cb_rate

    elif supplier_type == "local" and currency == "USD":
        final = price * cb_rate * (1 + LOCAL_USD_MARGIN)

    elif supplier_type == "local" and currency == "AMD":
        final = price * (1 + LOCAL_AMD_MARGIN)

    else:
        # Fallback: treat as local USD
        final = price * cb_rate * (1 + LOCAL_USD_MARGIN)

    # Round UP to nearest 50 AMD
    return max(0, math.ceil(final / 50) * 50)


# ─────────────────────────────────────────────────────────────────────────────
# Product name cache
# ─────────────────────────────────────────────────────────────────────────────

def load_product_cache(path: str) -> dict:
    """Load product_cache.csv → dict keyed by model_raw.strip().lower().

    Returns an empty dict if the file doesn't exist yet.
    Only the AI-normalised text fields are cached (name, sku, category, brand).
    Volatile fields (price, eta, moq) are always re-calculated from live data.
    """
    cache = {}
    p = pathlib.Path(path)
    if not p.exists():
        return cache
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            key = row.get("model_raw", "").strip().lower()
            if key:
                cache[key] = {
                    "name":     row.get("name", ""),
                    "sku":      row.get("sku", ""),
                    "category": row.get("category", ""),
                    "brand":    row.get("brand", ""),
                    "status":   row.get("status", ""),
                }
    return cache


def save_product_cache(path: str, cache: dict) -> None:
    """Write the full product cache back to disk (sorted by key for stable diffs)."""
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f, fieldnames=["model_raw", "name", "sku", "category", "brand", "status"]
        )
        writer.writeheader()
        for model_raw, ai in sorted(cache.items()):
            writer.writerow({"model_raw": model_raw, **ai})


# ─────────────────────────────────────────────────────────────────────────────
# Gemini API
# ─────────────────────────────────────────────────────────────────────────────

_client = genai.Client(api_key=GEMINI_API_KEY)

SYSTEM_PROMPT = f"""You are a product data normaliser for an IT products B2B portal.
You will receive a JSON array of raw product records and must return a JSON array
(same length, same order) where each object has exactly these four fields:
  "name", "sku", "category", "brand"

══════════════════════════════════════════════════
NAME FORMAT
══════════════════════════════════════════════════
Pattern:  [ProductType] [Brand] [Model] | [Spec1] | [Spec2] | [Spec3] | ...

Rules:
• ProductType — short English noun describing the product type (see examples below)
• Brand — canonical brand name (e.g. Samsung, HP, Cisco)
• Model — human-readable series/model name (NOT the SKU/part number)
• Specs — pipe-separated, include all relevant specs the input provides
• Language: English only — translate Russian/Armenian descriptions
• Max length: 150 characters
• Do NOT include the SKU/part number in the name field

Examples by product type:
  SSD SATA:       SSD Samsung 870 EVO | 250GB | 2.5" SATA III
  SSD NVMe:       SSD Crucial P310 | 500GB | M.2 PCIe Gen4 NVMe
  HDD Desktop:    HDD Seagate BarraCuda | 2TB | 3.5" SATA III | 7200RPM
  HDD NAS:        HDD Seagate IronWolf | 4TB | 3.5" SATA III | 5900RPM | NAS
  HDD Video:      HDD Seagate SkyHawk | 1TB | 3.5" SATA III | Surveillance
  RAM DDR4:       RAM Kingston ValueRAM | 16GB | DDR4-3200 | SODIMM | CL22
  RAM Server:     RAM Kingston | 32GB | DDR5-4800 | ECC RDIMM
  CPU Consumer:   CPU AMD Ryzen 5 9600X | 6-Core | AM5 | 3.9GHz | 65W
  CPU Server:     CPU Intel Xeon Silver 4310 | 12-Core | LGA4189 | 2.1GHz
  GPU:            GPU NVIDIA GeForce RTX 4060 | 8GB GDDR6 | PCIe 4.0
  Motherboard:    Motherboard ASUS ROG Strix B650E-F | AM5 | ATX | DDR5 | Wi-Fi 6E
  PSU:            PSU Corsair RM850x | 850W | 80+ Gold | Modular
  Cooling:        Cooler Noctua NH-D15 | CPU Air | 140mm | AM5/LGA1700
  Laptop:         Laptop HP EliteBook 840 G10 | 14" FHD | Core i5-1335U | 16GB | 512GB SSD
  Desktop PC:     PC Lenovo ThinkCentre M75q | Ryzen 5 5600GE | 8GB | 256GB SSD
  Workstation:    Workstation HP Z4 G5 | Xeon W3-2423 | 32GB ECC | 512GB NVMe
  Server:         Server HPE ProLiant DL360 Gen11 | 2×Xeon Silver | 32GB | 2U Rack
  Monitor:        Monitor Dell UltraSharp U2723QE | 27" 4K IPS | USB-C 90W
  Printer laser:  Printer HP LaserJet Pro M404n | A4 Mono | 38ppm | LAN
  Printer inkjet: Printer Epson L3250 | A4 Color | Wi-Fi | CISS
  MFP:            MFP Canon imageRUNNER 2630i | A3 Mono | 30ppm | Copy/Print/Scan/Fax
  Scanner:        Scanner Epson DS-310 | A4 | USB | 1200dpi
  Plotter:        Plotter HP DesignJet T230 | A1 | 24" | Wi-Fi
  Projector:      Projector Epson EB-X51 | XGA 1024×768 | 3800 lm | HDMI
  Screen:         Projection Screen Lumien | 100" | 4:3 | Manual Pull-Down
  UPS:            UPS APC Smart-UPS 1500 | 1500VA/1000W | LCD | USB
  PDU:            PDU APC Rack | 8-Outlet | 1U | Metered
  Switch L2:      Switch Cisco Catalyst 2960-X | 48-Port PoE+ | 10G SFP+ Uplink
  Switch L3:      Switch Cisco Catalyst 9300 | 24-Port | Layer 3 | StackWise
  Router:         Router Cisco ISR 4321 | 50Mbps | 2×WAN | IPSec VPN
  Firewall:       Firewall Fortinet FortiGate 60F | 10 GbE | UTM | 5Gbps Throughput
  Access Point:   Access Point Ubiquiti UniFi U6 Pro | Wi-Fi 6 | 4×4 MIMO | PoE
  SFP Module:     SFP+ Module Cisco SFP-10G-SR | 10GbE | Multi-Mode | 300m
  IP Camera:      Camera Hikvision DS-2CD2T43G2-4I | 4MP | IR 80m | PoE | Outdoor
  NVR:            NVR Dahua | 16-Channel | 4K | PoE | H.265+
  DVR:            DVR Hikvision DS-7208HQHI-K2 | 8-Channel | 1080p | H.265+
  IP Phone:       Phone Yealink T54W | 16-Line | Color TFT | Wi-Fi | BT
  POS Terminal:   POS Terminal Ingenico Desk 3500 | EMV | NFC | LAN
  Barcode Scanner:Scanner Barcode Zebra DS2208 | 1D/2D | USB | Handheld
  Label Printer:  Printer Label Zebra ZD420 | 4" | 300dpi | USB/LAN/Wi-Fi
  Cable:          Cable HDMI 2.1 | 3m | 8K@60Hz
  Patch Cord:     Patch Cord UTP Cat6 | 2m | RJ45 | Grey
  Adapter:        Adapter USB-C to HDMI | 4K@60Hz
  Smartphone:     Phone Samsung Galaxy S24 | 6.2" | Snapdragon 8 Gen3 | 256GB
  Tablet:         Tablet Samsung Galaxy Tab S9 | 11" | 128GB | Wi-Fi
  Smart Watch:    Watch Apple Watch Series 9 | 45mm | GPS | Aluminium

══════════════════════════════════════════════════
SKU FORMAT
══════════════════════════════════════════════════
• Manufacturer part number only (no human-readable description)
• Keep the part number exactly as-is — do NOT remove any suffixes, hyphens, or slashes
  (e.g. MZ-77E250B/EU stays MZ-77E250B/EU, KVR32N22S8/8 stays KVR32N22S8/8)
• Do NOT strip region suffixes (/EU, /AP, /RU, /WW, /EE, etc.) or any other suffix
• Remove colour suffixes only if colour is NOT the product differentiator
• If the input model field already looks like a valid part number, prefer it over guessing

══════════════════════════════════════════════════
BRAND FORMAT
══════════════════════════════════════════════════
• Return the canonical manufacturer brand name (e.g. "Kingston", "Samsung", "HP")
• Use the input "brand" field if it already looks like a valid brand name
• If the input brand is clearly wrong (e.g. a memory size like "16GB", a number, or a
  spec value), infer the correct brand from the model number or product name instead
• Common model-number brand prefixes to recognise:
    KVR / KSM         → Kingston
    MZ / MZ-V / MZ-77 → Samsung
    CT / BX / MX      → Crucial
    ST / STJL         → Seagate
    WD / WDS / WDBU   → Western Digital
    CP5               → Corsair
    GV                → Gigabyte
    PS                → Patriot
• Return empty string "" only if you truly cannot determine the brand

══════════════════════════════════════════════════
CATEGORY MAPPING
══════════════════════════════════════════════════
Assign exactly one category from this list (copy Cyrillic exactly).
If no category fits, leave it as an empty string — do NOT invent a new category.

{json.dumps(CATEGORIES, ensure_ascii=False, indent=2)}

Mapping rules:
  Ноутбуки              → Laptops, notebooks, ultrabooks (all sizes/brands)
  Компьютеры            → Desktop PCs, workstations, all-in-ones, mini PCs
  Серверы               → Rack/tower/blade servers, server chassis, server kits
  Телефоны              → Smartphones, feature phones, IP/SIP phones, conference phones
  Планшеты              → Tablets, e-readers, 2-in-1 tablets
  Компоненты ПК/Серверов → CPUs, GPUs, RAM, motherboards, PSUs, PC cases, cooling,
                           internal HDDs (2.5"/3.5" SATA/SAS — including NAS-optimised
                           variants e.g. Seagate IronWolf/IronWolf Pro, WD Red/Red Pro,
                           and surveillance variants e.g. Seagate SkyHawk, WD Purple/
                           Purple Pro — these are bare internal drives, not storage devices),
                           internal SSDs (M.2, NVMe, 2.5" SATA/NVMe, U.2),
                           server components (HBAs, RAID cards, NICs, riser cards),
                           optical drives, batteries for laptops/servers
  Мониторы              → Computer monitors, display panels (all sizes)
  Принтеры/Сканеры      → Laser/inkjet printers, document scanners, MFPs,
                           plotters, wide-format printers
  Проекторы и принадлежности → Projectors, projection screens, projector mounts,
                           replacement lamps, remote controls for projectors
  ИБП (UPS)             → UPS units, PDUs, surge protectors (rack and desktop)
  Аксессуары            → Peripheral devices that connect to a PC: keyboards, mice,
                           webcams, headsets, speakers, gamepads, docking stations,
                           laptop stands, bags, power adapters/chargers, misc peripherals
  Хранение данных (СХД) → External HDDs (portable/desktop — has USB connector/enclosure),
                           external SSDs, USB flash drives, memory cards (SD/microSD),
                           NAS enclosure devices (e.g. Synology DS, QNAP TS — the
                           standalone box, NOT NAS-optimised hard drives inside them),
                           tape drives, backup appliances
  Программное обеспечение → Software licenses, OS (Windows/Linux), Microsoft 365,
                           antivirus, CAL licenses, virtualization licenses
  Сетевое оборудование  → Switches, routers, firewalls, Wi-Fi access points,
                           modems, media converters, SFP/SFP+ modules,
                           patch panels, bulk cable spools
  Кабели/Переходники    → Individual cables (HDMI, DisplayPort, USB, power cords,
                           LAN/Ethernet, optical fiber), single patch cords, adapters,
                           KVM switches, converters, gender changers, splitters
  Смарт-Гаджеты         → Wearables and smart gadgets: smart watches, fitness trackers,
                           smart home devices, IoT sensors/hubs, VR/AR headsets,
                           smart speakers — NOT smartphones or tablets
  ТВ/Аудио/Фото/Видео техника → TVs, home audio systems, digital cameras (DSLR/mirrorless),
                           action cameras, video cameras, lenses, tripods, gimbals,
                           microphones, studio lighting, streaming equipment
  Торговое оборудование → POS terminals, barcode scanners (retail), receipt printers,
                           cash drawers, payment terminals, retail scales,
                           label/tag printers (retail), customer displays
  Системы безопасности  → IP/CCTV cameras, NVR/DVR recorders, access control panels,
                           biometric terminals, video intercoms, alarm systems,
                           turnstiles, motion sensors, security lighting

Decision tips for ambiguous products:
  - Internal SSD/HDD (M.2, 2.5", 3.5" — sold without enclosure) → Компоненты ПК/Серверов
  - External/portable SSD or HDD (has USB port/enclosure) → Хранение данных (СХД)
  - NAS-optimised HDD (Seagate IronWolf/Pro, WD Red/Pro) → Компоненты ПК/Серверов  [bare internal drive!]
  - Surveillance HDD (Seagate SkyHawk, WD Purple/Purple Pro) → Компоненты ПК/Серверов  [bare internal drive!]
  - NAS enclosure box (Synology, QNAP, etc.) → Хранение данных (СХД)
  - NIC/HBA card → Компоненты ПК/Серверов
  - IP phone / SIP phone → Телефоны  [NOT Аксессуары]
  - LAN cable, optical cable, patch cord → Кабели/Переходники  [NOT Сетевое оборудование]
  - Bulk cable spool → Сетевое оборудование
  - Label printer for retail POS → Торговое оборудование;  office label printer → Принтеры/Сканеры
  - Laptop power adapter/charger → Аксессуары;  UPS/PDU → ИБП (UPS)
  - Barcode scanner for inventory/retail → Торговое оборудование
  - Security/surveillance camera → Системы безопасности  [NOT ТВ/Аудио/Фото]
  - Smart watch / fitness band → Смарт-Гаджеты  [NOT Аксессуары]

══════════════════════════════════════════════════
Return ONLY the JSON array. No markdown fences, no explanation, no extra text.
Fallbacks if truly uncertain: empty string for name, sku, and category.
"""


def call_gemini(batch: list[dict]) -> list[dict]:
    """Send one batch to Gemini and return parsed JSON list."""
    payload = json.dumps(batch, ensure_ascii=False)

    for attempt in range(3):
        try:
            response = _client.models.generate_content(
                model=GEMINI_MODEL,
                contents=payload,
                config=genai_types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
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
    return [{"name": r.get("name_raw", ""), "sku": r.get("model", ""), "category": "", "brand": r.get("brand", "")}
            for r in batch]


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

OUTPUT_HEADERS = [
    "id", "name", "sku", "price", "stock", "eta", "description",
    "availableQuantity", "moq", "brand", "category", "visibleCustomerTypes",
]

# Matches capacity-like strings that suppliers sometimes put in the Brand column
# e.g. "16GB", "32GB", "512MB", "1TB" — clearly not a brand name.
_CAPACITY_RE   = re.compile(r'^\d+\s*(GB|MB|TB|KB)$', re.IGNORECASE)
# Matches numeric-only SKUs (plain int or Excel scientific notation: "1.96E+11")
_NUMERIC_SKU_RE = re.compile(r'^\d+(?:\.\d+)?(?:[Ee][+\-]?\d+)?$')


def _normalize_sku(raw_sku: str, brand_raw: str) -> str:
    """If Gemini returned a bare numeric SKU, prefix with brand (BRAND-12345).
    Real manufacturer SKUs (e.g. 'VMC2320W') are returned unchanged."""
    s = raw_sku.strip()
    if s and _NUMERIC_SKU_RE.match(s) and brand_raw:
        try:
            s = str(int(float(s)))
        except (ValueError, OverflowError):
            pass
        return f"{brand_raw.upper()}-{s}"
    return s

# Maps the leading word(s) of an AI-normalized product name → INTL_PRODUCT_SPECS key.
# Two-word prefixes are checked before single-word ones.
# "camera" is intentionally excluded — ambiguous (surveillance/photo/video);
# the existing category-based keyword scan handles it correctly.
_AI_PREFIX_MAP = {
    # ── two-word prefixes ──────────────────────────────────────────────────────
    "access point":        "Routers",
    "mini pc":             "Mini PCs",
    "all-in-one":          "All-In-Ones",
    "projection screen":   "Projector Screens",
    "external ssd":        "External HDD/SSD",
    "external hdd":        "External HDD/SSD",
    "flash drive":         "Flash Drives/Memory Cards",
    "usb flash":           "Flash Drives/Memory Cards",   # Gemini: "USB Flash Samsung Bar Plus | ..."
    "network cable":       "Network Cables",
    "patch cord":          "Network Cables",
    "printer label":       "Label/Barcode Printers",
    "scanner barcode":     "Barcode Scanners",
    "label tape":          "Label Tapes",
    "laptop bag":          "Bags & Backpacks",
    "laptop backpack":     "Bags & Backpacks",
    "ev charger":          "EV Chargers",
    "gaming console":      "Gaming Consoles",
    "audio interface":     "Microphones & Audio Interfaces",
    "network cabinet":     "Network Cabinets",
    "server cabinet":      "Network Cabinets",
    "rack cabinet":        "Network Cabinets",
    "optical drive":       "Optical Drives",
    "dvd drive":           "Optical Drives",
    "blu-ray drive":       "Optical Drives",
    "presentation remote": "Presentation Remotes",
    "printer supply":      "Printer Supplies",
    "ink cartridge":       "Printer Supplies",
    "toner cartridge":     "Printer Supplies",
    "robot vacuum":        "Vacuum Cleaners",
    "vacuum cleaner":      "Vacuum Cleaners",
    # ── single-word prefixes ───────────────────────────────────────────────────
    "ssd":           "SSD",
    "hdd":           "HDD",
    "ram":           "RAM",
    "cpu":           "CPU",
    "gpu":           "Video Cards",
    "motherboard":   "Mainboards",
    "psu":           "PC PSU",
    "cooler":        "Coolers for CPU",
    "laptop":        "Laptops",
    "pc":            "Desktops",
    "workstation":   "Desktops",
    "server":        "Servers",
    "monitor":       "Monitors",
    "tv":            "TVs",
    "printer":       "Printers",
    "mfp":           "Printers",
    "plotter":       "Printers",
    "scanner":       "Scanners",
    "projector":     "Projectors",
    "projection":    "Projector Screens",
    "screen":        "Projector Screens",
    "ups":           "UPS",
    "pdu":           "UPS",
    "switch":        "Switches",
    "router":        "Routers",
    "firewall":      "Routers",
    "phone":         "Smartphones",
    "smartphone":    "Smartphones",
    "tablet":        "Tablets",
    "keyboard":      "Keyboards",
    "mouse":         "Mice",
    "speaker":       "Speakers",
    "headset":       "Headsets",
    "webcam":        "Webcams",
    "gamepad":       "Gamepads",
    "drone":         "Drones",
    "microsd":       "Flash Drives/Memory Cards",   # Gemini: "microSD Samsung EVO Plus | ..."
    "cable":         "Cables",
    "adapter":       "Adapters",
    "watch":         "Watches",
    "smartwatch":    "Watches",
    "nvr":           "Surveillance Cameras",
    "dvr":           "Surveillance Cameras",
    "barcode":       "Barcode Scanners",
    "label":         "Label/Barcode Printers",
    "cash":          "Cash Drawers",
    "pos":           "POS Systems",
    "sfp":           "Network Cards",
    "sfp+":          "Network Cards",
    "microphone":    "Microphones & Audio Interfaces",
    "console":       "Gaming Consoles",
    "backpack":      "Bags & Backpacks",
    "bag":           "Bags & Backpacks",
    "alarm":         "Alarm Systems",
    "toner":         "Printer Supplies",
    "presenter":     "Presentation Remotes",
    "software":      "Digital Software",
    "vacuum":        "Vacuum Cleaners",
    "accessories":   "Accessories",
    "accessory":     "Accessories",
}


def _compute_intl_moq(raw_moq: str, price_raw: str, avail_qty: str) -> str:
    """Generate MOQ for international suppliers that have no MOQ set.

    Rule: minimum international order value = $5,000.
    Formula: raw = 5000 / price_usd, then:
      raw < 1  →  MOQ = 1   (single expensive unit already covers $5,000)
      raw < 2  →  MOQ = 2
      raw < 3  →  MOQ = 3
      raw < 4  →  MOQ = 4
      raw ≥ 4  →  MOQ = ceil(raw / 5) × 5  (round UP to nearest multiple of 5)

    Stock cap: if availableQuantity < generated MOQ, MOQ is capped to
    availableQuantity so buyers can't be asked to order more than is in stock.

    Only kicks in when raw_moq is blank, "0", or "1" (i.e. not explicitly
    specified by the supplier).  If the supplier already set a MOQ > 1 it
    is kept unchanged (but still capped by available stock).

    Examples:
      $6,000 server  →  raw = 0.83  →  MOQ = 1
      $3,000 switch  →  raw = 1.67  →  MOQ = 2
      $1,200 NIC     →  raw = 4.17  →  MOQ = 5
      $121.10 SSD    →  raw = 41.29 →  MOQ = 45  (or less if stock < 45)
    """
    try:
        moq_val = int(float(raw_moq)) if raw_moq else 0
    except (ValueError, TypeError):
        moq_val = 0

    if moq_val > 1:
        moq = moq_val           # explicitly set by supplier — keep it
    else:
        try:
            price = float(price_raw)
        except (ValueError, TypeError):
            return raw_moq or "1"

        if price <= 0:
            return raw_moq or "1"

        raw = 5000.0 / price
        if raw < 4:
            moq = math.ceil(raw)        # 1, 2, 3, or 4
        else:
            moq = math.ceil(raw / 5) * 5   # 5, 10, 15, …

    # Cap by available stock: never ask for more units than the supplier has
    try:
        qty = int(float(avail_qty)) if avail_qty else 0
        if 0 < qty < moq:
            moq = qty
    except (ValueError, TypeError):
        pass

    return str(moq)


def build_output_row(inter: dict, ai: dict, price_amd: int,
                     supplier_type: str = "international",
                     eta: str = "") -> dict:
    brand_py = inter["brand_raw"]
    # If the Python-extracted brand looks like a capacity value, fall back to
    # Gemini's brand (which can infer it from SKU prefixes like KVR → Kingston).
    if _CAPACITY_RE.match(brand_py.strip()):
        brand = ai.get("brand") or brand_py
    else:
        brand = brand_py

    # International suppliers don't hold stock locally — always "on_order".
    stock = "on_order" if supplier_type == "international" else inter["stock"]

    return {
        "id":                   "",
        "name":                 (ai.get("name") or inter["name_raw"]).strip(),
        "sku":                  _normalize_sku(ai.get("sku") or inter["model"], inter.get("brand_raw", "")),
        "price":                price_amd,
        "stock":                stock,
        "eta":                  eta,
        "description":          "",
        "availableQuantity":    inter["availableQuantity"],
        "moq":                  _compute_intl_moq(inter["moq"], inter["price_raw"],
                                                  inter["availableQuantity"])
                                if supplier_type == "international"
                                else inter["moq"],
        "brand":                (ai.get("brand") or brand).strip(),
        "category":             ai.get("category") or "",
        "visibleCustomerTypes": inter["visibleCustomerTypes"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Price debug log
# ─────────────────────────────────────────────────────────────────────────────

DEBUG_HEADERS = [
    "supplier", "ai_name", "name_raw", "sku", "category", "product_type",
    "region", "ship_mode", "customs",
    "price_usd", "weight_kg", "freight_usd", "duty_usd", "broker_fee_usd",
    "dp_usd", "margin_pct", "price_amd", "eta",
]


def build_price_debug_row(inter: dict, ai: dict, price_amd: int,
                          supplier_type: str, eta: str, cb_rate: float,
                          region: str = "") -> dict:
    """Build one audit row for price_debug.csv, exposing all pricing components."""
    category     = ai.get("category", "")
    # Use AI-normalized name for type detection (same as the pricing path),
    # but keep the original raw name visible in the name_raw column.
    product_name = ai.get("name") or inter["name_raw"]

    base = {
        "supplier":      inter["supplier"],
        "ai_name":       product_name,        # AI-normalized name used for type detection
        "name_raw":      inter["name_raw"],   # always show raw supplier text
        "sku":           (ai.get("sku") or inter.get("model", "")).strip(),
        "category":      category,
        "price_amd":     price_amd,
        "eta":           eta,
    }

    if supplier_type == "international":
        prod_type  = detect_product_type(category, product_name)
        weight, volume, duty_rate, ship_mode, margin = INTL_PRODUCT_SPECS.get(
            prod_type, INTL_PRODUCT_SPECS["Default"]
        )

        region_data = INTL_REGIONS.get(region, INTL_REGIONS["Europe"])
        mode_data   = region_data.get(ship_mode)
        if mode_data is None:
            alt       = "sea" if ship_mode == "ground" else "ground"
            mode_data = region_data.get(alt, list(region_data.values())[0])
        rate_kg, rate_cbm, customs_applicable = mode_data

        try:
            price_usd = float(inter["price_raw"])
        except (ValueError, TypeError):
            price_usd = 0.0

        F   = weight * rate_kg if rate_kg else volume * rate_cbm
        CD  = price_usd * duty_rate if (customs_applicable and duty_rate > 0) else 0.0
        CBF = (price_usd + F + CD) * INTL_CBF_RATE if customs_applicable else 0.0
        TLC    = price_usd + F + CD + CBF
        DP_USD = TLC * (1 + INTL_VAT_RATE + INTL_BTF_RATE) * (1 + margin)

        base.update({
            "product_type":   prod_type,
            "region":         region,
            "ship_mode":      ship_mode,
            "customs":        "yes" if customs_applicable else "no",
            "price_usd":      round(price_usd, 4),
            "weight_kg":      weight,
            "freight_usd":    round(F, 4),
            "duty_usd":       round(CD, 4),
            "broker_fee_usd": round(CBF, 4),
            "dp_usd":         round(DP_USD, 4),
            "margin_pct":     f"{int(margin * 100)}%",
        })
    else:
        currency = inter.get("currency", "USD").upper()
        if currency == "AMD":
            margin_pct = f"{int(LOCAL_AMD_MARGIN * 100)}%"
        else:
            margin_pct = f"{int(LOCAL_USD_MARGIN * 100)}%"
        base.update({
            "product_type":   "local",
            "region":         "local",
            "ship_mode":      "",
            "customs":        "no",
            "price_usd":      inter.get("price_raw", ""),
            "weight_kg":      "",
            "freight_usd":    "",
            "duty_usd":       "",
            "broker_fee_usd": "",
            "dp_usd":         "",
            "margin_pct":     margin_pct,
        })

    return base


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true",
                        help="Process only the first 10 rows (for inspection)")
    args = parser.parse_args()

    # Load intermediate rows
    with open(INTERMEDIATE_CSV, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    if args.test:
        rows = rows[:10]
        print(f"🔬  TEST MODE — processing {len(rows)} rows only")

    print(f"Loaded {len(rows)} rows from {INTERMEDIATE_CSV}")

    # Live exchange rate
    cb_rate = fetch_cb_rate()

    # Supplier type and region maps (loaded from suppliers.csv)
    supplier_types, supplier_regions = load_suppliers(SUPPLIERS_CSV)
    delivery_times = load_delivery_times(DELIVERY_TIMES_CSV)

    # Load product name cache (persists across runs — skips Gemini for known products)
    product_cache = load_product_cache(PRODUCT_CACHE_CSV)
    cache_hits    = 0
    cache_misses  = 0
    cache_updated = False
    print(f"Product cache: {len(product_cache)} entries loaded")

    # Process in batches
    output_rows = []
    debug_rows  = []
    n_batches = math.ceil(len(rows) / AI_BATCH_SIZE)

    for batch_idx in range(n_batches):
        batch_rows = rows[batch_idx * AI_BATCH_SIZE : (batch_idx + 1) * AI_BATCH_SIZE]

        # ── Split batch into cache hits and misses ────────────────────────────
        ai_results       = [None] * len(batch_rows)
        uncached_indices = []
        uncached_payload = []

        for i, r in enumerate(batch_rows):
            key = r["model"].strip().lower()
            if key and key in product_cache:
                ai_results[i] = product_cache[key]
                cache_hits += 1
            else:
                uncached_indices.append(i)
                uncached_payload.append({
                    "brand":        r["brand_raw"],
                    "model":        r["model"],
                    "name_raw":     r["name_raw"],
                    "category_raw": r["category_raw"],
                })

        # ── Call Gemini only for uncached rows ────────────────────────────────
        if uncached_payload:
            n_cached = len(batch_rows) - len(uncached_payload)
            suffix   = f" ({n_cached} from cache)" if n_cached else ""
            print(f"  Batch {batch_idx + 1}/{n_batches} — {len(uncached_payload)} new{suffix}...",
                  end=" ", flush=True)
            gemini_results = call_gemini(uncached_payload)
            print("✓")
            for idx, result in zip(uncached_indices, gemini_results):
                cache_misses += 1
                key = batch_rows[idx]["model"].strip().lower()
                brand_raw = batch_rows[idx].get("brand_raw", "")
                # Normalize SKU before caching so the cache reflects the final value
                normalized = {**result, "sku": _normalize_sku(result.get("sku", ""), brand_raw)}
                ai_results[idx] = normalized
                if key:
                    product_cache[key] = {**normalized, "status": "NEW"}
                    cache_updated = True
        else:
            print(f"  Batch {batch_idx + 1}/{n_batches} — all {len(batch_rows)} from cache ✓")

        # ── Process all rows (cached + freshly Gemini'd) ─────────────────────
        for inter, ai in zip(batch_rows, ai_results):
            supplier_type = supplier_types.get(inter["supplier"], "international")
            region        = supplier_regions.get(inter["supplier"], "Europe")
            # Use AI-normalized name for product type detection: it starts with
            # an unambiguous English prefix ("HDD ...", "SSD ...", etc.) that
            # _AI_PREFIX_MAP can match exactly. Fall back to raw name if AI
            # returned nothing (e.g. Gemini failure / fallback path).
            ai_name = ai.get("name") or inter["name_raw"]
            price_amd = calculate_price_amd(
                inter["price_raw"], inter["currency"], supplier_type, cb_rate,
                region=region,
                category=ai.get("category", ""),
                product_name=ai_name,
            )
            if price_amd == 0:
                print(f"  ⚠  Skipping zero-price: {inter['name_raw'][:70]}")
                continue

            if supplier_type == "international":
                eta = get_intl_eta(region, ai.get("category", ""), ai_name, delivery_times)
            else:
                eta = delivery_times.get("Armenia (Local)", "1-2 дня")
            output_rows.append(build_output_row(inter, ai, price_amd, supplier_type, eta))
            debug_rows.append(build_price_debug_row(inter, ai, price_amd, supplier_type, eta, cb_rate, region=region))

        # Small delay only when Gemini was actually called (to avoid rate-limiting)
        if uncached_payload and batch_idx < n_batches - 1:
            time.sleep(0.5)

    # Save updated product cache
    if cache_updated:
        save_product_cache(PRODUCT_CACHE_CSV, product_cache)
        print(f"Product cache updated → {len(product_cache)} entries saved")
    print(f"Cache: {cache_hits} hits, {cache_misses} misses")

    # Write output
    out_path = OUTPUT_CSV if not args.test else OUTPUT_CSV.replace(".csv", "_test.csv")
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_HEADERS)
        writer.writeheader()
        writer.writerows(output_rows)

    # Write price debug log
    debug_path = PRICE_DEBUG_CSV if not args.test else PRICE_DEBUG_CSV.replace(".csv", "_test.csv")
    with open(debug_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=DEBUG_HEADERS)
        writer.writeheader()
        writer.writerows(debug_rows)

    print(f"\n{'─'*50}")
    print(f"Products processed  : {len(output_rows)}")
    print(f"Output              : {out_path}")
    print(f"Price debug log     : {debug_path}")
    print(f"{'─'*50}")
    print("\nNext step: review output_import.csv then import into b2b.chip.am portal.")


if __name__ == "__main__":
    main()

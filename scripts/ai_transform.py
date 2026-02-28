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

from google import genai
from google.genai import types as genai_types

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

_client = genai.Client(api_key=GEMINI_API_KEY)

SYSTEM_PROMPT = f"""You are a product data normaliser for an IT products B2B portal.
You will receive a JSON array of raw product records and must return a JSON array
(same length, same order) where each object has exactly these three fields:
  "name", "sku", "category"

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
  CPU Consumer:   Processor AMD Ryzen 5 9600X | 6-Core | AM5 | 3.9GHz | 65W
  CPU Server:     Processor Intel Xeon Silver 4310 | 12-Core | LGA4189 | 2.1GHz
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
• Remove region suffixes: /EU /AP /RU /WW /EE etc.
• Remove colour suffixes only if colour is NOT the product differentiator
• Keep the core alphanumeric identifier

══════════════════════════════════════════════════
CATEGORY MAPPING
══════════════════════════════════════════════════
Assign exactly one category from this list (copy Cyrillic exactly):
{json.dumps(CATEGORIES, ensure_ascii=False, indent=2)}

Mapping rules:
  Ноутбуки              → Laptops, notebooks, ultrabooks (all sizes/brands)
  Компьютеры            → Desktop PCs, workstations, all-in-ones, mini PCs
  Серверы               → Rack/tower/blade servers, server chassis, server kits
  Телефоны              → Smartphones, feature phones, IP/SIP phones, conference phones
  Планшеты              → Tablets, e-readers, 2-in-1 tablets
  Компоненты ПК/Серверов → CPUs, GPUs, RAM, motherboards, PSUs, PC cases, cooling,
                           server components (HBAs, RAID cards, NICs, riser cards),
                           optical drives, batteries for laptops/servers
  Мониторы              → Computer monitors, display panels (all sizes)
  Принтеры/Сканеры      → Laser/inkjet printers, document scanners, MFPs,
                           plotters, wide-format printers
  Проекторы и принадлежности → Projectors, projection screens, projector mounts,
                           replacement lamps, remote controls for projectors
  ИБП (UPS)             → UPS units, PDUs, surge protectors (rack and desktop)
  Аксессуары            → Keyboards, mice, webcams, headsets, speakers, bags,
                           docking stations, laptop stands, desk accessories,
                           power adapters/chargers, misc peripherals
  Хранение данных (СХД) → HDDs, SSDs (SATA/NVMe/M.2/2.5"/3.5"), USB flash drives,
                           memory cards (SD/microSD), NAS devices (the box itself),
                           tape drives, backup appliances, external drives
  Программное обеспечение → Software licenses, OS (Windows/Linux), Microsoft 365,
                           antivirus, CAL licenses, virtualization licenses
  Сетевое оборудование  → Switches, routers, firewalls, Wi-Fi access points,
                           modems, media converters, SFP/SFP+ modules,
                           patch panels, bulk cable spools (not individual cables)
  Кабели/Переходники    → Individual cables (HDMI, DisplayPort, USB, power cords),
                           single patch cords, adapters, KVM switches, converters,
                           gender changers, splitters
  Смарт-Гаджеты         → Smart watches, fitness trackers, smart home devices,
                           IoT sensors/hubs, VR/AR headsets, smart speakers
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
  - SSD or HDD (any form factor) → Хранение данных (СХД)  [NOT Компоненты]
  - NAS box/device → Хранение данных (СХД);  NIC/HBA card for a server → Компоненты ПК/Серверов
  - IP phone / SIP phone → Телефоны
  - Single patch cord or HDMI cable → Кабели/Переходники;  bulk spool → Сетевое оборудование
  - Label printer for retail POS use → Торговое оборудование;  office label printer → Принтеры/Сканеры
  - Laptop power adapter → Аксессуары;  UPS/PDU → ИБП (UPS)
  - Barcode scanner for inventory/retail → Торговое оборудование
  - Security/surveillance camera → Системы безопасности  [NOT ТВ/Аудио/Фото]

══════════════════════════════════════════════════
Return ONLY the JSON array. No markdown fences, no explanation, no extra text.
Fallbacks if truly uncertain: empty string for name/sku, "Аксессуары" for category.
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
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
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

# B2B Portal Design Guidelines for b2b.chip.am

## Design Approach
**Design System:** Material Design adapted for B2B efficiency, matching chip.am's professional aesthetic while optimizing for wholesale workflows. Focus on data density, quick scanning, and streamlined ordering.

## Core Design Principles
1. **Information Clarity:** Dense, scannable product lists prioritize SKU, price, and stock visibility
2. **Workflow Efficiency:** Minimize clicks between browsing and ordering
3. **Professional Trust:** Clean, corporate aesthetic suitable for business customers
4. **Bilingual Ready:** Russian/Armenian language support with proper typography

---

## Typography

**Font Families:**
- Primary: Inter (via Google Fonts) for UI elements and data
- Secondary: Noto Sans Armenian for Armenian text support

**Hierarchy:**
- Hero/Page Titles: text-4xl font-bold (36px)
- Section Headers: text-2xl font-semibold (24px)
- Product Names: text-base font-medium (16px)
- Body Text: text-sm (14px)
- Data Labels: text-xs font-medium uppercase tracking-wide (12px)
- Price Display: text-lg font-semibold (18px)

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, and 16
- Component padding: p-4 to p-6
- Section spacing: py-12 to py-16
- Card gaps: gap-4 to gap-6

**Container Widths:**
- Main content: max-w-7xl
- Product list: max-w-full (optimized for data tables)
- Forms: max-w-2xl

**Grid System:**
- Registration form: 2-column grid on desktop (company + representative info side-by-side)
- Admin dashboard: Sidebar (w-64) + main content area
- Product list: Full-width table/list layout (NOT card grid)

---

## Component Library

### Navigation
- **Header:** Sticky top navigation with logo, category dropdown, search (desktop), account menu, and cart icon with badge
- **Category Navigation:** Horizontal scrolling category pills beneath main header
- **Mobile:** Hamburger menu with slide-out drawer

### Product Display (Critical - List Format)
**Table/List Structure:**
- Row-based layout with columns: [Product Image (small, 60x60)] | [Product Name + SKU] | [Price] | [Stock Status] | [Quantity Input] | [Add to Cart Icon]
- Alternating row background (subtle gray) for readability
- Hover state on entire row
- Compact vertical spacing (py-3 per row)
- Sticky table header when scrolling

### Forms
**Business Registration:**
- Two-column layout: Business Details (left) + Representative Details (right)
- Input fields: Outlined style with labels above
- Required field indicators with asterisks
- Submit button: Full-width primary CTA at bottom

**Fields:**
- Text inputs: h-12 with border-2
- Textarea (delivery address): h-24
- Phone input with country code dropdown
- Messenger selection: Radio buttons with icons (Telegram, WhatsApp, Viber)

### Cart & Ordering
- **Cart Sidebar:** Slide-out from right, fixed overlay
- **Cart Items:** Compact list with thumbnail, name, quantity spinner, subtotal, remove icon
- **Order Summary:** Sticky at bottom with subtotal, estimated total, "Request Quote" button
- **Empty Cart State:** Icon + message + "Browse Products" CTA

### Admin Dashboard
- **Sidebar Navigation:** Fixed left sidebar (w-64) with sections:
  - Pending Registrations (with badge count)
  - Products Management
  - Quote Requests
  - Approved Customers
- **Main Content:** Data tables with search, filters, and action buttons
- **Product Creation Form:** Multi-field form with name, description, price, ETA, stock status

### Authentication
- **Login/Register Modal:** Centered overlay with two tabs
- **Approval Pending Screen:** Full-page message with contact info after registration
- **Access Denied:** Redirect non-approved users to "pending approval" message

### Status Indicators
- **Stock Status:** Badges with colors (In Stock: green, Low Stock: yellow, Out of Stock: red, On Order: blue)
- **Order Status:** Similar badge system for quote requests
- **Approval Status:** User profile shows approval badge

---

## Animations
Use sparingly:
- Modal/drawer slide-in: 200ms ease-out
- Button hover: subtle scale (1.02) and shadow
- Row hover: background transition 150ms
- Loading states: Skeleton screens for product list

---

## Images

**Logo & Branding:**
- Chip.am logo in header (reuse from main site)
- Favicon consistency

**Product Images:**
- Small thumbnails in product list (60x60, rounded-md)
- Placeholder image for products without photos

**Category Icons:**
- Use same category imagery from main site for consistency
- Display in dropdown/navigation menus

**Hero Section:**
- No hero section needed - B2B portal should prioritize immediate product access
- Optional: Small banner (h-32) with key B2B value proposition and contact CTA

**Empty States:**
- Simple icon illustrations for empty cart, no products, no orders
- Minimal, non-distracting

---

## Key Page Structures

**Public Product Catalog (/):**
- Compact header with branding + login CTA
- Category filter pills
- Full-width product list/table (primary focus)
- Pagination at bottom

**Registration Page (/register):**
- Centered form (max-w-4xl)
- Two-column layout as described
- Progress indicator not needed (single-step form)

**Admin Dashboard (/admin):**
- Sidebar + main content split
- Data-dense tables with inline actions
- Search and filter controls prominent

**Cart/Checkout:**
- Slide-out cart drawer (not separate page)
- Final order review page before submission

---

## Accessibility
- ARIA labels on icon buttons
- Keyboard navigation for product list
- Focus indicators on all interactive elements
- Sufficient contrast ratios for table data
- Screen reader announcements for cart updates
# Sync ERP — Design System & Web Interface Guidelines

> **Status**: Approved Living Standard  
> **Source Foundations**: Vercel Web Interface Guidelines + Apple Human Interface Principles + Sync ERP Enterprise Ergonomics  
> **Aesthetic Theme**: Pure Enterprise Tech — Precision Slate, Deep Electric Blue, High-Contrast Tabular Data.

---

## 1. Core Philosophy

Sync ERP is built for speed, operational clarity, and zero-cognitive-friction workflows. An ERP is used for hours every day by business owners, operators, accountants, and warehouse managers. Every pixel must prioritize legibility, speed, and confidence.

1. **Clarity Over Novelty**: Predictable, rock-solid UI patterns over decorative whimsy.
2. **Data Density with Breathing Room**: Information-dense tables and cards balanced with crisp 8px-grid rhythm.
3. **Instant Visual Hierarchy**: Contrast leads the eye directly from primary action to secondary detail.
4. **Strict Color Discipline**: Color has meaning; never use color as mere decoration.

---

## 2. Strict Color Guardrails: THE "NO PURPLE" RULE

> [!CAUTION]
> **STRICT BAN ON PURPLE / INDIGO / VIOLET**  
> Under no circumstances should `indigo-*`, `purple-*`, or `violet-*` colors be used for primary actions, branding, backgrounds, or decorative gradients.  
> Saturated purple tones feel like generic AI consumer fluff or toy tools. Sync ERP is an enterprise financial and operational system.

### Approved Color Palette

#### Primary Neutral Foundation (Slate / Zinc)
Used for 90% of surfaces, typography, borders, and depth layering:
- **`slate-950`** (`#020617`): Deepest background for dark modes and high-contrast text.
- **`slate-900`** (`#0F172A`): Primary headings, body titles, active text, dark action buttons.
- **`slate-700`** (`#334155`): Secondary text, icon strokes, active table headers.
- **`slate-500`** (`#64748B`): Tertiary labels, captions, input placeholders, disabled text.
- **`slate-300`** (`#CBD5E1`): Card borders, inactive dividers, hover rings.
- **`slate-200`** (`#E2E8F0`): Default subtle container borders, dividers (`border-slate-200/80`).
- **`slate-100`** (`#F1F5F9`): Soft card backgrounds, tag containers, table header fills.
- **`slate-50`** (`#F8FAFC`): Page canvas background, subtle hover highlights.
- **`white`** (`#FFFFFF`): Elevated cards, modals, dropdowns, crisp inputs.

#### Primary Brand Accent (Deep Tech Blue & Electric Sky)
Used for primary calls-to-action, active steppers, focused input rings, and key links:
- **`blue-600`** (`#2563EB`): **The Primary Action Color**. High-contrast, trusted, enterprise-grade.
- **`blue-700`** (`#1D4ED8`): Hover/active state for primary buttons.
- **`blue-500`** (`#3B82F6`): Focus rings (`focus-visible:ring-blue-500/20`).
- **`blue-50`** (`#EFF6FF`): Primary badge background, selected row tint.
- **`sky-500`** (`#0EA5E9`): Secondary accent, analytics highlight, subtle gradient terminal stop.

#### Semantic Status Accents
Used strictly for operational feedback:
- **Success / Paid / Active**: **Emerald** (`emerald-600` `#059669`, bg: `emerald-50`, border: `emerald-200`)
- **Warning / Pending / Due**: **Amber** (`amber-500` `#D97706`, bg: `amber-50`, border: `amber-200`)
- **Danger / Overdue / Error**: **Rose** (`rose-600` `#E11D48`, bg: `rose-50`, border: `rose-200`)
- **Info / Neutral Status**: **Slate / Sky** (`slate-600`, bg: `slate-100`, border: `slate-200`)

---

## 3. Typography & Micro-copy

### Font Stack
- **Primary Interface**: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- **Tabular & Numerics**: Monospace with tabular numbers enabled:
  ```css
  font-feature-settings: "tnum" 1, "cv02" 1, "cv03" 1, "cv04" 1;
  font-variant-numeric: tabular-nums;
  ```
  *Every currency amount, transaction code, SKU, inventory quantity, and date MUST use `tabular-nums` so numbers align vertically across rows.*

### Copy Rules & Punctuation
- **Ellipsis**: Use the real unicode horizontal ellipsis `…` (`&hellip;`), never three periods `...`.
- **Loading states**: Must end with `…`: `"Loading…"`, `"Saving changes…"`, `"Creating company…"`.
- **Quotes**: Curly typographic quotes `“` `”` not typewriter quotes `"`.
- **Numbers**: Use numerals for quantities: `"8 items pending"`, not `"eight items pending"`.
- **Active voice & Clarity**: `"Create Company"`, `"Download Invoice"`, `"Reconcile Account"`. Never use vague labels like `"Submit"` or `"Proceed"`.
- **Non-breaking spaces**: Keep values with their units: `Rp&nbsp;250.000`, `⌘&nbsp;K`, `12&nbsp;units`.

---

## 4. Components & Spatial Layout

### Spacing & Grid
- Base unit: 4px / 8px grid (`p-2`, `p-4`, `p-6`, `gap-3`, `gap-4`).
- Interactive touch targets: **Minimum 44px height** (`min-h-[44px]` or `py-2.5 px-4`).
- Border radius standard:
  - Small badges/chips: `rounded-md` (6px) or `rounded-full`.
  - Inputs & Standard buttons: `rounded-xl` (12px).
  - Cards & Modal surfaces: `rounded-2xl` (16px).

### Elevation & Glassmorphism
- Never use heavy, dark pitch-black drop shadows.
- Use multi-stop ambient diffusion:
  - Surface: `bg-white/95 backdrop-blur-xl border border-slate-200/80`
  - Shadow: `shadow-sm shadow-slate-900/5` or `shadow-xl shadow-slate-900/10`

### Buttons Hierarchy
1. **Primary**: Solid Deep Blue (`bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-sm shadow-blue-600/20 font-semibold`).
2. **Secondary / Outline**: Clean White/Slate (`bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs`).
3. **Ghost / Tertiary**: Transparent (`hover:bg-slate-100 text-slate-600 hover:text-slate-900`).
4. **Destructive**: Rose (`bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20`).

### Forms & Input Fields
- Always provide an explicit `<label>` with `htmlFor` matching the input ID.
- Explicit `focus-visible` styling:
  ```css
  focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15
  ```
- **Never block pasting** (`onPaste` with `preventDefault` is strictly banned).
- Placeholders must end with `…` and show realistic format examples (e.g. `e.g. PT Maju Bersama…`).
- Errors must appear immediately below the input with an alert icon and `text-rose-600 text-xs`.

---

## 5. Motion & Transitions

- **Pre-requisite**: Honor `prefers-reduced-motion` at all times.
- **Never use `transition: all`**: Explicitly declare transitioned properties:
  `transition-colors duration-150`, `transition-transform duration-200 ease-out`.
- Keep durations short:
  - Hover & focus states: `150ms`
  - Card expansions / dropdowns: `200ms - 250ms`
  - Page transitions: `250ms`

---

## 6. Vercel Web Interface Guidelines Compliance Checklist

Before committing any frontend UI change:
- [ ] **No purple / indigo** used anywhere in colors, borders, rings, or gradients.
- [ ] Icon-only buttons have an explicit `aria-label`.
- [ ] Decorative icons have `aria-hidden="true"`.
- [ ] All clickable interactive elements are semantic `<button>` or `<a>`/`<Link>` (no clickable `<div onClick>`).
- [ ] Form inputs have visible `<label>` tags with matching `htmlFor`.
- [ ] Numbers and monetary columns use `font-variant-numeric: tabular-nums`.
- [ ] Ellipsis uses `…` instead of `...`.
- [ ] Inputs have visible `:focus-visible` rings with proper contrast.
- [ ] No `transition: all` — properties are listed explicitly.
- [ ] Touch targets are at least 44px tall.
- [ ] Unsaved changes warn before accidental exit.

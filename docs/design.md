---
name: SampleByte
colors:
  primary: "#1c1c1e"
  secondary: "#242427"
  accent: "#FF5500"
  accentBright: "#FF7733"
  neutral: "#2e2e31"
  overlay: "#38383c"
  border: "rgba(255,255,255,0.08)"
  borderBright: "rgba(255,255,255,0.16)"
  ink: "rgba(255,255,255,0.87)"
  muted: "rgba(255,255,255,0.55)"
  faint: "rgba(255,255,255,0.28)"
typography:
  h1:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  body-md:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  body-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, sans-serif"
    fontSize: "11px"
    fontWeight: 600
  meta:
    fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace"
    fontSize: "11px"
    fontWeight: 400
rounded:
  sm: "5px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "28px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    height: "28px"
  input:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
    height: "26px"
  segmented-control:
    backgroundColor: "rgba(255,255,255,0.06)"
    activeBackgroundColor: "rgba(255,255,255,0.13)"
    rounded: "{rounded.lg}"
    height: "32px"
  table-row:
    backgroundColor: "{colors.primary}"
    selectedBackgroundColor: "rgba(255,85,0,0.15)"
    height: "34px"
  dialog:
    backgroundColor: "{colors.overlay}"
    rounded: "{rounded.xl}"
  pad-slot:
    backgroundColor: "{colors.raised}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
---

# Design

SampleByte uses a macOS-first visual language and should feel like a first-party desktop utility, not a web app that happens to run on the desktop. Read this before touching any UI code.

---

## Guiding principle

The reference points are **Music.app** and **Xcode**: dark, high-information-density, every control sized and spaced per Apple's HIG. When in doubt, open one of those apps and copy what they do.

---

## Color tokens

Defined in `src/index.css` `@theme {}`. Every color used in the app must come from one of these tokens — no raw hex or `rgba()` values except where a token genuinely does not cover the case (e.g. a one-off `rgba(255,255,255,0.015)` stripe).

| Token | Value | When to use |
|---|---|---|
| `base` | `#1c1c1e` | Window background. Main content area. |
| `surface` | `#242427` | Elevated surfaces: toolbar, sidebar, column headers, card headers. One step above base. |
| `raised` | `#2e2e31` | Controls resting on surface: input fields, button hover fill, segmented control background. |
| `overlay` | `#38383c` | Highest elevation: popovers, context menus, active input fill. |
| `border` | `rgba(255,255,255,0.08)` | Default separator. Sidebar edge, row dividers, input border at rest. |
| `border-bright` | `rgba(255,255,255,0.16)` | Emphasized separator. Active/focused control border. |
| `ink` | `rgba(255,255,255,0.87)` | Primary text. Selected item label, headings, active state text. |
| `muted` | `rgba(255,255,255,0.55)` | Secondary text. Default sidebar item label, placeholder-like info. |
| `faint` | `rgba(255,255,255,0.28)` | Tertiary text. Column headers, kbd hints, timestamps at rest. |
| `accent` | `#FF5500` | Brand orange. Selected state fill, primary button background, playing indicator. |
| `accent-bright` | `#FF7733` | Hover state for accent elements. |

**Selected/active state**: use `bg-accent/15` for list row selections. This reads as a warm orange tint without being heavy.

Avoid ad hoc `text-white` or `bg-black`; use tokens or documented component variants. The primary button is the only current white-text exception and should stay centralized in the button component/token.

---

## Typography

Font stack: `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, sans-serif` (resolves to SF Pro on macOS). Set via `--font-family-ui` and `--font-family-brand` (currently identical — no custom web fonts).

Monospace: `'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace` via `--font-family-mono`. Use for all numbers that need to tabular-align (duration, BPM, key, pad labels) and for file format badges.

### Type scale

| Use | Size class | Weight |
|---|---|---|
| Section header (sidebar) | `text-[11px]` | `font-semibold` |
| Body / list item label | `text-[12px]` or `text-[13px]` | `font-normal` |
| Column header | `text-[11px]` | `font-medium` |
| Metadata / timestamps | `text-[11px]` or `text-[12px]` font-mono | `font-normal` |
| Dialog title | `text-[13px]` | `font-semibold` |
| Toolbar brand | `text-[13px]` | `font-semibold` |
| Keyboard hints | `text-[10px]` font-mono | `font-normal` |

Avoid `text-xs` (Tailwind's 12px) as a shorthand — be explicit with `text-[12px]` so sizes are intentional and searchable.

---

## Spacing and sizing

Base unit: **4px** (Tailwind's default). Standard increments: 4, 8, 12, 16, 20, 24.

### Control heights

| Control | Height |
|---|---|
| Toolbar | `h-11` (44px) |
| Small button / segmented segment | `h-[26px]` |
| Default button | `h-[28px]` |
| Large button | `h-[32px]` |
| Search field / small input | `h-[26px]` |
| Default input | `h-8` (32px) |
| Sidebar source list row | `h-[28px]` |
| Library table row | `h-[34px]` |
| Column header row | `h-8` (32px) |

### Border radius

| Context | Radius |
|---|---|
| Buttons, inputs, tags | `rounded-md` (6px) |
| Sidebar row selection | `rounded-md` (6px) |
| Segmented control outer | `rounded-[8px]` |
| Segmented control inner segment | `rounded-[5px]` |
| Dialogs / sheets | `rounded-xl` (12px) |
| Pad grid cells | `rounded-lg` (8px) |
| Icon containers | `rounded-lg` (8px) |

---

## Components

### Toolbar

`src/components/Toolbar.tsx`. The entire bar is `-webkit-app-region: drag` so the window can be moved by dragging anywhere on it. Every interactive element inside **must** override this with `-webkit-app-region: no-drag`.

```tsx
type ElectronStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }

// Drag zone
<div style={{ WebkitAppRegion: 'drag' } as ElectronStyle}>
  // Interactive child
  <button style={{ WebkitAppRegion: 'no-drag' } as ElectronStyle}>…</button>
</div>
```

Left zone: 72px padding for native traffic lights (set via `trafficLightPosition: { x: 16, y: 14 }` in `electron/main/index.ts`). Do not put content in this zone.

### Segmented control

Used for Chop/Library/Packs navigation and for any 2–3 option exclusive choice (e.g. source filter: All/Local/Freesound). Pattern:

```tsx
<div className="flex items-center p-[3px] rounded-[8px] bg-[rgba(255,255,255,0.06)]">
  {options.map(({ id, label }) => (
    <button
      key={id}
      className={cn(
        'h-[26px] px-3.5 rounded-[5px] text-[12px] font-medium transition-all duration-150 cursor-pointer border-0',
        active === id
          ? 'bg-[rgba(255,255,255,0.13)] text-ink'
          : 'text-muted hover:text-ink bg-transparent'
      )}
    >
      {label}
    </button>
  ))}
</div>
```

Never use underline tabs or radio-button groups where a segmented control fits.

### Sidebar (source list)

`src/components/AppSidebar.tsx`. Background is `bg-surface` (one step above base). Slides to `w-0 opacity-0` when hidden — no collapsed icon-only state.

Section headers:
```tsx
<p className="px-3 pt-3 pb-1 text-[11px] font-semibold text-faint select-none tracking-wide">
  Label
</p>
```

Row items: 28px tall, `rounded-md`, `px-2`. Selection: `bg-accent/15`. No left-border indicator.

Actions on rows (rename, delete, etc.) are revealed on hover via `opacity-0 group-hover:opacity-100`. Keep them to the right inside the row; use 20×20px touch targets.

### Buttons (`src/components/ui/Button.tsx`)

| Variant | When to use |
|---|---|
| `primary` | Main call to action per context. Orange fill, white text. |
| `outline` | Secondary actions alongside a primary button. |
| `ghost` | Tertiary/cancel actions. No background until hover. |
| `danger` | Destructive confirmation. Red text, subtle hover fill. |

Default size is `md` (28px). Use `sm` (26px) in dense areas like sidebar footers and toolbar.

### Dialogs

Centered sheet (`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`), `rounded-xl`, `max-w-sm`. Always include a close button in the top-right corner of the content (not the Radix default — it's been removed from `DialogContent`). Actions row at the bottom, right-aligned: Cancel (ghost) + Confirm (primary or danger).

### Library table

Column grid constant: `grid-cols-[1fr_64px_52px_44px_140px_52px]` — Name (flex), Duration, BPM, Key, Project, Actions. If columns change, update this constant. Column headers in `bg-surface`, rows alternate with a `rgba(255,255,255,0.015)` stripe on odd rows. Playing row gets `bg-accent/10`.

---

## macOS integration specifics

- **`titleBarStyle: 'hiddenInset'`** — native traffic lights overlay the app. Set in `electron/main/index.ts`. Do not set `frame: false`.
- **`backgroundColor: '#1c1c1e'`** — prevents white flash during load.
- **`trafficLightPosition: { x: 16, y: 14 }`** — centers lights in the 44px toolbar.
- **`user-select: none`** on `body` — prevents accidental text selection when clicking around the UI. Re-enabled on `input`, `textarea`, `[contenteditable]`.
- **Scrollbars** — 6px, `rgba(255,255,255,0.12)` thumb, no track. Matches macOS overlay scrollbar aesthetic.

---

## What to avoid

- **Custom web fonts** — DM Sans, Chakra Petch, JetBrains Mono have been removed. System font only.
- **ALL CAPS labels** — used in the old design. Replaced with mixed-case + `font-semibold` per macOS 13+ conventions.
- **Left-border active indicators** on list rows — replaced with full-row accent fill.
- **Card grid layouts** for collections — replaced with table/list views. Cards are a web pattern; lists are the macOS pattern.
- **Heavy drop shadows** — use `shadow-2xl shadow-black/60` only on dialogs. No shadows on inline components.
- **Orange-tinted borders** — the old `rgba(255,180,100,0.08)` border color. All borders are now neutral white-alpha.

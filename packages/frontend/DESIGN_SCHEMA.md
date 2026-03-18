# Lightrace Design Schema

> A Linear-inspired, dark-first design system for an LLM observability tool.
> Built on Tailwind CSS v4, shadcn/ui (base-nova), and OkLCH color science.

---

## 1. Design Principles

| Principle           | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| **Dark-first**      | Dark mode is the primary experience; light mode is a well-supported inverse |
| **Monochrome base** | Near-black/white surfaces with minimal chromatic color                      |
| **Signal color**    | A single brand accent (`--primary`) used sparingly for CTAs and focus       |
| **Calm density**    | Generous whitespace in layout, tight density in data-heavy panels           |
| **Linearity**       | Top-to-bottom, left-to-right reading flow — no cognitive dead ends          |
| **Depth via light** | Elevation communicated through subtle luminance shifts, not heavy shadows   |

---

## 2. Color System (OkLCH)

All colors use the OkLCH color space for perceptual uniformity.

### 2.1 Semantic Palette

#### Dark mode (primary)

| Token                    | Value                   | Usage                            |
| ------------------------ | ----------------------- | -------------------------------- |
| `--background`           | `oklch(0.13 0.004 285)` | App background (near-black blue) |
| `--foreground`           | `oklch(0.95 0 0)`       | Primary text                     |
| `--card`                 | `oklch(0.16 0.004 285)` | Elevated surface (cards, panels) |
| `--card-foreground`      | `oklch(0.95 0 0)`       | Card text                        |
| `--popover`              | `oklch(0.18 0.005 285)` | Popover/dropdown bg              |
| `--popover-foreground`   | `oklch(0.95 0 0)`       | Popover text                     |
| `--primary`              | `oklch(0.72 0.15 192)`  | Brand accent (cyan)              |
| `--primary-foreground`   | `oklch(0.98 0 0)`       | Text on primary                  |
| `--secondary`            | `oklch(0.20 0.004 285)` | Secondary surfaces               |
| `--secondary-foreground` | `oklch(0.90 0 0)`       | Secondary text                   |
| `--muted`                | `oklch(0.22 0.005 285)` | Muted backgrounds                |
| `--muted-foreground`     | `oklch(0.55 0 0)`       | Subdued text, placeholders       |
| `--accent`               | `oklch(0.24 0.005 285)` | Hover/active state bg            |
| `--accent-foreground`    | `oklch(0.95 0 0)`       | Hover state text                 |
| `--destructive`          | `oklch(0.65 0.2 25)`    | Error/danger                     |
| `--border`               | `oklch(1 0 0 / 8%)`     | Subtle borders                   |
| `--input`                | `oklch(1 0 0 / 12%)`    | Input borders                    |
| `--ring`                 | `oklch(0.72 0.15 192)`  | Focus ring (matches primary)     |

#### Light mode

| Token                    | Value                    | Usage                       |
| ------------------------ | ------------------------ | --------------------------- |
| `--background`           | `oklch(0.985 0.002 285)` | App background (warm white) |
| `--foreground`           | `oklch(0.14 0.004 285)`  | Primary text                |
| `--card`                 | `oklch(1 0 0)`           | Card surface (pure white)   |
| `--card-foreground`      | `oklch(0.14 0.004 285)`  | Card text                   |
| `--popover`              | `oklch(1 0 0)`           | Popover bg                  |
| `--popover-foreground`   | `oklch(0.14 0.004 285)`  | Popover text                |
| `--primary`              | `oklch(0.52 0.14 230)`   | Brand accent (blue, darker) |
| `--primary-foreground`   | `oklch(0.98 0 0)`        | Text on primary             |
| `--secondary`            | `oklch(0.955 0.003 285)` | Secondary surface           |
| `--secondary-foreground` | `oklch(0.20 0.004 285)`  | Secondary text              |
| `--muted`                | `oklch(0.955 0.003 285)` | Muted bg                    |
| `--muted-foreground`     | `oklch(0.45 0 0)`        | Subdued text                |
| `--accent`               | `oklch(0.94 0.003 285)`  | Hover bg                    |
| `--accent-foreground`    | `oklch(0.20 0.004 285)`  | Hover text                  |
| `--destructive`          | `oklch(0.55 0.22 27)`    | Error/danger                |
| `--border`               | `oklch(0 0 0 / 8%)`      | Subtle borders              |
| `--input`                | `oklch(0 0 0 / 12%)`     | Input borders               |
| `--ring`                 | `oklch(0.52 0.14 230)`   | Focus ring                  |

### 2.2 Status Colors

Used in trace/observation status indicators, badges, and charts.

| Token       | Dark value             | Light value            | Usage            |
| ----------- | ---------------------- | ---------------------- | ---------------- |
| `--success` | `oklch(0.72 0.19 145)` | `oklch(0.52 0.17 145)` | Success, healthy |
| `--warning` | `oklch(0.80 0.15 80)`  | `oklch(0.70 0.15 80)`  | Warning, slow    |
| `--error`   | `oklch(0.65 0.2 25)`   | `oklch(0.55 0.22 27)`  | Error, failed    |
| `--info`    | `oklch(0.72 0.12 230)` | `oklch(0.55 0.14 230)` | Info, neutral    |

### 2.3 Chart Colors

Perceptually balanced for data visualization. Optimized for contrast on dark backgrounds.

| Token       | Value                  | Hue    |
| ----------- | ---------------------- | ------ |
| `--chart-1` | `oklch(0.70 0.17 250)` | Blue   |
| `--chart-2` | `oklch(0.72 0.19 145)` | Green  |
| `--chart-3` | `oklch(0.75 0.14 55)`  | Amber  |
| `--chart-4` | `oklch(0.65 0.18 320)` | Purple |
| `--chart-5` | `oklch(0.68 0.15 190)` | Cyan   |

### 2.4 Sidebar Colors

| Token                          | Dark value              | Light value              |
| ------------------------------ | ----------------------- | ------------------------ |
| `--sidebar`                    | `oklch(0.11 0.004 285)` | `oklch(0.975 0.002 285)` |
| `--sidebar-foreground`         | `oklch(0.85 0 0)`       | `oklch(0.25 0.004 285)`  |
| `--sidebar-primary`            | `oklch(0.72 0.15 192)`  | `oklch(0.52 0.14 230)`   |
| `--sidebar-primary-foreground` | `oklch(0.98 0 0)`       | `oklch(0.98 0 0)`        |
| `--sidebar-accent`             | `oklch(0.18 0.005 285)` | `oklch(0.94 0.003 285)`  |
| `--sidebar-accent-foreground`  | `oklch(0.95 0 0)`       | `oklch(0.20 0.004 285)`  |
| `--sidebar-border`             | `oklch(1 0 0 / 6%)`     | `oklch(0 0 0 / 6%)`      |
| `--sidebar-ring`               | `oklch(0.72 0.15 192)`  | `oklch(0.52 0.14 230)`   |

---

## 3. Typography

### 3.1 Font Stack

| Role | Family        | Weights            | Fallback                |
| ---- | ------------- | ------------------ | ----------------------- |
| Sans | IBM Plex Sans | 300, 400, 500, 600 | system-ui, sans-serif   |
| Mono | IBM Plex Mono | 400, 500           | ui-monospace, monospace |

### 3.2 Type Scale

Compact scale optimized for a data-dense observability tool. Uses standard Tailwind classes — no arbitrary pixel values.

| Role            | Size | Tailwind            | Weight          | Tracking                   | Usage                                |
| --------------- | ---- | ------------------- | --------------- | -------------------------- | ------------------------------------ |
| `page-title`    | 18px | `text-lg`           | `font-semibold` | -0.01em (base rule)        | Page headings (Traces, Tools, etc.)  |
| `section-title` | 14px | `text-sm`           | `font-medium`   | normal                     | Card titles, panel headers           |
| `label`         | 12px | `text-xs`           | `font-medium`   | `uppercase tracking-wider` | Section labels (Input, Output, etc.) |
| `body`          | 14px | `text-sm`           | normal          | normal                     | Default body text                    |
| `caption`       | 12px | `text-xs`           | normal          | normal                     | Timestamps, metadata, badges         |
| `mono`          | 12px | `text-xs font-mono` | normal          | normal                     | Code, IDs, JSON, trace data          |

### 3.3 Typography Rules

- **Negative letter-spacing** (`-0.01em`) applied globally to `h1`, `h2`, `h3` via `@layer base` for Linear-style tighter headings
- **No arbitrary sizes** — only standard Tailwind classes (`text-xs`, `text-sm`, `text-lg`, etc.)
- **Label pattern**: all section labels use `text-xs font-medium text-muted-foreground uppercase tracking-wider` for consistent hierarchy
- **Monospace consistency**: all code/JSON/ID text uses `text-xs font-mono` — never `text-sm font-mono`
- All text uses `antialiased` rendering
- Login page title (`text-xl font-semibold`) is intentionally larger as a brand element

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

Uses Tailwind's default 4px-based scale. Key application points:

| Context            | Value    | Tailwind class |
| ------------------ | -------- | -------------- |
| Component padding  | 16px     | `p-4`          |
| Card padding       | 20px     | `p-5`          |
| Section gap        | 24px     | `gap-6`        |
| Page margin        | 32px     | `px-8`         |
| Sidebar width      | 240px    | `w-60`         |
| Tight density rows | 8px vert | `py-2`         |
| Input height       | 36px     | `h-9`          |
| Button height      | 32-36px  | `h-8` / `h-9`  |

### 4.2 Layout Principles

- **Max content width**: 1280px for main content area
- **Sidebar**: Fixed left, 240px, collapsible to icon-only (48px)
- **Header**: Sticky, 48px height, blurred background (`backdrop-blur-lg`)
- **Data tables**: Full width, horizontal scroll on overflow
- **Cards**: 1px border, no shadow in dark mode — elevation via luminance

---

## 5. Border Radius

| Token          | Value  | Usage                   |
| -------------- | ------ | ----------------------- |
| `--radius`     | 0.5rem | Base radius (8px)       |
| `--radius-sm`  | 0.3rem | Badges, small chips     |
| `--radius-md`  | 0.4rem | Inputs, buttons         |
| `--radius-lg`  | 0.5rem | Cards, dialogs          |
| `--radius-xl`  | 0.7rem | Large cards, modals     |
| `--radius-2xl` | 0.9rem | Feature panels          |
| Full           | 9999px | Pills, avatars, toggles |

---

## 6. Shadows & Elevation

Dark-first approach: minimal shadows, elevation via luminance shift.

| Level   | Dark mode                       | Light mode                                                 | Usage               |
| ------- | ------------------------------- | ---------------------------------------------------------- | ------------------- |
| Level 0 | None                            | None                                                       | Flat surface        |
| Level 1 | `0 1px 2px oklch(0 0 0 / 40%)`  | `0 1px 3px oklch(0 0 0 / 8%), 0 1px 2px oklch(0 0 0 / 4%)` | Cards, inputs       |
| Level 2 | `0 4px 12px oklch(0 0 0 / 50%)` | `0 4px 16px oklch(0 0 0 / 10%)`                            | Dropdowns, popovers |
| Level 3 | `0 8px 30px oklch(0 0 0 / 60%)` | `0 8px 32px oklch(0 0 0 / 12%)`                            | Modals, dialogs     |

---

## 7. Effects & Motion

### 7.1 Glassmorphism (used sparingly)

```css
/* Sticky header / floating toolbar */
.glass {
  background: oklch(0.13 0.004 285 / 70%);
  backdrop-filter: blur(16px) saturate(1.5);
  border-bottom: 1px solid oklch(1 0 0 / 6%);
}

/* Light mode variant */
.light .glass {
  background: oklch(0.985 0.002 285 / 80%);
  backdrop-filter: blur(16px) saturate(1.2);
  border-bottom: 1px solid oklch(0 0 0 / 6%);
}
```

### 7.2 Gradients

```css
/* Brand gradient — hero sections, feature highlights */
--gradient-brand: linear-gradient(135deg, oklch(0.72 0.15 192), oklch(0.6 0.18 230));

/* Subtle surface gradient — large panels, page backgrounds */
--gradient-surface: radial-gradient(ellipse at top, oklch(0.16 0.008 285), oklch(0.13 0.004 285));

/* Glow effect — behind primary CTAs on dark bg */
--glow-primary: 0 0 40px oklch(0.72 0.15 192 / 20%);
```

### 7.3 Transitions

| Property          | Duration | Easing                              | Usage             |
| ----------------- | -------- | ----------------------------------- | ----------------- |
| Color, bg, border | 150ms    | `cubic-bezier(0.4, 0, 0.2, 1)`      | Hover states      |
| Transform         | 200ms    | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Scale/spring      |
| Opacity           | 200ms    | `ease-out`                          | Fade in/out       |
| Layout (height)   | 300ms    | `cubic-bezier(0.4, 0, 0.2, 1)`      | Accordion, expand |

---

## 8. Component Patterns

### 8.1 Buttons

| Variant     | Background      | Text             | Border     |
| ----------- | --------------- | ---------------- | ---------- |
| Primary     | `--primary`     | `--primary-fg`   | none       |
| Secondary   | `--secondary`   | `--secondary-fg` | `--border` |
| Ghost       | transparent     | `--foreground`   | none       |
| Destructive | `--destructive` | white            | none       |
| Outline     | transparent     | `--foreground`   | `--border` |

- Height: 32px (sm), 36px (default), 40px (lg)
- Padding: 12px (sm), 16px (default), 20px (lg) horizontal
- Radius: `--radius-md`
- Hover: luminance shift +5% (dark) / -5% (light)
- Active: scale(0.98) with 100ms spring transition

### 8.2 Data Tables

- Header: `--muted` background, `caption` typography, uppercase tracking
- Rows: transparent bg, `--border` bottom separator
- Hover: `--accent` background
- Selected: `--primary / 10%` background
- Zebra striping: disabled (use hover for row identification)
- Cell padding: `px-4 py-2` (tight density for trace data)

### 8.3 Badges / Status Indicators

- Height: 20px
- Padding: `px-2`
- Radius: full (pill)
- Font: `caption` size, `font-medium`
- Status colors: filled bg at 15% opacity, text at full color
  - e.g., success: `bg-success/15 text-success`

### 8.4 Trace Tree (domain-specific)

- Indent: 20px per nesting level
- Connector lines: 1px `--border` color, left vertical + horizontal branch
- Node indicator: 8px circle, filled with status color
- Selected node: `--accent` bg, `--primary` left border (2px)
- Timing bar: horizontal bar showing relative duration, `--chart-1` fill

### 8.5 JSON / Code Viewer

- Background: `--muted` (one step above card)
- Font: `--font-mono`, `mono` size
- Syntax colors use dedicated `--syntax-*` tokens (derived from chart palette hues):

| Token              | Dark value             | Light value            | Usage       |
| ------------------ | ---------------------- | ---------------------- | ----------- |
| `--syntax-string`  | `oklch(0.72 0.19 145)` | `oklch(0.45 0.16 145)` | String vals |
| `--syntax-number`  | `oklch(0.70 0.17 250)` | `oklch(0.50 0.14 250)` | Number vals |
| `--syntax-boolean` | `oklch(0.75 0.14 55)`  | `oklch(0.55 0.12 55)`  | true/false  |
| `--syntax-null`    | `oklch(0.68 0.10 55)`  | `oklch(0.50 0.08 55)`  | null        |
| `--syntax-key`     | `oklch(0.70 0.16 300)` | `oklch(0.45 0.15 300)` | Object keys |

- Tailwind classes: `text-syntax-string`, `text-syntax-key`, etc.
- Line numbers: `--muted-foreground`, right-aligned, `border-r --border`

---

## 9. Iconography

- **Library**: Lucide React
- **Default size**: 16px (inline), 20px (buttons), 24px (navigation)
- **Stroke width**: 1.5px (thinner than default — matches Linear's refined feel)
- **Color**: inherits `currentColor`
- **Interactive icons**: 32×32 hit target minimum

---

## 10. Responsive Breakpoints

| Name  | Min-width | Layout change                          |
| ----- | --------- | -------------------------------------- |
| `sm`  | 640px     | Stack → inline for form controls       |
| `md`  | 768px     | Sidebar collapses to icon-only         |
| `lg`  | 1024px    | Sidebar expands, two-column trace view |
| `xl`  | 1280px    | Max content width reached              |
| `2xl` | 1536px    | Extra breathing room, wider panels     |

---

## 11. Accessibility

- **Contrast ratios**: All text meets WCAG 2.1 AA (4.5:1 body, 3:1 large/UI)
- **Focus indicators**: 2px `--ring` outline, 2px offset
- **Motion**: Respects `prefers-reduced-motion` — disables transitions
- **Color-blind safe**: Status communicated via icon + label, not color alone
- **Keyboard navigation**: All interactive elements focusable, logical tab order

---

## 12. Dark/Light Mode Strategy

- **Default**: System preference, user-overridable via toggle
- **Storage**: `next-themes` with `class` strategy
- **Approach**: CSS custom properties swap at `:root` / `.dark`
- **Transition**: 200ms fade on theme switch (avoids flash)
- **Images/media**: No inversion — use appropriate assets per theme

---

## Summary

Lightrace's design system draws from Linear's monochrome precision and dark-first philosophy while maintaining its own identity through:

1. **The OkLCH color space** for mathematically uniform color perception
2. **A warm near-black** (`285° hue hint`) instead of pure neutral — adds subtle depth
3. **IBM Plex typeface** for a technical, professional voice
4. **Minimal accent usage** — the brand cyan appears only on primary actions and focus
5. **Data-first density** — tight tables and trace trees, generous page-level spacing

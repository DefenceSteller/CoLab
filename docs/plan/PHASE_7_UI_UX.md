# Phase 7: UI/UX & Design System

**Status:** 🔄 In progress
**Started:** 2026-11-12
**Goal:** transform the basic UI into an **interactive, cool, professional,
"Gen Z" style** — production-grade look and feel.

## 7.1 Design direction

Dark, modern, **glassmorphic** chrome with vibrant **gradient accents** —
think Figma/Miro × Discord/Linear.

- **Canvas stays light** (drawing clarity), all surrounding UI goes dark.
- Gradient palette: **violet → fuchsia → cyan**.
- Rounded corners, soft shadows, smooth transitions, playful micro-interactions.
- Modern Google Font (Space Grotesk / Plus Jakarta Sans).
- **Stack unchanged:** Tailwind v4 + custom CSS + lucide-react. No new deps.

## 7.2 Work breakdown

### A. Design system (foundation)
- [x] CSS design tokens in `index.css` — colors, radii, shadows, fonts
- [x] Import modern Google Font (Space Grotesk, via `index.html`)
- [x] Gradient + glass utility classes (`.glass`, `.glass-strong`, `.gradient-text`, `.tool-btn`, `.swatch`, `.size-slider`, `.canvas-surface`)
- [x] Custom scrollbar, `::selection`, focus rings

### B. App shell
- [x] Dark background with subtle radial color glows (violet/fuchsia/cyan, fixed attachment)

### C. Header
- [x] Glassmorphic bar (backdrop-blur, translucent border, `.glass-strong`)
- [x] Gradient logo/title text + gradient logo mark (Sparkles icon)
- [x] Connection status → animated pulsing pill badge (Live/Offline + connected count)
- [x] User chip with colored avatar (initial)

### D. Toolbar (hero element)
- [x] Floating glass card (replaces plain white box)
- [x] Tool buttons: rounded, hover lift + glow, active gradient ring (`.tool-btn`)
- [x] Color swatches: selection ring + hover scale (`.swatch`)
- [x] Styled brush-size slider with live preview dot + glow (`.size-slider`)
- [x] Undo / redo / clear: consistent icon buttons, clear = red danger hover
- [x] Section labels (Tools / Color / Size) + dividers

### E. Canvas area
- [x] Elevated rounded card, soft shadow
- [x] Subtle grid background (`.canvas-surface`, 24px grid @ 4.5% opacity)
- [x] Custom crosshair cursor
- [x] **Fix:** `redrawCanvas` now clears to transparent (was painting solid white,
  which hid the grid)
- [x] **Fix:** window resize re-renders current strokes (was wiping the board)

### F. Sidebar
- [x] Glass panel containers — Collaborators panel (live) + Chat placeholder (Phase 5)

### G. Micro-interactions & polish
- [x] Hover/active transitions everywhere (180ms cubic-bezier)
- [x] Entrance animations (`.fade-in-up` header/toolbar, `.fade-in-up-delay` content)
- [x] Consistent focus states (`:focus-visible` rings), responsive classes throughout

## 7.3 Files to touch

- `Frontend/src/index.css` — tokens, fonts, utilities, scrollbar
- `Frontend/src/App.css` / `main.jsx` — shell background
- `Frontend/src/pages/BoardPage.jsx` — header + layout
- `Frontend/src/components/Board/Toolbar.jsx` — toolbar redesign
- `Frontend/src/components/Board/Canvas.jsx` — canvas container

## 7.4 Acceptance

- [x] App looks professional and modern at first glance
- [x] All tools/controls feel interactive (hover/active states)
- [x] Works on mobile widths (responsive classes)
- [x] No functional regressions (drawing still syncs — verified via HMR, no errors)

---

**Next after this step:** user will direct step 2 (production-readiness roadmap).

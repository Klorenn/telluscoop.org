# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

No build step. Open `Tellus Cooperative.html` directly in a browser, or serve it from a local HTTP server (required for the `image-slot` sidecar reads):

```bash
python3 -m http.server 8080
# then open http://localhost:8080/Tellus%20Cooperative.html
```

## Architecture

This is a **no-bundler browser prototype** running inside the "omelette" design host. React 18 and Babel are loaded from CDN; JSX files are transpiled in-browser at runtime. There is no build pipeline, TypeScript, or test suite.

### File roles

| File | Purpose |
|---|---|
| `Tellus Cooperative.html` | Entry point. Mounts the app, holds `TWEAK_DEFAULTS` |
| `foundation.jsx` | All page sections as one `FoundationSystem` component |
| `tweaks-panel.jsx` | Reusable design-tweaks shell and form controls |
| `tokens.css` / `styles/tokens.css` | Design tokens (CSS custom properties) |
| `foundation.css` | Component styles for `foundation.jsx` |
| `image-slot.js` | `<image-slot>` custom element for drag-and-drop image fills |

### Module system

There is none. Every component that must be shared across files is attached to `window`:

```js
// tweaks-panel.jsx exports
Object.assign(window, { useTweaks, TweaksPanel, TweakColor, ... });

// foundation.jsx exports
window.FoundationSystem = FoundationSystem;
```

The HTML entry point references them via `window.FoundationSystem`, `window.TweaksPanel`, etc.

### Design tokens

Three root palette colors are live-tweakable via the TweaksPanel:

- `--sand` (background) — default `#ECE0CC`
- `--teal` (primary) — default `#3F8487`
- `--clay` (accent) — default `#C75A2A`

They are set as CSS custom properties on `<html>` by the `App` component's `useEffect`. The `TWEAK_DEFAULTS` object in the HTML file is delimited by `/*EDITMODE-BEGIN*/` … `/*EDITMODE-END*/` — the omelette host rewrites that block on disk when the user saves tweaks.

### Scroll animations

`Reveal` is a thin wrapper around `useReveal` (IntersectionObserver). Add `<Reveal delay={N}>` around any element to have it fade+slide in on scroll. `delay` is in milliseconds.

### Animated counters

`useCountUp(target, run)` drives the stat counters. `run` is the boolean from `useReveal`'s `shown` state — the animation starts the moment the element enters the viewport.

### image-slot

`<image-slot id="…" shape="rect|circle|rounded|pill" placeholder="…">` is a custom element. It persists dropped images via a `.image-slots.state.json` sidecar file at the project root — this write only works inside the omelette runtime. Outside it, slots are read-only display.

### Fonts

- `--serif`: Fraunces (variable, optical-size aware)
- `--sans`: Inter
- `--mono`: JetBrains Mono

All loaded from Google Fonts in the HTML `<head>`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**themex** is a Shopify Online Store 2.0 theme built with Tailwind CSS v3.4 and vanilla JavaScript. No frontend frameworks — just Liquid, Tailwind utility classes, and plain JS with Web Components.

## Commands

```bash
# Development — run these two in separate terminals:
npm run dev          # Tailwind watch: src/input.css → assets/tailwind.css
npm run shopify      # Shopify theme dev server (shopify theme dev)

# Production build
npm run build:prod   # Minified Tailwind output

# Format
npx prettier --write .
```

There are no tests or linting commands configured.

## Architecture

### Build Pipeline

Tailwind CSS compiles `src/input.css` → `assets/tailwind.css`. Tailwind scans all `.liquid` files in layout/, templates/, sections/, snippets/, and blocks/ for class usage. No bundler (Vite/Webpack) — JS files in `assets/` are loaded directly.

### CSS Variables & Theming

`snippets/css-variables.liquid` outputs CSS custom properties from Shopify theme settings (fonts, colors). Tailwind references these via `extend` in `tailwind.config.js`:

- Colors: `--color-primary`, `--color-secondary`, `--color-accent`, `--color-foreground`, `--color-background`, `--color-muted`, `--color-border`, `--color-error`, `--color-success`
- Fonts: `--font-primary--family`, `--font-secondary--family`

Use Tailwind classes like `text-primary`, `bg-background`, `font-secondary` — they resolve to these CSS variables at runtime.

### Breakpoints

Custom breakpoints override Tailwind defaults: `xs: 480px`, `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`.

### JavaScript

Vanilla JS in `assets/`. Two patterns:
1. **Web Components** — `product-form.js`, `cart-drawer.js` use `customElements.define()`
2. **DOMContentLoaded scripts** — `product.js`, `header-javascript.js`, `collection.js`, etc.

Cross-component communication uses `CustomEvent` (e.g., `cart:refresh`). DOM selection uses `data-*` attributes (e.g., `data-product-price`, `data-cart-overlay`).

### Liquid Structure

- **Sections** (30): Self-contained with `{% schema %}` blocks. Each section owns its settings, blocks, and presets.
- **Snippets** (42): Reusable components rendered via `{% render %}`. Includes icon SVGs, cards (product/collection/article), form utilities, and the responsive `image.liquid`.
- **Templates** (15): JSON templates that compose sections. Located in `templates/`.
- **Layouts**: `theme.liquid` is the main layout. Section groups `header-group.json` and `footer-group.json` handle persistent header/footer.
- **Config**: `settings_schema.json` defines theme editor settings. `settings_data.json` stores current values.

### Key Files

- `src/input.css` — Tailwind entry point (directives only: `@tailwind base/components/utilities`). **NEVER add custom CSS here.**
- `assets/tailwind.css` — Compiled Tailwind output. **NEVER edit directly** — it is auto-generated from `src/input.css`.
- `assets/base.css` — CSS reset, `.page-width` utility, and **all custom component styles** (hamburger, cart states, variants, sliders, etc.). Any non-Tailwind CSS goes here.
- `snippets/css-variables.liquid` — Dynamic CSS custom properties from theme settings
- `snippets/meta-tags.liquid` — SEO, Open Graph, structured data
- `snippets/image.liquid` — Responsive `<picture>` element with WebP and srcset

### Conventions

- **File naming**: kebab-case for all files
- **CSS classes**: BEM-inspired naming in base.css, Tailwind utilities in Liquid templates
- **JS DOM targeting**: `data-*` attributes, never class names
- **Settings IDs**: snake_case (e.g., `type_primary_font`, `color_primary`)
- **Snippets**: use `{% render %}` (not `{% include %}`)
- **Images**: always use lazy loading (`loading="lazy"`) except above-the-fold


## Project Standards — MANDATORY

Coding standards are provided as **plugin skills** from the `shopify-theme-toolkit` plugin listed in the system prompt. They are NOT files on disk — they must be invoked using the **Skill tool** before writing any code.

**Before writing or modifying any file, invoke the relevant skill(s):**
- **`.liquid` files** → invoke `shopify-theme-toolkit:liquid-standards`
- **`.js` files** → invoke `shopify-theme-toolkit:js-standards`
- **CSS / Tailwind / styling** → invoke `shopify-theme-toolkit:css-standards`
- **Section files** → invoke `shopify-theme-toolkit:section-standards` and `shopify-theme-toolkit:section-schema-standards`
- **New files / architecture decisions** → invoke `shopify-theme-toolkit:theme-architecture`

**This is non-negotiable.** Do not skip this step. Do not assume CLAUDE.md alone contains all standards. The plugin skills have detailed rules and checklists that must be followed.
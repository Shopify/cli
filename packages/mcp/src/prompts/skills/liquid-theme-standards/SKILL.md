---
name: liquid-theme-standards
description: "CSS, JavaScript, and HTML coding standards for Shopify Liquid themes. Covers BEM naming inside stylesheet tags, design tokens, CSS custom properties, Web Components for themes, defensive CSS, and progressive enhancement. Use when writing CSS/JS/HTML in .liquid files or theme asset files."
---

# CSS, JS & HTML Standards for Shopify Liquid Themes

## Core Principles

1. **Progressive enhancement** — semantic HTML first, CSS second, JS third
2. **No external dependencies** — native browser APIs only for JavaScript
3. **Design tokens** — never hardcode colors, spacing, or fonts
4. **BEM naming** — consistent class naming throughout
5. **Defensive CSS** — handle edge cases gracefully

## CSS in Liquid Themes

### Where CSS Lives

| Location | Liquid? | Use For |
|----------|---------|---------|
| `{% stylesheet %}` | No | Component-scoped styles (one per file) |
| `{% style %}` | Yes | Dynamic values needing Liquid (e.g., color settings) |
| `assets/*.css` | No | Shared/global styles |

**Critical:** `{% stylesheet %}` does NOT process Liquid. Use inline `style` attributes for dynamic values:

```liquid
{%- comment -%} Do: inline variables {%- endcomment -%}
<div
  class="hero"
  style="--bg-color: {{ section.settings.bg_color }}; --padding: {{ section.settings.padding }}px;"
>

{%- comment -%} Don't: Liquid inside stylesheet {%- endcomment -%}
{% stylesheet %}
  .hero { background: {{ section.settings.bg_color }}; } /* Won't work */
{% endstylesheet %}
```

### BEM Naming Convention

```
.block                      → Component root: .product-card
.block__element             → Child: .product-card__title
.block--modifier            → Variant: .product-card--featured
.block__element--modifier   → Element variant: .product-card__title--large
```

**Rules:**
- Hyphens separate words: `.product-card`, not `.productCard`
- Single element level only: `.block__element`, never `.block__el1__el2`
- Modifier always paired with base class: `class="btn btn--primary"`, never `class="btn--primary"` alone
- Start new BEM scope when a child could be standalone

```html
<!-- Good: single element level -->
<div class="product-card">
  <h3 class="product-card__title">{{ product.title }}</h3>
  <span class="product-card__button-label">{{ 'add_to_cart' | t }}</span>
</div>

<!-- Good: new BEM scope for standalone component -->
<div class="product-card">
  <button class="button button--primary">
    <span class="button__label">{{ 'add_to_cart' | t }}</span>
  </button>
</div>
```

### Specificity

- Target `0 1 0` (single class) wherever possible
- Maximum `0 4 0` for complex parent-child cases
- **Never** use IDs as selectors
- **Never** use `!important` (comment why if absolutely forced to)
- Avoid element selectors — use classes

### CSS Nesting

```css
/* Do: media queries inside selectors */
.header {
  width: 100%;

  @media screen and (min-width: 750px) {
    width: auto;
  }
}

/* Do: state modifiers with & */
.button {
  background: var(--color-primary);

  &:hover { background: var(--color-primary-hover); }
  &:focus-visible { outline: 2px solid var(--color-focus); }
  &[disabled] { opacity: 0.5; }
}

/* Do: parent modifier affecting children (single level) */
.card--featured {
  .card__title { font-size: var(--font-size-xl); }
}

/* Don't: nested beyond first level */
.parent {
  .child {
    .grandchild { } /* Too deep */
  }
}
```

### Design Tokens

Use CSS custom properties for all values — never hardcode colors, spacing, or fonts. Define a consistent scale and reference it everywhere.

**Example scale** (adapt to your theme's needs):

```css
:root {
  /* Spacing — use a consistent scale */
  --space-2xs: 0.5rem;    --space-xs: 0.75rem;   --space-sm: 1rem;
  --space-md: 1.5rem;     --space-lg: 2rem;       --space-xl: 3rem;

  /* Typography — relative units */
  --font-size-sm: 0.875rem;  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;  --font-size-xl: 1.25rem;  --font-size-2xl: 1.5rem;
}
```

**Key principles:**
- Use `rem` for spacing and typography (respects user font size preferences)
- Name tokens semantically: `--space-sm` not `--space-16`
- Define in `:root` for global tokens, on component root for scoped tokens

### CSS Variable Scoping

**Global** — in `:root` for theme-wide values
**Component-scoped** — on component root, namespaced:

```css
/* Do: namespaced */
.facets {
  --facets-padding: var(--space-md);
  --facets-z-index: 3;
}

/* Don't: generic names that collide */
.facets {
  --padding: var(--space-md);
  --z-index: 3;
}
```

**Override via inline style** for section/block settings:

```liquid
<section
  class="hero"
  style="
    --hero-bg: {{ section.settings.bg_color }};
    --hero-padding: {{ section.settings.padding }}px;
  "
>
```

### CSS Property Order

1. **Layout** — `position`, `display`, `flex-direction`, `grid-template-columns`
2. **Box model** — `width`, `margin`, `padding`, `border`
3. **Typography** — `font-family`, `font-size`, `line-height`, `color`
4. **Visual** — `background`, `opacity`, `border-radius`
5. **Animation** — `transition`, `animation`

### Logical Properties (RTL Support)

```css
/* Do: logical properties */
padding-inline: 2rem;
padding-block: 1rem;
margin-inline: auto;
border-inline-end: 1px solid var(--color-border);
text-align: start;
inset: 0;

/* Don't: physical properties */
padding-left: 2rem;
text-align: left;
top: 0; right: 0; bottom: 0; left: 0;
```

### Defensive CSS

```css
.component {
  overflow-wrap: break-word;        /* Prevent text overflow */
  min-width: 0;                     /* Allow flex items to shrink */
  max-width: 100%;                  /* Constrain images/media */
  isolation: isolate;               /* Create stacking context */
}

.image-container {
  aspect-ratio: 4 / 3;             /* Prevent layout shift */
  background: var(--color-surface); /* Fallback for missing images */
}
```

### Modern CSS Features

```css
/* Container queries for responsive components */
.product-grid { container-type: inline-size; }
@container (min-width: 400px) {
  .product-card { grid-template-columns: 1fr 1fr; }
}

/* Fluid spacing */
.section { padding: clamp(1rem, 4vw, 3rem); }

/* Intrinsic sizing */
.content { width: min(100%, 800px); }
```

### Performance

- Animate only `transform` and `opacity` (never layout properties)
- Use `will-change` sparingly — remove after animation
- Use `contain: content` for isolated rendering
- Use `dvh` instead of `vh` on mobile

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## JavaScript in Liquid Themes

### Where JS Lives

| Location | Liquid? | Use For |
|----------|---------|---------|
| `{% javascript %}` | No | Component-specific scripts (one per file) |
| `assets/*.js` | No | Shared utilities, Web Components |

### Web Component Pattern

```javascript
class ProductCard extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('[data-add-to-cart]');
    this.button?.addEventListener('click', this.#handleClick.bind(this));
  }

  disconnectedCallback() {
    // Clean up event listeners, abort controllers
  }

  async #handleClick(event) {
    event.preventDefault();
    this.button.disabled = true;

    try {
      const formData = new FormData();
      formData.append('id', this.dataset.variantId);
      formData.append('quantity', '1');

      const response = await fetch('/cart/add.js', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Failed');

      this.dispatchEvent(new CustomEvent('cart:item-added', {
        detail: await response.json(),
        bubbles: true
      }));
    } catch (error) {
      console.error('Add to cart error:', error);
    } finally {
      this.button.disabled = false;
    }
  }
}

customElements.define('product-card', ProductCard);
```

```liquid
<product-card data-variant-id="{{ product.selected_or_first_available_variant.id }}">
  <button data-add-to-cart>{{ 'products.add_to_cart' | t }}</button>
</product-card>
```

### JavaScript Rules

| Rule | Do | Don't |
|------|-----|-------|
| Loops | `for (const item of items)` | `items.forEach()` |
| Async | `async`/`await` | `.then()` chains |
| Variables | `const` by default | `let` unless reassigning |
| Conditionals | Early returns | Nested `if/else` |
| URLs | `new URL()` + `URLSearchParams` | String concatenation |
| Dependencies | Native browser APIs | External libraries |
| Private methods | `#methodName()` | `_methodName()` |
| Types | JSDoc `@typedef`, `@param`, `@returns` | Untyped |

### AbortController for Fetch

```javascript
class DataLoader extends HTMLElement {
  #controller = null;

  async load(url) {
    this.#controller?.abort();
    this.#controller = new AbortController();

    try {
      const response = await fetch(url, { signal: this.#controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
      return null;
    }
  }

  disconnectedCallback() {
    this.#controller?.abort();
  }
}
```

### Component Communication

**Parent → Child:** Call public methods
```javascript
this.querySelector('child-component')?.publicMethod(data);
```

**Child → Parent:** Dispatch custom events
```javascript
this.dispatchEvent(new CustomEvent('child:action', {
  detail: { value },
  bubbles: true
}));
```

## HTML Standards

### Native Elements First

| Need | Use | Not |
|------|-----|-----|
| Expandable | `<details>/<summary>` | Custom accordion with JS |
| Dialog/modal | `<dialog>` | Custom overlay div |
| Tooltip/popup | `popover` attribute | Custom positioned div |
| Search form | `<search>` | `<div class="search">` |
| Form results | `<output>` | `<span class="result">` |

### Progressive Enhancement

```liquid
{%- comment -%} Works without JS {%- endcomment -%}
<details class="accordion">
  <summary>{{ block.settings.heading }}</summary>
  <div class="accordion__content">
    {{ block.settings.content }}
  </div>
</details>

{%- comment -%} Enhanced with JS {%- endcomment -%}
{% javascript %}
  // Optional: smooth animation, analytics tracking
{% endjavascript %}
```

### Images

```liquid
{{ image | image_url: width: 800 | image_tag:
  loading: 'lazy',
  alt: image.alt | escape,
  width: image.width,
  height: image.height
}}
```

- `loading="lazy"` on all below-fold images
- Always set `width` and `height` to prevent layout shift
- Descriptive `alt` text; empty `alt=""` for decorative images

## JSON Template & Config Files

Theme templates (`templates/*.json`), section groups (`sections/*.json`), and config files (`config/settings_data.json`) are all JSON. Use `jq` via the `bash` tool to make surgical edits — it's safer and more reliable than string-based find-and-replace for structured data.

### Common patterns

```bash
# Add a section to a template
jq '.sections.new_section = {"type": "hero", "settings": {"heading": "Welcome"}}' templates/index.json > /tmp/out && mv /tmp/out templates/index.json

# Update a setting value
jq '.current.sections.header.settings.logo_width = 200' config/settings_data.json > /tmp/out && mv /tmp/out config/settings_data.json

# Reorder sections
jq '.order += ["new_section"]' templates/index.json > /tmp/out && mv /tmp/out templates/index.json

# Remove a section
jq 'del(.sections.old_banner) | .order -= ["old_banner"]' templates/index.json > /tmp/out && mv /tmp/out templates/index.json

# Read a nested value
jq '.sections.header.settings' templates/index.json
```

**Prefer `jq` over `edit`** for any `.json` file modification — it validates structure, handles escaping, and avoids whitespace/formatting issues.

## References

- [CSS patterns and examples](references/css-patterns.md)
- [JavaScript patterns and examples](references/javascript-patterns.md)

---
name: liquid-theme-a11y
description: "Implement WCAG 2.2 accessibility patterns in Shopify Liquid themes. Covers e-commerce-specific components including product cards, carousels, cart drawers, price display, forms, filters, and modals. Use when building accessible theme components, fixing accessibility issues, or reviewing ARIA patterns in .liquid files."
---

# Accessibility for Shopify Liquid Themes

## Core Principle

Every interactive component must work with keyboard only, screen readers, and reduced-motion preferences. Start with semantic HTML — add ARIA only when native semantics are insufficient.

## Decision Table: Which Pattern?

| Component | HTML Element | ARIA Pattern | Reference |
|-----------|-------------|-------------|-----------|
| Expandable content | `<details>/<summary>` | None needed | [Accordion](#accordion) |
| Modal/dialog | `<dialog>` | `aria-modal="true"` | [Modal](#modal) |
| Tooltip/popup | `[popover]` attribute | `role="tooltip"` fallback | [Tooltip](#tooltip) |
| Dropdown menu | `<nav>` + `<ul>` | `aria-expanded` on triggers | [Navigation](#dropdown-navigation) |
| Tab interface | `<div>` | `role="tablist/tab/tabpanel"` | [Tabs](#tabs) |
| Carousel/slider | `<div>` | `role="region"` + `aria-roledescription` | [Carousel](#carousel) |
| Product card | `<article>` | `aria-labelledby` | [Product card](#product-card) |
| Form | `<form>` | `aria-invalid`, `aria-describedby` | [Forms](#forms) |
| Cart drawer | `<dialog>` | Focus trap | [Cart drawer](#cart-drawer) |
| Price display | `<span>` | `aria-label` for context | [Prices](#price-display) |
| Filters | `<form>` + `<fieldset>` | `aria-expanded` for disclosures | [Filters](#product-filters) |

## Page Structure

### Landmarks

```html
<body>
  <a href="#main-content" class="skip-link">{{ 'accessibility.skip_to_content' | t }}</a>
  <header role="banner">
    <nav aria-label="{{ 'accessibility.main_navigation' | t }}">...</nav>
  </header>
  <main id="main-content">
    <!-- All page content inside main -->
  </main>
  <footer role="contentinfo">
    <nav aria-label="{{ 'accessibility.footer_navigation' | t }}">...</nav>
  </footer>
</body>
```

- Single `<header>`, `<main>`, `<footer>` per page
- Multiple `<nav>` elements must have distinct `aria-label`
- All content must live inside a landmark

### Skip Link

```css
.skip-link {
  position: absolute;
  inset-inline-start: -999px;
  z-index: 999;
}
.skip-link:focus {
  position: fixed;
  inset-block-start: 0;
  inset-inline-start: 0;
  padding: 1rem;
  background: var(--color-background);
  color: var(--color-foreground);
}
```

### Headings

- One `<h1>` per page, never skip levels (h1 → h3)
- Use real heading elements, not styled divs
- Template: `<h1>` is typically the page/product title

## Focus Management

### Focus Indicators

```css
/* All interactive elements */
:focus-visible {
  outline: 2px solid rgb(var(--color-focus));
  outline-offset: 2px;
}

/* High contrast mode */
@media (forced-colors: active) {
  :focus-visible {
    outline: 3px solid LinkText;
  }
}
```

- Minimum 3:1 contrast ratio for focus indicators
- Use `:focus-visible` (not `:focus`) to avoid showing on click
- Never `outline: none` without a visible replacement

### Focus Trapping (Modals/Drawers)

- Trap focus inside modals, drawers, and dialogs
- Return focus to trigger element on close
- First focusable element gets focus on open
- Query all focusable elements: `a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])`

See [focus and keyboard patterns](references/focus-and-keyboard.md) for full FocusTrap implementation.

## Component Patterns

### Product Card

```html
<article class="product-card" aria-labelledby="ProductTitle-{{ product.id }}">
  <a href="{{ product.url }}" class="product-card__link" aria-labelledby="ProductTitle-{{ product.id }}">
    <img
      src="{{ product.featured_image | image_url: width: 400 }}"
      alt="{{ product.featured_image.alt | escape }}"
      loading="lazy"
      width="{{ product.featured_image.width }}"
      height="{{ product.featured_image.height }}"
    >
  </a>
  <h3 id="ProductTitle-{{ product.id }}">
    <a href="{{ product.url }}">{{ product.title }}</a>
  </h3>
  <div class="product-card__price" aria-label="{{ 'products.price_label' | t: price: product.price | money }}">
    {{ product.price | money }}
  </div>
  <button
    class="product-card__quick-add"
    tabindex="-1"
    aria-label="{{ 'products.quick_add' | t: title: product.title }}"
  >
    {{ 'products.add_to_cart' | t }}
  </button>
</article>
```

**Rules:**
- Single tab stop per card (the main link)
- `tabindex="-1"` on mouse-only shortcuts (quick add)
- `aria-labelledby` on `<article>` pointing to the title
- Descriptive alt text on images; empty `alt=""` if decorative

### Carousel

```html
<div
  role="region"
  aria-roledescription="carousel"
  aria-label="{{ section.settings.heading | escape }}"
>
  <div class="carousel__controls">
    <button
      aria-label="{{ 'accessibility.previous_slide' | t }}"
      aria-controls="CarouselSlides-{{ section.id }}"
    >{% render 'icon-chevron-left' %}</button>
    <button
      aria-label="{{ 'accessibility.next_slide' | t }}"
      aria-controls="CarouselSlides-{{ section.id }}"
    >{% render 'icon-chevron-right' %}</button>
    <button
      aria-label="{{ 'accessibility.pause_slideshow' | t }}"
      aria-pressed="false"
    >{% render 'icon-pause' %}</button>
  </div>

  <div id="CarouselSlides-{{ section.id }}" aria-live="polite">
    {% for slide in section.blocks %}
      <div
        role="group"
        aria-roledescription="slide"
        aria-label="{{ 'accessibility.slide_n_of_total' | t: n: forloop.index, total: forloop.length }}"
        {% unless forloop.first %}aria-hidden="true"{% endunless %}
      >
        {{ slide.settings.content }}
      </div>
    {% endfor %}
  </div>
</div>
```

**Rules:**
- Auto-rotation minimum 5 seconds, pause on hover/focus
- Play/pause button required for auto-rotating carousels
- `aria-live="polite"` on slide container (set to `"off"` during auto-rotation)
- `aria-hidden="true"` on inactive slides
- Each slide: `role="group"` + `aria-roledescription="slide"`

### Modal

```html
<dialog
  id="Modal-{{ section.id }}"
  aria-labelledby="ModalTitle-{{ section.id }}"
  aria-modal="true"
>
  <div class="modal__header">
    <h2 id="ModalTitle-{{ section.id }}">{{ title }}</h2>
    <button
      type="button"
      aria-label="{{ 'accessibility.close' | t }}"
      on:click="/closeModal"
    >{% render 'icon-close' %}</button>
  </div>
  <div class="modal__content">
    <!-- Content -->
  </div>
</dialog>
```

**Rules:**
- Use native `<dialog>` element
- `aria-labelledby` pointing to the title
- Close on Escape key (native with `<dialog>`)
- Focus first interactive element on open
- Return focus to trigger on close

### Cart Drawer

Same as modal pattern but with additional:
- Live region for cart count updates: `<span aria-live="polite" aria-atomic="true">`
- Clear "remove item" buttons with `aria-label="{{ 'cart.remove_item' | t: title: item.title }}"`
- Quantity inputs with associated labels

### Forms

```html
<form action="{{ routes.cart_url }}" method="post">
  <div class="form__field">
    <label for="Email-{{ section.id }}">{{ 'forms.email' | t }}</label>
    <input
      type="email"
      id="Email-{{ section.id }}"
      name="email"
      required
      aria-required="true"
      autocomplete="email"
      aria-describedby="EmailError-{{ section.id }}"
    >
    <p
      id="EmailError-{{ section.id }}"
      class="form__error"
      role="alert"
      hidden
    >{{ 'forms.email_required' | t }}</p>
  </div>
</form>
```

**Rules:**
- Every input has a visible `<label>` with matching `for`/`id`
- Use `<fieldset>/<legend>` for radio/checkbox groups
- Error messages: `role="alert"` + `aria-describedby` linking to input
- `aria-invalid="true"` on invalid inputs
- `autocomplete` attributes on common fields
- Required fields: `required` + `aria-required="true"` + visual indicator

### Product Filters

```html
<form class="facets">
  <div class="facets__group">
    <button
      type="button"
      aria-expanded="false"
      aria-controls="FilterColor-{{ section.id }}"
    >{{ 'filters.color' | t }}</button>
    <fieldset id="FilterColor-{{ section.id }}" hidden>
      <legend class="visually-hidden">{{ 'filters.filter_by_color' | t }}</legend>
      {% for color in colors %}
        <label>
          <input type="checkbox" name="filter.color" value="{{ color }}">
          {{ color }}
        </label>
      {% endfor %}
    </fieldset>
  </div>
  <div aria-live="polite" aria-atomic="true">
    {{ 'filters.results_count' | t: count: results.size }}
  </div>
</form>
```

### Price Display

```html
{% if product.compare_at_price > product.price %}
  <div class="price" aria-label="{{ 'products.sale_price_label' | t: sale_price: product.price | money, original_price: product.compare_at_price | money }}">
    <s aria-hidden="true">{{ product.compare_at_price | money }}</s>
    <span>{{ product.price | money }}</span>
  </div>
{% else %}
  <div class="price">{{ product.price | money }}</div>
{% endif %}
```

- Use `aria-label` to provide full price context (sale vs. original)
- `aria-hidden="true"` on the visual strikethrough to avoid duplicate reading

### Accordion

```html
<details>
  <summary>{{ block.settings.heading }}</summary>
  <div class="accordion__content">
    {{ block.settings.content }}
  </div>
</details>
```

Native `<details>/<summary>` provides keyboard and screen reader support automatically.

### Tabs

```html
<div role="tablist" aria-label="{{ 'accessibility.product_tabs' | t }}">
  {% for tab in tabs %}
    <button
      role="tab"
      id="Tab-{{ tab.id }}"
      aria-selected="{% if forloop.first %}true{% else %}false{% endif %}"
      aria-controls="Panel-{{ tab.id }}"
      tabindex="{% if forloop.first %}0{% else %}-1{% endif %}"
    >{{ tab.title }}</button>
  {% endfor %}
</div>
{% for tab in tabs %}
  <div
    role="tabpanel"
    id="Panel-{{ tab.id }}"
    aria-labelledby="Tab-{{ tab.id }}"
    {% unless forloop.first %}hidden{% endunless %}
    tabindex="0"
  >{{ tab.content }}</div>
{% endfor %}
```

- Arrow keys navigate between tabs (left/right)
- Only active tab has `tabindex="0"`, others `-1`

### Dropdown Navigation

```html
<nav aria-label="{{ 'accessibility.main_navigation' | t }}">
  <ul role="list">
    {% for link in linklists.main-menu.links %}
      <li>
        {% if link.links.size > 0 %}
          <button aria-expanded="false" aria-controls="Submenu-{{ forloop.index }}">
            {{ link.title }}
          </button>
          <ul id="Submenu-{{ forloop.index }}" hidden role="list">
            {% for child in link.links %}
              <li><a href="{{ child.url }}">{{ child.title }}</a></li>
            {% endfor %}
          </ul>
        {% else %}
          <a href="{{ link.url }}">{{ link.title }}</a>
        {% endif %}
      </li>
    {% endfor %}
  </ul>
</nav>
```

### Tooltip

```html
<button aria-describedby="Tooltip-{{ block.id }}">
  {{ 'labels.info' | t }}
</button>
<div id="Tooltip-{{ block.id }}" role="tooltip" popover>
  {{ block.settings.tooltip_text }}
</div>
```

## Mobile Accessibility

- **Touch targets:** minimum 44x44px, 8px spacing between targets
- **No orientation lock:** never restrict to portrait/landscape
- **No hover-only content:** everything accessible via tap
- Use `dvh` instead of `vh` for mobile viewport units

## Animation & Motion

```css
/* Always provide reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- No flashing above 3 times per second
- Auto-playing animations need pause/stop controls
- Meaningful animations only — don't animate for decoration

## Visually Hidden Utility

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

Use for screen-reader-only content like labels and descriptions.

## Color Contrast

| Element | Minimum Ratio |
|---------|---------------|
| Normal text (<18px / <14px bold) | 4.5:1 |
| Large text (≥18px / ≥14px bold) | 3:1 |
| UI components & graphics | 3:1 |
| Focus indicators | 3:1 |

Never rely solely on color to convey information — always pair with text, icons, or patterns.

## References

- [Component accessibility patterns](references/component-patterns.md)
- [Focus and keyboard patterns](references/focus-and-keyboard.md)

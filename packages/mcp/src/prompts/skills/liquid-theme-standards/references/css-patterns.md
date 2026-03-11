# CSS Patterns for Shopify Liquid Themes

## Complete Component Example

```liquid
<section
  class="featured-collection"
  style="
    --section-padding: {{ section.settings.padding | default: 60 }}px;
    --columns: {{ section.settings.columns | default: 4 }};
  "
>
  {% if section.settings.heading != blank %}
    <h2 class="featured-collection__heading">{{ section.settings.heading }}</h2>
  {% endif %}

  <div class="featured-collection__grid">
    {% for product in collection.products limit: section.settings.limit %}
      {% render 'product-card', product: product %}
    {% endfor %}
  </div>
</section>

{% stylesheet %}
  .featured-collection {
    padding-block: var(--section-padding);
    container-type: inline-size;
  }

  .featured-collection__heading {
    font-size: var(--font-size-2xl);
    margin-block-end: var(--space-lg);
    text-align: center;
  }

  .featured-collection__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-md);
  }

  @container (min-width: 768px) {
    .featured-collection__grid {
      grid-template-columns: repeat(var(--columns), 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .featured-collection * {
      transition: none !important;
    }
  }
{% endstylesheet %}
```

## Layout Patterns

### CSS Grid for Page Layouts

```css
.section-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-lg);
}
```

### Flexbox for Component Layouts

```css
.product-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
```

### Page-Width Container

```css
.page-width {
  width: min(100%, var(--page-width));
  margin-inline: auto;
  padding-inline: var(--space-md);
}
```

### Full-Bleed with Content Constraint

```css
.full-bleed {
  display: grid;
  grid-template-columns: var(--space-md) 1fr var(--space-md);
}

.full-bleed > * {
  grid-column: 2;
}

.full-bleed > .full-width {
  grid-column: 1 / -1;
}
```

## Responsive Images

```css
.image-container {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

## Using :is() for Parent-Child Relationships

```css
/* Multiple parents, same child */
:is(.hero, .banner) .heading {
  font-size: var(--font-size-2xl);
}

/* Same parent, multiple children */
.card:is(.card--featured, .card--promoted) {
  border: 2px solid var(--color-accent);
}
```

Don't use `:is()` for simple comma-separated selectors — use regular comma separation instead.

## Variable Override Pattern

Use CSS variables to reduce redundancy across modifiers:

```css
.button {
  background: rgb(var(--button-color) / var(--button-opacity, 1));
  color: rgb(var(--button-text));
}

.button--secondary {
  --button-color: var(--color-secondary);
  --button-text: var(--color-foreground);
}

.button--outline {
  --button-color: transparent;
  --button-text: var(--color-accent);
  --button-opacity: 0;
}
```

## Focus Styles

```css
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

## Print Styles

```css
@media print {
  .no-print,
  .cart-drawer,
  .navigation__mobile {
    display: none !important;
  }

  a[href^='http']::after {
    content: ' (' attr(href) ')';
  }

  .product-card {
    break-inside: avoid;
  }
}
```

## Animation Patterns

```css
/* Safe defaults — only animate transform and opacity */
.product-card {
  transition: transform 0.2s ease;
}

.product-card:hover {
  transform: translateY(-2px);
}

/* will-change only during animation */
.product-card:hover {
  will-change: transform;
}
.product-card:not(:hover) {
  will-change: auto;
}
```

## CSS Documentation

```css
/* =============================================================================
   Product Card
   ============================================================================= */

/**
 * Card component for displaying product information.
 *
 * @example
 * <div class="product-card product-card--featured">
 *   <div class="product-card__image">...</div>
 *   <div class="product-card__info">...</div>
 * </div>
 */
.product-card { }
```

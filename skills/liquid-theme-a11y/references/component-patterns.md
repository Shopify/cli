# Component Accessibility Patterns

Detailed ARIA patterns for e-commerce components beyond what's covered in SKILL.md.

## Color Swatches

```html
<fieldset>
  <legend>{{ 'products.color' | t }}</legend>
  {% for color in product.options_by_name['Color'].values %}
    <button
      type="button"
      role="radio"
      aria-checked="{% if color == selected_color %}true{% else %}false{% endif %}"
      aria-label="{{ color }}"
      style="background-color: {{ color | handleize }}"
      class="color-swatch"
    >
      <span class="visually-hidden">{{ color }}</span>
    </button>
  {% endfor %}
</fieldset>
```

- Use `role="radio"` with `aria-checked` for single-select swatches
- Always provide text label (visually hidden if needed)
- Never rely on color alone — include text or pattern

## Breadcrumbs

```html
<nav aria-label="{{ 'accessibility.breadcrumb' | t }}">
  <ol role="list">
    <li><a href="/">{{ 'general.home' | t }}</a></li>
    <li><a href="{{ collection.url }}">{{ collection.title }}</a></li>
    <li aria-current="page">{{ product.title }}</li>
  </ol>
</nav>
```

- `aria-current="page"` on the current page (last item, no link)
- Use `<ol>` for ordered list semantics

## Tables (Size Charts, Specs)

```html
<table>
  <caption class="visually-hidden">{{ 'products.size_chart' | t }}</caption>
  <thead>
    <tr>
      <th scope="col">{{ 'products.size' | t }}</th>
      <th scope="col">{{ 'products.chest' | t }}</th>
      <th scope="col">{{ 'products.waist' | t }}</th>
    </tr>
  </thead>
  <tbody>
    {% for row in size_data %}
      <tr>
        <th scope="row">{{ row.size }}</th>
        <td>{{ row.chest }}</td>
        <td>{{ row.waist }}</td>
      </tr>
    {% endfor %}
  </tbody>
</table>
```

- Always use `<th scope="col|row">` for header cells
- `<caption>` describes the table purpose
- Wrap in scrollable container for mobile: `<div role="region" tabindex="0" aria-label="...">`

## Slider / Range Input

```html
<div role="group" aria-label="{{ 'filters.price_range' | t }}">
  <label for="PriceMin-{{ section.id }}">{{ 'filters.min_price' | t }}</label>
  <input
    type="range"
    id="PriceMin-{{ section.id }}"
    min="0"
    max="{{ max_price }}"
    value="{{ min_value }}"
    aria-valuemin="0"
    aria-valuemax="{{ max_price }}"
    aria-valuenow="{{ min_value }}"
    aria-valuetext="{{ min_value | money }}"
  >

  <label for="PriceMax-{{ section.id }}">{{ 'filters.max_price' | t }}</label>
  <input
    type="range"
    id="PriceMax-{{ section.id }}"
    min="0"
    max="{{ max_price }}"
    value="{{ max_value }}"
    aria-valuetext="{{ max_value | money }}"
  >
</div>
```

- `aria-valuetext` provides human-readable value (e.g., "$25.00" instead of "2500")

## Switch / Toggle

```html
<button
  role="switch"
  aria-checked="false"
  aria-label="{{ 'settings.dark_mode' | t }}"
>
  <span class="switch__thumb"></span>
</button>
```

- `role="switch"` with `aria-checked="true|false"`
- Toggle with Space or Enter key

## Combobox / Autocomplete

```html
<div class="combobox">
  <label for="Search-{{ section.id }}">{{ 'search.label' | t }}</label>
  <input
    type="text"
    id="Search-{{ section.id }}"
    role="combobox"
    aria-expanded="false"
    aria-autocomplete="list"
    aria-controls="SearchResults-{{ section.id }}"
    aria-activedescendant=""
  >
  <ul id="SearchResults-{{ section.id }}" role="listbox" hidden>
    <!-- Suggestions populated via JS -->
  </ul>
</div>
```

- Arrow keys navigate suggestions, update `aria-activedescendant`
- Escape clears, Enter selects
- `aria-expanded` reflects listbox visibility

## Disclosure (Show/Hide)

```html
<button
  type="button"
  aria-expanded="false"
  aria-controls="Content-{{ block.id }}"
>
  {{ block.settings.label }}
</button>
<div id="Content-{{ block.id }}" hidden>
  {{ block.settings.content }}
</div>
```

Simple show/hide toggle. If the content is a list of items (like a menu), prefer `<details>/<summary>`.

## Product Media Gallery

```html
<div role="region" aria-label="{{ 'products.media_gallery' | t }}">
  <div class="gallery__main" aria-live="polite">
    <img
      id="MainImage-{{ section.id }}"
      src="{{ current_image | image_url: width: 800 }}"
      alt="{{ current_image.alt | escape }}"
    >
  </div>

  <div class="gallery__thumbnails" role="list">
    {% for media in product.media %}
      <button
        role="listitem"
        aria-current="{% if forloop.first %}true{% else %}false{% endif %}"
        aria-label="{{ 'products.view_image_n' | t: n: forloop.index }}"
      >
        <img
          src="{{ media | image_url: width: 100 }}"
          alt=""
          loading="lazy"
        >
      </button>
    {% endfor %}
  </div>
</div>
```

- `aria-current="true"` on active thumbnail
- Empty `alt=""` on thumbnails (label via `aria-label`)
- `aria-live="polite"` on main image container

## Flip Card

```html
<div class="flip-card" tabindex="0" aria-label="{{ 'general.flip_to_reveal' | t }}">
  <div class="flip-card__front" aria-hidden="false">
    <!-- Front content -->
  </div>
  <div class="flip-card__back" aria-hidden="true">
    <!-- Back content -->
  </div>
</div>
```

- Both sides must be accessible (toggle `aria-hidden`)
- Respect `prefers-reduced-motion`: instant flip instead of animation
- Keyboard: Enter/Space to flip

## Live Regions for Dynamic Updates

```html
<!-- Cart count -->
<span aria-live="polite" aria-atomic="true" class="visually-hidden">
  {{ 'cart.item_count' | t: count: cart.item_count }}
</span>

<!-- Filter results count -->
<div aria-live="polite" aria-atomic="true">
  {{ 'filters.showing_results' | t: count: results.size }}
</div>

<!-- Form success -->
<div role="status" aria-live="polite">
  {{ 'forms.success_message' | t }}
</div>
```

- `aria-live="polite"` for non-urgent updates (cart count, filter results)
- `role="alert"` for errors (implicitly `aria-live="assertive"`)
- `aria-atomic="true"` to read entire region on update

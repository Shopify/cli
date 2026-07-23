# Liquid themes
Shopify storefront themes: Liquid, sections, theme blocks, snippets, schemas, settings, locales. Prove work with `shopify validate theme`.

## Corrections to stale training data
- `{% include %}` deprecated → `{% render %}` (isolated scope; pass variables as named args).
- `img_url`/`img_tag`/`article_img_url`/`product_img_url`/`collection_img_url` deprecated → `image_url` + `image_tag`. `image_url` REQUIRES `width:` or `height:` (max `5760`px) or it errors.
- Section schema `templates` attribute replaced by `enabled_on`/`disabled_on` (use exactly one).
- `checkout.liquid` is sunset → checkout UI extensions.
- Theme blocks are current: standalone `.liquid` files in `/blocks`, rendered via `{% content_for 'blocks' %}`. Legacy section-local blocks (defined in schema `blocks`, looped via `section.blocks`) still work; a section can't mix both kinds.
- Resource settings (`product`, `collection`, etc.) return the object, not a handle; `blank` when unset — guard with `{% if section.settings.collection != blank %}`.
- JSON in `{% schema %}` and `config/settings_schema.json` supports comments + trailing commas; `templates/*.json`, section groups, `settings_data.json`, `locales/*.json` don't persist them.

## Directory map
```text
assets/     static files; .css.liquid/.js.liquid get settings + filters only
blocks/     theme blocks (max 300/theme), nest ≤8 levels
config/     settings_schema.json (definitions) + settings_data.json (values)
layout/     theme.liquid REQUIRED — the only mandatory file
locales/    en.default.json etc.; *.schema.json for editor strings
sections/   sections (.liquid) + section groups (.json)
snippets/   {% render %} targets; document with {% doc %}
templates/  JSON or Liquid per page type (+ customers/, metaobject/)
```
No other subdirectories allowed. `layout/theme.liquid` must contain `{{ content_for_header }}` in `<head>` (never modify or parse it) and `{{ content_for_layout }}` in `<body>`, or it can't be saved.

- JSON templates: `{"layout": "full-width"|false, "wrapper": "div#id.class", "sections": {"main": {"type": "main"}}, "order": ["main"]}`. Limits: 25 sections/template, 50 blocks/section, 1000 JSON templates/theme. Section IDs alphanumeric only. A template is `.json` XOR `.liquid`; alternates: `product.alternate.json`. Sections need `presets` to appear in the Add-section picker.
- Section groups (`sections/header-group.json`): same `sections`/`order` shape plus `type` (`header`, `footer`, `aside`, or `custom.<name>`) and `name`; render in layout with `{% sections 'header-group' %}`. `{% section 'footer' %}` statically renders one section (shared instance/settings).

## Schema reference
One `{% schema %}` per file, valid JSON, never nested in another tag, outputs nothing.

Section schema keys: `name`, `tag` (only `article|aside|div|footer|header|section`), `class`, `limit` (1 or 2), `settings`, `blocks`, `max_blocks` (≤50), `presets`, `default` (static sections; not with presets), `locales`, `enabled_on`/`disabled_on` (`templates`: `["*"]`|page types; `groups`: `header|footer|aside|custom.<name>`).

Theme block schema keys: `name`, `settings`, `blocks` (only `{"type":"@theme"}`, `{"type":"@app"}`, or explicit types — no local child block definitions), `presets` (`name` required; optional `category`, `settings`, `blocks`), `tag` (string ≤50 chars, or `null` = no wrapper; then the single top-level element must carry `{{ block.shopify_attributes }}`), `class`.

Preset `blocks` entries need `type` (optional `settings`); static ones add `id` + `"static": true`. Editor block title: setting id `heading` > `title` > `text`, else block name.

Static blocks: `{% content_for 'block', type: 'slide', id: 'slide-1' %}` — `id` required, set by you (never generated). Extra named args pass through (`color: '#111'` → `{{ color }}` inside). They don't count toward `max_blocks` and are omitted from `block_order`.

## Settings
Attributes: `type`, `id`, `label` required; `default`, `info` optional; IDs unique per section/block.
- Basic: `checkbox`, `number`, `radio`, `range` (`min`,`max`,`step`, optional `unit`), `select` (`options` [{value,label}]), `text`, `textarea`
- Specialized: `article, article_list, blog, collection, collection_list, color, color_background, color_palette, color_scheme, color_scheme_group, font_picker, html, image_picker, inline_richtext, link_list, liquid, metaobject, metaobject_list, page, product, product_list, richtext, text_alignment, url, video, video_url`
Access: `{{ settings.x }}` (global), `{{ section.settings.x }}`, `{{ block.settings.x }}`. Dynamic sources (metafields/metaobjects) attach only to section/block settings, never theme settings.
`settings_schema.json` is an array; first entry `theme_info` requires `theme_name`, `theme_version`, `theme_author`, `theme_documentation_url`, and exactly one of `theme_support_email`/`theme_support_url` (extra keys error).

## Language essentials
- No parentheses in conditions; operators evaluate right-to-left; no ternary; `contains` works on strings/string arrays only.
- `for` caps at 50 iterations; `collection.products` fetches 50 by default — wrap in `{% paginate collection.products by 24 %}` … `{{ paginate | default_pagination }}{% endpaginate %}`.
- Tags: `assign, capture, if/elsif/else, unless, case/when, cycle, liquid, echo, layout, style, raw, comment`; `for` (`forloop.index|index0|first|last|length`); `render` (`{% render 'card' for products as product %}`).
- `{% form 'type' %}` types: `activate_customer_password, cart, contact, create_customer, currency, customer, customer_address, customer_login, guest_login, localization, new_comment, product, recover_customer_password, reset_customer_password, storefront_password` (`cart`/`product` need the matching object arg; `currency` deprecated → `localization`). Errors: `{{ form.errors | default_errors }}`.
- Filters — array: `where, map, reject, find, sort, uniq, compact, concat, sum, first, last, size, join`; string: `split, append, prepend, replace, remove, truncate, upcase, downcase, escape, handleize, strip_html, newline_to_br`; math: `plus, minus, times, divided_by, modulo, round, ceil, floor, abs, at_least, at_most`; money: `money, money_with_currency, money_without_trailing_zeros`; other: `t, date, default, json, image_url, image_tag, asset_url, stylesheet_tag, script_tag, placeholder_svg_tag, inline_asset_content, link_to, metafield_tag, structured_data, font_face, color_*`.
- Globals: `shop, cart, customer, collections, all_products, pages, blogs, articles, images, linklists, localization, metaobjects, request, routes, settings, template, theme, canonical_url, page_title, page_description`.
- LiquidDoc (top of snippets/static blocks): `{% doc %}` with `@description`, `@param {string|number|boolean|object} name - desc` (`[name]` = optional), `@example`. Theme Check fails missing/unrecognized/type-mismatched args on `render`/`content_for` calls.
- Every user-facing string: `{{ 'products.card.sold_out' | t }}` + key in `locales/en.default.json`; interpolation `| t: name: value`.

## Examples (validated)
`blocks/feature.liquid`:
```liquid
<div class="feature" style="--align: {{ block.settings.alignment }}" {{ block.shopify_attributes }}>
  <h2>{{ block.settings.heading }}</h2>
  {% content_for 'blocks' %}
</div>
{% stylesheet %}
  .feature { text-align: var(--align); }
{% endstylesheet %}
{% schema %}
{
  "name": "Feature",
  "blocks": [{"type": "@theme"}, {"type": "@app"}],
  "settings": [
    {"type": "text", "id": "heading", "label": "Heading", "default": "Feature"},
    {"type": "text_alignment", "id": "alignment", "label": "Alignment", "default": "center"}
  ],
  "presets": [{"name": "Feature"}]
}
{% endschema %}
```
`snippets/price.liquid`:
```liquid
{% doc %}
  Renders a price with optional compare-at.
  @param {number} price - Price in cents
  @param {number} [compare_at_price] - Original price when discounted
  @example
  {% render 'price', price: product.price %}
{% enddoc %}
<span class="price">{{ price | money }}</span>
{% if compare_at_price > price %}
  <s class="price__compare">{{ compare_at_price | money }}</s>
{% endif %}
```
`sections/featured-collection.liquid`:
```liquid
{% paginate section.settings.collection.products by 8 %}
  {% for product in section.settings.collection.products %}
    <a href="{{ product.url }}">
      {{ product.featured_image | image_url: width: 400 | image_tag: loading: 'lazy' }}
      {{ product.title | escape }} {{ product.price | money }}
    </a>
  {% endfor %}
  {{ paginate | default_pagination }}
{% endpaginate %}
{% schema %}
{
  "name": "Featured collection",
  "tag": "section",
  "settings": [
    {"type": "collection", "id": "collection", "label": "Collection"}
  ],
  "presets": [{"name": "Featured collection"}]
}
{% endschema %}
```

## Gotchas
- `all_products`: max 20 unique handles per page — use a collection for more.
- Liquid is NOT rendered inside `{% stylesheet %}`/`{% javascript %}` (one each per file; sections/blocks/snippets only). For setting-driven CSS, set inline `style="--gap: {{ block.settings.gap }}px"` and read the custom property.
- Never branch on literal `block.id` (dynamically generated); block IDs unique per immediate parent only.
- Sections referenced by templates/groups must exist in the theme or rendering errors.
- Snippets see globals only — pass everything else as `render` args; mutations don't propagate back.
- Never author or edit `custom_css` in section data (merchant-owned).

## Docs
https://shopify.dev/docs/storefronts/themes/architecture
https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema
https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/schema
https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings
https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates
https://shopify.dev/docs/storefronts/themes/tools/liquid-doc

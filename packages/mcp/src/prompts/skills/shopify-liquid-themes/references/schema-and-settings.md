# Schema & Settings Reference

## Section Schema Structure

The `{% schema %}` tag in sections accepts a JSON object with these top-level keys:

```json
{
  "name": "t:sections.my_section.name",
  "tag": "section",
  "class": "my-section",
  "limit": 1,
  "settings": [],
  "max_blocks": 16,
  "blocks": [{ "type": "@theme" }],
  "presets": [{ "name": "t:sections.my_section.name" }],
  "enabled_on": { "templates": ["product"], "groups": ["header"] },
  "disabled_on": { "templates": ["password"] },
  "default": { "settings": {}, "blocks": [] },
  "locales": {}
}
```

| Key | Type | Description |
|-----|------|-------------|
| `name` | string | Section title in theme editor (use `t:` prefix for translations) |
| `tag` | string | HTML wrapper element. Values: `article`, `aside`, `div`, `footer`, `header`, `section` |
| `class` | string | Additional CSS class on wrapper |
| `limit` | integer (1-2) | Max times section can be added to a template |
| `settings` | array | Array of setting objects (see Setting Types below) |
| `max_blocks` | integer (1-50) | Max blocks allowed in section (default 50) |
| `blocks` | array | Block type entries: `@theme`, `@app`, or custom types |
| `presets` | array | Default configurations for adding via theme editor |
| `enabled_on` | object | Restrict to specific templates/groups |
| `disabled_on` | object | Prevent on specific templates/groups |
| `default` | object | Default settings/blocks for static sections |
| `locales` | object | Inline translations (for portable sections) |

**Template values for `enabled_on`/`disabled_on`:** `*`, `404`, `article`, `blog`, `captcha`, `cart`, `collection`, `customers/account`, `customers/activate_account`, `customers/addresses`, `customers/login`, `customers/order`, `customers/register`, `customers/reset_password`, `gift_card`, `index`, `list-collections`, `metaobject`, `page`, `password`, `policy`, `product`, `search`

## Block Schema Structure

The `{% schema %}` tag in theme blocks (`.liquid` files in `blocks/`):

```json
{
  "name": "t:blocks.my_block.name",
  "tag": "div",
  "class": "my-block",
  "settings": [],
  "blocks": [{ "type": "@theme" }],
  "presets": [{ "name": "t:blocks.my_block.name" }]
}
```

| Key | Type | Description |
|-----|------|-------------|
| `name` | string | Block title in theme editor |
| `tag` | string/null | HTML wrapper (any string up to 50 chars, or `null` for no wrapper) |
| `class` | string | Additional CSS class (appended to `shopify-block`) |
| `settings` | array | Array of setting objects |
| `blocks` | array | Nested block entries: `@theme`, `@app`, or specific type names |
| `presets` | array | Default configurations for theme editor |

## Block Entry Types

In the `blocks` array of a section or block schema:

| Type | Description | Example |
|------|-------------|---------|
| `@theme` | Accept any theme block | `{ "type": "@theme" }` |
| `@app` | Accept app blocks | `{ "type": "@app" }` |
| Custom name | Accept a specific block file | `{ "type": "slide" }` |

## Setting Types (33 types)

### Sidebar Settings (no `id` required)

These organize the editor UI — they don't produce values:

| Type | Required Fields | Description |
|------|----------------|-------------|
| `header` | `type`, `content` | Section header in editor. Optional: `info`, `visible_if` |
| `paragraph` | `type`, `content` | Descriptive text in editor. Optional: `visible_if` |

### Input Settings (require `id` and `label`)

All input settings share these **standard attributes**:

| Attribute | Required | Description |
|-----------|----------|-------------|
| `type` | Yes | The setting type |
| `id` | Yes | Unique identifier, used to access value: `section.settings.{id}` or `block.settings.{id}` |
| `label` | Yes | Display label in editor (use `t:` prefix) |
| `default` | No | Default value |
| `info` | No | Helper text shown below the field |
| `visible_if` | No | Liquid expression controlling visibility |

### Resource Pickers

| Type | Returns | Extra Fields | Liquid Access |
|------|---------|--------------|---------------|
| `article` | article object | — | `section.settings.article.title` |
| `article_list` | array of articles | `limit` (max 50) | `{% for a in section.settings.articles %}` |
| `blog` | blog object | — | `section.settings.blog.title` |
| `collection` | collection object | — | `section.settings.collection.products` |
| `collection_list` | array of collections | `limit` (max 50) | `{% for c in section.settings.collections %}` |
| `metaobject` | metaobject entry | `metaobject_type` (required) | `section.settings.my_meta.field_name` |
| `metaobject_list` | array of metaobjects | `metaobject_type` (required), `limit` | `{% for m in section.settings.my_metas %}` |
| `page` | page object | — | `section.settings.page.content` |
| `product` | product object | — | `section.settings.product.title` |
| `product_list` | array of products | `limit` (max 50) | `{% for p in section.settings.products %}` |

### Text Inputs

| Type | Returns | Extra Fields | Notes |
|------|---------|--------------|-------|
| `text` | string | `placeholder` | Single-line text |
| `textarea` | string | `placeholder` | Multi-line text |
| `inline_richtext` | HTML string | — | Bold, italic, link (no `<p>` wrapping) |
| `richtext` | HTML string | — | Bold, italic, underline, link, paragraph, list |
| `html` | HTML string | `placeholder` | Raw HTML input |
| `liquid` | HTML string | — | HTML + limited Liquid markup |

### Number & Range

| Type | Returns | Extra Fields | Notes |
|------|---------|--------------|-------|
| `number` | number | `placeholder` | Single number input |
| `range` | number | `min` (required), `max` (required), `default` (required), `step`, `unit` | Slider with value |

### Boolean

| Type | Returns | Extra Fields | Notes |
|------|---------|--------------|-------|
| `checkbox` | boolean | `default` (boolean) | Toggle on/off |

### Selection

| Type | Returns | Extra Fields | Notes |
|------|---------|--------------|-------|
| `select` | string | `options` (required): array of `{value, label, group?}` | Dropdown / segmented control |
| `radio` | string | `options` (required): array of `{value, label}` | Radio buttons |
| `text_alignment` | string | `default`: `"left"`, `"center"`, or `"right"` | Segmented control with alignment icons |

### Media

| Type | Returns | Extra Fields | Notes |
|------|---------|--------------|-------|
| `image_picker` | image object | — | `section.settings.image \| image_url: width: 800 \| image_tag` |
| `video` | video object | — | `section.settings.video \| video_tag` |
| `video_url` | string (URL) | `accept` (required): `["youtube"]`, `["vimeo"]`, or both | External video URL |

### Color & Style

| Type | Returns | Extra Fields | Notes |
|------|---------|--------------|-------|
| `color` | color string | `alpha` (boolean, default true) | Color picker |
| `color_background` | CSS background string | — | Full CSS background value |
| `color_scheme` | color scheme ID | — | Theme color scheme picker |
| `color_scheme_group` | color scheme group | `definition` (required), `role` (required) | Advanced: defines color scheme sets |
| `font_picker` | font object | `default` (required) | Font from Shopify font library |

### Navigation

| Type | Returns | Extra Fields | Notes |
|------|---------|--------------|-------|
| `link_list` | linklist object | — | Menu picker |
| `url` | string | — | URL entry with resource picker |

## Conditional Visibility (`visible_if`)

Most input settings support `visible_if` — a Liquid expression that controls whether the setting is shown in the theme editor:

```json
{
  "type": "select",
  "id": "alignment",
  "label": "Alignment",
  "visible_if": "{{ block.settings.layout == 'vertical' }}",
  "options": [
    { "value": "left", "label": "Left" },
    { "value": "center", "label": "Center" }
  ]
}
```

The expression is evaluated against the current section/block settings. The setting is hidden (not removed) when the expression evaluates to false.

**Not supported on:** `article`, `article_list`, `blog`, `collection`, `collection_list`, `metaobject`, `metaobject_list`, `page`, `product`, `product_list`, `color_scheme_group`

## Presets

Presets define default configurations that appear in the theme editor's "Add section/block" menu:

```json
"presets": [
  {
    "name": "t:sections.hero.presets.default",
    "category": "t:categories.banner",
    "settings": {
      "heading": "Welcome",
      "height": 500
    },
    "blocks": [
      {
        "type": "text",
        "settings": { "text": "Hello" }
      }
    ]
  }
]
```

| Key | Required | Description |
|-----|----------|-------------|
| `name` | Yes | Preset name in editor (use `t:` prefix) |
| `category` | No | Groups preset under a category in editor |
| `settings` | No | Default setting values |
| `blocks` | No | Default blocks with their settings |

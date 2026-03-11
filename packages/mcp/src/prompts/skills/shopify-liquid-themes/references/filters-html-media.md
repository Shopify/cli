# Liquid Filters — Html media

> 45 filters across 5 categories.

## Color

### `brightness_difference`

- **Syntax**: `{{ string | brightness_difference: string }}`
- **Returns**: `number`
- Calculates the perceived brightness difference between two colors.

```liquid
{{ '#E800B0' | brightness_difference: '#FECEE9' }}
```

### `color_brightness`

- **Syntax**: `{{ string | color_brightness }}`
- **Returns**: `number`
- Calculates the perceived brightness of a given color.

```liquid
{{ '#EA5AB9' | color_brightness }}
```

### `color_contrast`

- **Syntax**: `{{ string | color_contrast: string }}`
- **Returns**: `number`
- Calculates the contrast ratio between two colors and returns the ratio's numerator. The ratio's denominator, which isn't
returned, is always 1. For example, with a contrast ratio of 3.5:1, this filter returns 3.5.

```liquid
{{ '#E800B0' | color_contrast: '#D9D8FF' }}
```

### `color_darken`

- **Syntax**: `{{ string | color_darken: number }}`
- **Returns**: `string`
- Darkens a given color by a specific percentage. The percentage must be between 0 and 100.

```liquid
{{ '#EA5AB9' | color_darken: 30 }}
```

### `color_desaturate`

- **Syntax**: `{{ string | color_desaturate: number }}`
- **Returns**: `string`
- Desaturates a given color by a specific percentage. The percentage must be between 0 and 100.

```liquid
{{ '#EA5AB9' | color_desaturate: 30 }}
```

### `color_difference`

- **Syntax**: `{{ string | color_difference: string }}`
- **Returns**: `number`
- Calculates the color difference between two colors.

```liquid
{{ '#720955' | color_difference: '#FFF3F9' }}
```

### `color_extract`

- **Syntax**: `{{ string | color_extract: string }}`
- **Returns**: `number`
- Extracts a specific color component from a given color.

```liquid
{{ '#EA5AB9' | color_extract: 'red' }}
```

### `color_lighten`

- **Syntax**: `{{ string | color_lighten: number }}`
- **Returns**: `string`
- Lightens a given color by a specific percentage. The percentage must be between 0 and 100.

```liquid
{{ '#EA5AB9' | color_lighten: 30 }}
```

### `color_mix`

- **Syntax**: `{{ string | color_mix: string, number }}`
- **Returns**: `string`
- Blends two colors together by a specific percentage factor. The percentage must be between 0 and 100.

```liquid
{{ '#E800B0' | color_mix: '#00936F', 50 }}
```

### `color_modify`

- **Syntax**: `{{ string | color_modify: string, number }}`
- **Returns**: `string`
- Modifies a specific color component of a given color by a specific amount.

```liquid
{{ '#EA5AB9' | color_modify: 'red', 255 }}
```

### `color_saturate`

- **Syntax**: `{{ string | color_saturate: number }}`
- **Returns**: `string`
- Saturates a given color by a specific percentage. The percentage must be between 0 and 100.

```liquid
{{ '#EA5AB9' | color_saturate: 30 }}
```

### `color_to_hex`

- **Syntax**: `{{ string | color_to_hex }}`
- **Returns**: `string`
- Converts a CSS color string to hexadecimal format (`hex6`).

```liquid
{{ 'rgb(234, 90, 185)' | color_to_hex }}
```

### `color_to_hsl`

- **Syntax**: `{{ string | color_to_hsl }}`
- **Returns**: `string`
- Converts a CSS color string to `HSL` format.

```liquid
{{ '#EA5AB9' | color_to_hsl }}
```

### `color_to_oklch`

- **Syntax**: `{{ string | color_to_oklch }}`
- **Returns**: `string`
- Converts a CSS color string to `OKLCH` format.

```liquid
{{ '#EA5AB9' | color_to_oklch }}
```

### `color_to_rgb`

- **Syntax**: `{{ string | color_to_rgb }}`
- **Returns**: `string`
- Converts a CSS color string to `RGB` format.

```liquid
{{ '#EA5AB9' | color_to_rgb }}
```

### `hex_to_rgba` *(deprecated)*

- **Syntax**: `{{ string | hex_to_rgba }}`
- **Returns**: `string`
- Converts a CSS color string from  hexadecimal format to `RGBA` format. Shorthand hexadecimal formatting (`hex3`) is also accepted.

```liquid
{{ '#EA5AB9' | hex_to_rgba }}
```

## Font

### `font_face`

- **Syntax**: `{{ font | font_face }}`
- **Returns**: `string`
- Generates a CSS `@font_face` declaration to load the provided font.

```liquid
{{ settings.type_header_font | font_face }}
```

### `font_modify`

- **Syntax**: `{{ font | font_modify: string, string }}`
- **Returns**: `font`
- Modifies a specific property of a given font.

```liquid
{%- assign bold_font = settings.type_body_font | font_modify: 'weight', 'bold' -%}

h2 {
  font-weight: {{ bold_font.weight }};
}
```

### `font_url`

- **Syntax**: `{{ font | font_url }}`
- **Returns**: `string`
- Returns the CDN URL for the provided font in `woff2` format.

```liquid
{{ settings.type_header_font | font_url }}
```

## Hosted file

### `asset_img_url`

- **Syntax**: `{{ string | asset_img_url }}`
- **Returns**: `string`
- Returns the CDN URL for an image in the
`assets` directory of a theme.

```liquid
{{ 'red-and-black-bramble-berries.jpg' | asset_img_url }}
```

### `asset_url`

- **Syntax**: `{{ string | asset_url }}`
- **Returns**: `string`
- Returns the CDN URL for a file in the
`assets` directory of a theme.

```liquid
{{ 'cart.js' | asset_url }}
```

### `file_img_url`

- **Syntax**: `{{ string | file_img_url }}`
- **Returns**: `string`
- Returns the CDN URL for an image from the
Files page of the Shopify admin.

```liquid
{{ 'potions-header.png' | file_img_url }}
```

### `file_url`

- **Syntax**: `{{ string | file_url }}`
- **Returns**: `string`
- Returns the CDN URL for a file from the
Files page of the Shopify admin.

```liquid
{{ 'disclaimer.pdf' | file_url }}
```

### `global_asset_url`

- **Syntax**: `{{ string | global_asset_url }}`
- **Returns**: `string`
- Returns the CDN URL for a global asset.

```liquid
{{ 'lightbox.js' | global_asset_url | script_tag }}

{{ 'lightbox.css' | global_asset_url | stylesheet_tag }}
```

### `shopify_asset_url`

- **Syntax**: `{{ string | shopify_asset_url }}`
- **Returns**: `string`
- Returns the CDN URL for a globally accessible Shopify asset.

```liquid
{{ 'option_selection.js' | shopify_asset_url }}
```

## Html

### `time_tag`

- **Syntax**: `{{ string | time_tag: string }}`
- **Returns**: `string`
- Converts a timestamp into an HTML `<time>` tag.

```liquid
{{ article.created_at | time_tag: '%B %d, %Y' }}
```

### `inline_asset_content`

- **Syntax**: `{{ asset_name | inline_asset_content }}`
- **Returns**: `string`
- Outputs the content of an asset inline in the template. The asset must be either a SVG, JS, or CSS file.

```liquid
{{ 'icon.svg' | inline_asset_content }}
```

### `highlight`

- **Syntax**: `{{ string | highlight: string }}`
- **Returns**: `string`
- Wraps all instances of a specific string, within a given string, with an HTML `<strong>` tag with a `class` attribute
of `highlight`.

```liquid
{% for item in search.results %}
  {% if item.object_type == 'product' %}
    {{ item.description | highlight: search.terms }}
  {% else %}
    {{ item.content | highlight: search.terms }}
  {% endif %}
{% endfor %}
```

### `link_to`

- **Syntax**: `{{ string | link_to: string }}`
- **Returns**: `string`
- Generates an HTML `<a>` tag.

```liquid
{{ 'Shopify' | link_to: 'https://www.shopify.com' }}
```

### `placeholder_svg_tag`

- **Syntax**: `{{ string | placeholder_svg_tag }}`
- **Returns**: `string`
- Generates an HTML `<svg>` tag for a given placeholder name.

```liquid
{{ 'collection-1' | placeholder_svg_tag }}
```

### `preload_tag`

- **Syntax**: `{{ string | preload_tag: as: string }}`
- **Returns**: `string`
- Generates an HTML `<link>` tag with a `rel` attribute of `preload` to prioritize loading a given Shopify-hosted asset.
The asset URL is also added to the Link header
with a `rel` attribute of `preload`.

```liquid
{{ 'cart.js' | asset_url | preload_tag: as: 'script' }}
```

### `script_tag`

- **Syntax**: `{{ string | script_tag }}`
- **Returns**: `string`
- Generates an HTML `<script>` tag for a given resource URL. The tag has a `type` attribute of `text/javascript`.

```liquid
{{ 'cart.js' | asset_url | script_tag }}
```

### `stylesheet_tag`

- **Syntax**: `{{ string | stylesheet_tag }}`
- **Returns**: `string`
- Generates an HTML `<link>` tag for a given resource URL. The tag has the following parameters:

| Attribute | Value |
| --- | --- |
| `rel` | `stylesheet` |
| `type` | `text/css` |
| `media` | `all` |

```liquid
{{ 'base.css' | asset_url | stylesheet_tag }}
```

## Media

### `external_video_tag`

- **Syntax**: `{{ variable | external_video_tag }}`
- **Returns**: `string`
- Generates an HTML `<iframe>` tag containing the player for a given external video. The input for the `external_video_tag`
filter can be either a `media` object or `external_video_url`.

```liquid
{% for media in product.media %}
  {% if media.media_type == 'external_video' %}
    {% if media.host == 'youtube' %}
      {{ media | external_video_url: color: 'white' | external_video_tag }}
    {% elsif media.host == 'vimeo' %}
      {{ media | external_video_url: loop: '1', muted: '1' | external_video_tag }}
    {% endif %}
  {% endif %}
{% endfor %}
```

### `external_video_url`

- **Syntax**: `{{ media | external_video_url: attribute: string }}`
- **Returns**: `string`
- Returns the URL for a given external video. Use this filter to specify parameters for the external video player generated
by the `external_video_tag` filter.

```liquid
{% for media in product.media %}
  {% if media.media_type == 'external_video' %}
    {% if media.host == 'youtube' %}
      {{ media | external_video_url: color: 'white' | external_video_tag }}
    {% elsif media.host == 'vimeo' %}
      {{ media | external_video_url: loop: '1', muted: '1' | external_video_tag }}
    {% endif %}
  {% endif %}
{% endfor %}
```

### `image_tag`

- **Syntax**: `{{ string | image_tag }}`
- **Returns**: `string`
- Generates an HTML `<img>` tag for a given `image_url`.

```liquid
{{ product | image_url: width: 200 | image_tag }}
```

### `media_tag`

- **Syntax**: `{{ media | media_tag }}`
- **Returns**: `string`
- Generates an appropriate HTML tag for a given media object.

```liquid
{% for media in product.media %}
  {{- media | media_tag }}
{% endfor %}
```

### `model_viewer_tag`

- **Syntax**: `{{ media | model_viewer_tag }}`
- **Returns**: `string`
- Generates a Google model viewer component for a given 3D model.

```liquid
{% for media in product.media %}
  {% if media.media_type == 'model' %}
    {{ media | model_viewer_tag }}
  {% endif %}
{% endfor %}
```

### `video_tag`

- **Syntax**: `{{ media | video_tag }}`
- **Returns**: `string`
- Generates an HTML `<video>` tag for a given video.

```liquid
{% for media in product.media %}
  {% if media.media_type == 'video' %}
    {{ media | video_tag }}
  {% endif %}
{% endfor %}
```

### `article_img_url` *(deprecated)*

- **Syntax**: `{{ variable | article_img_url }}`
- **Returns**: `string`
- Returns the CDN URL for an article's image.

```liquid
{{ article.image | article_img_url }}
```

### `collection_img_url` *(deprecated)*

- **Syntax**: `{{ variable | collection_img_url }}`
- **Returns**: `string`
- Returns the CDN URL for a collection's image.

```liquid
{{ collection.image | collection_img_url }}
```

### `image_url`

- **Syntax**: `{{ variable | image_url: width: number, height: number }}`
- **Returns**: `string`
- Returns the CDN URL for an image.

```liquid
{{ product | image_url: width: 450 }}
```

### `img_tag` *(deprecated)*

- **Syntax**: `{{ string | img_tag }}`
- **Returns**: `string`
- Generates an HTML `<img>` tag for a given image URL.

```liquid
{{ product | img_tag }}
```

### `img_url` *(deprecated)*

- **Syntax**: `{{ variable | img_url }}`
- **Returns**: `string`
- Returns the CDN URL for an image.

```liquid
{{ product | img_url }}
```

### `product_img_url` *(deprecated)*

- **Syntax**: `{{ variable | product_img_url }}`
- **Returns**: `string`
- Returns the CDN URL for a product image.

```liquid
{{ product.featured_image | product_img_url }}
```


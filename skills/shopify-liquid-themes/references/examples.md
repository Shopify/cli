# Complete Examples

Full, production-ready examples for each asset type. Use these as templates when generating Shopify Liquid theme code.

## Snippet Example

Snippets live in `snippets/`, are rendered via `{% render %}`, and use `{% doc %}` for documentation. They have no `{% schema %}` tag.

**File: `snippets/image.liquid`**

```liquid
{% doc %}
  Renders a responsive image that might be wrapped in a link.

  When `width`, `height` and `crop` are provided, the image will be rendered
  with a fixed aspect ratio.

  @param {image} image - The image to be rendered
  @param {string} [url] - An optional destination URL for the image
  @param {string} [css_class] - Optional class to be added to the image wrapper
  @param {number} [width] - The highest resolution width of the image to be rendered
  @param {number} [height] - The highest resolution height of the image to be rendered
  @param {string} [crop] - The crop position of the image

  @example
  {% render 'image', image: product.featured_image %}
  {% render 'image', image: product.featured_image, url: product.url %}
  {% render 'image',
    css_class: 'product__image',
    image: product.featured_image,
    url: product.url,
    width: 1200,
    height: 800,
    crop: 'center',
  %}
{% enddoc %}

{% liquid
  unless height
    assign width = width | default: image.width
  endunless

  if url
    assign wrapper = 'a'
  else
    assign wrapper = 'div'
  endif
%}

<{{ wrapper }}
  class="image {{ css_class }}"
  {% if url %}
    href="{{ url }}"
  {% endif %}
>
  {{ image | image_url: width: width, height: height, crop: crop | image_tag }}
</{{ wrapper }}>

{% stylesheet %}
  .image {
    display: block;
    position: relative;
    overflow: hidden;
    width: 100%;
    height: auto;
  }

  .image > img {
    width: 100%;
    height: auto;
  }
{% endstylesheet %}

{% javascript %}
  function doSomething() {
    // example
  }
  doSomething()
{% endjavascript %}
```

**Key patterns:**
- `{% doc %}` at the top documents params with types, optionality (`[param]`), and examples
- `{% liquid %}` block for multi-line logic (no delimiters needed per line)
- CSS variables for single-property settings, classes for multi-property
- One `{% stylesheet %}` and one `{% javascript %}` tag per file

## Block Example: Text

Blocks live in `blocks/`, have `{% schema %}` for settings, and use `{% doc %}` when statically rendered.

**File: `blocks/text.liquid`**

```liquid
{% doc %}
  Renders a text block.

  @example
  {% content_for 'block', type: 'text', id: 'text' %}
{% enddoc %}

<div
  class="text {{ block.settings.text_style }}"
  style="--text-align: {{ block.settings.alignment }}"
  {{ block.shopify_attributes }}
>
  {{ block.settings.text }}
</div>

{% stylesheet %}
  .text {
    text-align: var(--text-align);
  }
  .text--title {
    font-size: 2rem;
    font-weight: 700;
  }
  .text--subtitle {
    font-size: 1.5rem;
  }
{% endstylesheet %}

{% schema %}
{
  "name": "t:general.text",
  "settings": [
    {
      "type": "text",
      "id": "text",
      "label": "t:labels.text",
      "default": "Text"
    },
    {
      "type": "select",
      "id": "text_style",
      "label": "t:labels.text_style",
      "options": [
        { "value": "text--title", "label": "t:options.text_style.title" },
        { "value": "text--subtitle", "label": "t:options.text_style.subtitle" },
        { "value": "text--normal", "label": "t:options.text_style.normal" }
      ],
      "default": "text--title"
    },
    {
      "type": "text_alignment",
      "id": "alignment",
      "label": "t:labels.alignment",
      "default": "left"
    }
  ],
  "presets": [{ "name": "t:general.text" }]
}
{% endschema %}
```

**Key patterns:**
- `{{ block.shopify_attributes }}` required on the outermost block element
- CSS variable `--text-align` for single-property setting
- CSS class `text--title` for multi-property style variants
- All labels use `t:` translation keys
- `select` options use CSS class names as values when controlling multiple styles

## Block Example: Group (Nested Blocks)

Group blocks accept child blocks via `{% content_for 'blocks' %}` and `"blocks": [{ "type": "@theme" }]`.

**File: `blocks/group.liquid`**

```liquid
{% doc %}
  Renders a group of blocks with configurable layout direction, gap and
  alignment.

  @example
  {% content_for 'block', type: 'group', id: 'group' %}
{% enddoc %}

<div
  class="group {{ block.settings.layout_direction }}"
  style="
    --padding: {{ block.settings.padding }}px;
    --alignment: {{ block.settings.alignment }};
  "
  {{ block.shopify_attributes }}
>
  {% content_for 'blocks' %}
</div>

{% stylesheet %}
  .group {
    display: flex;
    flex-wrap: nowrap;
    overflow: hidden;
    width: 100%;
  }
  .group--horizontal {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 0 var(--padding);
  }
  .group--vertical {
    flex-direction: column;
    align-items: var(--alignment);
    padding: var(--padding) 0;
  }
{% endstylesheet %}

{% schema %}
{
  "name": "t:general.group",
  "blocks": [{ "type": "@theme" }],
  "settings": [
    {
      "type": "select",
      "id": "layout_direction",
      "label": "t:labels.layout_direction",
      "default": "group--vertical",
      "options": [
        { "value": "group--horizontal", "label": "t:options.direction.horizontal" },
        { "value": "group--vertical", "label": "t:options.direction.vertical" }
      ]
    },
    {
      "visible_if": "{{ block.settings.layout_direction == 'group--vertical' }}",
      "type": "select",
      "id": "alignment",
      "label": "t:labels.alignment",
      "default": "flex-start",
      "options": [
        { "value": "flex-start", "label": "t:options.alignment.left" },
        { "value": "center", "label": "t:options.alignment.center" },
        { "value": "flex-end", "label": "t:options.alignment.right" }
      ]
    },
    {
      "type": "range",
      "id": "padding",
      "label": "t:labels.padding",
      "default": 0,
      "min": 0,
      "max": 200,
      "step": 2,
      "unit": "px"
    }
  ],
  "presets": [
    {
      "name": "t:general.column",
      "category": "t:general.layout",
      "settings": {
        "layout_direction": "group--vertical",
        "alignment": "flex-start",
        "padding": 0
      }
    },
    {
      "name": "t:general.row",
      "category": "t:general.layout",
      "settings": {
        "layout_direction": "group--horizontal",
        "padding": 0
      }
    }
  ]
}
{% endschema %}
```

**Key patterns:**
- `"blocks": [{ "type": "@theme" }]` allows any theme block as child
- `{% content_for 'blocks' %}` renders the nested blocks
- `visible_if` conditionally shows the alignment setting only when vertical layout is selected
- Multiple presets (Column and Row) with different default settings
- `range` setting with required `min`, `max`, `default`, and optional `step`/`unit`

## Section Example

Sections live in `sections/`, always have `{% schema %}`, and use `{% content_for 'blocks' %}` to render their blocks.

**File: `sections/custom-section.liquid`**

```liquid
<div class="example-section full-width">
  {% if section.settings.background_image %}
    <div class="example-section__background">
      {{ section.settings.background_image | image_url: width: 2000 | image_tag }}
    </div>
  {% endif %}

  <div class="custom-section__content">
    {% content_for 'blocks' %}
  </div>
</div>

{% stylesheet %}
  .example-section {
    position: relative;
    overflow: hidden;
    width: 100%;
  }
  .example-section__background {
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: -1;
    overflow: hidden;
  }
  .example-section__background img {
    position: absolute;
    width: 100%;
    height: auto;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .example-section__content {
    display: grid;
    grid-template-columns: var(--content-grid);
  }

  .example-section__content > * {
    grid-column: 2;
  }
{% endstylesheet %}

{% schema %}
{
  "name": "t:general.custom_section",
  "blocks": [{ "type": "@theme" }],
  "settings": [
    {
      "type": "image_picker",
      "id": "background_image",
      "label": "t:labels.background"
    }
  ],
  "presets": [
    {
      "name": "t:general.custom_section"
    }
  ]
}
{% endschema %}
```

**Key patterns:**
- Sections use `section.settings.*` (not `block.settings.*`)
- No `{% doc %}` tag needed for sections (they are not rendered via `{% render %}`)
- `image_picker` setting accessed with `| image_url: width: N | image_tag` filter chain
- `{% content_for 'blocks' %}` renders merchant-configurable blocks
- Presets are required for sections to appear in "Add section" menu
- `"blocks": [{ "type": "@theme" }]` makes the section accept any theme block

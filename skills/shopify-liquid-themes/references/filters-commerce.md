# Liquid Filters — Commerce

> 30 filters across 8 categories.

## Cart

### `item_count_for_variant`

- **Syntax**: `{{ cart | item_count_for_variant: {variant_id} }}`
- **Returns**: `number`
- Returns the total item count for a specified variant in the `cart` object.

```liquid
{{ cart | item_count_for_variant: 39888235757633 }}
```

### `line_items_for`

- **Syntax**: `{{ cart | line_items_for: object }}`
- **Returns**: `array`
- Returns the subset of `cart` line items that include a specified product or variant.

```liquid
{% assign product = all_products['bloodroot-whole'] %}
{% assign line_items = cart | line_items_for: product %}

Total cart quantity for product: {{ line_items | sum: 'quantity' }}
```

## Collection

### `link_to_type`

- **Syntax**: `{{ string | link_to_type }}`
- **Returns**: `string`
- Generates an HTML `<a>` tag with an `href` attribute linking to a collection page that lists all products of the given
product type.

```liquid
{{ 'Health' | link_to_type }}
```

### `link_to_vendor`

- **Syntax**: `{{ string | link_to_vendor }}`
- **Returns**: `string`
- Generates an HTML `<a>` tag with an `href` attribute linking to a collection page that lists all products of a given
product vendor.

```liquid
{{ "Polina's Potent Potions" | link_to_vendor }}
```

### `sort_by`

- **Syntax**: `{{ string | sort_by: string }}`
- **Returns**: `string`
- Generates a collection URL with the provided `sort_by` parameter appended.
This filter must be applied to the object property `collection.url`.

```liquid
{{ collection.url | sort_by: 'best-selling' }}
```

### `url_for_type`

- **Syntax**: `{{ string | url_for_type }}`
- **Returns**: `string`
- Generates a URL for a collection page that lists all products of the given product type.

```liquid
{{ 'health' | url_for_type }}
```

### `url_for_vendor`

- **Syntax**: `{{ string | url_for_vendor }}`
- **Returns**: `string`
- Generates a URL for a collection page that lists all products from the given product vendor.

```liquid
{{ "Polina's Potent Potions" | url_for_vendor }}
```

### `within`

- **Syntax**: `{{ string | within: collection }}`
- **Returns**: `string`
- Generates a product URL within the context of the provided collection.

```liquid
{%- assign collection_product = collection.products.first -%}

{{ collection_product.url | within: collection }}
```

### `highlight_active_tag`

- **Syntax**: `{{ string | highlight_active_tag }}`
- **Returns**: `string`
- Wraps a given tag within the `collection` object in an HTML `<span>` tag, with a `class` attribute of `active`, if the tag is currently active. Only
applies to collection tags.

```liquid
{% for tag in collection.all_tags %}
  {{- tag | highlight_active_tag | link_to_tag: tag }}
{% endfor %}
```

## Customer

### `customer_login_link`

- **Syntax**: `{{ string | customer_login_link }}`
- **Returns**: `string`
- Generates an HTML link to the customer login page.

```liquid
{{ 'Log in' | customer_login_link }}
```

### `customer_logout_link`

- **Syntax**: `{{ string | customer_logout_link }}`
- **Returns**: `string`
- Generates an HTML link to log the customer out of their account and redirect to the homepage.

```liquid
{{ 'Log out' | customer_logout_link }}
```

### `customer_register_link`

- **Syntax**: `{{ string | customer_register_link }}`
- **Returns**: `string`
- Generates an HTML link to the customer registration page.

```liquid
{{ 'Create an account' | customer_register_link }}
```

### `avatar`

- **Syntax**: `{{ customer | avatar }}`
- **Returns**: `string`
- Generates HTML to render a customer's avatar, if available.

### `login_button`

- **Syntax**: `{{ shop | login_button }}`
- **Returns**: `string`
- Generates an HTML Button that enables a customer to either sign in to the storefront using their Shop account or follow the shop in the Shop App.

## Localization

### `currency_selector` *(deprecated)*

- **Syntax**: `{{ form | currency_selector }}`
- **Returns**: `string`
- Generates an HTML `<select>` element with an option for each currency available on the store.

```liquid
{% form 'currency' %}
  {{ form | currency_selector }}
{% endform %}
```

### `translate`

- **Syntax**: `{{ string | t }}`
- **Returns**: `string`
- Returns a string of translated text for a given translation key from a locale file.

### `format_address`

- **Syntax**: `{{ address | format_address }}`
- **Returns**: `string`
- Generates an HTML address display, with each address component ordered according to the address's locale.

```liquid
{{ shop.address | format_address }}
```

## Metafield

### `metafield_tag`

- **Syntax**: `{{ metafield | metafield_tag }}`
- **Returns**: `string`
- Generates an HTML element to host the data from a `metafield` object.
The type of element that's generated differs depending on the type of metafield.

```liquid
&lt;!-- boolean --&gt;
{{ product.metafields.information.seasonal | metafield_tag }}

&lt;!-- collection_reference --&gt;
{{ product.metafields.information.related_collection | metafield_tag }}

&lt;!-- color --&gt;
{{ product.metafields.details.potion_color | metafield_tag }}

&lt;!-- date --&gt;
{{ product.metafields.information.expiry | metafield_tag }}

&lt;!-- date_time --&gt;
{{ product.metafields.information.brew_date | metafield_tag }}

&lt;!-- json --&gt;
{{ product.metafields.information.burn_temperature | metafield_tag }}

&lt;!-- money --&gt;
{{ product.metafields.details.price_per_ml | metafield_tag }}

&lt;!-- multi_line_text_field --&gt;
{{ product.metafields.information.shipping | metafield_tag }}

&lt;!-- number_decimal --&gt;
{{ product.metafields.information.salinity | metafield_tag }}

&lt;!-- number_integer --&gt;
{{ product.metafields.information.doses_per_day | metafield_tag }}

&lt;!-- page_reference --&gt;
{{ product.metafields.information.dosage | metafield_tag }}

&lt;!-- product_reference --&gt;
{{ product.metafields.information.related_product | metafield_tag }}

&lt;!-- rating --&gt;
{{ product.metafields.details.rating | metafield_tag }}

&lt;!-- single_line_text_field --&gt;
{{ product.metafields.information.directions | metafield_tag }}

&lt;!-- url --&gt;
{{ product.metafields.information.health | metafield_tag }}

&lt;!-- variant_reference --&gt;
{{ product.metafields.information.best_seller | metafield_tag }}

&lt;!-- rich_text_field --&gt;
{{ product.metafields.information.rich_description | metafield_tag }}
```

### `metafield_text`

- **Syntax**: `{{ metafield | metafield_text }}`
- **Returns**: `string`
- Generates a text version of the data from a `metafield` object.

```liquid
{{ product.metafields.information.dosage | metafield_text }}
```

## Money

### `money`

- **Syntax**: `{{ number | money }}`
- **Returns**: `string`
- Formats a given price based on the store's **HTML without currency** setting.

```liquid
{{ product.price | money }}
```

### `money_with_currency`

- **Syntax**: `{{ number | money_with_currency }}`
- **Returns**: `string`
- Formats a given price based on the store's **HTML with currency** setting.

```liquid
{{ product.price | money_with_currency }}
```

### `money_without_currency`

- **Syntax**: `{{ number | money_without_currency }}`
- **Returns**: `string`
- Formats a given price based on the store's **HTML without currency** setting, without the currency symbol.

```liquid
{{ product.price | money_without_currency }}
```

### `money_without_trailing_zeros`

- **Syntax**: `{{ number | money_without_trailing_zeros }}`
- **Returns**: `string`
- Formats a given price based on the store's **HTML without currency** setting, excluding the decimal separator
(either `.` or `,`) and trailing zeros.

If the price has a non-zero decimal value, then the output is the same as the `money` filter.

```liquid
{{ product.price | money_without_trailing_zeros }}
```

## Payment

### `payment_button`

- **Syntax**: `{{ form | payment_button }}`
- **Returns**: `string`
- Generates an HTML container to host accelerated checkout buttons
for a product. The `payment_button` filter must be used on the `form` object within a product form.

```liquid
{% form 'product', product %}
  {{ form | payment_button }}
{% endform %}
```

### `payment_terms`

- **Syntax**: `{{ form | payment_terms }}`
- **Returns**: `string`
- Generates the HTML for the Shop Pay Installments banner.

### `payment_type_img_url`

- **Syntax**: `{{ string | payment_type_img_url }}`
- **Returns**: `string`
- Returns the URL for an SVG image of a given payment type.

```liquid
{% for type in shop.enabled_payment_types %}
&lt;img src="{{ type | payment_type_img_url }}" width="50" height="50" /&gt;
{% endfor %}
```

### `payment_type_svg_tag`

- **Syntax**: `{{ string | payment_type_svg_tag }}`
- **Returns**: `string`
- Generates an HTML `<svg>` tag for a given payment type.

```liquid
{% for type in shop.enabled_payment_types -%}
  {{ type | payment_type_svg_tag }}
{% endfor %}
```

## Tag

### `link_to_add_tag`

- **Syntax**: `{{ string | link_to_add_tag }}`
- **Returns**: `string`
- Generates an HTML `<a>` tag with an `href` attribute linking to the current blog or collection, filtered to show
only articles or products that have a given tag, as well as any currently active tags.

```liquid
{% for tag in collection.all_tags %}
  {%- if current_tags contains tag -%}
    {{ tag }}
  {%- else -%}
    {{ tag | link_to_add_tag: tag }}
  {%- endif -%}
{% endfor %}
```

### `link_to_remove_tag`

- **Syntax**: `{{ string | link_to_remove_tag }}`
- **Returns**: `string`
- Generates an HTML `<a>` tag with an `href` attribute linking to the current blog or collection, filtered to show
only articles or products that have any currently active tags, except the provided tag.

```liquid
{% for tag in collection.all_tags %}
  {%- if current_tags contains tag -%}
    {{ tag | link_to_remove_tag: tag }}
  {%- else -%}
    {{ tag | link_to_add_tag: tag }}
  {%- endif -%}
{% endfor %}
```

### `link_to_tag`

- **Syntax**: `{{ string | link_to_tag }}`
- **Returns**: `string`
- Generates an HTML `<a>` tag with an `href` attribute linking to the current blog or collection, filtered to show
only articles or products that have a given tag.

```liquid
{% for tag in collection.all_tags %}
  {{- tag | link_to_tag: tag }}
{% endfor %}
```


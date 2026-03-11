# Liquid Filters — Language

> 77 filters across 6 categories.

## Array

### `compact`

- **Syntax**: `{{ array | compact }}`
- **Returns**: `array`
- Removes any `nil` items from an array.

```liquid
{%- assign original_prices = collection.products | map: 'compare_at_price' -%}

Original prices:

{% for price in original_prices -%}
  - {{ price }}
{%- endfor %}

{%- assign compacted_original_prices = original_prices | compact -%}

Original prices - compacted:

{% for price in compacted_original_prices -%}
  - {{ price }}
{%- endfor %}
```

### `concat`

- **Syntax**: `{{ array | concat: array }}`
- **Returns**: `array`
- Concatenates (combines) two arrays.

```liquid
{%- assign types_and_vendors = collection.all_types | concat: collection.all_vendors -%}

Types and vendors:

{% for item in types_and_vendors -%}
  {%- if item != blank -%}
    - {{ item }}
  {%- endif -%}
{%- endfor %}
```

### `find`

- **Syntax**: `{{ array | find: string, string }}`
- **Returns**: `untyped`
- Returns the first item in an array with a specific property value.

```liquid
{% assign product = collection.products | find: 'vendor', "Polina's Potent Potions" %}

{{ product.title }}
```

### `find_index`

- **Syntax**: `{{ array | find_index: string, string }}`
- **Returns**: `number`
- Returns the index of the first item in an array with a specific property value.

```liquid
{% assign index = collection.products | find_index: 'vendor', "Polina's Potent Potions" %}

{{ index }}
```

### `first`

- **Syntax**: `{{ array | first }}`
- **Returns**: `untyped`
- Returns the first item in an array.

```liquid
{%- assign first_product = collection.products | first -%}

{{ first_product.title }}
```

### `has`

- **Syntax**: `{{ array | has: string, string }}`
- **Returns**: `boolean`
- Tests if any item in an array has a specific property value.

```liquid
{% assign has_potent_potions = collection.products | has: 'vendor', "Polina's Potent Potions" %}

{{ has_potent_potions }}
```

### `join`

- **Syntax**: `{{ array | join }}`
- **Returns**: `string`
- Combines all of the items in an array into a single string, separated by a space.

```liquid
{{ collection.all_tags | join }}
```

### `last`

- **Syntax**: `{{ array | last }}`
- **Returns**: `untyped`
- Returns the last item in an array.

```liquid
{%- assign last_product = collection.products | last -%}

{{ last_product.title }}
```

### `map`

- **Syntax**: `{{ array | map: string }}`
- **Returns**: `array`
- Creates an array of values from a specific property of the items in an array.

```liquid
{%- assign product_titles = collection.products | map: 'title' -%}

{{ product_titles | join: ', ' }}
```

### `reject`

- **Syntax**: `{{ array | reject: string, string }}`
- **Returns**: `array`
- Filters an array to exclude items with a specific property value.

```liquid
{% assign polina_products = collection.products | reject: 'vendor', "Polina's Potent Potions" %}

Products from other vendors than Polina's Potent Potions:

{% for product in polina_products -%}
  - {{ product.title }}
{%- endfor %}
```

### `reverse`

- **Syntax**: `{{ array | reverse }}`
- **Returns**: `array`
- Reverses the order of the items in an array.

```liquid
Original order:
{{ collection.products | map: 'title' | join: ', ' }}

Reverse order:
{{ collection.products | reverse | map: 'title' | join: ', ' }}
```

### `size`

- **Syntax**: `{{ variable | size }}`
- **Returns**: `number`
- Returns the size of a string or array.

```liquid
{{ collection.title | size }}
{{ collection.products | size }}
```

### `sort`

- **Syntax**: `{{ array | sort }}`
- **Returns**: `array`
- Sorts the items in an array in case-sensitive alphabetical, or numerical, order.

```liquid
{% assign tags = collection.all_tags | sort %}

{% for tag in tags -%}
  {{ tag }}
{%- endfor %}
```

### `sort_natural`

- **Syntax**: `{{ array | sort_natural }}`
- **Returns**: `array`
- Sorts the items in an array in case-insensitive alphabetical order.

```liquid
{% assign tags = collection.all_tags | sort_natural %}

{% for tag in tags -%}
  {{ tag }}
{%- endfor %}
```

### `sum`

- **Syntax**: `{{ array | sum }}`
- **Returns**: `number`
- Returns the sum of all elements in an array.

```liquid
{% assign fibonacci = '0, 1, 1, 2, 3, 5' | split: ', ' %}

{{ fibonacci | sum }}
```

### `uniq`

- **Syntax**: `{{ array | uniq }}`
- **Returns**: `array`
- Removes any duplicate items in an array.

```liquid
{% assign potion_array = 'invisibility, health, love, health, invisibility' | split: ', ' %}

{{ potion_array | uniq | join: ', ' }}
```

### `where`

- **Syntax**: `{{ array | where: string, string }}`
- **Returns**: `array`
- Filters an array to include only items with a specific property value.

```liquid
{% assign polina_products = collection.products | where: 'vendor', "Polina's Potent Potions" %}

Products from Polina's Potent Potions:

{% for product in polina_products -%}
  - {{ product.title }}
{%- endfor %}
```

## Date

### `date`

- **Syntax**: `{{ date | date: string }}`
- **Returns**: `string`
- Formats a date according to a specified format string.

## Default

### `default_errors`

- **Syntax**: `{{ string | default_errors }}`
- **Returns**: `string`
- Generates default error messages for each possible value of `form.errors`.

### `default`

- **Syntax**: `{{ variable | default: variable }}`
- **Returns**: `untyped`
- Sets a default value for any variable whose value is one of the following:

- `empty`
- `false`
- `nil`

```liquid
{{ product.selected_variant.url | default: product.url }}
```

### `default_pagination`

- **Syntax**: `{{ paginate | default_pagination }}`
- **Returns**: `string`
- Generates HTML for a set of links for paginated results. Must be applied to the `paginate` object.

```liquid
{% paginate collection.products by 2 %}
  {% for product in collection.products %}
    {{- product.title }}
  {% endfor %}

  {{- paginate | default_pagination -}}
{% endpaginate %}
```

## Format

### `date`

- **Syntax**: `{{ string | date: string }}`
- **Returns**: `string`
- Converts a timestamp into another date format.

```liquid
{{ article.created_at | date: '%B %d, %Y' }}
```

### `json`

- **Syntax**: `{{ variable | json }}`
- **Returns**: `string`
- Converts a string, or object, into JSON format.

```liquid
{{ product | json }}
```

### `structured_data`

- **Syntax**: `{{ variable | structured_data }}`
- **Returns**: `string`
- Converts an object into a schema.org structured data format.

```liquid
&lt;script type="application/ld+json"&gt;
  {{ product | structured_data }}
&lt;/script&gt;
```

### `unit_price_with_measurement`

- **Syntax**: `{{ number | unit_price_with_measurement: unit_price_measurement }}`
- **Returns**: `string`
- Formats a given unit price and measurement based on the store's **HTML without currency** setting.

```liquid
{%- assign variant = product.variants.first -%}

{{ variant.unit_price | unit_price_with_measurement: variant.unit_price_measurement }}
```

### `weight_with_unit`

- **Syntax**: `{{ number | weight_with_unit }}`
- **Returns**: `string`
- Generates a formatted weight for a `variant` object. The weight unit is
set in the general settings in the Shopify admin.

```liquid
{%- assign variant = product.variants.first -%}

{{ variant.weight | weight_with_unit }}
```

## Math

### `abs`

- **Syntax**: `{{ number | abs }}`
- **Returns**: `number`
- Returns the absolute value of a number.

```liquid
{{ -3 | abs }}
```

### `at_least`

- **Syntax**: `{{ number | at_least }}`
- **Returns**: `number`
- Limits a number to a minimum value.

```liquid
{{ 4 | at_least: 5 }}
{{ 4 | at_least: 3 }}
```

### `at_most`

- **Syntax**: `{{ number | at_most }}`
- **Returns**: `number`
- Limits a number to a maximum value.

```liquid
{{ 6 | at_most: 5 }}
{{ 4 | at_most: 5 }}
```

### `ceil`

- **Syntax**: `{{ number | ceil }}`
- **Returns**: `number`
- Rounds a number up to the nearest integer.

```liquid
{{ 1.2 | ceil }}
```

### `divided_by`

- **Syntax**: `{{ number | divided_by: number }}`
- **Returns**: `number`
- Divides a number by a given number. The `divided_by` filter produces a result of the same type as the divisor. This means if you divide by an integer, the result will be an integer, and if you divide by a float, the result will be a float.

```liquid
{{ 4 | divided_by: 2 }}

# divisor is an integer
{{ 20 | divided_by: 7 }}

# divisor is a float 
{{ 20 | divided_by: 7.0 }}
```

### `floor`

- **Syntax**: `{{ number | floor }}`
- **Returns**: `number`
- Rounds a number down to the nearest integer.

```liquid
{{ 1.2 | floor }}
```

### `minus`

- **Syntax**: `{{ number | minus: number }}`
- **Returns**: `number`
- Subtracts a given number from another number.

```liquid
{{ 4 | minus: 2 }}
```

### `modulo`

- **Syntax**: `{{ number | modulo: number }}`
- **Returns**: `number`
- Returns the remainder of dividing a number by a given number.

```liquid
{{ 12 | modulo: 5 }}
```

### `plus`

- **Syntax**: `{{ number | plus: number }}`
- **Returns**: `number`
- Adds two numbers.

```liquid
{{ 2 | plus: 2 }}
```

### `round`

- **Syntax**: `{{ number | round }}`
- **Returns**: `number`
- Rounds a number to the nearest integer.

```liquid
{{ 2.7 | round }}
{{ 1.3 | round }}
```

### `times`

- **Syntax**: `{{ number | times: number }}`
- **Returns**: `number`
- Multiplies a number by a given number.

```liquid
{{ 2 | times: 2 }}
```

## String

### `blake3`

- **Syntax**: `{{ string | blake3 }}`
- **Returns**: `string`
- Converts a string into a Blake3 hash.

```liquid
{{ '' | blake3 }}
```

### `hmac_sha1`

- **Syntax**: `{{ string | hmac_sha1: string }}`
- **Returns**: `string`
- Converts a string into an SHA-1 hash using a hash message authentication code (HMAC).

```liquid
{%- assign secret_potion = 'Polyjuice' | hmac_sha1: 'Polina' -%}

My secret potion: {{ secret_potion }}
```

### `hmac_sha256`

- **Syntax**: `{{ string | hmac_sha256: string }}`
- **Returns**: `string`
- Converts a string into an SHA-256 hash using a hash message authentication code (HMAC).

```liquid
{%- assign secret_potion = 'Polyjuice' | hmac_sha256: 'Polina' -%}

My secret potion: {{ secret_potion }}
```

### `md5`

- **Syntax**: `{{ string | md5 }}`
- **Returns**: `string`
- Converts a string into an MD5 hash. MD5 is not considered safe anymore. Please use 'blake3' instead for better security and performance.

```liquid
{{ '' | md5 }}
```

### `sha1`

- **Syntax**: `{{ string | sha1: string }}`
- **Returns**: `string`
- Converts a string into an SHA-1 hash. SHA-1 is not considered safe anymore. Please use 'blake3' instead for better security and performance.

```liquid
{%- assign secret_potion = 'Polyjuice' | sha1 -%}

My secret potion: {{ secret_potion }}
```

### `sha256`

- **Syntax**: `{{ string | sha256: string }}`
- **Returns**: `string`
- Converts a string into an SHA-256 hash. Please use 'blake3' instead for better security and performance.

```liquid
{%- assign secret_potion = 'Polyjuice' | sha256 -%}

My secret potion: {{ secret_potion }}
```

### `append`

- **Syntax**: `{{ string | append: string }}`
- **Returns**: `string`
- Adds a given string to the end of a string.

```liquid
{%-  assign path = product.url -%}

{{ request.origin | append: path }}
```

### `base64_decode`

- **Syntax**: `{{ string | base64_decode }}`
- **Returns**: `string`
- Decodes a string in Base64 format.

```liquid
{{ 'b25lIHR3byB0aHJlZQ==' | base64_decode }}
```

### `base64_encode`

- **Syntax**: `{{ string | base64_encode }}`
- **Returns**: `string`
- Encodes a string to Base64 format.

```liquid
{{ 'one two three' | base64_encode }}
```

### `base64_url_safe_decode`

- **Syntax**: `{{ string | base64_url_safe_decode }}`
- **Returns**: `string`
- Decodes a string in URL-safe Base64 format.

```liquid
{{ 'b25lIHR3byB0aHJlZQ==' | base64_url_safe_decode }}
```

### `base64_url_safe_encode`

- **Syntax**: `{{ string | base64_url_safe_encode }}`
- **Returns**: `string`
- Encodes a string to URL-safe Base64 format.

```liquid
{{ 'one two three' | base64_url_safe_encode }}
```

### `capitalize`

- **Syntax**: `{{ string | capitalize }}`
- **Returns**: `string`
- Capitalizes the first word in a string and downcases the remaining characters.

```liquid
{{ 'this sentence should start with a capitalized word.' | capitalize }}
```

### `downcase`

- **Syntax**: `{{ string | downcase }}`
- **Returns**: `string`
- Converts a string to all lowercase characters.

```liquid
{{ product.title | downcase }}
```

### `escape`

- **Syntax**: `{{ string | escape }}`
- **Returns**: `string`
- Escapes special characters in HTML, such as `<>`, `'`, and `&`, and converts characters into escape sequences. The filter doesn't effect characters within the string that don’t have a corresponding escape sequence.".

```liquid
{{ '&lt;p&gt;Text to be escaped.&lt;/p&gt;' | escape }}
```

### `escape_once`

- **Syntax**: `{{ string | escape_once }}`
- **Returns**: `string`
- Escapes a string without changing characters that have already been escaped.

```liquid
# applying the escape filter to already escaped text escapes characters in HTML entities:

{{ "&amp;lt;p&amp;gt;Text to be escaped.&amp;lt;/p&amp;gt;" | escape }}

# applying the escape_once filter to already escaped text skips characters in HTML entities:

{{ "&amp;lt;p&amp;gt;Text to be escaped.&amp;lt;/p&amp;gt;" | escape_once }}

# use escape_once to escape strings where a combination of HTML entities and non-escaped characters might be present:

{{ "&amp;lt;p&amp;gt;Text to be escaped.&amp;lt;/p&amp;gt; &amp; some additional text" | escape_once }}
```

### `lstrip`

- **Syntax**: `{{ string | lstrip }}`
- **Returns**: `string`
- Strips all whitespace from the left of a string.

```liquid
{%- assign text = '  Some potions create whitespace.      ' -%}

"{{ text }}"
"{{ text | lstrip }}"
```

### `newline_to_br`

- **Syntax**: `{{ string | newline_to_br }}`
- **Returns**: `string`
- Converts newlines (`\n`) in a string to HTML line breaks (`<br>`).

```liquid
{{ product.description | newline_to_br }}
```

### `prepend`

- **Syntax**: `{{ string | prepend: string }}`
- **Returns**: `string`
- Adds a given string to the beginning of a string.

```liquid
{%- assign origin = request.origin -%}

{{ product.url | prepend: origin }}
```

### `remove`

- **Syntax**: `{{ string | remove: string }}`
- **Returns**: `string`
- Removes any instance of a substring inside a string.

```liquid
{{ "I can't do it!" | remove: "'t" }}
```

### `remove_first`

- **Syntax**: `{{ string | remove_first: string }}`
- **Returns**: `string`
- Removes the first instance of a substring inside a string.

```liquid
{{ "I hate it when I accidentally spill my duplication potion accidentally!" | remove_first: ' accidentally' }}
```

### `remove_last`

- **Syntax**: `{{ string | remove_last: string }}`
- **Returns**: `string`
- Removes the last instance of a substring inside a string.

```liquid
{{ "I hate it when I accidentally spill my duplication potion accidentally!" | remove_last: ' accidentally' }}
```

### `replace`

- **Syntax**: `{{ string | replace: string, string }}`
- **Returns**: `string`
- Replaces any instance of a substring inside a string with a given string.

```liquid
{{ product.handle | replace: '-', ' ' }}
```

### `replace_first`

- **Syntax**: `{{ string | replace_first: string, string }}`
- **Returns**: `string`
- Replaces the first instance of a substring inside a string with a given string.

```liquid
{{ product.handle | replace_first: '-', ' ' }}
```

### `replace_last`

- **Syntax**: `{{ string | replace_last: string, string }}`
- **Returns**: `string`
- Replaces the last instance of a substring inside a string with a given string.

```liquid
{{ product.handle | replace_last: '-', ' ' }}
```

### `rstrip`

- **Syntax**: `{{ string | rstrip }}`
- **Returns**: `string`
- Strips all whitespace from the right of a string.

```liquid
{%- assign text = '  Some potions create whitespace.      ' -%}

"{{ text }}"
"{{ text | rstrip }}"
```

### `slice`

- **Syntax**: `{{ string | slice }}`
- **Returns**: `string`
- Returns a substring or series of array items, starting at a given 0-based index.

```liquid
{{ collection.title | slice: 0 }}
{{ collection.title | slice: 0, 5 }}

{{ collection.all_tags | slice: 1, 2 | join: ', ' }}
```

### `split`

- **Syntax**: `{{ string | split: string }}`
- **Returns**: `array`
- Splits a string into an array of substrings based on a given separator.

```liquid
{%- assign title_words = product.handle | split: '-' -%}

{% for word in title_words -%}
  {{ word }}
{%- endfor %}
```

### `strip`

- **Syntax**: `{{ string | strip }}`
- **Returns**: `string`
- Strips all whitespace from the left and right of a string.

```liquid
{%- assign text = '  Some potions create whitespace.      ' -%}

"{{ text }}"
"{{ text | strip }}"
```

### `strip_html`

- **Syntax**: `{{ string | strip_html }}`
- **Returns**: `string`
- Strips all HTML tags from a string.

```liquid
&lt;!-- With HTML --&gt;
{{ product.description }}

&lt;!-- HTML stripped --&gt;
{{ product.description | strip_html }}
```

### `strip_newlines`

- **Syntax**: `{{ string | strip_newlines }}`
- **Returns**: `string`
- Strips all newline characters (line breaks) from a string.

```liquid
&lt;!-- With newlines --&gt;
{{ product.description }}

&lt;!-- Newlines stripped --&gt;
{{ product.description | strip_newlines }}
```

### `truncate`

- **Syntax**: `{{ string | truncate: number }}`
- **Returns**: `string`
- Truncates a string down to a given number of characters.

```liquid
{{ article.title | truncate: 15 }}
```

### `truncatewords`

- **Syntax**: `{{ string | truncatewords: number }}`
- **Returns**: `string`
- Truncates a string down to a given number of words.

```liquid
{{ article.content | strip_html | truncatewords: 15 }}
```

### `upcase`

- **Syntax**: `{{ string | upcase }}`
- **Returns**: `string`
- Converts a string to all uppercase characters.

```liquid
{{ product.title | upcase }}
```

### `url_decode`

- **Syntax**: `{{ string | url_decode }}`
- **Returns**: `string`
- Decodes any percent-encoded characters
in a string.

```liquid
{{ 'test%40test.com' | url_decode }}
```

### `url_encode`

- **Syntax**: `{{ string | url_encode }}`
- **Returns**: `string`
- Converts any URL-unsafe characters in a string to the
percent-encoded equivalent.

```liquid
{{ 'test@test.com' | url_encode }}
```

### `camelize`

- **Syntax**: `{{ string | camelize }}`
- **Returns**: `string`
- Converts a string to CamelCase.

```liquid
{{ 'variable-name' | camelize }}
```

### `handleize`

- **Syntax**: `{{ string | handleize }}`
- **Returns**: `string`
- Converts a string into a handle.

```liquid
{{ product.title | handleize }}
{{ product.title | handle }}
```

### `url_escape`

- **Syntax**: `{{ string | url_escape }}`
- **Returns**: `string`
- Escapes any URL-unsafe characters in a string.

```liquid
{{ '&lt;p&gt;Health &amp; Love potions&lt;/p&gt;' | url_escape }}
```

### `url_param_escape`

- **Syntax**: `{{ string | url_param_escape }}`
- **Returns**: `string`
- Escapes any characters in a string that are unsafe for URL parameters.

```liquid
{{ '&lt;p&gt;Health &amp; Love potions&lt;/p&gt;' | url_param_escape }}
```

### `pluralize`

- **Syntax**: `{{ number | pluralize: string, string }}`
- **Returns**: `string`
- Outputs the singular or plural version of a string based on a given number.

```liquid
Cart item count: {{ cart.item_count }} {{ cart.item_count | pluralize: 'item', 'items' }}
```


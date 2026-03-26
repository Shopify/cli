# Liquid Tags Reference

> 30 tags organized by category. Each entry shows syntax, description, and examples.

## Conditional

### `case`

Renders a specific expression depending on the value of a specific variable.

**Syntax:**
```liquid
{% case variable %}
  {% when first_value %}
    first_expression
  {% when second_value %}
    second_expression
  {% else %}
    third_expression
{% endcase %}
```

**Keywords:**
- `variable`: The name of the variable you want to base your case statement on.
- `first_value`: A specific value to check for.
- `second_value`: A specific value to check for.
- `first_expression`: An expression to be rendered when the variable's value matches `first_value`.
- `second_expression`: An expression to be rendered when the variable's value matches `second_value`.
- `third_expression`: An expression to be rendered when the variable's value has no match.

```liquid
{% case product.type %}
  {% when 'Health' %}
    This is a health potion.
  {% when 'Love' %}
    This is a love potion.
  {% else %}
    This is a potion.
{% endcase %}
```

### `if`

Renders an expression if a specific condition is `true`.

**Syntax:**
```liquid
{% if condition %}
  expression
{% endif %}
```

**Keywords:**
- `condition`: The condition to evaluate.
- `expression`: The expression to render if the condition is met.

```liquid
{% if product.compare_at_price &gt; product.price %}
  This product is on sale!
{% endif %}
```

### `unless`

Renders an expression unless a specific condition is `true`.

**Syntax:**
```liquid
{% unless condition %}
  expression
{% endunless %}
```

> Tip:
> Similar to the `if` tag, you can use `elsif` to add more conditions to an `unless` tag.

**Keywords:**
- `condition`: The condition to evaluate.
- `expression`: The expression to render unless the condition is met.

```liquid
{% unless product.has_only_default_variant %}
  // Variant selection functionality
{% endunless %}
```

### `else`

Allows you to specify a default expression to execute when no other condition is met.

**Syntax:**
```liquid
{% else %}
  expression
```

You can use the `else` tag with the following tags:

- `case`
- `if`
- `unless`

**Keywords:**
- `expression`: The expression to render if no other condition is met.

```liquid
{% if product.available %}
  This product is available!
{% else %}
  This product is sold out!
{% endif %}
```

## Html

### `form`

Generates an HTML `<form>` tag, including any required `<input>` tags to submit the form to a specific endpoint.

**Syntax:**
```liquid
{% form 'form_type' %}
  content
{% endform %}
```

Because there are many different form types available in Shopify themes, the `form` tag requires a type. Depending on the
form type, an additional parameter might be required. You can specify the following form types:

- `activate_customer_password`
- `cart`
- `contact`
- `create_customer`
- `currency`
- `customer`
- `customer_address`
- `customer_login`
- `guest_login`
- `localization`
- `new_comment`
- `product`
- `recover_customer_password`
- `reset_customer_password`
- `storefront_password`

**Keywords:**
- `form_type`: The name of the desired form type
- `content`: The form contents

**Parameters:**
- `return_to` (optional): The desired URL to redirect to when the form submits.

**Example: activate_customer_password**
```liquid
{% form 'activate_customer_password', article %}
  form_content
{% endform %}

```

### `style`

Generates an HTML `<style>` tag with an attribute of `data-shopify`.

**Syntax:**
```liquid
{% style %}
  CSS_rules
{% endstyle %}
```

> Note:
> If you reference color settings inside `style` tags, then
> the associated CSS rules will update as the setting is changed in the theme editor, without a page refresh.

**Keywords:**
- `CSS_rules`: The desired CSS rules for the `&lt;style&gt;` tag.

```liquid
{% style %}
  .h1 {
    color: {{ settings.colors_accent_1 }};
  }
{% endstyle %}
```

## Iteration

### `break`

Stops a `for` loop from iterating.

**Syntax:**
```liquid
{% break %}
```

```liquid
{% for i in (1..5) -%}
  {%- if i == 4 -%}
    {% break %}
  {%- else -%}
    {{ i }}
  {%- endif -%}
{%- endfor %}
```

### `continue`

Causes a `for` loop to skip to the next iteration.

**Syntax:**
```liquid
{% continue %}
```

```liquid
{% for i in (1..5) -%}
  {%- if i == 4 -%}
    {% continue %}
  {%- else -%}
    {{ i }}
  {%- endif -%}
{%- endfor %}
```

### `cycle`

Loops through a group of strings and outputs them one at a time for each iteration of a `for` loop.

**Syntax:**
```liquid
{% cycle string, string, ... %}
```

The `cycle` tag must be used inside a `for` loop.

> Tip:
> Use the `cycle` tag to output text in a predictable pattern. For example, to apply odd/even classes to rows in a table.

```liquid
{% for i in (1..4) -%}
  {% cycle 'one', 'two', 'three' %}
{%- endfor %}
```

### `for`

Renders an expression for every item in an array.

**Syntax:**
```liquid
{% for variable in array %}
  expression
{% endfor %}
```

You can do a maximum of 50 iterations with a `for` loop. If you need to iterate over more than 50 items, then use the
`paginate` tag to split the items over multiple pages.

> Tip:
> Every `for` loop has an associated `forloop` object with information about the loop.

**Keywords:**
- `variable`: The current item in the array.
- `array`: The array to iterate over.
- `expression`: The expression to render for each iteration.

**Parameters:**
- `limit` (optional): The number of iterations to perform.
- `offset` (optional): The 1-based index to start iterating at.
- `range` (optional): A custom numeric range to iterate over.
- `reversed` (optional): Iterate in reverse order.

```liquid
{% for product in collection.products -%}
  {{ product.title }}
{%- endfor %}
```

### `tablerow`

Generates HTML table rows for every item in an array.

**Syntax:**
```liquid
{% tablerow variable in array %}
  expression
{% endtablerow %}
```

The `tablerow` tag must be wrapped in HTML `<table>` and `</table>` tags.

> Tip:
> Every `tablerow` loop has an associated `tablerowloop` object with information about the loop.

**Keywords:**
- `variable`: The current item in the array.
- `array`: The array to iterate over.
- `expression`: The expression to render.

**Parameters:**
- `cols` (optional): The number of columns that the table should have.
- `limit` (optional): The number of iterations to perform.
- `offset` (optional): The 1-based index to start iterating at.
- `range` (optional): A custom numeric range to iterate over.

```liquid
&lt;table&gt;
  {% tablerow product in collection.products %}
    {{ product.title }}
  {% endtablerow %}
&lt;/table&gt;
```

### `paginate`

Splits an array's items across multiple pages.

**Syntax:**
```liquid
{% paginate array by page_size %}
  {% for item in array %}
    forloop_content
  {% endfor %}
{% endpaginate %}
```

Because `for` loops are limited to 50 iterations per page, you need to use the `paginate` tag to
iterate over an array that has more than 50 items. The following arrays can be paginated:

- `article.comments`
- `blog.articles`
- `collections`
- `collection.products`
- `customer.addresses`
- `customer.orders`
- `metaobject_definition.values`
- `pages`
- `product.variants`
- `search.results`
- `article_list` settings
- `collection_list` settings
- `product_list` settings

Within the `paginate` tag, you have access to the `paginate` object. You can use this
object, or the `default_pagination` filter, to build page navigation.

> Note:
> The `paginate` tag allows the user to paginate to the 25,000th item in the array and no further. To reach items further in
> the array the array should be filtered further before paginating. See
> Pagination Limits for more information.

**Keywords:**
- `array`: The array to be looped over.
- `page_size`: The number of array items to include per page, between 1 and 250.
- `item`: An item in the array being looped.
- `forloop_content`: Content for each loop iteration.

**Parameters:**
- `window_size` (optional): The number of pages to display in the pagination.

```liquid
{% paginate collection.products by 5 %}
  {% for product in collection.products -%}
    {{ product.title }}
  {%- endfor %}

  {{- paginate | default_pagination }}
{% endpaginate %}
```

### `else`

Allows you to specify a default expression to execute when a `for` loop has zero length.

**Syntax:**
```liquid
{% for variable in array %}
  first_expression
{% else %}
  second_expression
{% endfor %}
```

**Keywords:**
- `variable`: The current item in the array.
- `array`: The array to iterate over.
- `first_expression`: The expression to render for each iteration.
- `second_expression`: The expression to render if the loop has zero length.

```liquid
{% for product in collection.products %}
  {{ product.title }}&lt;br&gt;
{% else %}
  There are no products in this collection.
{% endfor %}
```

## Syntax

### `comment`

Prevents an expression from being rendered or output.

**Syntax:**
```liquid
{% comment %}
  content
{% endcomment %}
```

Any text inside `comment` tags won't be output, and any Liquid code will be parsed, but not executed.

**Keywords:**
- `content`: The content of the comment.

**Example: Inline comments**
```liquid
{% # content %}
```

### `doc`

Documents template elements with annotations.

**Syntax:**
```liquid
{% doc %}
  Renders a message.

  @param {string} foo - A string value.
  @param {string} [bar] - An optional string value.

  @example
  {% render 'message', foo: 'Hello', bar: 'World' %}
{% enddoc %}
```

The `doc` tag allows developers to include documentation within Liquid
templates. Any content inside `doc` tags is not rendered or outputted.
Liquid code inside will be parsed but not executed. This facilitates
tooling support for features like code completion, linting, and inline
documentation.

For detailed documentation syntax and examples, see the
`LiquidDoc` reference.

### `echo`

Outputs an expression.

**Syntax:**
```liquid
{% liquid
  echo expression
%}
```

Using the `echo` tag is the same as wrapping an expression in curly brackets (`{{` and `}}`). However, unlike the curly
bracket method, you can use the `echo` tag inside `liquid` tags.

> Tip:
> You can use filters on expressions inside `echo` tags.

**Keywords:**
- `expression`: The expression to be output.

```liquid
{% echo product.title %}

{% liquid
  echo product.price | money
%}
```

### `raw`

Outputs any Liquid code as text instead of rendering it.

**Syntax:**
```liquid
{% raw %}
  expression
{% endraw %}
```

**Keywords:**
- `expression`: The expression to be output without being rendered.

```liquid
{% raw %}
{{ 2 | plus: 2 }} equals 4.
{% endraw %}
```

### `liquid`

Allows you to have a block of Liquid without delimeters on each tag.

**Syntax:**
```liquid
{% liquid
  expression
%}
```

Because the tags don't have delimeters, each tag needs to be on its own line.

> Tip:
> Use the `echo` tag to output an expression inside `liquid` tags.

**Keywords:**
- `expression`: The expression to be rendered inside the `liquid` tag.

```liquid
{% liquid
  # Show a message that's customized to the product type

  assign product_type = product.type | downcase
  assign message = ''

  case product_type
    when 'health'
      assign message = 'This is a health potion!'
    when 'love'
      assign message = 'This is a love potion!'
    else
      assign message = 'This is a potion!'
  endcase

  echo message
%}
```

## Theme

### `content_for`

Creates a designated area in your theme where blocks can be rendered.

**Syntax:**
```liquid
{% content_for 'blocks' %}
{% content_for 'block', type: "slide", id: "slide-1" %}
```

The `content_for` tag requires a type parameter to differentiate between rendering a number of theme blocks (`'blocks'`) and a single static block (`'block'`).

**Example: blocks**
```liquid
{% content_for "blocks" %}
```

### `layout`

Specify which layout to use.

**Syntax:**
```liquid
{% layout name %}
```

**Keywords:**
- `name`: The name of the layout file you want to use, wrapped in quotes, or `none` for no layout.


### `include` *(deprecated)*

Renders a snippet.

**Syntax:**
```liquid
{% include 'filename' %}
```

Inside the snippet, you can access and alter variables that are created outside of the
snippet.

**Keywords:**
- `filename`: The name of the snippet to render, without the `.liquid` extension.

### `render`

Renders a snippet or app block.

**Syntax:**
```liquid
{% render 'filename' %}
```

Inside snippets and app blocks, you can't directly access variables that are created outside
of the snippet or app block. However, you can specify variables as parameters
to pass outside variables to snippets.

While you can't directly access created variables, you can access global objects, as well as any objects that are
directly accessible outside the snippet or app block. For example, a snippet or app block inside the product template
can access the `product` object, and a snippet or app block inside a section
can access the `section` object.

Outside a snippet or app block, you can't access variables created inside the snippet or app block.

> Note:
> When you render a snippet using the `render` tag, you can't use the `include` tag
> inside the snippet.

**Keywords:**
- `filename`: The name of the snippet to render, without the `.liquid` extension.

**Example: for**
```liquid
{% render 'filename' for array as item %}
```

### `javascript`

JavaScript code included in section, block and snippet files.

**Syntax:**
```liquid
{% javascript %}
  javascript_code
{% endjavascript %}
```

Each section, block or snippet can have only one `{% javascript %}` tag.

To learn more about how JavaScript that's defined between the `javascript` tags is loaded and run, refer to the documentation for javascript tags.
> Caution:
> Liquid isn't rendered inside of `{% javascript %}` tags. Including Liquid code can cause syntax errors.

**Keywords:**
- `javascript_code`: The JavaScript code for the section, block or snippet.

### `section`

Renders a section.

**Syntax:**
```liquid
{% section 'name' %}
```

Rendering a section with the `section` tag renders a section statically. To learn more about sections and how to use
them in your theme, refer to Render a section.

**Keywords:**
- `name`: The name of the section file you want to render.

```liquid
{% section 'header' %}
```

### `stylesheet`

CSS styles included in section, block, and snippet files.

**Syntax:**
```liquid
{% stylesheet %}
  css_styles
{% endstylesheet %}
```

Each section, block or snippet can have only one `{% stylesheet %}` tag.

To learn more about how CSS that's defined between the `stylesheet` tags is loaded and run, refer to the documentation for stylesheet tags.
> Caution:
> Liquid isn't rendered inside of `{% stylesheet %}` tags. Including Liquid code can cause syntax errors.

**Keywords:**
- `css_styles`: The CSS styles for the section, block or snippet.

### `sections`

Renders a section group.

**Syntax:**
```liquid
{% sections 'name' %}
```

Use this tag to render section groups as part of the theme's layout content. Place the `sections` tag where you want to render it in the layout.

To learn more about section groups and how to use them in your theme, refer to Section groups.

**Keywords:**
- `name`: The name of the section group file you want to render.

## Variable

### `assign`

Creates a new variable.

**Syntax:**
```liquid
{% assign variable_name = value %}
```

You can create variables of any basic type, object, or object property.

> Caution:
> Predefined Liquid objects can be overridden by variables with the same name.
> To make sure that you can access all Liquid objects, make sure that your variable name doesn't match a predefined object's name.

**Keywords:**
- `variable_name`: The name of the variable being created.
- `value`: The value you want to assign to the variable.

```liquid
{%- assign product_title = product.title | upcase -%}

{{ product_title }}
```

### `capture`

Creates a new variable with a string value.

**Syntax:**
```liquid
{% capture variable %}
  value
{% endcapture %}
```

You can create complex strings with Liquid logic and variables.

> Caution:
> Predefined Liquid objects can be overridden by variables with the same name.
> To make sure that you can access all Liquid objects, make sure that your variable name doesn't match a predefined object's name.

**Keywords:**
- `variable`: The name of the variable being created.
- `value`: The value you want to assign to the variable.

```liquid
{%- assign up_title = product.title | upcase -%}
{%- assign down_title = product.title | downcase -%}
{%- assign show_up_title = true -%}

{%- capture title -%}
  {% if show_up_title -%}
    Upcase title: {{ up_title }}
  {%- else -%}
    Downcase title: {{ down_title }}
  {%- endif %}
{%- endcapture %}

{{ title }}
```

### `decrement`

Creates a new variable, with a default value of -1, that's decreased by 1 with each subsequent call.

> Caution:
> Predefined Liquid objects can be overridden by variables with the same name.
> To make sure that you can access all Liquid objects, make sure that your variable name doesn't match a predefined object's name.

**Syntax:**
```liquid
{% decrement variable_name %}
```

Variables that are declared with `decrement` are unique to the layout, template,
or section file that they're created in. However, the variable is shared across
snippets included in the file.

Similarly, variables that are created with `decrement` are independent from those created with `assign`
and `capture`. However, `decrement` and `increment` share
variables.

**Keywords:**
- `variable_name`: The name of the variable being decremented.

```liquid
{% decrement variable %}
{% decrement variable %}
{% decrement variable %}
```

### `increment`

Creates a new variable, with a default value of 0, that's increased by 1 with each subsequent call.

> Caution:
> Predefined Liquid objects can be overridden by variables with the same name.
> To make sure that you can access all Liquid objects, make sure that your variable name doesn't match a predefined object's name.

**Syntax:**
```liquid
{% increment variable_name %}
```

Variables that are declared with `increment` are unique to the layout, template,
or section file that they're created in. However, the variable is shared across
snippets included in the file.

Similarly, variables that are created with `increment` are independent from those created with `assign`
and `capture`. However, `increment` and `decrement` share
variables.

**Keywords:**
- `variable_name`: The name of the variable being incremented.

```liquid
{% increment variable %}
{% increment variable %}
{% increment variable %}
```


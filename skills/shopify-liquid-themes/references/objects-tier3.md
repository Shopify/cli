# Liquid Objects — Tier 3

> 53 simple objects with access paths.

**`additional_checkout_buttons`** (global) — Returns `true` if a store has any payment providers with offsite checkouts, such as PayPal Express C

**`all_country_option_tags`** (global) — Creates an `<option>` tag for each country.

**`all_products`** (global) — All of the products on a store.

**`app`** — An app. This object is usually used to access app-specific information for use with theme app extens

**`articles`** (global) — All of the articles across the blogs in the store.

**`blogs`** (global) — All of the blogs in the store.

**`brand_color`** (brand.colors) — The colors defined as part of a store's brand assets.

**`canonical_url`** (global) — The canonical URL for the current page.

**`collections`** (global) — All of the collections on a store.

**`color_scheme`** — A color_scheme from a `color_scheme` setting.

**`color_scheme_group`** — A color_scheme_group from a `color_scheme_group` setting.

**`content_for_additional_checkout_buttons`** (global) — Returns checkout buttons for any active payment providers with offsite checkouts.

**`content_for_header`** (global) — Dynamically returns all scripts required by Shopify.

**`content_for_index`** (global) — Dynamically returns the content of sections to be rendered on the home page.

**`content_for_layout`** (global) — Dynamically returns content based on the current template.

**`country_option_tags`** (global) — Creates an `<option>` tag for each country and region that's included in a shipping zone on the Ship

**`current_page`** (global) — The current page number.

**`current_tags`** (blog, collection) — The currently applied tags.

**`customer_payment_method`** (customer.payment_methods) — A customer's saved payment method.

**`discount_allocation`** (line_item.discount_allocations, shipping_method.discount_allocations) — Information about how a discount affects an item.

**`filter_value_display`** *(deprecated)* (filter_value.display) — The visual representation of a filter value.

**`focal_point`** (image_presentation.focal_point) — The focal point for an image.

**`form_errors`** (form.errors) — The error category strings for errors from a form created by a `form` tag.

**`handle`** (global) — The handle of the resource associated with the current template.

**`image_presentation`** (image.presentation) — The presentation settings for an image.

**`images`** (global) — All of the images that have been uploaded to a store.

**`instructions`** (line_item.instructions) — The instructions for a nested cart line item.

**`linklists`** (global) — All of the menus in a store.

**`metaobject`** (metaobjects.) — A metaobject entry, which includes the values for a set of fields. The set is defined by the parent 

**`metaobject_definition`** — A `metaobject_definition` defines the structure of a metaobject type for the store, which consists o

**`metaobjects`** (global) — All of the metaobjects of the store.

**`money`** (metafield.value, store_credit_account.balance) — A money value, in the the customer's local (presentment) currency.

**`page_description`** (global) — The meta description of the current page.

**`page_image`** (global) — An image to be shown in search engine listings and social media previews for the current page.

**`page_title`** (global) — The page title of the current page.

**`pages`** (global) — All of the pages on a store.

**`parent_relationship`** (line_item.parent_relationship) — Information about the parent relationship for a nested cart line item.

**`pending_payment_instruction_input`** (transaction.buyer_pending_payment_instructions) — Header-value pairs that make up the list of payment information specific to the payment method. This

**`powered_by_link`** (global) — Creates an HTML link element that links to a localized version of `shopify.com`, based on the locale

**`quantity_price_break`** (variant.quantity_price_breaks) — The per-unit price of a variant when purchasing the minimum quantity or more.

**`remote_details`** (remote_product., remote_product.remote_details) — Information about the remote source from which the object came from.

**`robots`** (robots.txt.liquid) — The default rule groups for the `robots.txt` file.

**`rule`** (group.rules) — A rule for the `robots.txt` file, which tells crawlers which pages can, or can't, be accessed.

**`script`** (scripts.cart_calculate_line_items) — Information about a Shopify Script. > Caution: > Shopify Scripts will be sunset on August 28, 2025. 

**`scripts`** (global) — The active scripts, of each script type, on the store. > Caution: > Shopify Scripts will be sunset o

**`selling_plan_allocation_price_adjustment`** (selling_plan_allocation.price_adjustments) — The resulting price from the intent of the associated `selling_plan_price_adjustment`.

**`selling_plan_checkout_charge`** (line_item.selling_plan_allocation, variant.selling_plan_allocations, selling_plan.checkout_charge) — Information about how a specific selling plan affects the amount that a customer needs to pay for a 

**`settings`** (global) — Allows you to access all of the theme's settings from the `settings_schema.json` file.

**`sitemap`** (group.sitemap) — The sitemap for a specific group in the `robots.txt` file.

**`sort_option`** (collection.sort_options, search.sort_options) — A sort option for a collection or search results page.

**`store_credit_account`** (customer.store_credit_account, company_location.store_credit_account) — A store credit account owned by a customer.

**`swatch`** (product_option_value.swatch, filter_value.swatch) — Color and image for visual representation. Available for product option values and filter values.

**`user_agent`** (group.user_agent) — The user-agent, which is the name of the crawler, for a specific group in the `robots.txt` file.


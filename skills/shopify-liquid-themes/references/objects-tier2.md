# Liquid Objects — Tier 2

> 69 objects with property names listed.

### `address`

An address, such as a customer address or order shipping address.

**Access:** `checkout.billing_address`, `checkout.shipping_address`, `customer.addresses`, `customer.default_address`, `location.address`, `order.billing_address`, `order.shipping_address`, `shop.address`

**Properties:** `company`, `phone`, `first_name`, `last_name`, `name`, `url`, `summary`, `id`, `address1`, `address2`, `city`, `zip`, `country_code`, `province_code`, `country`, `street`, `province`

### `brand`

The brand assets for the store.

**Access:** `remote_shop.brand`, `shop.brand`

**Properties:** `slogan`, `short_description`, `favicon_url`, `cover_image`, `logo`, `square_logo`, `colors`, `metafields`

### `checkout`

A customer's checkout.

**Access:** Templates: checkout

**Properties:** `applied_gift_cards`, `attributes`, `billing_address`, `buyer_accepts_marketing`, `cart_level_discount_applications`, `currency`, `customer`, `discount_applications`, `discounts_amount`, `discounts_savings`, `email`, `gift_cards_amount`, `id`, `line_items`, `line_items_subtotal_price`, `name`, `note`, `order`, `order_id`, `order_name`, `order_number`, `requires_shipping`, `shipping_address`, `shipping_method`, `shipping_price`, `tax_lines`, `tax_price`, `total_price`, `transactions`, `item_count`

### `closest`

A drop that holds resources of different types that are the closest to the current context

**Access:** Global

**Properties:** `product`, `collection`, `article`, `blog`, `page`, `metaobject`

### `color`

A color from a `color` setting.

**Access:** `swatch.color`

**Properties:** `red`, `green`, `blue`, `rgb`, `rgba`, `oklch`, `oklcha`, `hue`, `saturation`, `lightness`, `alpha`, `chroma`, `color_space`

### `comment`

An article comment.

**Access:** `article.comments`

**Properties:** `author`, `content`, `created_at`, `email`, `id`, `status`, `updated_at`, `url`

### `company`

A company that a customer is purchasing for.

**Access:** `company_location.company`, `customer.current_company`

**Properties:** `id`, `name`, `external_id`, `available_locations`, `available_locations_count`, `metafields`

### `company_address`

The address of a company location.

**Access:** `company_location.shipping_address`

**Properties:** `attention`, `id`, `address1`, `address2`, `first_name`, `last_name`, `city`, `zip`, `country_code`, `province_code`, `country`, `street`, `province`

### `company_location`

A location of the company that a customer is purchasing for.

**Access:** `company.available_locations`, `customer.company_available_locations`, `customer.current_location`

**Properties:** `id`, `name`, `external_id`, `url_to_set_as_current`, `current?`, `company`, `shipping_address`, `tax_registration_id`, `metafields`, `store_credit_account`

### `country`

A country supported by the store's localization options.

**Access:** `localization.available_countries`, `localization.country`, `address.country`, `company_address.country`

**Properties:** `name`, `iso_code`, `unit_system`, `currency`, `market`, `popular?`, `continent`, `available_languages`

### `currency`

Information about a currency, like the ISO code and symbol.

**Access:** `cart.currency`, `country.currency`, `shop.enabled_currencies`, `money.currency`, `shop.money_format`, `shop.money_with_currency_format`

**Properties:** `iso_code`, `symbol`, `name`

### `discount` *(deprecated)*

A discount applied to a cart, line item, or order.

**Access:** `cart.discounts`, `line_item.discounts`, `order.discounts`, `checkout.discount`

**Properties:** `amount`, `total_amount`, `code`, `title`, `type`, `savings`, `total_savings`

### `discount_application`

Information about the intent of a discount.

**Access:** `cart.discount_applications`, `order.discount_applications`, `discount_allocation.discount_application`

**Properties:** `total_allocated_amount`, `title`, `value`, `target_selection`, `type`, `value_type`, `target_type`

### `external_video`

Information about an external video from YouTube or Vimeo.

**Access:** `product.media`

**Properties:** `external_id`, `aspect_ratio`, `host`, `alt`, `id`, `media_type`, `position`, `preview_image`

### `filter`

A storefront filter.

**Access:** `collection.filters`, `search.filters`

**Properties:** `param_name`, `label`, `operator`, `type`, `active_values`, `inactive_values`, `values`, `false_value`, `true_value`, `max_value`, `min_value`, `range_max`, `url_to_remove`, `presentation`

### `filter_value`

A specific value of a filter.

**Access:** `filter.`, `filter.false_value`, `filter.true_value`, `filter.max_value`, `filter.min_value`

**Properties:** `param_name`, `value`, `active`, `count`, `label`, `url_to_add`, `url_to_remove`, `swatch`, `image`

### `font`

A font from a `font_picker` setting.

**Properties:** `family`, `fallback_families`, `baseline_ratio`, `weight`, `style`, `variants`, `system?`

### `forloop`

Information about a parent `for` loop.

**Access:** `forloop.parentloop`

**Properties:** `length`, `parentloop`, `index`, `index0`, `rindex`, `rindex0`, `first`, `last`

### `fulfillment`

An order fulfillment, which includes information like the line items
being fulfilled and shipment tracking.

**Access:** `line_item.fulfillment`

**Properties:** `created_at`, `item_count`, `fulfillment_line_items`, `tracking_company`, `tracking_numbers`, `tracking_number`, `tracking_url`

### `generic_file`

A file from a `file_reference` type metafield that is neither an image or video.

**Access:** `metafield.value`

**Properties:** `url`, `id`, `media_type`, `preview_image`, `position`, `alt`

### `gift_card`

A gift card that's been issued to a customer or a recipient.

**Access:** Templates: gift_card.liquid

**Properties:** `balance`, `code`, `currency`, `customer`, `recipient`, `message`, `send_on`, `enabled`, `expired`, `expires_on`, `initial_value`, `url`, `template_suffix`, `properties`, `qr_identifier`, `pass_url`, `product`, `last_four_characters`

### `group`

A group of rules for the `robots.txt` file.

**Access:** `robots.default_groups`

**Properties:** `user_agent`, `rules`, `sitemap`

### `link`

A link in a menu.

**Access:** `linklist.links`

**Properties:** `active`, `current`, `child_active`, `child_current`, `handle`, `links`, `object`, `title`, `type`, `levels`, `url`

### `linklist`

A menu in a store.

**Access:** `linklists.`

**Properties:** `links`, `handle`, `levels`, `title`

### `localization`

Information about the countries and languages that are available on a store.

**Access:** Global

**Properties:** `available_countries`, `available_languages`, `market`, `country`, `language`

### `location`

A store location.

**Access:** `store_availability.location`

**Properties:** `id`, `name`, `address`, `latitude`, `longitude`, `metafields`

### `market`

A group of one or more regions of the world that a merchant is targeting for sales.

**Access:** `localization.market`, `country.market`

**Properties:** `id`, `handle`, `metafields`

### `measurement`

A measurement from one of the following metafield types:

- `dimension`
- `volume`
- `weight`

**Access:** `metafield.value`

**Properties:** `type`, `value`, `unit`

### `media`

An abstract media object that can represent the following object types:

- `image`
- `model`
- `video`
- `external_video`

**Access:** `product.media`, `product.featured_media`, `variant.featured_media`, `remote_product.featured_media`

**Properties:** `id`, `position`, `media_type`, `preview_image`, `alt`

### `metafield`

A metafield attached to a parent object.

**Access:** `app.metafields`, `article.metafields`, `blog.metafields`, `collection.metafields`, `customer.metafields`, `location.metafields`, `order.metafields`, `page.metafields`, `product.metafields`, `shop.metafields`, `variant.metafields`

**Properties:** `value`, `type`, `list?`

### `metaobject_system`

Basic information about a `metaobject`. These properties are grouped under the `system` object to avoid collisions between system property names and user-defined metaobject fields.

**Access:** `metaobject.system`

**Properties:** `type`, `handle`, `id`, `url`

### `model`

A 3D model uploaded as product media.

**Access:** `product.media`

**Properties:** `sources`, `alt`, `id`, `media_type`, `position`, `preview_image`

### `model_source`

A model source file.

**Access:** `model.`

**Properties:** `format`, `mime_type`, `url`

### `paginate`

Information about the pagination inside a set of `paginate` tags.

**Properties:** `page_size`, `current_offset`, `current_page`, `items`, `parts`, `next`, `previous`, `pages`, `page_param`

### `part`

A part in the navigation for pagination.

**Access:** `paginate.parts`, `paginate.next`, `paginate.previous`

**Properties:** `is_link`, `title`, `url`

### `policy`

A store policy, such as a privacy or return policy.

**Access:** `shop.policies`, `remote_shop.shipping_policy`, `remote_shop.refund_policy`, `shop.refund_policy`, `shop.shipping_policy`, `shop.privacy_policy`, `shop.terms_of_service`, `shop.subscription_policy`

**Properties:** `id`, `body`, `url`, `title`

### `predictive_search`

Information about the results from a predictive search query through the
Predictive Search API.

**Properties:** `performed`, `resources`, `terms`, `types`

### `predictive_search_resources`

Contains arrays of objects for each resource type that can be returned by a predictive search query.

**Access:** `predictive_search.resources`

**Properties:** `articles`, `collections`, `pages`, `products`

### `product_option`

A product option, such as size or color.

**Access:** `product.options_with_values`

**Properties:** `name`, `position`, `values`, `selected_value`

### `product_option_value`

A product option value, such as "red" for the option "color".

**Access:** `product_option.values`, `variant.options`

**Properties:** `id`, `name`, `swatch`, `selected`, `available`, `variant`, `product_url`

### `quantity_rule`

A variant order quantity rule.

**Access:** `variant.quantity_rule`

**Properties:** `min`, `max`, `increment`

### `rating`

Information for a `rating` type metafield.

**Access:** `metafield.value`

**Properties:** `rating`, `scale_min`, `scale_max`

### `recipient`

A recipient that is associated with a gift card.

**Access:** `gift_card.recipient`

**Properties:** `nickname`, `email`, `name`

### `recommendations`

Product recommendations for a specific product based on sales data, product descriptions, and collection relationships.

**Properties:** `performed?`, `products`, `products_count`, `intent`

### `remote_product`

A product that comes from a remote source, inheriting all product functionality and also providing additional context about the remote source.

**Access:** `collection.products`, `line_item.product`, `search.results`, `variant.product`

**Properties:** `title`, `remote_details`, `featured_media`, `media`, `template_suffix`, `metafields`, `description`, `selling_plan_groups`, `options_with_values`, `category`, `variants`, `variants_count`, `id`, `vendor`, `content`, `featured_image`, `images`, `price_min`, `price`, `price_max`, `price_varies`, `selected_or_first_available_variant`, `selected_variant`, `first_available_variant`, `available`, `options`, `type`, `compare_at_price_min`, `compare_at_price_max`, `compare_at_price`, `compare_at_price_varies`, `url`, `published_at`, `created_at`, `options_by_name`, `has_only_default_variant`, `quantity_price_breaks_configured?`, `requires_selling_plan`, `selected_selling_plan`, `selected_selling_plan_allocation`, `selected_or_first_available_selling_plan_allocation`, `gift_card?`

### `remote_shop`

Information about a remote store.

**Access:** `remote_product.remote_details`, `remote_details.shop`

**Properties:** `name`, `brand`, `shipping_policy`, `refund_policy`, `policies`

### `request`

Information about the current URL and the associated page.

**Access:** Global

**Properties:** `design_mode`, `visual_preview_mode`, `page_type`, `host`, `origin`, `path`, `locale`

### `routes`

Allows you to generate standard URLs for the storefront.

**Access:** Global

**Properties:** `root_url`, `account_url`, `account_login_url`, `account_logout_url`, `account_recover_url`, `account_register_url`, `account_addresses_url`, `account_profile_url`, `collections_url`, `all_products_collection_url`, `search_url`, `predictive_search_url`, `cart_url`, `cart_add_url`, `cart_change_url`, `cart_clear_url`, `cart_update_url`, `product_recommendations_url`, `storefront_login_url`

### `search`

Information about a storefront search query.

**Access:** Templates: search

**Properties:** `terms`, `filters`, `performed`, `results`, `results_count`, `sort_options`, `sort_by`, `default_sort_by`, `types`

### `selling_plan`

Information about the intent of how a specific selling plan affects a line item.

**Access:** `line_item.selling_plan_allocation`, `variant.selling_plan_allocations`, `product.selected_selling_plan`, `remote_product.selected_selling_plan`, `selling_plan_allocation.selling_plan`

**Properties:** `id`, `name`, `description`, `group_id`, `recurring_deliveries`, `options`, `price_adjustments`, `selected`, `checkout_charge`

### `selling_plan_allocation`

Information about how a specific selling plan affects a line item.

**Access:** `line_item.selling_plan_allocation`, `variant.selling_plan_allocations`, `product.selected_selling_plan_allocation`, `product.selected_or_first_available_selling_plan_allocation`, `variant.selected_selling_plan_allocation`, `remote_product.selected_selling_plan_allocation`, `remote_product.selected_or_first_available_selling_plan_allocation`

**Properties:** `price`, `compare_at_price`, `price_adjustments`, `unit_price`, `per_delivery_price`, `selling_plan`, `selling_plan_group_id`, `checkout_charge_amount`, `remaining_balance_charge_amount`

### `selling_plan_group`

Information about a specific group of selling plans that include any of a
product's variants.

**Access:** `product.`

**Properties:** `selling_plans`, `id`, `name`, `app_id`, `options`, `selling_plan_selected`

### `selling_plan_group_option`

Information about a specific option in a selling plan group.

**Access:** `selling_plan_group.`

**Properties:** `name`, `position`, `values`, `selected_value`

### `selling_plan_option`

Information about a selling plan's value for a specific `selling_plan_group_option`.

**Access:** `selling_plan.options`

**Properties:** `name`, `position`, `value`

### `selling_plan_price_adjustment`

Information about how a selling plan changes the price of a variant for a given period of time.

**Access:** `selling_plan_allocation.price_adjustments`

**Properties:** `order_count`, `position`, `value_type`, `value`

### `shipping_method`

Information about the shipping method for an order.

**Access:** `checkout.shipping_method`, `order.shipping_method`

**Properties:** `title`, `original_price`, `price_with_discounts`, `handle`, `id`, `tax_lines`, `discount_allocations`

### `shop_locale`

A language in a store.

**Access:** `localization.available_languages`, `localization.language`, `request.locale`, `shop.published_locales`, `shop.locale`

**Properties:** `name`, `endonym_name`, `iso_code`, `primary`, `root_url`

### `store_availability`

A variant's inventory information for a physical store location.

**Access:** `variant.store_availabilities`

**Properties:** `available`, `pick_up_enabled`, `pick_up_time`, `location`

### `tablerowloop`

Information about a parent `tablerow` loop.

**Properties:** `length`, `col`, `row`, `index`, `index0`, `col0`, `rindex`, `rindex0`, `first`, `last`, `col_first`, `col_last`

### `tax_line`

Information about a tax line of a checkout or order.

**Access:** `checkout.tax_lines`, `order.tax_lines`

**Properties:** `title`, `price`, `rate`, `rate_percentage`

### `taxonomy_category`

The taxonomy category for a product

**Access:** `product.category`, `remote_product.category`

**Properties:** `gid`, `id`, `name`, `ancestors`

### `template`

Information about the current template.

**Access:** Global

**Properties:** `name`, `suffix`, `directory`

### `theme` *(deprecated)*

Information about the current theme.

**Access:** Global

**Properties:** `id`, `name`, `role`

### `transaction`

A transaction associated with a checkout or order.

**Access:** `checkout.transactions`, `order.transactions`

**Properties:** `id`, `name`, `status`, `created_at`, `receipt`, `kind`, `gateway`, `status_label`, `payment_details`, `amount`, `gateway_display_name`, `show_buyer_pending_payment_instructions?`, `buyer_pending_payment_notice`, `buyer_pending_payment_instructions`

### `transaction_payment_details`

Information about the payment methods used for a transaction.

**Access:** `transaction.payment_details`

**Properties:** `credit_card_company`, `credit_card_last_four_digits`, `credit_card_number`, `gift_card`

### `unit_price_measurement`

Information about how units of a product variant are measured. It's used to calculate
unit prices.

**Access:** `line_item.unit_price_measurement`, `variant.unit_price_measurement`

**Properties:** `measured_type`, `quantity_value`, `quantity_unit`, `reference_value`, `reference_unit`

### `user`

The author of a blog article.

**Access:** `article.user`

**Properties:** `account_owner`, `bio`, `email`, `first_name`, `homepage`, `image`, `last_name`, `name`

### `video`

Information about a video uploaded as product media or a `file_reference` metafield.

**Access:** `metafield.value`, `product.media`

**Properties:** `sources`, `duration`, `aspect_ratio`, `alt`, `id`, `media_type`, `position`, `preview_image`

### `video_source`

Information about the source files for a video.

**Access:** `video.sources`

**Properties:** `width`, `format`, `height`, `mime_type`, `url`


# Liquid Objects — Commerce

> Core commerce objects with full property tables.

## `cart`

A customer’s cart.

**Access:** Global

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `requires_shipping` | `boolean` | Returns `true` if any of the products in the cart require shipping. Returns `false` if not. |
| `note` | `string` | Additional information captured with the cart. |
| `item_count` | `number` | The number of items in the cart. |
| `total_price` | `number` | The total price of all of the items in the cart in the currency's subunit, after discounts have been applied. |
| `checkout_charge_amount` | `number` | The amount that the customer will be charged at checkout in the currency's subunit. |
| `original_total_price` | `number` | The total price of all of the items in the cart in the currency's subunit, before discounts have been applied. |
| `items_subtotal_price` | `number` | The total price of all of the items in the cart in the currency's subunit, after any line item discounts. This doesn't include taxes (unless taxes are included in the prices), cart discounts, or shipping costs. |
| `total_discount` | `number` | The total amount of all discounts (the amount saved) for the cart in the currency's subunit. |
| `items` | `array` | The line items in the cart. |
| `empty?` | `boolean` | Returns `true` if there are no items in the cart. Return's `false` if there are. |
| `currency` | `` | The currency of the cart. |
| `total_weight` | `number` | The total weight of all of the items in the cart in grams. |
| `discount_applications` | `array` | The discount applications for the cart. |
| `attributes` | `untyped` | Additional attributes entered by the customer with the cart. |
| `cart_level_discount_applications` | `array` | The cart-specific discount applications for the cart. |
| `taxes_included` | `boolean` | Returns `true` if taxes are included in the prices of products in the cart. Returns `false` if not. |
| `duties_included` | `boolean` | Returns `true` if duties are included in the prices of products in the cart. Returns `false` if not. |

## `line_item`

A line in a cart, checkout, or order. Each line item represents a product variant.

**Access:** `cart.line_items`, `checkout.line_items`, `order.line_items`, `parent_relationship.parent`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `number` | The ID of the line item. |
| `quantity` | `number` | The quantity of the line item. |
| `discount_allocations` | `array` | The discount allocations that apply to the line item. |
| `final_price` | `number` | The price of the line item in the currency's subunit. This includes any line-level discounts. |
| `final_line_price` | `number` | The combined price, in the currency's subunit, of all of the items in the line item. This includes any line-level discounts. |
| `variant_id` | `number` | The ID of the line item's variant. |
| `product_id` | `number` | The ID of the line item's product. |
| `product` | `product` | The product associated with the line item. May be a regular product or a remote product. |
| `variant` | `variant` | The variant associated with the line item. |
| `tax_lines` | `array` | The tax lines for the line item. |
| `fulfillment` | `fulfillment` | The fulfillment of the line item. |
| `successfully_fulfilled_quantity` | `number` | The number of items from the line item that have been successfully fulfilled. |
| `fulfillment_service` | `string` | The fulfillment service for the vartiant associated with the line item. If there's no fulfillment service, then `manual` is returned. |
| `properties` | `array` | The properties of the line item. |
| `unit_price_measurement` | `unit_price_measurement` | The unit price measurement of the line item. |
| `unit_price` | `number` | The unit price  of the line item in the currency's subunit. |
| `sku` | `string` | The sku of the variant associated with the line item. |
| `message` | `string` | Information about the discounts that have affected the line item. |
| `vendor` | `string` | The vendor of the variant associated with the line item. |
| `title` | `string` | The title of the line item. The title is a combination of `line_item.product.title` and `line_item.variant.title`, separated by a hyphen. |
| `taxable` | `boolean` | Returns `true` if taxes should be charged on the line item. Returns `false` if not. |
| `original_price` | `number` | The price of the line item in the currency's subunit, before discounts have been applied. |
| `original_line_price` | `number` | The combined price of all of the items in a line item in the currency's subunit, before any discounts have been applied. |
| `line_level_total_discount` | `number` | The total amount of any discounts applied to the line item in the currency's subunit. |
| `line_level_discount_allocations` | `array` | The discount allocations that apply directly to the line item. |
| `gift_card` | `boolean` | Returns `true` if the product associated with the line item is a gift card. Returns `false` if not. |
| `requires_shipping` | `boolean` | Returns `true` if the variant associated with the line item requires shipping. Returns `false` if not. |
| `options_with_values` | `array` | The name and value pairs for each option of the variant associated with the line item. |
| `key` | `string` | The key of the line item. |
| `grams` | `number` | The weight of the line item in the store's default weight unit. |
| `url` | `string` | The relative URL of the variant associated with the line item. |
| `url_to_remove` | `string` | A URL to remove the line item from the cart. |
| `image` | `image` | The image of the line item. |
| `selling_plan_allocation` | `selling_plan_allocation` | The selling plan allocation of the line item. If the line item doesn't have a selling plan allocation, then `nil` is returned. |
| `item_components` | `array` | The components of a line item. |
| `instructions` | `instructions` | Instructions define behaviours and operations that can be performed on the nested cart line. |
| `parent_relationship` | `parent_relationship` | The parent relationship for a nested line item. |
| `error_message` | `string` | An informational error message about the status of the line item in the buyer's chosen language. |

## `order`

An order.

**Access:** `checkout.order`, `customer.last_order`, `customer.orders`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `attributes` | `untyped` | The attributes on the order. |
| `cancel_reason` | `string` | The reason that the order was cancelled. |
| `cancel_reason_label` | `string` | The localized version of the cancellation reason for the order. |
| `cancelled` | `boolean` | Returns `true` if the order was cancelled. Returns `false` if not. |
| `cancelled_at` | `string` | A timestamp for when the order was cancelled. |
| `cart_level_discount_applications` | `array` | The discount applications that apply at the order level. |
| `created_at` | `string` | A timestamp for when the order was created. |
| `total_duties` | `number` | The sum of all duties applied to the line items in the order in the currency's subunit. |
| `customer_url` | `string` | The URL for the customer to view the order in their account. |
| `customer` | `customer` | The customer that placed the order. |
| `discount_applications` | `array` | All of the discount applications for the order and its line items. |
| `total_discounts` | `number` | The total amount of all discounts applied to the order in the currency's subunit. |
| `total_net_amount` | `number` | The net amount of the order in the currency's subunit. |
| `tax_price` | `number` | The total amount of taxes applied to the order in the currency's subunit. |
| `total_refunded_amount` | `number` | The total amount that's been refunded from the order in the currency's subunit. |
| `email` | `string` | The email that's associated with the order. |
| `financial_status` | `string` | The order's financial status. |
| `financial_status_label` | `` | The localized version of the financial status of the order. |
| `fulfillment_status` | `string` | The fulfillment status of the order. |
| `fulfillment_status_label` | `string` | The localized version of the fulfillment status of the order. |
| `id` | `number` | The ID of the order. |
| `metafields` | `untyped` | The metafields applied to the order. |
| `name` | `string` | The name of the order. |
| `note` | `string` | The note on the order. |
| `confirmation_number` | `string` | A randomly generated alpha-numeric identifier for the order that may be shown to the customer instead of the sequential order name. For example, "XPAV284CT", "R50KELTJP" or "35PKUN0UJ". This value isn't guaranteed to be unique. |
| `order_number` | `number` | The integer representation of the order name. |
| `order_status_url` | `string` | The URL for the **Order status** page for the order. |
| `customer_order_url` | `string` | The URL for the new order details page. |
| `phone` | `string` | The phone number associated with the order. |
| `shipping_address` | `address` | The shipping address of the order. |
| `billing_address` | `address` | The billing address of the order. |
| `tags` | `array` | The tags on the order. |
| `tax_lines` | `array` | The tax lines on the order. |
| `transactions` | `array` | The transactions of the order. |
| `line_items` | `array` | The line items in the order. |
| `subtotal_line_items` | `array` | The non-tip line items in the order. |
| `item_count` | `number` | The number of items in the order. |
| `shipping_methods` | `array` | The shipping methods for the order. |
| `line_items_subtotal_price` | `number` | The sum of the prices of all of the line items in the order in the currency's subunit, after any line item discounts have been applied. |
| `subtotal_price` | `number` | The sum of the prices of the subtotal line items in the currency's subunit, after any line item or cart discounts have been applied. |
| `total_price` | `number` | The total price of the order in the currency's subunit. |
| `shipping_price` | `number` | The shipping price of the order in the currency's subunit. |
| `pickup_in_store?` | `boolean` | Returns `true` if the order is a store pickup order. |

## `product`

A product in the store.

**Access:** `all_products.`, `collection.products`, `line_item.product`, `link.object`, `metafield.value`, `recommendations.products`, `search.results`, `variant.product`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `selling_plan_groups` | `array` | The selling plan groups that the variants of the product are included in. |
| `metafields` | `untyped` | The metafields applied to the product. |
| `options_with_values` | `array` | The options on the product. |
| `category` | `taxonomy_category` | The taxonomy category for the product |
| `variants` | `array` | The variants of the product. |
| `variants_count` | `number` | The total number of variants for the product. |
| `id` | `number` | The ID of the product. |
| `title` | `string` | The title of the product. |
| `handle` | `string` | The handle of the product. |
| `template_suffix` | `string` | The name of the custom template of the product. |
| `vendor` | `string` | The vendor of the product. |
| `description` | `string` | The description of the product. |
| `content` | `string` | The description of the product. |
| `featured_image` | `image` | The first (featured) image attached to the product. |
| `featured_media` | `media` | The first (featured) media attached to the product. |
| `media` | `array` | The media attached to the product, sorted by the date it was added to the product. |
| `images` | `array` | The images attached to the product. |
| `price_min` | `number` | The lowest price of any variants of the product in the currency's subunit. |
| `price` | `number` | The lowest price of any variants of the product in the currency's subunit. |
| `price_max` | `number` | The highest price of any variants of the product in the currency's subunit. |
| `price_varies` | `boolean` | Returns `true` if the product's variant prices vary. Returns `false` if not. |
| `selected_or_first_available_variant` | `variant` | The currently selected or first available variant of the product. |
| `collections` | `array` | The collections that the product belongs to. |
| `selected_variant` | `variant` | The currently selected variant of the product. |
| `first_available_variant` | `variant` | The first available variant of the product. |
| `available` | `boolean` | Returns `true` if at least one of the variants of the product is available. Returns `false` if not. |
| `options` | `array` | The option names of the product. |
| `type` | `string` | The type of the product. |
| `compare_at_price_min` | `number` | The lowest **compare at** price of any variants of the product in the currency's subunit. This is the same as `product.compare_at_price`. |
| `compare_at_price_max` | `number` | The highest **compare at** price of any variants of the product in the currency's subunit. |
| `compare_at_price` | `number` | The lowest **compare at** price of any variants of the product in the currency's subunit. |
| `compare_at_price_varies` | `boolean` | Returns `true` if the variant **compare at** prices of the product vary. Returns `false` if not. |
| `url` | `string` | The relative URL of the product. |
| `tags` | `array` | The tags of the product. |
| `published_at` | `string` | A timestamp for when the product was published. |
| `created_at` | `string` | A timestamp for when the product was created. |
| `options_by_name` | `untyped` | Allows you to access a specific product option by its name. |
| `has_only_default_variant` | `boolean` | Returns `true` if the product doesn't have any options. Returns `false` if not. |
| `quantity_price_breaks_configured?` | `boolean` | Returns `true` if the product has at least one variant with quantity price breaks in the current customer context. Returns `false` if not. |
| `requires_selling_plan` | `boolean` | Returns `true` if all of the variants of the product require a selling plan. Returns `false` if not. |
| `selected_selling_plan` | `selling_plan` | The currently selected selling plan. |
| `selected_selling_plan_allocation` | `selling_plan_allocation` | The currently selected selling plan allocation for the currently selected variant. |
| `selected_or_first_available_selling_plan_allocation` | `selling_plan_allocation` | The currently selected, or first available, selling plan allocation. |
| `gift_card?` | `boolean` | Returns `true` if the product is a gift card. Returns `false` if not. |

## `variant`

A product variant.

**Access:** `line_item.variant`, `product.first_available_variant`, `product.selected_or_first_available_variant`, `product.variants`, `product.selected_variant`, `product_option_value.variant`, `remote_product.selected_or_first_available_variant`, `remote_product.selected_variant`, `remote_product.first_available_variant`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `metafields` | `untyped` | The metafields applied to the variant. |
| `product` | `product` | The parent product of the variant. |
| `selected` | `boolean` | Returns `true` if the variant is currently selected. Returns `false` if it's not. |
| `matched` | `boolean` | Returns `true` if the variant has been matched by a storefront filter or no filters are applied. Returns `false` if it hasn't. |
| `id` | `number` | The ID of the variant. |
| `title` | `string` | A concatenation of each variant option, separated by a `/`. |
| `quantity_rule` | `quantity_rule` | The quantity rule for the variant. |
| `quantity_price_breaks` | `array` | Returns `quantity_price_break` objects for the variant in the current customer context. |
| `quantity_price_breaks_configured?` | `boolean` | Returns `true` if the variant has any quantity price breaks available in the current customer context. Returns `false` if it doesn't. |
| `price` | `number` | The price of the variant in the currency's subunit. |
| `compare_at_price` | `number` | The **compare at** price of the variant in the currency's subunit. |
| `selected_selling_plan_allocation` | `selling_plan_allocation` | The selected `selling_plan_allocation`. |
| `selling_plan_allocations` | `array` | The `selling_plan_allocation` objects for the variant. |
| `sku` | `string` | The SKU of the variant. |
| `barcode` | `string` | The barcode of the variant. |
| `available` | `boolean` | Returns `true` if the variant is available. Returns `false` if not. |
| `options` | `product_option_value` | The values of the variant for each product option. |
| `url` | `string` | The URL of the variant. |
| `weight_unit` | `string` | The unit for the weight of the variant. |
| `weight_in_unit` | `number` | The weight of the variant in the unit specified by `variant.weight_unit`. |
| `weight` | `number` | The weight of the variant in grams. |
| `unit_price_measurement` | `unit_price_measurement` | The unit price measurement of the variant. |
| `unit_price` | `number` | The unit price of the variant in the currency's subunit. |
| `inventory_quantity` | `number` | The inventory quantity of the variant. |
| `inventory_management` | `string` | The inventory management service of the variant. |
| `inventory_policy` | `string` | Whether the variant should continue to be sold when it's out of stock. |
| `requires_shipping` | `boolean` | Returns `true` if the variant requires shipping. Returns `false` if it doesn't. |
| `taxable` | `boolean` | Returns `true` if taxes should be charged on the variant. Returns `false` if not. |
| `featured_image` | `image` | The image attached to the variant. |
| `image` | `image` | The image attached to the variant. |
| `featured_media` | `media` | The first media object attached to the variant. |
| `incoming` | `boolean` | Returns `true` if the variant has incoming inventory. Returns `false` if not. |
| `next_incoming_date` | `string` | The arrival date for the next incoming inventory of the variant. |
| `store_availabilities` | `array` | The store availabilities for the variant. |
| `requires_selling_plan` | `boolean` | Returns `true` if the variant's product is set to require a `selling_plan` when being added to the cart. Returns `false` if not. |


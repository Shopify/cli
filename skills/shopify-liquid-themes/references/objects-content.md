# Liquid Objects — Content & Theme

> Content and theme objects with full property tables.

## `article`

An article, or blog post, in a blog.

**Access:** `articles.`, `blog.articles`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `image` | `image` | The featured image for the article. |
| `author` | `string` | The full name of the author of the article. |
| `metafields` | `untyped` | The metafields applied to the article. |
| `handle` | `string` | The handle of the article. |
| `id` | `string` | The ID of the article. |
| `title` | `string` | The title of the article. |
| `url` | `string` | The relative URL of the article. |
| `template_suffix` | `string` | The name of the custom template assigned to the article. |
| `created_at` | `string` | A timestamp for when the article was created. |
| `published_at` | `string` | A timestamp for when the article was published. |
| `updated_at` | `string` | A timestamp for when the article was updated. |
| `moderated?` | `boolean` | Returns `true` if the blog that the article belongs to is set to moderate comments. Returns `false` if not. |
| `comments` | `array` | The published comments for the article. |
| `comments_count` | `number` | The number of published comments for the article. |
| `comments_enabled?` | `boolean` | Returns `true` if comments are enabled. Returns `false` if not. |
| `comment_post_url` | `string` | The relative URL where POST requests are sent when creating new comments. |
| `content` | `string` | The content of the article. |
| `excerpt` | `string` | The excerpt of the article. |
| `excerpt_or_content` | `string` | Returns the article excerpt if it exists. Returns the article content if no excerpt exists. |
| `tags` | `array` | The tags applied to the article. |
| `user` | `user` | The user associated with the author of the article. |

## `block`

The content and settings of a section block.

**Access:** `section.blocks`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | The ID of the block. |
| `settings` | `untyped` | The settings of the block. |
| `type` | `string` | The type of the block. |
| `shopify_attributes` | `string` | The data attributes for the block for use in the theme editor. |

## `blog`

Information about a specific blog in the store.

**Access:** Templates: blog, article

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `number` | The ID of the blog. |
| `title` | `string` | The title of the blog. |
| `handle` | `string` | The handle of the blog. |
| `articles` | `array` | The articles in the blog. |
| `articles_count` | `number` | The total number of articles in the blog. This total doesn't include hidden articles. |
| `metafields` | `array` | The metafields applied to the blog. |
| `url` | `string` | The relative URL of the blog. |
| `template_suffix` | `string` | The name of the custom template assigned to the blog. |
| `all_tags` | `array` | All of the tags on the articles in the blog. |
| `tags` | `array` | A list of all of the tags on all of the articles in the blog.  Unlike `blog.all_tags`, this property only returns tags of articles that are in the filtered view. |
| `comments_enabled?` | `boolean` | Returns `true` if comments are enabled for the blog. Returns `false` if not. |
| `moderated?` | `boolean` | Returns `true` if the blog is set to moderate comments. Returns `false` if not. |
| `next_article` | `article` | The next (older) article in the blog. |
| `previous_article` | `article` | The previous (newer) article in the blog. |

## `collection`

A collection in a store.

**Access:** `collections.`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `metafields` | `array` | The metafields applied to the collection. |
| `id` | `number` | The ID of the collection. |
| `handle` | `string` | The handle of the collection. |
| `title` | `string` | The title of the collection. |
| `description` | `string` | The description of the collection. |
| `template_suffix` | `string` | The name of the custom template assigned to the collection. |
| `current_vendor` | `string` | The vendor name on a vendor collection page. |
| `current_type` | `string` | The product type on a product type collection page. |
| `url` | `string` | The relative URL of the collection. |
| `published_at` | `string` | A timestamp for when the collection was published. |
| `image` | `image` | The image for the collection. |
| `sort_options` | `array` | The available sorting options for the collection. |
| `sort_by` | `string` | The sort order applied to the collection by the `sort_by` URL parameter. |
| `default_sort_by` | `string` | The default sort order of the collection. |
| `next_product` | `product` | The next product in the collection. Returns `nil` if there's no next product. |
| `previous_product` | `product` | The previous product in the collection. Returns `nil` if there's no previous product. |
| `products_count` | `number` | The total number of products in the current view of the collection. |
| `products` | `array` | All of the products in the collection. |
| `all_products_count` | `number` | The total number of products in a collection. |
| `all_tags` | `array` | All of the tags applied to the products in the collection. |
| `tags` | `array` | The tags that are currently applied to the collection. |
| `all_types` | `array` | All of the product types in a collection. |
| `all_vendors` | `array` | All of the product vendors in a collection. |
| `filters` | `array` | The storefront filters that have been set up on the collection. |
| `featured_image` | `image` | The featured image for the collection. |

## `customer`

A customer of the store.

**Access:** Global

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `first_name` | `string` | The first name of the customer. |
| `last_name` | `string` | The last name of the customer. |
| `orders_count` | `number` | The total number of orders that the customer has placed. |
| `total_spent` | `number` | The total amount that the customer has spent on all orders in the currency's subunit. |
| `orders` | `array` | All of the orders placed by the customer. |
| `last_order` | `order` | The last order placed by the customer, not including test orders. |
| `name` | `string` | The full name of the customer. |
| `email` | `string` | The email of the customer. |
| `phone` | `string` | The phone number of the customer. |
| `has_account` | `boolean` | Returns `true` if the email associated with the customer is tied to a customer account. Returns `false` if not. |
| `accepts_marketing` | `boolean` | Returns `true` if the customer accepts marketing. Returns `false` if not. |
| `id` | `number` | The ID of the customer. |
| `tags` | `array` | The tags associated with the customer. |
| `default_address` | `address` | The default address of the customer. |
| `addresses` | `array` | All of the addresses associated with the customer. |
| `addresses_count` | `number` | The number of addresses associated with the customer. |
| `tax_exempt` | `boolean` | Returns `true` if the customer is exempt from taxes. Returns `false` if not. |
| `payment_methods` | `array` | The customer's saved payment methods. |
| `b2b?` | `boolean` | Returns `true` if the customer is a B2B customer. Returns `false` if not. |
| `company_available_locations` | `array` | The company locations that the customer has access to, or can interact with. |
| `company_available_locations_count` | `number` | The number of company locations associated with the customer. |
| `current_location` | `company_location` | The currently selected company location. |
| `current_company` | `company` | The company that the customer is purchasing for. |
| `has_avatar?` | `boolean` | Returns `true` if an avatar is associated with a customer. Returns `false` if not. |
| `store_credit_account` | `store_credit_account` | The store credit account associated with the customer. |

## `form`

Information about a form created by a `form` tag.

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `errors` | `form_errors` | Any errors from the form. |
| `address1` | `string` | The first address line associated with the address. |
| `address2` | `string` | The second address line associated with the address. |
| `author` | `string` | The name of the author of the article comment. |
| `body` | `string` | The content of the contact submission or article comment. |
| `city` | `string` | The city associated with the address. |
| `company` | `string` | The company associated with the address. |
| `country` | `string` | The country associated with the address. |
| `email` | `string` | The email associated with the form. |
| `first_name` | `string` | The first name associated with the customer or address. |
| `id` | `string` | The ID of the form. |
| `last_name` | `string` | The last name associated with the customer or address. |
| `password_needed` | `boolean` | Returns `true`. |
| `phone` | `string` | The phone number associated with the address. |
| `posted_successfully?` | `boolean` | Returns `true` if the form was submitted successfully. Returns `false` if there were errors. |
| `province` | `string` | The province associated with the address. |
| `set_as_default_checkbox` | `string` | Renders an HTML checkbox that can submit the address as the customer's default address. |
| `name` | `string` | The nickname of the gift card recipient. |
| `message` | `string` | The personalized message intended for the recipient. |
| `zip` | `string` | The zip or postal code associated with the address. |

## `image`

An image, such as a product or collection image.

**Access:** `article.image`, `blog.image`, `collection.image`, `generic_file.preview_image`, `line_item.image`, `media.preview_image`, `model.preview_image`, `product.featured_image`, `product.media`, `product.images`, `variant.image`, `video.preview_image`, `brand.favicon_url`, `brand.cover_image`, `brand.logo`, `brand.square_logo`, `collection.featured_image`, `external_video.preview_image`, `filter_value.image`, `image.preview_image`, `swatch.image`, `variant.featured_image`, `remote_product.featured_image`, `user.image`, `page_image.`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `presentation` | `image_presentation` | The presentation settings for the image. |
| `src` | `string` | The relative URL of the image. |
| `width` | `number` | The width of the image in pixels. |
| `height` | `number` | The height of the image in pixels. |
| `aspect_ratio` | `number` | The aspect ratio of the image as a decimal. |
| `alt` | `string` | The alt text of the image. |
| `attached_to_variant?` | `boolean` | Returns `true` if the image is associated with a variant. Returns `false` if not. |
| `id` | `number` | The ID of the image. |
| `media_type` | `string` | The media type of the image. Always returns `image`. |
| `position` | `number` | The position of the image in the `product.images` or `product.media` array. |
| `preview_image` | `image` | A preview image for the image. |
| `product_id` | `number` | The ID of the product that the image is associated with. |
| `variants` | `array` | The product variants that the image is associated with. |

## `page`

A page on a store.

**Access:** `pages.`, `metafield.value`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `number` | The ID of the page. |
| `author` | `string` | The author of the page. |
| `handle` | `string` | The handle of the page. |
| `title` | `string` | The title of the page. |
| `template_suffix` | `string` | The name of the custom template assigned to the page. |
| `content` | `string` | The content of the page. |
| `url` | `string` | The relative URL of the page. |
| `metafields` | `untyped` | The metafields applied to the page. |
| `published_at` | `string` | A timestamp for when the page was published. |

## `section`

The properties and settings of a section.

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | The ID of the section. |
| `settings` | `untyped` | The settings of the section. |
| `index` | `number` | The 1-based index of the current section within its location. |
| `index0` | `number` | The 0-based index of the current section within its location. |
| `location` | `string` | The scope or context of the section (template, section group, or global). |
| `blocks` | `array` | The blocks of the section. |

## `shop`

Information about the store, such as the store address, the total number of products, and various settings.

**Access:** Global

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | The ID of the store. |
| `name` | `string` | The name of the store. |
| `description` | `string` | The description of the store. |
| `enabled_currencies` | `array` | The currencies that the store accepts. |
| `published_locales` | `array` | The locales (languages) that are published on the store. |
| `url` | `string` | The full URL of the store. |
| `email` | `string` | The sender email of the store. |
| `secure_url` | `string` | The full URL of the store, with an `https` protocol. |
| `domain` | `string` | The primary domain of the store. |
| `permanent_domain` | `string` | The `.myshopify.com` domain of the store. |
| `phone` | `string` | The phone number of the store. |
| `password_message` | `string` | The password page message of the store. |
| `address` | `address` | The address of the store. |
| `customer_accounts_enabled` | `boolean` | Returns `true` if the store shows a login link. Returns `false` if not. |
| `customer_accounts_optional` | `boolean` | Returns `true` if customer accounts are optional to complete checkout. Returns `false` if not. |
| `currency` | `string` | The currency of the store. |
| `money_format` | `currency` | The money format of the store. |
| `money_with_currency_format` | `currency` | The money format of the store with the currency included. |
| `metafields` | `` | The metafields applied to the store. |
| `enabled_payment_types` | `array` | The accepted payment types on the store. |
| `refund_policy` | `policy` | The refund policy for the store. |
| `shipping_policy` | `policy` | The shipping policy for the store. |
| `privacy_policy` | `policy` | The privacy policy for the store. |
| `terms_of_service` | `policy` | The terms of service for the store. |
| `subscription_policy` | `policy` | The subscription policy for the store. |
| `policies` | `array` | The policies for the store. |
| `vendors` | `array` | All of the product vendors for the store. |
| `types` | `array` | All of the product types in the store. |
| `products_count` | `number` | The number of products in the store. |
| `collections_count` | `number` | The number of collections in the store. |
| `accepts_gift_cards` | `boolean` | Returns `true` if the store accepts gift cards. Returns `false` if not. |
| `brand` | `brand` | The brand assets for the store. |


{{- template "shared/shopify.ui.extension.toml" . }}

extension_points = [
  'Checkout::Dynamic::Render'
]

# [[metafields]]
# namespace = "my-namespace"
# key = "my-key"

# [[metafields]]
# namespace = "my-namespace"
# key = "my-key-2"

# Read more on extension settings at https://shopify.dev/api/checkout-extensions/checkout/settings
# [[settings.fields]]
# key = "heading"
# name = "Heading"
# type = "single_line_text_field"

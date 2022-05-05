{{- template "shared/shopify.ui.extension.toml" . }}

extension_points = [
  'Checkout::Dynamic::Render'
]

# [[metafields]]
# namespace: my-namespace
# key: my-key

# [[metafields]]
# namespace: my-namespace
# key: my-key-2
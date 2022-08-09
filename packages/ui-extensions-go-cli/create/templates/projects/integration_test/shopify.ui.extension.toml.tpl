{{ template "shared/shopify.ui.extension.toml" . }}

extension_points = [
  "Playground"
]

[[metafields]]
namespace = "my-namespace"
key = "my-key"

[development.build.env]
CUSTOM_VAR = "bar"

[development.develop.env]
CUSTOM_VAR = "foo"

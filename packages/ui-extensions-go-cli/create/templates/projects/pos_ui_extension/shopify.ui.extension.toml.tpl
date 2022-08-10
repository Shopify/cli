{{- template "shared/shopify.ui.extension.toml" . }}

extension_points = [
  'Retail::SmartGrid::Tile',
  'Retail::SmartGrid::Modal'
]
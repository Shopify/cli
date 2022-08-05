{{- template "shared/shopify.ui.extension.toml" . }}

extension_points = [
  'CustomerAccount::FullPage::RenderWithin',
]

categories = []

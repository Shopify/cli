{{ template "shared/shopify.ui.extension.toml" . }}
runtime_context = "strict"

[configuration]
type = "object"

[configuration.fields.accountID]
name = "Account ID"
description = "Account ID"
type = "single_line_text_field"
validations =  [
  { name = "min", value = "1" }
]

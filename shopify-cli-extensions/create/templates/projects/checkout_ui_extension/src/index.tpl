{{- if .Development.UsesReact -}}
{{ file "shared/checkout_ui_extension/react.js" }}
{{- else -}}
{{ file "shared/checkout_ui_extension/javascript.js" }}
{{- end -}}

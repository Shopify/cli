{{- if .Development.UsesReact -}}
{{ template "shared/checkout_ui_extension/react.js" . }}
{{- else -}}
{{ template "shared/checkout_ui_extension/javascript.js" . }}
{{- end -}}

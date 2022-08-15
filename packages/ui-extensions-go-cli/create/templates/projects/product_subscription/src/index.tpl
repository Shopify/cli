{{- if .Development.UsesReact -}}
{{ template "shared/product_subscription/react.js" . }}
{{- else -}}
{{ template "shared/product_subscription/javascript.js" . }}
{{- end -}}

{{- if .Development.UsesReact -}}
{{ template "shared/checkout_post_purchase/react.js" . }}
{{- else -}}
{{ template "shared/checkout_post_purchase/javascript.js" . }}
{{- end -}}

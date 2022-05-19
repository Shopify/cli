{{- if .Development.UsesReact -}}
{{ file "shared/checkout_post_purchase/react.js" }}
{{- else -}}
{{ file "shared/checkout_post_purchase/javascript.js" }}
{{- end -}}

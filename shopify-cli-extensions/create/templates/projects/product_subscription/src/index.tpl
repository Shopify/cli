{{- if .Development.UsesReact -}}
{{ file "shared/product_subscription/react.js" }}
{{- else -}}
{{ file "shared/product_subscription/javascript.js" }}
{{- end -}}

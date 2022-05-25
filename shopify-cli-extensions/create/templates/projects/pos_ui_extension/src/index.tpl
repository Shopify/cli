{{- if .Development.UsesReact -}}
{{ file "shared/pos_ui_extension/react.js" }}
{{- else -}}
{{ file "shared/pos_ui_extension/javascript.js" }}
{{- end -}}
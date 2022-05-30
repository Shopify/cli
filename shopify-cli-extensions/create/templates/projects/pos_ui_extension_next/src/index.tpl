{{- if .Development.UsesReact -}}
{{ template "shared/pos_ui_extension/react.js" . }}
{{- else -}}
{{ template "shared/pos_ui_extension/javascript.js" . }}
{{- end -}}
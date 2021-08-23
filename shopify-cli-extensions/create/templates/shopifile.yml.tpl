---
entry:
  {{- range $key, $value := .Development.Entry}}
  {{$key}}: "{{$value}}"
  {{- end}}
out_dir: "{{ .Development.BuildDir }}"
# build:
#   env:
#     CUSTOM_VAR: bar
# develop:
#   env:
#     CUSTOM_VAR: foo
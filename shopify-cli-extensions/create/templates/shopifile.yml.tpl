---
extensions:
 development:
  entries:
    {{- range $key, $value := .Development.Entries}}
    {{$key}}: "{{$value}}"
    {{- end}}
  build_dir: "{{ .Development.BuildDir }}"
  # build:
  #   env:
  #     CUSTOM_VAR: bar
  # develop:
  #   env:
  #     CUSTOM_VAR: foo
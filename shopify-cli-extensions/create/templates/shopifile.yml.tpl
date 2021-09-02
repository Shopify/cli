---
development:
  entries:
    {{- range $key, $value := .Development.Entries}}
    {{$key}}: "{{$value}}"
    {{- end}}
  build_dir: "{{ .Development.BuildDir }}"
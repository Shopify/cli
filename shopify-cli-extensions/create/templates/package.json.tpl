{
    "name": "{{ .Type }}",
    "license": "MIT",
    "dependencies": {
      {{ if .React }}"{{ .Development.Renderer.Name }}-react": "latest",{{ end }}
      {{ if .React }}"react": "^17.0.0"{{ else }}"{{ .Development.Renderer.Name }}": "latest"{{ end }}
    },
    "devDependencies": {
      {{ if .TypeScript }}"typescript": "^4.1.0",{{ end }}
      "@shopify/shopify-cli-extensions": "latest"
    },
    "scripts": {
      "build": "shopify-cli-extensions build",
      "develop": "shopify-cli-extensions develop"
    }
  }
  
{{- with .Development}}/* global module */
module.exports = {
  plugins: [{{ if .UsesReact }}'react', {{ end }}{{ if .UsesTypeScript }}'@typescript-eslint', {{ end }}'prettier'],
  {{ if .UsesTypeScript }}parser: '@typescript-eslint/parser',{{ end }}
  extends: [
    'eslint:recommended',
    {{ if .UsesReact }}'plugin:react/recommended',{{ end }}
    {{ if .UsesTypeScript }}'plugin:@typescript-eslint/recommended',{{ end }}
    {{ if .UsesTypeScript }}'prettier/@typescript-eslint',{{ end }}
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: {
      {{ if .UsesReact }}jsx: true,{{ end }}
    },
  },
  settings: {
    {{ if .UsesReact }}react: {
      version: '17.0',
    },{{ end }}
  },
  rules: {
    {{ if .UsesReact }}'react/react-in-jsx-scope': 'off',{{ end }}
    {{ if .UsesTypeScript }}'@typescript-eslint/explicit-module-boundary-types': 'off',{{ end }}
  },
  ignorePatterns: ['build/*'],
};
{{- end }}

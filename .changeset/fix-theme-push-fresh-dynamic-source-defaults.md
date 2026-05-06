---
'@shopify/theme': patch
---

Upload `config/settings_schema.json` before any other theme file. Fixes `theme push` failing on the first push when blocks or sections reference a `color_palette` theme setting.

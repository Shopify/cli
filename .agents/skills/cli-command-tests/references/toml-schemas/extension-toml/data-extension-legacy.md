# Legacy `data_extension`

A short-lived conditional Admin action format put two extensions in one file:

```text
ActionUI := {
  name: string
  handle: Handle
  type: "ui_extension"
  targeting: [{
    module: string
    target: "admin.product-details.action.render"
    should_render_handle: string
  }]
}

DataExtension := {
  handle: Handle
  type: "data_extension"
  targeting: [{
    module: string
    target: "admin.product-details.action.should-render"
  }]
}
```

## Versions and migration

- **DE0 — 2024-10-16:** separate data extension introduced.
- **DE1 — 2024-10-25:** UI target referenced it by handle.
- **DE2 — 2024-11-15:** replaced by nested `[extensions.targeting.should_render] module = ...` in a single `ui_extension`.

Move the data extension module to the matching UI target’s `should_render.module`. Then remove the handle link and the second extension entry. Fail if the handle match is missing or ambiguous.

## Sources

- historical `conditional-action-extension` commits `f4bc347`, `005988c`, and `ab5e233`

---
'@shopify/ui-extensions-dev-console-app': minor
---

Added a Tooltip component used to wrap any item you wish to have a tooltip.

Tooltip accepts a string prop `text` for the content of the tooltip, and a single child of type `JSX.Element` OR `string`.

### Example
```tsx
import {Tooltip} from '@components/Tooltip'

// Add a tooltip to a component

<Tooltip text="This is a tooltip!">
  <IconButton icon={SomeIcon} />
</Tooltip>

// Add a tooltip to an a string

<Tooltip text="This is a tooltip!">
  This string will have a dotted underline.
</Tooltip>

// Since Tooltip is wrapped an inline-block div, it may be used
// in a block of text

<p>
  Only <Tooltip text="This right here!">this section</Tooltip> will be underlined and trigger a tooltip.
</p>
```

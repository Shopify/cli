# JSON output contracts

Finite commands expose their successful result as typed data independently from terminal presentation. The command's
domain package owns this contract; CLI Kit only provides the shared schema and help infrastructure.

## Define the result beside the domain service

Keep the schema beside the service that produces the result. One Zod schema supplies runtime validation, the inferred
TypeScript type, JSON encoding, and the type shown in command help.

```ts
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const WidgetSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
})

export const widgetListJsonOutputSchema = defineJsonOutputSchema({
  name: 'WidgetListResult',
  schema: zod.object({widgets: zod.array(WidgetSchema)}),
  definitions: {Widget: WidgetSchema},
})

export type WidgetListResult = InferJsonOutputSchema<typeof widgetListJsonOutputSchema>
```

Add nested object schemas to `definitions` so generated help gives them stable names. Use `.passthrough()` only when
the public result deliberately permits additional keys.

## Connect the command and encoder

Expose the contract from the command and encode through it. Encoding validates the value before serialization.

```ts
export default class WidgetList extends Command {
  static get jsonOutputSchema() {
    return widgetListJsonOutputSchema
  }

  static descriptionWithMarkdown = 'Lists widgets.'
  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    const result = await listWidgets()
    outputResult(widgetListJsonOutputSchema.encode(result))
  }
}
```

If the service result and public JSON document differ, keep that mapping in a command-specific codec and validate the
mapped value with the schema. Presenters continue to own terminal text, output channels, files, and exit behavior. A
result contract must not depend on terminal rendering, Oclif, filesystem output, or CLI errors.

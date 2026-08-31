# JSON output contracts

Finite commands expose their successful result as typed data independently from terminal presentation. The command's
domain package owns this contract; CLI Kit only provides the shared schema and help infrastructure.

New finite query and operation commands must include `jsonFlag` and expose a `jsonOutputSchema`. The repository lint
check enforces both. Existing commands are recorded in a temporary migration baseline in
`packages/eslint-plugin-cli/rules/json-output-legacy-command-paths.js`; remove a command from that baseline when it is
converted, and never add new commands to it.

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
  static flags = {
    ...globalFlags,
    ...jsonFlag,
  }

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

## Keep data and presentation separate

A finite command should have these boundaries:

- The domain service returns typed data and doesn't print terminal output.
- A command-specific codec maps the service result to the stable public JSON shape when they differ.
- The schema validates and encodes that public result.
- A presenter turns the same result into human-readable terminal output.

Presenters continue to own terminal text, output channels, files, and exit behavior. A result contract must not depend
on terminal rendering, Oclif, filesystem output, or CLI errors.

Events are separate from finite results. Progress events can drive spinners or status messages while the command is
running, but they aren't fields in the final JSON result. Errors continue through the standard CLI error path and
stderr; don't encode failures as successful result shapes merely to support `--json`.

## Preserve compatibility

Treat the JSON result as a public API. Keep existing keys, omission rules, nullability, collection shapes, and exit
behavior when converting a command. Put compatibility mappings in the codec instead of changing domain models or
leaking presenter details into the schema. Add regression tests for the exact encoded result as well as schema
validation.

`--json` selects the output format. `--no-input` controls interactivity. They are independent: JSON output must not
silently disable prompts, and non-interactive execution must not silently select JSON. A command that can prompt should
support and test the relevant combinations explicitly.

## Exempt only streaming commands

Long-lived commands that produce an open-ended event stream don't have one finite result. Mark those commands
explicitly instead of inventing a final JSON document:

```ts
export default class WidgetWatch extends Command {
  static jsonOutputSupport = 'streaming' as const
}
```

This exemption is only for commands whose lifetime or output is inherently streaming. A finite operation remains a
finite command even when it emits progress events, writes a file, or has no interesting return value.

## Test a new command

Tests should verify:

- the domain service result without terminal concerns;
- codec compatibility and schema validation;
- the exact `--json` document;
- human presentation independently from JSON encoding;
- errors and exit behavior; and
- prompt behavior independently from `--json` and `--no-input`.

Command help includes the generated TypeScript contract automatically through `jsonOutputSchema`. Run the manifest,
README, and code-documentation refresh commands required by CI after changing command metadata.

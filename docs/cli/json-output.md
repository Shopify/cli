# JSON output contracts

This guide is the canonical contract for new JSON flags in Shopify CLI and its plugins, including Hydrogen. It records the agreed JSON conventions.

A finite command finishes its work, returns one final result, and exits, such as `shopify store list`. Commands that
keep running and streaming updates, such as `shopify app dev`, are currently outside this contract.

Finite commands expose their successful result as typed data independently from terminal presentation. The command's
domain package owns this contract; CLI Kit only provides the shared schema and help infrastructure.

New finite query and operation commands must include `jsonFlag` and expose a `jsonOutputSchema`. The repository lint
check enforces both. Exceptions are recorded in
`packages/eslint-plugin-cli/rules/json-output-command-exceptions.js`. Its migration section tracks existing finite
commands; remove each entry when converted, and never add new finite commands to it.

## Choose the public shape

Every finite JSON invocation writes one object to stdout: a result or a fatal error document. Empty, skipped, and
cancelled outcomes still have an object. Never return a bare array, bare null, or multiple concatenated documents.
Progress and diagnostics use JSON side events on stderr.

| Concern | Convention |
| --- | --- |
| Collections | Named plural arrays: `versions`, `sources`, `stores`, `sessions`, `themes`, `subscriptions`, `operations`, `results`, `variables`. Known empty collections are `[]`. |
| Resources | Named objects: `store`, `session`, `app`, `theme`, `storefront`, `deployment`. Simple scalar results such as `{version}` and `{url}` remain objects. |
| Field names | Use camelCase for CLI-owned fields. Preserve original keys only inside documented native payloads. |
| IDs | All identifiers are strings. Use `gid` for Shopify GIDs and `id` for other identifiers. References use the same distinction: `storefrontGid` versus `storefrontId`. Document and validate each resource's format and namespace; never invent GIDs. |
| Instants | UTC ISO 8601 with whole seconds and `Z`: `2026-09-30T10:20:30Z`. Truncate fractional seconds; do not round. Reject fractions and offsets in the public schema. |
| Dates and durations | Genuine calendar dates remain `YYYY-MM-DD`; do not invent a midnight or timezone. Durations state their units. Human date formatting belongs in text presenters. |
| Store domains | `storeDomain` is the canonical full `*.myshopify.com` hostname, or `null` when unknown. `primaryDomain` can be a custom storefront hostname. Reserve `store` for an object; remove redundant `subdomain`. Never append `.myshopify.com` to a custom hostname. |
| Missing values | A field within the requested resource projection is `null` when unavailable. Omit fields outside that projection. Never use `""` for unknown values. Document the rules in each shared resource schema. |
| Shared meanings | Use `name`, `clientId`, `previousVersion`, and distinct `planHandle`/`planName`. Resource URL names and placement agree across commands. Different projections may expose different fields, but a shared field keeps its meaning. |
| Numbers and enums | Bulk `objectCount` is a nonnegative decimal string; reject unsafe numeric inputs. Bounded counts and positions are nonnegative integers; money uses strings. CLI-owned enums are closed, with kebab-case multiword values. Upstream enums remain extensible strings with documented known values. |
| Files | Use absolute native filesystem paths: `path` for the primary artifact, `directory` for a project directory, descriptive `...Path` fields for additional files. Relative route names stay route names. |
| Diagnostics | Use `filePath` for filesystem paths and array-valued `fieldPath` for configuration fields. JSON line/column positions are zero-based; text presenters can convert them. |
| Pagination | Use `pageInfo` when results are capped, retain totals already fetched, and distinguish unknown values from `false` or zero. Do not invent a cursor. Document whether the list is complete or one page. |
| Versioning | Version CLI result contracts with the CLI release. Independently versioned artifact formats keep their own versions; do not introduce a command-specific result version field. |

For example, collection and identifier names describe the result without guessing its namespace:

```json
{
  "versions": [
    {"gid": "gid://shopify/Version/1", "createdAt": "2026-09-30T10:20:30Z", "createdBy": null}
  ]
}
```

### Variables and native payloads

Use the same `variables` array for app and Hydrogen environment commands. Each record requires `name`; include `value`,
`isSecret`, `id`, and `readOnly` only when known. Preserve the variable's original spelling in `name`. Omit unknown
optional metadata, and do not add secret values to metadata-only results. Names-only records use `{name}`; an empty
result is `{variables: []}`.

```json
{
  "variables": [
    {"name": "SCOPES", "value": "read_products", "isSecret": false},
    {"name": "PRIVATE_TOKEN", "id": "42", "isSecret": true, "readOnly": false},
    {"name": "SHOPIFY_API_KEY"}
  ]
}
```

Native configuration content belongs under `configuration`, where keys such as `client_id` remain unchanged.
GraphQL execution returns `{data, extensions?}` and preserves query keys and aliases under `data`. Flatten CLI-owned
collections such as migration `results.edges[].node` into named arrays, but leave arbitrary query data intact.

Preserve JSONL, dotenv, TOML, GraphQL SDL, Function runner output, Speedscope, security documents, and Hydrogen's existing
deployment-log file in their native formats. Name and document each exception and its schema or format version.
An API source alone does not make a CLI-owned wrapper exempt from these conventions.

### Outcomes, errors, and files

Commands that can skip, cancel, or partly complete expose `status`: `success`, `partial`, `skipped`, or `cancelled`.
Use `changed` for successful no-ops and separate `dryRun` and `reason` where useful. Keep upstream resource states,
such as bulk `RUNNING`, inside the resource. A failed batch item can use `status: "failed"`.

Declined confirmation, successful skips, and no-ops exit zero. Failed or partially failed requested work exits nonzero;
retain exit 130 for Ctrl-C where supported. Missing required non-interactive input is an error. A status query can
successfully report a previously failed remote operation without failing the query itself.

Failed single operations and setup, authentication, or transport failures use CLI Kit's `{error: {type, message, ...}}`
envelope. Keep domain details under `details`, and add stable error codes when callers need to branch. GraphQL failures
retain `details.errors`, `details.extensions`, and partial `details.data` when available. Do not print a result followed
by a second fatal document.

Fatal errors and diagnostic events may include a nonempty string `code` when a stable code is known. Omit unknown
codes rather than using `null` or an empty string. Keep upstream error codes inside their native `details` payload.

A completed validation is a result with `valid` and consistent issues, even if it finds problems. Use a nonzero exit
when the selected blocking policy fails. Infrastructure failures remain fatal errors. Preserve completed work in batch
or partial results rather than discarding successful items.

With `--json --output-file`, stdout contains only `{path, format}`; the file contains the result or native artifact.
GraphQL JSON files contain `{data, extensions?}` with `format: "json"`. Bulk files remain native JSONL with
`format: "jsonl"`; inline JSONL is explicitly named `resultsJsonl`. Describe stdout variants and file contents in their
schemas. Do not emit a receipt for a file that was not written; report cancellation or failure instead.

### Environment batches

Whenever `--environment` is explicitly provided, return one `{environments: [...]}` object, even for one named
environment. Without that flag, retain the command's ordinary object result. Include every requested environment in
request order, including failures and skips, and exit nonzero when any requested operation fails. A batch item has
either `result` or `error`; its error uses the shared CLI error fields.

```json
{
  "environments": [
    {"environment": "staging", "result": {"status": "success", "changed": true}},
    {"environment": "production", "error": {"type": "abort", "message": "Authentication failed."}}
  ]
}
```

## Define the result beside the domain service

Keep the schema beside the service that produces the result. One Zod schema supplies runtime validation, the inferred
TypeScript type, JSON encoding, and the JSON Schema shown in command help.

Choose an explicit public projection and reuse existing resource schemas and codecs. Include useful public data already
available, including fields omitted from text output, but do not spread an implementation model or expose accidental
runtime fields. Do not add API requests merely to fill a projection; apply the missing-value rules instead.

```ts
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const WidgetSchema = zod
  .object({
    id: zod.string().regex(/^\d+$/).describe('The decimal widget ID, not a Shopify GID.'),
    name: zod.string(),
  })
  .strict()

export const widgetListJsonOutputSchema = defineJsonOutputSchema({
  name: 'WidgetListResult',
  schema: zod.object({widgets: zod.array(WidgetSchema)}).strict(),
  definitions: {Widget: WidgetSchema},
})

export type WidgetListResult = InferJsonOutputSchema<typeof widgetListJsonOutputSchema>
```

Optionally add nested object schemas to `definitions` to give them stable names and references in JSON Schema.
Use `.strict()` for every CLI-owned object, including nested records, with explicit projection codecs before validation.
Use open records or `.passthrough()` only at documented native boundaries such as `configuration` or GraphQL `data`.
Validate URLs, ID formats, counts, and timestamps according to their meaning. A schema alone does not ensure every
execution path emits the right result or exit code.

For CLI-owned instants, use `jsonOutputTimestampSchema` to validate public fields and
`formatJsonOutputTimestamp(date)` to format them. Both are exported from
`@shopify/cli-kit/common/json-output-schema` and `@shopify/cli-kit/node/json-output-schema`.

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
  static description = this.descriptionForHelp()

  async run(): Promise<void> {
    const {flags} = await this.parse(WidgetList)
    const result = await listWidgets()
    if (flags.json) {
      outputResult(widgetListJsonOutputSchema.encode(result))
    } else {
      renderWidgetListResult(result)
    }
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
on terminal rendering (including React/Ink), Oclif, filesystem output, or CLI errors.

Events are separate from finite results. Progress events can drive spinners or status messages while the command is
running, but they aren't fields in the final JSON result. Fatal errors continue through the standard CLI error path.

Diagnostic and progress event timestamps follow the instant convention: UTC whole seconds ending in `Z`, with
fractional seconds truncated rather than rounded. Optional progress `current` and `total` counts are nonnegative
integers; omit counts that aren't known.
Completed validation reports and partial or batch outcomes remain results with the exit policy described above.

### Task progress events

`renderTasks` uses one `operation` ID for the whole task list, including subtasks. It emits `started` for the first
task that runs, `updated` for subsequent tasks, and `completed` after the whole list succeeds. Skipped tasks emit no
progress events. Empty lists and lists where every task is skipped emit no events.

`renderTasks` accepts a `retry` count on each task, and `renderSingleTask` accepts it in its options. It is the number
of additional attempts after a failure and defaults to zero. Both emit `retrying` before each repeated task attempt,
using the same operation ID. Once retries are exhausted, they emit one `failed` event and throw the original error.
Only successful operations emit `completed`. Failure events identify the task through `message`; error details
continue through the standard CLI error path.

Cancellation does not trigger retries or a `failed` event in `renderSingleTask` when its `onAbort` callback runs.
An interrupted operation can still end without a terminal progress event, so consumers must also handle process exit.

## Conventions and changesets

Follow these conventions and make every change required to align the JSON output. This applies to existing commands,
new commands, and schema-adoption work.

- Add a major changeset when a command already has a `--json` flag and the change breaks its JSON contract, including
  field names, types, collection shapes, missing-value rules, errors, or exit behavior.
- Add a minor changeset for a new command or for adding a `--json` flag to an existing command for the first time.

Map domain data to the agreed public contract in codecs. Update schemas, tests, and examples together, and describe
breaking changes so consumers can migrate. Keep independently versioned native artifact formats separate.

`--json` selects the output format. `--no-input` controls interactivity. They are independent: JSON output must not
silently disable prompts, and non-interactive execution must not silently select JSON. A command that can prompt should
support and test the relevant combinations explicitly.

When a JSON command prompts, stderr also contains human-readable UI and terminal control sequences. In this
interactive mode, stderr is not a pure JSONL stream. For automation, use `--json --no-input` to capture JSON side
events from stderr; missing required input then produces a fatal error instead of a prompt.

## Exempt only streaming commands

Long-lived commands that produce an open-ended event stream don't have one finite result. Track these exemptions in
`packages/eslint-plugin-cli/rules/json-output-command-exceptions.js`, in its streaming section. Add the command's
repository-relative path:

```js
'packages/app/src/cli/commands/app/widgets/watch.ts',
```

The lint rule only exempts paths in that list; a `jsonOutputSupport` property alone does not exempt a new command.

This exemption is only for commands whose lifetime or output is inherently streaming. A finite operation remains a
finite command even when it emits progress events, writes a file, or has no interesting return value.

## Plugin authors

### Enable the JSON output lint rule

Other repositories can install a version of `@shopify/eslint-plugin-cli` that includes `command-json-output`
and enable the rule in their existing ESLint flat config. Importing the plugin's `rules` does not require
extending its full CLI configuration.

For example, Hydrogen can add this entry to its existing `eslint.config.js` array:

```js
const cliPlugin = require('@shopify/eslint-plugin-cli')
const {commandExceptions} = require('./json-output-command-exceptions.cjs')

module.exports = [
  // Other existing configuration entries.
  {
    files: ['packages/cli/src/commands/**/*.ts'],
    plugins: {'@shopify/cli': cliPlugin},
    rules: {
      '@shopify/cli/command-json-output': ['error', {exceptions: commandExceptions}],
    },
  },
]
```

Create `json-output-command-exceptions.cjs` in that repository, exporting a `commandExceptions` array.
Use exact repository-relative paths with forward slashes, such as `packages/cli/src/commands/hydrogen/dev.ts`.
Paths are matched individually; exempting a command does not exempt its subcommands. The rule recognizes command
files under both `packages/*/src/commands/` and `packages/*/src/cli/commands/`.

The `exceptions` option replaces the built-in Shopify CLI list. An empty array disables all exemptions;
omitting the option preserves the built-in list. Keep the local list limited to existing finite commands awaiting
migration and streaming commands, and remove finite entries as they adopt the contract.

### Control plugin output

Plugins must adopt the result contract and control their output before their commands can be used reliably in JSON
mode. Inheriting `--json-schema` or enabling `SHOPIFY_FLAG_JSON=1` doesn't convert all plugin output automatically.

- In the command event context, `renderTasks` and `renderSingleTask` run without Ink and emit JSON progress events
  when JSON mode is enabled. This also applies when `SHOPIFY_FLAG_JSON=1` enables JSON mode for a plugin command that
  doesn't declare a `--json` flag.
- Oclif `init` hooks run before the command's error handling. A hook that renders a warning and calls `process.exit(1)`
  bypasses the JSON fatal error path and can leave stdout empty. Put command validation in the command lifecycle and
  throw an `AbortError` so CLI Kit can encode the failure.
- In the command event context, `outputInfo`, `outputWarn`, and `outputDebug` use diagnostic events in JSON mode when
  using their default logger. Banners such as `renderSuccess` and `renderWarning` still render terminal text to stderr;
  they aren't automatically converted to events. Use `emitCommandEvent` from `@shopify/cli-kit/node/command-events`
  for diagnostics, and keep human-only banners in the text presenter.
- Third-party loggers and child processes aren't automatically converted or silenced. Use `jsonOutputEnabled()` from
  `@shopify/cli-kit/node/environment` to silence or capture their output in JSON mode. Reserve stdout for the encoded
  result or fatal error document, and send diagnostics through the event helpers to stderr.

## Test a new command

Tests should verify:

- the domain service result without terminal concerns;
- explicit projections, shared field meanings, strict schema validation, and applicable compatibility mappings;
- the exact `--json` document;
- human presentation independently from JSON encoding;
- errors and exit behavior; and
- prompt behavior independently from `--json` and `--no-input`.

When final-output code moves, exercise the real presenter, encoder, and output writer. Capture stdout and stderr
separately or use a subprocess; mocking the output helper does not prove stream routing. Check one parseable stdout
object and side events on stderr. Cover applicable empty, null, cancelled, skipped, partial, batch, and file outcomes;
check file receipts against real files in temporary directories and verify error/exit behavior.

Non-interactive command help and generated README documentation include the result's JSON Schema automatically through
`jsonOutputSchema`. Interactive help keeps the `--json-schema` hint and omits the schema introduction and inline schema.
`--json-schema` prints one JSON Schema (draft-07) accepting a result, a fatal error document, or a side event. The `Result`,
`Error`, and `Event` definitions describe these separately; results and fatal errors go to stdout, and side events go to stderr.

Both outputs come from the same Zod definitions used to validate and encode results. Run the manifest,
README, and code-documentation refresh commands required by CI after changing command metadata.

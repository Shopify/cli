# Extension dependencies, support files, and generation state

Apply these records when an app-loading or generation path reaches the named reader. An API version, target, installed export, source import, or tsconfig can enable work that another command skips. Warning/throw/write behavior belongs to the shared reader; final rendering and exit policy belong to its caller. The source baseline is CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`. Recheck changed readers and dependency versions before reusing an outcome.

Start with the [extension schema atlas](toml-schemas/extension-toml/README.md). Localized configuration payload evaluation may call a method named `deployConfig()` during loading; that call alone does not mean the command deploys anything.

## UI-extension dependencies and generation gates

### When generation runs

UI type generation requires all of the following:

1. A loaded `ui_extension` whose API version passes the Remote DOM check: year greater than 2025, or year 2025 with month at least 10. Normal boundary fixtures are `2025-07` and `2025-10`.
2. An existing main module, `should_render` module, or included source import to process.
3. A nearest `tsconfig.json` accepted by `findNearestTsConfigDir()` for that source file. A config only above the extension directory normally does not qualify.

Without a qualifying tsconfig, the third pass skips dependency resolution, tools/intent reads, and type generation for that file. The import-scanning pass can still read source and TypeScript configuration earlier. A missing main module has a separate validation error even though generation skips it. A missing `should_render` file is skipped by this generation path and is not checked by the main-module validator.

The directory check uses a normalized string-prefix comparison, not a canonical realpath containment check. Keep unusual sibling-prefix and symlink cases separate from a normal ancestor-tsconfig fixture.

Sources: [generation passes and API gate](/packages/app/src/cli/models/extensions/specifications/ui_extension.ts) and [TypeScript config/import resolution](/packages/app/src/cli/models/extensions/specifications/type-generation.ts).

### What the installed package must expose

For each target, the generator runs `require.resolve('@shopify/ui-extensions/<target>')`, using the source and generated-type paths as resolution starting points. For example:

```text
Target:       admin.product-details.action.render
Package path: @shopify/ui-extensions/admin.product-details.action.render
```

Successful tools or intent generation adds a second resolution check for a surface helper, such as `@shopify/ui-extensions/admin`. The helper surface comes from the first target; `purchase` maps to `checkout`, and `pos` maps to `point-of-sale`.

A dependency declaration is not enough. Resolution depends on installed files, package exports, lookup location, and the selected target. The CLI does not compare the installed package version with the API version. The version in its error message is advice, not a compatibility-check result.

The generator also reads the resolved target file for a named `ShopifyGlobal` re-export. Its presence adds an `Api & ShopifyGlobal` intersection to the generated declaration. Failure to read that file makes this optional check return false; it is different from failure to resolve the target path. The CLI does not type-check every referenced `Api` or helper symbol.

### Dependency and file states

| Fixture                              | State                                                                                        | Expected behavior                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-types/older-api`                 | API `2025-07` with otherwise eligible files                                                  | Skips shared-type generation.                                                                                                            |
| `ui-types/no-tsconfig`               | API `2025-10`, main file present, no qualifying tsconfig                                     | Skips target/helper resolution and support-file type generation for that file.                                                           |
| `ui-types/ancestor-tsconfig`         | Only an app-root tsconfig above the extension                                                | Normally skipped; compare with a config inside the extension.                                                                            |
| `ui-types/installed-target`          | Required target export resolves                                                              | Generates base declarations.                                                                                                             |
| `ui-types/declared-not-installed`    | Manifest declares the package, but no resolvable installation exists                         | Entry-point generation throws the “Type reference … could not be found” `AbortError`; the caller does not receive a normally loaded app. |
| `ui-types/missing-target`            | Package exists but does not expose the configured target                                     | Same resolution error. An older package or wrong target can cause it.                                                                    |
| `ui-types/broken-export`             | Export points to an absent file, or package resolution otherwise fails                       | Same error boundary; the message does not distinguish every resolution cause.                                                            |
| `ui-types/installation-location`     | Different extension-local or ancestor installation is resolved                               | Success or failure follows the resolved installation, not just the root manifest.                                                        |
| `ui-types/missing-helper`            | Target resolves, but successfully generated tools/intents need an unavailable surface helper | Entry-point generation aborts at the helper check.                                                                                       |
| `ui-types/no-generated-helper-types` | Tools/intents are absent, empty, or skipped after a recoverable failure                      | Does not require the extra helper merely because a TOML path exists. Still checks the target export.                                     |
| `ui-types/shopify-global`            | Resolved target does/does not re-export `ShopifyGlobal`                                      | Changes generated declarations, not the normal component rows.                                                                           |
| `ui-types/import-failure`            | Resolution/generation fails for a non-entry imported file                                    | Outer generation catch skips that file. Entry points are deliberately treated more strictly.                                             |
| `ui-types/source-and-tsconfig`       | Imports, `paths`, `files`, or `include` change                                               | Can change which source files get declarations and which dependencies are resolved.                                                      |
| `ui-types/existing-output`           | Existing `shopify.d.ts` matches or differs from generated bytes                              | Equal content skips the write; different content is overwritten. Read/write failure can abort.                                           |
| `ui-types/generation-skipped`        | A stale `shopify.d.ts` exists, but no file is registered for output                          | No general stale-file cleanup runs. Do not assume disabling generation deletes it.                                                       |

The error for unresolved entry-point types is explicit and tested. Any caller reaching this generation stage inherits it. Whether a read-oriented command should generate types is a separate product decision, not an inferred requirement.

Sources: [target/helper resolution](/packages/app/src/cli/models/extensions/specifications/type-generation.ts), [entry-point versus imported-file handling](/packages/app/src/cli/models/extensions/specifications/ui_extension.ts), and [generation tests](/packages/app/src/cli/models/extensions/specifications/ui_extension.test.ts).

## Tools JSON

### Consumed shape

A target's `tools` path is joined to the extension directory, not the source module's directory. After the generation gates above, the CLI reads and parses that file.

```ts
type ToolsFile = Array<{
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
}>
```

Example:

```json
[
  {
    "name": "lookupFixture",
    "description": "Find a fixture by its identifier.",
    "inputSchema": {
      "type": "object",
      "properties": {"id": {"type": "string"}},
      "required": ["id"]
    },
    "outputSchema": {"type": "string"}
  }
]
```

The Zod shape requires schema **objects**; boolean JSON Schemas are not accepted in these fields. Extra tool-entry fields are stripped, while schema-object contents pass through to `json-schema-to-typescript`. Missing output schemas generate an `unknown` output type.

### Tools-file states

| Fixture                      | State                                                                 | Expected behavior                                                                             |
| ---------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tools/absent-setting`       | No `tools` path                                                       | Generates no tool declarations; no file read.                                                 |
| `tools/missing-file`         | Referenced file does not exist                                        | Silently omits tool declarations. This differs from a missing intent file.                    |
| `tools/empty-array`          | File contains `[]`                                                    | Valid; produces no tool declarations.                                                         |
| `tools/valid`                | One or more complete tool entries                                     | Generates input/output types and `ShopifyTools`; may require the surface helper export.       |
| `tools/missing-output`       | Entry omits `outputSchema`                                            | Generates output as `unknown`.                                                                |
| `tools/invalid-json`         | Empty file, invalid JSON, or byte-order mark rejected by `JSON.parse` | Warns with “Failed to create tools type definition…” and continues without the tools block.   |
| `tools/invalid-shape`        | Root object/null, missing required fields, or a non-object schema     | Warns with “Invalid tools definition…” and skips the whole tools array.                       |
| `tools/read-fails`           | Existence check passes, then reading fails                            | Warns and skips tools. A failed existence check instead follows the silent missing-file path. |
| `tools/duplicate-name`       | Two successfully parsed entries have the same name                    | The compiler throws, but the tools caller catches it, warns, and omits the whole tools block. |
| `tools/schema-compile-fails` | Shape is valid, but a schema or `$ref` cannot compile                 | Warns and skips tools. Already-started compilation work is not explicitly canceled.           |
| `tools/shared-module`        | Several targets use one module path with different tools paths        | The tools map keeps the last path assigned for that module; it does not merge the files.      |
| `tools/gate-closed`          | Referenced file is bad, but API/tsconfig gates skip generation        | This path does not inspect the tools contents or emit their warnings.                         |

These warnings use `outputWarn`, normally stderr, including JSON mode. They do not become collected `app.errors`. Later target resolution, formatting, or writes can still fail. Recovering from a tools error does not guarantee a successful command.

Sources: [ToolsFileSchema and compiler](/packages/app/src/cli/models/extensions/specifications/type-generation.ts), [tools caller and JSON reader](/packages/app/src/cli/models/extensions/specifications/ui_extension.ts), and [warning output](/packages/cli-kit/src/public/node/output.ts).

## Intent JSON

### Consumed shape

The target's `intents[]` TOML entries supply `action`, `type`, and `schema` paths. Each schema path is joined to the extension directory. The referenced file supplies:

```ts
type IntentSchemaFile = {
  inputSchema: Record<string, unknown>
  value?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
}
```

Example:

```json
{
  "inputSchema": {
    "type": "object",
    "properties": {"id": {"type": "string"}},
    "required": ["id"]
  },
  "value": {"type": "string"},
  "outputSchema": {"type": "boolean"}
}
```

The property is `value`, not `valueSchema`, in the file. Omitted value/output schemas become `unknown` types. Extra top-level fields are stripped; schema-object contents pass through to compilation. TOML intent `name` and `description` are not consumed by this type-generation mapping.

### Intent-file states

| Fixture                        | State                                                               | Expected behavior                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intents/absent-or-empty`      | No intents, or `intents = []`                                       | No intent-file reads or generated intent declarations.                                                                                                                     |
| `intents/valid`                | One or more complete files                                          | Generates request/value/output types and intent variants; checks the surface helper export.                                                                                |
| `intents/optional-schemas`     | `value` or `outputSchema` absent                                    | Generates `unknown` for the missing schema.                                                                                                                                |
| `intents/missing-file`         | Referenced schema file does not exist                               | Warns “Intent schema file … was not found…” and skips that intent.                                                                                                         |
| `intents/invalid-json-or-read` | Reading or `JSON.parse` throws                                      | Warns and skips that intent.                                                                                                                                               |
| `intents/invalid-shape`        | Missing `inputSchema`, wrong root type, or non-object schema fields | Warns “Invalid intent schema…” and skips that intent.                                                                                                                      |
| `intents/mixed-files`          | Valid and missing/invalid files together                            | Keeps successfully parsed intents. If none remain, no intent block or helper requirement is added.                                                                         |
| `intents/duplicate-key`        | Successfully parsed intents repeat the same `${action}:${type}` key | Throws `AbortError`. For an entry-point file, this escapes generation and prevents a normal load result. Unlike duplicate tool names, this is not downgraded to a warning. |
| `intents/shared-module`        | Several targets share a source module                               | Their intent lists are concatenated for that module; duplicates across those lists can also trigger the error.                                                             |
| `intents/schema-compile-fails` | A schema or `$ref` compiler raises an ordinary error                | Warns and omits the generated intent block. The caller rethrows `AbortError` rather than swallowing every error.                                                           |
| `intents/gate-closed`          | API/tsconfig gates skip generation                                  | Bad intent files do not produce generation warnings on this path.                                                                                                          |

Duplicate checks run after file parsing, so an intent skipped for a missing file does not participate in that check. If generated declarations themselves cannot be formatted, the later entry-point catch can still abort; file-shape validation is not a full TypeScript validity check.

Sources: [intent parsing and recovery](/packages/app/src/cli/models/extensions/specifications/ui_extension.ts) and [intent schema/compiler](/packages/app/src/cli/models/extensions/specifications/type-generation.ts).

## Referenced schemas

Tools and intent schema objects can contain `$ref`. The caller uses `compile(schema, name, {bannerComment: ''})` from `json-schema-to-typescript` 15.0.4 without disabling external resolution.

This is separate from the fetched app/extension contract parser, which disables external reference resolution. A “no external schema requests” assertion for fetched contracts does **not** cover type generation.

| Fixture                  | Reference state                                                  | Effect                                                                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type-ref/internal`      | Resolvable `#/$defs/...` reference                               | Compiles without a file or HTTP reference read.                                                                                                                                               |
| `type-ref/local`         | Relative or absolute file reference                              | Reads an additional local schema file. Missing, unreadable, or invalid content can cause a compilation warning.                                                                               |
| `type-ref/relative-base` | Same tools/intent file, different compiler base directory        | Can resolve a different schema or fail. The compiler defaults its base to process cwd captured when the dependency loads, not automatically to the tools/intent file's directory or `--path`. |
| `type-ref/http`          | HTTP(S) reference                                                | Can issue a GET and consume the returned schema. Response data, status, and timing are additional inputs.                                                                                     |
| `type-ref/nested`        | Referenced schema contains more references                       | Can read further files or URLs. Register the complete reference graph in the fixture.                                                                                                         |
| `type-ref/failure`       | Missing reference, HTTP error, invalid body, or resolver timeout | Reaches the tools/intent compilation recovery described above; do not assign GraphQL retry behavior.                                                                                          |

A localhost dependency probe verified HTTP and local-file reference resolution; the app-info suite also exercises the shared loader path. Other commands need their own integration assertions. [Network N9](#n9-external-schema-references) records this additional request family.

Use synthetic files and a loopback server. Reject unregistered requests, and isolate process cwd as well as the extension directory. Do not make a fixture depend on a public schema server or developer files.

## Localized configuration modules

### Why loading can read root locales

For a remote-only specification, the CLI enables localization when the normalized contract contains a top-level `properties.localization`. If that specification has `experience: "configuration"`, and parsing yields a nonempty configuration object, the app loader evaluates its `deployConfig()` result while deciding whether to keep the module.

The contract-based implementation then calls `loadLocalesConfig()` using the **app root**. It reads `<app root>/locales/*.json`, not an arbitrary extension's locale directory. This can happen during app loading without a build, deploy, or locale-upload request.

Root locale contents affect this path when these conditions hold:

- A remote specification without a matching local specification, with a usable contract.
- A contract property named `localization` and configuration experience.
- Local app configuration that passes parsing and yields a nonempty module object.
- Locale files at the root passed to that module instance.

No localization property means this contract-based implementation skips the locale reader. A configuration module that produces an empty object is skipped before payload evaluation. Ordinary extension experience does not pass through this configuration-module evaluation path. Do not apply these locale expectations to every UI, Function, or theme extension merely because it supports deployment localization.

Sources: [remote-only specification construction](/packages/app/src/cli/services/generate/fetch-extension-specifications.ts), [contract-based deployConfig](/packages/app/src/cli/models/extensions/specification.ts), and [configuration-module evaluation](/packages/app/src/cli/models/app/loader.ts).

### Files and returned structure

A normal fixture layout is:

```text
<app root>/
├── shopify.app.toml
└── locales/
    ├── en.default.json
    └── fr.json
```

The locale helper returns:

```ts
type LoadedLocales = {
  default_locale: string
  translations: Record<string, string> // Base64-encoded file bytes.
}
```

With no matching files, it returns `{}` instead. With files present, it requires exactly one filename ending in `.default.json`, nonzero file sizes, and valid UTF-8 bytes. Locale keys are the filename segment before the first dot.

**This helper does not parse JSON or validate translation keys.** Nonempty UTF-8 content can pass even when it is not valid JSON. The helper encodes the data; it does not translate rendered names. The loader uses the resulting payload to decide whether to retain the module; it does not replace the instance's configuration with this payload.

Source: [loadLocalesConfig](/packages/app/src/cli/utilities/extensions/locales-configuration.ts).

### Locale-file states

For byte-content and read-failure fixtures, keep exactly one default filename present and all other files valid. Otherwise, the earlier default-locale checks can hide the intended case.

| Fixture                             | Root file state                                                        | Expected behavior when the module path is active                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `config-locales/no-directory`       | No `locales/` directory                                                | Returns `{}`; no missing-default error.                                                                                          |
| `config-locales/no-matches`         | Empty directory, nested-only JSON files, or only non-`.json` files     | Nonrecursive glob finds no files; same empty result.                                                                             |
| `config-locales/valid`              | One nonempty UTF-8 `en.default.json`, optionally other locales         | Returns the default locale and encoded translations; loading continues.                                                          |
| `config-locales/no-default`         | Matching files exist, but none ends in `.default.json`                 | Throws “Missing default language…” during loading.                                                                               |
| `config-locales/multiple-defaults`  | Two matching default filenames                                         | Throws the one-default-only error.                                                                                               |
| `config-locales/empty-file`         | Any matched locale has zero bytes                                      | Throws; an empty non-default locale is also fatal.                                                                               |
| `config-locales/invalid-utf8`       | Any matched locale contains invalid UTF-8                              | Throws with encoding guidance.                                                                                                   |
| `config-locales/not-json`           | Nonempty, valid UTF-8 text with invalid JSON syntax or only whitespace | Passes this helper. Do not invent a JSON-parse error here.                                                                       |
| `config-locales/read-or-stat-fails` | A discovered file disappears or cannot be statted/read                 | Error propagates; no per-file skip or fallback.                                                                                  |
| `config-locales/same-locale-key`    | `en.default.json` and `en.json`                                        | Both map to `en`; later iteration overwrites the translation. No duplicate-locale rejection. Do not assume stable glob ordering. |
| `config-locales/wrong-location`     | Files exist only in `extensions/example/locales/`                      | Ignored by this root lookup. With no root matches, the helper returns `{}`.                                                      |
| `config-locales/feature-off`        | Bad root locale files, but the contract has no localization property   | Skips locale loading in this contract-based implementation.                                                                      |
| `config-locales/empty-module`       | Contract parsing succeeds but yields an empty module object            | Skips the module before payload/locale evaluation.                                                                               |
| `config-locales/parse-fails`        | Module fails earlier configuration parsing                             | Does not evaluate that module's locale payload; the earlier configuration failure determines the outcome.                        |
| `config-locales/other-experience`   | Remote-only spec uses extension experience instead                     | No locale read through configuration-module evaluation. Its build/deploy behavior is separate.                                   |

Locale-reader failures throw during loading rather than adding to `app.errors`. The caller determines the final error presentation. This reader does not rewrite locale files or replace the module's configuration with decoded translations.

## Conditional type-generation requests

### N9: External schema references

**Request:** HTTP(S) GET to URLs supplied by `$ref` in tools/intent JSON Schemas. **When:** local loading reaches shared-type generation for an eligible UI extension and compiles a schema with an external reference. There is no fixed Shopify host or GraphQL operation name.

Source: [formatJsonSchemaType](/packages/app/src/cli/models/extensions/specifications/type-generation.ts). For the separate fetched-contract path, see [N4 specification loading](app-workflows.md#n4-fetchspecifications). The caller uses `json-schema-to-typescript` 15.0.4 with only `bannerComment` overridden. Its installed reference parser enables file and HTTP resolution. This is a different path from N4 contract normalization.

Prerequisites and recovery are documented earlier in this reference: API-version and tsconfig gates, existing source files, tools/intent shape validation, and required package exports. A successful response contains a usable schema document, not a GraphQL envelope. Referenced schemas can contain further references.

| Fixture                             | Reference/response state                                                      | Expected behavior                                                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type-schema/no-external-ref`       | Schema uses no external references, or generation is skipped                  | No schema GET.                                                                                                                                                           |
| `type-schema/success`               | Referenced URL returns a valid schema                                         | Compiles it into generated declarations. Returns generated declarations, not the raw reference response as app data.                                                     |
| `type-schema/nested`                | Returned schema references another URL or file                                | Resolves additional dependencies; register the complete reference graph.                                                                                                 |
| `type-schema/http-error`            | 404, 403, or 5xx from the schema endpoint                                     | Resolver/compiler failure reaches the tools or intent warning path, not Shopify's GraphQL error mapping.                                                                 |
| `type-schema/invalid-body`          | Body cannot be parsed or used as a schema                                     | Compilation failure; assert the warning and whether later generation/reporting continues.                                                                                |
| `type-schema/connection-or-timeout` | Connection/TLS failure or resolver timeout                                    | Dependency-owned failure behavior. Use a bounded fixture; do not assign CLI network retries.                                                                             |
| `type-schema/redirect`              | Reference URL redirects                                                       | Dependency fetch/resolver determines the final response; intercept redirected requests too.                                                                              |
| `type-schema/repeated-reference`    | Several tools/intents or separate input/output schemas reference the same URL | Do not assume a command-wide cache or exactly one GET. The caller can start separate compilations.                                                                       |
| `type-schema/local-ref`             | Schema references another local file                                          | No HTTP for that reference, but another file read is now an input. Relative resolution uses the compiler's base directory, not automatically the tools file's directory. |

The tools/intent callers catch ordinary reference failures and warn. Duplicate intent identities instead raise a CLI `AbortError` and can stop the command. Schema compilation runs before target/helper resolution, so GETs can occur even when a missing export later aborts the report. A failed parallel compilation does not explicitly cancel already-started reference work.

These GETs use the installed parser's global `fetch`, not `shopifyFetch` or the GraphQL wrapper. They do not attach the app's Shopify bearer token. The parser has its own default request timer (60 seconds in the inspected dependency). When native `fetch` rejects, the inspected resolver does not clear that timer. A loopback socket-closure test shows that tools generation can warn and the report can appear while the process remains alive; bound this regression with a harness deadline. Do not apply `SHOPIFY_CLI_MAX_REQUEST_TIME_FOR_NETWORK_CALLS`, 401 refresh, or GraphQL throttling expectations to this path.

A localhost-only probe verified HTTP and local-file resolution through the installed compiler. That is dependency evidence, not a full-command reproduction. E2E fixtures must intercept this transport as well as Shopify API requests, use synthetic schemas, and reject every unregistered destination.

# TOML schema catalog

This index routes to the skill's detailed app, web, and extension schema histories. It is not a claim that every historical file is accepted today. It separates template seeds, linked app formats, extension containers, and per-type contracts.

## Baseline and detailed references

The atlas was researched against CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`, Shopify's official Node/Remix/React Router app templates, the extension-template repository, and public documentation. Detailed shapes and evidence now live with this skill:

- [App configuration history](toml-schemas/app-toml.md)
- [Web configuration history and discovery](toml-schemas/web-toml.md)
- [Extension envelopes and type index](toml-schemas/extension-toml/README.md)
- Per-type current/history pages under `toml-schemas/extension-toml/`
- [Extension dependencies and support files](extension-files.md)

Some extension types are validated only by fetched platform contracts. Their public/template shapes are recorded, but the checkout cannot reconstruct gated or unpublished contract fields. Mark those gaps unresolved instead of treating a template as the complete runtime contract.

For each reused record, compare its reader/schema/transform against the target HEAD and relevant working-tree changes. Preserve a verified record when unaffected. Record new evidence when behavior or structure changes.

## App TOML families

Labels match the existing app-history document. They are research labels, not a public `schema_version` field.

| ID        | Structural discriminator                                                                       | Test boundary                                                             |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| T1-name   | Historical root `name`, no linked ID                                                           | Template/linking versus linked report                                     |
| T1-scopes | Root `scopes`, no linked ID                                                                    | Legacy template scope handling                                            |
| T2        | Root `scopes` with webhook API version/subscriptions                                           | Template handling must not discard supported webhook inputs by assumption |
| T3        | Empty `client_id` plus root `scopes`                                                           | Empty string must not be mistaken for a linked ID                         |
| T4        | Empty `client_id` plus `[access_scopes]`                                                       | Current template seed versus complete linked configuration                |
| L1        | Flat `webhook_api_version`, `proxy`, `cli`, legacy fields                                      | Prototype evidence; current acceptance/rejection must be measured         |
| L2        | Nonempty ID and nested access/auth/build/proxy/webhook fields; old privacy URLs                | First released nested shape; local and remote module normalization        |
| L3        | Top-level webhook `endpoint`/`topics`, singular subscription `topic`/`path`                    | Historical shape, not an assumed automatic migration                      |
| L4        | Top-level webhook `uri`/`topics`                                                               | Distinguish acceptance, ignored fields, and normalization                 |
| L5        | `[[webhooks.subscriptions]]` with `topics[]` and `uri`; old `sub_topic`/`metafield_namespaces` | Retained versus removed compatibility fields                              |
| L6        | Required auth, compliance topics, required/optional scope arrays, later additive fields        | Compatibility readers and conflicting privacy representations             |
| L7        | Current nested configuration, including platform-supplied modules                              | Static CLI schema plus the selected remote contract                       |

Use complete examples from [the app history](toml-schemas/app-toml.md), then minimize each fixture without erasing its discriminator. Keep malformed near-misses: non-string/empty IDs, missing required sections, mixed privacy forms, duplicate compliance topics, and endpoint/URI mixtures.

Current source entry points:

- `packages/app/src/cli/models/app/app.ts`: base configuration and schema composition.
- `packages/app/src/cli/models/project/`: discovery and configuration selection.
- `packages/app/src/cli/models/extensions/specifications/app_config_*.ts`: module schemas and transforms.
- `packages/app/src/cli/services/app/config/link.ts`: remote-to-local linking and write boundaries.

An API-version value change alone does not create a new app schema. Branch experiments, including proposed version fields or scope migrations, do not establish a shipped contract.

## Web TOML families

| ID              | Shape or layout                                                   | Test boundary                                                                              |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| W-home          | `shopify.home.toml` and earlier backend-home names                | Historical input; current discovery recognizes the exact web filename, not every precursor |
| W-type-required | `type = frontend/backend`, required `commands.dev`                | Original single-role shape                                                                 |
| W-type-default  | Optional `type`, default frontend; callback, webhook, port fields | Legacy compatibility defaults                                                              |
| W-roles         | `roles[]`, including background, optional name                    | Roles-first ordered union; duplicates, empty roles, invalid fallback                       |
| W-hmr           | Roles/type plus `[hmr_server].http_paths`                         | Required paths inside an optional table                                                    |
| W-predev        | Optional `commands.predev` plus dev/build                         | Parsed versus actually executed work                                                       |
| W-liquid        | Template source `.toml.liquid`, rendered output `.toml`           | Source templates are not runtime discovery inputs                                          |

At the seed baseline, valid roles win over legacy type. Invalid roles can fall back to a valid/default type. Callback and webhook paths gain a leading slash; HMR path strings do not. Ports accept numbers in `0..65536`, including fractions, but not numeric strings. Confirm these facts against `WebConfigurationSchema` before reusing them.

Keep layouts separate from schemas: root or nested webs, named/unnamed components, multiple roles, no web, inactive-config discovery restrictions, hidden directories, excluded `node_modules`, missing frontend submodule, and framework-detector files. Verify that normalization changes the report without rewriting TOML unless the command intentionally writes it.

## Extension containers and shared fields

Primary readers are `packages/app/src/cli/models/app/loader.ts` and `packages/app/src/cli/models/extensions/schemas.ts`.

| ID          | Shape                                                        | Distinction                                                                                                  |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| X-root      | A single root extension with `type` and type-specific fields | Legacy container; validate through its selected specification                                                |
| X-array     | Root defaults plus `[[extensions]]` entries                  | Merge shared fields into each entry; entry fields take precedence; validate handles and duplicate identities |
| X-mixed     | Both root `type` and `extensions`                            | Container precedence, including an empty extensions array, must be tested rather than guessed                |
| X-ui-points | UI `extension_points` versus `targeting` arrays              | Ordered fallback and normalization to extension points                                                       |
| X-remote    | Type/schema supplied by a fetched platform specification     | The local type list is not exhaustive; missing, changed, deprecated, or malformed remote contracts matter    |

Shared fields include name, type, handle, UID, description, API version, capabilities, supported features, and settings. Target entries can add module, should-render module, tools, instructions, intents, metafields, URLs, capabilities, and preloads. Read the current Zod schema for exact requirements; field presence does not imply every extension or command consumes it.

Verified CLI history anchors, both ancestors of the seed baseline:

- `ef03fc0b2f13685abd5fa5ee465883191e0e9b7b` (2023-07-05): unified/additional extension schema support in the loader and shared schemas.
- `51e46e17ad146d4623b8699bef6ef33f8e48c9f2` (2023-07-12): UI schema simplification retaining `targeting` and `extension_points` compatibility.

Use these as starting evidence. The full shared envelope/type chronology is indexed in [the extension atlas](toml-schemas/extension-toml/README.md).

### Local type index

`packages/app/src/cli/models/extensions/load-specifications.ts` is the current registration list. Schema filenames below are under its `specifications/` directory. Read the applicable [per-type history](toml-schemas/extension-toml/README.md#current-type-inventory), current schema, transforms, tests, templates, and fetched contract where available; a filename alone does not establish aliases or current acceptance.

| Family                     | Schema files                                                                                                                 | Additional state to trace                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| UI                         | `ui_extension.ts`, `checkout_ui_extension.ts`, `pos_ui_extension.ts`, `checkout_post_purchase.ts`, `product_subscription.ts` | Targets, API generation gates, installed package exports, source imports, tsconfig, tools/intents            |
| Functions                  | `function.ts`                                                                                                                | Historical type/API spellings, targeting, build commands, Wasm/query/schema assets; load versus build/deploy |
| Flow                       | `flow_action.ts`, `flow_trigger.ts`, `flow_template.ts`                                                                      | Settings, fields, resources, validation and rendering                                                        |
| Theme                      | `theme.ts`                                                                                                                   | Assets/locales and command-specific build or deployment work                                                 |
| Web pixels                 | `web_pixel_extension.ts`                                                                                                     | Settings, capabilities, entrypoints and build steps                                                          |
| Payments and tax           | `payments_app_extension.ts`, `tax_calculation.ts`                                                                            | Type-specific fields and local versus server validation                                                      |
| Other local specifications | `editor_extension_collection.ts`, `channel.ts`, `order_attribution_config.ts`, `admin_link.ts`                               | Referenced files, collection structure, assets and remote contracts                                          |
| App configuration modules  | `app_config_*.ts`                                                                                                            | These are usually app TOML tables, not separate extension TOMLs                                              |

Supporting-file records belong with the schema that reads them:

- Remote-DOM UI generation can depend on actual installed target/helper exports, not package semver declarations alone.
- Tools/intents can read local and HTTP schema references. Their failure modes include warnings, skipped declarations, and fatal errors.
- A remote configuration module can read app-root locales during loading. This does not make every extension locale directory an input to every command.
- UID insertion and shared declaration writes can occur during an informational command. Earlier writes need not be rolled back after failure.

## Refresh history once, then reuse it

1. Check existing records and current readers first. Find relevant history with `git log --follow -- <path>`, `git log -S '<field>' -- <path>`, `git show`, and blame.
2. Inspect schema **and** transform history. Check fixtures/tests at those revisions rather than inferring a format from a modern example.
3. For official templates, follow the inspected mainline and record exact commits. The existing Node, Remix, and React Router histories are cited in the app/web references.
4. Inspect Node's frontend submodule at its pinned commit. Follow renames and Liquid generation; a missing submodule is not proof a format never existed.
5. Verify ancestry with `git merge-base --is-ancestor`. Author dates, merge dates, and release dates are different evidence.
6. Record the distinguishing shape, fields/defaults, normalization, unknown-field behavior, current command outcome, and source/template revisions.
7. Mark missing history as unresolved. A shallow checkout or missing remote reference is a research blocker, not permission to invent a schema.

Use temporary checkouts for external template research. Do not switch the user's branch, rewrite their working tree, or install template dependencies. Add catalog entries for structural changes; keep sample-value changes out of the schema count.

Migration chains in the detailed app/extension references are explicitly marked as design proposals. Do not assume a command performs them. Test today's reader for acceptance, rejection, normalization, field loss, and writes.

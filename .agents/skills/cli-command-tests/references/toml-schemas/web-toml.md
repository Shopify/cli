<!--
title: app_info_web_toml
description: Shared web configuration schemas, official template history, discovery, and validation boundaries.
tags: [documentation, configuration, schemas, history, testing]
-->

# Web TOML schemas and discovery

App-project loading discovers and validates **`shopify.web.toml`** files. This reference owns the historical formats, parser rules, and discovery variants shared by commands that use that loader. Running web scripts, rendering components, and choosing an exit status are separate caller decisions. See the [app-info web profile](/test/app-info/web-components.md) for that command's result modes.

The schema/loading behavior below uses CLI commit [`8829ed581d25f964c53564c403bfbf94484753b4`](https://github.com/Shopify/cli/tree/8829ed581d25f964c53564c403bfbf94484753b4). Template history is evidence of formats developers could have copied, not proof that a particular CLI release supported every field. These formats have no persisted schema-version discriminator.

Related references: [local file states](../app-files.md), [app TOML history](app-toml.md), [flags](../runtime.md), and [network behavior](../network.md).

## Contents

- [History sources and dates](#history-sources-and-dates)
- [Historical schemas](#historical-schemas)
- [Current accepted schema](#current-accepted-schema)
- [Template snapshots](#template-snapshots)
- [File presence and discovery](#file-presence-and-discovery)
- [Validation and caller policy](#validation-and-caller-policy)
- [Fixture set](#fixture-set)

## History sources and dates

The audit used Git log, file diffs, blame, and first-parent ancestry in these repositories:

| Repository                                                                                                                                  | Inspected HEAD           | Web configuration location                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------ |
| [Node](https://github.com/Shopify/shopify-app-template-node/tree/4e73e21a8dd424f1784d916e532103683291cde9)                                  | `4e73e21a`               | `web/shopify.web.toml`; frontend comes from a Git submodule.             |
| [Node's React frontend submodule](https://github.com/Shopify/shopify-frontend-template-react/tree/3160b2c314d3271ce579f6f848252406163793c9) | Node's pinned `3160b2c3` | `web/frontend/shopify.web.toml` after submodule checkout.                |
| [Remix](https://github.com/Shopify/shopify-app-template-remix/tree/2d966b7bda76d0b4d9730538048e4242860659c2)                                | `2d966b7b`               | Root `shopify.web.toml`, later generated from `shopify.web.toml.liquid`. |
| [React Router](https://github.com/Shopify/shopify-app-template-react-router/tree/e548c959eb00460f7141d42bd694cd50769c5e3e)                  | `e548c959`               | Root `shopify.web.toml`, later generated from `shopify.web.toml.liquid`. |

The dates below mark the first commit on each template HEAD's first-parent chain that contains the change. Author dates can be much earlier: React Router's command change was authored in April 2025 but merged in July. Branch-only commits are not treated as shipped formats.

### Template changes

| Mainline date | Template change                                                                                                                                                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2022-04-21    | Node's precursors use `shopify.backend.home.toml`, then `shopify.home.toml`. `[environment]` and `name` give way to `type`. These intermediate commits were merged together, not separate released web schemas. | [Initial precursor](https://github.com/Shopify/shopify-app-template-node/commit/3bb54d4394c68c552871434a970fb72fb714323a), [type change](https://github.com/Shopify/shopify-app-template-node/commit/f54522acc6e1ee77fcdbec96fd5352ae4cd7040a)                                                                                              |
| 2022-05-06    | Node renames home to web and introduces `web/shopify.web.toml` with backend `type`, `commands.dev`, and `commands.build`. Frontend also adopts the web filename.                                                | [Node rename](https://github.com/Shopify/shopify-app-template-node/commit/4b28d06852a0f044dcb04580e86a15351a3279ea), [frontend rename](https://github.com/Shopify/shopify-frontend-template-react/commit/cde6e8291926d1f010368d082fb3d5b6d3ecfa5e)                                                                                          |
| 2022-05-24    | Node removes the backend build command; frontend still has one.                                                                                                                                                 | [Backend change](https://github.com/Shopify/shopify-app-template-node/commit/c9d37971a93fa9d185bce1ded304bd8cdb483473)                                                                                                                                                                                                                      |
| 2023-04-11    | Remix adds a root web file with `type = "frontend"` and `dev = "npm exec remix dev"`.                                                                                                                           | [Initial file](https://github.com/Shopify/shopify-app-template-remix/commit/ef67c4401f037ee577ad7b70f5bc4c97ade31925)                                                                                                                                                                                                                       |
| 2023-06-14    | Remix adds `webhooks_path = "/webhooks"`.                                                                                                                                                                       | [Webhook path](https://github.com/Shopify/shopify-app-template-remix/commit/258c401e4d571fca7d1a76d84b98414380e716de)                                                                                                                                                                                                                       |
| 2023-07-06    | Node switches backend `type` to `roles = ["backend"]` and updates the frontend submodule to the roles format.                                                                                                   | [Node change](https://github.com/Shopify/shopify-app-template-node/commit/e7e078cbcdf9e986bff0ef8b4e16d09b3ead5eb1), [frontend change](https://github.com/Shopify/shopify-frontend-template-react/commit/34a334cc148f55790e59bc0d8a68da24299832be)                                                                                          |
| 2023-07-10    | Remix merges history that briefly added then removed `auth_callback_path = "/app/auth/callback"`. The merged mainline snapshot does not retain it.                                                              | [Addition](https://github.com/Shopify/shopify-app-template-remix/commit/aef122574a08f635563d09b7889fcedb35a65c3b), [removal](https://github.com/Shopify/shopify-app-template-remix/commit/2136f90948ede46f5901a5a86f6db85b202852e3)                                                                                                         |
| 2023-07-13    | Remix adopts both frontend and backend roles, adds `name = "remix"`, and adds `[hmr_server]` with `http_paths = ["/ping"]`.                                                                                     | [Roles](https://github.com/Shopify/shopify-app-template-remix/commit/1168bff49d4e9641c50f95e5fc79c04c21ee07f8), [name](https://github.com/Shopify/shopify-app-template-remix/commit/acccab31b3ab8b0d7e9a8520761ee0becf993c9b), [HMR](https://github.com/Shopify/shopify-app-template-remix/commit/97bb58cd1574700d920b0cf514734d23086cd28f) |
| 2024-02-19    | Remix prepends Prisma generation and migration to `commands.dev`.                                                                                                                                               | [Combined command](https://github.com/Shopify/shopify-app-template-remix/commit/65414ecdb2bf9b21beee0853ef8aeaf089573391)                                                                                                                                                                                                                   |
| 2024-02-21    | Remix switches to `remix vite:dev` and removes `[hmr_server]`.                                                                                                                                                  | [Vite](https://github.com/Shopify/shopify-app-template-remix/commit/de6da48cf039fb067805beef7b6bf951df392634), [HMR removal](https://github.com/Shopify/shopify-app-template-remix/commit/9c454a70e0c958ac4e22edcb0fe5d8c84bd71716)                                                                                                         |
| 2024-06-17    | Remix moves Prisma generation into the new optional `commands.predev`.                                                                                                                                          | [Predev](https://github.com/Shopify/shopify-app-template-remix/commit/bd15640890e4a85be3aa31ac3d0d172868b72187)                                                                                                                                                                                                                             |
| 2024-09-17    | Remix changes `webhooks_path` to `/webhooks/app/uninstalled`.                                                                                                                                                   | [Webhook route](https://github.com/Shopify/shopify-app-template-remix/commit/3bf02fbf87d9c23d4b4c657e7187b273eb2df355)                                                                                                                                                                                                                      |
| 2025-04-14    | React Router starts as a copy of Remix, including its name and web commands.                                                                                                                                    | [Repository seed](https://github.com/Shopify/shopify-app-template-react-router/commit/a147ebaf2474dea2607fdecc3ada294395cc6244)                                                                                                                                                                                                             |
| 2025-07-21    | React Router changes the display name and dev executable; roles and field structure remain the same.                                                                                                            | [React Router command](https://github.com/Shopify/shopify-app-template-react-router/commit/bf927499aebdc344876230bd7fdda5a188c18cda)                                                                                                                                                                                                        |
| 2026-04-14    | Remix and React Router replace checked-in TOML with Liquid templates that choose commands for the selected package manager. Generated projects still receive `shopify.web.toml`.                                | [Remix Liquid source](https://github.com/Shopify/shopify-app-template-remix/commit/6e1b2fbb61aa3e4189d0ce521131fddd80673988), [React Router Liquid source](https://github.com/Shopify/shopify-app-template-react-router/commit/53d8e705217453e1343d6311d4cd9cc542a13df8)                                                                    |

Changing an executable, route string, or display name is a value revision, not a new schema. Removing an optional field from a template also does not remove CLI support for it.

## Historical schemas

### Original web format: one type

The CLI's [May 2022 web schema](https://github.com/Shopify/cli/blob/7c95ea89d001435c320b21a9a0872f1771e54796/packages/app/src/cli/models/app/app.ts) accepts this structure:

```ts
type OriginalWebConfiguration = {
  type: 'frontend' | 'backend'
  commands: {
    dev: string
    build?: string
  }
}
```

Both `type` and `commands.dev` were required. The Node template supplied one backend file and, through its submodule, one frontend file. The loader's recognized filename changed to `shopify.web.toml`; current project discovery does not treat `shopify.home.toml` as a web configuration.

### Later single-type format

Before the roles change, the schema had accumulated optional callback paths, a webhook path, and a port. The default type became frontend:

```ts
type LaterSingleTypeWebConfiguration = {
  type?: 'frontend' | 'backend' // Defaults to frontend.
  auth_callback_path?: string | string[]
  webhooks_path?: string
  port?: number // Inclusive range 0..65536; not restricted to integers.
  commands: {
    dev: string
    build?: string
  }
}
```

CLI evidence:

- [Callback-path parsing fix, November 2022](https://github.com/Shopify/cli/commit/127c05589a): the external TOML name is `auth_callback_path`; historical internal camel-case objects were not separate TOML spellings.
- [Webhook path, January 2023](https://github.com/Shopify/cli/commit/9e74a9fc06).
- [Port support](https://github.com/Shopify/cli/commit/89fe19da0e) and [range checks, March 2023](https://github.com/Shopify/cli/commit/b2da7f3f18).
- [Default frontend type, April 2023](https://github.com/Shopify/cli/commit/5fdf453c7e).

Early Remix files use this single-type format. A minimal `type` file remains accepted by the current compatibility branch.

### Roles format and additive fields

In June 2023, the CLI added a `roles` array, retained `type`, added `background`, and accepted an optional display name. It changed the union order to check `roles` first. One process could now represent both frontend and backend.

Sources: [roles support](https://github.com/Shopify/cli/commit/177b2464c4), [background role](https://github.com/Shopify/cli/commit/798291d76d), [name](https://github.com/Shopify/cli/commit/670dfe5e7a), and [roles-first parsing](https://github.com/Shopify/cli/commit/73c11b8d69).

Two later additions preserve the same structure:

- July 2023: optional `hmr_server`, whose `http_paths` array is required when the table exists. [CLI change](https://github.com/Shopify/cli/commit/fea8981d2e).
- May 2024: optional `commands.predev`. [CLI change](https://github.com/Shopify/cli/commit/6c7f2b5111).

Node, Remix, and React Router now use roles. React Router did not introduce another web schema.

## Current accepted schema

The full input structure is the ordered union below. It applies to both old and new template files at the CLI baseline, not to every historical CLI version.

```ts
type WebRole = 'frontend' | 'backend' | 'background'

type WebFields = {
  auth_callback_path?: string | string[]
  webhooks_path?: string
  port?: number
  commands: {
    dev: string
    build?: string
    predev?: string
  }
  name?: string
  hmr_server?: {
    http_paths: string[]
  }
}

type RolesWebConfiguration = WebFields & {roles: WebRole[]}
type LegacyWebConfiguration = WebFields & {type?: WebRole}
type WebConfiguration = RolesWebConfiguration | LegacyWebConfiguration
```

Source: [WebConfigurationSchema](/packages/app/src/cli/models/app/app.ts).

### Parsing and normalization rules

| Input                                   | Actual behavior                                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid `roles`                           | First union branch wins.                                                                                                                           |
| Both valid `roles` and `type`           | Keeps roles and strips `type`. It does not merge the two.                                                                                          |
| No `roles` and no `type`                | Legacy branch defaults to frontend.                                                                                                                |
| Invalid `roles`, absent or valid `type` | Can succeed through the legacy branch and discard the invalid `roles`. With no type, becomes frontend.                                             |
| Valid roles and invalid `type`          | Roles branch can succeed and discard the invalid type.                                                                                             |
| Neither union branch can validate       | Collects configuration errors.                                                                                                                     |
| `roles = []`                            | Valid. Does not invent a frontend role.                                                                                                            |
| Duplicate entries within `roles`        | Schema accepts them; `loadSingleWeb()` deduplicates with a `Set`, preserving first occurrence order.                                               |
| `commands.dev = ""`                     | Accepted as a string; there is no nonempty check.                                                                                                  |
| Missing `commands` or `commands.dev`    | Invalid. A build-only web config is not enough.                                                                                                    |
| Extra root, command, or HMR fields      | Stripped by the Zod object schemas, not preserved as dynamic app modules.                                                                          |
| Callback or webhook path without `/`    | Prepends `/`; each callback-array entry is processed. An empty path becomes `/`.                                                                   |
| HMR `http_paths`                        | Requires strings, but does not use the callback/webhook leading-slash transform.                                                                   |
| Port                                    | Accepts numbers from 0 through 65536 inclusive, including fractions. No string coercion. This schema is not proof that the port would work in dev. |
| Empty `name`                            | Valid; the caller chooses its display. App-info's renderer takes its unnamed-component path.                                                       |

These rules were checked with the source schema and installed Zod. Keep the union fallbacks in regression fixtures: `roles = ["typo"]` alone is not reliably a validation-error case.

This parser normalizes the loaded object, not the web TOML on disk. A command that writes configuration must be tested separately from parsing.

## Template snapshots

These are representative source snapshots, not complete app projects. Pair them with a linked app TOML and synthetic network fixtures.

### Node: two components

Early backend `web/shopify.web.toml`:

```toml
type = "backend"

[commands]
dev = "npm run dev"
build = "npm run build"
```

Current backend:

```toml
roles = ["backend"]

[commands]
dev = "npm run dev"
```

Current frontend, supplied by the submodule at `web/frontend/shopify.web.toml`:

```toml
roles = ["frontend"]

[commands]
dev = "npm run dev"
build = "npm run build"
```

A clone without the frontend submodule has only the backend web file. Project discovery sees files that are present; template-initialization and submodule operations are separate workflows.

### Remix: single process with HMR

The July 2023 format combines both roles:

```toml
name = "remix"
roles = ["frontend", "backend"]
webhooks_path = "/webhooks"

[commands]
dev = "npm exec remix dev"

[hmr_server]
http_paths = ["/ping"]
```

The later predev format removes the HMR table and separates generation from dev:

```toml
name = "remix"
roles = ["frontend", "backend"]
webhooks_path = "/webhooks/app/uninstalled"

[commands]
predev = "npx prisma generate"
dev = "npx prisma migrate deploy && npm exec remix vite:dev"
```

### React Router: same structure, different command

The post-migration snapshot uses the same fields:

```toml
name = "React Router"
roles = ["frontend", "backend"]
webhooks_path = "/webhooks/app/uninstalled"

[commands]
predev = "npx prisma generate"
dev = "npx prisma migrate deploy && npm exec react-router dev"
```

### Liquid sources are not runtime configuration

The later Remix and React Router repositories contain `shopify.web.toml.liquid`. App initialization renders that into `shopify.web.toml`. The template uses `npm exec`, `pnpm exec`, or `bun exec`; for Yarn it uses `yarn` without `exec`.

This changes command strings, not the accepted schema. Project discovery does not render Liquid. A raw template checkout containing only `.toml.liquid` has no discovered web file at that location. Renaming unrendered Liquid to `shopify.web.toml` instead creates a TOML parsing failure.

Sources: the Liquid template commits above and [app initialization](/packages/app/src/cli/services/init/init.ts).

## File presence and discovery

Only the exact basename `shopify.web.toml` is recognized. A filename such as `custom.web.toml`, `.web.toml`, `shopify.web.staging.toml`, or `shopify.home.toml` is not an alternative web configuration name.

Discovery has two stages:

1. `Project.load()` collects `web_directories` from **all** parsed app configurations. If that union is nonempty, it searches `<directory pattern>/shopify.web.toml`. Otherwise, it searches `**/shopify.web.toml` beneath the app root.
2. The loader filters discovered files using the active app config's nonempty `web_directories`. When the active config omits that field or supplies `[]`, it takes all files already discovered.

Consequently, an **inactive app TOML can restrict discovery**. If staging declares `web_directories = ["staging-web"]` and the default app declares none, the default app can see only the staging directory's discovered web files. The second stage does not rescan the rest of the project.

Sources: [Project.load and discoverWebFiles](/packages/app/src/cli/models/project/project.ts), [webFilesForConfig](/packages/app/src/cli/models/project/config-selection.ts), and [loadWebs](/packages/app/src/cli/models/app/loader.ts).

| Local state                                          | Shared loading behavior                                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| No web file                                          | Valid; `webs` is empty. Whether the command can proceed without a web component is a caller decision.          |
| One root web file                                    | Supported; Remix and React Router use this layout. Rendering its relative location is a caller decision.       |
| Backend plus frontend files in different directories | Supported if each role appears in at most one loaded file.                                                     |
| One file with both frontend and backend roles        | Supported; both roles belong to one loaded component.                                                          |
| Background-only files                                | Supported; multiple background processes are allowed.                                                          |
| A valid file with `roles = []`                       | Loaded, but not launchable. Empty roles remain empty.                                                          |
| A declared directory with no matching file           | No missing-web-file error solely because the directory was declared.                                           |
| Only old, suffixed, or Liquid filenames              | Treated as no web file at those paths.                                                                         |
| File outside the selected directory patterns         | Not part of the active app, unless it was retained by the no-filter case above.                                |
| File in `node_modules`                               | Explicitly excluded.                                                                                           |
| File in a dot directory, including `.shopify/`       | Default globbing includes dot directories; can be discovered. Custom filtering must also match for it to load. |
| Multiple files claiming frontend or backend          | Collects duplicate-role errors, but keeps the successfully parsed web objects.                                 |

The file list is built by concurrent reads without an explicit final sort. Do not make a cross-platform ordering contract out of the order observed in one checkout. Control read completion if a fixture specifically tests which conflicting path receives the error.

## Validation and caller policy

### Missing and invalid are different

A missing web file is allowed. An existing empty file lacks `commands.dev` and is invalid.

Discovery retains a placeholder for an unreadable or malformed web TOML. Its content is `{}` and its `TomlFile` contains a read/parse error. The current web loader passes the preloaded content into schema validation; it does not directly forward that original error into `app.errors`. The command can therefore report required-field/schema errors instead of the original TOML syntax error.

Files rejected by the web schema do not become `Web` objects. Duplicate-role errors are different: the successfully parsed web objects remain in the loaded app. The caller's validation tolerance determines whether it receives that partial app or aborts. The [app-info profile](/test/app-info/web-components.md) specifies its rendering and direct exit-2 behavior.

### Framework, execution, and creation

`resolveFramework()` reads `package.json`, `Gemfile`, `Pipfile`, or `composer.json` in each web directory. The web `name` is not the detected framework. At this baseline the detector has a Remix rule but no dedicated React Router rule, so a component named “React Router” need not have `framework: "react-router"`.

Parsing `build`, `predev`, `dev`, ports, HMR paths, and webhook paths does not execute scripts or contact those endpoints. Commands that build, serve, or deploy add their own execution and health-check variants.

During app creation, successfully loaded frontend/backend components affect the local `isLaunchable` default. No webs, background-only webs, or empty roles do not. Linking's best-effort local load can fall back to defaults after a structural failure. Reusing an existing linked app is not the app-creation path.

Sources: [command exit handling](/packages/app/src/cli/commands/app/info.ts), [renderer](/packages/app/src/cli/services/info.ts), [framework detector](/packages/cli-kit/src/public/node/framework.ts), [creation defaults](/packages/app/src/cli/models/app/app.ts), and [link flow](/packages/app/src/cli/services/app/config/link.ts).

## Fixture set

Use a small schema set with separate discovery and failure cases rather than duplicating every template commit.

| Family         | Cases                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/history`  | Original Node type pair; initial Remix type; Node roles pair; Remix roles plus HMR; Remix predev; React Router command variant; rendered Liquid variants.         |
| `web/presence` | Absent; root; nested; missing Node frontend submodule; Liquid-only; old home-only; empty file.                                                                    |
| `web/layout`   | Default recursive search; custom directories; empty directories array; unmatched pattern; inactive-config restriction; dot directory; excluded node_modules.      |
| `web/union`    | Type only; roles only; both; neither; invalid roles with valid/absent type; valid roles with invalid type; both branches invalid.                                 |
| `web/roles`    | Empty array; duplicates within a file; shared frontend/backend process; duplicate frontend/backend across files; multiple backgrounds.                            |
| `web/fields`   | Missing/empty dev command; optional build/predev; callback scalar/array; slash normalization; HMR table without paths; port bounds/fraction/string; unknown keys. |
| `web/errors`   | Malformed TOML; unreadable file; invalid schema; all webs invalid; valid plus invalid web; duplicate-role errors; framework detector read failure.                |
| `web/output`   | Named/unnamed/empty-name/root component; the caller's supported modes and validation policy; script execution only in the appropriate command phase.              |
| `web/linking`  | Existing remote app versus creation; launchable versus background/empty/no web; local-load fallback.                                                              |

Assert that web files remain byte-for-byte unchanged after normalization. Other loading side effects, including hidden configuration and extension type/UID writes, are covered in [local file states](../app-files.md).

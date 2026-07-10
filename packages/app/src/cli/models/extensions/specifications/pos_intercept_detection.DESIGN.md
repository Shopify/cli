# SPIKE: Deriving POS intercept events from source code

Branch: `henry/pos-intercept-ast-derive` (exploration only)

## What this prototype does

Instead of trusting the hand-authored `capabilities.intercepts` TOML array, it
**derives** the intercept events from the extension's **source code** via a
control-flow-agnostic AST walk of the import graph.

Files:

- `pos_intercept_detection.ts` — the full detector (`detectPosIntercepts`,
  `deriveInterceptsFromConfig`, `findInterceptEntryModules`, `POS_INTERCEPT_TARGET`).
- `pos_intercept_detection_simple.ts` — a deliberately simple baseline detector
  (`detectPosInterceptsSimple`) for evaluating whether the complexity is worth it.
- `pos_intercept_detection.test.ts` — unit tests against the demo fixture.
- `pos_intercept_detection_comparison.test.ts` — complex-vs-simple matrix.
- `fixtures/pos-intercept-demo/` — a POS extension exercising every alias form,
  control-flow branches, a cross-file re-exported alias, and dynamic args, plus a
  render-target module (`home-tile.ts`) that must be IGNORED.
- `fixtures/pos-intercept-compare/` — one isolated file per pattern for the matrix.
- `pos_ui_extension.ts` — `deployConfig` now calls `deriveAndMergeIntercepts`.
- `pos_ui_extension.test.ts` — proves the derived events land in the deployed
  `capabilities.intercepts`.

## Entry points come from declared TARGETS, scoped to `pos.app.ready.data`

Entry points are NOT guessed filenames (`index.*`). They are the `module` paths
of the extension's declared targets (`targeting` / legacy `extension_points`,
per `NewExtensionPointSchema`). Detection is scoped to a single target:

> **`pos.app.ready.data`** — the session-lifetime BACKGROUND target.

Confirmed against the published `@shopify/ui-extensions` point-of-sale surface:
`.../surfaces/point-of-sale/targets/pos.app.ready.data.d.ts` re-exports
`BackgroundShopifyGlobal as ShopifyGlobal`, and `globals.d.ts` documents that the
background-only global (valid only from `pos.app.ready.data`) is what carries
the host-mediated event/intercept APIs. Render targets
(`pos.home.tile.render`, `pos.home.modal.render`, …) see the narrower
`ShopifyGlobal` and do not support intercepts, so we don't scan them.
`findInterceptEntryModules(config, directory)` filters targets to
`pos.app.ready.data` and returns their resolved `module` paths as the entry set.

### Detection behaviour (matches the brief)

1. **Reuses the CLI's existing AST tooling.** It calls `findAllImportedFiles()`
   from `type-generation.ts` to walk the full import graph from the
   `pos.app.ready.data` target's `module`(s), and uses the same `typescript`
   compiler API (`ts.createSourceFile` / `forEachChild` / `isCallExpression`).
2. **Ignores control flow.** Every `shopify.intercept(...)` callsite is counted
   regardless of `if`/`else`/ternary/loop/dead-code. Capabilities are a static
   **superset** of what the extension might do; reachability is a runtime
   concern we deliberately do not evaluate.
3. **Tracks the intercept function value through aliasing.** A whole-graph
   fixpoint resolves the following back to `shopify.intercept`:
   - `const guard = shopify.intercept`
   - `const {intercept} = shopify`
   - `const {intercept: renamed} = shopify`
   - `const s = shopify; s.intercept('...')` (object-alias then member access)
   - `let fn; fn = shopify.intercept` (reassignment)
   - `export const block = shopify.intercept` imported/called in another file
     (cross-file re-export)
4. **Only string-literal first args are resolvable.** Variables, member
   expressions and template strings with substitutions are surfaced as
   `unresolved` with file/line and the raw arg text — never silently dropped.

Run the tests:

```
cd packages/app
../../node_modules/.bin/vitest run \
  src/cli/models/extensions/specifications/pos_intercept_detection.test.ts \
  src/cli/models/extensions/specifications/pos_ui_extension.test.ts \
  src/cli/models/extensions/specifications/pos_intercept_detection_comparison.test.ts
```

## Complex vs simple detector — is the complexity worth it?

A second, deliberately simple detector (`pos_intercept_detection_simple.ts`)
matches ONLY direct `shopify.intercept('x')` calls plus same-file
`const {intercept} = shopify` destructuring. The comparison matrix
(`pos_intercept_detection_comparison.test.ts`) runs both over per-pattern
fixtures:

| pattern | complex | simple |
|---------|:-------:|:------:|
| `shopify.intercept('beforecheckout')` | catch | catch |
| `const {intercept} = shopify; intercept('x')` | catch | catch |
| `const s = shopify; s.intercept('x')` | catch | **MISS** |
| `let fn; fn = shopify.intercept; fn('x')` | catch | **MISS** |
| cross-file `export const block = shopify.intercept` imported+called | catch | **MISS** |
| `if/else` both branches | catch | catch |
| dynamic variable arg | unresolved | unresolved |

The extra complexity buys coverage for exactly three real-world patterns:
object-aliasing, reassignment, and cross-file re-exported references. For direct
calls, same-file destructuring, control-flow branches, and dynamic args the two
detectors are identical. This is the data point for deciding how much alias
tracking to ship.

---

## THE KEY DESIGN QUESTION: derived events → backend

> If events are derived and therefore **not** present in the TOML, how does that
> information get stored in / transmitted to the backend?

### Answer: reuse the existing `capabilities.intercepts` wire field. No new mechanism.

There is **no dedicated transport for "derived" events** and there does not need
to be one. The transmission mechanism is the deployed **version config**, which
the CLI already builds per module in `deployConfig`.

Concrete trace of how config reaches the backend on deploy:

```
pos_ui_extension.deployConfig(config, directory)
    → returns { name, description, renderer_version, capabilities }
        capabilities.intercepts  ← derived ∪ TOML-declared events
ExtensionInstance.deployConfig()                    (extension-instance.ts:198)
ExtensionInstance.bundleConfig()                    (extension-instance.ts:402)
    → { config: JSON.stringify(configValue), context, handle, uid, uuid, ... }
services/deploy.ts:254  app.allExtensions.map(ext.bundleConfig(...))
    → uploadExtensionsBundle({ appModules, ... })
        → backend persists each module's `config` blob as the version config
```

So the derived events ride inside the module's serialized `config` string,
**byte-for-byte identical** to how a TOML-declared `capabilities.intercepts`
array would be serialized. The backend consumer that reads
`capabilities.intercepts` today keeps working unchanged — it cannot tell (and
does not care) whether the array came from the TOML or from AST derivation.

This is exactly what the prototype does:

```ts
// pos_ui_extension.ts deployConfig
const capabilities = await deriveAndMergeIntercepts(config.capabilities, directory)
return { name, description, renderer_version, capabilities }
```

`deriveAndMergeIntercepts` **unions** derived events with any TOML-declared ones,
de-dupes, and sorts. That gives us three coexisting modes with zero backend
change:

| Mode | TOML `intercepts` | Source | Emitted to backend |
|------|-------------------|--------|--------------------|
| Derivation-first (goal) | absent | `intercept('beforecheckout')` | `['beforecheckout']` |
| Declaration-only (today) | `['beforecheckout']` | none/unparseable | `['beforecheckout']` |
| Hybrid | `['manuallydeclared']` | `intercept('beforecheckout')` | `['beforecheckout','manuallydeclared']` |

### Why this is the right shape (per the 2022 "source of truth" ADR)

The ADR's principle — *"we derive the information if it can be derived"* — is
satisfied without changing the contract the backend already depends on. The TOML
field becomes an **optional override / escape hatch** rather than the required
source of truth. The deployed version config remains the single artifact of
record; derivation just changes *who fills in* `capabilities.intercepts`
(the compiler vs. the author), not *where it is stored*.

### Alternatives considered (and rejected for this spike)

- **New top-level `derived_intercepts` wire field.** Rejected: forces a backend
  schema change and a dual-read code path for no benefit — the semantics are
  identical to `capabilities.intercepts`.
- **Emit from the esbuild metafile instead of a standalone AST pass.**
  `bundle.ts` already runs esbuild with `metafile: true` on production deploy.
  The metafile gives us the exact module graph esbuild bundles (more accurate
  than our hand-rolled resolver), but it does **not** contain callsite/AST
  detail, so we'd still need an AST pass over those files. A follow-up could feed
  the metafile's input list into `detectPosIntercepts` instead of
  `findAllImportedFiles` for graph fidelity. Out of scope for the spike.

---

## Reliability gaps (must be surfaced, not hidden)

1. **Dynamic / computed event args are unresolvable.** `intercept(evt)`,
   `intercept(obj.event)`, `` intercept(`before${x}`) `` cannot be statically
   resolved. The detector reports them in `result.unresolved` (with file:line +
   raw text) and `deriveAndMergeIntercepts` logs an `outputWarn`. **Product
   decision needed:** warn-and-continue (current), hard-fail the deploy, or
   require these to be TOML-declared. The TOML override path exists precisely for
   this case.
2. **Import-graph resolution is best-effort.** The cross-file resolver handles
   relative imports and the TS `./x.js`→`x.ts` convention, and skips
   `node_modules`. `tsconfig` path aliases (`@/...`) are handled by the reused
   `findAllImportedFiles` for graph walking but **not** by the cross-file
   *alias-propagation* resolver — an intercept reference re-exported through a
   path-aliased module could be missed. Unifying both on `ts.resolveModuleName`
   would close this.
3. **Aliasing is intentionally shallow (basic data-flow).** We resolve direct
   assignments, destructuring, object-aliasing and cross-file re-exports. We do
   **not** track the reference through: function parameters / higher-order
   passing (`wrap(shopify.intercept)`), array/object property storage
   (`const m = {i: shopify.intercept}; m.i(...)`), or `.bind()/.call()`. These
   would silently under-report. A full type-checker-backed symbol analysis
   (`ts.createProgram` + `TypeChecker`) would be more robust than the
   `createSourceFile`-per-file approach but is heavier.
4. **Dead code is included by design.** Because control flow is ignored, an
   intercept in unreachable code still becomes a capability. This is the safe
   direction (over-declaration) but means derived capabilities can be broader
   than runtime behaviour.
5. **No JS-runtime evaluation.** Constant folding (`const E = 'beforecheckout';
   intercept(E)`) is not performed; `E` is reported unresolved even though it is
   a compile-time constant. Simple const-propagation is a cheap future win.

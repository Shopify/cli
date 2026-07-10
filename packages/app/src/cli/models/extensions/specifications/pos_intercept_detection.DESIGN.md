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

## Complex (resolve) vs "safe simplest" (resolve-or-warn)

The second detector (`pos_intercept_detection_simple.ts`) is now the **safe
simplest** design. Its rule: **never silently under-report.** A call is either
DERIVED SILENTLY (direct `shopify.intercept('<string-literal>')`) or FLAGGED
LOUDLY (a warning with file:line + raw source telling the developer to declare
that intercept in the TOML). It resolves nothing indirect and follows nothing
cross-file — it recognizes intercept-shaped patterns *syntactically* and warns.

All calls use the real API shape `shopify.intercept('<event>', callback)`.

Three-way matrix (`pos_intercept_detection_comparison.test.ts`):

| pattern | complex resolves | simple resolves | simple warns |
|---------|:-------:|:-------:|:-----|
| `shopify.intercept('beforecheckout', cb)` | yes | yes | — |
| `const {intercept} = shopify; intercept('x', cb)` | yes | no | `destructure` |
| `const s = shopify; s.intercept('x', cb)` | yes | no | `object-alias-access` |
| `let fn; fn = shopify.intercept; fn('x', cb)` | yes | no | `function-reference` |
| cross-file `export const block = shopify.intercept` | yes | no | `function-reference` (at creation site) |
| `if/else` both branches | yes | yes | — |
| dynamic variable first arg | unresolved | no | `dynamic-arg` |
| literal event, NO callback (malformed) | unresolved | no | `missing-callback` |
| `('event', cb, extraArg)` trailing args | yes | yes | — |
| `const s = shopify; s.toast.show()` (noise) | n/a | no | **— (no false positive)** |

**Key property:** the simple detector has ZERO silent misses on the alias
patterns — where it can't resolve, it warns.

### Callback-presence handling (2-arg API `intercept('<event>', callback)`)

The event is the FIRST arg; a genuine registration has a callback SECOND arg.
Both detectors accept as a callback: an arrow function, a function expression,
or a function reference (identifier or property access). Handling:

- **Literal event + callback** → resolved event (counted). This is the only path
  that counts an event.
- **Literal event, NO/invalid callback** → surfaced but NOT counted: a suspected
  MALFORMED registration. Complex reports it in `unresolved`; simple emits a
  `missing-callback` warning. (Henry's lean: surface, don't silently count.)
- **Non-literal first arg** → `dynamic-arg` unresolved/warn as before (callback
  presence is moot — the event name is unknowable).
- **Extra trailing args** beyond `(event, callback)` → tolerated; only `args[0]`
  and `args[1]` are inspected.

### Is warn-on-alias simpler or more complex than full resolution?

**Honest assessment: simpler, and meaningfully so.** Code-ish (non-comment)
lines: complex ≈ 295, simple ≈ 172 (~42% smaller). More importantly, the simple
detector DROPS the expensive machinery:

- No cross-file alias propagation and no whole-graph fixpoint loop.
- No per-file import/export symbol maps.
- No multi-pass alias-set growth (`shopifyAliases`/`interceptAliases`).
- No `let`-reassignment data-flow.

What it ADDS is cheap and local: a single-pass syntactic check per file that (a)
resolves direct literal calls and (b) pattern-matches four warn shapes. The only
state it keeps is a one-level set of `const s = shopify` alias names, used *only*
to scope the object-alias warning.

### False-positive / noise risk and how it's scoped

- **`const s = shopify` used for non-intercept reasons.** We do NOT warn on the
  alias declaration. We warn only at an actual `.intercept` access on that alias
  (`s.intercept`). A `const s = shopify; s.toast.show()` produces no warning
  (covered by the `case-alias-noise` fixture).
- **`function-reference` breadth.** Any non-call use of `shopify.intercept`
  warns. This is intentional and low-noise — there is essentially no legitimate
  reason to reference `shopify.intercept` without eventually calling it.
- **Residual noise vector:** a developer who aliases the shopify object *and*
  legitimately calls `.intercept` with a literal (`const s = shopify;
  s.intercept('beforecheckout')`) gets a warning even though the event is
  knowable. That's the deliberate trade: the simple detector refuses to resolve
  through the alias, so it asks for an explicit declaration instead. The complex
  detector resolves it silently. This is exactly the cost/benefit Henry is
  weighing.
- **Single-level aliasing.** `const a = shopify; const b = a; b.intercept()` is
  not recognized as an alias chain, so `b.intercept` would warn as a
  `function-reference`/miss depending on shape — still a warning, never a silent
  miss, so the safety property holds.

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

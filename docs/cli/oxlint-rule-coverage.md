# Oxlint rule coverage

Repository linting uses Oxlint, its native type-aware checker, Prettier, and the
TSDoc parser. ESLint and its upstream rule plugins are absent from the dependency
graph and lockfile. Oxlint's native core diagnostics still use the `eslint` prefix;
that names the rule family, not an installed or executed ESLint engine.

The public `@shopify/eslint-plugin-cli` package keeps all 14 custom rule exports,
including `command-json-output`, and the `configs.config` entry point. That config
now contains CLI custom rules and their test exemption. It no longer bundles the
shared Shopify, TypeScript, React, Vitest, or other third-party ESLint configs.
Consumers must configure those separately. This is a breaking public config change.

## Replacements

The original configuration at `656de9379cb7b4e2af6fe0bc6c8d81b1a50163f7` enabled
301 lint rule names plus `prettier/prettier`. The migration has replacements for
246 lint rule names: 197 native counterparts, 14 retained implementations, and
35 partial independent replacements. Prettier covers formatting separately.
There are 55 rule names without a dedicated replacement. Of those, 11 have
identified coverage or overlap elsewhere in the existing toolchain. These are
not 55 wholly missing capabilities, and overlap does not establish full parity.

The independent plugin in `packages/eslint-plugin-cli/oxlint.js` adds naming,
member ordering, identifier length, import ordering, project boundaries, unused
imports, CommonJS declarations, public API JSDoc, Node global imports, restricted
syntax, and constructor checks. TSDoc syntax validation calls the parser directly.
It uses the default TSDoc configuration; this repository has no `tsdoc.json`.

Partial implementations support repository conventions rather than every
upstream selector or option. Project boundaries reject relative imports and
re-exports between workspace packages, including `require()` and dynamic imports.
They do not reproduce Nx graph cycles, tag constraints, buildability, or lazy-loading
checks. Import ordering handles configured groups and blank lines, with conservative
fixes for contiguous imports without comments or side effects. Public parameter and
return documentation checks cover directly exported functions; destructured parameter
paths and full export reachability are not equivalent to the original JSDoc rules.

Native rules can report additional cases, including unnecessary type assertions
and ambiguous default imports. Existing code and directives are updated for these
diagnostics. Unused imports in tests remain checked even though unused local variables
are allowed. Import-removal fixes differ from the original dedicated plugin.

## Coverage from other existing tools

The mapping's `unsupported` status means no dedicated rule replacement. Its
`otherToolCoverage` entries record additional coverage and the remaining limits.
The audit lists these separately rather than subtracting partial overlap from gaps.

| Existing tool | Coverage already available | Limits |
| --- | --- | --- |
| Knip | Unresolved imports, unlisted dependencies, unused exports/types/files | The plugin and e2e workspaces, selected generated files, and dependencies are excluded. Public entry exports are retained; ancestor-workspace dependencies can satisfy imports. |
| TypeScript and esbuild | Module resolution in checked/bundled inputs; TypeScript also rejects undeclared assignments and invalid redeclarations | Not all JavaScript is type-checked; external bundle imports are exempt from resolution. Neither checks dependency declarations or flags deprecated APIs as errors. |
| TypeScript, Prettier's TypeScript parser, Oxlint's ESM parser | Legacy octal literals and escapes are rejected in their respective scopes | CommonJS JavaScript still accepts these cases. |
| Oxlint parser and existing rules | Duplicate parameters in ESM; independent `no-redeclare` catches duplicates in CommonJS plugin files; `no-shadow` catches catch-binding shadowing | Parser behavior depends on source type, and the existing rules are not proven equivalent for every legacy case. |
| Oxlint CLI | Unused disable comments fail full lint and the PR lint job | Per-project targets do not all pass the reporting flag. Pairing, blanket disables, and other directive policies remain separate gaps. |
| Prettier | Indentation/alignment of supported JSDoc blocks | Does not enforce missing asterisks, tag-column alignment, comment spacing, directive padding, or blank lines between class members. |
| TSDoc parser | Malformed TSDoc syntax | Does not validate parameter names against signatures, resolve documentation types, or check return/throw/yield consistency. |

The original `consistent-return`, `import-x/no-unresolved`,
`import-x/no-extraneous-dependencies`, and Node deprecated/unsupported API rules
were enabled only for JavaScript, not TypeScript. TypeScript coverage must not be
credited as a complete replacement for those JavaScript checks. `noImplicitReturns`
and `checkJs` are not enabled in the shared TypeScript configuration. Also, the
original `strict` rule forbade explicit directives; TypeScript's strict mode does
not replace that style policy.

TypeDoc generation exists for the documentation deployment, but it is not a PR
lint gate or a replacement for the removed JSDoc policies. Nx task execution,
workspace dependency-version checks, and unit tests likewise do not establish
coverage of missing graph-boundary or API-metadata rules.

The review used the installed Knip 5.88.1, TypeScript 5.9.3, Prettier 3.8.4,
Oxlint 1.75.0, and TSDoc 0.16.0. Temporary-file probes confirmed both detections
and counterexamples: Knip reported missing modules, unlisted packages and unused
exports; formatting fixed JSDoc indentation but retained missing asterisks and
comment/class-spacing gaps; TypeScript accepted inconsistent inferred returns,
async read-modify-write operations, deprecated calls and mismatched JSDoc names.
These examples support the inventory, not exhaustive equivalence claims.

Tool references: [Knip issue types](https://knip.dev/reference/issue-types),
[TypeScript options](https://www.typescriptlang.org/tsconfig/), and
[Prettier comment handling](https://prettier.io/docs/rationale.html#comments).

## Remaining gaps

The complete rule-by-rule mapping and limitations are in
[`configurations/oxlint-rule-mapping.json`](../../configurations/oxlint-rule-mapping.json).

| Family | Remaining checks |
| --- | --- |
| Import analysis | Deprecated imports and redundant path segments; resolution, dependency, and unused-export coverage outside Knip/compiler scopes |
| JSDoc | Advanced tag/type validation, parameter path matching, return/throw/yield consistency, layout beyond Prettier |
| Control flow | Consistent returns, atomic updates, early-return conventions |
| Node APIs | Deprecated or unsupported APIs, callback conventions, promise API preferences, executable/shebang checks |
| Shopify conventions | Image imports, context menus, module-scope constants, Twine, singular enum names |
| Style and directives | Camel case in JavaScript, line-comment placement, statement padding, class sorting, explicit strict-directive policy, directive conventions beyond unused suppressions |

Oxlint still checks unused disable directives. Generated GraphQL files keep their
original consistent-type-definition exemption; array style, naming, and project
boundaries remain checked. Public JSDoc checks preserve the original file exclusions,
including public CLI entry points and theme helpers.

## Audit

```sh
node bin/audit-oxlint-coverage.js
```

The audit needs no ESLint dependency. It compares current rule scopes against
frozen effective configurations captured from the original revision in
[`configurations/oxlint-baseline.json`](../../configurations/oxlint-baseline.json).
It checks 1,633 surviving files, with four deleted compatibility files recorded
separately. Every original rule has an explicit replacement or documented gap.
The audit also checks formatting coverage and severity, and reports option differences.
It compares lint configuration coverage, not exhaustive behavioral equivalence.
The supplementary tool inventory is manually verified and records scope limits;
the audit does not execute Knip, TypeScript, Prettier, or the probe examples.

Focused tests exercise the independent rules, native-compatible directives, and
project boundaries. An integration test rejects attempts to load ESLint or upstream
ESLint plugins while running Oxlint.

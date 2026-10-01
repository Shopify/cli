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
There are 55 unsupported rule names. This is not full behavioral parity.

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

## Remaining gaps

The complete rule-by-rule mapping and limitations are in
[`configurations/oxlint-rule-mapping.json`](../../configurations/oxlint-rule-mapping.json).

| Family | Remaining checks |
| --- | --- |
| Import analysis | Deprecated imports, unresolved imports, undeclared dependencies, unused exports, redundant path segments |
| JSDoc | Advanced tag/type validation, parameter path matching, return/throw/yield consistency, comment layout |
| Control flow | Consistent returns, atomic updates, early-return conventions |
| Node APIs | Deprecated or unsupported APIs, callback conventions, promise API preferences, executable/shebang checks |
| Shopify conventions | Image imports, context menus, module-scope constants, Twine, singular enum names |
| Style and directives | Camel case, line-comment placement, statement padding, class sorting, strict-mode conventions, ESLint directive conventions |

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
It compares configuration coverage, not exhaustive behavioral equivalence.

Focused tests exercise the independent rules, native-compatible directives, and
project boundaries. An integration test rejects attempts to load ESLint or upstream
ESLint plugins while running Oxlint.

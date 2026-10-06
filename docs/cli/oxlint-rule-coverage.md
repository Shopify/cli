# Lint checks and limits

`pnpm lint` runs Prettier, Oxlint with type-aware checking, and workspace
dependency-version checks. ESLint is not installed or invoked. The `eslint`
prefix in native Oxlint diagnostics identifies a rule family.

## Custom rules

`packages/eslint-plugin-cli/oxlint.js` provides naming, member and import ordering,
identifier length, workspace boundaries, unused imports, CommonJS declarations,
public API JSDoc, Node global imports, restricted syntax, and constructor checks.
TSDoc syntax validation uses the parser's default configuration.

- Workspace boundaries reject relative imports and re-exports between packages,
  including `require()` and dynamic imports. They do not check dependency cycles,
  tags, buildability, or lazy loading.
- Import ordering checks configured groups and blank lines. Automatic fixes apply
  only to contiguous imports without comments or side effects.
- Public JSDoc checks cover directly exported functions. They do not resolve
  exports through other modules or validate destructured parameter paths.
- Naming checks apply to declared type parameters. Inferred type bindings are exempt.
- Unused imports are checked in tests, where unused local variables are allowed.

The alias plugins support `compat/*`, `no-catch-all/no-catch-all`, and
`tsdoc/syntax` in disable directives. They delegate to the custom rules.
`pnpm lint` rejects unused disable directives.

Generated GraphQL files are exempt from consistent-type-definition checks;
array style, naming, and workspace boundaries are checked. Public JSDoc checks
exclude CLI entry points and theme helpers, as configured in `oxlint.json`.

## Other tools

| Tool | Checks | Limits |
| --- | --- | --- |
| Knip | Unresolved imports, unlisted dependencies, unused exports/types/files | Excludes the plugin and e2e workspaces and selected generated files. Retains public entry exports; ancestor-workspace dependencies can satisfy imports. |
| TypeScript and esbuild | Module resolution in checked or bundled inputs | Some JavaScript and external bundle imports are outside their scope. Neither checks dependency declarations or rejects deprecated APIs. |
| TypeScript, Prettier, and Oxlint parsers | Invalid syntax, including octal literals and escapes in TypeScript or strict ES modules | CommonJS JavaScript permits some of these forms. |
| Prettier | Source formatting and supported JSDoc indentation | Does not enforce JSDoc semantics, directive policies, or all comment and class-spacing conventions. |
| TSDoc | Documentation syntax | Does not compare parameter names with signatures, resolve documentation types, or check return/throw/yield consistency. |

`checkJs` and `noImplicitReturns` are disabled in the shared TypeScript config.
TypeDoc generation is not a PR check. Nx task execution and workspace version
checks do not validate dependency cycles or API deprecations.

See [Knip issue types](https://knip.dev/reference/issue-types),
[TypeScript options](https://www.typescriptlang.org/tsconfig/), and
[Prettier comment handling](https://prettier.io/docs/rationale.html#comments).

## Unchecked policies

| Family | Limits |
| --- | --- |
| Imports | Deprecated imports, redundant path segments, ambiguous default imports, and imports outside Knip/compiler scopes |
| JSDoc | Advanced tag/type validation, parameter path matching, return/throw/yield consistency, layout beyond Prettier |
| Control flow and assertions | Consistent returns, atomic updates, early-return conventions, redundant type assertions |
| Node APIs | Deprecated or unsupported APIs, callback conventions, promise API preferences, executable/shebang checks |
| Shopify conventions | Image imports, context menus, module-scope constants, Twine, singular enum names |
| Style and directives | JavaScript camel case, line-comment placement, statement padding, class sorting, explicit strict directives, disable policies beyond unused directives |

The native `typescript/no-unnecessary-type-assertion`, `import/no-named-as-default`,
and `import/no-named-as-default-member` rules are disabled.

## Configuration audit

Run `node bin/audit-oxlint-coverage.js` to compare configured rules, severities,
options, file scopes, and formatting inputs against
[`configurations/oxlint-baseline.json`](../../configurations/oxlint-baseline.json).
The snapshot's `baselineCommit` field identifies its source. Deleted files are reported
separately. Files added after the snapshot are outside this comparison.

[`configurations/oxlint-rule-mapping.json`](../../configurations/oxlint-rule-mapping.json)
records rule mappings, partial implementations, unsupported policies, and tool
overlap. The audit compares configuration coverage; it does not prove behavioral
equivalence or run the other tools. Plugin tests exercise rule behavior and reject
ESLint imports while running Oxlint.

## Public ESLint plugin

`@shopify/eslint-plugin-cli` exports 14 custom rules, including `command-json-output`.
Its `configs.config` entry point enables CLI rules and a test exemption. Consumers
must configure their own TypeScript parser, shared rule sets, globals, and ignores.

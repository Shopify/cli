# Lint rule coverage

`pnpm lint` runs Prettier, Oxlint, and ESLint. Oxlint uses native rules and
JavaScript rules configured in `oxlint.json`.

The `compat` plugin in `packages/eslint-plugin-cli/oxlint-compat.js` runs shared
ESLint rules for module boundaries, import ordering and deprecations, naming and
member ordering, public API JSDoc, and comment conventions. The adapters supply
import-resolution settings and rule options. Naming checks use syntax-only
parser services; redundant type assertion checks use TypeScript parser services.

The lint script builds the Nx project graph before running Oxlint. Module
boundary checks require that graph. Generated GraphQL exemptions are configured
in `oxlint.json`.

Use `compat/<rule-name>` in disable directives for compatibility rules. The
adapter also accepts the upstream rule names. Oxlint checks unused directives.

The independent JavaScript rules in `packages/eslint-plugin-cli/oxlint.js` cover
naming, member and import ordering, workspace boundaries, unused imports, public
API documentation, and core/Node conventions. Their tests include an Oxlint run
that rejects loading ESLint or its plugins.

The public `@shopify/eslint-plugin-cli` package exports custom rules and a shared
ESLint configuration. Consumers of that configuration require ESLint and its
configured plugins.

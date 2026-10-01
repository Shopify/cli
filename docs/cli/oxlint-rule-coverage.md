# Oxlint rule coverage

Oxlint runs both native rules and JavaScript rules in this repository. There is
no separate ESLint lint pass after the migration.

`oxlint.json` preserves the remaining checks from the shared Shopify config and
the repository overrides. The `compat` plugin in
`packages/eslint-plugin-cli/oxlint-compat.js` runs upstream implementations for
module boundaries, import ordering and deprecations, naming and member ordering,
public API JSDoc, comment conventions, and rules without equivalent native behavior.

The adapters preserve import resolution settings and existing rule options.
Naming conventions use syntax-only parser services. The redundant type assertion
rule uses real TypeScript parser services because the native implementation reports
additional cases. Those services retain some TypeScript parsing cost.

Generated GraphQL files keep their existing rule exemptions in the final config
override instead of repeated disable comments.

The lint script builds the Nx project graph before running Oxlint so module
boundary checks cannot silently skip a missing graph.

Use `compat/<rule-name>` in disable directives for compatibility rules. Existing
repository directives use those names, and Oxlint checks unused directives. The
adapter also understands legacy names for its rules.

`@shopify/eslint-plugin-cli` remains public, with its rules, shared ESLint config,
peer dependency, and publication settings available to other repositories. Its
ESLint dependencies are retained for those consumers and the upstream rule
implementations; Oxlint owns traversal, diagnostics, and fixes here.

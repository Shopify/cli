# App Security check-set extraction POC

The command and local security workflow stay in Shopify CLI. Only the default deterministic implementations, check metadata, and agent prompts move to `@shopify/app-security-checks` in the private POC repository `shopify-playground/shopify-app-security-checks`.

This draft is not a release-ready dependency change. It deliberately uses a local package link rather than publishing an experimental package or requiring public CLI CI to access a private Git URL.

## Local setup

From the CLI repository root, clone the check package into the ignored `.poc` directory, check out its extraction PR, then install and build it:

```sh
mkdir -p .poc
git clone https://github.com/shopify-playground/shopify-app-security-checks.git .poc/app-security-checks
git -C .poc/app-security-checks checkout poc/extract-check-set
pnpm --dir .poc/app-security-checks install --ignore-workspace --frozen-lockfile
pnpm --dir .poc/app-security-checks build
pnpm install --frozen-lockfile
```

The CLI app package links to `.poc/app-security-checks`. To exercise the packaged artifact rather than the checkout, run `pnpm --dir .poc/app-security-checks pack --pack-destination ..`, extract the tarball in another local directory, and point `.poc/app-security-checks` at that directory before reinstalling. Neither this POC package nor tarballs should be published or committed to the CLI repository.

If a local npm proxy has not cached the pinned public dependency versions, install the standalone package using `--registry=https://registry.npmjs.org`.

## Boundary

The check package supplies a versioned `AppSecurityCheckSet` containing catalog metadata, deterministic runner definitions, and exact raw agent prompt sources. `app-security-engine/check-set.ts` is the production package import point.

CLI still discovers and reads bounded inputs, applies current ignore rules, detects capabilities/frameworks, schedules runners, computes prompt hashes, produces agent checks, records and validates agent findings, applies host redaction, combines results using the current precedence/staleness policies, persists artifacts, and renders the unchanged command output. Host workflow instructions are embedded independently from the check prompts.

This rebase preserves the latest local `check`, `record`, `review`, and `clean` workflow. It does not restore the removed trace compiler or submission/upload command.

A compatible replacement can be installed under the same dependency name, changing only the package integration point. Library-level callers can also bind a set explicitly through `createAppSecurityEngine(checkSet)`. That factory passes the set through the existing scanning, agent-check generation, deterministic artifact snapshots and agent recording functions; it does not replace the host business logic or mutate global package selection. `getRegistry(checkSet)` exposes the selected implementations. The host combines stored documents from any compatible set using their self-contained snapshots.

Alternative packages are executable code and require the same review/trust as other installed dependencies. This POC does not add runtime package-loading flags and does not load packages from reviewed app configuration or source files. The host rejects contract mismatches, duplicate IDs and orphan implementations. Preserve or deliberately bump check versions and prompt content when changing checks.

## Validation

- Existing host workflow tests continue to exercise current findings schemas, redaction, ignore rules, coverage, recording and review precedence.
- Detector/prompt tests move with the implementations or import the installed package.
- An alternative fixture set exercises scanning, agent-check generation, registry, findings recording and combined review end to end, with no command change.
- The package tests exercise additions and explicit overrides; the host rejects ambiguous identities.

Before this can be merged for release, decide the package name, contract ownership, distribution/visibility and publishing/versioning policy; replace the local link with a resolvable pinned dependency; and run standard public CI. No changeset is included for this internal draft POC.

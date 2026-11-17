# Contributing to Shopify CLI

## Contributing through the mirror

Shopify develops the CLI in its monorepo, World. This repository is a mirror: each change is published here as a pull request from the `world-mirror/main` branch.

- **Open pull requests here, as before.** Outside contributors keep opening pull requests against `main` in this repository.
- **A Dev Experience member ports your change.** Instead of merging your pull request on GitHub, they bring the change into World and credit you with a trailer on its own line:

  ```
  Mirror-Credit: Your Name <you@users.noreply.github.com>
  ```

- **You get the credit.** The mirror's commit for that change carries `Co-authored-by: Your Name <email>`, so GitHub lists you as a co-author once the mirror's pull request merges. GitHub links the credit by email, so the porter uses the email address from your commits; make sure it's one on your GitHub account (your `users.noreply.github.com` address works).
- **Your pull request is closed with a link.** The porter closes it with a link to the mirror pull request that carries your change.

## Changesets and versioning

This project uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs. Every user-facing change requires a changeset file.

Changesets are published in public changelogs and release notes. Only add one when the change is user-facing and ready to announce publicly. Do not add changesets for tests, refactors, linting, CI, internal tooling, or other changes with no user-visible impact.

```
pnpm changeset add
```

### Choosing the right bump type

The CLI follows [semantic versioning](https://semver.org). Pick the bump type that matches the nature of your change:

| Bump | When to use |
| :---- | :---- |
| `patch` | Bug fix that doesn't change any public interface |
| `minor` | New feature or behaviour that is backwards-compatible |
| `major` | Breaking change to a stable interface (see table below) |

### What counts as a breaking change

The following interfaces are **stable** — any incompatible change to them requires a `major` bump:

| Interface | Breaking change examples |
| :---- | :---- |
| **Command surface** | Removing a command or subcommand; renaming a flag; changing a flag's semantics |
| **Exit codes** | Changing the exit code for a given outcome |
| **Machine-readable output (`--json`)** | Removing or renaming a JSON key; changing a value's type |
| **Config file schema** (`shopify.app.toml`, etc.) | Removing a required key; changing a key's type |
| **Extension manifest schema** | Removing a field; changing validation rules that reject previously-valid manifests |
| **`@shopify/cli-kit` public API** | Removing or renaming a publicly exported function or type |
| **Documented environment variables** | Removing or renaming a documented env var |

Human-readable output (messages, spinner text, prompts) is **not** a stable interface. Changing wording or formatting is not a breaking change.

### Deprecation policy

Before removing or incompatibly changing a stable interface:

1. Mark it deprecated in the code and surface a runtime warning when it is used.
2. Ship the deprecation notice in a **minor** release — this starts the clock.
3. Wait at least one minor release cycle before removing it.
4. Ship the removal in a **major** release with a migration guide in the release notes.

## Releases and stable branches

- This repository is published from Shopify's internal monorepo. `main`'s version bump is made upstream with `pnpm changeset-manifests`, and the mirror carries it to GitHub: it opens or refreshes a pull request here automatically after each upstream merge, and merges it once `main`'s required checks pass. GitHub's `release.yml` then publishes as before.
- Never merge "Version Packages - main" on GitHub. It would put commits on GitHub `main` that the mirror didn't make, and the mirror would refuse every later publish.
- `stable/*` patch lines keep their own "Version Packages - stable/X.Y" pull requests on GitHub, as before.
- Each `X.Y.0` release gets a `stable/X.Y` branch for its patch releases. Only Dev Experience members can create one: after the release, a Dev Experience member creates it from the release tag with `git push origin refs/tags/X.Y.0:refs/heads/stable/X.Y`.
- Changes to `stable/*` branches, such as patch-release cherry-picks, need a pull request with code-owner review.

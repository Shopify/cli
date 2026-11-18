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

- This repository is published from Shopify's internal monorepo. The mirror carries each upstream merge to GitHub: it opens or refreshes a pull request here automatically, and merges it once `main`'s required checks pass. GitHub `main` publishes only nightlies, never a release: on each push, its release workflow only checks that every version on `main` is on npm.
- Minor and patch releases ship from a `stable/X.Y` branch. Only Dev Experience members can create one: for a minor, a Dev Experience member creates it before the release, at a green `main` commit, with `git push origin <commit>:refs/heads/stable/X.Y`. That line's patches go to the same branch.
- `release.yml` pushes each version bump to `changeset-release/stable/X.Y`. GitHub Actions can't open pull requests here, so the release owner opens "Version Packages - stable/X.Y" from that branch, closes and reopens it to run its checks, and QAs its head commit with `release-qa-package.yml`.
- The release owner checks that `stable/X.Y` hasn't moved since the bump, then merges the pull request pinned to the QA'd commit: `gh pr merge <number> --merge --admin --match-head-commit <commit>`. Use a merge commit (`--merge`): a squash merge publishes nothing. `release.yml` then publishes from `stable/X.Y` only the versions that the merge changed. After the release, the version bump is applied upstream, and the mirror carries it to `main`.
- Never merge "Version Packages - main" on GitHub. It would put commits on GitHub `main` that the mirror didn't make, and the mirror would refuse every later publish.
- Dev Experience members can push to and create `stable/*` branches without a pull request; force-pushes and deletion stay blocked. Other changes to `stable/*`, such as patch-release backports, go through a pull request that a Dev Experience member merges with the branch rules' bypass, with no review. While a release is open, only its release owner merges into `stable/X.Y`.

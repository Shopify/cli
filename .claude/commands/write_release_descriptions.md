---
description: Write CLI release description and generate RELEASE_NOTES given a changeset PR URL as input
---

# Generate Shopify CLI Release Documentation

You need to create release documentation for Shopify CLI based on the changeset PR at: $ARGUMENTS

The input is a "Version Packages - stable/X.Y" pull request, for a minor (`X.Y.0`) or a patch release: minors and patches both ship from `stable/X.Y`. `main` never publishes a release, so there is no "Version Packages - main" pull request to read.

## Step 1: Generate Release Markdown

First, review the changeset PR to understand what's being released. Look for:
- The version number (e.g., 3.86.0)
- All changes listed in the PR body

Lines cut after the move (5.1 and later) have no commit hashes in their changelog entries. On `stable/5.0` and older, each entry starts with a short hash: `gh api repos/Shopify/cli/commits/HASH/pulls --jq '.[] | select(.base.ref == "stable/X.Y") | .number'` gives its backport pull request. For entries without a hash:
- For a minor, find the commit that added each changeset (`gh api "repos/Shopify/cli/commits?sha=stable/X.Y&path=.changeset/NAME.md" --jq '.[].sha'`) and its pull request (`gh api repos/Shopify/cli/commits/HASH/pulls`). Link a pull request that merged on this repository before the CLI moved upstream. A pull request that the mirror's bot account opened carries an upstream change: list that change without a link, and tell the user which changes have no link.
- For a patch, each change merged through a backport pull request into `stable/X.Y`. List the changeset files the PR deletes with `gh pr view <number> -R Shopify/cli --json files --jq '.files[].path | select(startswith(".changeset/"))'`. For each one, `git log origin/stable/X.Y --diff-filter=A --format=%H -- <changeset file>` prints the commit that added it, and `gh api repos/Shopify/cli/commits/HASH/pulls --jq '.[] | select(.base.ref == "stable/X.Y") | .number'` prints the backport pull request. Link that pull request.

Create a release markdown with this format:

```markdown
## App
- Feature description ([#PRNUM](https://github.com/Shopify/cli/pull/PRNUM))

## CLI
- Feature description ([#PRNUM](https://github.com/Shopify/cli/pull/PRNUM))

## Theme
- Feature description ([#PRNUM](https://github.com/Shopify/cli/pull/PRNUM))

**Full Changelog**: https://github.com/Shopify/cli/compare/PREVIOUS_VERSION_NUMBER...CURRENT_VERSION_NUMBER
```

Group changes by their primary component. Focus on user-facing changes.
It is not necessary to include very small changes like package bumps. Package bumps can be omitted.
IMPORTANT: Do not modify the description language from the changeset PR. We are re-formatting and adding PR links, not re-wording.

Please present the content to the user for approval. Before doing so, double-check that you've not modified wording from the changeset PR, only link formatting and ordering.

Once the format and wording have been approved, please copy the text to the system clipboard. The release workflow creates the GitHub release from the changelog entries (except for `X.0.0`), so paste it there by editing that release once it exists.

## Step 2: Create Partner Release Notes

Based on the release markdown from Step 1, create a file at `RELEASE_NOTES/{VERSION}.md` (extract version from the PR). For a minor release, create it upstream, in Shopify's internal monorepo, which the mirror publishes here; don't commit it to this repository's `main` or `stable/X.Y`.

The main change you're making here is to remove the PR links from step one. The rest of the content can remain.

Use this format:

```markdown
## App
- Change description with link

## Theme
- Change description with link

## CLI
- Change description with link
```

## Step 3: Commit the Release Notes

After creating the file:
1. Stage it with `git add RELEASE_NOTES/{VERSION}.md`
2. Commit with message: `Release notes for {VERSION}`

## Example Output

For a 3.86.0 release, you would create `RELEASE_NOTES/3.86.md`:

```markdown
## App
- Support for Windows on ARM cpus for Functions binaries
- Fix automatic token refresh to avoid 401 errors
- Add support to `app dev` for dev stores with custom domains

## Theme
- Add `--allow-live` flag to `theme dev` to allow development on live themes without confirmation

## CLI
- Preserve session alias on token refresh for improved multi-session support
```

Verify the file follows the format of previous releases by checking other files in RELEASE_NOTES/.

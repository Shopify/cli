---
description: Write CLI release description and generate RELEASE_NOTES given a changeset PR URL as input
---

# Generate Shopify CLI Release Documentation

You need to create release documentation for Shopify CLI based on the changeset PR at: $ARGUMENTS

## Step 1: Generate Release Markdown

First, review the changeset PR to understand what's being released. Look for:
- The version number (e.g., 3.86.0)
- All changes listed in the PR body
- Commit hashes that need to be converted to PR links

For each change with a commit hash:
1. Use `git log --oneline --grep="HASH" -n 20` to find the commit
2. Use `git log --oneline --merges -n 50` to find the merge commit with PR number
3. Extract the PR number from the merge commit message

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

Once the format and wording have been approved, please copy the text to the system clipboard so that it can be pasted into the GitHub release form.

## Step 2: Create Partner Release Notes

Based on the release markdown from Step 1, create a file at `RELEASE_NOTES/{VERSION}.md` (extract version from the PR).

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

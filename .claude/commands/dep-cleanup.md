---
description: Analyze all dependencies across the monorepo and produce a CSV report identifying which can be removed or replaced to reduce maintenance cost
---

# Dependency Cleanup Audit

Your goal is to audit all dependencies across every package in this monorepo and produce a CSV report that helps the team decide which dependencies to remove or replace.

Results are checkpointed to `.dep-audit/` so the run can be resumed after a crash without re-auditing completed dependencies.

## Step 1: Collect all dependencies

Read every `packages/*/package.json` file. For each file, collect:
- All keys under `"dependencies"` and `"devDependencies"`
- The package name the dependency belongs to

Deduplicate the list — if the same dependency appears in multiple packages, treat it as one entry but note which packages use it.

Exclude workspace-internal packages (anything whose name starts with `@shopify/` that also appears as a package in this repo).

### Check for existing checkpoint files

Look for `.dep-audit/*.json` files in the repo root. Each file represents a previously completed sub-agent result. The filename is the dependency name with `/` replaced by `__` (e.g. `@scope/pkg` → `@scope__pkg.json`).

Remove any deps from the work list that already have a checkpoint file — they do not need to be re-audited. Print how many were skipped vs how many remain.

## Step 2: Launch sub-agents in parallel

For each remaining dependency (those without a checkpoint file), launch a general-purpose sub-agent with the following instructions. Pass the dependency name and the list of packages that declare it. Launch as many as possible in each batch — expect to process in several rounds of ~10–20 agents at a time rather than all at once.

---

**Sub-agent instructions (for dependency `<NAME>`, declared in `<PACKAGES>`):**

You are auditing the dependency `<NAME>` in the Shopify CLI monorepo to help the team decide whether to remove or replace it.

### 2a. Check if it is actually used

Search the source files under `packages/` (exclude `node_modules`, `dist`, `*.d.ts`) for any `import` or `require` of `<NAME>`. Use Grep twice:
1. Exact package name: pattern `['"]<NAME>['"]`
2. Subpath imports: pattern `['"]<NAME>/`

Count a dependency as used if either search returns results.

Report:
- `used`: yes / no
- If yes, list up to 10 representative file paths and a short description of what the code is doing with the dependency (e.g. "used for TOML parsing in 3 files", "used as a test helper in 12 spec files").

### 2b. Estimate replacement effort

If the dependency is used, assess how much code would need to be written to inline the functionality or switch to Node.js built-ins / a simpler alternative. Categorise as:
- `trivial` — a few lines; Node.js built-ins or simple inline code can replace it directly
- `small` — under ~50 lines of new code
- `medium` — 50–200 lines of new code
- `large` — more than 200 lines, or requires significant refactoring

Provide a brief code sketch (or explanation) of how the removal/replacement would work. Keep it concise — 1-5 lines of pseudocode or prose.

### 2c. Release velocity (last 24 months)

Fetch the npm registry data for this package:

```
https://registry.npmjs.org/<NAME>
```

From the `time` field, extract all version strings published between today minus 24 months and today (ignore the `created` and `modified` keys). Then count the total number of such releases.

Report:
- `total_releases_24m`: total count of releases in the window

### 2d. Feasibility judgement

Based on 2a–2c, decide `removal_candidate` using this rule:

- If `used: no` → `removal_candidate: yes` (just delete from package.json).
- If used and `replacement_effort` is `trivial` or `small` → `removal_candidate: yes`.
- If used and `replacement_effort` is `medium` or `large` → `removal_candidate: no`; explain why in `how_to_remove`.

If `removal_candidate: no`, search for a **replacement dependency** on npm using WebSearch or WebFetch against:
```
https://registry.npmjs.org/-/v1/search?text=<query>&size=5
```
where `<query>` describes the functionality. Look for a replacement that:
- Covers the same use case
- Has fewer total releases in the last 24 months than `<NAME>`
- Is actively maintained (last publish < 12 months ago)

If you find a good replacement, name it and briefly explain why it is better. Otherwise write "none".

### 2e. Write a checkpoint file and return your findings

Derive the checkpoint filename by replacing every `/` in `<NAME>` with `__`, then appending `.json`:
- `lodash` → `.dep-audit/lodash.json`
- `@scope/pkg` → `.dep-audit/@scope__pkg.json`

Create the `.dep-audit/` directory if it does not exist, then write the following JSON to that file:

```json
{
  "name": "<NAME>",
  "packages_declaring": ["<PACKAGES>"],
  "used": "yes|no",
  "usage_summary": "...",
  "total_releases_24m": 0,
  "replacement_effort": "trivial|small|medium|large|n/a",
  "how_to_remove": "...",
  "removal_candidate": "yes|no",
  "replacement_dependency": "package-name or none",
  "replacement_reason": "..."
}
```

After writing the file, return the same JSON object to the orchestrator.

---

## Step 3: Write the CSV report

Collect results from two sources:
1. JSON returned by sub-agents launched in this run
2. Existing checkpoint files from `.dep-audit/` that were skipped in Step 1 (read each file)

Write a CSV file to `.dep-audit/_audit.csv`.

CSV columns (in this order):
```
dependency_name,packages_declaring,used,total_releases_24m,removal_candidate,replacement_effort,how_to_remove,replacement_dependency,replacement_reason
```

Rules:
- Escape any commas or double-quotes inside field values (wrap the field in double-quotes, escape internal double-quotes as `""`).
- Sort rows: `removal_candidate=yes` rows first, then `no` rows. Within each group sort alphabetically by `dependency_name`.
- Include a header row.

After writing the file, print a short summary: total dependencies audited, how many were resumed from checkpoints, how many are removal candidates, how many have a suggested replacement.

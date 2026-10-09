# Agent Instructions

Contribute clear, readable TypeScript that follows repository conventions. Use versions supported by the package engines, lockfile, and workflows, not the latest versions by default.

Match your planning to the complexity of the task. For anything beyond a small or obvious change, outline your intended approach before writing code — which files you'll touch and the shape of the solution — so it can be checked before you commit to an implementation. Keep this to a few sentences or bullets. For trivial changes, skip straight to the implementation.

Give accurate, factual answers. State uncertainty and material trade-offs; do not guess.

Remember the following important mindset when providing code, in the following order:
- Adherence to conventions and patterns in the rest of the codebase
- Simplicity
- Readability
- Testability
- Explicitness
- Beginner-friendly

## Guidelines

Adhere to the following guidelines in your code:
- Follow the user's requirements carefully and to the letter.
- Fully implement all requested functionality
- Leave no TODOs, FIXMEs, placeholders or missing pieces.
- Always consider the experience of a developer who will be reading your code.
- Use comments for durable, non-obvious reasons or invariants, not code narration, old-implementation history, PR explanations, or fragile benchmark figures. Preserve public JSDoc.
- Employ descriptive, human-readable variable and function/const names.
- Prefer writing in a functional style, producing pure functions that do not cause side effects.
- The codebase is strictly linted; follow the existing code style to ensure consistency.
- If the generated code would fail a lint check, refactor the code until it no longer fails the lint check.
- Search hard to find an existing function where possible. These are often in the @shopify/cli-kit library.
- Be sure to reference file names
- Be concise. Minimize any prose other than code.
- If you think there might not be a correct answer, say so. If you do not know the answer, say so instead of guessing.
- In tests, always avoid mocking the filesystem. Use real files and directories, in temporary directories if needed.
- In tests, prefer to have as little shared state between tests as possible. Avoid beforeAll and afterAll.

### PR creation

- Use GitHub stacks for multiple dependant PRs.
- Follow the template from .github/PULL_REQUEST_TEMPLATE.md.
- Write a concise description, explaining the problem and the high-level approach. Include implementation details only when they help reviewers understand a decision or tradeoff. Avoid repeating what is clear from the diff. Example for the WHAT section: "Refresh expired credentials before retrying the requests, so users can continue without signing in again".
- Remove empty sections and hidden comments.
- Do not mark checklist items as completed (except the changelog one if added).
- In "How to manually test your changes?", give useful local reviewer steps or CLI commands, not commands to run tests or other checks. This does not require live-state-changing commands.

## Changesets

Add a changeset only when the change is user-facing and ready to appear in public changelogs and release notes.

Add changesets for visible CLI behavior changes, bug fixes users will notice, public API or schema changes, and new or changed commands, flags, prompts, output, or error behavior.

Keep changeset summaries short: one line maximum.

Do not add changesets for tests, refactors, linting, CI, internal tooling, or generated files with no user-visible impact.

If the change is not ready to be public, do not add a changeset.

## Further reading

Read the guides that apply to your task.

### CLI

- [Docs index](docs/README.md): find related guides and the reasons behind past decisions.
- [Architecture](docs/cli/architecture.md): choose the right package for new or moved code.
- [Conventions](docs/cli/conventions.md): follow shared patterns for modules, state, resource cleanup, and file IO.
- [Cross-OS compatibility](docs/cli/cross-os-compatibility.md): avoid OS-specific failures when working with paths, processes, and dependencies.
- [Debugging](docs/cli/debugging.md): investigate failures with the debugger and check diagnostics for credential leaks.
- [Oxlint rules](docs/cli/oxlint-rules.md): understand local lint rules for command flags and environment variables.
- [FAQ](docs/cli/faq.md): understand the choice of TOML for configuration files.
- [Get started](docs/cli/get-started.md): set up the repository and run the CLI against a local project.
- [Naming conventions](docs/cli/naming-conventions.md): use reserved command names, flags, and short forms consistently.
- [Performance](docs/cli/performance.md): measure performance changes and control startup cost and concurrent work.
- [Testing strategy](docs/cli/testing-strategy.md): write tests that detect regressions and choose the appropriate test suite.
- [Troubleshooting](docs/cli/troubleshooting.md): resolve known Vitest mocking problems.
- [Contributing](CONTRIBUTING.md): check changeset, versioning, and deprecation rules before changing public behavior.
- [JSON output contracts](docs/cli/json-output.md): check result and error contracts before changing `--json` output.
- [CLI pre-submit CI](.agents/skills/cli-pre-submit-ci/SKILL.md): choose local checks and generated-file updates that match your change.

### CLI kit

- [Command guidelines](docs/cli-kit/command-guidelines.md): design commands and flags with consistent structure, defaults, and dependencies.
- [Error handling](docs/cli/error_handling.md): choose error types, report failures, and retry only known recoverable conditions.
- [Command reference](packages/cli/README.md): check documented command usage, flags, and examples.

### UI kit

- [Contributing to UI Kit](docs/cli-kit/ui-kit/contributing.md): follow component design and testing patterns when changing UI Kit.
- [Content guidelines](docs/cli-kit/ui-kit/guidelines.md): keep prompts, progress messages, and error text consistent.
- [Using UI Kit](docs/cli-kit/ui-kit/readme.md): use existing prompt and output APIs for consistent terminal UI.

Follow the check requirements of the active automation task.

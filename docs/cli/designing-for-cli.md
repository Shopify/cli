# Designing for CLI

Design for app, theme, Hydrogen, and merchant developers, and for the machines that run their workflows. Give developers helpful defaults and a clear path from setup to daily work. Use familiar patterns so that learning one command helps them use another.

Get input from the repository maintainers before you add a command, a topic, or a new flow. Use the [Command Line Interface Guidelines](https://clig.dev/) for questions not covered here. Repository-specific contracts take precedence over that general guidance.

## Give each command one clear outcome

A command should do one thing well for the developer. One outcome can require several processes. For example, `shopify app dev` can handle authentication, app setup, builds, validation, and serving a preview. Those steps support one outcome: previewing the developer's work.

Keep commands simple, powerful, and precise. Use flags to make a command expressive without making developers learn the CLI before they can build. Prefer a small set of commands that cover common workflows, such as `shopify app dev`, `shopify app deploy`, and `shopify app generate extension`. Add a command only when it serves a distinct outcome that existing commands cannot express clearly.

Use the same term for the same activity across domains. For example, both `shopify app dev` and `shopify theme dev` use `dev` for a development session. Follow the [command guidelines](../cli-kit/command-guidelines.md) for hierarchy, topics, flags, and help text, and the [reserved names](./naming-conventions.md) for shared commands and flags.

## Choose a clear command lifetime

Most commands finish a task and exit, such as generating an extension or initializing an app. Commands that run until the developer stops them should be rare. Before you add one, consider whether the work belongs in an existing development session, such as `shopify theme dev`.

Design for automation as well as interactive use. A finite command returns one final result. A long-lived development session produces an open-ended stream. Follow the [JSON output contracts](./json-output.md) for finite results, streaming exemptions, and the separate roles of output format and interactivity. Do not make scripts parse terminal presentation to obtain a result.

## Make long operations understandable

Keep jobs in the foreground unless they are truly long-running (three minutes or more), or the developer explicitly requests background execution through a flag. This is a design guideline for a feature that supports background work, not a claim that every command has a background mode.

Choose timeout defaults that cover the expected use cases. Aim to cover 95% of cases without making developers guess a timeout. This is a design target, not a measured success rate for existing commands. Use the [performance guide](./performance.md) to investigate slow work.

Show meaningful progress during longer operations. Make it clear whether work is running, has succeeded, or has failed. If an operation fails part way through, tell the developer what succeeded before the failure and what they can do next. Follow the [error handling principles](./error_handling.md) for error types and recovery details; keep progress separate from the final result as specified by the JSON contract.

## Keep the terminal experience consistent

Use the [CLI UI Kit](../cli-kit/ui-kit/readme.md) instead of creating a separate visual language. Keep neutral text quiet, use emphasis and semantic color with purpose, and avoid distractions. Helpful prompts and editable defaults should keep developers moving without hiding consequential choices.

The [content and UI guidelines](../cli-kit/ui-kit/guidelines.md) cover banners, prompts, active progress, completed states, and logs. Use the [UI Kit contribution guide](../cli-kit/ui-kit/contributing.md) when an existing component does not meet the need. The [architecture](./architecture.md) and [code conventions](./conventions.md) describe where the implementation belongs.

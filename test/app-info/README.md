<!--
title: app_info_test_profiles
description: Test inventories and coverage notes for the app info command.
tags: [documentation, testing, cli, app-info]
-->

# App info test profiles

These profiles define command-specific inputs, execution paths, output behavior, and fixture expectations for [`app-info.test.ts`](../app-info.test.ts). The [coverage checklist](./coverage.md) maps those behaviors to executable cases and known gaps.

Reusable state, schema, fixture, and coverage guidance belongs in [the CLI command tests skill](../../.agents/skills/cli-command-tests/SKILL.md).

Run the suite and its mapped source-coverage check from the repository root:

```sh
pnpm test:commands:coverage
```

## Profiles

- [Coverage checklist](./coverage.md)
- [Coverage scope](./coverage-scope.json)
- [Flags and environment](./flags-and-environment.md)
- [Network composition](./network.md)
- [Local-file effects](./local-files.md)
- [Stored-state and package effects](./stored-state-and-packages.md)
- [Extension-loading effects](./extension-files.md)
- [Web-component effects](./web-components.md)

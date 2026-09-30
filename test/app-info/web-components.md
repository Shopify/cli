<!--
title: app_info_web_component_effects
description: How shared web configuration and validation appear in app-info result modes.
tags: [documentation, app-info, web, configuration, testing]
-->

# App info web-component effects

This is the command-specific profile for the researched CLI baseline `8829ed581d25f964c53564c403bfbf94484753b4`. Shared state variants now live in the [command-testing skill](/.agents/skills/cli-command-tests/references/state-catalog.md). The [web schema and discovery reference](/.agents/skills/cli-command-tests/references/toml-schemas/web-toml.md) applies to shared app loading. This profile describes what app info renders and what it does not execute.

## Validation and output

### Missing and invalid are different

A missing web file is allowed. An existing empty file lacks `commands.dev` and is invalid.

Discovery retains a placeholder for an unreadable or malformed web TOML. Its content is `{}` and its `TomlFile` contains a read/parse error. The current web loader passes the preloaded content into schema validation; it does not directly forward that original error into `app.errors`. The command can therefore report required-field/schema errors instead of the original TOML syntax error.

Files rejected by the web schema do not become `Web` objects. The text renderer only visits successfully loaded webs. If the only web file is invalid, it can omit the web section entirely yet still exit 2 because `app.errors` is nonempty. Full JSON includes the `AppErrors` object's stored errors; it is not the same presentation as the text report.

Do not assert that every exit-2 case includes a visible web error row. Duplicate-role errors are different: their web objects remain loaded, so the renderer can attach errors to them.

### Effects by output mode

| Input change                                           | Text                                                                   | Full JSON                                   | Web-env                                              |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| Web added or removed                                   | Adds/removes web component rows.                                       | Changes `webs`.                             | Does not change the three returned values by itself. |
| Name, roles, or location                               | Changes labels, role rows, or paths.                                   | Changes normalized configuration/directory. | No direct value change.                              |
| Commands, port, callback path, webhook path, HMR paths | Not listed in the component rows.                                      | Appears in normalized web configuration.    | No direct value change.                              |
| Framework detector files                               | Framework is not shown in text component rows.                         | Changes `web.framework`.                    | No direct value change.                              |
| Collected web validation errors                        | Renders available components, then exits 2; some errors may lack rows. | Emits JSON with errors, then exits 2.       | Can print web-env output, then exit 2.               |
| An uncaught filesystem/framework-detection error       | Can abort before rendering.                                            | Same abort boundary.                        | Same abort boundary.                                 |

`resolveFramework()` reads `package.json`, `Gemfile`, `Pipfile`, or `composer.json` in each web directory. The web `name` is not the detected framework. At this baseline the detector has a Remix rule but no dedicated React Router rule, so a component named “React Router” need not have `framework: "react-router"`.

App info does not run `build`, `predev`, or `dev`; check whether executables exist; bind the configured port; connect to HMR; or deliver webhooks to the configured path. These are parsed configuration values, not live-service health checks.

Web files also matter during app creation. If app info enters linking and the user creates an app, successfully loaded frontend/backend components affect the local `isLaunchable` creation default. No webs, background-only webs, or empty roles do not. Linking's best-effort local load can fall back to defaults after a structural failure. Existing linked-app reporting does not mutate remote launchability based on web files.

Sources: [command exit handling](/packages/app/src/cli/commands/app/info.ts), [renderer](/packages/app/src/cli/services/info.ts), [framework detector](/packages/cli-kit/src/public/node/framework.ts), [creation defaults](/packages/app/src/cli/models/app/app.ts), and [link flow](/packages/app/src/cli/services/app/config/link.ts).

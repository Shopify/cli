# App info JSON field inventory

These inputs are already loaded by `linkedAppContext`. This command makes no additional API requests for JSON output.

| Input | Public output |
| --- | --- |
| Local app | Existing name, directory, active configuration and path, web components, errors, development URLs, extension collections and specifications remain unchanged. |
| Remote app | `remoteApp`: ID, title, client ID (`apiKey`), organization ID, app type, new-app status, granted and requested scopes, development-store preview status, application and redirect URLs, webhook API version, embedded/POS status, preferences URL, GDPR webhooks, app proxy, configuration and flags. Optional fields appear when loaded. |
| Organization | Existing ID and business name, plus `source`. The organization lookup for this command does not load status, shop count or URL. |
| Project | Existing package manager, dependencies and workspace status; `project` adds the directory, discovered app/extension/web TOML paths, parsed contents and parse errors, environment-file paths, and discovery errors. |
| Extensions | Existing enumerable data is preserved. Public getters for name, type, external type, human name, surface, capabilities (`features`) and dependency are added. Configuration contains targets, build commands and other type-specific data. |
| Selected development store | `devStoreUrl` resolves active configuration before cached configuration. |
| Account | `account`: cached user email, service-account organization name, or unknown-account discriminator. The linked-app lookup has already initialized the session. |
| Runtime | `system`: CLI and Node versions, platform, architecture and shell (when set). |

API secrets and the API client are excluded from `remoteApp`. Newly discovered environment files expose paths only,
since their values can contain credentials. Raw project selection caches, schema objects, functions and internal
extension build/watch helpers are not new public result fields. Legacy enumerable data, including the selected dotenv
and hidden configuration, remains for compatibility. Derived aliases and extension subsets remain available through
their existing underlying configuration and collections.

The explicit `--web-env` result retains its existing API key, optional API secret and scopes contract.

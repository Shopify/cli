# App Management, linked context, and linking state

This is the App Management client/workflow profile, not a request baseline for every command. `linkedAppContext()` composes app, organization, and specification loading; linking adds selection/creation and repeated reads. `localAppContext()` uses local specifications instead. Inspect caller options, including validation tolerance, before assigning command outcomes. The source baseline is CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`. Recheck changed readers and dependency versions before reusing an outcome.

The historical N1–N8 IDs are retained for traceability. Response shapes and shared mapping rules live here; the app-info sequence and renderer expectations remain in the [command profile](/test/app-info/network.md).

## Linked-app calls

### N1: `UserInfo`

**Endpoint:** Business Platform. **Variables:** none. **When:** the App Management client initializes its session. **Cache:** six hours, with the authenticated user ID as an extra cache key.

Sources: [session initialization](/packages/app/src/cli/utilities/developer-platform-client/app-management-client.ts), [UserInfo query and generated type](/packages/app/src/cli/api/graphql/business-platform-destinations/generated/user-info.ts).

```ts
type UserInfoData = {
  currentUserAccount?: {
    uuid: string
    email: string
    organizations: {nodes: Array<{name: string}>}
  } | null
}
```

The query requests the first two organizations. The client uses their names only for automation-token accounts.

| Fixture                                   | Response variation                                                                     | Expected behavior                                                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `user-info/user`                          | Account with an email; zero, one, or two organizations.                                | User session carries the email. Organization count does not restrict a user account.                                                                                                       |
| `user-info/service-account`               | Automation token; one organization.                                                    | Service-account session carries the organization name.                                                                                                                                     |
| `user-info/service-account-no-org`        | Automation token; `nodes: []`.                                                         | Uses `Unknown organization` as the service-account name.                                                                                                                                   |
| `user-info/service-account-multiple-orgs` | Automation token; two organizations.                                                   | Throws `BugError: Multiple organizations found for the CLI token`. App lookup does not run.                                                                                                |
| `user-info/unknown-account`               | `currentUserAccount: null` or omitted.                                                 | Initializes an unknown account. Later calls can still run; the caller chooses its display.                                                                                                 |
| `user-info/cache-hit`                     | Fresh cached data; network unavailable for this query.                                 | Reuses cached data without sending the query.                                                                                                                                              |
| `user-info/malformed`                     | Automation account missing `organizations.nodes`, or required fields with wrong types. | No response-schema validator protects this mapping. Assert the actual failure or malformed output, not an invented recovery path.                                                          |
| `user-info/unauthorized-at-startup`       | Cold session, HTTP 401.                                                                | Exercise separately from ordinary token refresh. The refresh handler calls `session()` before initial session assignment; use a deadline/request limit to detect recursive initialization. |

A query failure does **not** become an unknown account. That fallback is for a successful response with no `currentUserAccount`.

### N2: `ActiveAppReleaseFromApiKey`

**Endpoint:** App Management. **Variables:** `{apiKey: effectiveClientId}`. **Cache:** none. **When:** fetching a known or selected app; also called again during linking to obtain remote configuration.

Sources: [appFromIdentifiers and activeAppVersion](/packages/app/src/cli/utilities/developer-platform-client/app-management-client.ts), [query and generated type](/packages/app/src/cli/api/graphql/app-management/generated/active-app-release-from-api-key.ts), [app-not-found handling](/packages/app/src/cli/services/context.ts).

```ts
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {[key: string]: JsonValue}

type ReleasedModule = {
  uuid: string
  userIdentifier: string
  handle: string
  config: {[key: string]: JsonValue}
  target?: string | null
  specification: {
    identifier: string
    externalIdentifier: string
    name: string
    experience: string
    managementExperience: string
  }
}

type ReleasedApp = {
  id: string
  key: string
  organizationId: string
  activeRoot: {
    grantedShopifyApprovalScopes: string[]
    clientCredentials: {secrets: Array<{key: string}>}
  }
  activeRelease: {
    id: string
    version: {
      name: string
      appModules: ReleasedModule[]
    }
  }
}

type ActiveAppReleaseData = {app: ReleasedApp}
```

The generated type requires `app`, but the lookup explicitly handles a null or missing app. Keep that defensive case separate from the declared success contract.

| Fixture                   | Response variation                                                              | Expected behavior                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/found`               | Complete app with an `app_home` module.                                         | Uses release `name` as the remote title, `key` as client ID, and derives organization ID from `organizationId`.                                  |
| `app/not-found`           | `app: null` or omitted, without GraphQL errors.                                 | Known-ID lookup throws `No app with client ID … found`. Account type changes the help text.                                                      |
| `app/permission-denied`   | HTTP 403 or GraphQL access-denied error.                                        | Fails through the shared GraphQL handler, not the not-found branch.                                                                              |
| `app/no-home-module`      | No module whose `specification.externalIdentifier` is `app_home`.               | Remote application URL and embedding are undefined. Ordinary linked info still uses local configuration.                                         |
| `app/no-modules`          | `appModules: []`.                                                               | App lookup succeeds. During linking, an empty usable module list takes the configuration fallback path.                                          |
| `app/empty-title`         | `version.name: ""`.                                                             | The model retains an empty title. Fallback text is a renderer decision.                                                                          |
| `app/no-secrets`          | `secrets: []`.                                                                  | App lookup succeeds with no secret keys. Consumers such as `outputEnv()` choose empty-string versus omitted-field output.                        |
| `app/rotated-secrets`     | Two distinct secret keys.                                                       | The mapper retains the key list; `outputEnv()` uses the first key only.                                                                          |
| `app/local-remote-differ` | Remote title, scopes, or URL differ from local TOML.                            | Keep local and remote values distinct. The caller chooses which source supplies each result field; app-info's mapping is in its command profile. |
| `app/organization-id`     | Numeric string or supported organization GID; malformed GID as a negative case. | Valid IDs normalize for the next query. Malformed IDs can fail conversion; no organization fallback exists.                                      |
| `app/malformed-release`   | Null/missing `activeRelease`, `version`, `activeRoot`, or required arrays.      | Violates the declared schema. Nested access/mapping can throw; do not treat it as an empty app.                                                  |
| `app/changed-during-link` | First release read succeeds; second changes modules or returns no app.          | Test the second read independently. `activeAppVersion()` does not have the lookup's missing-app guard.                                           |

For linking, also vary module `config`, `target`, identifiers, and specification experience. UUID-strategy modules are excluded from app configuration. Unrecognized configuration modules and falsy configs are skipped by the merge. Known modules use their remote-to-local transforms. A bad module payload can therefore fail linking even if ordinary linked info could display the same app.

Sources: [remote configuration conversion](/packages/app/src/cli/services/app/select-app.ts), [link merge and fallback](/packages/app/src/cli/services/app/config/link.ts).

### N3: `FindOrganizations`

**Endpoint:** Business Platform. **Variables:** `{organizationId: base64("gid://organization/Organization/{id}")}`. **Cache:** six hours. **When:** resolving the app's organization; also used during interactive linking.

Sources: [orgFromId](/packages/app/src/cli/utilities/developer-platform-client/app-management-client.ts), [generated type](/packages/app/src/cli/api/graphql/business-platform-destinations/generated/find-organizations.ts), [NoOrgError](/packages/app/src/cli/services/dev/fetch.ts).

```ts
type FindOrganizationsData = {
  currentUserAccount?: {
    organization?: {id: string; name: string} | null
  } | null
}
```

| Fixture                              | Response variation                                    | Expected behavior                                                                                                  |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `organization/found`                 | Account and organization present.                     | Maps `name` and the requested numeric organization ID. The mapper does not use the returned `id` as its output ID. |
| `organization/no-account`            | Account null or omitted.                              | Throws `NoOrgError`.                                                                                               |
| `organization/no-access`             | Organization null or omitted.                         | Throws `NoOrgError`; help text varies for user, service, and unknown accounts.                                     |
| `organization/empty-name`            | `name: ""`.                                           | No name fallback; preserve this distinction from a missing organization.                                           |
| `organization/cache-hit`             | Cached organization with an old name or access state. | Uses the cached result; no live access recheck for this query.                                                     |
| `organization/expired-cache-failure` | Expired entry and failing replacement request.        | Fails. There is no stale-on-error fallback.                                                                        |

Unlike `UserInfo`, this call does not add a user ID to its cache key. Include an account-switch fixture with the same organization ID to expose cross-account cache reuse. The generic key includes query, variables, CLI version, and the optional extra key, but not the token or endpoint.

### N4: `fetchSpecifications`

**Endpoint:** App Management. **Variables:** `{organizationId: "gid://shopify/Organization/{id}"}`. **Cache:** none at the request layer. **When:** every linked context load; linking also requests specifications before writing the configuration.

Sources: [generated type](/packages/app/src/cli/api/graphql/app-management/generated/specifications.ts), [API mapping](/packages/app/src/cli/utilities/developer-platform-client/app-management-client.ts), [local/remote merge](/packages/app/src/cli/services/generate/fetch-extension-specifications.ts), [contract parser](/packages/app/src/cli/utilities/json-schema.ts).

```ts
type Specification = {
  name: string
  identifier: string
  externalIdentifier: string
  experience: string
  features: string[]
  uidStrategy: {
    __typename:
      | "UidStrategiesClientProvided"
      | "UidStrategiesDynamic"
      | "UidStrategiesStatic"
    appModuleLimit: number
    isClientProvided: boolean
  }
  validationSchema?: {jsonSchema: string} | null
}

type SpecificationsData = {specifications: Specification[]}
```

`jsonSchema` is a JSON-encoded **string**, not an object. A valid remote-only configuration specification can look like this:

```json
{
  "data": {
    "specifications": [
      {
        "name": "Fixture configuration",
        "identifier": "fixture_configuration",
        "externalIdentifier": "fixture_configuration",
        "experience": "configuration",
        "features": [],
        "uidStrategy": {
          "__typename": "UidStrategiesStatic",
          "appModuleLimit": 1,
          "isClientProvided": false
        },
        "validationSchema": {
          "jsonSchema": "{\"type\":\"object\",\"properties\":{\"fixture_configuration\":{\"type\":\"object\",\"properties\":{\"enabled\":{\"type\":\"boolean\"}}}},\"additionalProperties\":false}"
        }
      }
    ]
  }
}
```

This response illustrates one specification, not a complete baseline for a normal app. Baseline fixtures must include the app modules and extension types used by their local files.

| Fixture                            | Response variation                                                                                     | Expected behavior                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `specs/local-match`                | Known local specs with no contract, null contract, or `jsonSchema: "{}"`.                              | Uses local parsers where the contract is absent or empty.                                                                                                                                                                                             |
| `specs/contract-valid`             | Known spec plus a valid contract.                                                                      | Runs local Zod parsing and contract validation.                                                                                                                                                                                                       |
| `specs/contract-rejects-config`    | Valid schema rejects a local module value.                                                             | Can produce collected validation errors. Rendering or aborting depends on the caller's tolerance policy.                                                                                                                                              |
| `specs/remote-only-contract`       | Unknown identifier with a valid contract.                                                              | Builds a contract-based specification. Cover configuration and extension experiences, with and without localization. Localized configuration modules can read [root locale files](extension-files.md#localized-configuration-modules) during loading. |
| `specs/remote-only-no-contract`    | Unknown identifier with an absent/null contract or an empty `jsonSchema` string.                       | Drops the specification. A corresponding local extension may become an invalid extension type.                                                                                                                                                        |
| `specs/remote-only-empty-contract` | Unknown identifier with `jsonSchema: "{}"`.                                                            | Still creates a contract-based spec. This differs from a missing contract.                                                                                                                                                                            |
| `specs/missing-local-type`         | Nonempty response omits a type used locally.                                                           | Does not restore the missing type from local specs; test the resulting loader errors.                                                                                                                                                                 |
| `specs/empty`                      | `specifications: []`.                                                                                  | Merge returns no specs. The current loader returns no extensions early; this differs from a nonempty list missing one type.                                                                                                                           |
| `specs/deprecated`                 | `experience: "deprecated"`.                                                                            | Filters out the spec.                                                                                                                                                                                                                                 |
| `specs/unknown-experience`         | An unrecognized experience string.                                                                     | Normalizes to `extension`, with debug output.                                                                                                                                                                                                         |
| `specs/uid-strategies`             | Each of the three strategy typenames.                                                                  | Maps to `uuid`, `dynamic`, and `single`, respectively. The strategy affects module loading and extension UID writes.                                                                                                                                  |
| `specs/unknown-uid-strategy`       | Unrecognized typename.                                                                                 | Falls back to `uuid`; this is a forward-compatibility case outside the generated union.                                                                                                                                                               |
| `specs/identifier-aliases`         | `theme_app_extension`, `subscription_management`, `checkout_post_purchase`, or `webhook_subscription`. | Applies the identifier/surface overrides. Webhook subscriptions become configuration specs with a dynamic UID strategy.                                                                                                                               |
| `specs/metadata`                   | Different name, external identifier, registration limit, features, or `isClientProvided`.              | Merged name/identifier/limit can change metadata. `features` and `isClientProvided` are not carried through this API mapper.                                                                                                                          |
| `specs/bad-json-schema`            | Invalid JSON string, unresolved reference, or schema Ajv cannot compile.                               | Can throw during specification loading. This is not necessarily a collected local validation error.                                                                                                                                                   |
| `specs/external-reference`         | Fetched specification contract contains an external `$ref`.                                            | This contract normalizer disables external resolution. Test rejection where the reference cannot be compiled. The separate N9 tools/intent compiler does allow external references.                                                                   |
| `specs/malformed-response`         | Null/missing specifications, null list entry, or missing `uidStrategy`.                                | Mapping can throw; there is no response validation or fallback to local-only loading.                                                                                                                                                                 |
| `specs/duplicate-identifiers`      | Repeated identifier, with equal or conflicting contracts.                                              | The merge does not deduplicate specs. Check first-match selection, validator-cache reuse, and duplicate module errors.                                                                                                                                |
| `specs/changed-during-link`        | Different first and second specification responses.                                                    | Linking and final loading can disagree. Assert both the written TOML and final outcome.                                                                                                                                                               |

Unknown-property handling also needs fixtures: extension contracts use `fail`; configuration contracts use `strip`. See [json-schema.ts](/packages/cli-kit/src/public/node/json-schema.ts). Its validator cache is keyed by specification identifier, so isolate cases that use different schemas for the same identifier. A same-process schema-change regression test should leave the cache intact deliberately.

## Conditional linking calls

These calls belong to the shared link/create flow, reached explicitly or through a command's implicit linking path. A linked-context load with a known client ID does not need selection/creation. That is not a prohibition on other commands intentionally listing organizations or apps.

### N5: `ListOrganizations`

**Endpoint:** Business Platform. **Variables:** none. The query filters access to destination `APPS_CLI`. **Cache:** none.

Sources: [organization fetching](/packages/organizations/src/cli/services/fetch.ts), [generated type](/packages/organizations/src/cli/api/graphql/business-platform-destinations/generated/organizations.ts), [organization prompt](/packages/organizations/src/cli/prompts/organization.ts).

```ts
type ListOrganizationsData = {
  currentUserAccount?: {
    uuid: string
    organizationsWithAccessToDestination: {
      nodes: Array<{id: string; name: string}>
    }
  } | null
}
```

| Fixture                   | Response variation                                        | Expected behavior                                         |
| ------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `organizations/none`      | No account, or `nodes: []`.                               | App linking's `fetchOrganizations()` throws `NoOrgError`. |
| `organizations/one`       | One accessible organization.                              | Selects it without an organization-choice prompt.         |
| `organizations/many`      | Several organizations, including duplicate names.         | Prompts; duplicate names include IDs in the choices.      |
| `organizations/bad-id`    | ID cannot be decoded as an encoded GID with a numeric ID. | Throws `Failed to decode organization ID from: …`.        |
| `organizations/malformed` | Account present but connection/nodes missing or null.     | Mapping fails rather than treating the list as empty.     |

This package obtains credentials with `ensureAuthenticatedBusinessPlatform()`, not the App Management client's combined automation-token path. Its 401 handler calls that function again without `forceRefresh`. Keep organization selection with only an automation token, and a rejected-but-locally-valid token, as distinct auth-boundary tests. Do not assume they behave like N3.

### N6: `listApps`

**Endpoint:** App Management. **When:** initial app selection and subsequent search. The query asks for the first 50 apps and exposes `hasNextPage`, not a cursor.

The caller sends `{organizationId, query}`. The generated operation declares only `$query`; `organizationId` is an extra variable in the current request, not a declared GraphQL filter. Search text `red blue` becomes `title:red title:blue`.

Sources: [appsForOrg](/packages/app/src/cli/utilities/developer-platform-client/app-management-client.ts), [generated type](/packages/app/src/cli/api/graphql/app-management/generated/apps.ts), [app selection](/packages/app/src/cli/services/dev/select-app.ts), [search adapter](/packages/app/src/cli/services/dev/prompt-helpers.ts).

```ts
type ListAppsData = {
  appsConnection?: {
    edges: Array<{
      node: {
        id: string
        key: string
        activeRelease: {id: string; version: {name: string}}
      }
    }>
    pageInfo: {hasNextPage: boolean}
  } | null
}
```

| Fixture                            | Response variation                                                    | Expected behavior                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/empty`                       | `edges: []`.                                                          | Starts app creation rather than existing-app selection.                                                                    |
| `apps/available`                   | One or several apps; `hasNextPage: false`.                            | Offers create/select flow; selected app gets a full N2 lookup.                                                             |
| `apps/more-results`                | `hasNextPage: true`.                                                  | Passes that flag to the search prompt. There is no automatic cursor-pagination loop in this client.                        |
| `apps/search`                      | Several responses for distinct search terms, including empty results. | Repeats this operation with transformed search text.                                                                       |
| `apps/no-connection`               | Connection null or omitted.                                           | Throws `BugError: Server failed to retrieve apps`.                                                                         |
| `apps/disappeared-after-selection` | List includes app; subsequent N2 has no app.                          | Selection can run twice, then throws the selection-failed `BugError`. A thrown network error during N2 propagates instead. |
| `apps/malformed`                   | Missing page info, null edge/node, or missing release/version.        | Mapping/access fails.                                                                                                      |

Organization detail and initial app listing run through `Promise.all`. Fixtures should match requests independently of arrival order and allow an already-started sibling request when one fails.

### N7: `publicApiVersions`

**Endpoint:** Webhooks, scoped to the selected organization. **Variables:** `{}`. **When:** creating an app. **Cache:** none.

Sources: [createApp and apiVersions](/packages/app/src/cli/utilities/developer-platform-client/app-management-client.ts), [generated type](/packages/app/src/cli/api/graphql/webhooks/generated/public-api-versions.ts).

```ts
type PublicApiVersionsData = {
  publicApiVersions: Array<{handle: string}>
}
```

| Fixture                          | Response variation                         | Expected behavior                                                                            |
| -------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `api-versions/stable`            | Several version handles plus `unstable`.   | Removes `unstable`, sorts strings, and uses the last value in the app-create webhook module. |
| `api-versions/empty`             | Empty list or only `unstable`.             | Uses `unstable`.                                                                             |
| `api-versions/unexpected-handle` | A non-date string.                         | No semantic version validation here; string sorting still determines the selected value.     |
| `api-versions/failure`           | Transport/GraphQL error or malformed list. | App creation does not proceed.                                                               |

### N8: `CreateApp`

**Endpoint:** App Management. **When:** the user chooses to create an app, or the selected organization has no apps. **Cache:** none.

Variables contain `organizationId: "gid://shopify/Organization/{id}"` and `initialVersion.source`. The source contains the chosen name and default `app_home`, `branding`, `webhooks`, and `app_access` modules. Local creation defaults and N7 determine their values.

Sources: [createApp and createAppVars](/packages/app/src/cli/utilities/developer-platform-client/app-management-client.ts), [generated type](/packages/app/src/cli/api/graphql/app-management/generated/create-app.ts).

```ts
type CreateAppData = {
  appCreate: {
    app?: {
      id: string
      key: string
      activeRoot: {clientCredentials: {secrets: Array<{key: string}>}}
    } | null
    userErrors: Array<{
      category: string
      message: string
      on: {[key: string]: JsonValue}
    }>
  }
}
```

| Fixture                   | Response variation                                                       | Expected behavior                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `create/success`          | App present, `userErrors: []`.                                           | Marks the app as new and continues linking. Later N2 obtains its release configuration.                                         |
| `create/user-errors`      | One or several user errors, with or without an app.                      | Throws `AbortError` with messages joined by `, `. Category and `on` do not control this branch.                                 |
| `create/no-app-no-errors` | App null, empty errors.                                                  | Takes the error branch with an empty joined message.                                                                            |
| `create/no-secrets`       | App with empty secret list.                                              | Creation succeeds; later consumers must use the subsequent app lookup's secret list.                                            |
| `create/malformed`        | Missing `appCreate`, missing `userErrors`, or malformed app credentials. | Can throw during response access.                                                                                               |
| `create/response-lost`    | Server commits creation, then the connection drops.                      | Shared network retry can resend the mutation. The caller supplies no explicit idempotency key; test duplicate-side-effect risk. |
| `create/later-link-fails` | Creation succeeds; specifications, release fetch, or local write fails.  | No remote rollback is performed by this flow.                                                                                   |

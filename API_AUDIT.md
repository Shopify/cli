# Shopify CLI API Audit

> **Generated:** 2026-02-09
> **Scope:** All packages in the Shopify CLI monorepo
> **Purpose:** Document every external API call, service integration, and network request to inform a unified API call pattern

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [API Services Inventory](#api-services-inventory)
3. [Shopify GraphQL API Services](#shopify-graphql-api-services)
   - [Admin API](#1-admin-api)
   - [Partners API](#2-partners-api)
   - [App Management API](#3-app-management-api)
   - [App Dev API](#4-app-dev-api)
   - [Business Platform API](#5-business-platform-api)
   - [Functions API](#6-functions-api)
   - [Webhooks API](#7-webhooks-api)
4. [Shopify REST / HTTP Services](#shopify-rest--http-services)
   - [Admin REST API](#8-admin-rest-api)
   - [Storefront Rendering API](#9-storefront-rendering-api)
   - [Theme Kit Access Proxy](#10-theme-kit-access-proxy)
   - [App Logs Polling](#11-app-logs-polling)
5. [Authentication & Identity Services](#authentication--identity-services)
   - [Identity OAuth](#12-identity-oauth)
6. [Telemetry & Observability Services](#telemetry--observability-services)
   - [Monorail Analytics](#13-monorail-analytics)
   - [Bugsnag Error Reporting](#14-bugsnag-error-reporting)
   - [OpenTelemetry](#15-opentelemetry-otel)
7. [CDN & Static Asset Services](#cdn--static-asset-services)
   - [Shopify CDN](#16-shopify-cdn)
   - [unpkg CDN](#17-unpkg-cdn)
8. [Third-Party Services](#third-party-services)
   - [GitHub API & Downloads](#18-github-api--downloads)
   - [npm Registry](#19-npm-registry)
   - [Cloudflare Releases](#20-cloudflare-releases)
9. [Real-Time Communication](#real-time-communication)
   - [WebSocket (UI Extensions)](#21-websocket-ui-extensions)
   - [Server-Sent Events (Theme Hot-Reload)](#22-server-sent-events-theme-hot-reload)
10. [Miscellaneous HTTP Calls](#miscellaneous-http-calls)
    - [shopify.dev Search](#23-shopifydev-search)
    - [Storefront Password Verification](#24-storefront-password-verification)
11. [GraphQL Operations Catalog](#graphql-operations-catalog)
12. [API Client Infrastructure](#api-client-infrastructure)
13. [Authentication Flow Reference](#authentication-flow-reference)
14. [Environment Variables Reference](#environment-variables-reference)

---

## Executive Summary

The Shopify CLI makes network calls to **25 distinct external services**. The dominant pattern is **typed GraphQL** via a centralized client in `cli-kit`, but the codebase also contains REST calls, raw `fetch()` calls, CDN downloads, WebSocket connections, and SSE streams.

**Key findings:**
- **7 Shopify GraphQL APIs** with ~60+ distinct operations
- **4 Shopify REST/HTTP endpoints** for admin, storefront rendering, theme access proxy, and app logs
- **1 OAuth/Identity service** with device authorization and token exchange flows
- **3 telemetry/observability services** (Monorail, Bugsnag, OTEL)
- **5 CDN endpoints** for static assets, notifications, templates, WASM binaries, and binaryen optimizer
- **3 third-party services** (GitHub, npm, Cloudflare)
- **2 real-time protocols** (WebSocket, SSE)
- **2 DeveloperPlatformClient implementations** (`PartnersClient`, `AppManagementClient`) with a common interface

All GraphQL APIs use a shared `graphqlRequestDoc()` / `graphqlRequest()` infrastructure in `cli-kit` with:
- Rate limiting via Bottleneck (10 req/sec for most services)
- Automatic token refresh on 401
- Configurable retry with exponential backoff
- Response caching with TTL
- Debug logging with sensitive-data masking

---

## API Services Inventory

| # | Service | Protocol | Base URL | Auth | Package(s) |
|---|---------|----------|----------|------|------------|
| 1 | Admin API (GraphQL) | GraphQL | `https://{store}/admin/api/{version}/graphql.json` | Admin Token | cli-kit, app, theme |
| 2 | Partners API | GraphQL | `https://partners.shopify.com/api/cli/graphql` | Partners Token | cli-kit, app |
| 3 | App Management API | GraphQL | `https://app.shopify.com/app_management/unstable/graphql.json` | App Mgmt Token | cli-kit, app |
| 4 | App Dev API | GraphQL | `https://{store}/app_dev/unstable/graphql.json` | App Dev Token | cli-kit, app |
| 5 | Business Platform (Destinations) | GraphQL | `https://destinations.shopifysvc.com/destinations/api/2020-07/graphql` | BP Token | cli-kit, app |
| 6 | Business Platform (Organizations) | GraphQL | `https://destinations.shopifysvc.com/organizations/api/unstable/organization/{orgId}/graphql` | BP Token | cli-kit, app |
| 7 | Functions API | GraphQL | `https://app.shopify.com/functions/unstable/organizations/{orgId}/{appId}/graphql` | Org Token | cli-kit, app |
| 8 | Webhooks API | GraphQL | `https://app.shopify.com/webhooks/unstable/organizations/{orgId}/graphql.json` | Org Token | cli-kit, app |
| 9 | Admin REST API | REST | `https://{store}/admin/api/{version}/{resource}.json` | Admin Token | cli-kit, theme |
| 10 | Storefront Rendering | REST | `https://{store}/...` or Theme Access proxy | Session Cookies | theme |
| 11 | Theme Kit Access Proxy | REST | `https://theme-kit-access.shopifyapps.com/cli/...` | Theme Token (shptka_) | cli-kit, theme |
| 12 | App Logs Polling (Partners) | REST | `https://partners.shopify.com/app_logs/poll` | Partners Token | cli-kit, app |
| 13 | App Logs Polling (App Mgmt) | REST | `https://app.shopify.com/app_management/unstable/organizations/{orgId}/app_logs/poll` | App Mgmt Token | cli-kit, app |
| 14 | Identity / OAuth | REST | `https://accounts.shopify.com/oauth/...` | Client ID | cli-kit |
| 15 | Monorail Analytics | REST | `https://monorail-edge.shopifysvc.com/v1/produce` | None | cli-kit |
| 16 | Bugsnag | REST | Bugsnag SDK endpoint | API Key | cli-kit |
| 17 | OpenTelemetry | gRPC/HTTP | Configurable via env var | None | cli-kit |
| 18 | Shopify CDN | HTTP GET | `https://cdn.shopify.com/static/...` | None | cli-kit, app |
| 19 | unpkg CDN | HTTP GET | `https://unpkg.com/...` | None | theme |
| 20 | jsDelivr CDN | HTTP GET | `https://cdn.jsdelivr.net/npm/...` | None | app |
| 21 | GitHub API | REST | `https://api.github.com/repos/...` | None | cli-kit |
| 22 | GitHub Downloads | HTTP GET | `https://codeload.github.com/...`, `https://raw.githubusercontent.com/...` | None | app |
| 23 | npm Registry | HTTP GET | `https://registry.npmjs.org/...` | None | cli-kit |
| 24 | Cloudflare Releases | HTTP GET | `https://github.com/cloudflare/cloudflared/releases/...` | None | plugin-cloudflare |
| 25 | Notifications CDN | HTTP GET | `https://cdn.shopify.com/static/cli/notifications.json` | None | cli-kit |

---

## Shopify GraphQL API Services

### 1. Admin API

**Endpoint:** `https://{storeFqdn}/admin/api/{version}/graphql.json`
**Alt Endpoint (Theme Access):** `https://theme-kit-access.shopifyapps.com/cli/admin/api/{version}/graphql.json`
**Auth:** Admin token or Theme Access token (prefix: `shptka_`)
**Rate Limit:** Store-level (40 requests/30 seconds for REST; cost-based for GraphQL)

#### Client Infrastructure

| File | Function | Description |
|------|----------|-------------|
| `packages/cli-kit/src/public/node/api/admin.ts` | `adminRequest<T>()` | Untyped GraphQL query |
| `packages/cli-kit/src/public/node/api/admin.ts` | `adminRequestDoc<TResult, TVariables>()` | Typed GraphQL query with document nodes |
| `packages/cli-kit/src/public/node/api/admin.ts` | `restRequest<T>()` | REST API request |
| `packages/cli-kit/src/public/node/api/admin.ts` | `supportedApiVersions()` | Fetch available API versions |
| `packages/cli-kit/src/public/node/api/admin.ts` | `fetchLatestSupportedApiVersion()` | Get latest supported version |
| `packages/cli-kit/src/public/node/themes/api.ts` | Theme-specific wrappers | CRUD for themes, files, metafields |

#### GraphQL Operations (cli-kit - Themes)

| Operation | Type | File | Purpose |
|-----------|------|------|---------|
| `getThemes` | Query | `cli-kit/src/cli/api/graphql/admin/queries/get_themes.graphql` | List all themes (paginated, 50/page) |
| `getTheme` | Query | `cli-kit/src/cli/api/graphql/admin/queries/get_theme.graphql` | Fetch single theme by ID |
| `getThemeFileChecksums` | Query | `cli-kit/src/cli/api/graphql/admin/queries/get_theme_file_checksums.graphql` | Get file checksums for sync |
| `getThemeFileBodies` | Query | `cli-kit/src/cli/api/graphql/admin/queries/get_theme_file_bodies.graphql` | Retrieve theme file contents |
| `publicApiVersions` | Query | `cli-kit/src/cli/api/graphql/admin/queries/public_api_versions.graphql` | List all API versions |
| `metafieldDefinitionsByOwnerType` | Query | `cli-kit/src/cli/api/graphql/admin/queries/metafield_definitions_by_owner_type.graphql` | Fetch metafield schema |
| `onlineStorePasswordProtection` | Query | `cli-kit/src/cli/api/graphql/admin/queries/online_store_password_protection.graphql` | Check store password protection |
| `themeCreate` | Mutation | `cli-kit/src/cli/api/graphql/admin/mutations/theme_create.graphql` | Create new theme |
| `themeDelete` | Mutation | `cli-kit/src/cli/api/graphql/admin/mutations/theme_delete.graphql` | Delete theme |
| `themeDuplicate` | Mutation | `cli-kit/src/cli/api/graphql/admin/mutations/theme_duplicate.graphql` | Duplicate theme |
| `themeUpdate` | Mutation | `cli-kit/src/cli/api/graphql/admin/mutations/theme_update.graphql` | Update theme metadata |
| `themePublish` | Mutation | `cli-kit/src/cli/api/graphql/admin/mutations/theme_publish.graphql` | Publish theme as live |
| `themeFilesUpsert` | Mutation | `cli-kit/src/cli/api/graphql/admin/mutations/theme_files_upsert.graphql` | Batch create/update files |
| `themeFilesDelete` | Mutation | `cli-kit/src/cli/api/graphql/admin/mutations/theme_files_delete.graphql` | Batch delete files |

#### GraphQL Operations (app - Bulk Operations)

| Operation | Type | File | Purpose |
|-----------|------|------|---------|
| `BulkOperationRunQuery` | Mutation | `app/src/cli/api/graphql/bulk-operations/mutations/bulk-operation-run-query.graphql` | Run bulk query |
| `BulkOperationRunMutation` | Mutation | `app/src/cli/api/graphql/bulk-operations/mutations/bulk-operation-run-mutation.graphql` | Run bulk mutation |
| `BulkOperationCancel` | Mutation | `app/src/cli/api/graphql/bulk-operations/mutations/bulk-operation-cancel.graphql` | Cancel bulk operation |
| `GetBulkOperationById` | Query | `app/src/cli/api/graphql/bulk-operations/queries/get-bulk-operation-by-id.graphql` | Poll bulk op status |
| `ListBulkOperations` | Query | `app/src/cli/api/graphql/bulk-operations/queries/list-bulk-operations.graphql` | List bulk operations |
| `StagedUploadsCreate` | Mutation | `app/src/cli/api/graphql/bulk-operations/mutations/staged-uploads-create.graphql` | Generate signed upload URLs |

#### GraphQL Operations (app - Metafields)

| Operation | Type | File | Purpose |
|-----------|------|------|---------|
| `metafieldDefinitions` | Query | `app/src/cli/api/graphql/admin/queries/metafield_definitions.graphql` | List metafield definitions |
| `metaobjectDefinitions` | Query | `app/src/cli/api/graphql/admin/queries/metaobject_definitions.graphql` | List metaobject definitions |

---

### 2. Partners API

**Endpoint:** `https://partners.shopify.com/api/cli/graphql`
**Auth:** Partners token (via device auth or `SHOPIFY_CLI_PARTNERS_TOKEN` env var)
**Rate Limit:** 10 req/sec (Bottleneck: 150ms min interval, 10 concurrent)
**Client:** `PartnersClient` in `packages/app/src/cli/utilities/developer-platform-client/partners-client.ts`

#### Client Infrastructure

| File | Function | Description |
|------|----------|-------------|
| `packages/cli-kit/src/public/node/api/partners.ts` | `partnersRequest<T>()` | Untyped GraphQL query |
| `packages/cli-kit/src/public/node/api/partners.ts` | `partnersRequestDoc<TResult, TVariables>()` | Typed GraphQL query |
| `packages/cli-kit/src/public/node/api/partners.ts` | `generateFetchAppLogUrl()` | Build app logs polling URL |

#### GraphQL Operations

| Operation | Type | File | Purpose |
|-----------|------|------|---------|
| `currentAccountInfo` | Query | `app/src/cli/api/graphql/partners/queries/current-account-info.graphql` | Get account info (user or service) |
| `organizations` | Query | `app/src/cli/api/graphql/partners/generated/all-orgs.ts` | List all organizations |
| `devStoresByOrg` | Query | `app/src/cli/api/graphql/partners/generated/dev-stores-by-org.ts` | List dev stores in org |
| `extensionUpdateDraft` | Mutation | `app/src/cli/api/graphql/partners/queries/update-draft.graphql` | Update extension draft |
| `allAppExtensionRegistrations` | Query | `app/src/cli/api/graphql/all_app_extension_registrations.ts` | List all extension registrations |
| `ExtensionCreate` | Mutation | `app/src/cli/api/graphql/extension_create.ts` | Register new extension |
| `ExtensionSpecifications` | Query | `app/src/cli/api/graphql/extension_specifications.ts` | Fetch extension types/specs |
| `MigrateFlowExtension` | Mutation | `app/src/cli/api/graphql/extension_migrate_flow_extension.ts` | Migrate Flow extension |
| `MigrateToUiExtension` | Mutation | `app/src/cli/api/graphql/extension_migrate_to_ui_extension.ts` | Migrate to UI Extension |
| `MigrateAppModule` | Mutation | `app/src/cli/api/graphql/extension_migrate_app_module.ts` | Migrate app module |
| `AppDeploy` | Mutation | `app/src/cli/api/graphql/app_deploy.ts` | Deploy app version |
| `AppRelease` | Mutation | `app/src/cli/api/graphql/app_release.ts` | Release version to prod |
| `UpdateURLs` | Mutation | `app/src/cli/api/graphql/update_urls.ts` | Update app URLs |
| `GenerateSignedUploadUrl` | Query | `app/src/cli/api/graphql/generate_signed_upload_url.ts` | Generate S3 bundle upload URL |
| `TemplateSpecifications` | Query | `app/src/cli/api/graphql/template_specifications.ts` | Fetch extension templates |
| `FindOrganization` | Query | `app/src/cli/api/graphql/find_org.ts` | Lookup org with app search |
| `FindOrgBasic` | Query | `app/src/cli/api/graphql/find_org_basic.ts` | Basic org lookup |
| `FindApp` | Query | `app/src/cli/api/graphql/find_app.ts` | Lookup app by API key |
| `FindStoreByDomain` | Query | `app/src/cli/api/graphql/find_store_by_domain.ts` | Lookup store by domain |
| `AppVersionsQuery` | Query | `app/src/cli/api/graphql/get_versions_list.ts` | List app versions |
| `AppVersionsDiff` | Query | `app/src/cli/api/graphql/app_versions_diff.ts` | Compare two versions |
| `AppActiveVersion` | Query | `app/src/cli/api/graphql/app_active_version.ts` | Get active version |
| `AppVersionByTag` | Query | `app/src/cli/api/graphql/app_version_by_tag.ts` | Get version by tag |
| `FindAppPreviewMode` | Query | `app/src/cli/api/graphql/find_app_preview_mode.ts` | Check preview mode |
| `DevelopmentStorePreviewUpdate` | Mutation | `app/src/cli/api/graphql/development_preview.ts` | Toggle dev store preview |
| `ConvertDevToTransferDisabled` | Mutation | `app/src/cli/api/graphql/convert_dev_to_transfer_disabled_store.ts` | Convert store type |
| `AppLogsSubscribe` | Mutation | `app/src/cli/api/graphql/subscribe_to_app_logs.ts` | Get JWT for logs WebSocket |
| `sendSampleWebhook` | Mutation | `app/src/cli/services/webhook/request-sample.ts` | Trigger sample webhook |

---

### 3. App Management API

**Endpoint:** `https://app.shopify.com/app_management/unstable/graphql.json`
**Auth:** App Management token (via token exchange)
**Rate Limit:** 10 req/sec (Bottleneck)
**Client:** `AppManagementClient` in `packages/app/src/cli/utilities/developer-platform-client/app-management-client.ts`

#### Client Infrastructure

| File | Function | Description |
|------|----------|-------------|
| `packages/cli-kit/src/public/node/api/app-management.ts` | `appManagementRequestDoc<TResult, TVariables>()` | Typed GraphQL query |
| `packages/cli-kit/src/public/node/api/app-management.ts` | `appManagementHeaders()` | Build auth headers |
| `packages/cli-kit/src/public/node/api/app-management.ts` | `appManagementAppLogsUrl()` | Build logs polling URL |

#### GraphQL Operations

| Operation | Type | File | Purpose |
|-----------|------|------|---------|
| `ActiveAppRelease` | Query | `app/src/cli/api/graphql/app-management/queries/active-app-release.graphql` | Get active release + modules |
| `ActiveAppReleaseFromApiKey` | Query | `app/src/cli/api/graphql/app-management/queries/active-app-release-from-api-key.graphql` | Active release by API key |
| `AppVersionById` | Query | `app/src/cli/api/graphql/app-management/queries/app-version-by-id.graphql` | Get specific version |
| `AppVersionByTag` | Query | `app/src/cli/api/graphql/app-management/queries/app-version-by-tag.graphql` | Get version by tag |
| `AppVersions` | Query | `app/src/cli/api/graphql/app-management/queries/app-versions.graphql` | List versions (paginated) |
| `Apps` | Query | `app/src/cli/api/graphql/app-management/queries/apps.graphql` | List apps in org |
| `CreateApp` | Mutation | `app/src/cli/api/graphql/app-management/queries/create-app.graphql` | Create new app |
| `CreateAppVersion` | Mutation | `app/src/cli/api/graphql/app-management/queries/create-app-version.graphql` | Create new version |
| `ReleaseVersion` | Mutation | `app/src/cli/api/graphql/app-management/queries/release-version.graphql` | Release to production |
| `Specifications` | Query | `app/src/cli/api/graphql/app-management/queries/specifications.graphql` | Fetch extension specs |
| `CreateAssetUrl` | Query | `app/src/cli/api/graphql/app-management/queries/create-asset-url.graphql` | Get signed upload URL |
| `AppLogsSubscribe` | Mutation | `app/src/cli/api/graphql/app-management/queries/app-logs-subscribe.graphql` | Subscribe to app logs |

---

### 4. App Dev API

**Endpoint:** `https://{storeFqdn}/app_dev/unstable/graphql.json`
**Auth:** App Dev token
**Rate Limit:** 10 req/sec (Bottleneck)

#### Client Infrastructure

| File | Function |
|------|----------|
| `packages/cli-kit/src/public/node/api/app-dev.ts` | `appDevRequestDoc<TResult, TVariables>()` |

#### GraphQL Operations

| Operation | Type | File | Purpose |
|-----------|------|------|---------|
| `DevSessionCreate` | Mutation | `app/src/cli/api/graphql/app-dev/queries/dev-session-create.graphql` | Create dev session |
| `DevSessionUpdate` | Mutation | `app/src/cli/api/graphql/app-dev/queries/dev-session-update.graphql` | Update session manifest |
| `DevSessionDelete` | Mutation | `app/src/cli/api/graphql/app-dev/queries/dev-session-delete.graphql` | Teardown dev session |

---

### 5. Business Platform API

**Destinations Endpoint:** `https://destinations.shopifysvc.com/destinations/api/2020-07/graphql`
**Organizations Endpoint:** `https://destinations.shopifysvc.com/organizations/api/unstable/organization/{orgId}/graphql`
**Auth:** Business Platform token (via token exchange)

#### Client Infrastructure

| File | Function |
|------|----------|
| `packages/cli-kit/src/public/node/api/business-platform.ts` | `businessPlatformRequest<T>()` |
| `packages/cli-kit/src/public/node/api/business-platform.ts` | `businessPlatformRequestDoc<TResult, TVariables>()` |
| `packages/cli-kit/src/public/node/api/business-platform.ts` | `businessPlatformOrganizationsRequest<T>()` |
| `packages/cli-kit/src/public/node/api/business-platform.ts` | `businessPlatformOrganizationsRequestDoc<TResult, TVariables>()` |

#### GraphQL Operations

| Operation | Type | File | Purpose |
|-----------|------|------|---------|
| `UserEmail` | Query | `cli-kit/src/private/node/api/graphql/business-platform-destinations/user-email.ts` | Get authenticated user email |
| `FindOrganizations` | Query | `app/src/cli/api/graphql/business-platform-destinations/queries/find-organizations.graphql` | Find org by ID |
| `Organizations` | Query | `app/src/cli/api/graphql/business-platform-destinations/generated/organizations.ts` | List user orgs |
| `UserInfo` | Query | `app/src/cli/api/graphql/business-platform-destinations/generated/user-info.ts` | Get user info |
| `ListAppDevStores` | Query | `app/src/cli/api/graphql/business-platform-organizations/queries/list_app_dev_stores.graphql` | List dev stores |
| `FetchStoreByDomain` | Query | `app/src/cli/api/graphql/business-platform-organizations/queries/fetch_store_by_domain.graphql` | Lookup store by domain |
| `ProvisionShopAccess` | Mutation | `app/src/cli/api/graphql/business-platform-organizations/queries/provision_shop_access.graphql` | Grant store access |
| `OrganizationExpFlags` | Query | `app/src/cli/api/graphql/business-platform-organizations/generated/organization_exp_flags.ts` | Fetch feature flags |

---

### 6. Functions API

**Endpoint:** `https://app.shopify.com/functions/unstable/organizations/{orgId}/{appId}/graphql`
**Auth:** Organization token
**Rate Limit:** 10 req/sec (Bottleneck)

#### Client Infrastructure

| File | Function |
|------|----------|
| `packages/cli-kit/src/public/node/api/functions.ts` | `functionsRequestDoc<TResult, TVariables>()` |

#### GraphQL Operations

| Operation | Type | File | Purpose |
|-----------|------|------|---------|
| `SchemaDefinitionByTarget` | Query | `app/src/cli/api/graphql/functions/queries/schema-definition-by-target.graphql` | Get function target schema |
| `SchemaDefinitionByApiType` | Query | `app/src/cli/api/graphql/functions/queries/schema-definition-by-api-type.graphql` | Get API type schema |

---

### 7. Webhooks API

**Endpoint:** `https://app.shopify.com/webhooks/unstable/organizations/{orgId}/graphql.json`
**Auth:** Organization token
**Rate Limit:** 10 req/sec (Bottleneck)

#### Client Infrastructure

| File | Function |
|------|----------|
| `packages/cli-kit/src/public/node/api/webhooks.ts` | `webhooksRequestDoc<TResult, TVariables>()` |

#### GraphQL Operations

| Operation | Type | File | Purpose |
|-----------|------|------|---------|
| `availableTopics` | Query | `app/src/cli/api/graphql/webhooks/queries/available-topics.graphql` | List webhook topics for API version |
| `publicApiVersions` | Query | `app/src/cli/api/graphql/webhooks/queries/public-api-versions.graphql` | List available API versions |
| `cliTesting` | Query | `app/src/cli/api/graphql/webhooks/queries/cli-testing.graphql` | Test webhook delivery |

---

## Shopify REST / HTTP Services

### 8. Admin REST API

**Endpoint:** `https://{storeFqdn}/admin/api/{version}/{resource}.json`
**Auth:** Admin token (`X-Shopify-Access-Token` header)
**Rate Limit:** 40 requests/30 seconds (tracked via `x-shopify-shop-api-call-limit` header)
**Throttler:** `packages/cli-kit/src/public/node/api/rest-api-throttler.ts`

| File | Function | Description |
|------|----------|-------------|
| `packages/cli-kit/src/public/node/api/admin.ts` | `restRequest<T>()` | Generic REST request |
| `packages/cli-kit/src/public/node/api/rest-api-throttler.ts` | `throttle<T>()` | Rate-limit REST requests |
| `packages/cli-kit/src/public/node/api/rest-api-throttler.ts` | `delayAwareRetry()` | Honor `retry-after` header |

**Throttler constants:**
- `MAX_NUMBER_OF_PARALLEL_REQUESTS = 5`
- `MARGIN_TO_RATE_LIMIT = 5`
- `DELAY_FOR_TOO_MANY_PARALLEL_REQUESTS = 1000ms`
- `DELAY_FOR_TOO_CLOSE_TO_API_LIMIT = 4000ms`

---

### 9. Storefront Rendering API

**Endpoint:** `https://{storeFqdn}/...` (HTML rendering requests) or `https://{themeKitAccessDomain}/cli/sfr` (Theme Access)
**Auth:** Session cookies + admin token headers
**Method:** POST/GET

| File | Purpose |
|------|---------|
| `packages/theme/src/cli/utilities/theme-environment/storefront-renderer.ts` | Render storefront with template replacements |
| `packages/theme/src/cli/utilities/theme-environment/proxy.ts` | Proxy and rewrite URLs for local dev |
| `packages/theme/src/cli/utilities/theme-environment/storefront-utils.ts` | Build storefront query parameters |

---

### 10. Theme Kit Access Proxy

**Endpoint:** `https://theme-kit-access.shopifyapps.com/cli/admin/api/{version}/graphql.json`
**Auth:** Theme Access token (prefix: `shptka_`)
**Headers:** `X-Shopify-Shop: {storeFqdn}`, `X-Shopify-Access-Token: {token}`

| File | Purpose |
|------|---------|
| `packages/cli-kit/src/private/node/api/rest.ts` | Detect Theme Access sessions, build proxy URLs |
| `packages/theme/src/cli/utilities/theme-environment/storefront-renderer.ts` | Route SFR calls through proxy |

---

### 11. App Logs Polling

**Partners Endpoint:** `https://partners.shopify.com/app_logs/poll`
**App Management Endpoint:** `https://app.shopify.com/app_management/unstable/organizations/{orgId}/app_logs/poll`
**Auth:** JWT token (from `AppLogsSubscribe` mutation)

| File | Purpose |
|------|---------|
| `packages/cli-kit/src/public/node/api/partners.ts` | `generateFetchAppLogUrl()` |
| `packages/cli-kit/src/public/node/api/app-management.ts` | `appManagementAppLogsUrl()` |
| `packages/app/src/cli/services/app-logs/dev/poll-app-logs.ts` | Polling loop |
| `packages/app/src/cli/services/app-logs/utils.ts` | JWT management, response parsing |

**Polling intervals:**
- Normal: `450ms`
- Error retry: `5000ms`
- Rate limit (429): `60000ms`

---

## Authentication & Identity Services

### 12. Identity OAuth

**Endpoint:** `https://accounts.shopify.com/oauth/...`
**Auth:** Client ID + various grant types

| File | Flow | Endpoint |
|------|------|----------|
| `cli-kit/src/private/node/session/device-authorization.ts` | Device Authorization | `POST /oauth/device_authorization` |
| `cli-kit/src/private/node/session/exchange.ts` | Token Exchange | `POST /oauth/token` (grant_type: `urn:ietf:params:oauth:grant-type:token-exchange`) |
| `cli-kit/src/private/node/session/exchange.ts` | Token Refresh | `POST /oauth/token` (grant_type: `refresh_token`) |
| `cli-kit/src/private/node/session/exchange.ts` | Custom CLI Token | `POST /oauth/token` (custom partner token exchange) |

**OAuth Scopes** (defined in `cli-kit/src/private/node/session/scopes.ts`):

| API | Scopes |
|-----|--------|
| Admin | `https://api.shopify.com/auth/shop.admin.graphql`, `https://api.shopify.com/auth/shop.admin.themes`, `https://api.shopify.com/auth/partners.collaborator-relationships.readonly` |
| Storefront Renderer | `https://api.shopify.com/auth/shop.storefront-renderer.devtools` |
| Partners | `https://api.shopify.com/auth/partners.app.cli.access` |
| Business Platform | `https://api.shopify.com/auth/destinations.readonly`, `https://api.shopify.com/auth/organization.store-management`, `https://api.shopify.com/auth/organization.on-demand-user-access` |
| App Management | `https://api.shopify.com/auth/organization.apps.manage` |

**Application IDs** (defined in `cli-kit/src/private/node/session/identity.ts`):

| API | Production ID |
|-----|---------------|
| Admin | `7ee65a63...` |
| Partners | `271e16d4...` |
| Storefront Renderer | `ee139b3d-5861-4d45-b387-1bc3ada7811c` |
| Business Platform | `32ff8ee5-82b8-4d93-9f8a-c6997cefb7dc` |
| App Management | `7ee65a63...` (same as Admin) |

---

## Telemetry & Observability Services

### 13. Monorail Analytics

**Endpoint:** `https://monorail-edge.shopifysvc.com/v1/produce`
**Topic:** `app_cli3_command/1.20`
**Auth:** None

| File | Function | Description |
|------|----------|-------------|
| `packages/cli-kit/src/public/node/monorail.ts` | `publishMonorailEvent()` | Send telemetry event |
| `packages/cli-kit/src/public/node/monorail.ts` | `reportAnalyticsEvent()` | High-level analytics reporting |

**Tracked data:** command name, timing metrics, success/failure, CLI version, project type, store hash, user ID, error messages.

---

### 14. Bugsnag Error Reporting

**Endpoints:**
- Notify: `https://error-analytics-production.shopifysvc.com`
- Sessions: `https://error-analytics-sessions-production.shopifysvc.com`
**Auth:** API Key (in `cli-kit/src/private/node/constants.ts`)

| File | Function | Description |
|------|----------|-------------|
| `packages/cli-kit/src/public/node/error-handler.ts` | `sendErrorToBugsnag()` | Report errors to Bugsnag |

**Behavior:** Reports unhandled errors and unexpected crashes. Rate-limited. Skipped for known/expected errors.

---

### 15. OpenTelemetry (OTEL)

**Default Endpoint:** `https://otlp-http-production-cli.shopifysvc.com`
**Override:** Configurable via `SHOPIFY_CLI_OTEL_EXPORTER_OTLP_ENDPOINT` env var
**Auth:** None (endpoint-dependent)

| File | Description |
|------|-------------|
| `packages/cli-kit/src/public/node/vendor/otel-js/service/DefaultOtelService/DefaultOtelService.ts` | OTEL service implementation |

---

## CDN & Static Asset Services

### 16. Shopify CDN

| URL | File | Purpose |
|-----|------|---------|
| `https://cdn.shopify.com/static/online-store/theme-skeleton.zip` | `cli-kit/src/public/node/themes/api.ts` | Default theme scaffold |
| `https://cdn.shopify.com/static/cli/notifications.json` | `cli-kit/src/public/node/notifications-system.ts` | CLI notifications |
| `https://cdn.shopify.com/static/cli/extensions/templates.json` | `app/src/cli/utilities/developer-platform-client/app-management-client.ts` | Extension templates |
| `https://cdn.shopify.com/shopifycloud/shopify-functions-javy-plugin/shopify_functions_javy_v{version}.wasm` | `app/src/cli/services/function/binaries.ts` | Javy WASM plugin for functions |

---

### 17. unpkg CDN

| URL | File | Purpose |
|-----|------|---------|
| `https://unpkg.com/@shopify/polaris@13.9.2/build/esm/styles.css` | `theme/src/cli/utilities/theme-environment/hot-reload/error-page.ts` | Polaris CSS for error pages |

---

### jsDelivr CDN

| URL | File | Purpose |
|-----|------|---------|
| `https://cdn.jsdelivr.net/npm/binaryen@{version}/bin/wasm-opt` | `app/src/cli/services/function/binaries.ts` | Binaryen WASM optimizer for Shopify Functions |

---

## Third-Party Services

### 18. GitHub API & Downloads

| URL Pattern | File | Purpose |
|-------------|------|---------|
| `https://api.github.com/repos/{owner}/{repo}/releases` | `cli-kit/src/public/node/github.ts` | Check release versions |
| `https://codeload.github.com/Shopify/{repo}/zip/refs/tags/{version}` | `app/src/cli/utilities/extensions/theme/host-theme-manager.ts` | Download Dawn theme ZIP |
| `https://raw.githubusercontent.com/{repo}/refs/tags/{version}/{path}` | `app/src/cli/utilities/mkcert.ts` | Download mkcert binaries/licenses |

---

### 19. npm Registry

| File | Function | Purpose |
|------|----------|---------|
| `packages/cli-kit/src/public/node/node-package-manager.ts` | `getLatestNPMPackageVersion()` | Check for CLI updates |

Uses the `latest-version` npm package which queries `https://registry.npmjs.org/`.

---

### 20. Cloudflare Releases

| URL Pattern | File | Purpose |
|-------------|------|---------|
| `https://github.com/cloudflare/cloudflared/releases/download/{version}/cloudflared-{platform}` | `packages/plugin-cloudflare/src/install-cloudflared.ts` | Download cloudflared tunnel binary |

**Version:** `2024.8.2`
**Platforms:** Linux (arm64/arm/x64/ia32), macOS (arm64/x64), Windows (x64/ia32/arm64)

---

## Real-Time Communication

### 21. WebSocket (UI Extensions)

| File | Protocol | Purpose |
|------|----------|---------|
| `packages/ui-extensions-dev-console/src/App.tsx` | `ws://` or `wss://` | Extension server real-time communication |
| `packages/ui-extensions-server-kit/src/ExtensionServerClient/` | WebSocket | Client library for extension server |

---

### 22. Server-Sent Events (Theme Hot-Reload)

| File | Protocol | Purpose |
|------|----------|---------|
| `packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts` | `text/event-stream` | Browser hot-reload notifications |

---

## Miscellaneous HTTP Calls

### 23. shopify.dev Search

| File | URL | Purpose |
|------|-----|---------|
| `packages/cli/src/cli/services/commands/search.ts` | `https://shopify.dev?search={query}` | Open documentation search in browser |

### 24. Storefront Password Verification

| File | Endpoint | Purpose |
|------|----------|---------|
| `packages/theme/src/cli/utilities/theme-environment/storefront-session.ts` | `POST https://{store}/password` | Verify storefront password |

---

## GraphQL Operations Catalog

Total distinct GraphQL operations across the codebase:

| API Service | Queries | Mutations | Total |
|-------------|---------|-----------|-------|
| Admin API (themes, cli-kit) | 7 | 7 | 14 |
| Admin API (bulk ops, app) | 2 | 4 | 6 |
| Admin API (metafields, app) | 2 | 0 | 2 |
| Partners API | ~12 | ~14 | ~26 |
| App Management API | 6 | 6 | 12 |
| App Dev API | 0 | 3 | 3 |
| Business Platform (Destinations) | 3 | 0 | 3 |
| Business Platform (Organizations) | 3 | 1 | 4 |
| Functions API | 2 | 0 | 2 |
| Webhooks API | 3 | 0 | 3 |
| **Total** | **~40** | **~35** | **~75** |

---

## API Client Infrastructure

### Core HTTP Layer

| File | Purpose |
|------|---------|
| `cli-kit/src/public/node/http.ts` | `fetch()`, `shopifyFetch()`, `downloadFile()`, `formData()` |
| `cli-kit/src/private/node/api/headers.ts` | `buildHeaders()`, `sanitizedHeadersOutput()`, `httpsAgent()` |
| `cli-kit/src/private/node/api/urls.ts` | `sanitizeURL()` (masks `subject_token`, `token` in query params) |
| `cli-kit/src/private/node/api/rest.ts` | `restRequestUrl()`, `restRequestHeaders()`, `isThemeAccessSession()` |
| `cli-kit/src/private/node/api/graphql.ts` | `debugLogRequestInfo()`, `sanitizeVariables()`, `errorHandler()` |
| `cli-kit/src/private/node/api.ts` | `isTransientNetworkError()`, `isNetworkError()`, retry logic |

### GraphQL Client

| File | Purpose |
|------|---------|
| `cli-kit/src/public/node/api/graphql.ts` | `graphqlRequest<T>()`, `graphqlRequestDoc<TResult, TVariables>()` |

**Features:**
- Automatic rate-limit restore (reads `extensions.cost.throttleStatus.restoreRate`)
- Response caching (`q-{queryHash}-{variablesHash}-{version}-{extraKey}`)
- Token refresh on 401 via `UnauthorizedHandler`
- Request ID tracking via `x-request-id`
- Sensitive data masking in debug logs

### DeveloperPlatformClient Pattern

| File | Implementation | Notes |
|------|---------------|-------|
| `app/src/cli/utilities/developer-platform-client.ts` | Interface definition | Defines ~40 methods |
| `app/src/cli/utilities/developer-platform-client/partners-client.ts` | `PartnersClient` | Legacy, ZIP bundles, no dev sessions |
| `app/src/cli/utilities/developer-platform-client/app-management-client.ts` | `AppManagementClient` | Modern, Brotli bundles, atomic deploys, dev sessions |

### Standard Request Headers

```
User-Agent: Shopify CLI; v={CLI_KIT_VERSION}
Keep-Alive: timeout=30
Sec-CH-UA-PLATFORM: {process.platform}
Content-Type: application/json
X-Shopify-Cli-Employee: 1  (internal employees only)
```

---

## Authentication Flow Reference

### Device Authorization Flow
```
1. POST /oauth/device_authorization → {device_code, user_code, verification_uri}
2. Display verification URL to user
3. Poll POST /oauth/token with device_code until approved
4. Receive identity token
5. Token exchange: identity token → per-API application tokens
```

### Custom Token Flow (CI/CD)
```
1. Read SHOPIFY_CLI_PARTNERS_TOKEN env var
2. POST /oauth/token (custom token exchange)
3. Receive API token + userId
```

### Token Refresh Flow
```
1. API call returns 401
2. UnauthorizedHandler triggers
3. POST /oauth/token (refresh_token grant)
4. Retry original request with new token
```

---

## Environment Variables Reference

### Authentication
| Variable | Purpose |
|----------|---------|
| `SHOPIFY_CLI_PARTNERS_TOKEN` | Custom Partners API token (bypass device auth) |
| `SHOPIFY_CLI_IDENTITY_TOKEN` | Pre-authenticated identity token |
| `SHOPIFY_CLI_REFRESH_TOKEN` | Refresh token for identity |
| `SHOPIFY_CLI_THEME_TOKEN` | Theme-specific access token |
| `SHOPIFY_CLI_ORGANIZATION` | Organization ID |

### Service Configuration
| Variable | Purpose |
|----------|---------|
| `SHOPIFY_SERVICE_ENV` | Service environment (`local` / `production`) |
| `SHOPIFY_CLI_THEME_KIT_ACCESS_DOMAIN` | Theme kit access domain override |
| `SHOPIFY_CLI_OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry endpoint |

### Network Behavior
| Variable | Purpose |
|----------|---------|
| `SHOPIFY_CLI_SKIP_NETWORK_LEVEL_RETRY` | Disable automatic network retries |
| `SHOPIFY_CLI_MAX_REQUEST_TIME_FOR_NETWORK_CALLS` | Request timeout (ms) |
| `BACKEND_PORT` | Backend port for local dev |

### Feature Flags
| Variable | Purpose |
|----------|---------|
| `SHOPIFY_CLI_NEVER_USE_PARTNERS_API` | Disable Partners API |
| `SHOPIFY_CLI_NO_ANALYTICS` | Disable analytics |
| `SHOPIFY_CLI_ALWAYS_LOG_ANALYTICS` | Force analytics even in debug mode |
| `SHOPIFY_CLI_ALWAYS_LOG_METRICS` | Force metrics even in debug mode |
| `SHOPIFY_CLI_1P_DEV` | Internal developer mode |
| `SHOPIFY_CLI_DEVICE_AUTH` | Device authorization flow flag |
| `SHOPIFY_CLI_ENABLE_CLI_REDIRECT` | Enable CLI redirect |
| `SHOPIFY_CLI_SKIP_CLI_REDIRECT` | Skip CLI redirect |
| `SHOPIFY_CLI_ENV` | CLI environment mode (`development` / `production`) |
| `SHOPIFY_FLAG_JSON` | JSON output format |
| `SHOPIFY_FLAG_VERBOSE` | Verbose output |
| `SHOPIFY_RUN_AS_USER` | Running as regular user (not internal) |
| `SHOPIFY_UNIT_TEST` | Running in unit test mode |
| `SHOPIFY_CLI_CLOUDFLARED_PATH` | Custom cloudflared binary path |
| `SHOPIFY_CLI_IGNORE_CLOUDFLARED` | Skip cloudflared installation |

### Cloud Environments
| Variable | Purpose |
|----------|---------|
| `CODESPACES` / `CODESPACE_NAME` | GitHub Codespaces detection |
| `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` | Codespace port forwarding domain |
| `GITPOD_WORKSPACE_URL` | Gitpod detection |
| `CLOUD_SHELL` | Google Cloud Shell detection |
| `SPIN_INSTANCE` / `SPIN_APP_HOST` | Shopify Spin detection |
| `SERVER_PORT` | Spin server port |

---
title: session
---

The `session` module provides an interface to ensure that the user is authenticated and to obtain tokens for each API as needed.


Session exposes 4 methods:
- [Storefront API](#ensureauthenticatedstorefront)
- [Partners API](#ensureauthenticatedpartners)
- [Admin API](#ensureauthenticatedadmin)
- [All APIs session](#ensureauthenticated)

By default, these scopes are always included when authenticating the user:

| API | Scopes |
| --- | -- |
| `All` | `openid` |
| `Storefront` | `https://api.shopify.com/auth/shop.storefront-renderer.devtools` |
| `Partners` | `https://api.shopify.com/auth/partners.app.cli.access` |
| `Admin` | `https://api.shopify.com/auth/shop.admin.graphql` `https://api.shopify.com/auth/shop.admin.themes` `https://api.shopify.com/auth/partners.collaborator-relationships.readonly`|


### `ensureAuthenticatedStorefront`

Authenticate the user and return a Storefront API token.

```ts
import {session} from '@shopify/cli-kit'

const scopes = []
const token = await session.ensureAuthenticatedStorefront(scopes)
```

#### Input

| Name | Description | Required | Default |
| --- | -- | --- | --- |
| `scopes` | Any extra scope you want include in the auth process | No | [] |

#### Output

It returns a `Promise<string>` that resolves with the Storefront token.


:::tip Session caching
If the user has never logged in before, the CLI will open a browser to authenticate them. We cache and refresh the identity token, so that should only happen once.
:::

### `ensureAuthenticatedPartners`

Authenticate the user and return a Partners API token.


```ts
import {session} from '@shopify/cli-kit'

const scopes = []
const token = await session.ensureAuthenticatedPartners(scopes)
```

:::info Token-based authentication
If `SHOPIFY_CLI_PARTNERS_TOKEN` exists in the Environment, session will use that token and exchange it for a valid Partners API token ignoring any previously existing session for partners.
:::

:::caution Token-based authentication and scopes
If you use SHOPIFY_CLI_PARTNERS_TOKEN any extra scope will be ignored as the token has already a set of scopes associated to it.
:::

#### Input

| Name | Description | Required | Default |
| --- | -- | --- | --- |
| `scopes` | Any extra scope you want include in the auth process | No | [] |

#### Output

It returns a `Promise<string>` that resolves with the Partners API token.


### `ensureAuthenticatedAdmin`

Authenticate the user and return an Admin API token.
- If a store is provided, it will be saved as `activeStore` for future usage.
- If a store is not provided, session will try to load read and use the `activeStore`.
- If a store is not provided and there is no `activeStore` this method will throw an Error.

```ts
import {session} from '@shopify/cli-kit'

const scopes = []
const myStore = 'mystore.myshopify.com'
const token = await session.ensureAuthenticatedAdmin(myStore, scopes)
```

#### Input

| Name | Description | Required | Default |
| --- | -- | --- | --- |
| `store` | FQDN of the store you want to log in to | No | saved `activeStore` if available |
| `scopes` | Any extra scope you want include in the auth process | No | [] |

#### Output

It returns a `Promise<string>` that resolves with the Admin API token.


### `ensureAuthenticated`

This is a generic method that allows you to obtain tokens for multiple apps at once.
Authenticate the user and return a session with tokens for all the given APIs.

```ts
import {session} from '@shopify/cli-kit'

const applications: session.OAuthApplications = {
  adminApi: {storeFqdn: 'mystore.myshopify.com', scopes: []},
  partnersApi: {scopes: []},
  storefrontRendererApi: {scopes: []},
}

const tokens = await session.ensureAuthenticated(applications)
```

#### Input

| Name | Description | Required | Default |
| --- | -- | --- | --- |
| `applications` | OAuthApplication object detailing which APIs and scopes do you need a session for | Yes | - |

#### Output

It returns a `Promise<OAuthSession>`. OAuthSession includes tokens for the three supported APIs as strings.

```ts
interface OAuthSession {
  admin?: string
  partners?: string
  storefront?: string
}
```


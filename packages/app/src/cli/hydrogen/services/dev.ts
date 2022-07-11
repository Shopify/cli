/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-catch-all/no-catch-all */

/* eslint-disable import/extensions */
import {ensureDevEnvironment} from './environment.js'
import {HydrogenApp} from '../models/app.js'
import {generateURL} from '../../services/dev/urls.js'
import {buildAppURL} from '../../services/dev/output.js'
import {error, session, port, output} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {createServer} from 'vite'
import express from 'express'
import {ApiVersion, Shopify} from '@shopify/shopify-api'
import {gdprTopics} from '@shopify/shopify-api/dist/webhooks/registry.js'
import cookieParser from 'cookie-parser'

export interface DevOptions {
  app: HydrogenApp
  apiKey?: string
  storeFqdn?: string
  reset: boolean
  update: boolean
  commandConfig: Config
  tunnelUrl?: string
}

async function dev(options: DevOptions) {
  const token = await session.ensureAuthenticatedPartners()
  const {
    storeFqdn,
    identifiers,
    app: {apiSecret},
  } = await ensureDevEnvironment(options, token)

  let localPort: number
  let url: string
  if (options.tunnelUrl) {
    const matches = options.tunnelUrl.match(/(https:\/\/[^:]+):([0-9]+)/)
    if (!matches) {
      throw new error.Abort(`Invalid tunnel URL: ${options.tunnelUrl}`, 'Valid format: "https://my-tunnel-url:port"')
    }
    localPort = Number(matches[2])
    url = matches[1]
  } else {
    localPort = await port.getRandomPort()
    url = await generateURL(options.commandConfig.plugins, localPort)
  }

  await startServer({
    ...options,
    url,
    localPort,
    apiKey: identifiers.app,
    apiSecret: apiSecret as string,
    storeFqdn,
  })
}

type StartServerOptions = Omit<DevOptions, 'tunnelUrl'> & {
  url: string
  apiKey: string
  localPort: number
  apiSecret: string
}

interface ActiveShops {
  [key: string]: string
}

async function startServer(options: StartServerOptions) {
  const activeShopifyShops: ActiveShops = {}

  initializeShopifyAPI(options)
  registerWebhooks(activeShopifyShops, options)

  const server = express()
  server.set('top-level-oauth-cookie', 'shopify_top_level_oauth')
  server.set('active-shopify-shops', activeShopifyShops)
  server.set('use-online-tokens', true)

  addMiddlewares(server, options)

  // Vite
  const vite = await createViteServer(options)
  server.use(vite.middlewares)

  server.listen(() => {
    const appURL = buildAppURL(options.storeFqdn as string, options.url)
    const heading = output.token.heading('App URL')
    const message = output.stringifyMessage(
      output.content`Your app's is available ${output.token.link('here', appURL)}`,
    )
    output.info(output.content`${heading}\n${message}\n`)
  })
}

async function registerWebhooks(activeShopifyShops: ActiveShops, options: StartServerOptions) {
  Shopify.Webhooks.Registry.addHandler('APP_UNINSTALLED', {
    path: '/api/webhooks',
    webhookHandler: async (topic, shop, body) => {
      await delete activeShopifyShops[shop]
    },
  })

  // TODO: setupGDPRWebHooks
}

async function addMiddlewares(server: ReturnType<typeof express>, options: StartServerOptions) {
  server.use(cookieParser(Shopify.Context.API_SECRET_KEY))
  addAuthMiddleware(server, options)

  server.post('/api/webhooks', async (req, res) => {
    try {
      await Shopify.Webhooks.Registry.process(req, res)
      output.message(`Webhook processed, returned status code 200`, 'error')
    } catch (error: any) {
      output.message(`Failed to process webhook: ${error}`, 'error')
      if (!res.headersSent) {
        res.status(500).send(error.message)
      }
    }
  })

  // All endpoints after this point will require an active session
  server.use(
    '/api/*',
    verifyRequest(server, {
      billing: options.app.configuration.billing ?? {required: false},
    }),
  )

  // TODO
  // app.get('/api/products-count', async (req, res) => {
  //   const session = await Shopify.Utils.loadCurrentSession(req, res, true)
  //   const {Product} = await import(`@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`)

  //   const countData = await Product.count({session})
  //   res.status(200).send(countData)
  // })

  server.post('/api/graphql', async (req, res) => {
    try {
      const response = await Shopify.Utils.graphqlProxy(req, res)
      res.status(200).send(response.body)
    } catch (error) {
      res.status(500).send((error as any).message)
    }
  })

  server.use(express.json())

  server.use((req, res, next) => {
    const shop = req.query.shop
    if (Shopify.Context.IS_EMBEDDED_APP && shop) {
      res.setHeader('Content-Security-Policy', `frame-ancestors https://${shop} https://admin.shopify.com;`)
    } else {
      res.setHeader('Content-Security-Policy', `frame-ancestors 'none';`)
    }
    next()
  })

  server.use('/*', async (req, res, next) => {
    const shop = req.query.shop as string

    // Detect whether we need to reinstall the app, any request from Shopify will
    // include a shop in the query parameters.
    if (server.get('active-shopify-shops')[shop] === undefined && shop) {
      res.redirect(`/api/auth?shop=${shop}`)
    } else {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <div id="app"><!--index.jsx injects App.jsx here--></div>
          <script type="module" src="/index.jsx"></script>
        </body>
      </html>
      `
      res.status(200).set('Content-Type', 'text/html').send(html)
    }
  })
}

async function addAuthMiddleware(server: ReturnType<typeof express>, options: StartServerOptions) {
  server.get('/api/auth', async (req, res) => {
    if (!req.query.shop) {
      res.status(500)
      return res.send('No shop provided')
    }

    if (!req.signedCookies[server.get('top-level-oauth-cookie')]) {
      return res.redirect(`/api/auth/toplevel?shop=${req.query.shop}`)
    }

    const redirectUrl = await Shopify.Auth.beginAuth(
      req,
      res,
      req.query.shop as string,
      '/api/auth/callback',
      server.get('use-online-tokens'),
    )

    res.redirect(redirectUrl)
  })

  server.get('/api/auth/toplevel', (req, res) => {
    res.cookie(server.get('top-level-oauth-cookie'), '1', {
      signed: true,
      httpOnly: true,
      sameSite: 'strict',
    })

    res.set('Content-Type', 'text/html')

    res.send(
      topLevelAuthRedirect({
        apiKey: Shopify.Context.API_KEY,
        hostName: Shopify.Context.HOST_NAME,
        shop: req.query.shop as string,
      }),
    )
  })

  server.get('/api/auth/callback', async (req, res) => {
    try {
      const session = await Shopify.Auth.validateAuthCallback(req, res, req.query as any)

      const host = req.query.host
      server.set(
        'active-shopify-shops',
        Object.assign(server.get('active-shopify-shops'), {
          [session.shop]: session.scope,
        }),
      )

      const responses = await Shopify.Webhooks.Registry.registerAll({
        shop: session.shop,
        accessToken: session.accessToken as string,
      })

      Object.entries(responses).map(([topic, response]) => {
        // The response from registerAll will include errors for the GDPR topics.  These can be safely ignored.
        // To register the GDPR topics, please set the appropriate webhook endpoint in the
        // 'GDPR mandatory webhooks' section of 'App setup' in the Partners Dashboard.
        if (!response.success && !gdprTopics.includes(topic)) {
          output.message(`Failed to register ${topic} webhook: ${(response.result as any).errors[0].message}`, 'error')
        }
      })

      // If billing is required, check if the store needs to be charged right away to minimize the number of redirects.
      const redirectUrl = `/?shop=${session.shop}&host=${host}`

      // Redirect to app with shop parameter upon auth
      res.redirect(redirectUrl)
    } catch (error: any) {
      output.warn(error)
      switch (true) {
        case error instanceof Shopify.Errors.InvalidOAuthError:
          res.status(400)
          res.send(error.message)
          break
        case error instanceof Shopify.Errors.CookieNotFound:
        case error instanceof Shopify.Errors.SessionNotFound:
          // This is likely because the OAuth session cookie expired before the merchant approved the request
          res.redirect(`/api/auth?shop=${req.query.shop}`)
          break
        default:
          res.status(500)
          res.send(error.message)
          break
      }
    }
  })
}

function initializeShopifyAPI(options: StartServerOptions) {
  Shopify.Context.initialize({
    API_KEY: options.apiKey,
    API_SECRET_KEY: options.apiSecret,
    SCOPES: options.app.configuration.scopes,
    HOST_NAME: options.url.replace(/https?:\/\//, ''),
    HOST_SCHEME: options.url.split('://')[0],
    API_VERSION: ApiVersion.April22,
    IS_EMBEDDED_APP: true,
  })
}

async function createViteServer(options: StartServerOptions) {
  return createServer({
    root: options.app.directory,
    cacheDir: undefined,
    server: {
      middlewareMode: 'ssr',
    },
    clearScreen: false,
    optimizeDeps: {
      entries: [],
    },
    plugins: [
      {
        name: 'config-watch',
        handleHotUpdate: async (context) => {
          // const watcherKey = Object.keys(watchers).find((pathPrefix) => context.file.startsWith(pathPrefix))
          // if (!watcherKey) {
          //   return context.modules
          // }
          // await watchers[watcherKey](context.file)
          // return context.modules
        },
      },
    ],
  })
}

export default dev

function topLevelAuthRedirect({apiKey, hostName, shop}: {apiKey: string; hostName: string; shop: string}) {
  return `<!DOCTYPE html>
<html>
  <head>
    <script src="https://unpkg.com/@shopify/app-bridge@3.1.0"></script>
    <script src="https://unpkg.com/@shopify/app-bridge-utils@3.1.0"></script>

    <script>
      document.addEventListener('DOMContentLoaded', function () {
        var appBridgeUtils = window['app-bridge-utils'];

        if (appBridgeUtils.isShopifyEmbedded()) {
          var AppBridge = window['app-bridge'];
          var createApp = AppBridge.default;
          var Redirect = AppBridge.actions.Redirect;

          const app = createApp({
            apiKey: '${apiKey}',
            shopOrigin: '${shop}',
          });

          const redirect = Redirect.create(app);

          redirect.dispatch(
            Redirect.Action.REMOTE,
            'https://${hostName}/api/auth/toplevel?shop=${shop}',
          );
        } else {
          window.location.href = '/api/auth?shop=${shop}';
        }
      });
    </script>
  </head>
  <body></body>
</html>`
}

const TEST_GRAPHQL_QUERY = `
{
  shop {
    name
  }
}`

function verifyRequest(
  server: ReturnType<typeof express>,
  {billing = {required: false}}: {billing: {required: boolean}} = {billing: {required: false}},
) {
  return async (req: any, res: any, next: any) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, server.get('use-online-tokens'))

    let shop = req.query.shop

    if (session && shop && session.shop !== shop) {
      // The current request is for a different shop. Redirect gracefully.
      return res.redirect(`/api/auth?shop=${shop}`)
    }

    if (session?.isActive()) {
      try {
        if (billing.required) {
          // The request to check billing status serves to validate that the access token is still valid.
          const [hasPayment, confirmationUrl] = await ensureBilling(session, billing)

          if (!hasPayment) {
            returnTopLevelRedirection(req, res, confirmationUrl)
            return
          }
        } else {
          // Make a request to ensure the access token is still valid. Otherwise, re-authenticate the user.
          const client = new Shopify.Clients.Graphql(session.shop, session.accessToken)
          await client.query({data: TEST_GRAPHQL_QUERY})
        }
        return next()
      } catch (error: any) {
        if (error instanceof Shopify.Errors.HttpResponseError && error.response.code === 401) {
          // Re-authenticate if we get a 401 response
        } else if (error instanceof ShopifyBillingError) {
          console.log(error.message, error.errorData[0])
          res.status(500).end()
          return
        } else {
          throw error
        }
      }
    }

    const bearerPresent = req.headers.authorization?.match(/Bearer (.*)/)
    if (bearerPresent) {
      if (!shop) {
        if (session) {
          shop = session.shop
        } else if (Shopify.Context.IS_EMBEDDED_APP) {
          if (bearerPresent) {
            const payload = Shopify.Utils.decodeSessionToken(bearerPresent[1])
            shop = payload.dest.replace('https://', '')
          }
        }
      }
    }

    returnTopLevelRedirection(req, res, `/api/auth?shop=${shop}`)
  }
}

function returnTopLevelRedirection(req: any, res: any, redirectUrl: any) {
  const bearerPresent = req.headers.authorization?.match(/Bearer (.*)/)

  // If the request has a bearer token, the app is currently embedded, and must break out of the iframe to
  // re-authenticate
  if (bearerPresent) {
    res.status(403)
    res.header('X-Shopify-API-Request-Failure-Reauthorize', '1')
    res.header('X-Shopify-API-Request-Failure-Reauthorize-Url', redirectUrl)
    res.end()
  } else {
    res.redirect(redirectUrl)
  }
}

export const BillingInterval = {
  OneTime: 'ONE_TIME',
  Every30Days: 'EVERY_30_DAYS',
  Annual: 'ANNUAL',
}

const RECURRING_INTERVALS = [BillingInterval.Every30Days, BillingInterval.Annual]

/**
 * You may want to charge merchants for using your app. This helper provides that function by checking if the current
 * merchant has an active one-time payment or subscription named `chargeName`. If no payment is found,
 * this helper requests it and returns a confirmation URL so that the merchant can approve the purchase.
 *
 * Learn more about billing in our documentation: https://shopify.dev/apps/billing
 */
export default async function ensureBilling(
  session,
  {chargeName, amount, currencyCode, interval},
  isProdOverride = process.env.NODE_ENV === 'production',
) {
  if (!Object.values(BillingInterval).includes(interval)) {
    throw `Unrecognized billing interval '${interval}'`
  }

  isProd = isProdOverride

  let hasPayment
  let confirmationUrl = null

  if (await hasActivePayment(session, {chargeName, interval})) {
    hasPayment = true
  } else {
    hasPayment = false
    confirmationUrl = await requestPayment(session, {
      chargeName,
      amount,
      currencyCode,
      interval,
    })
  }

  return [hasPayment, confirmationUrl]
}

async function hasActivePayment(session: any, {chargeName, interval}: {chargeName: any; interval: any}) {
  const client = new Shopify.Clients.Graphql(session.shop, session.accessToken)

  if (isRecurring(interval)) {
    const currentInstallations = await client.query({
      data: RECURRING_PURCHASES_QUERY,
    })
    const subscriptions = currentInstallations.body.data.currentAppInstallation.activeSubscriptions

    for (let i = 0, len = subscriptions.length; i < len; i++) {
      if (subscriptions[i].name === chargeName && (!isProd || !subscriptions[i].test)) {
        return true
      }
    }
  } else {
    let purchases
    let endCursor = null
    do {
      const currentInstallations = await client.query({
        data: {
          query: ONE_TIME_PURCHASES_QUERY,
          variables: {endCursor},
        },
      })
      purchases = currentInstallations.body.data.currentAppInstallation.oneTimePurchases

      for (let i = 0, len = purchases.edges.length; i < len; i++) {
        const node = purchases.edges[i].node
        if (node.name === chargeName && (!isProd || !node.test) && node.status === 'ACTIVE') {
          return true
        }
      }

      endCursor = purchases.pageInfo.endCursor
    } while (purchases.pageInfo.hasNextPage)
  }

  return false
}

async function requestPayment(
  session: any,
  {chargeName, amount, currencyCode, interval}: {chargeName: any; amount: any; currencyCode: any; interval: any},
) {
  const client = new Shopify.Clients.Graphql(session.shop, session.accessToken)
  const returnUrl = `https://${Shopify.Context.HOST_NAME}?shop=${session.shop}&host=${btoa(`${session.shop}/admin`)}`

  let data
  if (isRecurring(interval)) {
    const mutationResponse = await requestRecurringPayment(client, returnUrl, {
      chargeName,
      amount,
      currencyCode,
      interval,
    })
    data = mutationResponse.body.data.appSubscriptionCreate
  } else {
    const mutationResponse = await requestSinglePayment(client, returnUrl, {
      chargeName,
      amount,
      currencyCode,
    })
    data = mutationResponse.body.data.appPurchaseOneTimeCreate
  }

  if (data.userErrors.length) {
    throw new ShopifyBillingError('Error while billing the store', data.userErrors)
  }

  return data.confirmationUrl
}

async function requestRecurringPayment(
  client: any,
  returnUrl: any,
  {chargeName, amount, currencyCode, interval}: {chargeName: any; amount: any; currencyCode: any; interval: any},
) {
  const mutationResponse = await client.query({
    data: {
      query: RECURRING_PURCHASE_MUTATION,
      variables: {
        name: chargeName,
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                interval,
                price: {amount, currencyCode},
              },
            },
          },
        ],
        returnUrl,
        test: !isProd,
      },
    },
  })

  if (mutationResponse.body.errors && mutationResponse.body.errors.length) {
    throw new ShopifyBillingError('Error while billing the store', mutationResponse.body.errors)
  }

  return mutationResponse
}

async function requestSinglePayment(
  client: any,
  returnUrl: any,
  {chargeName, amount, currencyCode}: {chargeName: any; amount: any; currencyCode: any},
) {
  const mutationResponse = await client.query({
    data: {
      query: ONE_TIME_PURCHASE_MUTATION,
      variables: {
        name: chargeName,
        price: {amount, currencyCode},
        returnUrl,
        test: process.env.NODE_ENV !== 'production',
      },
    },
  })

  if (mutationResponse.body.errors && mutationResponse.body.errors.length) {
    throw new ShopifyBillingError('Error while billing the store', mutationResponse.body.errors)
  }

  return mutationResponse
}

function isRecurring(interval: any) {
  return RECURRING_INTERVALS.includes(interval)
}

class ShopifyBillingError extends Error {
  constructor(message: string, errors: any) {
    super(`${message}: ${JSON.stringify(errors)}`)
  }
}

const RECURRING_PURCHASES_QUERY = `
  query appSubscription {
    currentAppInstallation {
      activeSubscriptions {
        name, test
      }
    }
  }
`

const ONE_TIME_PURCHASES_QUERY = `
  query appPurchases($endCursor: String) {
    currentAppInstallation {
      oneTimePurchases(first: 250, sortKey: CREATED_AT, after: $endCursor) {
        edges {
          node {
            name, test, status
          }
        }
        pageInfo {
          hasNextPage, endCursor
        }
      }
    }
  }
`

const RECURRING_PURCHASE_MUTATION = `
  mutation test(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      test: $test
    ) {
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`

const ONE_TIME_PURCHASE_MUTATION = `
  mutation test(
    $name: String!
    $price: MoneyInput!
    $returnUrl: URL!
    $test: Boolean
  ) {
    appPurchaseOneTimeCreate(
      name: $name
      price: $price
      returnUrl: $returnUrl
      test: $test
    ) {
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`

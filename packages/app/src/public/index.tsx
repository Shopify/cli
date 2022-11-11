/* eslint-disable no-negated-condition */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import React, {useCallback, useMemo, useState} from 'react'
import {AppProvider, Banner, Layout, Page} from '@shopify/polaris'
import {useNavigate as appBridgeUseNavigate, Provider, NavigationMenu} from '@shopify/app-bridge-react'
import translations from '@shopify/polaris/locales/en.json'
import '@shopify/polaris/build/esm/styles.css'
import {BrowserRouter, useLocation, useNavigate, Routes as ReactRouterRoutes, Route} from 'react-router-dom'
import {QueryClient, QueryClientProvider, QueryCache, MutationCache} from 'react-query'
import {getApiKey} from '@shopify/app/internal'

/**
 * File-based routing.
 * @desc File-based routing that uses React Router under the hood.
 * To create a new route create a new .jsx file in `/pages` with a default export.
 *
 * Some examples:
 * * `/pages/index.jsx` matches `/`
 * * `/pages/blog/[id].jsx` matches `/blog/123`
 * * `/pages/[...catchAll].jsx` matches any URL not explicitly matched
 *
 * @param {object} pages value of import.meta.globEager(). See https://vitejs.dev/guide/features.html#glob-import
 *
 * @return {Routes} `<Routes/>` from React Router, with a `<Route/>` for each file in `pages`
 */
export default function Routes({pages}) {
  const routes = useRoutes(pages)
  const routeComponents = routes.map(({path, component: Component}) => (
    <Route key={path} path={path} element={<Component />} />
  ))

  const NotFound = routes.find(({path}) => path === '/notFound').component

  return (
    <ReactRouterRoutes>
      {routeComponents}
      <Route path="*" element={<NotFound />} />
    </ReactRouterRoutes>
  )
}

function useRoutes(pages) {
  const routes = Object.keys(pages)
    .map((key) => {
      let path = key
        .replace('./pages', '')
        .replace(/\.(t|j)sx?$/, '')
        /**
         * Replace /index with /
         */
        .replace(/\/index$/i, '/')
        /**
         * Only lowercase the first letter. This allows the developer to use camelCase
         * dynamic paths while ensuring their standard routes are normalized to lowercase.
         */
        .replace(/\b[A-Z]/, (firstLetter) => firstLetter.toLowerCase())
        /**
         * Convert /[handle].jsx and /[...handle].jsx to /:handle.jsx for react-router-dom
         */
        .replace(/\[(?:[.]{3})?(\w+?)\]/g, (_match, param) => `:${param}`)

      if (path.endsWith('/') && path !== '/') {
        path = path.substring(0, path.length - 1)
      }

      if (!pages[key].default) {
        console.warn(`${key} doesn't export a default React component`)
      }

      return {
        path,
        component: pages[key].default,
      }
    })
    .filter((route) => route.component)

  return routes
}

/**
 * Sets up the QueryClientProvider from react-query.
 * @desc See: https://react-query.tanstack.com/reference/QueryClientProvider#_top
 */
function QueryProvider({children}) {
  const client = new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
  })

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/**
 * A component to configure App Bridge.
 * @desc A thin wrapper around AppBridgeProvider that provides the following capabilities:
 *
 * 1. Ensures that navigating inside the app updates the host URL.
 * 2. Configures the App Bridge Provider, which unlocks functionality provided by the host.
 *
 * See: https://shopify.dev/apps/tools/app-bridge/react-components
 */
export function AppBridgeProvider({children}) {
  const location = useLocation()
  const navigate = useNavigate()
  const history = useMemo(
    () => ({
      replace: (path) => {
        navigate(path, {replace: true})
      },
    }),
    [navigate],
  )

  const routerConfig = useMemo(() => ({history, location}), [history, location])

  // The host may be present initially, but later removed by navigation.
  // By caching this in state, we ensure that the host is never lost.
  // During the lifecycle of an app, these values should never be updated anyway.
  // Using state in this way is preferable to useMemo.
  // See: https://stackoverflow.com/questions/60482318/version-of-usememo-for-caching-a-value-that-will-never-change
  const [appBridgeConfig] = useState(() => {
    const host = new URLSearchParams(location.search).get('host') || window.__SHOPIFY_DEV_HOST
    window.__SHOPIFY_DEV_HOST = host

    return {
      host,
      apiKey: getApiKey(),
      forceRedirect: true,
    }
  })

  if (!getApiKey() || !appBridgeConfig.host) {
    const bannerProps = !getApiKey()
      ? {
          title: 'Missing Shopify API Key',
          children: (
            <>
              Your app is running without the SHOPIFY_API_KEY environment variable. Please ensure that it is set when
              running or building your React app.
            </>
          ),
        }
      : {
          title: 'Missing host query argument',
          children: (
            <>
              Your app can only load if the URL has a <b>host</b> argument. Please ensure that it is set, or access your
              app using the Partners Dashboard <b>Test your app</b> feature
            </>
          ),
        }

    return (
      <Page narrowWidth>
        <Layout>
          <Layout.Section>
            <div style={{marginTop: '100px'}}>
              <Banner {...bannerProps} status="critical" />
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    )
  }

  return (
    <Provider config={appBridgeConfig} router={routerConfig}>
      {children}
    </Provider>
  )
}

function AppBridgeLink({url, children, external, ...rest}) {
  const navigate = appBridgeUseNavigate()
  const handleClick = useCallback(() => {
    navigate(url)
  }, [url])

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const IS_EXTERNAL_LINK_REGEX = /^(?:[a-z][a-z\d+.-]*:|\/\/)/

  if (external || IS_EXTERNAL_LINK_REGEX.test(url)) {
    return (
      <a {...rest} href={url} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }

  return (
    <a {...rest} onClick={handleClick}>
      {children}
    </a>
  )
}

/**
 * Sets up the AppProvider from Polaris.
 * @desc PolarisProvider passes a custom link component to Polaris.
 * The Link component handles navigation within an embedded app.
 * Prefer using this vs any other method such as an anchor.
 * Use it by importing Link from Polaris, e.g:
 *
 * ```
 * import {Link} from '@shopify/polaris'
 *
 * function MyComponent() {
 *  return (
 *    <div><Link url="/tab2">Tab 2</Link></div>
 *  )
 * }
 * ```
 *
 * PolarisProvider also passes translations to Polaris.
 *
 */
export function ShopifyApp({links, pages}) {
  return (
    <AppProvider i18n={translations} linkComponent={AppBridgeLink}>
      <BrowserRouter>
        <AppBridgeProvider>
          <QueryProvider>
            <NavigationMenu
              navigationLinks={[
                {
                  label: 'Page name',
                  destination: '/',
                },
              ]}
            />
            <Routes pages={pages} />
          </QueryProvider>
        </AppBridgeProvider>
      </BrowserRouter>
    </AppProvider>
  )
}

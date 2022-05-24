import {
  Routes as ReactRouterRoutes,
  Route,
} from "react-router-dom";

export default function Routes({ pages }) {
  const routes = useRoutes(pages);
  const routeComponents = routes.map(({ path, component: Component }) => (
    <Route key={path} path={path} element={<Component />} />
  ))

  return <ReactRouterRoutes>{routeComponents}</ReactRouterRoutes>
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

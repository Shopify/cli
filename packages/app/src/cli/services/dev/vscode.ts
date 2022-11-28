import {DevOptions} from '../dev.js'
import {http} from '@shopify/cli-kit'
import {createServer} from 'http'

export function vscodeExtensionServer(options: DevOptions) {
  const httpApp = http.createApp()
  const httpRouter = http.createRouter()

  httpApp.use(httpRouter)
  httpRouter.use(
    '/vscode',
    http.eventHandler((event) => {
      return [
        {
          title: 'App development',
        },
      ]
    }),
  )

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const httpServer = createServer(httpApp)
  httpServer.listen(1111)
}

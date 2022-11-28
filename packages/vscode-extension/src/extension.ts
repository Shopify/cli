import * as vscode from 'vscode'
// @ts-ignore
import {enableHotReload, hotRequire} from '@hediet/node-reload'

enableHotReload({entryModule: module})

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    hotRequire<typeof import('./logic')>(module, './logic', (logic: any) => {
      return new logic.ShopifyCLIExtension()
    }),
  )
}

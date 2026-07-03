import {render} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'

export async function renderThemeView(node: JSX.Element, fallback: () => void): Promise<void> {
  if (!terminalSupportsPrompting()) {
    fallback()
    return
  }

  await render(node)
}

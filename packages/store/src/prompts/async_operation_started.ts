import {renderInfo, Token} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'
import colors from '@shopify/cli-kit/node/colors'
import {serialize} from '../services/store/utils/composite-id.js'

export function renderAsyncOperationStarted(operation: string, organizationId: string, destination: string, source: string, id: string): void {
  const msg: Token[] = [{subdued: 'From'}, destination]
  msg.push({subdued: '\nTo  '}, source)
  msg.push({subdued: '\nID  '}, id)
  renderInfo({headline: {info: `${operation} created`}, body: msg})

  const compositeId = serialize({organizationId, bulkDataOperationId: id})

  outputInfo(colors.dim(' Tips'))
  outputInfo(
    colors.dim(` • Continue watching with `) + colors.dim(colors.bold(`shopify store copy show ${id} --watch`)),
  )
  outputInfo(`${colors.dim(` • View details with `) + colors.dim(colors.bold(`shopify store copy show ${id}`))}\n`)
}

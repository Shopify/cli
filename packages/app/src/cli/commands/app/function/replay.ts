import {inFunctionContext, functionFlags} from '../../../services/function/common.js'
import {appFlags} from '../../../flags.js'
import {mockAppEvents} from '../../../models/app-event.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {gql} from 'graphql-request'

const ShopEventQuery = gql`
  query DevelopmentShopEvents($apiKey: String!) {
    developmentShopEvent(apiKey: $apiKey) {
      type
      input
    }
  }
`

interface Response {
  developmentShopEvent: ShopEvent
}

interface ShopEvent {
  type: string
  input: string
}

export default class FunctionReplay extends Command {
  static description = 'Replay last function run from dev.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
  }

  public async run() {
    const {flags} = await this.parse(FunctionReplay)
    await inFunctionContext({
      path: flags.path,
      configName: flags.config,

      callback: async (app, ourFunction) => {
        const events = mockAppEvents()

        console.log('last event was', events[0])
      },
    })
  }
}

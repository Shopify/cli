import {createConfigExtensionSpecification, CustomTransformationConfig} from '../specification.js'
import {CurrentAppConfiguration} from '../../app/app.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {outputContent, outputInfo} from '@shopify/cli-kit/node/output'

const AppDevelopmentSchema = zod.object({
  development: zod
    .object({
      tunnel_url: zod.string().optional(),
    })
    .optional(),
})

const AppDevelopmentTransformConfig: CustomTransformationConfig = {
  forward: (content, appConfiguration) => {
    outputInfo(`development app content: ${JSON.stringify(content)}`)

    let appUrl: string | undefined
    if ('application_url' in appConfiguration) {
      appUrl = (appConfiguration as CurrentAppConfiguration)?.application_url
    }
    return {
      tunnel_url: appUrl,
    }
  },
  reverse: () => ({
    tunnel_url: 'https://tunnel-url.com',
  }),
}

export const AppDevelopmentSpecIdentifier = 'app_development'

const AppDevelopmentSpec = createConfigExtensionSpecification({
  identifier: AppDevelopmentSpecIdentifier,
  schema: AppDevelopmentSchema,
  transformConfig: AppDevelopmentTransformConfig,
  getDevSessionActionUpdateMessage: async () => {
    return outputContent`Tunnel url updated`.value
  },
})

export default AppDevelopmentSpec

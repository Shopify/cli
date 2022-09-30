import {schema} from '@shopify/cli-kit'
import {
  BaseExtension,
  BaseExtensionOptions,
  BaseExtensionSchema,
  BaseFactory,
  defineExtensions,
} from '@shopify/cli-kit/plugins/extension'

const NewExtensionSchema = BaseExtensionSchema.extend({
  settings: schema.define.any().optional(),
})

type NewExtensionSchemaType = schema.define.infer<typeof NewExtensionSchema>

export class MyExtensionClass extends BaseExtension<NewExtensionSchemaType> {
  type = 'my_new_extension'

  public build(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public devConfig() {
    return {
      settings: this.configuration.settings,
    }
  }
}

export class NewExtensionFactory extends BaseFactory {
  schema = NewExtensionSchema

  create(params: BaseExtensionOptions<NewExtensionSchemaType>) {
    return new MyExtensionClass(params)
  }
}

export default defineExtensions({
  extensions: [
    {
      identifier: 'super_extension',
      ownerTeam: 'super_team',
      uiGroup: 'merchant_admin',
      dependency: {
        name: '@shopify/super-extension',
        version: '0.0.1',
      },
      factory: new NewExtensionFactory(),
    },
  ],
})

// const crate = (params: BaseExtensionOptions<NewExtensionSchemaType>) => {
//   return new MyExtensionClass()
// }

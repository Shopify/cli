import type {Schema} from 'conf'

const schema: Schema<unknown> = {
  appInfo: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
        },
        title: {
          type: 'string',
        },
        orgId: {
          type: 'string',
        },
        storeFqdn: {
          type: 'string',
        },
        directory: {
          type: 'string',
        },
      },
    },
  },
}

export default schema

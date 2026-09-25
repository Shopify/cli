// Core module.json.erb at 440131c4a4259f3c7d1716f3821fd5e6e1337c7b:
// areas/core/shopify/components/apps/app/services/apps/events/module.json.erb.
// The ERB's runtime topic/action enums use representative values in this fixture.
const subscriptionProperties = {
  api_version: {$ref: '#/definitions/ApiVersion'},
  topic: {type: 'string', enum: ['products', 'orders']},
  actions: {
    type: 'array',
    uniqueItems: true,
    minItems: 1,
    items: {type: 'string', enum: ['create', 'update', 'delete']},
  },
  triggers: {type: 'array', uniqueItems: true, items: {type: 'string'}},
  uri: {type: 'string'},
  query: {type: 'string'},
  query_filter: {type: 'string'},
  identifier: {type: 'string'},
}

export const strictEventsContract = {
  type: 'object',
  additionalProperties: false,
  properties: {events: {$ref: '#/definitions/EventsOptions'}},
  definitions: {
    EventsOptions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        api_version: {$ref: '#/definitions/ApiVersion'},
        subscription: {
          type: ['array', 'object'],
          items: {$ref: '#/definitions/Subscription'},
          additionalProperties: false,
          required: ['topic', 'actions', 'uri'],
          properties: subscriptionProperties,
        },
      },
      required: ['api_version', 'subscription'],
    },
    ApiVersion: {
      type: 'string',
      minLength: 1,
      title: 'Admin API',
      description: 'The Admin API lets you build apps and integrations that extend and enhance the Shopify admin.',
    },
    Subscription: {
      type: 'object',
      additionalProperties: false,
      required: ['topic', 'actions', 'uri', 'handle'],
      properties: {
        ...subscriptionProperties,
        handle: {type: 'string', pattern: '^([a-zA-Z0-9-_])*$', minLength: 1, maxLength: 50},
      },
    },
  },
}

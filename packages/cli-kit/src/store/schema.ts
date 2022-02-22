import type {Schema} from 'conf'

// Example of valid content
//  {
//   sessions: {
//     'identity.myshopify.io': {
//       session: {
//         accessToken: 'foo',
//         refreshToken: 'bar',
//         expiresAt: '2025-11-13T20:20:39+00:00',
//         scopes: ['a', 'b'],
//       },
//       applications: {
//         partners: {
//           'partners.shopify.com': {
//             accessToken: 'foo',
//             expiresAt: '2025-11-13T20:20:39+00:00',
//             scopes: ['a', 'b'],
//           },
//         },
//         storefrontRenderer: {
//          'my-shop.shopify.com': {
//             accessToken: 'foo',
//             expiresAt: '2025-11-13T20:20:39+00:00',
//             scopes: ['a', 'b'],
//           }
//         },
//       },
//     },
//     'accounts.shopify.com': {},
//     'identity.....': {},
//   },
// };
const schema: Schema<{sessions: unknown}> = {
  sessions: {
    type: 'object',
    description:
      'An object that stores tokens for identity and the various services the CLI can interact with.',
    additionalProperties: {
      type: 'object',
      description:
        'Every key in the object is the fqdn of an identity instance.' +
        ' For example, accounts.shopify.com.' +
        ' This makes it possible to persist sessions for different instances without conflicts.',
      properties: {
        session: {
          type: 'object',
          description:
            'The object contains the Identity token and the scopes associated to it.' +
            ' This token is exchanged for tokens that can be used against the applications.',
          required: ['accessToken', 'refreshToken', 'expiresAt', 'scopes'],
          properties: {
            accessToken: {
              type: 'string',
              description: 'Access token',
            },
            refreshToken: {
              type: 'string',
              description: 'Refresh token',
            },
            expiresAt: {
              type: 'string',
              description: 'Date and time when the access token expires',
              format: 'date-time',
            },
            scopes: {
              type: 'array',
              description: 'The scopes the token has access to',
              items: {
                type: 'string',
              },
            },
          },
        },
        applications: {
          type: 'object',
          properties: {
            admin: {
              type: 'object',
              description:
                'It stores sessions for interact with the Shopify Admin API.' +
                ' Each key in the object is the fqdn of the store instance.',
              additionalProperties: {
                type: 'object',
                description:
                  'The object represents the session for a given store',
                required: ['accessToken', 'expiresAt', 'scopes'],
                properties: {
                  accessToken: {
                    type: 'string',
                    description: 'Access token',
                  },
                  expiresAt: {
                    type: 'string',
                    description: 'Date and time when the access token expires',
                    format: 'date-time',
                  },
                  scopes: {
                    type: 'array',
                    description: 'The scopes the token has access to',
                    items: {
                      type: 'string',
                    },
                  },
                },
              },
            },
            partners: {
              type: 'object',
              description:
                'The object contains sessions for various instances of partners.' +
                ' Every key represents the fqdn of an instance',
              additionalProperties: {
                type: 'object',
                description:
                  'It represents a session to authenticate against a Partners API',
                required: ['accessToken', 'expiresAt', 'scopes'],
                properties: {
                  accessToken: {
                    type: 'string',
                    description: 'Access token',
                  },
                  expiresAt: {
                    type: 'string',
                    description: 'Date and time when the access token expires',
                    format: 'date-time',
                  },
                  scopes: {
                    type: 'array',
                    description: 'The scopes the token has access to',
                    items: {
                      type: 'string',
                    },
                  },
                },
              },
            },
            storefrontRenderer: {
              type: 'object',
              description:
                'The object contains sessions for various instances of the Storefront Renderer.' +
                ' Every key represents the fqdn of an instance',
              additionalProperties: {
                type: 'object',
                description:
                  'It represents a session to authenticate against a Storefront Renderer API',
                required: ['accessToken', 'expiresAt', 'scopes'],
                properties: {
                  accessToken: {
                    type: 'string',
                    description: 'Access token',
                  },
                  expiresAt: {
                    type: 'string',
                    description: 'Date and time when the access token expires',
                    format: 'date-time',
                  },
                  scopes: {
                    type: 'array',
                    description: 'The scopes the token has access to',
                    items: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

export default schema

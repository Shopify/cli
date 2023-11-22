export interface webhookTrigger {
  /**
   * The requested event topic. You can pass the webhook topic using the GraphQL enum value or the webhook topic name. For example, you can request the `orders/create` webhook topic by passing `ORDERS_CREATE` (GraphQL API style) or `orders/create` (REST API style).
   * For a complete list of topics, refer to the [GraphQL Admin API reference](/api/admin-graphql/current/enums/webhooksubscriptiontopic), the REST Admin API reference, and the Mandatory webhooks guide.
   */
  topic?: string

  /**
   * API version of the event topic, in the format YYYY-MM or unstable. If the topic isn't available in the specified version, then the webhook payload isn't sent.
   */
  'api-version'?: string

  /**
   * Your app's client secret. This secret is used to generate and return a X-Shopify-Hmac-SHA256 header, which lets you validate the origin of the response that you receive.
   */
  'client-secret'?: string

  /**
   * The method chosen to deliver the topic payload. Options: http, google-pub-sub, event-bridge
   */
  'delivery-method'?: string

  /**
   * The URL where the webhook payload should be sent.

For each delivery method, you need to provide a different address type:

 - http: For remote delivery, use an https:// address. For local delivery, use http://localhost:{port}/{url-path}.

 - google-pub-sub: A pubsub URL, in the format pubsub://{project-id}:{topic-id}

 - event-bridge: An Amazon Resource Name (ARN) starting with arn:aws:events:
   */
  address?: string
}

import {WebhookSubscriptionSchema} from './webhook_subscription_schema.js'
import {describe, expect, test} from 'vitest'

describe('WebhookSubscriptionSchema', () => {
  describe('payload_query field', () => {
    test('validates a subscription with a valid payload_query string', () => {
      // Given
      const subscription = {
        topics: ['products/create'],
        uri: 'https://example.com/webhooks',
        payload_query: 'query { product { id title } }',
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.payload_query).toBe('query { product { id title } }')
      }
    })

    test('validates a subscription without payload_query (optional field)', () => {
      // Given
      const subscription = {
        topics: ['products/create'],
        uri: 'https://example.com/webhooks',
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.payload_query).toBeUndefined()
      }
    })

    test('validates a subscription with empty payload_query', () => {
      // Given
      const subscription = {
        topics: ['products/create'],
        uri: 'https://example.com/webhooks',
        payload_query: '',
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.payload_query).toBe('')
      }
    })

    test('validates a subscription with complex nested GraphQL query', () => {
      // Given
      const subscription = {
        topics: ['products/update'],
        uri: 'https://example.com/webhooks',
        payload_query: `
          query getProductDetails {
            product {
              id
              title
              description
              variants(first: 10) {
                edges {
                  node {
                    id
                    price
                    inventoryQuantity
                  }
                }
              }
              images(first: 5) {
                edges {
                  node {
                    id
                    url
                  }
                }
              }
            }
          }
        `,
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.payload_query).toContain('query getProductDetails')
        expect(result.data.payload_query).toContain('variants(first: 10)')
      }
    })

    test('fails validation when payload_query is not a string', () => {
      // Given
      const subscription = {
        topics: ['products/create'],
        uri: 'https://example.com/webhooks',
        payload_query: 123,
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]).toMatchObject({
          code: 'invalid_type',
          message: 'Value must be a string',
          path: ['payload_query'],
        })
      }
    })

    test('fails validation when payload_query is a boolean', () => {
      // Given
      const subscription = {
        topics: ['products/create'],
        uri: 'https://example.com/webhooks',
        payload_query: true,
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]).toMatchObject({
          code: 'invalid_type',
          message: 'Value must be a string',
          path: ['payload_query'],
        })
      }
    })

    test('fails validation when payload_query is an array', () => {
      // Given
      const subscription = {
        topics: ['products/create'],
        uri: 'https://example.com/webhooks',
        payload_query: ['query', '{ product { id } }'],
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]).toMatchObject({
          code: 'invalid_type',
          message: 'Value must be a string',
          path: ['payload_query'],
        })
      }
    })

    test('validates subscription with all optional fields including payload_query', () => {
      // Given
      const subscription = {
        topics: ['products/update'],
        uri: 'https://example.com/webhooks',
        include_fields: ['id', 'title', 'vendor'],
        filter: 'title:shoes',
        payload_query: 'query { product { id title vendor } }',
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toMatchObject({
          topics: ['products/update'],
          uri: 'https://example.com/webhooks',
          include_fields: ['id', 'title', 'vendor'],
          filter: 'title:shoes',
          payload_query: 'query { product { id title vendor } }',
        })
      }
    })

    test('validates subscription with multiline GraphQL query', () => {
      // Given
      const subscription = {
        topics: ['orders/create'],
        uri: 'https://example.com/webhooks',
        payload_query: `
          query getOrder($id: ID!) {
            order(id: $id) {
              id
              name
              totalPrice
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    quantity
                  }
                }
              }
            }
          }
        `,
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.payload_query).toContain('query getOrder($id: ID!)')
      }
    })

    test('validates subscription with GraphQL fragments in payload_query', () => {
      // Given
      const subscription = {
        topics: ['products/update'],
        uri: 'https://example.com/webhooks',
        payload_query: `
          fragment ProductFields on Product {
            id
            title
            description
          }

          query {
            product {
              ...ProductFields
              variants(first: 5) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        `,
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.payload_query).toContain('fragment ProductFields')
        expect(result.data.payload_query).toContain('...ProductFields')
      }
    })

    test('validates subscription with special characters in payload_query', () => {
      // Given
      const subscription = {
        topics: ['products/create'],
        uri: 'https://example.com/webhooks',
        payload_query: 'query { product { title @include(if: true) description @skip(if: false) } }',
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(subscription)

      // Then
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.payload_query).toContain('@include(if: true)')
        expect(result.data.payload_query).toContain('@skip(if: false)')
      }
    })
  })
})

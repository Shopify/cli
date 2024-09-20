#!/usr/bin/env node

async function main() {
  try {
    const store = process.env.STORE_FQDN
    const accessToken = process.env.ACCESS_TOKEN
    const apiVersion = process.env.API_VERSION

    if (!store) {
      throw new Error('STORE_FQDN environment variable is not set')
    }

    if (!accessToken) {
      throw new Error('ACCESS_TOKEN environment variable is not set')
    }

    if (!apiVersion) {
      throw new Error('API_VERSION environment variable is not set')
    }

    const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const productTitle = `script-${currentDate}`

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': `Bearer ${accessToken}`,
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `
          mutation {
            productCreate(input: {
              title: "${productTitle}"
            }) {
              product {
                id
                title
              }
            }
          }
        `,
      }),
    }

    const url = `https://${store}/admin/api/${apiVersion}/graphql.json`
    const response = await fetch(url, requestOptions)

    const data = await response.json()

    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      throw new Error('Failed to create product')
    }

    const productId = data.data.productCreate.product.id
    const numericId = productId.split('/').pop()
    const productUrl = `https://${store}/admin/products/${numericId}`

    console.log('Product created successfully!')
    console.log('Product URL:', productUrl)
  } catch (error) {
    console.error('An error occurred:', error)
    process.exit(1)
  }
}

main()

import {authenticatedFetch} from '@shopify/app/api'

const response = await authenticatedFetch("/something")

console.log(response)

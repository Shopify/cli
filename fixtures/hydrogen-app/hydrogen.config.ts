import {defineHydrogenApp} from "@shopify/app/hydrogen/configuration"

export default defineHydrogenApp({
    name: "Fixture",
    scopes: ["read_products"]
})

import {defineHydrogenApp} from "@shopify/app/hydrogen/configuration"

export default defineHydrogenApp(({environment}) => ({
    name: ( environment === "development") ? "Fixture development": "Fixture",
    scopes: ["read_products"],
    billing: {
        required: false
    }
}))

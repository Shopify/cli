import React from 'react'
import {render, extend, Text, useExtensionApi} from '@shopify/admin-ui-extensions-react'

// Your extension must render all four modes
extend(
  'Admin::Product::SubscriptionPlan::Add',
  render(() => <App />),
)
extend(
  'Admin::Product::SubscriptionPlan::Create',
  render(() => <App />),
)
extend(
  'Admin::Product::SubscriptionPlan::Remove',
  render(() => <App />),
)
extend(
  'Admin::Product::SubscriptionPlan::Edit',
  render(() => <App />),
)

function App() {
  const {extensionPoint} = useExtensionApi()
  return <Text>Welcome to the {extensionPoint} extension!</Text>
}

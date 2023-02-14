import {Text, extend} from '@shopify/admin-ui-extensions'

extend('Admin::CompanyLocation::Details::Render', App)

function App(root, {extensionPoint}) {
  root.appendChild(
    root.createComponent(
      Text,
      {},
      `It works the ${extensionPoint} extension! API_KEY is: ${process.env.SHOPIFY_API_KEY}`,
    ),
  )
  root.mount()
}

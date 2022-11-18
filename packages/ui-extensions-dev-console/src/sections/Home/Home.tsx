import * as styles from './Home.module.scss'
import {Layout, Link, Page, Heading} from '@shopify/polaris'
import React from 'react'
import {useExtensionServerContext} from '@shopify/ui-extensions-server-kit'
import QRCode from 'qrcode.react'
import {Card} from '@/components/Card'

export function Home() {
  const {state} = useExtensionServerContext()

  console.log(state)

  return (
    <Page fullWidth>
      <Layout>
        <Layout.Section>
          <Card title="App Preview" sectioned>
            <p className={styles.paddingB}>This preview shows your app but not your extensions</p>
            <div className={styles.paddingB}>
              <Heading>Web link</Heading>
              <Link url={state.app?.applicationUrl}>{state.app?.applicationUrl}</Link>
            </div>
            <div className={styles.paddingB}>
              <Heading>Mobile access</Heading>
            </div>
            <QRCode value={state.app?.applicationUrl || ''} />
          </Card>
        </Layout.Section>
        {state.extensions.map((extension) => (
          <Layout.Section key={extension.uuid}>
            <Card title={`${extension.title} (${extension.type})`} sectioned>
              <ExtensionCardContent extension={extension} />
            </Card>
          </Layout.Section>
        ))}
      </Layout>
    </Page>
  )
}

function ExtensionCardContent({extension}: any) {
  if (extension.type === 'checkout_post_purchase') {
    return (
      <div>
        <p>To view this extension:</p>
        <ol>
          <li>
            Install{' '}
            <Link
              external
              url="​https://chrome.google.com/webstore/detail/shopify-post-purchase-dev/nenmcifhoegealiiblnpihbnjenleong"
            >
              Shopify’s post-purchase Chrome extension
            </Link>
          </li>
          <li>Open the Chrome extension and paste this URL into it: {extension.development.root.url}</li>
          <li>Run a test purchase on your store to view your extension For more detail</li>
        </ol>{' '}
        <p>
          For more detail, see the{' '}
          <Link
            external
            url="​​https://shopify.dev/apps/checkout/post-purchase/getting-started-post-purchase-extension#step-2-test-the-extension"
          >
            dev docs
          </Link>
          .
        </p>
      </div>
    )
  }

  if (extension.type === 'customer_accounts_ui_extension') {
    return <p>TODO</p>
  }

  return (
    <p>
      Preview Link:{' '}
      <Link external url={extension.development.root.url}>
        {extension.development.root.url}
      </Link>
    </p>
  )
}

import {Layout, Page} from '@shopify/polaris'
import React from 'react'
import {Card} from '@/components/Card'

export function Home() {
  return (
    <>
      <Page fullWidth>
        <Layout>
          <Layout.Section>
            <Card title="First Link section" sectioned>
              <p>View a summary of your online store’s performance.</p>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Card title="More info here" sectioned>
              <p>View a summary of your online store’s performance.</p>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </>
  )
}

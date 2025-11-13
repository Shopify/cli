import {runBulkOperationQuery} from './run-query.js'
import {BulkOperationProgress} from './BulkOperationProgress.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {renderInfo, renderWarning, render} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import React from 'react'

interface ExecuteBulkOperationInput {
  app: AppLinkedInterface
  storeFqdn: string
  query: string
  watch?: boolean
}

export async function executeBulkOperation(input: ExecuteBulkOperationInput): Promise<void> {
  const {app, storeFqdn, query, watch = false} = input

  renderInfo({
    headline: 'Starting bulk operation.',
    body: `App: ${app.name}\nStore: ${storeFqdn}`,
  })

  const bulkOperationResponse = await runBulkOperationQuery({
    storeFqdn,
    query,
  })

  if (bulkOperationResponse?.userErrors?.length) {
    const errorMessages = bulkOperationResponse.userErrors
      .map(
        (error: {field?: string[] | null; message: string}) =>
          `${error.field?.join('.') ?? 'unknown'}: ${error.message}`,
      )
      .join('\n')
    renderWarning({
      headline: 'Bulk operation errors.',
      body: errorMessages,
    })
    return
  }

  const result = bulkOperationResponse?.bulkOperation
  if (result) {
    if (watch) {
      const adminSession = await ensureAuthenticatedAdmin(storeFqdn)
      await render(
        <BulkOperationProgress
          id={result.id}
          adminSession={adminSession}
          onComplete={(operation) => {
            const url = operation?.url ?? ''
            const shortUrl = url.length > 50 ? `${url.slice(0, 15)}[...]${url.slice(-15)}` : url

            renderInfo({
              customSections: [
                {
                  title: 'Bulk operation complete!',
                  body: [
                    {
                      list: {
                        items: [
                          outputContent`ID: ${outputToken.cyan(operation?.id ?? '')}`.value,
                          outputContent`Status: ${outputToken.yellow(operation?.status ?? '')}`.value,
                          outputContent`Object count: ${outputToken.gray(String(operation?.objectCount ?? ''))}`.value,
                        ],
                      },
                    },
                    outputContent`\nDownload results: ${outputToken.link(shortUrl, url)}`.value,
                  ],
                },
              ],
            })
          }}
        />,
        {exitOnCtrlC: false},
      )
    } else {
      renderInfo({
        customSections: [
          {
            title: 'Bulk operation started!',
            body: [
              {
                list: {
                  items: [
                    outputContent`ID: ${outputToken.cyan(result.id)}`.value,
                    outputContent`Status: ${outputToken.yellow(result.status)}`.value,
                    outputContent`Created: ${outputToken.gray(String(result.createdAt))}`.value,
                  ],
                },
              },
            ],
          },
        ],
      })
    }
  }
}

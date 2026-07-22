import StoreReport from './report.js'
import {prepareStoreReport, runStoreReport, type PreparedStoreReport} from '../../services/store/report/index.js'
import {renderStoreReportResult} from '../../services/store/report/output.js'
import {generateStoreReportSpec, presentStoreReport} from '../../services/store/report/ui/index.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import type {StoreReportResult} from '../../services/store/report/types.js'

vi.mock('../../services/store/report/index.js')
vi.mock('../../services/store/report/output.js')
vi.mock('../../services/store/report/ui/index.js')
vi.mock('@shopify/cli-kit/node/ui')

const reportResult: StoreReportResult = {
  store: 'shop.myshopify.com',
  apiVersion: '2026-04',
  question: 'What were my sales?',
  rationale: 'A sales total.',
  queries: [{api: 'shopifyql', query: 'FROM sales SHOW total_sales', result: {rows: [{total_sales: 10}]}}],
}

const prepared: PreparedStoreReport = {
  context: {
    adminSession: {token: 'token', storeFqdn: 'shop.myshopify.com'},
    version: '2026-04',
    session: {
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: 'user-id',
      accessToken: 'token',
      scopes: [],
      acquiredAt: '2026-06-15T00:00:00Z',
    },
  },
  proxyConfig: {proxyBaseUrl: 'https://proxy.test/v1', proxyToken: 'synthetic-proxy-token', model: 'test-model'},
}

describe('store report command', () => {
  beforeEach(() => {
    vi.mocked(prepareStoreReport).mockResolvedValue(prepared)
    vi.mocked(runStoreReport).mockResolvedValue(reportResult)
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  })

  test('prepares the store before the bar and returns through the existing renderer in json mode', async () => {
    await StoreReport.run(['--store', 'shop.myshopify.com', '--analysis', 'What were my sales?', '--json'])

    expect(prepareStoreReport).toHaveBeenCalledWith({store: 'shop.myshopify.com', version: undefined})
    expect(runStoreReport).toHaveBeenCalledWith({
      prepared,
      analysis: 'What were my sales?',
      onProgress: expect.any(Function),
    })
    expect(renderStoreReportResult).toHaveBeenCalledWith(reportResult, 'json')
    expect(generateStoreReportSpec).not.toHaveBeenCalled()
    expect(presentStoreReport).not.toHaveBeenCalled()
  })

  test('generates the spec inside the bar and presents it after the bar closes in text mode', async () => {
    vi.mocked(generateStoreReportSpec).mockResolvedValue({spec: {root: 'x', elements: {}}})

    await StoreReport.run(['--store', 'shop.myshopify.com', '--analysis', 'What were my sales?'])

    expect(renderStoreReportResult).not.toHaveBeenCalled()
    expect(generateStoreReportSpec).toHaveBeenCalledWith({
      report: reportResult,
      proxyBaseUrl: 'https://proxy.test/v1',
      proxyToken: 'synthetic-proxy-token',
      model: 'test-model',
    })
    expect(presentStoreReport).toHaveBeenCalledWith(reportResult, {spec: {root: 'x', elements: {}}})
  })

  test('drives the single task bar title through onProgress, including a Building your report title before generation', async () => {
    vi.mocked(generateStoreReportSpec).mockResolvedValue({fallback: true})
    const titles: string[] = []
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task((status) => titles.push(status.value)))

    await StoreReport.run(['--store', 'shop.myshopify.com', '--analysis', 'What were my sales?'])

    expect(titles).toContain('Building your report')
  })
})

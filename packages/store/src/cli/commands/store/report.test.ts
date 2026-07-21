import StoreReport from './report.js'
import {readProxyConfig, runStoreReport} from '../../services/store/report/index.js'
import {renderStoreReportResult} from '../../services/store/report/output.js'
import {renderStoreReportUi} from '../../services/store/report/ui/index.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {StoreReportResult} from '../../services/store/report/types.js'

vi.mock('../../services/store/report/index.js')
vi.mock('../../services/store/report/output.js')
vi.mock('../../services/store/report/ui/index.js')

const reportResult: StoreReportResult = {
  store: 'shop.myshopify.com',
  apiVersion: '2026-04',
  question: 'What were my sales?',
  rationale: 'A sales total.',
  queries: [{api: 'shopifyql', query: 'FROM sales SHOW total_sales', result: {rows: [{total_sales: 10}]}}],
}

describe('store report command', () => {
  beforeEach(() => {
    vi.mocked(runStoreReport).mockResolvedValue(reportResult)
    vi.mocked(readProxyConfig).mockReturnValue({
      proxyBaseUrl: 'https://proxy.test/v1',
      proxyToken: 'synthetic-proxy-token',
      model: 'test-model',
    })
  })

  test('returns through the existing renderer without loading UI work in json mode', async () => {
    await StoreReport.run(['--store', 'shop.myshopify.com', '--analysis', 'What were my sales?', '--json'])

    expect(renderStoreReportResult).toHaveBeenCalledWith(reportResult, 'json')
    expect(readProxyConfig).not.toHaveBeenCalled()
    expect(renderStoreReportUi).not.toHaveBeenCalled()
  })

  test('re-reads proxy config and invokes the dynamically loaded UI in text mode', async () => {
    await StoreReport.run(['--store', 'shop.myshopify.com', '--analysis', 'What were my sales?'])

    expect(renderStoreReportResult).not.toHaveBeenCalled()
    expect(readProxyConfig).toHaveBeenCalledOnce()
    expect(renderStoreReportUi).toHaveBeenCalledWith({
      result: reportResult,
      proxyBaseUrl: 'https://proxy.test/v1',
      proxyToken: 'synthetic-proxy-token',
      model: 'test-model',
    })
  })
})

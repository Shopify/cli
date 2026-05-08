import FlowToolCall from './call.js'
import {callFlowTool} from '../../../services/flow/tool-call.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/flow/tool-call.js')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../../services/store/metrics.js')

describe('flow tool call command', () => {
  beforeEach(() => {
    vi.mocked(callFlowTool).mockResolvedValue({isError: false, content: []})
  })

  test('passes inline arguments through to the service and writes json output', async () => {
    await FlowToolCall.run([
      'flow_app_agent_template_search',
      '--store',
      'shop.myshopify.com',
      '--arguments',
      '{"search_queries":["fraud prevention"]}',
      '--json',
    ])

    expect(callFlowTool).toHaveBeenCalledWith({
      tool: 'flow_app_agent_template_search',
      store: 'shop.myshopify.com',
      arguments: '{"search_queries":["fraud prevention"]}',
      argumentsFile: undefined,
      endpoint: undefined,
    })
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({isError: false, content: []}, null, 2))
  })

  test('passes arguments file and endpoint through to the service', async () => {
    await FlowToolCall.run([
      'flow_app_agent_create_or_update_workflow_from_json',
      '--store',
      'shop.myshopify.com',
      '--arguments-file',
      './workflow.json',
      '--endpoint',
      'http://localhost:3000/flow/tools/call',
    ])

    expect(callFlowTool).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'flow_app_agent_create_or_update_workflow_from_json',
        store: 'shop.myshopify.com',
        arguments: undefined,
        argumentsFile: expect.stringMatching(/workflow\.json$/),
        endpoint: 'http://localhost:3000/flow/tools/call',
      }),
    )
  })

  test('defines the expected flags', () => {
    expect(FlowToolCall.flags.store).toBeDefined()
    expect(FlowToolCall.flags.arguments).toBeDefined()
    expect(FlowToolCall.flags['arguments-file']).toBeDefined()
    expect(FlowToolCall.flags.endpoint).toBeDefined()
    expect(FlowToolCall.flags.json).toBeDefined()
  })
})

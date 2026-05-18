import AgentConversationInspect from './inspect.js'
import {describe, expect, test, vi} from 'vitest'
import {inspectAgentConversation} from '@shopify/cli-kit/node/agent'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/agent')

describe('agent conversation inspect command', () => {
  test('prints conversation details', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(inspectAgentConversation).mockResolvedValue({
      conversationId: 'conv_123',
      contextPath: '/tmp/agent.json',
      agent: 'pi',
      agentVersion: '0.70.2',
      provider: 'shopify',
      harness: 'pi',
      model: 'gpt-5',
      startedAt: '2026-05-01T00:00:00.000Z',
    })

    await AgentConversationInspect.run([])

    expect(inspectAgentConversation).toHaveBeenCalledWith({contextPath: undefined})
    expect(outputMock.output()).toContain('Shopify agent conversation conv_123')
    expect(outputMock.output()).toContain('Context path: /tmp/agent.json')
    expect(outputMock.output()).toContain('Provider: shopify')
  })
})

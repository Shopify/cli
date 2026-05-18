import AgentConversationEnd from './end.js'
import {describe, expect, test, vi} from 'vitest'
import {endAgentConversation} from '@shopify/cli-kit/node/agent'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/agent')

describe('agent conversation end command', () => {
  test('ends a conversation and prints json when requested', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(endAgentConversation).mockResolvedValue({
      conversationId: 'conv_123',
      contextPath: '/tmp/agent.json',
      agent: 'pi',
      agentVersion: '0.70.2',
      provider: 'shopify',
      harness: 'pi',
      model: 'gpt-5',
      startedAt: '2026-05-01T00:00:00.000Z',
    })

    await AgentConversationEnd.run(['--json'])

    expect(endAgentConversation).toHaveBeenCalledWith({contextPath: undefined})
    expect(outputMock.output()).toContain('"ended": true')
    expect(outputMock.output()).toContain('"conversationId": "conv_123"')
  })
})

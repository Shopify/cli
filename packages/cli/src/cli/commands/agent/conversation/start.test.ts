import AgentConversationStart from './start.js'
import {describe, expect, test, vi} from 'vitest'
import {startAgentConversation} from '@shopify/cli-kit/node/agent'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/agent')

describe('agent conversation start command', () => {
  test('starts a conversation and prints json when requested', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(startAgentConversation).mockResolvedValue({
      conversationId: 'conv_123',
      contextPath: '/tmp/agent.json',
      agent: 'pi',
      agentVersion: '0.70.2',
      provider: 'shopify',
      harness: 'pi',
      model: 'gpt-5',
      startedAt: '2026-05-01T00:00:00.000Z',
    })

    await AgentConversationStart.run(['--json', '--agent', 'pi', '--provider', 'shopify'])

    expect(startAgentConversation).toHaveBeenCalledWith({
      conversationId: undefined,
      agent: 'pi',
      agentVersion: undefined,
      provider: 'shopify',
      harness: undefined,
      model: undefined,
    })
    expect(outputMock.output()).toContain('"conversationId": "conv_123"')
    expect(outputMock.output()).toContain('"contextPath": "/tmp/agent.json"')
  })

  test('documents the conversation-id flag', () => {
    expect(AgentConversationStart.flags['conversation-id']).toBeDefined()
    expect(AgentConversationStart.flags['conversation-id'].env).toBe('CONVERSATION_ID')
  })
})

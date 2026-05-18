import {
  SHOPIFY_CLI_AGENT,
  SHOPIFY_CLI_AGENT_CONTEXT,
  SHOPIFY_CLI_AGENT_PROVIDER,
  SHOPIFY_CLI_AGENT_RUN_ID,
  SHOPIFY_CLI_AGENT_SESSION_ID,
  SHOPIFY_CLI_AGENT_VERSION,
  createAgentConversationContext,
  endAgentConversation,
  generateConversationId,
  inspectAgentConversation,
  resolveShopifyAgentEnvironmentVariables,
  startAgentConversation,
} from './agent.js'
import * as crypto from './crypto.js'
import {fileExists} from './fs.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./crypto.js')

describe('agent conversation helpers', () => {
  test('generates prefixed conversation IDs', () => {
    vi.mocked(crypto.randomUUID).mockReturnValue('uuid-123')

    expect(generateConversationId()).toBe('conv_uuid-123')
  })

  test('creates conversation contexts with generated defaults', () => {
    vi.mocked(crypto.randomUUID).mockReturnValue('uuid-123')

    expect(createAgentConversationContext({provider: 'anthropic'})).toMatchObject({
      conversationId: 'conv_uuid-123',
      provider: 'anthropic',
    })
  })

  test('starts, inspects, and ends an agent conversation', async () => {
    vi.mocked(crypto.randomUUID).mockReturnValue('uuid-123')

    const started = await startAgentConversation({
      agent: 'pi',
      agentVersion: '0.70.2',
      provider: 'shopify',
      harness: 'pi',
      model: 'gpt-5',
    })

    expect(started).toMatchObject({
      conversationId: 'conv_uuid-123',
      agent: 'pi',
      agentVersion: '0.70.2',
      provider: 'shopify',
      harness: 'pi',
      model: 'gpt-5',
    })
    expect(await fileExists(started.contextPath)).toBe(true)

    const inspected = await inspectAgentConversation({contextPath: started.contextPath})
    expect(inspected).toEqual(started)

    await endAgentConversation({contextPath: started.contextPath})
    expect(await fileExists(started.contextPath)).toBe(false)
  })

  test('resolves explicit and conversation-backed SHOPIFY environment variables', async () => {
    const started = await startAgentConversation({
      conversationId: 'conv_existing',
      agent: 'pi',
      agentVersion: '0.70.2',
      provider: 'shopify',
    })

    const resolved = await resolveShopifyAgentEnvironmentVariables({
      [SHOPIFY_CLI_AGENT_CONTEXT]: started.contextPath,
      [SHOPIFY_CLI_AGENT_RUN_ID]: 'run-123',
      [SHOPIFY_CLI_AGENT]: 'override-agent',
    })

    expect(resolved).toMatchObject({
      [SHOPIFY_CLI_AGENT_CONTEXT]: started.contextPath,
      [SHOPIFY_CLI_AGENT_SESSION_ID]: 'conv_existing',
      [SHOPIFY_CLI_AGENT_PROVIDER]: 'shopify',
      [SHOPIFY_CLI_AGENT_VERSION]: '0.70.2',
      [SHOPIFY_CLI_AGENT_RUN_ID]: 'run-123',
      [SHOPIFY_CLI_AGENT]: 'override-agent',
    })

    await endAgentConversation({contextPath: started.contextPath})
  })
})

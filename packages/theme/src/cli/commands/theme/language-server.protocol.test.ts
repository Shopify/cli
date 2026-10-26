import {expect, test} from 'vitest'
// The protocol test needs bidirectional pipes and the native process exit code.
// eslint-disable-next-line no-restricted-imports
import {spawn} from 'node:child_process'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'

interface RpcMessage {
  jsonrpc: string
  id?: number | string
  result?: unknown
  error?: {code: number; message: string}
}

function startLanguageServer() {
  const serverModule = pathToFileURL(createRequire(import.meta.url).resolve('@shopify/theme-language-server-node')).href
  const child = spawn(process.execPath, [
    '--input-type=module',
    '--eval',
    `const {startServer} = await import(${JSON.stringify(serverModule)}); startServer(); console.error('LSP started');`,
  ])
  let bytes = Buffer.alloc(0)
  let stderr = ''
  const messages: RpcMessage[] = []
  const waiters = new Map<number | string, (message: RpcMessage) => void>()
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once('close', resolve)
    child.once('error', reject)
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })
  child.stdout.on('data', (chunk: Buffer) => {
    bytes = Buffer.concat([bytes, chunk])
    for (;;) {
      const headerEnd = bytes.indexOf('\r\n\r\n')
      if (headerEnd === -1) return
      const header = bytes.subarray(0, headerEnd).toString()
      const length = /^Content-Length: (\d+)$/im.exec(header)?.[1]
      expect(length, header).toBeDefined()
      const end = headerEnd + 4 + Number(length)
      if (bytes.length < end) return
      const message = JSON.parse(bytes.subarray(headerEnd + 4, end).toString()) as RpcMessage
      bytes = bytes.subarray(end)
      messages.push(message)
      if (message.id !== undefined) waiters.get(message.id)?.(message)
    }
  })

  function send(message: object, fragmented = false) {
    const body = Buffer.from(JSON.stringify(message))
    const frame = Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body])
    if (fragmented) {
      child.stdin.write(frame.subarray(0, 9))
      child.stdin.write(frame.subarray(9, frame.length - 1))
      child.stdin.write(frame.subarray(frame.length - 1))
    } else {
      child.stdin.write(frame)
    }
  }

  async function request(id: number | string, method: string, params: object | null = null) {
    const response = new Promise<RpcMessage>((resolve) => waiters.set(id, resolve))
    send({jsonrpc: '2.0', id, method, params}, true)
    return response
  }

  return {child, exited, request, send, messages, remaining: () => bytes, stderr: () => stderr}
}

test('preserves native LSP framing, IDs, errors, cancellation notifications, and shutdown', async () => {
  const server = startLanguageServer()
  try {
    const initialized = await server.request('initialize-1', 'initialize', {
      processId: null,
      rootUri: null,
      capabilities: {},
      clientInfo: {name: 'Thème editor'},
    })
    expect(initialized).toMatchObject({jsonrpc: '2.0', id: 'initialize-1', result: {capabilities: {}}})

    const unknown = await server.request(2, 'unknown/request')
    expect(unknown).toMatchObject({jsonrpc: '2.0', id: 2, error: {code: -32601}})
    server.send({jsonrpc: '2.0', method: '$/cancelRequest', params: {id: 2}})

    const hover = server.request('hover-3', 'textDocument/hover', {
      textDocument: {uri: 'file:///missing.liquid'},
      position: {line: 0, character: 0},
    })
    server.send({jsonrpc: '2.0', method: '$/cancelRequest', params: {id: 'hover-3'}})
    await expect(hover).resolves.toMatchObject({jsonrpc: '2.0', id: 'hover-3'})

    await expect(server.request(4, 'shutdown')).resolves.toEqual({jsonrpc: '2.0', id: 4, result: null})
    server.send({jsonrpc: '2.0', method: 'exit'})
    await expect(server.exited).resolves.toBe(0)
    expect(server.messages.map(({id}) => id)).toEqual(['initialize-1', 2, 'hover-3', 4])
    expect(server.remaining()).toHaveLength(0)
    expect(server.stderr()).toContain('LSP started')
  } finally {
    server.child.kill()
    await server.exited
  }
})

test('preserves the native failure exit when exit precedes shutdown', async () => {
  const server = startLanguageServer()
  try {
    server.send({jsonrpc: '2.0', method: 'exit'})
    await expect(server.exited).resolves.toBe(1)
    expect(server.messages).toEqual([])
    expect(server.remaining()).toHaveLength(0)
  } finally {
    server.child.kill()
    await server.exited
  }
})

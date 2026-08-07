import * as fs from 'fs'
import * as path from 'path'
import {exec, expectSuccess, freePort, httpRequest, retry, spawnPty, tail} from '../proc.js'
import type {PtyProcess} from '../proc.js'
import type {SectionDef} from '../types.js'

/** Probe both address families — MiniOxygen may bind IPv6 ::1 or IPv4 127.0.0.1. */
async function probeLocalhost(port: number): Promise<{status: number; body: string; url: string}> {
  const urls = [`http://127.0.0.1:${port}/`, `http://[::1]:${port}/`]
  let lastError: unknown
  for (const url of urls) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await httpRequest(url, {timeoutMs: 20_000})
      return {...response, url}
    } catch (error) {
      lastError = error
    }
  }
  const message =
    lastError instanceof Error ? (lastError.cause instanceof Error ? lastError.cause.message : lastError.message) : String(lastError)
  throw new Error(`probe of port ${port} failed on IPv4 and IPv6: ${message}`)
}

/**
 * Press Enter on every prompt until `until` matches the output (the QA doc says
 * "choose default answers to all questions"). A prompt is considered pending
 * when new output containing a question indicator appeared and stayed quiet.
 */
async function answerDefaultsUntil(proc: PtyProcess, until: RegExp, timeoutMs: number): Promise<void> {
  const startedAt = Date.now()
  let lastLength = 0
  let quietSince = Date.now()
  let lastAnsweredLength = -1

  while (Date.now() - startedAt < timeoutMs) {
    if (until.test(proc.output())) return
    if (proc.exited) {
      if (until.test(proc.output())) return
      throw new Error(`hydrogen init exited before completing\n${tail(proc.output())}`)
    }

    const length = proc.output().length
    if (length !== lastLength) {
      lastLength = length
      quietSince = Date.now()
    } else if (Date.now() - quietSince > 2000 && length !== lastAnsweredLength) {
      // Output has been quiet for 2s — if a prompt is on screen, accept the default.
      const recent = proc.output().slice(-2000)
      if (/\?|❯|›|Yes|No|\(y\/n\)/i.test(recent)) {
        proc.write('\r')
        lastAnsweredLength = length
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out driving hydrogen init prompts\n${tail(proc.output())}`)
}

function hydrogenDirOrThrow(ctx: {state: {hydrogenDir?: string}}): string {
  const dir = ctx.state.hydrogenDir
  if (!dir) throw new Error('No hydrogen project (hydrogen init did not succeed)')
  return dir
}

export const hydrogenSection: SectionDef = {
  title: 'Hydrogen',
  steps: [
    {
      id: 'hydrogen.init',
      doc: 'Create a Hydrogen app: `shopify hydrogen init` and choose default answers to all questions',
      kind: 'auto',
      run: async (ctx) => {
        const dir = path.join(ctx.workDir, 'qa-hydrogen')
        const proc = spawnPty(ctx, ['hydrogen', 'init', '--path', dir], {cwd: ctx.workDir})
        // "Storefront setup complete!" is the definitive end-of-init marker; the
        // deps install between the last prompt and this box can take many minutes.
        await answerDefaultsUntil(proc, /Storefront setup complete!|Next steps/, 20 * 60_000)
        await proc.waitForExit(5 * 60_000)
        if (!fs.existsSync(dir)) throw new Error(`Hydrogen project not created at ${dir}\n${tail(proc.output())}`)
        ctx.state.hydrogenDir = dir
        return 'hydrogen project scaffolded with default answers'
      },
    },
    {
      id: 'hydrogen.build',
      doc: 'cd into the hydrogen project and run `shopify hydrogen build`',
      kind: 'auto',
      run: async (ctx) => {
        expectSuccess(
          await exec(ctx, ['hydrogen', 'build'], {cwd: hydrogenDirOrThrow(ctx), timeoutMs: 10 * 60_000}),
          'hydrogen build',
        )
        return 'hydrogen build succeeded'
      },
    },
    {
      id: 'hydrogen.dev',
      doc: 'Run `shopify hydrogen dev`; follow the "View Hydrogen app" link and confirm you can see a storefront',
      kind: 'auto',
      run: async (ctx) => {
        // Pin the port so the probe is deterministic even if something else
        // occupies hydrogen's default 3000.
        const port = await freePort()
        const proc = spawnPty(ctx, ['hydrogen', 'dev', '--port', String(port)], {cwd: hydrogenDirOrThrow(ctx)})
        await proc.waitFor(new RegExp(`View [\\w ]*app:|localhost:${port}`, 'i'), {timeoutMs: 5 * 60_000})
        const response = await retry(async () => {
          const res = await probeLocalhost(port)
          if (res.status >= 500) throw new Error(`storefront returned HTTP ${res.status}`)
          return res
        }, 10, 5000)
        if (!/<!doctype html|<html/i.test(response.body)) {
          throw new Error(`Storefront at ${response.url} did not return HTML (HTTP ${response.status})`)
        }
        // "Stop it with CTRL+C"
        proc.write('\u0003')
        await proc.waitForExit(60_000).catch(() => proc.kill())
        return `storefront responded at ${response.url} (HTTP ${response.status}); stopped with CTRL+C`
      },
    },
  ],
}

export const crossOSSection: SectionDef = {
  title: 'Linux & Windows',
  steps: [
    {
      id: 'cross-os.matrix',
      doc: 'Run the same QA flow above for linux and windows platforms',
      kind: 'manual',
      reason: 'covered by the workflow OS matrix — rollout starts with macOS, linux/windows follow',
    },
  ],
}

import { atom, read, update } from 'claude-code'
import type { Hook, Register } from 'claude-code'

import type { RenderedMath } from '../types'
import { hasMath, split, toUnicode } from './latex'

type Engine = Parameters<Hook<'ui.render'>>[0]

const isEnabled = atom({ plugin: 'latex', key: 'isEnabled' } as const, true)

// Per-load caches: TeX source -> rendered PNG. The PNGs persist on disk, so a
// reload re-reads them from the renderer's cache without re-rendering.
const rendered = new Map<string, RenderedMath>()
const settings = { color: '#e6e6e6', scale: 1, cacheDir: '', isRendererBroken: false }

/** Fills in the cache folder and, with color "auto", the theme's ink. */
async function ensureSettings($: Engine, isAutoColor: boolean) {
  if (settings.cacheDir !== '') return
  settings.cacheDir = `${(await $.env.get('HOME')) ?? '/tmp'}/.cache/claude-latex`
  if (isAutoColor) {
    const theme = (await $.config.list()).find(row => row.key === 'theme')
    settings.color = String(theme?.value ?? 'dark').startsWith('light') ? '#1a1a1a' : '#e6e6e6'
  }
}

/** Renders every TeX source not yet cached, in one renderer run. */
async function renderAll($: Engine, sources: string[]) {
  const missing = [...new Set(sources)].filter(tex => !rendered.has(tex))
  if (missing.length === 0 || settings.isRendererBroken) return
  const stdin = JSON.stringify({
    outDir: settings.cacheDir,
    color: settings.color,
    scale: settings.scale,
    items: missing.map((tex, id) => ({ id: String(id), tex })),
  })
  const ran = await $.process
    .run(['node', `${$.plugin.root}/renderer/render.mjs`], { stdin, timeoutMs: 20_000 })
    .catch(() => undefined)
  if (ran === undefined || ran.exitCode !== 0) {
    settings.isRendererBroken = true
    $.ui.toast('LaTeX renderer failed; run /latex setup')
    return
  }
  const results = JSON.parse(ran.stdout) as Array<{ id: string } & RenderedMath>
  for (const { id, ...result } of results) rendered.set(missing[Number(id)]!, result as RenderedMath)
}

export const register: Register = (on, options) => {
  const isAutoColor = typeof options.color !== 'string' || options.color === 'auto'
  if (!isAutoColor) settings.color = String(options.color)
  if (typeof options.scale === 'number' && options.scale > 0) settings.scale = options.scale

  on('session.start', async ($, e, next) => {
    await ensureSettings($, isAutoColor)
    await $.command.register({
      name: 'latex',
      description: 'LaTeX rendering: /latex on, /latex off, /latex setup (install the renderer)',
    })
    return next(e)
  })

  on('command.run', { command: 'latex' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'on' || arg === 'off') {
      await update($, isEnabled, () => arg === 'on')
      return { text: `LaTeX rendering ${arg}.` }
    }
    if (arg === 'setup') {
      const ran = await $.process.run(['npm', 'install', '--no-fund', '--no-audit'], {
        cwd: `${$.plugin.root}/renderer`,
        timeoutMs: 300_000,
      })
      settings.isRendererBroken = ran.exitCode !== 0
      rendered.clear()
      return { text: ran.exitCode === 0 ? 'LaTeX renderer installed.' : `npm install failed:\n${ran.stderr}` }
    }
    const state = (await read($, isEnabled)) ? 'on' : 'off'
    const broken = settings.isRendererBroken ? ' (renderer unavailable: run /latex setup)' : ''
    return { text: `LaTeX rendering is ${state}${broken}.` }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !hasMath(e.props.text)) return next(e)
    if (!(await read($, isEnabled))) return next(e)
    await ensureSettings($, isAutoColor)

    const segments = split(e.props.text)
    await renderAll($, segments.flatMap(seg => (seg.kind === 'math' ? [seg.tex] : [])))

    const { Box, Markdown, Image } = $.ui.resolve(e)
    const room = Math.max(10, (e.viewport?.columns ?? 80) - 4)

    return (
      <Box flexDirection="column" rowGap={1}>
        {segments.map(seg => {
          if (seg.kind === 'text') return <Markdown text={seg.text} />
          const result = rendered.get(seg.tex)
          // TeX MathJax rejects stays as source; with no renderer, Unicode.
          if (result !== undefined && 'error' in result) return <Markdown text={'```latex\n' + seg.tex + '\n```'} />
          if (result === undefined) return <Markdown text={'    ' + toUnicode(seg.tex)} />
          const shrink = Math.min(1, room / result.columns)
          return (
            <Image
              source={{ file: result.file, format: 'png' }}
              columns={Math.max(1, Math.floor(result.columns * shrink))}
              rows={Math.max(1, Math.round(result.rows * shrink))}
              alt={toUnicode(seg.tex)}
            />
          )
        })}
      </Box>
    )
  })
}

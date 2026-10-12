import { expect, test } from 'claude-code/testing'

import { hasMath, split, toUnicode } from '../hooks/latex'

const REPLY = [
  'The Gaussian integral, with $\\alpha^2$ inline:',
  '',
  '$$\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$',
  '',
  'That costs $5 and $6, and `$not math$` is code.',
].join('\n')

test('splits prose from display math, leaving code and prices alone', () => {
  const segments = split(REPLY)
  expect(segments.map(s => s.kind)).toEqual(['text', 'math', 'text'])
  expect(segments[0]).toEqual({ kind: 'text', text: 'The Gaussian integral, with α² inline:' })
  expect(segments[2]).toEqual({ kind: 'text', text: 'That costs $5 and $6, and `$not math$` is code.' })
})

test('takes \\[ \\] and align environments as display math', () => {
  expect(split('a\n\\[x+y\\]\nb').map(s => s.kind)).toEqual(['text', 'math', 'text'])
  const env = '\\begin{align*} a &= b \\\\ c &= d \\end{align*}'
  expect(split(env)).toEqual([{ kind: 'math', tex: env }])
})

test('leaves fenced code blocks untouched', () => {
  const md = '```tex\n$$x$$\n```'
  expect(split(md)).toEqual([{ kind: 'text', text: md }])
  expect(hasMath(md)).toBe(false)
})

test('turns inline TeX into Unicode', () => {
  expect(toUnicode('\\frac{a+b}{2}')).toBe('(a+b)/2')
  expect(toUnicode('x_i^2 \\le \\sqrt{n}')).toBe('xᵢ² ≤ √n')
  expect(toUnicode('\\forall x \\in \\mathbb{R}')).toBe('∀ x ∈ ℝ')
  expect(toUnicode('\\sum_{k=1}^{n} k')).toBe('∑ₖ₌₁ⁿ k')
})

test('draws display math as an Image on the terminal, sized to the viewport', async ($, on) => {
  let renders = 0
  on('env.get', () => ({ value: '/home/someone' }))
  on('config.list', () => ({ value: [] }))
  on('process.run', ($, e) => {
    renders++
    const items = JSON.parse(e.init?.stdin ?? '{}').items as { id: string }[]
    const out = items.map(({ id }) => ({ id, file: `/home/someone/.cache/claude-latex/${id}.png`, columns: 200, rows: 6 }))
    const stdout = JSON.stringify(out)
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const ui = await $.ui.mount({
    plugin: 'latex',
    surface: 'terminal',
    component: 'AssistantMessage',
    viewport: { columns: 100, rows: 40 },
    props: { text: REPLY, isFirstOfReply: true },
  })
  expect(await ui.findAll({ type: 'Markdown' })).toHaveLength(2)
  expect(await ui.drawn()).toMatchObject({
    type: 'Box',
    children: [{ type: 'Markdown' }, { type: 'Image', props: { columns: 96, rows: 3 } }, { type: 'Markdown' }],
  })
  await ui.redraw()
  expect(renders).toBe(1)
})

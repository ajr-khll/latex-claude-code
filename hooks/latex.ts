// Pure text handling: splitting a markdown reply into prose and display math,
// and turning inline math into Unicode the terminal can draw as text.

export type Segment = { kind: 'text'; text: string } | { kind: 'math'; tex: string }

const ENVS = 'equation|align|gather|multline|alignat|flalign|eqnarray|displaymath'
const DISPLAY = new RegExp(
  [
    String.raw`\$\$([\s\S]+?)\$\$`,
    String.raw`\\\[([\s\S]+?)\\\]`,
    String.raw`(\\begin\{(${ENVS})\*?\}[\s\S]+?\\end\{\4\*?\})`,
  ].join('|'),
  'g',
)

// Fenced code blocks and inline code spans are left exactly as written.
const CODE = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(\n\2[^\n]*(?=\n|$)|$)|`[^`\n]+`/g

/** Splits markdown into prose and display-math segments, code untouched. */
export function split(markdown: string): Segment[] {
  const out: Segment[] = []
  let prose = ''
  const flush = () => {
    if (prose.trim() !== '') out.push({ kind: 'text', text: prose.replace(/^\n+|\n+$/g, '') })
    prose = ''
  }
  const scanProse = (chunk: string) => {
    let last = 0
    for (const m of chunk.matchAll(DISPLAY)) {
      prose += inline(chunk.slice(last, m.index))
      const tex = (m[1] ?? m[2] ?? m[3] ?? '').trim()
      if (tex === '') {
        prose += m[0]
      } else {
        flush()
        // Environments go to MathJax whole; align & co. need no wrapper.
        out.push({ kind: 'math', tex })
      }
      last = m.index! + m[0].length
    }
    prose += inline(chunk.slice(last))
  }
  let last = 0
  for (const m of markdown.matchAll(CODE)) {
    scanProse(markdown.slice(last, m.index))
    prose += m[0]
    last = m.index! + m[0].length
  }
  scanProse(markdown.slice(last))
  flush()
  return out
}

/** True when the markdown holds any math this mod changes. */
export function hasMath(markdown: string): boolean {
  const bare = markdown.replace(CODE, '')
  return new RegExp(DISPLAY.source).test(bare) || new RegExp(INLINE.source).test(bare)
}

// $x$ (not $$, not "$5 and $6"): no space just inside, no digit right after.
const INLINE = /(?<![\\$\w])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\d$])|\\\(([\s\S]+?)\\\)/g

/** Replaces inline math in prose with its Unicode approximation. */
export function inline(prose: string): string {
  return prose.replace(INLINE, (_, a: string | undefined, b: string | undefined) => toUnicode(a ?? b ?? ''))
}

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
  Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', ast: '∗', star: '⋆', circ: '∘', bullet: '•',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', sim: '∼', simeq: '≃',
  cong: '≅', equiv: '≡', propto: '∝', ll: '≪', gg: '≫', prec: '≺', succ: '≻',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇',
  cup: '∪', cap: '∩', setminus: '∖', emptyset: '∅', varnothing: '∅', forall: '∀', exists: '∃',
  nexists: '∄', neg: '¬', lnot: '¬', land: '∧', wedge: '∧', lor: '∨', vee: '∨', oplus: '⊕',
  otimes: '⊗', to: '→', rightarrow: '→', leftarrow: '←', gets: '←', leftrightarrow: '↔',
  Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', implies: '⟹', iff: '⟺', mapsto: '↦',
  uparrow: '↑', downarrow: '↓', infty: '∞', partial: '∂', nabla: '∇', sum: '∑', prod: '∏',
  coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮', sqrt: '√', angle: '∠', perp: '⊥',
  parallel: '∥', mid: '∣', ldots: '…', cdots: '⋯', dots: '…', vdots: '⋮', ddots: '⋱',
  hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', wp: '℘', prime: '′', degree: '°',
  langle: '⟨', rangle: '⟩', lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋', top: '⊤', bot: '⊥',
  vdash: '⊢', models: '⊨', dagger: '†', triangle: '△', square: '□', checkmark: '✓',
  quad: ' ', qquad: '  ', ',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ', '{': '{', '}': '}',
  '%': '%', '$': '$', '&': '&', '#': '#', '_': '_', '|': '‖', lbrace: '{', rbrace: '}',
  lvert: '|', rvert: '|', vert: '|', Vert: '‖', backslash: '\\',
}
const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'dim', 'ker', 'gcd', 'deg', 'arg',
  'Pr', 'mod', 'bmod',
])
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ',
  f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ',
  s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ', T: 'ᵀ', '*': '*', '′': '′',
  ' ': ' ', 'α': 'ᵅ', 'β': 'ᵝ', 'γ': 'ᵞ', 'θ': 'ᶿ', 'ϕ': 'ᵠ', 'φ': 'ᵠ', 'χ': 'ᵡ',
}
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ',
  k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
  ' ': ' ', 'β': 'ᵦ', 'γ': 'ᵧ', 'ρ': 'ᵨ', 'ϕ': 'ᵩ', 'φ': 'ᵩ', 'χ': 'ᵪ',
}
const BB: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ', H: 'ℍ', E: '𝔼', F: '𝔽', '1': '𝟙' }
const CAL: Record<string, string> = {
  A: '𝒜', B: 'ℬ', C: '𝒞', D: '𝒟', E: 'ℰ', F: 'ℱ', G: '𝒢', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', N: '𝒩',
  O: '𝒪', P: '𝒫', R: 'ℛ', S: '𝒮', T: '𝒯', U: '𝒰', X: '𝒳',
}
const ACCENT: Record<string, string> = { hat: '̂', bar: '̄', overline: '̅', tilde: '̃', vec: '⃗', dot: '̇', ddot: '̈' }

/** A best-effort Unicode rendering of a TeX math fragment. */
export function toUnicode(tex: string): string {
  let i = 0
  const s = tex
  const group = (): string => {
    while (s[i] === ' ') i++
    if (s[i] === '{') {
      let depth = 1
      const start = ++i
      while (i < s.length && depth > 0) {
        if (s[i] === '\\') i++
        else if (s[i] === '{') depth++
        else if (s[i] === '}') depth--
        i++
      }
      return s.slice(start, i - 1)
    }
    if (s[i] === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i))
      i += m ? m[0].length : 1
      return m ? m[0] : ''
    }
    return s[i++] ?? ''
  }
  const script = (body: string, table: Record<string, string>, mark: string) => {
    const plain = toUnicode(body)
    const chars = [...plain]
    if (chars.every(c => table[c] !== undefined)) return chars.map(c => table[c]).join('')
    return chars.length === 1 ? mark + plain : `${mark}(${plain})`
  }
  const wrap = (x: string) => (/^[\w.′]+$|^\(.*\)$/u.test(x) || [...x].length === 1 ? x : `(${x})`)
  let out = ''
  while (i < s.length) {
    const c = s[i]
    if (c === '^' || c === '_') {
      i++
      out += script(group(), c === '^' ? SUP : SUB, c)
    } else if (c === '{' || c === '}') {
      out += c === '{' ? toUnicode(group()) : ''
      if (c === '}') i++
    } else if (c === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i))!
      i += m[0].length
      const name = m[1]!
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const a = toUnicode(group())
        const b = toUnicode(group())
        out += `${wrap(a)}/${wrap(b)}`
      } else if (name === 'sqrt') {
        let root = ''
        if (s[i] === '[') {
          const end = s.indexOf(']', i)
          root = s.slice(i + 1, end)
          i = end + 1
        }
        const body = toUnicode(group())
        const sign = root === '3' ? '∛' : root === '4' ? '∜' : (root ? script(root, SUP, '^') : '') + '√'
        out += sign + wrap(body)
      } else if (name === 'mathbb') {
        out += [...toUnicode(group())].map(ch => BB[ch] ?? ch).join('')
      } else if (name === 'mathcal' || name === 'mathscr') {
        out += [...toUnicode(group())].map(ch => CAL[ch] ?? ch).join('')
      } else if (/^(text|mathrm|mathbf|mathit|mathsf|mathtt|operatorname|textbf|textit|boldsymbol|mbox)$/.test(name)) {
        const body = group()
        out += /^(text|mbox|textbf|textit)$/.test(name) ? body : toUnicode(body)
      } else if (ACCENT[name]) {
        const body = toUnicode(group())
        out += [...body].length === 1 ? body + ACCENT[name] : `${name}(${body})`
      } else if (/^(left|right|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr|displaystyle|textstyle|limits|nolimits)$/.test(name)) {
        // sizing only
      } else if (name === 'binom' || name === 'tbinom') {
        out += `C(${toUnicode(group())}, ${toUnicode(group())})`
      } else if (FUNCTIONS.has(name)) {
        out += name.replace(/^b(?=mod)/, '')
      } else if (SYMBOLS[name] !== undefined) {
        out += SYMBOLS[name]
      } else {
        out += name
      }
    } else if (c === '~') {
      out += ' '
      i++
    } else if (c === '-') {
      out += '−'
      i++
    } else if (c === "'") {
      out += '′'
      i++
    } else {
      out += c
      i++
    }
  }
  return out
}

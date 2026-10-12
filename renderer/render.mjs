// LaTeX -> PNG renderer for the latex mod.
// stdin: {"outDir": "...", "color": "#rrggbb", "cellAspect": 2.0, "scale": 1.0, "items": [{"id": "...", "tex": "..."}]}
// stdout: [{"id", "file", "columns", "rows"} | {"id", "error"}]
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'
import { Resvg } from '@resvg/resvg-js'

const req = JSON.parse(readFileSync(0, 'utf8'))
const color = req.color ?? '#e6e6e6'
const cellAspect = req.cellAspect ?? 2.0 // cell height / cell width
const scale = req.scale ?? 1.0
const outDir = req.outDir
mkdirSync(outDir, { recursive: true })

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)
const doc = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages.filter(p => p !== 'bussproofs') }),
  OutputJax: new SVG({ fontCache: 'local' }),
})

// One terminal column is taken as ~1.1ex of display math; px per column fixed.
const EX_PER_COL = 1.1 / scale
const PX_PER_COL = 20

const out = []
for (const { id, tex, display = true } of req.items) {
  try {
    const key = createHash('sha256')
      .update(JSON.stringify([tex, display, color, cellAspect, scale, 2]))
      .digest('hex')
      .slice(0, 24)
    const file = join(outDir, key + '.png')
    const meta = join(outDir, key + '.json')
    if (existsSync(file) && existsSync(meta)) {
      out.push({ id, file, ...JSON.parse(readFileSync(meta, 'utf8')) })
      continue
    }
    const node = doc.convert(tex, { display })
    let svg = adaptor.innerHTML(node)
    if (svg.includes('data-mjx-error') || svg.includes('merror')) {
      const m = svg.match(/data-mjx-error="([^"]*)"/)
      throw new Error(m ? m[1] : 'TeX error')
    }
    const wEx = parseFloat(svg.match(/width="([\d.]+)ex"/)[1])
    const hEx = parseFloat(svg.match(/height="([\d.]+)ex"/)[1])
    const columns = Math.max(1, Math.min(255, Math.ceil(wEx / EX_PER_COL)))
    const rows = Math.max(1, Math.min(255, Math.ceil(hEx / EX_PER_COL / cellAspect)))
    // Canvas exactly the box's aspect, the formula centered, so no stretch.
    const boxW = columns * PX_PER_COL
    const boxH = Math.round(rows * PX_PER_COL * cellAspect)
    const fitW = (wEx / EX_PER_COL) * PX_PER_COL
    const fitH = (hEx / EX_PER_COL) * PX_PER_COL
    svg = svg
      .replace(/currentColor/g, color)
      .replace(/width="[\d.]+ex"/, `width="${fitW}"`)
      .replace(/height="[\d.]+ex"/, `height="${fitH}"`)
      .replace(/style="[^"]*"/, '')
    const offX = 0
    const offY = (boxH - fitH) / 2
    const wrapped =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}">` +
      `<g transform="translate(${offX},${offY})">${svg}</g></svg>`
    const png = new Resvg(wrapped, { background: 'rgba(0,0,0,0)' }).render().asPng()
    writeFileSync(file, png)
    writeFileSync(meta, JSON.stringify({ columns, rows }))
    out.push({ id, file, columns, rows })
  } catch (err) {
    out.push({ id, error: String(err?.message ?? err) })
  }
}
process.stdout.write(JSON.stringify(out))

# latex-claude-code

A Claude Code mod that renders LaTeX math in Claude's replies, right in the terminal.

- **Display math** (`$$…$$`, `\[…\]`, `equation`, `align`, `gather`, … environments) is rendered to an image with MathJax and drawn inline via the kitty graphics protocol (kitty, Ghostty).
- **Inline math** (`$…$`, `\(…\)`) becomes Unicode: `$x_i^2 \le \sqrt{n}$` → `xᵢ² ≤ √n`. Prices like `$5 and $6` and anything in code are left alone.
- Terminals without the kitty graphics protocol get a Unicode approximation of each equation instead.

No TeX install needed: rendering is MathJax + resvg on Node.

## Install

Requires Node.js on your `PATH`.

```
/plugin install latex --marketplace ajr-khll/latex-claude-code
```

Answer `y` to add the marketplace, pick a scope, then install the renderer's dependencies once:

```
/latex setup
```

## Usage

| Command | Does |
| --- | --- |
| `/latex` | Show whether rendering is on |
| `/latex on` / `/latex off` | Toggle rendering |
| `/latex setup` | Install or reinstall the renderer's npm dependencies |

Options in `/config`:

- **Equation color**: `auto` (follows a light or dark theme) or a hex color like `#c0caf5`
- **Equation scale**: size multiplier for display math (default `1`)

Rendered images are cached in `~/.cache/claude-latex`.

## Limitations

- Equations render once their message block is complete, not while the reply is streaming.
- Image sizing assumes terminal cells about twice as tall as wide; tweak `cellAspect` in `renderer/render.mjs` or the scale option if equations look stretched.
- Sixel and iTerm2 image protocols aren't supported (Claude Code's image element only speaks kitty graphics).

## Development

```
claude --plugin-dir .            # run with the mod loaded
claude plugin validate .
claude plugin test .
```

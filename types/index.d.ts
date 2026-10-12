/** A display equation as the renderer left it: a PNG on disk and its box in cells. */
export type RenderedMath = { file: string; columns: number; rows: number } | { error: string }

declare module 'claude-code' {
  interface PluginState {
    latex: { isEnabled: boolean }
  }
}

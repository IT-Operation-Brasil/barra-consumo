export type Janela = { kind: string; percentUsed: number; resetsAt?: string }
export type Leitura = { tokens?: number; window: number; percent?: number; janelas: Janela[] }

declare module 'claude-code' {
  interface PluginState {
    'barra-consumo': { leitura: Leitura | null }
  }
}

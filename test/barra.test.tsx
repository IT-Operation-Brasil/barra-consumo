import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BANDA = {
  plugin: 'barra-consumo',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 8,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 8 },
    view: {},
  },
} as const

const LEITURA = {
  tokens: 88_000,
  window: 1_000_000,
  percent: 9,
  janelas: [
    { kind: 'five_hour', percentUsed: 36, resetsAt: '2026-10-31T01:00:00Z' },
    { kind: 'seven_day', percentUsed: 84, resetsAt: '2026-10-31T22:00:00Z' },
  ],
}

const AGORA = Date.parse('2026-10-30T21:27:00Z')

const semeia = (on: On) => {
  on('state.get', () => ({ value: { value: LEITURA, version: 1 } }))
  on('clock.now', () => ({ value: AGORA }))
}

test('no app, régua e barras saem em Svg de mesma largura', async ($, on) => {
  semeia(on)
  const ui = await $.ui.mount({ ...BANDA, surface: 'desktop' })

  const desenhos = await ui.findAll({ type: 'Svg' })
  expect(desenhos.length).toBe(4)
  expect(new Set(desenhos.map(d => d.props.width)).size).toBe(1)
  expect(new Set(desenhos.map(d => d.props.height)).size).toBe(1)

  // Só as janelas de 5h e 7d têm faixa de tempo; o contexto não.
  const [, ctx, cincoHoras, seteDias] = desenhos.map(d => String(d.props.source))
  expect(ctx).not.toContain('fill-opacity="0.4"')
  expect(cincoHoras).toContain('fill-opacity="0.4"')
  expect(seteDias).toContain('fill-opacity="0.4"')
  await ui.unmount()
})

test('no terminal, sem Svg, as barras continuam em caracteres', async ($, on) => {
  semeia(on)
  const ui = await $.ui.mount({ ...BANDA, surface: 'terminal' })

  expect((await ui.findAll({ type: 'Svg' })).length).toBe(0)
  expect((await ui.find({ type: 'Text', text: /uso\s+36%/ }))?.text).toContain('renova')
  await ui.unmount()
})

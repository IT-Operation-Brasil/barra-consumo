import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Janela, Leitura } from '../types'

const leitura = atom({ plugin: 'barra-consumo', key: 'leitura' } as const, null)

const HORA = 3_600_000
const DURACAO: Record<string, number> = { five_hour: 5 * HORA, seven_day: 168 * HORA }
const ROTULO: Record<string, string> = { five_hour: '5h', seven_day: '7d' }

// Largura das barras em células; 40 faz cada marca de 20% cair em múltiplos de 8.
const LARGURA = 40
const COLUNA_ROTULO = 5

const COR_TEMPO = 'gray'
const COR_OK = 'green'
const COR_ATENCAO = 'yellow'
const COR_ALERTA = 'red'

// Fora do terminal a fonte é proporcional e células de texto não alinham: a
// barra vira Svg, em pixels. A margem dá lugar para centrar os rótulos 0 e 100.
const BARRA_PX = 260
const MARGEM_PX = 12
const LARGURA_PX = BARRA_PX + MARGEM_PX * 2
const ALTURA_PX = 14
const TRACO_PX = 6

// O Svg é desenhado como imagem e não lê o tema: cinza translúcido serve aos
// dois temas, e as cores do consumo são fixas.
const CINZA = '#808080'
const OPACIDADE_TRILHO = 0.16
const OPACIDADE_TEMPO = 0.4
const OPACIDADE_MARCA = 0.35
const HEX: Record<string, string> = { [COR_OK]: '#138a3f', [COR_ATENCAO]: '#d97706', [COR_ALERTA]: '#dc2626' }

type Trecho = { texto: string; fundo?: string; cor?: string; apagado?: boolean }
type Medida = { uso: number; cor: string; tempo?: number }

const mil = (n: number) => `${Math.round(n / 1000)}k`
const num = (n: number, largura: number) => String(Math.round(n)).padStart(largura, ' ')
const limitar = (n: number) => Math.min(100, Math.max(0, n))

const prazo = (ms: number) => {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min >= 1440) return `${Math.floor(min / 1440)}d${Math.floor((min % 1440) / 60)}h`
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

const hora = (ms: number, comDia: boolean) => {
  const d = new Date(ms)
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return comDia ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hhmm}` : hhmm
}

// Régua de 0 a 100 com marcas a cada 20%, alinhada às barras.
const regua = () => {
  const c: string[] = Array(LARGURA + 1).fill(' ')
  const poe = (texto: string, inicio: number) => [...texto].forEach((ch, i) => { c[inicio + i] = ch })
  for (const p of [0, 20, 40, 60, 80]) poe(String(p), Math.round((p / 100) * LARGURA))
  poe('100', LARGURA - 2)
  return c.join('')
}

const posicao = (pct: number) => MARGEM_PX + (limitar(pct) / 100) * BARRA_PX

const svg = (conteudo: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA_PX}" height="${ALTURA_PX}" viewBox="0 0 ${LARGURA_PX} ${ALTURA_PX}">${conteudo}</svg>`

const faixa = (ate: number, altura: number, cor: string, opacidade = 1) => {
  const y = (ALTURA_PX - altura) / 2
  return `<rect x="${MARGEM_PX}" y="${y}" width="${posicao(ate) - MARGEM_PX}" height="${altura}" rx="2" fill="${cor}" fill-opacity="${opacidade}"/>`
}

// Mesma régua do terminal, em pixels, para cair sobre as marcas das barras.
const svgRegua = () =>
  svg(
    [0, 20, 40, 60, 80, 100]
      .map(p => `<text x="${posicao(p)}" y="11" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="${CINZA}">${p}</text>`)
      .join(''),
  )

// Trilho até 100%, faixa cinza para o tempo decorrido e traço grosso por cima
// para o consumo. Sem `tempo`, só trilho e traço.
const svgBarra = ({ uso, cor, tempo }: Medida) => {
  const marcas = [20, 40, 60, 80].map(
    p => `<rect x="${posicao(p)}" y="0" width="1" height="${ALTURA_PX}" fill="${CINZA}" fill-opacity="${OPACIDADE_MARCA}"/>`,
  )
  return svg(
    [
      faixa(100, ALTURA_PX, CINZA, OPACIDADE_TRILHO),
      tempo === undefined ? '' : faixa(tempo, ALTURA_PX, CINZA, OPACIDADE_TEMPO),
      ...marcas,
      faixa(uso, TRACO_PX, HEX[cor] ?? CINZA),
    ].join(''),
  )
}

// Versão do terminal: faixa grossa (fundo) para o tempo decorrido e traço fino
// por cima, em outra cor, para o consumo. Sem `tempo`, só o traço fino.
const barra = ({ uso, cor, tempo }: Medida): Trecho[] => {
  const celulasUso = Math.round((limitar(uso) / 100) * LARGURA)
  const celulasTempo = tempo === undefined ? 0 : Math.round((limitar(tempo) / 100) * LARGURA)
  const trechos: Trecho[] = []
  const junta = (t: Trecho) => {
    const ultimo = trechos[trechos.length - 1]
    if (ultimo && ultimo.fundo === t.fundo && ultimo.cor === t.cor && ultimo.apagado === t.apagado) {
      ultimo.texto += t.texto
    } else {
      trechos.push(t)
    }
  }
  for (let i = 0; i < LARGURA; i++) {
    const noTempo = i < celulasTempo
    const noUso = i < celulasUso
    if (noUso) junta({ texto: '━', cor, fundo: noTempo ? COR_TEMPO : undefined })
    else if (noTempo) junta({ texto: ' ', fundo: COR_TEMPO })
    else junta({ texto: '·', apagado: true })
  }
  return trechos
}

const corPorNivel = (pct: number) => (pct >= 85 ? COR_ALERTA : pct >= 60 ? COR_ATENCAO : COR_OK)

type LinhaJanela = { medida: Medida; info: string }

const linhaJanela = (j: Janela, agora: number): LinhaJanela => {
  const duracao = DURACAO[j.kind]
  const uso = j.percentUsed
  const fim = j.resetsAt ? Date.parse(j.resetsAt) : undefined
  if (fim === undefined || !duracao) {
    return { medida: { uso, cor: corPorNivel(uso) }, info: `uso ${num(uso, 3)}%` }
  }

  const restante = fim - agora
  const decorrido = duracao - restante
  const tempo = limitar((decorrido / duracao) * 100)
  const base = `uso ${num(uso, 3)}%  tempo ${num(tempo, 3)}%  renova ${prazo(restante).padEnd(5, ' ')}`

  if (decorrido <= 0 || uso <= 0) return { medida: { uso, cor: COR_OK, tempo }, info: `${base}  sem ritmo` }

  // Projeta o ritmo médio desde o início da janela.
  const esgota = agora + ((100 - uso) * decorrido) / uso
  if (esgota < fim) {
    const aviso = `ESGOTA ${hora(esgota, j.kind === 'seven_day')} (${prazo(fim - esgota)} antes)`
    return { medida: { uso, cor: COR_ALERTA, tempo }, info: `${base}  ${aviso}` }
  }
  return { medida: { uso, cor: uso > tempo ? COR_ATENCAO : COR_OK, tempo }, info: `${base}  folga` }
}

// Fica no topo do arquivo: o motor só segue o $ até funções declaradas aqui.
const medir = async ($: EngineInterface) => {
  const u = await $.session.usage()
  const nova: Leitura = {
    tokens: u.context.tokens,
    window: u.context.window,
    percent: u.context.percent,
    janelas: u.rateLimits.filter(j => DURACAO[j.kind]),
  }
  await update($, leitura, () => nova)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await medir($)
    return r
  })

  on('session.measure', async ($, e, next) => {
    await medir($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const l = await read($, leitura)
    if (l === null || e.props.hasSurvey) return next(e)

    const agora = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)
    const Svg = e.surface === 'terminal' ? undefined : $.ui.resolve(e).Svg

    const desenha = (trechos: Trecho[]) =>
      trechos.map((t, i) => (
        <Text key={`t${i}`} backgroundColor={t.fundo} color={t.cor} dimColor={t.apagado}>
          {t.texto}
        </Text>
      ))

    const grafico = (medida: Medida, alt: string) =>
      Svg ? (
        <Svg source={svgBarra(medida)} alt={alt} width={LARGURA_PX} height={ALTURA_PX} />
      ) : (
        <Text>{desenha(barra(medida))}</Text>
      )

    const rotulo = (texto: string) => <Text mono>{texto.padEnd(COLUNA_ROTULO, ' ')}</Text>

    const pctContexto = l.percent ?? (l.tokens === undefined ? undefined : (l.tokens / l.window) * 100)
    const contexto =
      l.tokens === undefined || pctContexto === undefined
        ? { medida: { uso: 0, cor: COR_OK }, info: 'sem leitura' }
        : {
            medida: { uso: pctContexto, cor: corPorNivel(pctContexto) },
            info: `${num(pctContexto, 3)}%  ${mil(l.tokens)}/${mil(l.window)}  faltam ${mil(l.window - l.tokens)}`,
          }

    const linhas = [
      { chave: 'ctx', nome: 'Ctx', ...contexto },
      ...l.janelas.map(j => ({ chave: j.kind, nome: ROTULO[j.kind] ?? j.kind, ...linhaJanela(j, agora) })),
    ]

    return (
      <Box flexDirection="column">
        <Box alignItems="center">
          {rotulo('')}
          {Svg ? (
            <Svg source={svgRegua()} alt="Escala de 0 a 100%" width={LARGURA_PX} height={ALTURA_PX} />
          ) : (
            <Text dimColor>{regua()}</Text>
          )}
        </Box>
        {linhas.map(r => (
          <Box key={r.chave} alignItems="center">
            {rotulo(r.nome)}
            <Box flexShrink={0}>{grafico(r.medida, `${r.nome}: ${r.info}`)}</Box>
            <Box flexShrink={1}>
              <Text mono>{'  ' + r.info}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    )
  })
}

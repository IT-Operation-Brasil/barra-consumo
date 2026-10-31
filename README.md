# barra-consumo

Mod do Claude Code que mostra, acima do campo de mensagem, quanto você já consumiu do contexto da conversa e dos limites do plano, e avisa se o ritmo atual vai esgotar a janela antes da renovação.

## O que aparece

| Linha | Mostra |
| --- | --- |
| `Ctx` | Percentual do contexto usado, tokens usados e tokens restantes |
| `5h` | Uso da janela de 5 horas, tempo decorrido, prazo até renovar e previsão |
| `7d` | Uso da janela semanal, tempo decorrido, prazo até renovar e previsão |

A previsão projeta o ritmo médio desde o início da janela:

- `folga`: nesse ritmo, a janela chega até a renovação.
- `ESGOTA dd/mm hh:mm (Xh antes)`: nesse ritmo, o limite acaba antes da renovação.
- `sem ritmo`: ainda não há consumo suficiente para projetar.

A faixa cinza da barra é o tempo decorrido, e o traço colorido por cima é o consumo. Nas janelas de 5h e 7d, o traço fica verde enquanto o consumo está abaixo do tempo, amarelo quando passa dele e vermelho quando a previsão é esgotar. Na linha `Ctx`, a cor segue o nível de uso: amarelo a partir de 60% e vermelho a partir de 85%.

As janelas de 5h e 7d só aparecem quando o Claude Code informa os limites do plano; com chave de API, por exemplo, sobra a linha `Ctx`.

## Instalação

No terminal, no prompt do Claude Code:

```
/plugin install barra-consumo --marketplace IT-Operation-Brasil/barra-consumo
```

Responda `y` para adicionar o marketplace e escolha o escopo de instalação.

Pelo shell:

```bash
claude plugin install barra-consumo --marketplace IT-Operation-Brasil/barra-consumo
```

No app de computador, onde `/plugin` não funciona: clique em **+** ao lado do campo de mensagem, depois em **Plugins**, **Add marketplace** com `IT-Operation-Brasil/barra-consumo` e, por fim, **Add plugin**.

A faixa vale para conversas novas. Ela aparece no terminal e no app de computador, mas não é desenhada no celular.

## Licença

[MIT](LICENSE)

# CASU — Board de Operação

Evolução do painel VIP (`painel.casubrasil.com.br`) para um board com 5 abas:
Lista VIP · Meta Ads · Instagram · Projeções · Cronograma.

## Estrutura

```
.
├── index.html       ← o board inteiro (Chart.js e Supabase embutidos)
├── api/windsor.js   ← proxy serverless: fala com o Windsor usando a chave guardada no Vercel
├── vercel.json
└── README.md
```

## Deploy (substituindo o painel atual)

1. No repositório do painel no GitHub, substitua o `index.html` e adicione a pasta `api/` e o `vercel.json`.
2. No Vercel → projeto do painel → **Settings → Environment Variables**, crie:

| Variável | O que é |
|---|---|
| `WINDSOR_KEY` | chave da API do Windsor (mesma usada no BH Vida) |
| `META_ACCOUNT` | ID da conta de anúncios Meta da CASU — o valor que aparece em `select_accounts` no Windsor |
| `IG_ACCOUNT` | ID do Instagram Insights do @casubrasil no Windsor (quando conectar) |
| `GADS_ACCOUNT` | ID da conta Google Ads (fase de lançamento, ex.: `123-456-7890`) |
| `META_FOLLOW_FIELD` | opcional — nome do campo de seguidores no Windsor, se o padrão `actions_follow` não existir |

3. Faça um novo deploy (Deployments → Redeploy) para as variáveis valerem.
4. Login continua o mesmo: usuário admin do Supabase.

## Supabase (já aplicado)

- Tabela `cronograma` (peças de conteúdo, editável no board, tempo real)
- Tabela `config` (verbas por fase, datas do lançamento, metas)
- RLS: só usuário autenticado lê e escreve

## Como as abas funcionam

- **Filtro global** (topo): presets, De/Até, granularidade automática (≤45 dias → dia, ≤140 → semana, acima → mês) com override manual, comparação com o período anterior de mesma duração em todo KPI.
- **Lista VIP**: cadastros, grupo, conversão, média/dia com tendência, origem por UTM, cidade, tabela com busca/filtro/CSV.
- **Meta Ads**: overview, insights automáticos, seguidores/dia com média móvel, campanhas (com R$/dia), público (idade/gênero, região, dispositivo, posicionamento), engajamento, retenção de vídeo, formatos. "Cadastros VIP (pago)" vêm dos leads reais com `utm_medium` = paid/cpc/ads.
- **Instagram**: liga sozinha quando `IG_ACCOUNT` existir.
- **Projeções**: entregue + verba restante × rendimento por real (base ajustável: 7/14/30 dias/tudo), três cenários, premissas salvas no Supabase.
- **Cronograma**: próximas ações, atrasados, lista editável (status inline), calendário mensal, link do Drive por peça.

## Campos do Windsor

Se o Windsor rejeitar algum campo, o proxy remove o campo e tenta de novo; o board mostra no rodapé da aba quais foram ignorados. Se aparecer "nenhum campo de seguidores encontrado", verifique no Windsor o nome do campo de follows da conta e configure `META_FOLLOW_FIELD`.

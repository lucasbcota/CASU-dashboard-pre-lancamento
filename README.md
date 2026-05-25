# CASU — Painel VIP (Dashboard)

Painel administrativo para acompanhar os leads da Lista VIP em tempo real.

## Stack

- HTML/CSS/JS estático, arquivo único (`index.html`)
- Biblioteca Supabase e Chart.js embutidas
- Backend: Supabase (Auth + Postgres + Realtime)

## Acesso

O painel exige login. Use o usuário admin criado no Supabase
(Authentication → Users).

## Funcionalidades

- Indicadores: total de leads, entraram no grupo, taxa de conversão
- Gráfico de cadastros por dia (últimos 30 dias)
- Tabela de leads com busca, filtro e exportação CSV
- Atualização em tempo real (novos leads aparecem sozinhos)

## Deploy (Vercel)

Site estático — o Vercel publica automaticamente a cada `git push`.
Sem configuração de build.

O `vercel.json` inclui o header `noindex` para o painel não aparecer
em buscas do Google.

## Estrutura

```
.
├── index.html      ← o painel completo (tudo embutido)
├── vercel.json     ← configuração do Vercel
└── README.md
```

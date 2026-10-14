# CASU — Board de Operação

Dashboard interno com 6 abas: Clube CASU · Meta Ads · Instagram · Analytics · Projeções · Cronograma.

Em produção: **https://painel.casubrasil.com.br/**

## Estrutura

```
.
├── index.html       ← o board inteiro (Chart.js e Supabase embutidos)
├── api/
│   ├── windsor.js   ← proxy serverless Windsor (Meta Ads · GA4)
│   ├── meta.js      ← proxy direto da Marketing API do Meta
│   └── instagram.js ← proxy direto da Graph API do Instagram
├── vercel.json      ← headers de segurança + noindex
└── README.md
```

## Variáveis de ambiente (Vercel)

| Variável | O que é |
|---|---|
| `WINDSOR_KEY` | Chave da API do Windsor (fallback para Meta/GA4) |
| `META_ACCOUNT` | ID da conta Meta Ads — `1037134262258463` ("CA 01 - Vista Casu") |
| `META_TOKEN` ou `IG_TOKEN` | Token do Meta com `ads_read` |
| `IG_USER_ID` | ID da conta profissional do Instagram |
| `GA4_ACCOUNT_LP_VIP` | GA4 da LP — `551732823` ("VIP Casu") |
| `GA4_ACCOUNT_ECOMM` | GA4 do e-commerce — `548720875` ("Vista Casu") |
| `GADS_ACCOUNT` | Conta Google Ads (quando houver) |

## Convenção temporal

- **Até 05/10/2026**: período de pré-lançamento — nomenclatura "Grupo VIP"
- **A partir de 06/10/2026**: operação atual — nomenclatura "Clube CASU"

A constante `CUTOFF_DATE='2026-10-06'` no `index.html` define o corte. A aba
Clube CASU tem toggle no topo entre "Clube CASU" (atual) e "Grupo VIP (pré-lançamento)"
igual a aba Analytics tem entre "Landing page VIP" e "E-commerce".

## Deploy

Site estático + 3 serverless functions. O Vercel detecta e publica a cada
`git push`. Após mudanças nas variáveis de ambiente, fazer **Redeploy** manual
para valerem (Deployments → ... → Redeploy).

## Login

Autenticação Supabase. Usuário admin criado em Authentication → Users do
projeto Supabase.

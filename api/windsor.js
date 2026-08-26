// CASU Board — proxy Windsor.ai
// Variáveis de ambiente no Vercel (Settings → Environment Variables):
//   WINDSOR_KEY        chave da API do Windsor (obrigatória)
//   META_ACCOUNT       ID da conta de anúncios Meta da CASU (ex.: 1234567890)
//   IG_ACCOUNT         ID da conta Instagram Insights no Windsor (quando conectar)
//   GADS_ACCOUNT       ID da conta Google Ads (ex.: 123-456-7890) — fase de lançamento
//   META_FOLLOW_FIELD  (opcional) nome do campo de "seguidores" no Windsor. Padrão: actions_follow
//
// O painel chama /api/windsor?q=<consulta>&from=YYYY-MM-DD&to=YYYY-MM-DD
// e envia o token de login do Supabase no header Authorization.

const SUPABASE_URL = 'https://iiugiinllzsmjotmnvvl.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdWdpaW5sbHpzbWpvdG1udnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTA4MzAsImV4cCI6MjA5NDk2NjgzMH0._NbUMgydMneiN-OCyFF6qRRv9wbX1mTR5GWK0wTDlMI';

const FOLLOW = process.env.META_FOLLOW_FIELD || 'actions_follow';

// Consultas disponíveis. Se o Windsor rejeitar um campo, o proxy remove o campo e tenta de novo
// (o painel trata campos ausentes como zero) — assim nada quebra por diferença de nome.
const QUERIES = {
  meta_daily: {
    source: 'facebook', account: 'META_ACCOUNT',
    fields: ['date', 'campaign', 'campaign_id', 'spend', 'impressions', 'reach', 'clicks', 'link_clicks',
      'landing_page_views', 'post_engagement', 'post_reactions', 'comment', 'post_shares', 'post_saves',
      'video_views', 'video_p25_watched_actions', 'video_p50_watched_actions', 'video_p75_watched_actions',
      'video_p100_watched_actions', 'video_thruplay_watched_actions', 'leads', FOLLOW]
  },
  meta_age_gender: { source: 'facebook', account: 'META_ACCOUNT',
    fields: ['date', 'age', 'gender', 'spend', 'impressions', 'reach', 'link_clicks', FOLLOW] },
  meta_region: { source: 'facebook', account: 'META_ACCOUNT',
    fields: ['date', 'region', 'spend', 'impressions', 'reach', 'link_clicks'] },
  meta_device: { source: 'facebook', account: 'META_ACCOUNT',
    fields: ['date', 'device_platform', 'publisher_platform', 'platform_position', 'spend', 'impressions', 'reach', 'link_clicks'] },
  meta_ads: { source: 'facebook', account: 'META_ACCOUNT',
    fields: ['date', 'campaign', 'adset_name', 'ad_name', 'spend', 'impressions', 'reach', 'link_clicks',
      'video_views', 'video_thruplay_watched_actions', 'post_engagement', FOLLOW] },
  ig_daily: { source: 'instagram', account: 'IG_ACCOUNT',
    fields: ['date', 'follower_count', 'followers', 'reach', 'impressions', 'profile_views', 'website_clicks',
      'email_contacts', 'get_directions_clicks', 'phone_call_clicks', 'text_message_clicks'] },
  ig_audience: { source: 'instagram', account: 'IG_ACCOUNT',
    fields: ['audience_city', 'audience_gender_age', 'audience_country', 'follower_count'] },
  ig_media: { source: 'instagram', account: 'IG_ACCOUNT',
    fields: ['date', 'media_type', 'media_product_type', 'caption', 'like_count', 'comments_count', 'reach', 'impressions', 'saved', 'shares', 'plays', 'permalink'] },
  gads_daily: { source: 'google_ads', account: 'GADS_ACCOUNT',
    fields: ['date', 'campaign', 'spend', 'impressions', 'clicks', 'conversions'] }
};

const cache = new Map(); // key → {t, body}
const TTL = 10 * 60 * 1000;

async function isLoggedIn(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON, Authorization: auth } });
    return r.ok;
  } catch { return false; }
}

async function windsor(source, fields, account, from, to) {
  let list = [...fields];
  for (let attempt = 0; attempt < 8; attempt++) {
    const url = new URL(`https://connectors.windsor.ai/${source}`);
    url.searchParams.set('api_key', process.env.WINDSOR_KEY);
    url.searchParams.set('date_from', from);
    url.searchParams.set('date_to', to);
    url.searchParams.set('fields', list.join(','));
    if (account) url.searchParams.set('select_accounts', account);
    const r = await fetch(url.toString());
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }
    if (r.ok && json && Array.isArray(json.data)) return { data: json.data, fields: list, dropped: fields.filter(f => !list.includes(f)) };
    const msg = (json && (json.error || json.message || json.detail)) ? String(json.error || json.message || json.detail) : text;
    const bad = list.find(f => f !== 'date' && new RegExp(`\\b${f}\\b`).test(msg));
    if (!bad) throw new Error(`Windsor ${source}: ${msg.slice(0, 300)}`);
    list = list.filter(f => f !== bad);
  }
  throw new Error(`Windsor ${source}: muitos campos rejeitados`);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await isLoggedIn(req))) return res.status(401).json({ error: 'Faça login no painel.' });
  if (!process.env.WINDSOR_KEY) return res.status(500).json({ error: 'WINDSOR_KEY não configurada no Vercel.' });

  const { q, from, to } = req.query;
  if (q === 'status') {
    return res.json({ meta: !!process.env.META_ACCOUNT, ig: !!process.env.IG_ACCOUNT, gads: !!process.env.GADS_ACCOUNT });
  }
  const def = QUERIES[q];
  if (!def) return res.status(400).json({ error: `Consulta desconhecida: ${q}` });
  const account = process.env[def.account];
  if (!account) return res.status(409).json({ error: `${def.account} não configurada no Vercel.`, notConnected: true });

  const key = `${q}|${from}|${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return res.json(hit.body);
  try {
    const body = await windsor(def.source, def.fields, account, from || '2026-08-01', to || new Date().toISOString().slice(0, 10));
    cache.set(key, { t: Date.now(), body });
    res.json(body);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};

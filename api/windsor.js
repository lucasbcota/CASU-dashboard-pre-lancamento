// CASU Board — proxy Windsor.ai
// Variáveis de ambiente no Vercel (Settings → Environment Variables):
//   WINDSOR_KEY          chave da API do Windsor (obrigatória — é uma só para todas as fontes)
//   META_ACCOUNT         ID da conta de anúncios Meta da CASU
//   GA4_ACCOUNT_LP_VIP   ID da propriedade GA4 da LP vip.casubrasil.com.br
//   GA4_ACCOUNT_ECOMM    ID da propriedade GA4 do e-commerce (casubrasil.com.br)
//   IG_ACCOUNT           ID do Instagram Insights (quando conectar)
//   GADS_ACCOUNT         ID da conta Google Ads (fase de lançamento)
//
// Campos: cada métrica tem uma lista de nomes possíveis (o Windsor varia por conta).
// O proxy tenta o primeiro; se a conta rejeitar, tenta o próximo. O painel sempre
// recebe o nome canônico (o primeiro da lista). Para forçar um nome, use a variável
// FIELDS_<CONSULTA> com a lista completa separada por vírgula (ex.: FIELDS_META_DAILY).

const SUPABASE_URL = 'https://iiugiinllzsmjotmnvvl.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdWdpaW5sbHpzbWpvdG1udnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTA4MzAsImV4cCI6MjA5NDk2NjgzMH0._NbUMgydMneiN-OCyFF6qRRv9wbX1mTR5GWK0wTDlMI';

// Aliases de campos do Meta (nome canônico primeiro)
const M = {
  spend: ['spend'], impressions: ['impressions'], reach: ['reach'], clicks: ['clicks'],
  link_clicks: ['link_clicks', 'actions_link_click', 'inline_link_clicks'],
  landing_page_views: ['landing_page_views', 'actions_landing_page_view'],
  post_engagement: ['post_engagement', 'actions_post_engagement', 'page_engagement', 'actions_page_engagement'],
  post_reactions: ['post_reactions', 'actions_post_reaction'],
  comment: ['comment', 'actions_comment'],
  post_shares: ['post_shares', 'actions_post'],
  post_saves: ['post_saves', 'actions_onsite_conversion_post_save'],
  video_views: ['video_views', 'actions_video_view', 'video_play_actions', 'video_play_actions_video_view'],
  video_p25_watched_actions: ['video_p25_watched_actions', 'video_p25_watched_actions_video_view'],
  video_p50_watched_actions: ['video_p50_watched_actions', 'video_p50_watched_actions_video_view'],
  video_p75_watched_actions: ['video_p75_watched_actions', 'video_p75_watched_actions_video_view'],
  video_p100_watched_actions: ['video_p100_watched_actions', 'video_p100_watched_actions_video_view'],
  video_thruplay_watched_actions: ['video_thruplay_watched_actions', 'video_thruplay_watched_actions_video_view'],
  leads: ['leads', 'actions_lead'],
  profile_visits: ['profile_visits', 'actions_onsite_conversion_ig_profile_visit', 'actions_instagram_profile_visit', 'actions_profile_visit'],
  follows: [process.env.META_FOLLOW_FIELD, 'actions_follow', 'follows', 'actions_onsite_conversion_follow', 'instagram_profile_follows', 'actions_like', 'page_likes'].filter(Boolean)
};
const m = (...keys) => keys.map(k => M[k]);
// Aliases de campos do GA4 no Windsor (nome canônico primeiro)
const GA = {
  sessions: ['sessions'], totalusers: ['totalusers', 'total_users', 'users'], newusers: ['newusers', 'new_users'],
  screenpageviews: ['screenpageviews', 'screen_page_views', 'pageviews', 'views'], engagedsessions: ['engagedsessions', 'engaged_sessions'],
  averagesessionduration: ['averagesessionduration', 'average_session_duration'], userengagementduration: ['userengagementduration', 'user_engagement_duration', 'engagement_duration'],
  bouncerate: ['bouncerate', 'bounce_rate'], itemsviewed: ['itemsviewed', 'items_viewed', 'item_views', 'view_item'], addtocarts: ['addtocarts', 'add_to_carts', 'add_to_cart'],
  checkouts: ['checkouts', 'begin_checkouts', 'begin_checkout'], ecommercepurchases: ['ecommercepurchases', 'ecommerce_purchases', 'transactions', 'purchases', 'purchase'],
  purchaserevenue: ['purchaserevenue', 'purchase_revenue', 'totalrevenue', 'total_revenue', 'revenue'],
  sessionsource: ['sessionsource', 'session_source', 'source'], sessionmedium: ['sessionmedium', 'session_medium', 'medium'], sessioncampaignname: ['sessioncampaignname', 'session_campaign_name', 'campaign'],
  city: ['city'], region: ['region'], devicecategory: ['devicecategory', 'device_category', 'device'], eventname: ['eventname', 'event_name'], eventcount: ['eventcount', 'event_count'],
  pagepath: ['pagepath', 'page_path'], pagetitle: ['pagetitle', 'page_title'], itemname: ['itemname', 'item_name'], itemsaddedtocart: ['itemsaddedtocart', 'items_added_to_cart'],
  itemspurchased: ['itemspurchased', 'items_purchased'], itemrevenue: ['itemrevenue', 'item_revenue']
};
const ga = (...keys) => keys.map(k => GA[k]);


const QUERIES = {
  meta_daily: { source: 'facebook', account: 'META_ACCOUNT',
    fields: ['date', 'campaign', 'campaign_id', ...m('spend', 'impressions', 'reach', 'clicks', 'link_clicks', 'landing_page_views', 'post_engagement', 'post_reactions', 'comment', 'post_shares', 'post_saves', 'video_views', 'video_p25_watched_actions', 'video_p50_watched_actions', 'video_p75_watched_actions', 'video_p100_watched_actions', 'video_thruplay_watched_actions', 'leads', 'follows', 'profile_visits')] },
  meta_age_gender: { source: 'facebook', account: 'META_ACCOUNT', fields: ['date', 'age', 'gender', ...m('spend', 'impressions', 'reach', 'link_clicks', 'follows')] },
  meta_region: { source: 'facebook', account: 'META_ACCOUNT', fields: ['date', 'region', ...m('spend', 'impressions', 'reach', 'link_clicks')] },
  meta_device: { source: 'facebook', account: 'META_ACCOUNT', fields: ['date', 'device_platform', 'publisher_platform', 'platform_position', ...m('spend', 'impressions', 'reach', 'link_clicks')] },
  meta_ads: { source: 'facebook', account: 'META_ACCOUNT', fields: ['date', 'campaign', 'adset_name', 'ad_name', ...m('spend', 'impressions', 'reach', 'link_clicks', 'video_views', 'video_thruplay_watched_actions', 'post_engagement', 'follows')] },

  ga4_lp_daily: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_LP_VIP', fields: ['date', ...ga('sessions', 'totalusers', 'newusers', 'screenpageviews', 'engagedsessions', 'averagesessionduration', 'userengagementduration', 'bouncerate')] },
  ga4_lp_source: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_LP_VIP', fields: ['date', ...ga('sessionsource', 'sessionmedium', 'sessioncampaignname', 'sessions', 'totalusers', 'screenpageviews', 'engagedsessions')] },
  ga4_lp_geo: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_LP_VIP', fields: ['date', ...ga('city', 'region', 'sessions', 'totalusers')] },
  ga4_lp_geo_source: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_LP_VIP', fields: ['date', ...ga('city', 'sessionsource', 'sessionmedium', 'sessions')] },
  ga4_lp_device: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_LP_VIP', fields: ['date', ...ga('devicecategory', 'sessions', 'totalusers', 'engagedsessions')] },
  ga4_lp_events: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_LP_VIP', fields: ['date', ...ga('eventname', 'eventcount', 'totalusers')] },

  // GA4 aceita no máximo 10 métricas por consulta → diário em duas partes (o painel junta por data)
  ga4_ecomm_daily: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_ECOMM', fields: ['date', ...ga('sessions', 'totalusers', 'newusers', 'screenpageviews', 'engagedsessions', 'averagesessionduration', 'userengagementduration', 'bouncerate')] },
  ga4_ecomm_daily2: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_ECOMM', fields: ['date', ...ga('itemsviewed', 'addtocarts', 'checkouts', 'ecommercepurchases', 'purchaserevenue')] },
  ga4_ecomm_source: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_ECOMM', fields: ['date', ...ga('sessionsource', 'sessionmedium', 'sessioncampaignname', 'sessions', 'totalusers', 'addtocarts', 'ecommercepurchases', 'purchaserevenue')] },
  ga4_ecomm_geo: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_ECOMM', fields: ['date', ...ga('city', 'region', 'sessions', 'totalusers', 'ecommercepurchases')] },
  ga4_ecomm_device: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_ECOMM', fields: ['date', ...ga('devicecategory', 'sessions', 'totalusers', 'ecommercepurchases')] },
  ga4_ecomm_pages: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_ECOMM', fields: ['date', ...ga('pagepath', 'pagetitle', 'screenpageviews', 'totalusers', 'userengagementduration')] },
  ga4_ecomm_items: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_ECOMM', fields: ['date', ...ga('itemname', 'itemsviewed', 'itemsaddedtocart', 'itemspurchased', 'itemrevenue')] },
  ga4_ecomm_events: { source: 'googleanalytics4', account: 'GA4_ACCOUNT_ECOMM', fields: ['date', ...ga('eventname', 'eventcount', 'totalusers')] },

  ig_daily: { source: 'instagram', account: 'IG_ACCOUNT', fields: ['date', 'follower_count', 'followers', 'reach', 'impressions', 'profile_views', 'website_clicks'] },
  ig_audience: { source: 'instagram', account: 'IG_ACCOUNT', fields: ['audience_city', 'audience_gender_age', 'audience_country', 'follower_count'] },
  ig_media: { source: 'instagram', account: 'IG_ACCOUNT', fields: ['date', 'media_type', 'media_product_type', 'caption', 'like_count', 'comments_count', 'reach', 'impressions', 'saved', 'shares', 'plays', 'permalink'] },
  gads_daily: { source: 'google_ads', account: 'GADS_ACCOUNT', fields: ['date', 'campaign', 'spend', 'impressions', 'clicks', 'conversions'] }
};
for (const q of Object.keys(QUERIES)) { const env = process.env['FIELDS_' + q.toUpperCase()]; if (env) QUERIES[q].fields = env.split(',').map(f => f.trim()).filter(Boolean); }

const cache = new Map(); const TTL = 10 * 60 * 1000;
const resolved = new Map(); // "q|canonical" → nome aceito

async function isLoggedIn(req) {
  const auth = req.headers.authorization || ''; if (!auth.startsWith('Bearer ')) return false;
  try { const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON, Authorization: auth } }); return r.ok; } catch { return false; }
}

// fields: itens são string (fixo) ou array de alternativas
async function windsor(q, source, fields, account, from, to) {
  // estado: para cada slot, índice da alternativa em uso (ou -1 = descartado)
  const slots = fields.map(f => Array.isArray(f) ? f : [f]);
  const idx = slots.map((alts, i) => { const r = resolved.get(`${q}|${alts[0]}`); const k = r ? alts.indexOf(r) : 0; return k >= 0 ? k : 0; });
  for (let attempt = 0; attempt < 40; attempt++) {
    const names = slots.map((alts, i) => idx[i] < 0 ? null : alts[idx[i]]);
    const list = names.filter(Boolean);
    const url = new URL(`https://connectors.windsor.ai/${source}`);
    url.searchParams.set('api_key', process.env.WINDSOR_KEY); url.searchParams.set('date_from', from); url.searchParams.set('date_to', to);
    url.searchParams.set('fields', list.join(',')); if (account) url.searchParams.set('select_accounts', account);
    const r = await fetch(url.toString()); const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = null; }
    if (r.ok && json && Array.isArray(json.data)) {
      // renomeia para o canônico
      const ren = slots.map((alts, i) => idx[i] > 0 ? [alts[idx[i]], alts[0]] : null).filter(Boolean);
      const data = ren.length ? json.data.map(row => { const o = { ...row }; ren.forEach(([from, to]) => { if (from in o) { o[to] = o[from]; delete o[from]; } }); return o; }) : json.data;
      slots.forEach((alts, i) => { if (idx[i] >= 0) resolved.set(`${q}|${alts[0]}`, alts[idx[i]]); });
      const mapping = Object.fromEntries(slots.filter((a, i) => idx[i] > 0).map((a, i) => [a[0], a[idx[slots.indexOf(a)]]]));
      const dropped = slots.filter((a, i) => idx[i] < 0).map(a => a[0]);
      return { data, fields: slots.filter((a, i) => idx[i] >= 0).map(a => a[0]), dropped, mapping };
    }
    const msg = (json && (json.error || json.message || json.detail)) ? String(json.error || json.message || json.detail) : text;
    const badSlot = slots.findIndex((alts, i) => idx[i] >= 0 && new RegExp(`(^|[^a-z0-9_])${alts[idx[i]]}([^a-z0-9_]|$)`, 'i').test(msg) && alts[idx[i]] !== 'date');
    if (badSlot < 0) throw new Error(`Windsor ${source}: ${msg.slice(0, 300)}`);
    idx[badSlot] = idx[badSlot] + 1 < slots[badSlot].length ? idx[badSlot] + 1 : -1; // próxima alternativa ou descarta
  }
  throw new Error(`Windsor ${source}: muitos campos rejeitados`);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await isLoggedIn(req))) return res.status(401).json({ error: 'Faça login no painel.' });
  if (!process.env.WINDSOR_KEY) return res.status(500).json({ error: 'WINDSOR_KEY não configurada no Vercel.' });
  const { q, from, to } = req.query;
  if (q === 'status') return res.json({ meta: !!process.env.META_ACCOUNT, ig: !!process.env.IG_ACCOUNT, gads: !!process.env.GADS_ACCOUNT, ga4_lp: !!process.env.GA4_ACCOUNT_LP_VIP, ga4_ecomm: !!process.env.GA4_ACCOUNT_ECOMM });
  const def = QUERIES[q]; if (!def) return res.status(400).json({ error: `Consulta desconhecida: ${q}` });
  const account = (process.env[def.account] || '').replace(/^[a-z0-9_]+__/i, '').trim();
  if (!account) return res.status(409).json({ error: `${def.account} não configurada no Vercel.`, notConnected: true });
  const key = `${q}|${from}|${to}`; const hit = cache.get(key); if (hit && Date.now() - hit.t < TTL) return res.json(hit.body);
  try { const body = await windsor(q, def.source, def.fields, account, from || '2026-08-01', to || new Date().toISOString().slice(0, 10)); cache.set(key, { t: Date.now(), body }); res.json(body); }
  catch (e) { res.status(502).json({ error: e.message }); }
};

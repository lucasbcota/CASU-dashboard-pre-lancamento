// CASU Board — Meta Ads via Marketing API (Meta for Developers), sem Windsor.
// Variáveis no Vercel:
//   META_TOKEN    token do usuário do sistema com ads_read (se ausente, usa IG_TOKEN)
//   META_ACCOUNT  ID da conta de anúncios (com ou sem "act_")
// Consultas: /api/meta?q=status | daily | age_gender | region | device | ads | actions   (&from&to)
// Devolve linhas no mesmo formato do proxy Windsor (nomes canônicos) + "actions_raw" com todos os action_types.

const SUPABASE_URL = 'https://iiugiinllzsmjotmnvvl.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdWdpaW5sbHpzbWpvdG1udnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTA4MzAsImV4cCI6MjA5NDk2NjgzMH0._NbUMgydMneiN-OCyFF6qRRv9wbX1mTR5GWK0wTDlMI';
const V = process.env.META_API_VERSION || 'v26.0';
const G = `https://graph.facebook.com/${V}`;
const clean = v => String(v || '').trim().replace(/^["']+|["']+$/g, '').replace(/\s+/g, '');
const TOKEN = () => clean(process.env.META_TOKEN || process.env.IG_TOKEN);
const ACCOUNT = () => { const a = clean(process.env.META_ACCOUNT).replace(/^[a-z0-9_]+__/i, ''); return a ? (a.startsWith('act_') ? a : 'act_' + a) : ''; };
const cache = new Map(); const TTL = 10 * 60 * 1000;

async function isLoggedIn(req) {
  const auth = req.headers.authorization || ''; if (!auth.startsWith('Bearer ')) return false;
  try { const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON, Authorization: auth } }); return r.ok; } catch { return false; }
}
async function gget(path, params = {}) {
  const u = new URL(`${G}/${path}`); Object.entries(params).forEach(([k, v]) => v !== undefined && u.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))); u.searchParams.set('access_token', TOKEN());
  let out = [], next = u.toString();
  for (let i = 0; i < 20 && next; i++) {
    const r = await fetch(next); const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error ? `${j.error.message} (code ${j.error.code})` : `HTTP ${r.status}`);
    if (Array.isArray(j.data)) { out = out.concat(j.data); next = j.paging && j.paging.next; } else return j;
  }
  return { data: out };
}

const BASE_FIELDS = 'date_start,spend,impressions,reach,clicks,inline_link_clicks,frequency,actions,action_values,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions,video_play_actions';
const first = a => Array.isArray(a) && a[0] ? +a[0].value || 0 : 0;
const act = (arr, ...types) => (arr || []).filter(x => types.includes(x.action_type)).reduce((s, x) => s + (+x.value || 0), 0);
const actLike = (arr, re) => (arr || []).filter(x => re.test(x.action_type)).reduce((s, x) => s + (+x.value || 0), 0);

function normalize(r) {
  const a = r.actions || [];
  const raw = {}; a.forEach(x => { raw[x.action_type] = (raw[x.action_type] || 0) + (+x.value || 0); });
  return {
    date: r.date_start, campaign: r.campaign_name, campaign_id: r.campaign_id, adset_name: r.adset_name, ad_name: r.ad_name, ad_id: r.ad_id,
    age: r.age, gender: r.gender, region: r.region, country: r.country, device_platform: r.device_platform, publisher_platform: r.publisher_platform, platform_position: r.platform_position,
    spend: +r.spend || 0, impressions: +r.impressions || 0, reach: +r.reach || 0, clicks: +r.clicks || 0, frequency: +r.frequency || 0,
    link_clicks: +r.inline_link_clicks || act(a, 'link_click'),
    landing_page_views: act(a, 'landing_page_view'),
    post_engagement: act(a, 'post_engagement'), post_reactions: act(a, 'post_reaction'), comment: act(a, 'comment'), post_shares: act(a, 'post'), post_saves: act(a, 'onsite_conversion.post_save'),
    video_views: act(a, 'video_view') || first(r.video_play_actions),
    video_p25_watched_actions: first(r.video_p25_watched_actions), video_p50_watched_actions: first(r.video_p50_watched_actions), video_p75_watched_actions: first(r.video_p75_watched_actions), video_p100_watched_actions: first(r.video_p100_watched_actions), video_thruplay_watched_actions: first(r.video_thruplay_watched_actions),
    leads: act(a, 'lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'),
    follows: actLike(a, /follow/i),
    profile_visits: actLike(a, /profile_visit|ig_profile/i),
    page_views_pixel: act(a, 'offsite_conversion.fb_pixel_view_content', 'view_content') ,
    add_to_cart: actLike(a, /add_to_cart/i), initiate_checkout: actLike(a, /initiate_checkout/i), purchases: actLike(a, /purchase/i),
    purchase_value: (r.action_values || []).filter(x => /purchase/i.test(x.action_type)).reduce((s, x) => s + (+x.value || 0), 0),
    actions_raw: raw
  };
}
const FIELDS = ['date', 'campaign', 'campaign_id', 'spend', 'impressions', 'reach', 'clicks', 'link_clicks', 'landing_page_views', 'post_engagement', 'post_reactions', 'comment', 'post_shares', 'post_saves', 'video_views', 'video_p25_watched_actions', 'video_p50_watched_actions', 'video_p75_watched_actions', 'video_p100_watched_actions', 'video_thruplay_watched_actions', 'leads', 'follows', 'profile_visits', 'add_to_cart', 'initiate_checkout', 'purchases', 'purchase_value'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await isLoggedIn(req))) return res.status(401).json({ error: 'Faça login no painel.' });
  const { q, from, to } = req.query;
  if (q === 'status') return res.json({ configured: !!(TOKEN() && ACCOUNT()) });
  if (!TOKEN() || !ACCOUNT()) return res.status(409).json({ error: 'META_TOKEN/IG_TOKEN ou META_ACCOUNT não configurados.', notConnected: true });
  const today = new Date().toISOString().slice(0, 10); const range = { since: from || '2026-08-01', until: to || today };
  const key = `${q}|${range.since}|${range.until}`; const hit = cache.get(key); if (hit && Date.now() - hit.t < TTL) return res.json(hit.body);
  try {
    const ins = async (extra) => (await gget(`${ACCOUNT()}/insights`, { time_range: range, time_increment: 1, limit: 500, ...extra })).data.map(normalize);
    let data;
    if (q === 'daily') data = await ins({ level: 'campaign', fields: 'campaign_name,campaign_id,' + BASE_FIELDS });
    else if (q === 'age_gender') data = await ins({ level: 'account', fields: BASE_FIELDS, breakdowns: 'age,gender' });
    else if (q === 'region') data = await ins({ level: 'account', fields: BASE_FIELDS, breakdowns: 'region' });
    else if (q === 'device') data = await ins({ level: 'account', fields: BASE_FIELDS, breakdowns: 'device_platform,publisher_platform,platform_position' });
    else if (q === 'ads') {
      data = await ins({ level: 'ad', fields: 'campaign_name,adset_name,ad_name,ad_id,' + BASE_FIELDS });
      // prévia dos criativos
      const ids = [...new Set(data.map(r => r.ad_id))].slice(0, 60); const thumbs = {};
      await Promise.all(ids.map(async id => { try { const j = await gget(`${id}`, { fields: 'creative{thumbnail_url,image_url,instagram_permalink_url,object_type},preview_shareable_link' }); const c = j.creative || {}; thumbs[id] = { thumb: c.image_url || c.thumbnail_url, link: c.instagram_permalink_url || j.preview_shareable_link, type: c.object_type }; } catch {} }));
      data.forEach(r => Object.assign(r, thumbs[r.ad_id] || {}));
    }
    else if (q === 'actions') { const rows = await ins({ level: 'account', fields: 'date_start,actions,action_values' }); const tot = {}; rows.forEach(r => Object.entries(r.actions_raw).forEach(([k, v]) => tot[k] = (tot[k] || 0) + v)); data = Object.entries(tot).map(([action_type, value]) => ({ action_type, value })).sort((a, b) => b.value - a.value); }
    else return res.status(400).json({ error: `Consulta desconhecida: ${q}` });
    const body = { data, fields: FIELDS, dropped: [], mapping: {}, source: 'marketing_api' };
    cache.set(key, { t: Date.now(), body }); res.json(body);
  } catch (e) { res.status(502).json({ error: `Meta: ${e.message}` }); }
};

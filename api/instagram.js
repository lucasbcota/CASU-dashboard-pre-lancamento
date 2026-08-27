// CASU Board — Instagram via Graph API (Meta for Developers), sem Windsor.
// Variáveis no Vercel:
//   IG_TOKEN     token de acesso da Página (Page Access Token de longa duração — não expira)
//   IG_USER_ID   ID da conta profissional do Instagram (instagram_business_account)
// Opcional: IG_API_VERSION (padrão v21.0)
//
// Consultas: /api/instagram?q=status | profile | daily | audience | media   (&from&to)
// Retorna no mesmo formato do proxy Windsor para o painel não mudar.

const SUPABASE_URL = 'https://iiugiinllzsmjotmnvvl.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdWdpaW5sbHpzbWpvdG1udnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTA4MzAsImV4cCI6MjA5NDk2NjgzMH0._NbUMgydMneiN-OCyFF6qRRv9wbX1mTR5GWK0wTDlMI';
const V = process.env.IG_API_VERSION || 'v26.0';
const clean = v => String(v || '').trim().replace(/^["']+|["']+$/g, '').replace(/\s+/g, '');
const TOKEN = () => clean(process.env.IG_TOKEN);
const USER_ID = () => clean(process.env.IG_USER_ID);
const G = `https://graph.facebook.com/${V}`;
const cache = new Map(); const TTL = 10 * 60 * 1000;

async function isLoggedIn(req) {
  const auth = req.headers.authorization || ''; if (!auth.startsWith('Bearer ')) return false;
  try { const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON, Authorization: auth } }); return r.ok; } catch { return false; }
}
async function gget(path, params = {}) {
  const u = new URL(`${G}/${path}`); Object.entries(params).forEach(([k, v]) => v !== undefined && u.searchParams.set(k, v)); u.searchParams.set('access_token', TOKEN());
  const r = await fetch(u.toString()); const j = await r.json();
  if (!r.ok || j.error) { const e = new Error(j.error ? `${j.error.message} (code ${j.error.code})` : `HTTP ${r.status}`); e.code = j.error && j.error.code; throw e; }
  return j;
}
const ts = d => Math.floor(new Date(d + 'T00:00:00Z').getTime() / 1000);
const dayOf = s => String(s).slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Métricas diárias. A API limita a 30 dias por chamada → varre janelas.
// Séries por dia (values): follower_count, reach, impressions (contas antigas) ou views (v22+).
// Totais (metric_type=total_value): profile_views, website_clicks, accounts_engaged, total_interactions, likes, comments, shares, saves, profile_links_taps.
async function dailySeries(id, from, to) {
  const rows = {}; const ensure = d => rows[d] = rows[d] || { date: d };
  const windows = []; let a = from; while (a <= to) { const b = addDays(a, 29) < to ? addDays(a, 29) : to; windows.push([a, b]); a = addDays(b, 1); }
  const dropped = [];
  const series = async (metric, extra = {}) => {
    for (const [a, b] of windows) {
      try { const j = await gget(`${id}/insights`, { metric, period: 'day', since: ts(a), until: ts(addDays(b, 1)), ...extra }); (j.data || []).forEach(m => (m.values || []).forEach(v => { if (v.end_time && typeof v.value === 'number') ensure(dayOf(addDays(dayOf(v.end_time), -1)))[metric] = v.value; })); }
      catch (e) { dropped.push({ metric, reason: e.message }); return false; }
    } return true;
  };
  await series('follower_count');
  await series('reach');
  const imp = await series('impressions'); if (!imp) { const ok = await series('views'); if (ok) Object.values(rows).forEach(r => { if (r.views != null && r.impressions == null) r.impressions = r.views; }); }
  // totais por janela (a API só dá o total do intervalo; distribuímos por dia para os gráficos — as somas do período batem)
  for (const metric of ['profile_views', 'website_clicks', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves', 'replies']) {
    for (const [a, b] of windows) {
      try { const j = await gget(`${id}/insights`, { metric, period: 'day', metric_type: 'total_value', since: ts(a), until: ts(addDays(b, 1)) }); const v = j.data && j.data[0] && j.data[0].total_value && j.data[0].total_value.value; if (v != null) { const n = Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1); for (let d = a; d <= b; d = addDays(d, 1)) ensure(d)[metric] = v / n; } }
      catch (e) { dropped.push({ metric, reason: e.message }); break; }
    }
  }
  // cliques nos links do perfil (bio, contato) com breakdown
  const taps = {}; for (const [a, b] of windows) {
    try { const j = await gget(`${id}/insights`, { metric: 'profile_links_taps', period: 'day', metric_type: 'total_value', breakdown: 'contact_button_type', since: ts(a), until: ts(addDays(b, 1)) }); const br = j.data && j.data[0] && j.data[0].total_value && j.data[0].total_value.breakdowns && j.data[0].total_value.breakdowns[0]; (br && br.results || []).forEach(r => { const k = r.dimension_values.join(' '); taps[k] = (taps[k] || 0) + (+r.value || 0); }); const wt = (br && br.results || []).reduce((s, r) => s + (+r.value || 0), 0); if (wt) { const n = Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1); for (let d = a; d <= b; d = addDays(d, 1)) ensure(d).profile_links_taps = wt / n; } }
    catch (e) { dropped.push({ metric: 'profile_links_taps', reason: e.message }); break; }
  }
  return { rows: Object.values(rows).sort((x, y) => x.date.localeCompare(y.date)), dropped, taps };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await isLoggedIn(req))) return res.status(401).json({ error: 'Faça login no painel.' });
  const { q, from, to } = req.query;
  const id = USER_ID();
  if (q === 'status') return res.json({ configured: !!(TOKEN() && id), token_len: TOKEN().length });
  if (!TOKEN() || !id) return res.status(409).json({ error: 'IG_TOKEN / IG_USER_ID não configurados no Vercel.', notConnected: true });
  const key = `${q}|${from}|${to}`; const hit = cache.get(key); if (hit && Date.now() - hit.t < TTL) return res.json(hit.body);
  const today = new Date().toISOString().slice(0, 10); const f = from || addDays(today, -29), t = to || today;
  try {
    let body;
    if (q === 'profile') {
      const p = await gget(id, { fields: 'username,name,followers_count,follows_count,media_count,profile_picture_url' });
      body = { data: [p] };
    } else if (q === 'daily') {
      const prof = await gget(id, { fields: 'followers_count' });
      const { rows, dropped, taps } = await dailySeries(id, f, t);
      // reconstrói total de seguidores por dia a partir do total atual e dos ganhos diários
      let total = prof.followers_count; const byDate = Object.fromEntries(rows.map(r => [r.date, r]));
      for (let d = today; d >= f; d = addDays(d, -1)) { const r = byDate[d] || (byDate[d] = { date: d }); r.followers = total; total -= (r.follower_count || 0); }
      body = { data: Object.values(byDate).filter(r => r.date >= f && r.date <= t).sort((x, y) => x.date.localeCompare(y.date)), fields: ['date', 'follower_count', 'followers', 'reach', 'impressions', 'profile_views', 'website_clicks', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves', 'profile_links_taps'], dropped: dropped.map(d => `${d.metric} (${String(d.reason).slice(0, 80)})`), taps, followers_total: prof.followers_count };
    } else if (q === 'audience') {
      const out = {}; const get = async (breakdown, key) => { try { const j = await gget(`${id}/insights`, { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown }); const res = j.data && j.data[0] && j.data[0].total_value && j.data[0].total_value.breakdowns && j.data[0].total_value.breakdowns[0]; const o = {}; (res && res.results || []).forEach(r => { o[r.dimension_values.join(' ')] = r.value; }); out[key] = o; } catch (e) { out[key + '_error'] = e.message; } };
      await get('city', 'audience_city'); await get('age,gender', 'audience_gender_age'); await get('country', 'audience_country');
      body = { data: [out] };
    } else if (q === 'media') {
      const j = await gget(`${id}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count,media_url,thumbnail_url', limit: 50 });
      const items = (j.data || []).filter(m => dayOf(m.timestamp) >= f && dayOf(m.timestamp) <= t);
      const data = await Promise.all(items.map(async m => {
        const row = { date: dayOf(m.timestamp), media_type: m.media_type, media_product_type: m.media_product_type, caption: m.caption, like_count: m.like_count, comments_count: m.comments_count, permalink: m.permalink, thumb: m.media_type === 'VIDEO' ? (m.thumbnail_url || m.media_url) : m.media_url };
        const metrics = m.media_product_type === 'REELS' ? 'reach,saved,shares,total_interactions,views' : m.media_type === 'VIDEO' ? 'reach,saved,shares,total_interactions,views' : 'reach,saved,shares,total_interactions';
        try { const ins = await gget(`${m.id}/insights`, { metric: metrics }); (ins.data || []).forEach(x => { const v = x.values && x.values[0] && x.values[0].value; row[x.name === 'views' ? 'plays' : x.name] = v; }); }
        catch (e) { try { const ins = await gget(`${m.id}/insights`, { metric: 'reach,saved' }); (ins.data || []).forEach(x => { row[x.name] = x.values && x.values[0] && x.values[0].value; }); } catch {} }
        return row;
      }));
      body = { data, fields: ['date', 'media_type', 'media_product_type', 'caption', 'like_count', 'comments_count', 'reach', 'saved', 'shares', 'plays', 'total_interactions', 'permalink', 'thumb'], dropped: [] };
    } else return res.status(400).json({ error: `Consulta desconhecida: ${q}` });
    cache.set(key, { t: Date.now(), body }); res.json(body);
  } catch (e) { res.status(502).json({ error: `Instagram: ${e.message}` }); }
};

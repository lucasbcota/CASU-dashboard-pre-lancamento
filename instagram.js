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
const G = `https://graph.facebook.com/${V}`;
const cache = new Map(); const TTL = 10 * 60 * 1000;

async function isLoggedIn(req) {
  const auth = req.headers.authorization || ''; if (!auth.startsWith('Bearer ')) return false;
  try { const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON, Authorization: auth } }); return r.ok; } catch { return false; }
}
async function gget(path, params = {}) {
  const u = new URL(`${G}/${path}`); Object.entries(params).forEach(([k, v]) => v !== undefined && u.searchParams.set(k, v)); u.searchParams.set('access_token', process.env.IG_TOKEN);
  const r = await fetch(u.toString()); const j = await r.json();
  if (!r.ok || j.error) { const e = new Error(j.error ? `${j.error.message} (code ${j.error.code})` : `HTTP ${r.status}`); e.code = j.error && j.error.code; throw e; }
  return j;
}
const ts = d => Math.floor(new Date(d + 'T00:00:00Z').getTime() / 1000);
const dayOf = s => String(s).slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Métricas diárias com séries (period=day). A API limita a 30 dias por chamada → varre janelas.
async function dailySeries(id, from, to) {
  const rows = {}; const ensure = d => rows[d] = rows[d] || { date: d };
  const windows = []; let a = from; while (a <= to) { const b = addDays(a, 29) < to ? addDays(a, 29) : to; windows.push([a, b]); a = addDays(b, 1); }
  const tryMetric = async (metric, extra, apply) => {
    for (const [a, b] of windows) {
      try {
        const j = await gget(`${id}/insights`, { metric, period: 'day', since: ts(a), until: ts(addDays(b, 1)), ...extra });
        (j.data || []).forEach(m => apply(m, ensure));
      } catch (e) { if (e.code === 100 || /not supported|invalid/i.test(e.message)) return { unsupported: metric, reason: e.message }; throw e; }
    }
    return null;
  };
  const dropped = [];
  // séries por dia (formato "values")
  for (const metric of ['follower_count', 'reach', 'impressions']) {
    const r = await tryMetric(metric, {}, (m, ensure) => (m.values || []).forEach(v => { ensure(dayOf(v.end_time))[metric] = v.value; }));
    if (r) dropped.push(r);
  }
  // "views" substitui impressions nas versões novas
  if (dropped.find(d => d.unsupported === 'impressions')) {
    const r = await tryMetric('views', { metric_type: 'total_value' }, (m, ensure) => { /* total_value não dá série; ignorado aqui */ });
    if (r) dropped.push(r);
  }
  // métricas só com total (metric_type=total_value) — distribui por janela como 1 valor por dia médio? Não: guardamos só total no primeiro dia da janela para somas baterem.
  for (const metric of ['profile_views', 'website_clicks', 'accounts_engaged', 'total_interactions']) {
    for (const [a, b] of windows) {
      try { const j = await gget(`${id}/insights`, { metric, period: 'day', metric_type: 'total_value', since: ts(a), until: ts(addDays(b, 1)) }); const v = j.data && j.data[0] && j.data[0].total_value && j.data[0].total_value.value; if (v != null) ensure(b)[metric] = (ensure(b)[metric] || 0) + v; }
      catch (e) { dropped.push({ unsupported: metric, reason: e.message }); break; }
    }
  }
  return { rows: Object.values(rows).sort((x, y) => x.date.localeCompare(y.date)), dropped };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await isLoggedIn(req))) return res.status(401).json({ error: 'Faça login no painel.' });
  const { q, from, to } = req.query;
  const id = process.env.IG_USER_ID;
  if (q === 'status') return res.json({ configured: !!(process.env.IG_TOKEN && id) });
  if (!process.env.IG_TOKEN || !id) return res.status(409).json({ error: 'IG_TOKEN / IG_USER_ID não configurados no Vercel.', notConnected: true });
  const key = `${q}|${from}|${to}`; const hit = cache.get(key); if (hit && Date.now() - hit.t < TTL) return res.json(hit.body);
  const today = new Date().toISOString().slice(0, 10); const f = from || addDays(today, -29), t = to || today;
  try {
    let body;
    if (q === 'profile') {
      const p = await gget(id, { fields: 'username,name,followers_count,follows_count,media_count,profile_picture_url' });
      body = { data: [p] };
    } else if (q === 'daily') {
      const prof = await gget(id, { fields: 'followers_count' });
      const { rows, dropped } = await dailySeries(id, f, t);
      // reconstrói total de seguidores por dia a partir do total atual e dos ganhos diários
      let total = prof.followers_count; const byDate = Object.fromEntries(rows.map(r => [r.date, r]));
      for (let d = today; d >= f; d = addDays(d, -1)) { const r = byDate[d] || (byDate[d] = { date: d }); r.followers = total; total -= (r.follower_count || 0); }
      body = { data: Object.values(byDate).filter(r => r.date >= f && r.date <= t).sort((x, y) => x.date.localeCompare(y.date)), fields: ['date', 'follower_count', 'followers', 'reach', 'impressions', 'profile_views', 'website_clicks', 'accounts_engaged', 'total_interactions'], dropped: dropped.map(d => d.unsupported), followers_total: prof.followers_count };
    } else if (q === 'audience') {
      const out = {}; const get = async (breakdown, key) => { try { const j = await gget(`${id}/insights`, { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown }); const res = j.data && j.data[0] && j.data[0].total_value && j.data[0].total_value.breakdowns && j.data[0].total_value.breakdowns[0]; const o = {}; (res && res.results || []).forEach(r => { o[r.dimension_values.join(' ')] = r.value; }); out[key] = o; } catch (e) { out[key + '_error'] = e.message; } };
      await get('city', 'audience_city'); await get('age,gender', 'audience_gender_age'); await get('country', 'audience_country');
      body = { data: [out] };
    } else if (q === 'media') {
      const j = await gget(`${id}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count', limit: 50 });
      const items = (j.data || []).filter(m => dayOf(m.timestamp) >= f && dayOf(m.timestamp) <= t);
      const data = await Promise.all(items.map(async m => {
        const row = { date: dayOf(m.timestamp), media_type: m.media_type, media_product_type: m.media_product_type, caption: m.caption, like_count: m.like_count, comments_count: m.comments_count, permalink: m.permalink };
        const metrics = m.media_product_type === 'REELS' ? 'reach,saved,shares,total_interactions,views' : m.media_type === 'VIDEO' ? 'reach,saved,shares,total_interactions,views' : 'reach,saved,shares,total_interactions';
        try { const ins = await gget(`${m.id}/insights`, { metric: metrics }); (ins.data || []).forEach(x => { const v = x.values && x.values[0] && x.values[0].value; row[x.name === 'views' ? 'plays' : x.name] = v; }); }
        catch (e) { try { const ins = await gget(`${m.id}/insights`, { metric: 'reach,saved' }); (ins.data || []).forEach(x => { row[x.name] = x.values && x.values[0] && x.values[0].value; }); } catch {} }
        return row;
      }));
      body = { data, fields: ['date', 'media_type', 'media_product_type', 'caption', 'like_count', 'comments_count', 'reach', 'saved', 'shares', 'plays', 'permalink'], dropped: [] };
    } else return res.status(400).json({ error: `Consulta desconhecida: ${q}` });
    cache.set(key, { t: Date.now(), body }); res.json(body);
  } catch (e) { res.status(502).json({ error: `Instagram: ${e.message}` }); }
};

const crypto = require('crypto');
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = 'pitchbreak:scores';

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'Database not connected' });
  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', KEY]);
      return res.status(200).json(raw ? JSON.parse(raw) : { teams: [], t: '' });
    }
    if (req.method === 'POST') {
      const pw = process.env.ADMIN_PASSWORD;
      if (!pw || !same(req.headers['x-admin-password'] || '', pw)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.teams) || body.teams.length > 300) {
        return res.status(400).json({ error: 'Bad data' });
      }
      const teams = body.teams.map((t) => {
        const o = { n: String(t.n).slice(0, 80), p: Number(t.p) || 0, k: parseInt(t.k, 10) || 1 };
        if (Number.isInteger(t.o)) o.o = t.o;
        return o;
      });
      const data = { teams, t: new Date().toISOString() };
      await redis(['SET', KEY, JSON.stringify(data)]);
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};

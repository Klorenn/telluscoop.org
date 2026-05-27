const https = require('https');

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const parsed = await parseBody(req);
  console.log('[subscribe] parsed body:', JSON.stringify(parsed));
  const { email } = parsed;
  if (!email) return res.status(400).json({ error: 'Email required', parsed });

  const body = JSON.stringify({ email, reactivate_existing: true, send_welcome_email: true });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.beehiiv.com',
      path: '/v2/publications/NRVrKCDABF/subscriptions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer M8oDjuGHryuvp0reiO24RAwiWJ8cx73AfZQo4ijYruPeAfK3cansSvhHVsVEynk8',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req2 = https.request(options, (r) => {
      let data = '';
      r.on('data', (chunk) => { data += chunk; });
      r.on('end', () => {
        console.log('[subscribe] beehiiv status:', r.statusCode, 'body:', data);
        if (r.statusCode >= 200 && r.statusCode < 300) {
          res.status(200).json({ ok: true });
        } else {
          res.status(r.statusCode).json({ error: data });
        }
        resolve();
      });
    });

    req2.on('error', (err) => {
      res.status(500).json({ error: err.message });
      resolve();
    });

    req2.write(body);
    req2.end();
  });
};

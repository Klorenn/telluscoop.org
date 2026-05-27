export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const response = await fetch('https://api.beehiiv.com/v2/publications/NRVrKCDABF/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer M8oDjuGHryuvp0reiO24RAwiWJ8cx73AfZQo4ijYruPeAfK3cansSvhHVsVEynk8',
      },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' });
  }
}

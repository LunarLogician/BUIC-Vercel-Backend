// POST /api/generate
// Admin endpoint to create a license key for a paying user
// Body: { adminPassword, userEmail, months }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { adminPassword, userEmail, months = 1 } = req.body || {};

  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!userEmail || !userEmail.includes('@')) {
    return res.status(400).json({ error: 'Valid userEmail required' });
  }

  // Generate key: BUIC-XXXX-XXXX-XXXX
  const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const licenseKey = `BUIC-${seg()}-${seg()}-${seg()}`;

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + parseInt(months));

  const record = {
    email:     userEmail.toLowerCase(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    active:    true,
  };

  // Store in Upstash Redis via REST API
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const setRes = await fetch(`${url}/set/license:${licenseKey}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: JSON.stringify(record) }),
  });

  if (!setRes.ok) {
    return res.status(500).json({ error: 'Failed to store key in Redis' });
  }

  return res.status(200).json({
    licenseKey,
    userEmail,
    expiresAt: expiresAt.toISOString(),
    message: `License valid for ${months} month(s)`,
  });
}

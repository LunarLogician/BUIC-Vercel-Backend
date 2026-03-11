// POST /api/validate
// Extension calls this to check if a license key is valid
// Body: { licenseKey, email }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { licenseKey, email } = req.body || {};

  if (!licenseKey || !email) {
    return res.status(400).json({ valid: false, reason: 'Missing licenseKey or email' });
  }

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ valid: false, reason: 'Server misconfiguration: missing env vars' });
  }

  let getRes;
  try {
    getRes = await fetch(`${url}/get/license:${licenseKey.toUpperCase()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return res.status(500).json({ valid: false, reason: 'Database connection error', detail: err.message });
  }

  if (!getRes.ok) {
    return res.status(500).json({ valid: false, reason: 'Database error', status: getRes.status });
  }

  const data = await getRes.json();
  if (!data.result) {
    return res.status(200).json({ valid: false, reason: 'Key not found' });
  }

  let record;
  try { record = JSON.parse(data.result); } catch {
    return res.status(200).json({ valid: false, reason: 'Corrupt record' });
  }

  if (!record.active) {
    return res.status(200).json({ valid: false, reason: 'Key revoked' });
  }
  if (record.email !== email.toLowerCase()) {
    return res.status(200).json({ valid: false, reason: 'Email does not match' });
  }

  const now       = new Date();
  const expiresAt = new Date(record.expiresAt);
  if (now > expiresAt) {
    return res.status(200).json({ valid: false, reason: 'Key expired', expiredAt: record.expiresAt });
  }

  const daysLeft = Math.ceil((expiresAt - now) / 86400000);
  return res.status(200).json({ valid: true, expiresAt: record.expiresAt, daysLeft });
}

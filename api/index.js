// GET / — health check
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    message: 'BUIC Extension Backend is running',
    endpoints: ['/api/generate', '/api/validate'],
  });
}

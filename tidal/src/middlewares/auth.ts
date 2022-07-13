export async function apiKeyAuth(req, res, next) {
  const apiKey = process.env.API_KEY
  if (req.headers['x-api-key'] !== apiKey) return res.status(403).end()
  next()
}

export default async function handler(req, res) {
  const { url, timeout = 15000 } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }
  res.status(200).json({ url: url });
}

const express = require("express");
const { schedulePost, getQueue } = require("./scheduler");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3500;
const BUFFER_API_KEY = process.env.BUFFER_API_KEY;

if (!BUFFER_API_KEY) {
  console.warn("⚠️  BUFFER_API_KEY not set — posts will be queued but not sent.");
}

// POST /publish — schedule a social media post
app.post("/publish", async (req, res) => {
  const { content, network, schedule_at } = req.body;

  if (!content || !network) {
    return res.status(400).json({ error: "content and network are required" });
  }

  const validNetworks = ["instagram", "linkedin", "tiktok", "twitter", "facebook"];
  if (!validNetworks.includes(network)) {
    return res.status(400).json({ error: `network must be one of: ${validNetworks.join(", ")}` });
  }

  try {
    const result = await schedulePost({ content, network, schedule_at });
    return res.json({ ok: true, post_id: result.id, status: result.status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /queue — list scheduled posts
app.get("/queue", (req, res) => {
  res.json(getQueue());
});

// GET /health
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "social-publisher", buffer_configured: !!BUFFER_API_KEY });
});

app.listen(PORT, () => {
  console.log(`🚀 social-publisher running on port ${PORT}`);
});

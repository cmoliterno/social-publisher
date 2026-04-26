const express = require('express');
const { schedulePost, getQueue } = require('./scheduler');
const { setupWebhookRoutes } = require('./webhook');

const app = express();
app.use(express.json());
app.use(String.fromCharCode(47,109,101,100,105,97), express.static(String.fromCharCode(47,97,112,112,47,112,117,98,108,105,99)));

const PORT = process.env.PORT || 3500;
const BUFFER_API_KEY = process.env.BUFFER_API_KEY;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN;

if (!BUFFER_API_KEY) {
  console.warn('⚠️  BUFFER_API_KEY not set — posts will be queued but not sent.');
}

if (!IG_ACCESS_TOKEN) {
  console.warn('⚠️  IG_ACCESS_TOKEN not set — DM automation will not work.');
}

// POST /publish — schedule a social media post
app.post('/publish', async (req, res) => {
  const { content, network, schedule_at, media_urls, post_type, media_type } = req.body;

  if (!content || !network) {
    return res.status(400).json({ error: 'content and network are required' });
  }

  const validNetworks = ['instagram', 'instagram_carol', 'linkedin', 'tiktok', 'twitter', 'facebook'];
  if (!validNetworks.includes(network)) {
    return res.status(400).json({ error: `network must be one of: ${validNetworks.join(', ')}` });
  }

  try {
    const result = await schedulePost({ content, network, schedule_at, media_urls, post_type, media_type });
    return res.json({
      ok: true,
      post_id: result.id,
      buffer_id: result.buffer_id,
      status: result.status,
      due_at: result.due_at,
    });
  } catch (err) {
    console.error('publish_failed', {
      network,
      schedule_at,
      media_count: Array.isArray(media_urls) ? media_urls.length : 0,
      media_type,
      error: err.message,
    });
    return res.status(500).json({ error: err.message });
  }
});

// GET /queue — list scheduled posts
app.get('/queue', (req, res) => {
  res.json(getQueue());
});

// GET /health
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'social-publisher',
    buffer_configured: !!BUFFER_API_KEY,
    webhook_configured: !!IG_ACCESS_TOKEN,
    webhook_url: '/webhook/instagram'
  });
});

// Webhook routes para Instagram DM automation
setupWebhookRoutes(app);

app.listen(PORT, () => {
  console.log(`🚀 social-publisher running on port ${PORT}`);
});

const IG_USER_ID = process.env.IG_USER_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN || 'openclaw_carol_verify_2026';

const COMBO_MESSAGE = `Oi! 👋 Aqui está o framework completo que prometi no post:

🔧 01 — Como orquestrar OpenClaw + Claude Code
Uso uma estrutura de agentes especializados onde cada um tem um papel definido: Scout pesquisa, Sage cria o brief, Pixel escreve o conteúdo. O Claude Code gerencia as sessões e o Javis orquestra tudo via sessions_send.

🏗️ 02 — Minha arquitetura de agentes
24 agentes rodando no VPS da Zethera, cada um com seu SOUL.md que define personalidade, ferramentas e regras de negócio. Não é IA genérica — é inteligência especializada por função.

🎯 03 — Casos reais da Zethera
Na Zethera usamos isso para: geração de conteúdo multi-canal (Instagram, LinkedIn, TikTok), automação de respostas, qualidade de código com revisão automática, e agora automação de DMs como essa que você está recebendo agora.

Quer saber mais? Me responde aqui! 🚀`;

async function sendInstagramDM(commentId) {
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) {
    console.error('IG_USER_ID ou IG_ACCESS_TOKEN não configurados');
    return { error: 'credentials_missing' };
  }

  // CORRETO: graph.instagram.com com comment_id como recipient
  const url = `https://graph.instagram.com/v20.0/${IG_USER_ID}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${IG_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: COMBO_MESSAGE }
      })
    });

    const data = await response.json();
    console.log('DM enviada para comment', commentId, ':', JSON.stringify(data));
    return data;
  } catch (err) {
    console.error('Erro ao enviar DM:', err.message);
    return { error: err.message };
  }
}

function setupWebhookRoutes(app) {
  app.get('/webhook/instagram', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Webhook verify:', { mode, token });

    if (mode === 'subscribe' && token === IG_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado com sucesso');
      return res.status(200).send(challenge);
    }

    console.warn('❌ Verificação de webhook falhou');
    return res.sendStatus(403);
  });

  app.post('/webhook/instagram', async (req, res) => {
    const body = req.body;
    console.log('Webhook recebido:', JSON.stringify(body, null, 2));

    res.sendStatus(200);

    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== 'comments') continue;

          const value = change.value || {};
          const commentText = (value.text || '').toLowerCase();
          const commentId = value.id; // comment_id para private reply

          console.log(`Comentário ${commentId}: "${commentText}"`);

          if (commentText.includes('combo')) {
            console.log(`🎯 COMBO detectado! Enviando DM para comment ${commentId}`);
            await sendInstagramDM(commentId);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao processar webhook:', err.message);
    }
  });

  console.log('Webhook Instagram registrado em GET/POST /webhook/instagram');
}

module.exports = { setupWebhookRoutes };

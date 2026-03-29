# social-publisher

Serviço de publicação social para a Zethera via Buffer API.

## Endpoints

### `POST /publish`
Agenda um post para publicação.

```json
{
  "content": "Texto do post",
  "network": "instagram|linkedin|tiktok|twitter|facebook",
  "schedule_at": "2026-04-01T10:00:00Z"
}
```

**Resposta:**
```json
{ "ok": true, "post_id": "post_xxx", "status": "scheduled" }
```

### `GET /queue`
Lista posts agendados nesta sessão.

### `GET /health`
Status do serviço.

## Setup

```bash
cp .env.example .env
# Editar .env com as credenciais
npm install
npm start
```

## Env vars

- `BUFFER_API_KEY` — chave da API do Buffer
- `BUFFER_PROFILE_INSTAGRAM` — profile ID do Instagram no Buffer
- `BUFFER_PROFILE_LINKEDIN` — profile ID do LinkedIn no Buffer
- `BUFFER_PROFILE_TIKTOK` — profile ID do TikTok no Buffer

Para obter os profile IDs:
```bash
curl "https://api.bufferapp.com/1/profiles.json?access_token=$BUFFER_API_KEY"
```

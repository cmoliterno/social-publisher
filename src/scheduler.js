const queue = [];

async function schedulePost({ content, network, schedule_at }) {
  const BUFFER_API_KEY = process.env.BUFFER_API_KEY;
  const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const entry = {
    id: postId,
    content,
    network,
    schedule_at: schedule_at || null,
    status: "queued",
    created_at: new Date().toISOString(),
  };

  if (!BUFFER_API_KEY) {
    queue.push(entry);
    return { ...entry, status: "queued_no_key" };
  }

  // Buffer API: create update
  const profileIds = process.env[`BUFFER_PROFILE_${network.toUpperCase()}`];
  if (!profileIds) {
    entry.status = "queued_no_profile";
    queue.push(entry);
    return entry;
  }

  const body = new URLSearchParams({
    text: content,
    profile_ids: profileIds,
    access_token: BUFFER_API_KEY,
  });

  if (schedule_at) {
    body.append("scheduled_at", schedule_at);
  }

  const res = await fetch("https://api.bufferapp.com/1/updates/create.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Buffer API error");

  entry.status = "scheduled";
  entry.buffer_id = data.updates?.[0]?.id;
  queue.push(entry);
  return entry;
}

function getQueue() {
  return queue;
}

module.exports = { schedulePost, getQueue };

const queue = [];

const BUFFER_API_URL = process.env.BUFFER_API_URL || "https://api.buffer.com";

const CHANNEL_IDS = {
  instagram_carol: process.env.BUFFER_CHANNEL_INSTAGRAM_CAROL || "69cbc8bcaf47dacb6973197c",
  instagram: process.env.BUFFER_CHANNEL_INSTAGRAM || "69c6d8e0af47dacb69605b03",
  linkedin:  process.env.BUFFER_CHANNEL_LINKEDIN  || "69c6d921af47dacb69605c10",
  tiktok:    process.env.BUFFER_CHANNEL_TIKTOK    || "69c6d9e7af47dacb69605f7d",
};

function buildAssets(mediaUrls = [], mediaType = "image") {
  const urls = Array.isArray(mediaUrls) ? mediaUrls.filter(Boolean) : [];
  if (urls.length === 0) return undefined;
  if (mediaType === "video") {
    return { videos: urls.map((url) => ({ url })) };
  }
  return { images: urls.map((url) => ({ url })) };
}

function buildMetadata(network, mediaType = "image") {
  if (network === "instagram" || network === "instagram_carol") {
    return {
      instagram: {
        type: mediaType === "video" ? "reel" : "post",
        shouldShareToFeed: true,
      },
    };
  }
  if (network === "tiktok") {
    return { tiktok: { type: "short" } };
  }
  return undefined;
}

async function schedulePost({ content, network, schedule_at, media_urls, media_type }) {
  const BUFFER_API_KEY = process.env.BUFFER_API_KEY;
  const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const assets = buildAssets(media_urls, media_type);
  const metadata = buildMetadata(network, media_type);

  const entry = {
    id: postId,
    content,
    network,
    schedule_at: schedule_at || null,
    media_urls: Array.isArray(media_urls) ? media_urls.filter(Boolean) : [],
    media_type: media_type || "image",
    status: "queued",
    created_at: new Date().toISOString(),
  };

  if (!BUFFER_API_KEY) {
    entry.status = "queued_no_key";
    queue.push(entry);
    return entry;
  }

  const channelId = CHANNEL_IDS[network];
  if (!channelId) {
    entry.status = "queued_no_channel";
    queue.push(entry);
    return entry;
  }

  // Build input for GraphQL
  const input = {
    channelId,
    schedulingType: "automatic",
    mode: schedule_at ? "customScheduled" : "addToQueue",
    text: content,
  };

  if (schedule_at) {
    input.dueAt = schedule_at;
  }

  if (assets) {
    input.assets = assets;
  }
  if (metadata) {
    input.metadata = metadata;
  }

  const query = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id status dueAt }
        }
        ... on InvalidInputError { message }
        ... on UnexpectedError { message }
        ... on LimitReachedError { message }
      }
    }
  `;

  const res = await fetch(BUFFER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BUFFER_API_KEY}`,
    },
    body: JSON.stringify({ query, variables: { input } }),
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (err) {
    throw new Error(`Buffer returned non-JSON response (${res.status}): ${raw.slice(0, 500)}`);
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || `Buffer HTTP ${res.status}: ${raw.slice(0, 500)}`);
  }

  if (data.errors) {
    throw new Error(data.errors.map(e => e.message).join("; "));
  }

  const result = data.data?.createPost;
  if (result?.message) {
    throw new Error(result.message);
  }

  const post = result?.post;
  if (!post?.id) {
    throw new Error(`Buffer createPost did not return a post: ${JSON.stringify(data).slice(0, 500)}`);
  }
  entry.status = "scheduled";
  entry.buffer_id = post?.id;
  entry.due_at = post?.dueAt;
  queue.push(entry);
  return entry;
}

function getQueue() {
  return queue;
}

module.exports = { schedulePost, getQueue };

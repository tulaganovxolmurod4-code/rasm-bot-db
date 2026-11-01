import { dhashFromJpeg, hamming } from "./hash.js";

const MAX_DIST = 10;

async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

function pickPhoto(sizes) {
  return [...sizes].sort((a, b) => a.width - b.width)[0];
}

async function handleUpdate(update, env) {
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat.id;

  if (msg.photo) {
    const photo = pickPhoto(msg.photo);
    const f = await tg(env, "getFile", { file_id: photo.file_id });
    const res = await fetch(
      `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${f.result.file_path}`
    );
    const bytes = new Uint8Array(await res.arrayBuffer());

    let hash;
    try {
      hash = dhashFromJpeg(bytes);
    } catch (e) {
      await tg(env, "sendMessage", { chat_id: chatId, text: "Rasmni o'qib bo'lmadi." });
      return;
    }

    const { results } = await env.DB.prepare(
      "SELECT username, title, kind, phash FROM chats"
    ).all();

    const found = results
      .map((r) => ({ ...r, d: hamming(hash, r.phash) }))
      .filter((r) => r.d <= MAX_DIST)
      .sort((a, b) => a.d - b.d)
      .slice(0, 10);

    if (!found.length) {
      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: "Bazada bunday profil rasmli kanal/guruh topilmadi.",
      });
      return;
    }

    const lines = found.map((r, i) => {
      const sim = Math.round(((64 - r.d) / 64) * 100);
      return `${i + 1}. ${r.title} (${r.kind}) ${sim}%\nhttps://t.me/${r.username}`;
    });
    await tg(env, "sendMessage", {
      chat_id: chatId,
      text: lines.join("\n\n"),
      link_preview_options: { is_disabled: true },
    });
    return;
  }

  await tg(env, "sendMessage", {
    chat_id: chatId,
    text: "Menga rasm yuboring, men shu rasm profilga qo'yilgan kanal va guruhlarni qidiraman.",
  });
}

async function handleUpsert(request, env) {
  if (request.headers.get("x-secret") !== env.API_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const items = await request.json();
  const now = Math.floor(Date.now() / 1000);
  const stmt = env.DB.prepare(
    `INSERT INTO chats (chat_id, username, title, kind, phash, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(chat_id) DO UPDATE SET
       username=excluded.username, title=excluded.title,
       kind=excluded.kind, phash=excluded.phash, updated_at=excluded.updated_at`
  );
  await env.DB.batch(
    items.map((x) => stmt.bind(x.chat_id, x.username, x.title, x.kind, x.phash, now))
  );
  return Response.json({ ok: true, count: items.length });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/webhook") {
      if (request.headers.get("x-telegram-bot-api-secret-token") !== env.TG_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const update = await request.json();
      try {
        await handleUpdate(update, env);
      } catch (e) {
        console.error(e);
      }
      return new Response("ok");
    }

    if (request.method === "POST" && url.pathname === "/api/upsert") {
      return handleUpsert(request, env);
    }

    return new Response("Bot ishlayapti");
  },
};

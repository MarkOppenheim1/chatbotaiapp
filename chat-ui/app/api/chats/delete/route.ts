export async function POST(req: Request) {
  const body = await req.json(); // { user_id, chat_id }

  const url = `http://localhost:8001/chats?user_id=${encodeURIComponent(body.user_id)}&chat_id=${encodeURIComponent(body.chat_id)}`;
  const res = await fetch(url, { method: "DELETE" });
  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
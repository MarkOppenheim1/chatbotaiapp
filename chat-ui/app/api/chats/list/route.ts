import { BACKEND_URL } from "@/app/lib/backend";

export async function POST(req: Request) {
  const body = await req.json(); // { user_id }

  const res = await fetch(`${BACKEND_URL}/chats?user_id=${encodeURIComponent(body.user_id)}`);
  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

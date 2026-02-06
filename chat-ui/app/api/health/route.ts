import { BACKEND_URL } from "@/app/lib/backend";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { cache: "no-store" });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, status: res.status }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: true, backend: data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? "unreachable" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

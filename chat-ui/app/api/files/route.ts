import { BACKEND_URL } from "@/app/lib/backend";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request) {
  // Require login (recommended)
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) return new Response("Missing path", { status: 400 });

  // Forward to backend
  const upstream = await fetch(
    `${BACKEND_URL}/files?path=${encodeURIComponent(path)}`,
    { cache: "no-store" }
  );

  // Pass through content headers so PDFs open inline, etc.
  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  const cd = upstream.headers.get("content-disposition");
  if (ct) headers.set("content-type", ct);
  if (cd) headers.set("content-disposition", cd);

  return new Response(upstream.body, { status: upstream.status, headers });
}

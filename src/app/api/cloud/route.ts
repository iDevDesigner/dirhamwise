import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionUserFromToken } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

const MAX_BLOB = 4 * 1024 * 1024; // stay under serverless body limits

function unauthorized() {
  return NextResponse.json({ error: "Not signed in." }, { status: 401 });
}

/** Pull the cloud backup blob for the signed-in user. */
export async function GET(req: NextRequest) {
  const user = await sessionUserFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return unauthorized();

  const row = await prisma.cloudData.findUnique({ where: { userId: user.id } });
  if (!row) return NextResponse.json({ savedAt: null, blob: null });

  try {
    return NextResponse.json({
      savedAt: row.updatedAt,
      size: row.size,
      blob: JSON.parse(row.blob),
    });
  } catch {
    return NextResponse.json({ error: "Stored backup is corrupted." }, { status: 500 });
  }
}

/** Push (overwrite) the cloud backup blob for the signed-in user. */
export async function PUT(req: NextRequest) {
  const user = await sessionUserFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const blob = body?.blob;
  if (!blob || typeof blob !== "object" || !Array.isArray(blob.txns)) {
    return NextResponse.json({ error: "Invalid backup payload." }, { status: 400 });
  }

  const json = JSON.stringify(blob);
  if (json.length > MAX_BLOB) {
    return NextResponse.json(
      { error: "Backup is too large for the free plan (4 MB limit)." },
      { status: 413 }
    );
  }

  const saved = await prisma.cloudData.upsert({
    where: { userId: user.id },
    create: { userId: user.id, blob: json, size: json.length },
    update: { blob: json, size: json.length },
  });

  return NextResponse.json({ savedAt: saved.updatedAt, size: saved.size });
}

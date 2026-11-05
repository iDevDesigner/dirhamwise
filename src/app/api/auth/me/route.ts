import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionUserFromToken } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await sessionUserFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}

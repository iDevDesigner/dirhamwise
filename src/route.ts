import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  normalizeEmail,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(String(body?.email ?? ""));
    const password = String(body?.password ?? "");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
    }

    const token = await createSessionToken(user.id);
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("login failed", err);
    return NextResponse.json({ error: "Could not sign in. Try again." }, { status: 500 });
  }
}

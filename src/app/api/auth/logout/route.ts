import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  hashPassword,
  normalizeEmail,
  sessionCookieOptions,
  validEmail,
} from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(String(body?.email ?? ""));
    const password = String(body?.password ?? "");
    const name = String(body?.name ?? "").trim().slice(0, 40) || null;

    if (!validEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in." },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(password) },
      select: { id: true, email: true, name: true },
    });

    const token = await createSessionToken(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("register failed", err);
    return NextResponse.json({ error: "Could not create the account. Try again." }, { status: 500 });
  }
}

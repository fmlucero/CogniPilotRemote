import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  let body: { username: string; password: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, password } = body;

  const adminUser = process.env.ADMIN_USER;
  const adminHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminUser || !adminHash) {
    console.error("ADMIN_USER or ADMIN_PASSWORD_HASH env vars not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const usernameOk = username === adminUser;
  const passwordOk = await bcrypt.compare(password, adminHash);

  if (!usernameOk || !passwordOk) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = await getSession();
  session.user = { username };
  await session.save();

  return NextResponse.json({ ok: true });
}

import { getIronSession, IronSession, IronSessionData } from "iron-session";
import { cookies } from "next/headers";

declare module "iron-session" {
  interface IronSessionData {
    user?: { username: string };
  }
}

const sessionOptions = {
  cookieName: "cognipilot_session",
  password: process.env.SESSION_SECRET as string,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict" as const,
    maxAge: 60 * 60 * 8, // 8 horas
  },
};

export async function getSession(): Promise<IronSession<IronSessionData>> {
  const cookieStore = await cookies();
  return getIronSession<IronSessionData>(cookieStore, sessionOptions);
}

export async function getAuthUser(): Promise<{ username: string } | null> {
  const session = await getSession();
  return session.user ?? null;
}

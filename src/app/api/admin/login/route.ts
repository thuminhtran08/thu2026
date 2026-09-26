import { NextRequest, NextResponse } from "next/server";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Admin chưa được cấu hình." },
        { status: 500 },
      );
    }

    if (
      username !== ADMIN_USERNAME ||
      password !== ADMIN_PASSWORD
    ) {
      return NextResponse.json(
        { ok: false, error: "Sai tên đăng nhập hoặc mật khẩu." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set("tdc_admin_session", ADMIN_SESSION_SECRET, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Không thể đăng nhập." },
      { status: 400 },
    );
  }
}
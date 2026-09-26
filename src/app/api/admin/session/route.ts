import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = request.cookies.get("tdc_admin_session")?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || session !== secret) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 },
    );
  }

  return NextResponse.json({
    authenticated: true,
  });
}
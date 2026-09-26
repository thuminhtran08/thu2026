import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isAdmin(request: NextRequest) {
  const session = request.cookies.get("tdc_admin_session")?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;

  return Boolean(secret && session === secret);
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Thiếu cấu hình Supabase phía server.");
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { error: "Không có quyền quản trị." },
      { status: 401 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("cakes")
      .select("id, name, rings, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    const cakes = (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      rings: row.rings,
      createdAt: String(row.created_at),
    }));

    return NextResponse.json({ cakes });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không tải được danh sách bánh.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { ok: false, error: "Không có quyền quản trị." },
      { status: 401 },
    );
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Thiếu ID bánh." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("cakes")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Không thể xóa bánh.",
      },
      { status: 500 },
    );
  }
}
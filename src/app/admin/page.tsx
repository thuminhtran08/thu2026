"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

type QuizOption = { label: string; asset: string };
type Cake = {
  id: string;
  name: string;
  rings: [QuizOption, QuizOption, QuizOption];
  createdAt: string;
};

export default function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [cakes, setCakes] = useState<Cake[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void checkSession();
  }, []);

  useEffect(() => {
    if (authenticated) void loadCakes();
  }, [authenticated]);

  async function checkSession() {
    try {
      const response = await fetch("/api/admin/session", {
        method: "GET",
        cache: "no-store",
      });
      setAuthenticated(response.ok);
    } catch {
      setAuthenticated(false);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    setLoggingIn(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setLoginError(data.error || "Sai tên đăng nhập hoặc mật khẩu.");
        return;
      }

      setPassword("");
      setAuthenticated(true);
    } catch {
      setLoginError("Không thể đăng nhập lúc này.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    setAuthenticated(false);
    setCakes([]);
    setPassword("");
  }

  async function loadCakes() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/cakes", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json().catch(() => ({}))) as {
        cakes?: Cake[];
        error?: string;
      };

      if (response.status === 401) {
        setAuthenticated(false);
        setCakes([]);
        return;
      }

      if (!response.ok) {
        alert(data.error || "Không tải được danh sách bánh.");
        return;
      }

      setCakes(data.cakes ?? []);
    } catch {
      alert("Không tải được danh sách bánh.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCake(cake: Cake) {
    if (deletingId) return;
    if (!window.confirm(`Xóa bánh của ${cake.name} khỏi Tiệm bánh?`)) return;

    setDeletingId(cake.id);

    try {
      const response = await fetch(
        `/api/admin/cakes?id=${encodeURIComponent(cake.id)}`,
        { method: "DELETE" },
      );

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (response.status === 401) {
        setAuthenticated(false);
        setCakes([]);
        return;
      }

      if (!response.ok || !data.ok) {
        alert(data.error || "Không thể xóa bánh.");
        return;
      }

      setCakes((current) => current.filter((item) => item.id !== cake.id));
    } catch {
      alert("Không thể xóa bánh.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return cakes;
    return cakes.filter((cake) => cake.name.toLowerCase().includes(key));
  }, [cakes, query]);

  if (authenticated === null) {
    return (
      <main className="adminShell">
        <AdminStyle />
        <p>Đang kiểm tra quyền quản trị…</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="adminShell">
        <AdminStyle />
        <section className="loginCard">
          <Image
            src="/images/phenakistoscope/logo.png"
            alt="TDC"
            width={112}
            height={56}
            unoptimized
          />
          <h1>Quản trị Tiệm bánh</h1>
          <p>Đăng nhập để quản lý những chiếc bánh trên kệ.</p>

          <form onSubmit={handleLogin}>
            <label>
              Tên đăng nhập
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>

            <label>
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            {loginError && <div className="errorText">{loginError}</div>}

            <button disabled={loggingIn}>
              {loggingIn ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="adminShell">
      <AdminStyle />

      <header className="adminHeader">
        <div>
          <h1>Tiệm bánh — Quản trị</h1>
          <p>{cakes.length} chiếc bánh đang được lưu</p>
        </div>

        <div className="headerActions">
          <a href="/">Mở trang chơi</a>
          <button onClick={() => void handleLogout()}>Đăng xuất</button>
        </div>
      </header>

      <div className="toolbar">
        <input
          placeholder="Tìm theo tên…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={() => void loadCakes()} disabled={loading}>
          {loading ? "Đang tải…" : "Làm mới"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          {loading ? "Đang tải danh sách…" : "Không có bánh phù hợp."}
        </div>
      ) : (
        <section className="grid">
          {filtered.map((cake) => (
            <article className="card" key={cake.id}>
              <div className="preview">
                {cake.rings.map((ring, index) => (
                  <img
                    key={`${cake.id}-${index}`}
                    src={ring.asset}
                    alt=""
                    style={{
                      width: `${[28, 64, 94][index]}%`,
                      height: `${[28, 64, 94][index]}%`,
                    }}
                  />
                ))}
              </div>

              <div className="meta">
                <strong>{cake.name}</strong>
                <small>{new Date(cake.createdAt).toLocaleString("vi-VN")}</small>
              </div>

              <button
                className="delete"
                disabled={deletingId === cake.id}
                onClick={() => void deleteCake(cake)}
              >
                {deletingId === cake.id ? "Đang xóa…" : "Xóa bánh"}
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function AdminStyle() {
  return (
    <style jsx global>{`
      @font-face {
        font-family: "CDA Independence Text";
        src: url("/fonts/CDAIndependenceText-Medium.otf") format("opentype");
        font-weight: 500;
        font-display: swap;
      }
      * { box-sizing: border-box; }
      
      html {
        scroll-behavior: smooth;
        height: 100%;
      }

      body {
        margin: 0;
        background: #080800;
        color: #fff;
        min-height: 100%;
        overflow-y: auto;
      }

      ::-webkit-scrollbar {
        width: 10px;
      }
      ::-webkit-scrollbar-track {
        background: #080800;
      }
      ::-webkit-scrollbar-thumb {
        background: #34340b;
        border-radius: 5px;
        border: 1px solid rgba(220, 220, 87, 0.2);
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #89891b;
      }

      button, input, a { font: 500 15px/1.3 "CDA Independence Text", serif; }
      
      .adminShell {
        min-height: 100vh;
        padding: 36px clamp(18px, 4vw, 64px);
        background: radial-gradient(circle at 50% 0, #34340b 0, #0d0d02 34%, #050500 72%);
        font-family: "CDA Independence Text", serif;
      }
      .loginCard {
        width: min(430px, 100%);
        margin: 10vh auto 0;
        padding: 36px;
        border: 1px solid rgba(210,210,78,.35);
        border-radius: 22px;
        background: rgba(0,0,0,.72);
        box-shadow: 0 18px 80px rgba(0,0,0,.45);
        text-align: center;
      }
      .loginCard h1 { margin: 18px 0 8px; font-size: 27px; }
      .loginCard p { margin: 0 0 24px; color: #c9c9b8; }
      .loginCard form { display: grid; gap: 15px; text-align: left; }
      .loginCard label { display: grid; gap: 7px; color: #e6e6d2; }
      .loginCard input, .toolbar input {
        width: 100%;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 12px;
        background: #111108;
        color: #fff;
        padding: 13px 14px;
        outline: none;
      }
      .loginCard input:focus, .toolbar input:focus { border-color: #b6b63d; }
      .loginCard button, .toolbar button, .headerActions button, .headerActions a {
        border: 1px solid rgba(220,220,87,.45);
        border-radius: 12px;
        background: #89891b;
        color: #fff;
        padding: 12px 16px;
        cursor: pointer;
        text-decoration: none;
        text-align: center;
      }
      .errorText { color: #ff9b9b; font-size: 14px; }
      .adminHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        margin: 0 auto 26px;
        max-width: 1280px;
      }
      .adminHeader h1 { margin: 0 0 6px; font-size: clamp(26px,3vw,40px); }
      .adminHeader p { margin: 0; color: #bdbda9; }
      .headerActions { display: flex; gap: 10px; flex-wrap: wrap; }
      .headerActions button, .headerActions a { background: rgba(255,255,255,.06); }
      .toolbar {
        max-width: 1280px;
        margin: 0 auto 24px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
      }
      .grid {
        max-width: 1280px;
        margin: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill,minmax(230px,1fr));
        gap: 18px;
        padding-bottom: 40px;
      }
      .card {
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 18px;
        padding: 14px;
        background: rgba(10,10,3,.78);
      }
      .preview {
        position: relative;
        aspect-ratio: 1;
        border-radius: 14px;
        background: radial-gradient(circle,#2e2e08,#050500 68%);
        overflow: hidden;
      }
      .preview img {
        position: absolute;
        left: 50%;
        top: 50%;
        object-fit: contain;
        transform: translate(-50%,-50%);
      }
      .meta { display: grid; gap: 5px; padding: 13px 2px; }
      .meta strong { font-size: 18px; }
      .meta small { color: #a9a995; }
      .delete {
        width: 100%;
        border: 1px solid rgba(255,110,110,.35);
        border-radius: 11px;
        background: rgba(132,28,28,.7);
        color: #fff;
        padding: 11px;
        cursor: pointer;
      }
      .delete:disabled { opacity: .55; cursor: wait; }
      .empty {
        max-width: 1280px;
        margin: 80px auto;
        text-align: center;
        color: #bdbda9;
      }
      @media (max-width: 640px) {
        .adminShell { padding: 24px 14px; }
        .adminHeader { align-items: flex-start; flex-direction: column; }
        .headerActions { width: 100%; }
        .headerActions > * { flex: 1; }
        .toolbar { grid-template-columns: 1fr; }
        .grid { grid-template-columns: 1fr 1fr; gap: 10px; }
        .card { padding: 9px; }
        .meta strong { font-size: 15px; }
        .meta small { font-size: 11px; }
        .delete { font-size: 13px; }
        .loginCard { margin-top: 5vh; padding: 28px 20px; }
      }
      @media (max-width: 420px) {
        .grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}
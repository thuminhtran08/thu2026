import { NextResponse } from "next/server";
import path from "node:path";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { spawn } from "node:child_process";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CakeRing = {
  label?: string;
  asset?: string;
};

type SendCakeBody = {
  email?: string;
  message?: string;
  senderName?: string;
  cake?: CakeRing[];
  action?: "send" | "download";
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
  error?: {
    message?: string;
  };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VIDEO_SIZE = 520;
const VIDEO_DURATION_SECONDS = 6;
const VIDEO_FPS = 30;
const VIDEO_FRAMES = VIDEO_DURATION_SECONDS * VIDEO_FPS;
const PHENAKISTOSCOPE_STEPS = 12;
const MID_AUTUMN_ART_PATH = path.join(process.cwd(), "public", "images", "mid-autumn-email-art.png");

function resolveFfmpegPath() {
  const executable = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return path.resolve(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    executable,
  );
}

// Match the current page.tsx visual proportions.
// Keep the three selected artworks on three clearly separated concentric rings.
// The old 40/66/92 sizing made neighboring source artworks visually overlap in Gmail.
const RING_SIZE_PERCENT = [22, 58, 86] as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safePublicAssetPath(asset: string) {
  const cleanAsset = asset.split("?")[0].split("#")[0];

  if (!cleanAsset.startsWith("/images/phenakistoscope/")) {
    throw new Error(`Asset không hợp lệ: ${asset}`);
  }

  const relative = cleanAsset.replace(/^\/+/, "");
  const publicRoot = path.resolve(process.cwd(), "public");
  const absolute = path.resolve(publicRoot, relative);

  if (!absolute.startsWith(publicRoot + path.sep)) {
    throw new Error(`Asset nằm ngoài thư mục public: ${asset}`);
  }

  return absolute;
}

async function renderRing(
  assetPath: string,
  size: number,
  angle: number,
) {
  /*
   * Mỗi source là artwork tròn chứa 12 trạng thái.
   * GIF tiến theo 12 bước rời rạc, mỗi bước đúng 30°.
   * Không tween/crossfade giữa các frame.
   */
  return sharp(assetPath)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .rotate(angle, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function renderCakeFrame(
  cake: Required<Pick<CakeRing, "asset">>[],
  frame: number,
) {
  // Match the browser ring motion:
  // continuous counter-clockwise circular rotation, with NO scale/zoom animation.
  // Keep every ring at a fixed size for the entire MP4.
  const progress = frame / VIDEO_FRAMES;
  const stepAngle = -(progress * 360);

  const composites = await Promise.all(
    cake.slice(0, 3).map(async (ring, index) => {
      const ringSize = Math.round(
        VIDEO_SIZE * (RING_SIZE_PERCENT[index] / 100),
      );

      /*
       * All three rings share one center.
       * The current browser animation uses the same 12-step cycle.
       */
      const input = await renderRing(
        safePublicAssetPath(ring.asset),
        ringSize,
        stepAngle,
      );

      return {
        input,
        left: Math.round((VIDEO_SIZE - ringSize) / 2),
        top: Math.round((VIDEO_SIZE - ringSize) / 2),
      };
    }),
  );

  return sharp({
    create: {
      width: VIDEO_SIZE,
      height: VIDEO_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function createCakeMp4(cake: CakeRing[]) {
  if (cake.length !== 3 || cake.some((ring) => !ring.asset)) {
    throw new Error("Chiếc bánh phải có đủ 3 vòng để tạo MP4.");
  }

  const ffmpegExecutable = resolveFfmpegPath();
  await access(ffmpegExecutable);

  const normalized = cake.map((ring) => ({ asset: ring.asset as string }));
  for (const ring of normalized) await access(safePublicAssetPath(ring.asset));

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "tdc-cake-"));
  const outputPath = path.join(tempDir, "banh-trung-thu.mp4");

  try {
    for (let frame = 0; frame < VIDEO_FRAMES; frame += 1) {
      const png = await renderCakeFrame(normalized, frame);
      const fileName = `frame-${String(frame + 1).padStart(3, "0")}.png`;
      await writeFile(path.join(tempDir, fileName), png);
    }

    console.log("[send-cake] FFmpeg executable:", ffmpegExecutable);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(ffmpegExecutable, [
        "-y",
        "-framerate", String(VIDEO_FPS),
        "-i", path.join(tempDir, "frame-%03d.png"),
        "-vf", `scale=${VIDEO_SIZE}:${VIDEO_SIZE}:flags=lanczos,format=yuv420p`,
        "-c:v", "libx264",
        "-profile:v", "main",
        "-level", "3.1",
        "-movflags", "+faststart",
        "-r", String(VIDEO_FPS),
        outputPath,
      ]);

      let stderr = "";
      ffmpeg.stderr.on("data", (chunk) => { stderr += String(chunk); });
      ffmpeg.on("error", reject);
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg lỗi (${code}): ${stderr.slice(-1200)}`));
      });
    });

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

    const body = (await request.json()) as SendCakeBody;

    const email = body.email?.trim() ?? "";
    const message = body.message?.trim() ?? "";
    const senderName = body.senderName?.trim() || "Một người bạn";
    const cake = Array.isArray(body.cake) ? body.cake.slice(0, 3) : [];
    const action = body.action === "download" ? "download" : "send";

    if (action === "send" && !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Email người nhận không hợp lệ." },
        { status: 400 },
      );
    }

    if (message.length > 300) {
      return NextResponse.json(
        { ok: false, error: "Lời nhắn tối đa 300 ký tự." },
        { status: 400 },
      );
    }

    if (
      cake.length !== 3 ||
      cake.some(
        (ring) =>
          !ring.asset ||
          !ring.asset.startsWith("/images/phenakistoscope/"),
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dữ liệu bánh không hợp lệ hoặc chưa đủ 3 vòng.",
        },
        { status: 400 },
      );
    }

    const safeSender = escapeHtml(senderName);
    const safeMessage = escapeHtml(message);

    const ringNames = cake
      .map((ring) => escapeHtml(ring.label?.trim() || ""))
      .filter(Boolean);

    console.log("[send-cake] Creating MP4...", { cakeRings: cake.length, action });

    const mp4Buffer = await createCakeMp4(cake);

    if (action === "download") {
      return new NextResponse(new Uint8Array(mp4Buffer), {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": 'attachment; filename="chiec-banh-dem-trang.mp4"',
          "Cache-Control": "no-store",
        },
      });
    }

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Server chưa cấu hình RESEND_API_KEY." }, { status: 500 });
    }
    if (!fromEmail) {
      return NextResponse.json({ ok: false, error: "Server chưa cấu hình RESEND_FROM_EMAIL." }, { status: 500 });
    }

    const mp4Base64 = mp4Buffer.toString("base64");

    // Email media: use the real cake generated from the user's 3 selected rings.
    // CID keeps the artwork visible inside Gmail without requiring a public image URL.
    const normalizedCake = cake.map((ring) => ({ asset: ring.asset as string }));
    // Build exactly ONE flattened preview from the three selected rings.
    // Gmail receives only this final PNG, so it cannot stack/re-render individual ring assets.
    const cakePreviewBuffer = await renderCakeFrame(normalizedCake, 0);
    const cakePreviewBase64 = cakePreviewBuffer.toString("base64");

    const ringListText = ringNames.join(" · ");

    // IMPORTANT: Gmail + production Linux/Vercel cannot reliably render a custom
    // OTF embedded inside an SVG rasterized by Sharp/librsvg. Vietnamese glyphs
    // can therefore become □□□ after deployment. Keep email copy as real UTF-8
    // HTML and use a Gmail-safe font stack. The cake artwork remains a CID PNG.
    const safeMessageLine = safeMessage || "Một chiếc bánh nhỏ thay lời thương gửi dưới ánh trăng.";

    const html = `
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Chiếc bánh đêm trăng</title>
        </head>
        <body style="margin:0;padding:0;background:#050504;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#050504;border-collapse:collapse;">
            <tr><td align="center" style="padding:0;">
              <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#050504;border-collapse:collapse;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">

                <tr><td align="center" style="padding:30px 28px 8px;color:#d8ae50;font-size:11px;line-height:1.4;letter-spacing:3px;font-weight:600;">
                  XOAY VÒNG XOAY · TRUNG THU
                </td></tr>

                <tr><td align="center" style="padding:18px 28px 0;color:#fff8e8;font-size:34px;line-height:1.22;font-weight:500;">
                  Trăng đã lên,<br>có một chiếc bánh gửi đến bạn.
                </td></tr>

                <tr><td align="center" style="padding:22px 28px 0;color:#f2d184;font-size:15px;line-height:1.5;font-weight:600;">
                  ${safeSender}
                </td></tr>

                <tr><td align="center" style="padding:5px 34px 20px;color:#d5cbb7;font-size:13px;line-height:1.6;">
                  gửi đến bạn một chiếc bánh nhỏ dưới ánh trăng đêm nay.
                </td></tr>

                <tr><td align="center" style="padding:10px 50px 24px;line-height:0;font-size:0;">
                  <img src="cid:cake-preview" width="480" alt="Chiếc bánh Trung Thu được gửi đến bạn" style="display:block;width:100%;max-width:480px;height:auto;margin:0 auto;border:0;outline:0;">
                </td></tr>

                <tr><td align="center" style="padding:18px 28px 6px;color:#d8ae50;font-size:10px;line-height:1.4;letter-spacing:3px;font-weight:600;">
                  TRONG CHIẾC BÁNH ĐÊM TRĂNG
                </td></tr>

                <tr><td align="center" style="padding:10px 34px;color:#ddd3c1;font-size:14px;line-height:1.6;">
                  ${ringListText}
                </td></tr>

                <tr><td align="center" style="padding:12px 34px 4px;color:#efd58f;font-size:22px;line-height:1;">☾</td></tr>

                <tr><td align="center" style="padding:12px 40px;color:#eee3cb;font-size:17px;line-height:1.7;font-weight:500;">
                  ${safeMessageLine}
                </td></tr>

                <tr><td align="center" style="padding:22px 28px 4px;color:#8f8067;font-size:10px;line-height:1.5;letter-spacing:2.5px;">
                  XOAY VÒNG XOAY — TDC
                </td></tr>

                <tr><td align="center" style="padding:4px 28px 30px;color:#776f62;font-size:11px;line-height:1.5;">
                  Trăng tròn một tối · Lời thương còn mãi
                </td></tr>

              </table>
            </td></tr>
          </table>
        </body>
      </html>`;

    console.log("[send-cake] Sending email", {
      to: email,
      from: fromEmail,
      mp4Bytes: mp4Buffer.length,
    });

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `${senderName} gửi bạn một chiếc bánh Trung Thu 🎑`,
          html,
          attachments: [
            {
              filename: "chiec-banh-dem-trang.mp4",
              content: mp4Base64,
              content_type: "video/mp4",
            },
            {
              filename: "banh-trung-thu-preview.png",
              content: cakePreviewBase64,
              content_type: "image/png",
              content_id: "cake-preview",
            },
          ],
        }),
        cache: "no-store",
      },
    );

    const rawResponse = await resendResponse.text();

    let resendResult: ResendResponse = {};

    try {
      resendResult = rawResponse
        ? (JSON.parse(rawResponse) as ResendResponse)
        : {};
    } catch {
      resendResult = { message: rawResponse };
    }

    if (!resendResponse.ok) {
      const errorMessage =
        resendResult.error?.message ||
        resendResult.message ||
        `Resend trả về HTTP ${resendResponse.status}.`;

      console.error("[send-cake] Resend error:", {
        status: resendResponse.status,
        response: resendResult,
      });

      return NextResponse.json(
        {
          ok: false,
          error: errorMessage,
          resendStatus: resendResponse.status,
        },
        {
          status:
            resendResponse.status >= 400 &&
            resendResponse.status <= 599
              ? resendResponse.status
              : 502,
        },
      );
    }

    console.log("[send-cake] Email sent:", resendResult.id);

    /*
     * page.tsx uses this exact GIF after a successful send.
     * The browser keeps its own post-send animation; email receives MP4.
     */
    return NextResponse.json({
      ok: true,
      id: resendResult.id,
      message: "Đã gửi bánh thành công.",
      mp4DataUrl: `data:video/mp4;base64,${mp4Base64}`,
    });
  } catch (error) {
    console.error("[send-cake] Unexpected error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      {
        ok: false,
        error: "Không thể tạo hoặc gửi MP4 lúc này.",
        detail:
          process.env.NODE_ENV === "development"
            ? errorMessage
            : undefined,
      },
      { status: 500 },
    );
  }
}

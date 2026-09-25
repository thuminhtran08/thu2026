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
const VIDEO_FRAMES = 12;
const VIDEO_FPS = 12;
const MID_AUTUMN_ART_PATH = path.join(process.cwd(), "public", "images", "mid-autumn-email-art.png");
const EMAIL_FONT_PATH = path.join(process.cwd(), "public", "fonts", "CDAIndependenceText-Medium.otf");

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
const RING_SIZE_PERCENT = [22, 58, 92] as const;

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
  const stepAngle = frame * 30;

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
          "Content-Disposition": 'attachment; filename="banh-trung-thu.mp4"',
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

    // Gmail does not reliably load custom web fonts. Render ALL visible email
    // typography server-side with the exact CDA OTF, then send it as CID PNGs.
    let emailFontBase64 = "";
    try {
      emailFontBase64 = (await readFile(EMAIL_FONT_PATH)).toString("base64");
    } catch {
      console.warn("[send-cake] CDA email font not found:", EMAIL_FONT_PATH);
    }

    const fontCss = emailFontBase64
      ? `@font-face{font-family:CDA;src:url(data:font/otf;base64,${emailFontBase64}) format('opentype');font-weight:500;font-style:normal} text{font-family:CDA;font-weight:500}`
      : `text{font-family:Arial,sans-serif;font-weight:500}`;

    const heroSvg = `
      <svg width="620" height="260" viewBox="0 0 620 260" xmlns="http://www.w3.org/2000/svg">
        <style>${fontCss}</style>
        <rect width="620" height="260" fill="#050504"/>
        <text x="310" y="38" text-anchor="middle" fill="#d8ae50" font-size="11" letter-spacing="3.5">XOAY VÒNG XOAY · TRUNG THU</text>
        <text x="310" y="100" text-anchor="middle" fill="#fff8e8" font-size="35">Trăng đã lên,</text>
        <text x="310" y="145" text-anchor="middle" fill="#fff8e8" font-size="35">có một chiếc bánh gửi đến bạn.</text>
        <text x="310" y="198" text-anchor="middle" fill="#f2d184" font-size="15">${safeSender}</text>
        <text x="310" y="226" text-anchor="middle" fill="#d5cbb7" font-size="13">gửi đến bạn một chiếc bánh nhỏ dưới ánh trăng đêm nay.</text>
      </svg>`;
    const emailHeroBase64 = (await sharp(Buffer.from(heroSvg)).png().toBuffer()).toString("base64");

    const safeMessageLine = safeMessage || "Một chiếc bánh nhỏ thay lời thương gửi dưới ánh trăng.";
    const detailsSvg = `
      <svg width="620" height="300" viewBox="0 0 620 300" xmlns="http://www.w3.org/2000/svg">
        <style>${fontCss}</style>
        <rect width="620" height="300" fill="#050504"/>
        <text x="310" y="34" text-anchor="middle" fill="#d8ae50" font-size="10" letter-spacing="3">TRONG CHIẾC BÁNH ĐÊM TRĂNG</text>
        <text x="310" y="72" text-anchor="middle" fill="#ddd3c1" font-size="14">${ringListText}</text>
        <line x1="274" y1="112" x2="346" y2="112" stroke="#5c4920" stroke-width="1"/>
        <text x="310" y="154" text-anchor="middle" fill="#efd58f" font-size="22">☾</text>
        <text x="310" y="194" text-anchor="middle" fill="#eee3cb" font-size="17">${safeMessageLine}</text>
        <text x="310" y="236" text-anchor="middle" fill="#8f8067" font-size="10" letter-spacing="2.5">XOAY VÒNG XOAY — TDC</text>
        <text x="310" y="272" text-anchor="middle" fill="#776f62" font-size="11">Trăng tròn một tối · Lời thương còn mãi</text>
      </svg>`;
    const emailDetailsBase64 = (await sharp(Buffer.from(detailsSvg)).png().toBuffer()).toString("base64");

    // Email layout intentionally uses table rows only. No absolute positioning,
    // negative margins or decorative overlay image: Gmail cannot make the cake
    // and text overlap anymore.
    const html = `
      <!doctype html>
      <html lang="vi">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chiếc bánh đêm trăng</title></head>
        <body style="margin:0;padding:0;background:#050504;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#050504;border-collapse:collapse;">
            <tr><td align="center" style="padding:0;">
              <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#050504;border-collapse:collapse;margin:0 auto;">
                <tr><td align="center" style="padding:0;line-height:0;font-size:0;">
                  <img src="cid:email-hero" width="620" alt="XOAY VÒNG XOAY · TRUNG THU — Trăng đã lên, có một chiếc bánh gửi đến bạn." style="display:block;width:100%;max-width:620px;height:auto;border:0;outline:0;">
                </td></tr>
                <tr><td align="center" style="padding:18px 50px 20px;line-height:0;font-size:0;">
                  <img src="cid:cake-preview" width="480" alt="Chiếc bánh Trung Thu được gửi đến bạn" style="display:block;width:100%;max-width:480px;height:auto;margin:0 auto;border:0;outline:0;">
                </td></tr>
                <tr><td align="center" style="padding:0;line-height:0;font-size:0;">
                  <img src="cid:email-details" width="620" alt="${safeMessageLine}" style="display:block;width:100%;max-width:620px;height:auto;border:0;outline:0;">
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
              filename: "banh-trung-thu.mp4",
              content: mp4Base64,
              content_type: "video/mp4",
            },
            {
              filename: "xoay-vong-xoay-email-title.png",
              content: emailHeroBase64,
              content_type: "image/png",
              content_id: "email-hero",
            },
            {
              filename: "banh-trung-thu-preview.png",
              content: cakePreviewBase64,
              content_type: "image/png",
              content_id: "cake-preview",
            },
            {
              filename: "xoay-vong-xoay-email-details.png",
              content: emailDetailsBase64,
              content_type: "image/png",
              content_id: "email-details",
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

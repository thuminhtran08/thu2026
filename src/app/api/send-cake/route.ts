import { NextResponse } from "next/server";
import path from "node:path";
import { access } from "node:fs/promises";
import sharp from "sharp";
// gif-encoder-2 does not ship TypeScript declarations.
// @ts-expect-error -- runtime package is installed in this project.
import GIFEncoder from "gif-encoder-2";

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

const GIF_SIZE = 520;
const GIF_FRAMES = 12;
const GIF_FPS = 60;
const FRAME_DELAY_MS = 1000 / GIF_FPS;

// Match the current page.tsx visual proportions.
const RING_SIZE_PERCENT = [40, 66, 92] as const;

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
        GIF_SIZE * (RING_SIZE_PERCENT[index] / 100),
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
        left: Math.round((GIF_SIZE - ringSize) / 2),
        top: Math.round((GIF_SIZE - ringSize) / 2),
      };
    }),
  );

  return sharp({
    create: {
      width: GIF_SIZE,
      height: GIF_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .raw()
    .ensureAlpha()
    .toBuffer();
}

async function createCakeGif(cake: CakeRing[]) {
  if (cake.length !== 3 || cake.some((ring) => !ring.asset)) {
    throw new Error("Chiếc bánh phải có đủ 3 vòng để tạo GIF.");
  }

  const normalized = cake.map((ring) => ({
    asset: ring.asset as string,
  }));

  for (const ring of normalized) {
    await access(safePublicAssetPath(ring.asset));
  }

  const encoder = new GIFEncoder(
    GIF_SIZE,
    GIF_SIZE,
    "neuquant",
    true,
  );

  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(Math.round(FRAME_DELAY_MS));
  encoder.setQuality(10);
  encoder.setTransparent(0x000000);

  for (let frame = 0; frame < GIF_FRAMES; frame += 1) {
    const rgba = await renderCakeFrame(normalized, frame);
    encoder.addFrame(rgba);
  }

  encoder.finish();

  const buffer = encoder.out.getData() as Buffer;

  if (!buffer?.length) {
    throw new Error("Không tạo được dữ liệu GIF.");
  }

  return buffer;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Server chưa cấu hình RESEND_API_KEY." },
        { status: 500 },
      );
    }

    if (!fromEmail) {
      return NextResponse.json(
        { ok: false, error: "Server chưa cấu hình RESEND_FROM_EMAIL." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as SendCakeBody;

    const email = body.email?.trim() ?? "";
    const message = body.message?.trim() ?? "";
    const senderName = body.senderName?.trim() || "Một người bạn";
    const cake = Array.isArray(body.cake) ? body.cake.slice(0, 3) : [];

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Email người nhận không hợp lệ." },
        { status: 400 },
      );
    }

    if (message.length > 50) {
      return NextResponse.json(
        { ok: false, error: "Lời nhắn tối đa 50 ký tự." },
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

    console.log("[send-cake] Creating 12-frame GIF...", {
      cakeRings: cake.length,
    });

    const gifBuffer = await createCakeGif(cake);
    const gifBase64 = gifBuffer.toString("base64");

    const html = `
      <!DOCTYPE html>
      <html lang="vi">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Bánh Trung Thu</title>
        </head>
        <body style="margin:0;padding:0;background:#070707;font-family:Arial,Helvetica,sans-serif;">
          <div style="width:100%;padding:40px 16px;box-sizing:border-box;">
            <div style="max-width:560px;margin:0 auto;background:#111108;border:1px solid #7b7122;border-radius:20px;padding:30px;box-sizing:border-box;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:.16em;color:#e6d85d;margin-bottom:14px;">
                VÒNG XOAY VÒNG
              </div>

              <h1 style="margin:0 0 18px;font-size:25px;line-height:1.3;color:#ffffff;">
                Bạn nhận được một chiếc bánh Trung Thu 🎑
              </h1>

              <p style="margin:0;font-size:15px;line-height:1.7;color:#e7e7e7;">
                <strong>${safeSender}</strong> vừa gửi một chiếc bánh dành cho bạn.
              </p>

              ${
                safeMessage
                  ? `<div style="margin:22px 0;padding:16px 18px;border-radius:14px;background:#24220c;color:#fff3a0;font-size:15px;line-height:1.6;">“${safeMessage}”</div>`
                  : ""
              }

              <div style="margin:24px auto;text-align:center;">
                <img
                  src="cid:tdc-cake-gif"
                  alt="Chiếc bánh Trung Thu"
                  width="520"
                  style="display:block;width:100%;max-width:520px;height:auto;margin:0 auto;"
                />
              </div>

              ${
                ringNames.length
                  ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#aaaaaa;">Chiếc bánh gồm: ${ringNames.join(" · ")}</p>`
                  : ""
              }

              <div style="height:1px;background:#383515;margin:26px 0 18px;"></div>

              <p style="margin:0;font-size:12px;line-height:1.6;color:#777777;">
                GIF gồm 12 frame, mỗi bước 30°, được gửi từ tính năng “Gửi tới ai đó” của Vòng xoay Vòng – TDC.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log("[send-cake] Sending email", {
      to: email,
      from: fromEmail,
      gifBytes: gifBuffer.length,
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
              filename: "banh-trung-thu.gif",
              content: gifBase64,
              content_type: "image/gif",
              content_id: "tdc-cake-gif",
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
     * Clicking a white dot / blue star opens it again.
     */
    return NextResponse.json({
      ok: true,
      id: resendResult.id,
      message: "Đã gửi bánh thành công.",
      gifDataUrl: `data:image/gif;base64,${gifBase64}`,
    });
  } catch (error) {
    console.error("[send-cake] Unexpected error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      {
        ok: false,
        error: "Không thể tạo hoặc gửi GIF lúc này.",
        detail:
          process.env.NODE_ENV === "development"
            ? errorMessage
            : undefined,
      },
      { status: 500 },
    );
  }
}

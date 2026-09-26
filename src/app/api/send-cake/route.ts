import { NextResponse } from "next/server";



import path from "node:path";



import { access } from "node:fs/promises";



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



async function renderCakePreview(



  cake: Required<Pick<CakeRing, "asset">>[],



) {



  // Email uses one static flattened PNG preview.



  const stepAngle = 0;



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



export async function POST(request: Request) {



  try {



    const apiKey = process.env.RESEND_API_KEY?.trim();



    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();



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



    if (!apiKey) {



      return NextResponse.json({ ok: false, error: "Server chưa cấu hình RESEND_API_KEY." }, { status: 500 });



    }



    if (!fromEmail) {



      return NextResponse.json({ ok: false, error: "Server chưa cấu hình RESEND_FROM_EMAIL." }, { status: 500 });



    }



// Email media: use the real cake generated from the user's 3 selected rings.



    // CID keeps the artwork visible inside Gmail without requiring a public image URL.



    const normalizedCake = cake.map((ring) => ({ asset: ring.asset as string }));



    // Build exactly ONE flattened preview from the three selected rings.



    // Gmail receives only this final PNG, so it cannot stack/re-render individual ring assets.



    const cakePreviewBuffer = await renderCakePreview(normalizedCake);



    const cakePreviewBase64 = cakePreviewBuffer.toString("base64");



// IMPORTANT: Gmail + production Linux/Vercel cannot reliably render a custom



    // OTF embedded inside an SVG rasterized by Sharp/librsvg. Vietnamese glyphs



    // can therefore become □□□ after deployment. Keep email copy as real UTF-8



    // HTML and use a Gmail-safe font stack. The cake artwork remains a CID PNG.



    const safeMessageLine = safeMessage || "Một chiếc bánh nhỏ thay lời thương gửi dưới ánh trăng.";



    const html = `



      <!doctype html>



      <html lang="vi">



        <head>



          <style>



            @font-face {



              font-family: "CDA Independence Text";



              src: url("https://choitrungthu.vn/fonts/CDAIndependenceText-Medium.otf") format("opentype");



              font-style: normal;



              font-weight: 500;



            }



          </style>



          <meta charset="UTF-8">



          <meta name="viewport" content="width=device-width,initial-scale=1">



          <title></title>



        </head>



        <body style="margin:0;padding:0;background:#050504;">



          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#050504;border-collapse:collapse;">



            <tr><td align="center" style="padding:0;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">



              <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#050504;border-collapse:collapse;margin:0 auto;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">



                <tr><td align="center" style="padding:30px 28px 8px;color:#d8ae50;font-size:11px;line-height:1.4;letter-spacing:3px;font-weight:600;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">



                  XOAY VÒNG XOAY · TRUNG THU



                </td></tr>



                <tr><td align="center" style="padding:18px 28px 0;color:#fff8e8;font-size:34px;line-height:1.22;font-weight:500;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">



                  Có người vừa nhờ trăng,<br>gửi chiếc bánh trung thu đến bạn



                </td></tr>



                <tr><td align="center" style="padding:22px 28px 0;color:#f2d184;font-size:15px;line-height:1.5;font-weight:600;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">



                  ${safeSender}



                </td></tr>



                <tr><td align="center" style="padding:5px 34px 20px;color:#d5cbb7;font-size:13px;line-height:1.6;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">



                  đã nghĩ về bạn và Thiết kế chiếc bánh thật giống bạn&#x20;



                </td></tr>



                <tr><td align="center" style="padding:10px 50px 24px;line-height:0;font-size:0;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">



                  <img src="cid:cake-preview" width="480" alt="Chiếc bánh Trung Thu được gửi đến bạn" style="display:block;width:100%;max-width:480px;height:auto;margin:0 auto;border:0;outline:0;">



                </td></tr>



                <tr><td align="center" style="padding:12px 34px 4px;color:#efd58f;font-size:22px;line-height:1;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">☾</td></tr>



                <tr><td align="center" style="padding:12px 40px;color:#eee3cb;font-size:17px;line-height:1.7;font-weight:500;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">



                  ${safeMessageLine}



                </td></tr>



                <tr><td align="center" style="padding:22px 28px 4px;color:#8f8067;font-size:10px;line-height:1.5;letter-spacing:2.5px;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">



                  Chúc bạn một mùa Trung Thu trọn vẹn ý nghĩa



                </td></tr>



                <tr><td align="center" style="padding:4px 28px 30px;color:#776f62;font-size:11px;line-height:1.5;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">



                  Tự tay thiết kế chiếc bánh gửi người thương? Tham gia <a href="https://choitrungthu.vn/" target="_blank" rel="noopener noreferrer" style="color:#efd58f;text-decoration:underline;font-family:'CDA Independence Text','Times New Roman',Georgia,serif;">tại đây</a>



                </td></tr>



              </table>



            </td></tr>



          </table>



        </body>



      </html>`;



    console.log("[send-cake] Sending email", {



      to: email,



      from: fromEmail,



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



return NextResponse.json({



      ok: true,



      id: resendResult.id,



      message: "Đã gửi bánh thành công.",



    });



  } catch (error) {



    console.error("[send-cake] Unexpected error:", error);



    const errorMessage =



      error instanceof Error ? error.message : "Unknown server error";



    return NextResponse.json(



      {



        ok: false,



        error: "Không thể xử lý hoặc gửi bánh lúc này.",



        detail:



          process.env.NODE_ENV === "development"



            ? errorMessage



            : undefined,



      },



      { status: 500 },



    );



  }



}

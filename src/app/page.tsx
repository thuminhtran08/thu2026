"use client";

import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import {
  CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const TOTAL_ORBIT_ITEMS = 10;
const TOTAL_RABBIT_FRAMES = 12;
const RABBIT_FRAME_DURATION = 150; // pose stop-motion; quỹ đạo được CSS chạy mượt 60fps
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Chỉ tài khoản Supabase này được phép xoá bánh.
// RLS trong Supabase vẫn là lớp bảo vệ chính; phần UI này chỉ ẩn/hiện nút quản trị.
const ADMIN_UID = "f1dba6eb-7c74-4f81-9279-2441856c83d1";
const ADMIN_EMAIL = "hongngoc.ng372@gmail.com";

/*
 * Circular rabbit source.
 *
 * 1 ảnh tho.png chứa đúng 12 trạng thái quanh vòng.
 * Không rotate nguyên source để giả chuyển động.
 */
const RABBIT_SOURCE = {
  centerX: 0.5,
  centerY: 0.5,

  /*
   * Khoảng cách từ tâm source
   * tới tâm từng pose.
   */
  radius: 0.355,

  /*
   * Kích thước crop của 1 pose
   * so với toàn source.
   */
  frameSize: 0.255,

  /*
   * Frame đầu ở vị trí 12 giờ.
   */
  startAngle: -90,
};

const WHITE_DOTS = [
  { left: "8%", top: "18%", size: 6 },
  { left: "13%", top: "38%", size: 7 },
  { left: "19%", top: "24%", size: 5 },
  { left: "24%", top: "63%", size: 6 },
  { left: "30%", top: "16%", size: 7 },
  { left: "34%", top: "42%", size: 5 },
  { left: "40%", top: "76%", size: 6 },
  { left: "45%", top: "22%", size: 5 },
  { left: "50%", top: "12%", size: 7 },
  { left: "55%", top: "68%", size: 5 },
  { left: "61%", top: "20%", size: 6 },
  { left: "66%", top: "78%", size: 5 },
  { left: "72%", top: "31%", size: 7 },
  { left: "77%", top: "60%", size: 5 },
  { left: "83%", top: "17%", size: 6 },
  { left: "88%", top: "45%", size: 5 },
  { left: "92%", top: "72%", size: 7 },
  { left: "16%", top: "82%", size: 5 },
  { left: "35%", top: "88%", size: 6 },
  { left: "58%", top: "87%", size: 5 },
  { left: "74%", top: "88%", size: 6 },
];

const BLUE_STARS = [
  { left: "13%", top: "30%", size: 36 },
  { left: "24%", top: "76%", size: 40 },
  { left: "78%", top: "24%", size: 36 },
  { left: "84%", top: "57%", size: 40 },
  { left: "91%", top: "75%", size: 44 },
];

const ORBIT_ITEMS = Array.from(
  { length: TOTAL_ORBIT_ITEMS },
  (_, index) => ({
    index,
    angle: index * (360 / TOTAL_ORBIT_ITEMS),
  }),
);

type ScenePhase =
  | "stars"
  | "growing"
  | "title"
  | "transforming"
  | "rabbits";

type GameScene = "intro" | "leaving" | "orbit";

const ORBIT_PARTICLES = Array.from({ length: 30 }, (_, index) => {
  const zone = (Math.floor(index / 10) + 1) as 1 | 2 | 3;
  const slot = index % 10;
  const isStar = slot === 1 || slot === 6;

  return {
    id: `${isStar ? "blue" : "dot"}-${zone}-${slot}`,
    kind: isStar ? ("star" as const) : ("dot" as const),
    size: isStar ? 42 : slot % 3 === 0 ? 7 : 5,
    zone,
    radius: zone === 1 ? 0.055 : zone === 2 ? 0.335 : 0.465,
    angle: slot * 36 + (zone - 1) * 12,
    duration: zone === 1 ? 12 : zone === 2 ? 15 : 18,
    delay: 0,
  };
});

export default function Home() {
  const [phase, setPhase] =
    useState<ScenePhase>("stars");

  const [rabbitFrame, setRabbitFrame] =
    useState(0);

  const [gameScene, setGameScene] =
    useState<GameScene>("intro");

  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const startOrbitScene = () => {
    if (gameScene !== "intro") return;

    // "Bắt đầu" là một user gesture hợp lệ để unlock audio trên Chrome/Safari.
    const audio = backgroundAudioRef.current;
    if (audio) {
      audio.muted = false;
      audio.volume = 0.55;
      setIsMuted(false);
      void audio.play().catch(() => {});
    }

    setGameScene("leaving");

    window.setTimeout(() => {
      setGameScene("orbit");
    }, 720);
  };

  useEffect(() => {
    const audio = backgroundAudioRef.current;
    if (!audio) return;

    audio.volume = 0.55;
    audio.muted = false;

    const tryPlay = async () => {
      try {
        await audio.play();
      } catch {
        // Chrome/Safari có thể chặn autoplay có tiếng.
        // Khi đó interaction đầu tiên ở bất kỳ đâu sẽ unlock audio.
      }
    };

    void tryPlay();

    const unlockAudio = () => {
      if (!audio.paused) return;
      void audio.play().catch(() => {});
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const toggleSound = () => {
    const audio = backgroundAudioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.muted = false;
      setIsMuted(false);
      void audio.play().catch(() => {});
      return;
    }

    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  /*
   * ========================================================
   * MAIN TIMELINE
   *
   * 0.0s  : moon nhỏ + 10 sao vàng
   * 1.5s  : moon zoom lớn
   * 3.4s  : title xuất hiện
   * 4.3s  : sao bắt đầu bay đi + rabbit xuất hiện
   * 5.0s  : rabbit hoàn toàn visible
   * ========================================================
   */

  useEffect(() => {
    const growTimer = window.setTimeout(() => {
      setPhase("growing");
    }, 1500);

    const titleTimer = window.setTimeout(() => {
      setPhase("title");
    }, 3400);

    const transformTimer = window.setTimeout(() => {
      setPhase("transforming");
    }, 4300);

    const rabbitTimer = window.setTimeout(() => {
      setPhase("rabbits");
    }, 5000);

    return () => {
      window.clearTimeout(growTimer);
      window.clearTimeout(titleTimer);
      window.clearTimeout(transformTimer);
      window.clearTimeout(rabbitTimer);
    };
  }, []);

  /*
   * ========================================================
   * RABBIT STOP-MOTION
   *
   * F01 → F02 → ... → F12 → F01
   *
   * Không tween frame.
   * Không crossfade frame.
   * Không rotate nguyên rabbit.png.
   * ========================================================
   */

  useEffect(() => {
    if (phase !== "transforming" && phase !== "rabbits") {
      setRabbitFrame(0);
      return;
    }

    // Chỉ đổi pose của thỏ. Quỹ đạo chạy liên tục bằng CSS nên không còn giật 30°/bước.
    const poseTimer = window.setInterval(() => {
      setRabbitFrame((current) =>
        (current + 1) % TOTAL_RABBIT_FRAMES,
      );
    }, RABBIT_FRAME_DURATION);

    return () => window.clearInterval(poseTimer);
  }, [phase]);

  /*
   * ========================================================
   * PHASE STATES
   * ========================================================
   */

  const moonIsLarge =
    phase !== "stars";

  const titleVisible =
    phase === "title" ||
    phase === "transforming" ||
    phase === "rabbits";

  const rabbitVisible =
    phase === "transforming" ||
    phase === "rabbits";

  const rabbitTransforming =
    phase === "transforming";

  const rabbitsFullyVisible =
    phase === "rabbits";

  const starsLeaving =
    phase === "transforming";

  const starsHidden =
    phase === "rabbits";

  return (
    <main
      className={[
        "startScene",
        gameScene === "leaving" ? "sceneLeaving" : "",
        gameScene === "orbit" ? "sceneOrbit" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <audio
        ref={backgroundAudioRef}
        src="/audio/thu2026.mp3"
        preload="auto"
        loop
      />

      <button
        type="button"
        className="tdcLogoButton"
        aria-label="Về trang chủ"
        onClick={() => setGameScene("intro")}
      >
        <Image
          src="/images/phenakistoscope/logo.png"
          alt="TDC"
          width={180}
          height={90}
          priority
          unoptimized
        />
      </button>

      <button
        type="button"
        className="soundToggle"
        onClick={toggleSound}
        aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
        title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
      >
        <span className="soundToggleIcon" aria-hidden="true">
          {isMuted ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M11 5L6 9H3V15H6L11 19V5Z" fill="currentColor" />
              <path d="M15 9L21 15M21 9L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M11 5L6 9H3V15H6L11 19V5Z" fill="currentColor" />
              <path d="M15 9C16.2 10.2 16.2 13.8 15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M18 6C21 9 21 15 18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </span>
      </button>

      <style>{`
@font-face {
          font-family: "CDA Independence Text";
          src: url("/fonts/CDAIndependenceText-Medium.otf") format("opentype");
          font-style: normal;
          font-weight: 500;
          font-display: swap;
        }

        /* ABSOLUTE GLOBAL FONT LOCK — every piece of UI text uses the uploaded CDA Medium. */
        html, body, button, input, textarea, select, option, label, h1, h2, h3, h4, h5, h6, p, span, div, a, strong, small {
          font-family: "CDA Independence Text", serif !important;
          font-weight: 500 !important;
          font-style: normal !important;
        }
        input::placeholder, textarea::placeholder {
          font-family: "CDA Independence Text", serif !important;
          font-weight: 500 !important;
        }

        /* GLOBAL TYPOGRAPHY — force the uploaded CDA font on EVERY visible text node. */
        .startScene,
        .startScene *,
        .startScene button,
        .startScene input,
        .startScene textarea,
        .startScene select,
        .startScene option,
        .startScene label,
        .startScene h1,
        .startScene h2,
        .startScene h3,
        .startScene h4,
        .startScene p,
        .startScene span,
        .startScene div {
          font-family: "CDA Independence Text", serif !important;
          font-weight: 500;
        }

        .startScene input::placeholder,
        .startScene textarea::placeholder {
          font-family: "CDA Independence Text", serif !important;
          font-weight: 500;
        }

        .startScene .tdcLogo {
          width: clamp(58px, 4.8vw, 84px);
          height: auto;
        }

        .startScene .moonTitle {
          font-family: "CDA Independence Text", serif;
        }

        .startScene .moonStartLabel {
          font-family: "CDA Independence Text", serif;
        }

        /* INTRO — one complete 12-pose rabbit ring artwork around the moon. */
        .startScene .rabbitRingArtwork {
          position: absolute;
          left: 50%;
          top: 50%;
          width: clamp(390px, 30vw, 500px);
          aspect-ratio: 1 / 1;
          transform: translate(-50%, -50%) rotate(calc(-1 * var(--rabbit-ring-step)));
          transform-origin: 50% 50%;
          pointer-events: none;
          z-index: 2;
          will-change: transform;
        }

        .startScene .rabbitRingArtworkImage {
          object-fit: contain;
          object-position: center;
          user-select: none;
          pointer-events: none;
        }

        @media (max-width: 900px) {
          .startScene .rabbitRingArtwork {
            width: clamp(330px, 64vw, 440px);
          }
        }

        @media (min-width: 641px) and (max-width: 1100px) {
          .sceneOrbit .orbitScene,
          .orbitScene {
            --screen2-orbit-size: min(72vh, 64vw, 680px);
            left: 50vw !important;
            top: 50vh !important;
          }
        }

        @media (max-width: 640px) {
          .startScene .rabbitRingArtwork {
            width: min(88vw, 410px);
          }
        }

        .soundToggleIntroHidden {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        .startScene .moonStartButton {
          position: relative;
          transform-origin: center;
          transition: transform .22s ease, filter .22s ease;
        }

        .startScene .moonStartButton::before {
          content: "";
          position: absolute;
          inset: -7px -10px;
          border: 1px solid rgba(255,255,255,.32);
          border-radius: 999px;
          opacity: 0;
          transform: scale(.88);
          transition: opacity .22s ease, transform .22s ease;
          pointer-events: none;
        }

        .startScene .moonStartButton:hover {
          transform: translateY(-2px) scale(1.04);
          filter: drop-shadow(0 0 8px rgba(255,255,255,.28));
        }

        .startScene .moonStartButton:hover::before,
        .startScene .moonStartButton:focus-visible::before {
          opacity: 1;
          transform: scale(1);
        }

        .startScene .moonStartButton:active {
          transform: translateY(0) scale(.97);
        }

        @media (prefers-reduced-motion: reduce) {
          .startScene .moonStartButton,
          .startScene .moonStartButton::before {
            transition: none;
          }
        }
      `}</style>

      {/* INTRO VIDEO — replaces the old coded moon/rabbit/star intro only. */}
      {gameScene !== "orbit" && (
        <section
          className={`introVideoScene ${gameScene === "leaving" ? "introVideoSceneLeaving" : ""}`}
          aria-label="Mở đầu"
        >
          <video
            className="introVideo"
            autoPlay
            muted
            playsInline
            preload="auto"
          >
            <source
              src="/images/phenakistoscope/thu2026mobile.mp4"
              media="(max-width: 640px)"
              type="video/mp4"
            />
            <source
              src="/images/phenakistoscope/thu2026.mp4"
              type="video/mp4"
            />
          </video>
          <button
            type="button"
            className="introVideoStartButton"

            onClick={startOrbitScene}
            aria-label="Bắt đầu"
          >
            Bắt đầu
          </button>
        </section>
      )}

      <style>{`
        .introVideoScene {
          position: fixed;
          inset: 0;
          z-index: 20;
          overflow: hidden;
          background: #000;
          opacity: 1;
          transition: opacity 680ms cubic-bezier(.22,.61,.36,1), filter 680ms cubic-bezier(.22,.61,.36,1);
        }
        .introVideo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
          background: #000;
          pointer-events: none;
        }
        .introVideoStartButton {
          position: absolute;
          left: 50%;
          top: 56%;
          z-index: 3;
          transform: translate(-50%, 10px);
          padding: 7px 3px 5px;
          border: 0;
          border-bottom: 1px solid rgba(255,255,255,.82);
          background: transparent;
          color: #fff;
          font: 500 clamp(15px, 1vw, 18px)/1.2 "CDA Independence Text", serif;
          letter-spacing: .015em;
          cursor: pointer;
          opacity: 0;
          filter: blur(2px);
          text-shadow: 0 1px 10px rgba(0,0,0,.75);
          animation: introStartReveal 700ms cubic-bezier(.22,.61,.36,1) 2s forwards;
          transition: color 220ms ease, border-color 220ms ease, text-shadow 220ms ease;
        }
        .introVideoStartButton:hover,
        .introVideoStartButton:focus-visible {
          color: #fff8d5;
          border-color: #fff8d5;
          outline: none;
        }
        .introVideoSceneLeaving {
          opacity: 0;
          filter: blur(2px);
          pointer-events: none;
        }
        @keyframes introStartReveal {
          from { opacity: 0; transform: translate(-50%, 10px); filter: blur(2px); }
          to { opacity: 1; transform: translate(-50%, 0); filter: blur(0); }
        }
        @media (max-width: 640px) {
          .introVideoStartButton { top: 65%; font-size: 13px; }
        }
      `}</style>

      {gameScene !== "intro" && (
        <OrbitScene
          active={gameScene === "orbit"}
          onReturnHome={() => {
            // Home dùng state `phase`, không có setIntroPhase/setZooming/...
            // Chỉ đưa scene về intro; Home gốc sẽ hiện lại ngay.
            setGameScene("intro");
          }}
        />
      )}
    </main>
  );
}

type QuizOption = {
  label: string;
  asset: string;
};

type FillingTeam = "chay" | "man" | "deo";

type SavedCake = {
  id: string;
  name: string;
  rings: [QuizOption, QuizOption, QuizOption];
  createdAt: string;
};

const FILLING_TEAMS: { key: FillingTeam; label: string }[] = [
  { key: "chay", label: "Nhân chay" },
  { key: "man", label: "Nhân mặn" },
  { key: "deo", label: "Không nhân / bánh dẻo" },
];

const FILLING_OPTIONS: Record<FillingTeam, QuizOption[]> = {
  chay: [
    { label: "Đậu xanh", asset: "/images/phenakistoscope/dauxanh.png" },
    { label: "Hạt sen", asset: "/images/phenakistoscope/hatsen.png" },
    { label: "Cốm", asset: "/images/phenakistoscope/com.png" },
    { label: "Đậu đỏ", asset: "/images/phenakistoscope/daudo.png" },
    { label: "Mè đen", asset: "/images/phenakistoscope/meden.png" },
    { label: "Hạt bí", asset: "/images/phenakistoscope/hatbi.png" },
    { label: "Trà xanh", asset: "/images/phenakistoscope/traxanh.png" },
    { label: "Khoai môn", asset: "/images/phenakistoscope/khoaimon.png" },
  ],
  man: [
    { label: "Thịt heo", asset: "/images/phenakistoscope/thitheo.png" },
    { label: "Jambon", asset: "/images/phenakistoscope/zambong.png" },
    { label: "Gà quay", asset: "/images/phenakistoscope/thitga.png" },
    { label: "Vi cá", asset: "/images/phenakistoscope/vica.png" },
    { label: "Lạp xưởng", asset: "/images/phenakistoscope/lapxuong.png" },
  ],
  deo: [
    { label: "Vuông", asset: "/images/phenakistoscope/vuongbanhdeo.png" },
    { label: "Tam giác", asset: "/images/phenakistoscope/tamgiacbanhdeo.png" },
    { label: "Hoa", asset: "/images/phenakistoscope/hoabanhdeo.png" },
    { label: "Bo tròn", asset: "/images/phenakistoscope/botronbanhdeo.png" },
  ],
};

type FillingCategory = "thuong" | "di";


const FILLING_CATEGORIES: { key: FillingCategory; label: string }[] = [
  { key: "thuong", label: "Nhân thường" },
  { key: "di", label: "Nhân dị" },
];

const REGULAR_FILLINGS: QuizOption[] = [
  { label: "Thịt bò", asset: "/images/phenakistoscope/conbo.png" },
  { label: "Nấm", asset: "/images/phenakistoscope/nam.png" },
  { label: "Kem bơ", asset: "/images/phenakistoscope/kembo.png" },
  { label: "Cá hồi", asset: "/images/phenakistoscope/cahoi.png" },
  { label: "Xíu mại", asset: "/images/phenakistoscope/xiumai.png" },
  { label: "Đậu hũ", asset: "/images/phenakistoscope/dauhu.png" },
  { label: "Bắp", asset: "/images/phenakistoscope/bap.png" },
  { label: "Tôm khô", asset: "/images/phenakistoscope/tomkho.png" },
  { label: "Củ kiệu", asset: "/images/phenakistoscope/cukieu.png" },
  { label: "Cà chua", asset: "/images/phenakistoscope/cachua.png" },
  { label: "Thịt kho hột vịt", asset: "/images/phenakistoscope/thitkhohotvit.png" },
  { label: "Sầu riêng", asset: "/images/phenakistoscope/saurieng.png" },
  { label: "Phô mai mật ong", asset: "/images/phenakistoscope/phomaimatong.png" },
  { label: "Lạp xưởng nướng đá", asset: "/images/phenakistoscope/lapxuongnuongda.png" },
  { label: "Cacao", asset: "/images/phenakistoscope/cacao.png" },
  { label: "Thanh cua", asset: "/images/phenakistoscope/thanhcua.png" },
  { label: "Rau trộn", asset: "/images/phenakistoscope/rautron.png" },
];

const WEIRD_FILLINGS: QuizOption[] = [
  { label: "Hành lá", asset: "/images/phenakistoscope/hanhla.png" },
  { label: "Bánh tráng", asset: "/images/phenakistoscope/banhtrang.png" },
  { label: "Cá nóc", asset: "/images/phenakistoscope/canoc.png" },
  { label: "Coca", asset: "/images/phenakistoscope/coca.png" },
  { label: "Củ cải ngâm", asset: "/images/phenakistoscope/cucaingam.png" },
  { label: "Hột vịt lộn", asset: "/images/phenakistoscope/hotvitlon.png" },
  { label: "Thịt kangaroo", asset: "/images/phenakistoscope/kanggoru.png" },
  { label: "Khoai tây chiên", asset: "/images/phenakistoscope/khoataychien.png" },
  { label: "Khổ qua", asset: "/images/phenakistoscope/khoqua.png" },
  { label: "Kimchi", asset: "/images/phenakistoscope/kimchi.png" },
  { label: "Mắm tôm", asset: "/images/phenakistoscope/mamtom.png" },
  { label: "Marshmallow", asset: "/images/phenakistoscope/masmalow.png" },
  { label: "Mực", asset: "/images/phenakistoscope/muc.png" },
  { label: "Ớt", asset: "/images/phenakistoscope/ot.png" },
  { label: "Sting", asset: "/images/phenakistoscope/sting.png" },
  { label: "Wasabi", asset: "/images/phenakistoscope/wasabi.png" },
];

const Q2_FILLINGS: Record<FillingCategory, QuizOption[]> = {
  thuong: REGULAR_FILLINGS,
  di: WEIRD_FILLINGS,
};

const ZODIAC_OPTIONS: QuizOption[] = [
  { label: "Tý", asset: "/images/phenakistoscope/tý.png?v=2" },
  { label: "Sửu", asset: "/images/phenakistoscope/suu.png" },
  { label: "Dần", asset: "/images/phenakistoscope/dan.png" },
  { label: "Mão", asset: "/images/phenakistoscope/mão.png" },
  { label: "Thìn", asset: "/images/phenakistoscope/thin.png?v=2" },
  { label: "Tỵ", asset: "/images/phenakistoscope/tị.png?v=2" },
  { label: "Ngọ", asset: "/images/phenakistoscope/ngo.png" },
  { label: "Mùi", asset: "/images/phenakistoscope/mui.png" },
  { label: "Thân", asset: "/images/phenakistoscope/than.png" },
  { label: "Dậu", asset: "/images/phenakistoscope/dậu.png?v=2" },
  { label: "Tuất", asset: "/images/phenakistoscope/tuat.png" },
  { label: "Hợi", asset: "/images/phenakistoscope/heo.png" },
];

function OrbitScene({
  active,
  onReturnHome,
}: {
  active: boolean;
  onReturnHome: () => void;
}) {
  const [quizOpen, setQuizOpen] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<1 | 2 | 3 | null>(1);
  const [team, setTeam] = useState<FillingTeam | null>(null);
  const [ring1, setRing1] = useState<QuizOption | null>(null);
  const [ring2, setRing2] = useState<QuizOption | null>(null);
  const [fillingCategory, setFillingCategory] = useState<FillingCategory | null>(null);
  const [ring3, setRing3] = useState<QuizOption | null>(null);
  const [finalOpen, setFinalOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [view, setView] = useState<"decorate" | "gallery">("decorate");
  const [gallery, setGallery] = useState<SavedCake[]>([]);
  const [notice, setNotice] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [deletingCakeId, setDeletingCakeId] = useState<string | null>(null);

  const isAdmin =
    authUserId === ADMIN_UID && authEmail?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const user = data.session?.user ?? null;
      setAuthUserId(user?.id ?? null);
      setAuthEmail(user?.email ?? null);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setAuthUserId(user?.id ?? null);
      setAuthEmail(user?.email ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInAdminWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error("[Supabase] Không thể đăng nhập Google:", error);
      setNotice("Không thể đăng nhập tài khoản quản lý lúc này.");
    }
  };

  const signOutAdmin = async () => {
    await supabase.auth.signOut();
    setAuthUserId(null);
    setAuthEmail(null);
  };

  const deleteCake = async (cake: SavedCake) => {
    if (!isAdmin || deletingCakeId) return;

    const confirmed = window.confirm(`Xóa bánh của ${cake.name} khỏi Tiệm bánh?`);
    if (!confirmed) return;

    setDeletingCakeId(cake.id);
    const { error } = await supabase.from("cakes").delete().eq("id", cake.id);
    setDeletingCakeId(null);

    if (error) {
      console.error("[Supabase] Không xóa được bánh:", error);
      setNotice("Không thể xóa bánh. Hãy kiểm tra tài khoản quản lý.");
      return;
    }

    setGallery((current) => current.filter((item) => item.id !== cake.id));
    setNotice("Đã xóa chiếc bánh khỏi Tiệm bánh.");
  };

  // Warm the browser cache before the user chooses an answer.
  // This removes the visible 1–2s wait that can happen on production/domain
  // when the selected PNG is requested for the first time.
  useEffect(() => {
    const assets = Array.from(
      new Set([
        ...Object.values(FILLING_OPTIONS).flat().map((item) => item.asset),
        ...REGULAR_FILLINGS.map((item) => item.asset),
        ...WEIRD_FILLINGS.map((item) => item.asset),
        ...ZODIAC_OPTIONS.map((item) => item.asset),
      ]),
    );

    let cancelled = false;
    const warm = async () => {
      // Small batches avoid decoding dozens of large transparent PNGs at once.
      const batchSize = 8;
      for (let i = 0; i < assets.length && !cancelled; i += batchSize) {
        const batch = assets.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(
            (src) =>
              new Promise<void>((resolve) => {
                const img = new window.Image();
                img.decoding = "async";
                img.onload = () => {
                  // decode() makes the first visible paint much faster when supported.
                  if (typeof img.decode === "function") {
                    void img.decode().catch(() => {}).finally(resolve);
                  } else {
                    resolve();
                  }
                };
                img.onerror = () => resolve();
                img.src = src;
              }),
          ),
        );
      }
    };

    // Start after the orbit UI has painted so preloading never delays interaction.
    const timer = window.setTimeout(() => void warm(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);


  // SEND CAKE
  const [sendOpen, setSendOpen] = useState(false);
  const [selectedCake, setSelectedCake] = useState<SavedCake | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // AFTER SEND: keep the exact 3 cake rings for a smooth browser animation.
  // The GIF is still generated/sent by the API for email, but the website
  // does not replay that low-frame-rate GIF.
  const [sentCakeRings, setSentCakeRings] = useState<SavedCake["rings"] | null>(null);
  const [sentCakeOpen, setSentCakeOpen] = useState(false);
  const [sentSkyOpen, setSentSkyOpen] = useState(false);
  const [sentCakeFrame, setSentCakeFrame] = useState(0);

  // 12 discrete phenakistoscope steps. The artwork stays complete;
  // only the phase changes by 30 degrees per step.
  useEffect(() => {
    if (!sentCakeOpen) {
      setSentCakeFrame(0);
      return;
    }

    const timer = window.setInterval(() => {
      setSentCakeFrame((current) => (current + 1) % TOTAL_RABBIT_FRAMES);
    }, RABBIT_FRAME_DURATION);

    return () => window.clearInterval(timer);
  }, [sentCakeOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadGallery = async () => {
      const { data, error } = await supabase
        .from("cakes")
        .select("id, name, rings, created_at")
        .order("created_at", { ascending: false })
        .limit(60);

      if (cancelled) return;

      if (error) {
        console.error("[Supabase] Không tải được kệ bánh:", error);
        setGallery([]);
        return;
      }

      setGallery(
        (data ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.name),
          rings: row.rings as SavedCake["rings"],
          createdAt: String(row.created_at),
        })),
      );
    };

    void loadGallery();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (active) setWelcomeOpen(true);
  }, [active]);

  const complete = Boolean(ring1 && ring2 && ring3);
  const decorating = team !== null || ring1 !== null || ring2 !== null || ring3 !== null;
  const rings = [ring1, ring2, ring3];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA") return;
      if (finalOpen && complete && displayName.trim()) {
        event.preventDefault();
        document.getElementById("save-cake-button")?.click();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finalOpen, complete, displayName]);

  const saveCake = async () => {
    if (!ring1 || !ring2 || !ring3) return;

    const name = displayName.trim();
    if (!name) {
      setNotice("Vui lòng nhập tên trước khi cho bánh lên kệ.");
      return;
    }

    const selectedRings: SavedCake["rings"] = [ring1, ring2, ring3];
    setNotice("Đang đưa chiếc bánh lên kệ...");

    const { data, error } = await supabase
      .from("cakes")
      .insert({
        name,
        rings: selectedRings,
      })
      .select("id, name, rings, created_at")
      .single();

    if (error) {
      console.error("[Supabase] Không lưu được bánh:", error);
      setNotice("Không thể lưu bánh lên kệ lúc này. Vui lòng thử lại.");
      return;
    }

    const cake: SavedCake = {
      id: String(data.id),
      name: String(data.name),
      rings: data.rings as SavedCake["rings"],
      createdAt: String(data.created_at),
    };

    setGallery((current) => [cake, ...current.filter((item) => item.id !== cake.id)].slice(0, 60));
    setFinalOpen(false);
    setQuizOpen(false);
    setView("gallery");
    setNotice("🌕 Chiếc bánh đã được cất vào kệ bánh đêm trăng");
  };

  const openSendCake = (cake: SavedCake) => {
    setSelectedCake(cake);
    setRecipientEmail("");
    setSendMessage("");
    setSendError("");
    setSendOpen(true);
  };

  const openSendCurrentCake = () => {
    if (!ring1 || !ring2 || !ring3) {
      setNotice("Hoàn thiện chiếc bánh mùa trăng, hoặc ghé **Kệ bánh** chọn một chiếc thật ưng ý để gửi trao. 🌕");
      return;
    }

    openSendCake({
      id: "current-cake",
      name: displayName.trim() || "Một người bạn",
      rings: [ring1, ring2, ring3],
      createdAt: new Date().toISOString(),
    });
  };

  const closeSendCake = () => {
    if (sending) return;
    setSendOpen(false);
    setSelectedCake(null);
    setSendError("");
  };

  const downloadCakeImage = async () => {
    if (!ring1 || !ring2 || !ring3) {
      setNotice("Hoàn thiện đủ 3 vòng bánh trước khi tải xuống.");
      return;
    }

    setNotice("Đang tạo ảnh chiếc bánh...");

    try {
      const canvas = document.createElement("canvas");
      const size = 1600;
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Trình duyệt không hỗ trợ tạo ảnh.");

      ctx.clearRect(0, 0, size, size);

      const ringSizes = [0.22, 0.58, 0.86];
      const selectedRings = [ring1, ring2, ring3];

      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new window.Image();
          img.decoding = "async";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Không tải được ảnh: ${src}`));
          img.src = src;
        });

      const images = await Promise.all(
        selectedRings.map((ring) => loadImage(ring.asset)),
      );

      images.forEach((img, index) => {
        const drawSize = Math.round(size * ringSizes[index]);
        const x = Math.round((size - drawSize) / 2);
        const y = Math.round((size - drawSize) / 2);
        ctx.drawImage(img, x, y, drawSize, drawSize);
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error("Không thể xuất ảnh PNG.")),
          "image/png",
        );
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `banh-trung-thu-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setNotice("Đã tải ảnh chiếc bánh.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể tải ảnh lúc này.");
    }
  };

  const sendCake = async () => {
    if (!selectedCake || sending) return;

    const email = recipientEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSendError("Vui lòng nhập đúng email người nhận.");
      return;
    }

    setSending(true);
    setSendError("");

    try {
      const response = await fetch("/api/send-cake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          message: sendMessage.trim().slice(0, 300),
          senderName: selectedCake.name,
          cake: selectedCake.rings.map((ring) => ({
            label: ring.label,
            asset: ring.asset,
          })),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        error?: string;
        mp4DataUrl?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Không thể gửi bánh lúc này.");
      }

      // Keep the exact cake that was just sent BEFORE clearing selectedCake.
      // On the website we render these 3 PNG layers directly so motion is smooth.
      setSentCakeRings(selectedCake.rings);
      setSentCakeOpen(false);
      setSentSkyOpen(true);

      setSendOpen(false);
      setSelectedCake(null);
      setRecipientEmail("");
      setSendMessage("");

      // Reset the decoration state behind the dedicated post-send sky.
      setView("decorate");
      setQuizOpen(false);
      setTeam(null);
      setRing1(null);
      setRing2(null);
      setFillingCategory(null);
      setRing3(null);
      setFinalOpen(false);
      setDisplayName("");
      setNotice("");
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : "Không thể gửi bánh lúc này.",
      );
    } finally {
      setSending(false);
    }
  };

  const chooseTeam = (nextTeam: FillingTeam) => {
    // Mỗi câu hỏi điều khiển đúng 1 vòng độc lập.
    // Đổi team ở Câu 1 chỉ reset lựa chọn của vòng 1;
    // tuyệt đối không xoá Câu 2 / Câu 3 đã chọn trước đó.
    setTeam(nextTeam);
    setRing1(null);
  };

  const resetDecoration = () => {
    setTeam(null);
    setRing1(null);
    setRing2(null);
    setFillingCategory(null);
    setRing3(null);
    setFinalOpen(false);
    setDisplayName("");
  };

  return (
    <>
      <style>{`
        /* SCREEN 2 — REFERENCE LAYOUT
           One square stage, centered in the left visual workspace.
           This intentionally overrides old globals.css offsets. */
        .sceneOrbit .orbitScene,
        .orbitScene {
          --screen2-orbit-size: min(82vh, 58vw, 820px);
          position: fixed !important;
          left: 50vw !important;
          top: 50vh !important;
          right: auto !important;
          bottom: auto !important;
          width: var(--screen2-orbit-size) !important;
          height: var(--screen2-orbit-size) !important;
          aspect-ratio: 1 / 1 !important;
          margin: 0 !important;
          padding: 0 !important;
          translate: none !important;
          transform: translate(-50%, -50%) !important;
          transform-origin: 50% 50% !important;
          overflow: visible !important;
        }

        /* All selected PNG rings use the exact same local coordinate system. */
        .orbitScene > .selectedPhenakistoscopeRings {
          display: block !important;
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          translate: none !important;
          transform: none !important;
          transform-origin: 50% 50% !important;
          overflow: visible !important;
          pointer-events: none !important;
        }

        .orbitScene > .selectedPhenakistoscopeRings > .selectedRing {
          position: absolute !important;
          left: 50% !important;
          top: 50% !important;
          right: auto !important;
          bottom: auto !important;
          width: var(--selected-ring-size) !important;
          height: var(--selected-ring-size) !important;
          aspect-ratio: 1 / 1 !important;
          margin: 0 !important;
          padding: 0 !important;
          translate: none !important;
          transform: translate(-50%, -50%) !important;
          transform-origin: 50% 50% !important;
          overflow: visible !important;
          animation: none !important;
        }

        /* Two-layer motion: a smooth orbital drift + a 12-pose strobe.
           This keeps the complete artwork intact (no broken crop fragments),
           while preventing the 12 poses from looking locked to one treadmill spot. */
        .orbitScene .selectedRingMotion {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          transform-origin: 50% 50% !important;
          animation: screen2OrbitDriftCCW var(--selected-ring-lap) linear infinite !important;
          will-change: transform;
        }

        .orbitScene > .selectedPhenakistoscopeRings > .selectedRing .selectedRingArtwork {
          position: absolute !important;
          inset: 0 !important;
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          max-height: none !important;
          margin: 0 !important;
          object-fit: contain !important;
          object-position: 50% 50% !important;
          transform-origin: 50% 50% !important;
          animation: screen2PoseCycleCCW var(--selected-ring-pose) steps(12, end) infinite !important;
          will-change: transform;
        }

        /* RING 3 ONLY — lock the parent geometry; keep the existing 12-step artwork animation. */
        .orbitScene > .selectedPhenakistoscopeRings > .selectedRing3 > .selectedRingMotion {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          aspect-ratio: 1 / 1 !important;
          translate: none !important;
          scale: none !important;
          transform: none !important;
          transform-origin: 50% 50% !important;
          animation: none !important;
        }

        @keyframes screen2PoseCycleCCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }

        @keyframes screen2OrbitDriftCCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }

        /* White dots / blue stars must share the same stage as the selected rings. */
        .orbitScene > .orbitParticleField {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          translate: none !important;
          transform: none !important;
          transform-origin: 50% 50% !important;
        }

        /* WAITING RING STAR — each unanswered question keeps one blue star
           travelling on that exact ring. Once the ring is selected, its star disappears. */
        .waitingRingStars {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          pointer-events: none !important;
          z-index: 6;
        }

        .waitingRingStarTrack {
          /* Ring 1 waiting star stays INSIDE the smallest center ring.
             Ring 1 diameter is 18% of the stage, so its edge is at 9%;
             use 4.5% to keep the guide star clearly inside that ring. */
          --waiting-radius: 4.5%;
          position: absolute;
          left: 50%;
          top: 50%;
          width: 0;
          height: 0;
          transform-origin: 0 0;
          animation: waitingRingStarCCW 4.8s linear infinite;
          will-change: transform;
        }

        .waitingRingStarTrack.ring2 { --waiting-radius: 31%; animation-duration: 5.4s; }
        .waitingRingStarTrack.ring3 { --waiting-radius: 50%; animation-duration: 6s; }

        .waitingRingStar {
          position: absolute !important;
          left: 0;
          top: 0;
          width: 34px !important;
          height: 34px !important;
          object-fit: contain;
          transform: translate(calc(var(--screen2-orbit-size) * var(--waiting-radius)), -50%);
          filter: drop-shadow(0 0 7px rgba(42, 169, 255, .95));
          animation: waitingRingStarPulse 1.25s ease-in-out infinite alternate;
        }

        @keyframes waitingRingStarCCW {
          from { rotate: 0deg; }
          to { rotate: -360deg; }
        }

        @keyframes waitingRingStarPulse {
          from { opacity: .72; scale: .82; }
          to { opacity: 1; scale: 1.12; }
        }

        .orbitBoundary {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          border: 0 !important;
        }

        /* Keep the three selected Phenakistoscope rings inside the new compact scene. */
        .selectedPhenakistoscopeRings {
          width: 100% !important;
          height: 100% !important;
        }

        .screen2WelcomeOverlay {
          position: fixed;
          inset: 0;
          z-index: 70;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(0, 0, 0, .08);
        }

        .screen2WelcomeModal {
          position: relative;
          width: min(538px, calc(100vw - 36px));
          min-height: 282px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 36px 38px;
          border: 1px solid rgba(143, 145, 16, .7);
          border-radius: 18px;
          background:
            linear-gradient(180deg,
              rgba(78, 80, 0, .66) 0%,
              rgba(4, 4, 0, .96) 18%,
              rgba(0, 0, 0, .98) 73%,
              rgba(94, 94, 14, .72) 100%);
          box-shadow:
            0 0 34px rgba(115, 118, 13, .28),
            inset 0 0 28px rgba(154, 156, 24, .18);
          color: #fff;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .screen2WelcomeClose {
          position: absolute;
          top: 12px;
          right: 17px;
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: #fff;
          font: 500 29px/1 "CDA Independence Text", serif;
          cursor: pointer;
        }

        .screen2WelcomeText {
          margin: 0;
          max-width: 470px;
          color: rgba(255,255,255,.94);
          font-size: 13px;
          line-height: 1.38;
          text-align: center;
          letter-spacing: .005em;
        }

        @media (max-width: 640px) {
          .sceneOrbit .orbitScene,
          .orbitScene {
            --screen2-orbit-size: min(90vw, 56vh, 500px);
            left: 50vw !important;
            top: 46vh !important;
            width: var(--screen2-orbit-size) !important;
            height: var(--screen2-orbit-size) !important;
          }

          .screen2WelcomeModal {
            min-height: 0;
            padding: 48px 24px 34px;
            border-radius: 16px;
          }

          .screen2WelcomeText {
            font-size: 12px;
            line-height: 1.45;
          }
        }

        /* FINAL AFTER-SEND SCREEN:
           only "Trang trí bánh mới" is interactive/visible.
           Hide the normal top navigation and bottom cake actions while this overlay exists. */
        body:has(.sentGiftEndingOnlyNewCake) .orbitTopNav,
        body:has(.sentGiftEndingOnlyNewCake) .orbitNav,
        body:has(.sentGiftEndingOnlyNewCake) .screen2Nav,
        body:has(.sentGiftEndingOnlyNewCake) .topNavigation,
        body:has(.sentGiftEndingOnlyNewCake) .bottomActions,
        body:has(.sentGiftEndingOnlyNewCake) .orbitBottomActions,
        body:has(.sentGiftEndingOnlyNewCake) .cakeActions,
        body:has(.sentGiftEndingOnlyNewCake) .actionBar {
          display: none !important;
        }

        .sentGiftEndingOnlyNewCake .sentGiftNewCakeButton {
          display: inline-flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>

      {welcomeOpen && active && (
        <div
          className="screen2WelcomeOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Giới thiệu"
        >
          <div className="screen2WelcomeModal">
            <button
              type="button"
              className="screen2WelcomeClose"
              aria-label="Đóng"
              onClick={() => setWelcomeOpen(false)}
            >
              ×
            </button>

            <p className="screen2WelcomeText">
              Ngày nhỏ, cứ rằm tháng Tám là đám trẻ trong xóm lại xúm xít rước đèn, ăn bánh Trung thu. Giờ đây, cuộc sống quá xô bồ làm những kết nối tâm giao cũng thưa dần. Hình ảnh chiếc bánh đã không còn mang ý nghĩa dung dị như trước mà trở thành món quà xã giao. Nhưng tặng bánh đâu cần chi cầu kỳ? Dù là người thân, bạn bè hay ai đó ta chợt nhớ tới, chỉ cần còn hướng về nhau là đã có thể gửi trao thức quà này.
              <br /><br />
              Tinh thần ấy là lý do để “Xoay Vòng Xoay” ra đời. TDC mong muốn tạo nên không gian giúp bạn kết nối lại những người thương yêu theo cách giản dị mà vẫn trọn tâm tình.
              <br /><br />
              Trò chơi lấy cảm hứng từ đường nét họa tiết trên mặt bánh truyền thống. Đội ngũ sản xuất biến tấu những hoa văn quen thuộc trở nên sinh động, chuyển động vui tươi và dí dỏm, tạo ra thành phẩm vừa mang diện mạo mới mẻ, vừa giữ trọn hồn cốt thân thuộc.
              <br /><br />
              Nào, hãy bắt tay vào làm thôi 👨‍🍳🍽️
            </p>
          </div>
        </div>
      )}

      <section
        className={["orbitScene", active ? "orbitSceneActive" : "", decorating ? "orbitSceneDecorating" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label="Bầu trời quỹ đạo"
      >
        <div className="orbitBoundary" aria-hidden="true" />

        <div
          data-ring-1={ring1 ? "selected" : "waiting"}
          data-ring-2={ring2 ? "selected" : "waiting"}
          data-ring-3={ring3 ? "selected" : "waiting"}
          className="orbitParticleField"
          aria-hidden="true"
        >
            {ORBIT_PARTICLES.map((particle, index) => {
              const particleZone = particle.zone;
              const zoneHidden =
                (particleZone === 1 && !!ring1) ||
                (particleZone === 2 && !!ring2) ||
                (particleZone === 3 && !!ring3);
              const style = {
                "--particle-radius": particle.radius,
                "--particle-angle": `${particle.angle}deg`,
                "--particle-duration": `${particle.duration}s`,
                "--particle-delay": `${particle.delay}s`,
                "--particle-size": `${particle.size}px`,
                "--particle-index": index,
                "--particle-zone": particleZone,
              } as CSSProperties;

              return (
                <button
                  key={particle.id}
                  type="button"
                  className={`orbitParticleTrack orbitParticleZone${particleZone} ${zoneHidden ? "orbitParticleHidden" : ""} ${sentCakeRings ? "orbitParticleTrackClickable" : ""}`}
                  style={style}
                  aria-label={sentCakeRings ? "Mở chiếc bánh" : undefined}
                  onClick={() => {
                    if (sentCakeRings) setSentCakeOpen(true);
                  }}
                  disabled={!sentCakeRings}
                >
                  {particle.kind === "star" ? (
                    <Image
                      src="/images/phenakistoscope/starxanh.png"
                      alt=""
                      width={100}
                      height={100}
                      className="orbitParticleStar"
                    />
                  ) : (
                    <span className="orbitParticleDot" />
                  )}
                </button>
              );
            })}
          </div>

        {/* One blue guide star remains on every unanswered ring.
            Example: if Q2 + Q3 are selected but Q1 is not, ONLY ring 1 keeps its star. */}
        <div className="waitingRingStars" aria-hidden="true">
          {rings.map((answer, index) =>
            !answer ? (
              <div
                key={`waiting-star-${index}`}
                className={`waitingRingStarTrack ring${index + 1}`}
              >
                <Image
                  src="/images/phenakistoscope/starxanh.png"
                  alt=""
                  width={100}
                  height={100}
                  className="waitingRingStar"
                  unoptimized
                />
              </div>
            ) : null,
          )}
        </div>

        <div className={`selectedPhenakistoscopeRings ${complete ? "selectedPhenakistoscopeRingsComplete" : ""}`} aria-live="polite">
          {rings.map((answer, index) =>
            answer ? (
              <PhenakistoscopeRing
                key={`${index}-${answer.asset}`}
                src={answer.asset}
                ring={index}
              />
            ) : null,
          )}
        </div>
      </section>

      {sentSkyOpen && sentCakeRings && (
        <section className="sentGiftEnding sentGiftEndingOnlyNewCake" aria-label="Cảm ơn bạn">
          <button
            type="button"
            className="sentGiftNewCakeButton"
            onClick={() => {
              resetDecoration();
              setSentSkyOpen(false);
              setSentCakeOpen(false);
              setSentCakeRings(null);
              setSendOpen(false);
              setSelectedCake(null);
              setWelcomeOpen(false);
              setView("decorate");
              setQuizOpen(true);
              setOpenQuestion(1);
              setNotice("");
            }}
          >
            Trang trí bánh mới
          </button>

          <div className="sentGiftDeepGlow" aria-hidden="true" />

          {/* PHASE 1: bầu trời luôn sống — chấm trắng + star vàng + star xanh. */}
          <div className="sentGiftSky" aria-hidden="true">
            {Array.from({ length: 150 }, (_, index) => {
              const kind = index % 9 === 0 ? "blue" : index % 6 === 0 ? "gold" : "white";
              const x = 1 + ((index * 47 + 13) % 98);
              const y = 2 + ((index * 73 + 7) % 94);
              const size = kind === "white" ? 2 + (index % 4) : 9 + (index % 10);
              const style = {
                "--sky-x": `${x}vw`,
                "--sky-y": `${y}vh`,
                "--sky-size": `${size}px`,
                "--sky-delay": `${-((index * 0.17) % 3.2)}s`,
                "--sky-duration": `${1.35 + (index % 9) * 0.19}s`,
                "--sky-drift-x": `${((index % 7) - 3) * 5}px`,
                "--sky-drift-y": `${((index % 5) - 2) * 4}px`,
              } as CSSProperties;

              return kind === "white" ? (
                <span key={`sky-${index}`} className="sentSkyDot" style={style} />
              ) : (
                <Image
                  key={`sky-${index}`}
                  className={`sentSkyAsset sentSkyAsset-${kind}`}
                  src={`/images/phenakistoscope/${kind === "blue" ? "starxanh" : "starvang"}.png`}
                  alt=""
                  width={40}
                  height={40}
                  style={style}
                />
              );
            })}
          </div>

          {/* Thông báo chuyến bay xuất hiện trước, sau đó fade đi. */}
          <div className="sentGiftFlightCopy">
            <strong>Bánh đã rời tiệm</strong>
            <span>Chiếc bánh đã lên chuyến bay TDC theo trăng tìm đến người bạn của bạn🤍</span>
          </div>



          <style>{`
            .sentGiftEnding {
              position: fixed;
              inset: 0;
              z-index: 80;
              overflow: hidden;
              background: #000;
              isolation: isolate;
            }

            .sentGiftNewCakeButton {
              position: absolute;
              top: 34px;
              right: 42px;
              z-index: 12;
              min-width: 168px;
              height: 48px;
              padding: 0 24px;
              border: 1px solid rgba(238, 218, 99, .72);
              border-radius: 999px;
              background: linear-gradient(180deg, rgba(44,44,38,.88), rgba(7,7,7,.96));
              color: #fff;
              font-family: "CDA Independence Text", serif !important;
              font-size: 16px;
              font-weight: 500;
              cursor: pointer;
              box-shadow: 0 0 18px rgba(229, 211, 87, .14), inset 0 0 14px rgba(255,255,255,.04);
              transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease, background .2s ease;
            }

            .sentGiftNewCakeButton:hover,
            .sentGiftNewCakeButton:focus-visible {
              outline: none;
              transform: translateY(-2px);
              border-color: rgba(255, 238, 126, 1);
              background: linear-gradient(180deg, rgba(98,91,34,.92), rgba(17,17,8,.98));
              box-shadow: 0 0 26px rgba(239, 220, 91, .30), inset 0 0 16px rgba(255,248,190,.08);
            }

            .sentGiftDeepGlow {
              position: absolute;
              left: 50%;
              top: 52%;
              width: 76vw;
              height: 58vh;
              transform: translate(-50%, -50%);
              border-radius: 50%;
              background: radial-gradient(ellipse, rgba(0,72,92,.16), rgba(0,34,55,.055) 45%, transparent 72%);
              filter: blur(48px);
              pointer-events: none;
            }

            .sentGiftSky {
              position: absolute;
              inset: -5%;
              transform-origin: 50% 50%;
              animation: sentSkyBreath 6.5s ease-in-out infinite alternate;
            }

            .sentSkyDot,
            .sentSkyAsset {
              position: absolute;
              left: 0;
              top: 0;
              transform: translate(var(--sky-x), var(--sky-y)) scale(.72);
              will-change: transform, opacity, filter;
              animation: sentStarTwinkle var(--sky-duration) ease-in-out var(--sky-delay) infinite alternate;
            }

            .sentSkyDot {
              width: var(--sky-size);
              height: var(--sky-size);
              border-radius: 50%;
              background: #fff;
              box-shadow: 0 0 5px rgba(255,255,255,.95), 0 0 13px rgba(255,255,255,.6);
            }

            .sentSkyAsset {
              width: var(--sky-size) !important;
              height: var(--sky-size) !important;
              object-fit: contain;
              filter: drop-shadow(0 0 5px currentColor);
            }

            .sentSkyAsset-blue { color: #28aaff; }
            .sentSkyAsset-gold { color: #f0d45b; }

            .sentGiftFlightCopy {
              position: absolute;
              left: 50%;
              top: 50%;
              z-index: 4;
              display: grid;
              gap: 12px;
              width: min(92vw, 780px);
              transform: translate(-50%, -50%);
              text-align: center;
              color: #fff;
              opacity: 0;
              animation: sentFlightCopy 1.15s cubic-bezier(.2,.8,.2,1) .35s both;
              pointer-events: none;
            }

            .sentGiftFlightCopy strong {
              font-family: "CDA Independence Text", serif;
              font-size: clamp(30px, 3.8vw, 58px);
              font-weight: 500;
              letter-spacing: .018em;
              line-height: 1.12;
              text-wrap: balance;
              text-shadow:
                0 0 18px rgba(255,255,255,.08),
                0 8px 30px rgba(0,0,0,.5);
            }

            .sentGiftFlightCopy span {
              font-family: "CDA Independence Text", serif;
              font-size: clamp(13px, .95vw, 15px);
              font-weight: 500;
              line-height: 1.55;
              letter-spacing: .01em;
              color: rgba(255,255,255,.72);
              text-wrap: balance;
            }
@keyframes sentSkyBreath {
              0% { transform: scale(.96); }
              50% { transform: scale(1.035); }
              100% { transform: scale(1.075); }
            }

            @keyframes sentStarTwinkle {
              0% {
                opacity: .25;
                transform: translate(var(--sky-x), var(--sky-y)) translate(var(--sky-drift-x), var(--sky-drift-y)) scale(.58) rotate(-8deg);
                filter: brightness(.72) drop-shadow(0 0 2px currentColor);
              }
              55% { opacity: 1; }
              100% {
                opacity: .72;
                transform: translate(var(--sky-x), var(--sky-y)) translate(calc(var(--sky-drift-x) * -1), calc(var(--sky-drift-y) * -1)) scale(1.34) rotate(9deg);
                filter: brightness(1.65) drop-shadow(0 0 8px currentColor);
              }
            }

            @keyframes sentFlightCopy {
              0% {
                opacity: 0;
                transform: translate(-50%, -44%) scale(.96);
                filter: blur(6px);
              }
              100% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
                filter: blur(0);
              }
            }

            @media (max-width: 640px) {
              .thanksBlueStar { width: 7px !important; height: 7px !important; }
              .sentGiftEndingHome { right: 16px; bottom: 18px; }
              .sentGiftNewCakeButton { top: 18px; right: 16px; min-width: 148px; height: 42px; padding: 0 18px; font-size: 14px; }
            }

            @media (prefers-reduced-motion: reduce) {
              .sentGiftSky,
              .sentSkyDot,
              .sentSkyAsset,
              .thanksBlueStar,
              .sentGiftFlightCopy,
              .sentGiftEndingHome {
                animation-duration: .01ms !important;
                animation-delay: 0ms !important;
              }
            }
          `}</style>
        </section>
      )}

      <style>{`
        .gameTopNav .gameNavButton,
        .gameTopNav .gameNavStartHint {
          font-family: "CDA Independence Text", serif !important;
          letter-spacing: 0 !important;
          font-style: normal !important;
        }

        /* CTA highlight — subtle moonlight sparkle, only for Trang trí bánh. */
        .gameNavDecorateGroup > .gameNavButton {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          animation: decorateButtonGlow 2.8s ease-in-out infinite;
          will-change: box-shadow, filter;
        }

        .gameNavDecorateGroup > .gameNavButton::after {
          content: "";
          position: absolute;
          z-index: 1;
          top: -60%;
          bottom: -60%;
          left: -42%;
          width: 28%;
          pointer-events: none;
          opacity: 0;
          transform: skewX(-20deg);
          background: linear-gradient(90deg, transparent, rgba(255,248,190,.72), transparent);
          filter: blur(1px);
          animation: decorateButtonShine 3.6s cubic-bezier(.22,.61,.36,1) infinite;
        }

        @keyframes decorateButtonGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(244,220,102,0), 0 0 12px rgba(244,220,102,.12); filter: brightness(1); }
          50% { box-shadow: 0 0 10px rgba(244,220,102,.34), 0 0 24px rgba(244,220,102,.20); filter: brightness(1.08); }
        }

        @keyframes decorateButtonShine {
          0%, 58% { left: -42%; opacity: 0; }
          64% { opacity: .8; }
          82% { left: 118%; opacity: 0; }
          100% { left: 118%; opacity: 0; }
        }

        /* Stronger moonlight CTA: halo + shimmer + tiny orbiting sparkles. */
        .gameNavDecorateGroup {
          position: relative;
          isolation: isolate;
        }

        .gameNavDecorateGroup::before,
        .gameNavDecorateGroup::after {
          content: "✦";
          position: absolute;
          z-index: 4;
          color: #fff6ad;
          pointer-events: none;
          text-shadow:
            0 0 4px rgba(255,255,255,.95),
            0 0 10px rgba(255,225,92,.92),
            0 0 18px rgba(255,211,45,.55);
          opacity: 0;
          animation: decorateSparkTwinkle 2.15s ease-in-out infinite;
        }

        .gameNavDecorateGroup::before {
          left: 8%;
          top: -9px;
          font-size: 9px;
        }

        .gameNavDecorateGroup::after {
          right: 5%;
          top: 35px;
          font-size: 7px;
          animation-delay: -1.05s;
        }

        .gameNavDecorateGroup > .gameNavButton {
          border-color: rgba(255,239,146,.58) !important;
          animation: decorateButtonGlowStrong 2.15s ease-in-out infinite !important;
        }

        .gameNavDecorateGroup > .gameNavButton:hover,
        .gameNavDecorateGroup > .gameNavButton:focus-visible {
          filter: brightness(1.14) !important;
          box-shadow:
            0 0 10px rgba(255,245,181,.70),
            0 0 25px rgba(244,211,75,.48),
            0 0 46px rgba(214,172,32,.25) !important;
        }

        .gameNavStartHint {
          animation: decorateHintFloat 2.15s ease-in-out infinite;
          text-shadow: 0 0 8px rgba(255,244,181,.30);
        }

        .gameNavStartArrow {
          display: inline-block;
          color: #fff7c4;
          filter: drop-shadow(0 0 5px rgba(255,224,92,.8));
          animation: decorateArrowGlow 1.35s ease-in-out infinite;
        }

        @keyframes decorateButtonGlowStrong {
          0%, 100% {
            box-shadow:
              0 0 5px rgba(255,246,190,.26),
              0 0 14px rgba(244,211,75,.18),
              0 0 28px rgba(214,172,32,.08);
            filter: brightness(1);
          }
          50% {
            box-shadow:
              0 0 9px rgba(255,249,207,.72),
              0 0 25px rgba(244,211,75,.46),
              0 0 48px rgba(214,172,32,.22);
            filter: brightness(1.11);
          }
        }

        @keyframes decorateSparkTwinkle {
          0%, 100% { opacity: 0; transform: translateY(2px) scale(.45) rotate(0deg); }
          28% { opacity: .95; transform: translateY(-2px) scale(1.18) rotate(25deg); }
          52% { opacity: .30; transform: translateY(-4px) scale(.72) rotate(50deg); }
          72% { opacity: .9; transform: translateY(-1px) scale(1) rotate(80deg); }
        }

        @keyframes decorateHintFloat {
          0%, 100% { transform: translateY(0); opacity: .82; }
          50% { transform: translateY(3px); opacity: 1; }
        }

        @keyframes decorateArrowGlow {
          0%, 100% { transform: translateY(0) scale(.92); opacity: .72; }
          50% { transform: translateY(-3px) scale(1.12); opacity: 1; }
        }

        /* New selections appear immediately but softly; no blur/size animation. */
        .orbitScene > .selectedPhenakistoscopeRings > .selectedRing {
          animation: selectedRingReveal 140ms cubic-bezier(.2,.8,.2,1) both !important;
        }

        @keyframes selectedRingReveal {
          from { opacity: 0; scale: .985; }
          to { opacity: 1; scale: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .gameNavDecorateGroup > .gameNavButton,
          .gameNavDecorateGroup > .gameNavButton::after,
          .orbitScene > .selectedPhenakistoscopeRings > .selectedRing {
            animation: none !important;
          }
        }

        .cakeQuizQuestionBody > .cakeQuizSubQuestion {
          margin-top: 10px;
        }

        /* FIX: cụm action dưới bánh phải thẳng tâm với vòng bánh, không theo tâm viewport. */
        .orbitBottomActions {
          left: 50vw !important;
          right: auto !important;
          bottom: 20px !important;
          transform: translateX(-50%) !important;
          width: min(430px, calc(100vw - 32px));
          max-width: calc(100vw - 32px);
          display: grid !important;
          grid-template-columns: repeat(3, 1fr);
          align-items: center;
          justify-content: center;
          gap: 10px !important;
          text-align: center;
        }

        .orbitBottomActions button {
          width: 100%;
          min-width: 0 !important;
          height: 38px;
          padding: 0 14px !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          line-height: 1;
        }

        @media (max-width: 900px) {
          .orbitBottomActions {
            left: 50% !important;
          }
        }
      `}</style>

      <nav className="gameTopNav" aria-label="Điều hướng trò chơi">
        <div className="gameNavDecorateGroup">
          <button
            type="button"
            className={`gameNavButton ${view === "decorate" && quizOpen ? "gameNavButtonActive" : ""}`}
            aria-expanded={view === "decorate" && quizOpen}
            aria-controls="cake-quiz-panel"
            onClick={() => {
              setView("decorate");
              setQuizOpen((value) => !value);
            }}
          >
            Trang trí bánh
          </button>
          {!quizOpen && !ring1 && !ring2 && !ring3 && (
            <button
              type="button"
              className="gameNavStartHint"
              onClick={() => {
                setView("decorate");
                setQuizOpen(true);
              }}
            >
              <span className="gameNavStartArrow" aria-hidden="true">▲</span>
              <span>Bắt đầu trang trí bánh</span>
            </button>
          )}
        </div>

        <button
          type="button"
          className={`gameNavButton ${view === "gallery" ? "gameNavButtonActive" : ""}`}
          onClick={() => { setQuizOpen(false); setView("gallery"); }}
        >
          Tiệm bánh
        </button>
      </nav>

      {view === "gallery" && (
        <section className="cakeGallery" aria-label="Cửa hàng bánh ">
          <div className="cakeGalleryHeader">
            <div><h2>Cửa hàng bánh </h2><p>Bánh thơm đã đợi dưới trăng rằm - 
Chạm vào một chiếc bánh, gửi chút ngọt ngào đến người thương. 🌕
</p></div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
  <button type="button" onClick={() => { setQuizOpen(false); setView("decorate"); }}>Trang trí bánh mới</button>
</div>
          </div>
          {gallery.length === 0 ? (
            <div className="cakeGalleryEmpty">Chưa có chiếc bánh nào trên kệ.</div>
          ) : (
            <div className="cakeGalleryGrid">
              {gallery.map((cake) => (
                <article
                  className="cakeGalleryCard"
                  style={{ position: "relative" }}
                  key={cake.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Gửi bánh của ${cake.name}`}
                  onClick={() => openSendCake(cake)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openSendCake(cake);
                    }
                  }}
                >
                  <div className="cakeGalleryPreview">
                    {cake.rings.map((answer, index) => (
                      <PhenakistoscopeRing key={`${cake.id}-${index}`} src={answer.asset} ring={index} preview />
                    ))}
                  </div>
                  <strong>{cake.name}</strong>
                  {isAdmin && (
                    <button
                      type="button"
                      aria-label={`Xóa bánh của ${cake.name}`}
                      disabled={deletingCakeId === cake.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteCake(cake);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        zIndex: 10,
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        border: "1px solid rgba(255,255,255,.35)",
                        background: "rgba(0,0,0,.72)",
                        color: "#fff",
                        cursor: deletingCakeId === cake.id ? "wait" : "pointer",
                      }}
                    >
                      {deletingCakeId === cake.id ? "…" : "×"}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {notice && <div className="cakeNotice" role="status" onClick={() => setNotice("")}>{notice}</div>}

      <aside id="cake-quiz-panel" className={`cakeQuizPanel ${view === "decorate" && quizOpen ? "cakeQuizPanelOpen" : ""}`}>
        <button
          type="button"
          className="cakeQuizClose"
          aria-label="Đóng bảng câu hỏi"
          onClick={() => setQuizOpen(false)}
        >
          ×
        </button>

        <p className="cakeQuizIntro">
          Nhắm mắt lại và nghĩ đến một người thân yêu, hãy thử đoán xem:
        </p>

        <div className="cakeQuizScroll">
          <section className="cakeQuizQuestion">
            <button type="button" className="cakeQuizQuestionHeader" onClick={() => setOpenQuestion(openQuestion === 1 ? null : 1)} aria-expanded={openQuestion === 1}>
              <span>Câu 1: Người ấy sẽ chọn vào team bánh nhân gì?</span>
              <span
                className={`cakeQuizChevron ${openQuestion === 1 ? "cakeQuizChevronOpen" : ""}`}
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 14px",
                  transition: "transform 180ms ease",
                  transform: openQuestion === 1 ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <svg width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true">
                  <path
                    d="M1 1L6 6L11 1"
                    stroke="rgba(255,255,255,0.82)"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            {openQuestion === 1 && <div className="cakeQuizQuestionBody">
              <div className="cakeQuizOptions">
                {FILLING_TEAMS.map((option) => (
                  <button type="button" key={option.key} className={`cakeQuizOption ${team === option.key ? "cakeQuizOptionSelected" : ""}`} onClick={() => chooseTeam(option.key)}>{option.label}</button>
                ))}
              </div>
              {team && <div className="cakeQuizSubQuestion">
                <div className="cakeQuizOptions">
                  {FILLING_OPTIONS[team].map((option) => (
                    <button type="button" key={option.label} className={`cakeQuizOption ${ring1?.label === option.label ? "cakeQuizOptionSelected" : ""}`} onClick={() => setRing1(option)}>{option.label}</button>
                  ))}
                </div>
              </div>}
            </div>}
          </section>

          <section className="cakeQuizQuestion">
            <button type="button" className="cakeQuizQuestionHeader" onClick={() => setOpenQuestion(openQuestion === 2 ? null : 2)} aria-expanded={openQuestion === 2}>
              <span>Câu 2: Nếu người ấy đại diện cho một loại nhân khác, đó sẽ là nhân gì?</span>
              <span
                className={`cakeQuizChevron ${openQuestion === 2 ? "cakeQuizChevronOpen" : ""}`}
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 14px",
                  transition: "transform 180ms ease",
                  transform: openQuestion === 2 ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <svg width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true">
                  <path
                    d="M1 1L6 6L11 1"
                    stroke="rgba(255,255,255,0.82)"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            <p className="cakeQuizHint">Khám phá thêm nhiều “nhân bánh” thú vị</p>
            {openQuestion === 2 && (
              <div className="cakeQuizQuestionBody">
                <div className="cakeQuizOptions">
                  {FILLING_CATEGORIES.map((category) => (
                    <button
                      type="button"
                      key={category.key}
                      className={`cakeQuizOption ${fillingCategory === category.key ? "cakeQuizOptionSelected" : ""}`}
                      onClick={() => {
                        setFillingCategory(category.key);
                        setRing2(null);
                      }}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>

                {fillingCategory && (
                  <div className="cakeQuizSubQuestion">
                    <div className="cakeQuizOptions">
                      {Q2_FILLINGS[fillingCategory].map((option) => (
                        <button
                          type="button"
                          key={option.label}
                          className={`cakeQuizOption ${ring2?.label === option.label ? "cakeQuizOptionSelected" : ""}`}
                          onClick={() => setRing2(option)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="cakeQuizQuestion">
            <button type="button" className="cakeQuizQuestionHeader" onClick={() => setOpenQuestion(openQuestion === 3 ? null : 3)} aria-expanded={openQuestion === 3}>
              <span>Câu 3: Người ấy tuổi con gì?</span>
              <span
                className={`cakeQuizChevron ${openQuestion === 3 ? "cakeQuizChevronOpen" : ""}`}
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 14px",
                  transition: "transform 180ms ease",
                  transform: openQuestion === 3 ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <svg width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true">
                  <path
                    d="M1 1L6 6L11 1"
                    stroke="rgba(255,255,255,0.82)"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            <p className="cakeQuizHint">Chọn 1 trong 12 con giáp</p>
            {openQuestion === 3 && <div className="cakeQuizQuestionBody"><div className="cakeQuizOptions">
              {ZODIAC_OPTIONS.map((option) => (
                <button type="button" key={option.label} className={`cakeQuizOption ${ring3?.label === option.label ? "cakeQuizOptionSelected" : ""}`} onClick={() => setRing3(option)}>{option.label}</button>
              ))}
            </div></div>}
          </section>

          <button
            type="button"
            className="cakeQuizFinish"
            disabled={!complete}
            onClick={() => {
              if (!complete) return;
              setFinalOpen(false);
              setQuizOpen(false);
              setOpenQuestion(null);
            }}
          >
            Hoàn thành
          </button>
        </div>
      </aside>

      {finalOpen && complete && (
        <div className="cakeResultOverlay" role="dialog" aria-modal="true" aria-label="Bánh đã ra lò">
          <div className="cakeResultModal">
            <button
              type="button"
              className="cakeResultClose"
              aria-label="Đóng"
              onClick={() => setFinalOpen(false)}
            >
              ×
            </button>

            <h2>Bánh đã ra lò</h2>
            <p className="cakeResultSubtitle">
              Chiếc bánh của bạn giờ đã có mặt trong Tiệm bánh 
            </p>

            <div className="cakeResultPreview" aria-hidden="true">
              {rings.map((answer, index) =>
                answer ? (
                  <PhenakistoscopeRing
                    key={`preview-${index}-${answer.asset}`}
                    src={answer.asset}
                    ring={index}
                    preview
                  />
                ) : null,
              )}
            </div>

            <label className="cakeResultLabel" htmlFor="display-name">
              Tên bạn muốn hiện
            </label>
            <input
              id="display-name"
              className="cakeResultInput"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="abc"
              maxLength={30}
              autoComplete="name"
              onKeyDown={(event) => {
                if (event.key === "Enter" && displayName.trim()) {
                  event.preventDefault();
                  saveCake();
                }
              }}
            />

            <div className="cakeResultActions">
              <button type="button" className="cakeResultCancel" onClick={() => setFinalOpen(false)}>
                Hủy
              </button>
              <button id="save-cake-button" type="button" className="cakeResultSubmit" onClick={saveCake} disabled={!displayName.trim()}>
                Cho bánh lên kệ
              </button>
            </div>
          </div>
        </div>
      )}

      {sendOpen && selectedCake && (
        <>
          <style>{`
            /* SEND POPUP ONLY — lock all copy/fields/actions to CDA Medium. */
            .cakeSendModal,
            .cakeSendModal *,
            .cakeSendModal label,
            .cakeSendModal input,
            .cakeSendModal textarea,
            .cakeSendModal button {
              font-family: "CDA Independence Text", serif !important;
              font-weight: 500 !important;
              font-style: normal !important;
            }

            .cakeSendModal input::placeholder,
            .cakeSendModal textarea::placeholder {
              font-family: "CDA Independence Text", serif !important;
              font-weight: 500 !important;
              font-style: normal !important;
            }
          `}</style>
          <div className="cakeResultOverlay" role="dialog" aria-modal="true" aria-label="Gửi tới ai đó">
          <div className="cakeResultModal cakeSendModal">
            <button
              type="button"
              className="cakeResultClose"
              aria-label="Đóng"
              onClick={closeSendCake}
              disabled={sending}
            >
              ×
            </button>

            <div className="cakeSendLeft">
             <h2>
              Chiếc bánh của bạn đã sẵn sàng - Gửi tặng chiếc bánh này đến người yêu quý nào
              </h2>

              <div className="cakeResultPreview cakeSendPreview" aria-hidden="true">
                {selectedCake.rings.map((answer, index) => (
                  <PhenakistoscopeRing
                    key={`send-preview-${selectedCake.id}-${index}`}
                    src={answer.asset}
                    ring={index}
                    preview
                  />
                ))}
              </div>
            </div>

            <div className="cakeSendForm">
              <label className="cakeResultLabel" htmlFor="recipient-email">
                Email người bạn muốn gửi
              </label>
              <input
                id="recipient-email"
                className="cakeResultInput"
                type="email"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="abc..@gmail.com"
                autoComplete="email"
                disabled={sending}
              />

              <label className="cakeResultLabel cakeSendMessageLabel" htmlFor="send-message">
                Lời nhắn dành cho người ấy (Tối đa 300 ký tự)
              </label>
              <textarea
                id="send-message"
                className="cakeResultInput cakeSendTextarea"
                value={sendMessage}
                onChange={(event) => setSendMessage(event.target.value.slice(0, 300))}
                maxLength={300}
                rows={5}
                disabled={sending}
              />

              {sendError && (
                <p className="cakeSendError" role="alert">{sendError}</p>
              )}

              <div className="cakeResultActions cakeSendActions">
                <button
                  type="button"
                  className="cakeResultCancel"
                  onClick={closeSendCake}
                  disabled={sending}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="cakeResultSubmit"
                  onClick={sendCake}
                  disabled={sending || !recipientEmail.trim()}
                >
                  {sending ? "Đang gửi..." : "Ship bánh"}
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {sentCakeOpen && sentCakeRings && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chiếc bánh"
          onClick={() => {
            setSentCakeOpen(false);
            setSentSkyOpen(false);
            onReturnHome();
          }}
          className="sentCakeOnlyOverlay"
        >
          <div
            className="sentCakePhenakistoscope"
            onClick={(event) => event.stopPropagation()}
            style={
              {
                "--sent-cake-step": `${sentCakeFrame * 30}deg`,
              } as CSSProperties
            }
          >
            {sentCakeRings.map((ring, index) => (
              <div
                key={`${ring.asset}-${index}`}
                className={`sentCakeStepRing sentCakeStepRing${index + 1}`}
              >
                <Image
                  src={ring.asset}
                  alt=""
                  fill
                  sizes="520px"
                  className="sentCakeStepArtwork"
                  unoptimized
                />
              </div>
            ))}
          </div>

          <style>{`
            .sentCakeOnlyOverlay {
              position: fixed;
              inset: 0;
              z-index: 100;
              display: grid;
              place-items: center;
              background: rgba(0, 0, 0, .18);
              cursor: pointer;
            }

            .sentCakePhenakistoscope {
              position: relative;
              width: min(76vw, 520px);
              height: min(76vw, 520px);
              max-width: 82vh;
              max-height: 82vh;
              aspect-ratio: 1 / 1;
              cursor: default;
              animation: sentCakeAppear .35s cubic-bezier(.2,.8,.2,1) both;
            }

            .sentCakeStepRing {
              position: absolute;
              left: 50%;
              top: 50%;
              transform: translate(-50%, -50%);
              transform-origin: center;
              pointer-events: none;
            }

            .sentCakeStepRing1 {
              width: 40%;
              height: 40%;
            }

            .sentCakeStepRing2 {
              width: 66%;
              height: 66%;
            }

            .sentCakeStepRing3 {
              width: 92%;
              height: 92%;
            }

            .sentCakeStepArtwork {
              object-fit: contain;
              transform: rotate(calc(-1 * var(--sent-cake-step)));
              transform-origin: center;
              pointer-events: none;
              user-select: none;
            }

            @keyframes sentCakeAppear {
              from {
                opacity: 0;
                transform: scale(.82);
                filter: blur(3px);
              }
              to {
                opacity: 1;
                transform: scale(1);
                filter: blur(0);
              }
            }
          `}</style>
        </div>
      )}

      <div className="orbitBottomActions">
        <button
          type="button"
          className="orbitBottomButton"
          disabled={!complete}
          onClick={() => complete && setFinalOpen(true)}
        >
          Cho bánh lên kệ
        </button>
        <button
          type="button"
          className="orbitBottomButton"
          disabled={!complete}
          onClick={openSendCurrentCake}
        >
          Gửi tới ai đó
        </button>
        <button
          type="button"
          className="orbitBottomButton"
          disabled={!complete}
          onClick={downloadCakeImage}
        >
          Tải xuống
        </button>
      </div>
    </>
  );
}

function PhenakistoscopeRing({ src, ring, preview = false }: { src: string; ring: number; preview?: boolean }) {
  // 3 vòng đồng tâm tuyệt đối: vòng ngoài giữ 86% để không chạm/crop mép stage.
  const ringSizes = [18, 62, 86];
  const previewRingSizes = [18, 62, 86];
  const activeRingSizes = preview ? previewRingSizes : ringSizes;

  // Pose changes quickly; the outer wrapper drifts continuously around the orbit.
  // Different lap durations stop all three rings from feeling mechanically locked together.
  const poseDurations = [1.2, 1.2, 1.2];
  const lapDurations = [5.2, 5.8, 6.4];

  const style = {
    "--selected-ring-size": `${activeRingSizes[ring]}%`,
    "--selected-ring-pose": `${poseDurations[ring]}s`,
    "--selected-ring-lap": `${lapDurations[ring]}s`,
  } as CSSProperties;

  return (
    <div
      className={`${preview ? "resultPreviewRing" : "selectedRing"} selectedRing${ring + 1}`}
      style={style}
    >
      <div className="selectedRingMotion">
        <Image
          src={src}
          alt=""
          width={2000}
          height={2000}
          className="selectedRingArtwork"
          unoptimized
          sizes="(max-width: 900px) 86vw, 820px"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      </div>
    </div>
  );
}

/* =========================================================
   RABBIT FRAME

   Circular static source
   → 12 temporal frames
   → 30° / frame
========================================================= */

function RabbitFrame({
  frame,
  instance,
}: {
  frame: number;
  instance: number;
}) {
  /*
   * Mỗi vị trí trên vòng lệch đúng 1 temporal frame.
   * 12 vị trí = 12 trạng thái khác nhau từ chính PNG nguồn.
   * Không tạo pose mới và không xoay artwork để giả chuyển động.
   */

  const actualFrame =
    (frame + instance) %
    TOTAL_RABBIT_FRAMES;

  const crop = useMemo(() => {
    const step =
      360 / TOTAL_RABBIT_FRAMES;

    const angleDegrees =
      RABBIT_SOURCE.startAngle -
      actualFrame * step;

    const angleRadians =
      (angleDegrees * Math.PI) / 180;

    /*
     * Tọa độ tâm frame trên source.
     */

    const frameCenterX =
      RABBIT_SOURCE.centerX +
      Math.cos(angleRadians) *
        RABBIT_SOURCE.radius;

    const frameCenterY =
      RABBIT_SOURCE.centerY +
      Math.sin(angleRadians) *
        RABBIT_SOURCE.radius;

    /*
     * Phóng source để vùng 1 frame
     * vừa viewport.
     */

    const sourceScale =
      100 / RABBIT_SOURCE.frameSize;

    return {
      frameCenterX,
      frameCenterY,
      sourceScale,
      angleDegrees,
    };
  }, [actualFrame]);

  const style = {
    "--rabbit-source-scale":
      `${crop.sourceScale}%`,

    "--rabbit-frame-x":
      `${crop.frameCenterX * 100}%`,

    "--rabbit-frame-y":
      `${crop.frameCenterY * 100}%`,
  } as CSSProperties;

  return (
    <div
      className="rabbitFrameViewport"
      style={style}
      data-frame={actualFrame}
      data-angle={crop.angleDegrees}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/phenakistoscope/tho.png"
        alt=""
        draggable={false}
        className="rabbitFrameSource"
      />
    </div>
  );
}
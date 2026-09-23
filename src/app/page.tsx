"use client";

import Image from "next/image";
import {
  CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";

const TOTAL_ORBIT_ITEMS = 10;
const TOTAL_RABBIT_FRAMES = 12;
const RABBIT_FRAME_DURATION = 1000 / 12;
const CAKE_STORAGE_KEY = "tdc-cakes-v1";

/*
 * Circular rabbit source.
 *
 * 1 ảnh rabbit.png chứa các trạng thái quanh vòng.
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

const ORBIT_PARTICLES = [
  ...WHITE_DOTS.map((dot, index) => ({
    id: `dot-${index}`,
    kind: "dot" as const,
    left: dot.left,
    top: dot.top,
    size: Math.max(4, dot.size - 1),
    radius: 0.18 + (index % 5) * 0.07,
    angle: (index * 137.5) % 360,
    duration: 9 + (index % 5) * 1.3,
    delay: (index % 8) * 0.06,
  })),
  ...BLUE_STARS.map((star, index) => ({
    id: `blue-${index}`,
    kind: "star" as const,
    left: star.left,
    top: star.top,
    size: Math.max(34, Math.round(star.size * 0.95)),
    // Keep the complete blue star safely INSIDE the outer circle.
    radius: 0.22 + (index % 4) * 0.065,
    angle: (index * 71 + 24) % 360,
    duration: 11 + index * 0.8,
    delay: index * 0.1,
  })),
];

export default function Home() {
  const [phase, setPhase] =
    useState<ScenePhase>("stars");

  const [rabbitFrame, setRabbitFrame] =
    useState(0);

  const [gameScene, setGameScene] =
    useState<GameScene>("intro");

  const startOrbitScene = () => {
    if (gameScene !== "intro") return;

    setGameScene("leaving");

    window.setTimeout(() => {
      setGameScene("orbit");
    }, 720);
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
    if (
      phase !== "transforming" &&
      phase !== "rabbits"
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setRabbitFrame(
        (current) =>
          (current + 1) %
          TOTAL_RABBIT_FRAMES,
      );
    }, RABBIT_FRAME_DURATION);

    return () => {
      window.clearInterval(timer);
    };
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
      {/* =====================================================
          LOGO
      ===================================================== */}

      <Image
        src="/images/phenakistoscope/logo.png"
        alt="TDC"
        width={180}
        height={90}
        priority
        className="tdcLogo"
      />


      {/* =====================================================
          BACKGROUND PARTICLES
      ===================================================== */}

      <div
        className={[
          "backgroundParticles",
          gameScene !== "intro" ? "backgroundParticlesLeaving" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      >
        {WHITE_DOTS.map((dot, index) => (
          <span
            key={`dot-${index}`}
            className="whiteDot"
            style={{
              left: dot.left,
              top: dot.top,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              animationDelay:
                `${(index % 7) * 0.28}s`,
              animationDuration:
                `${1.8 + (index % 4) * 0.25}s`,
            }}
          />
        ))}

        {BLUE_STARS.map((star, index) => (
          <Image
            key={`blue-${index}`}
            src="/images/phenakistoscope/starxanh.png"
            alt=""
            width={100}
            height={100}
            className="blueStar"
            style={{
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay:
                `${index * 0.37}s`,
            }}
          />
        ))}
      </div>

      {/* =====================================================
          CENTRAL STAGE
      ===================================================== */}

      <section
        className={[
          "centerStage",
          gameScene !== "intro" ? "centerStageLeaving" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Vòng xoay Vòng"
      >
        {/* ===================================================
            10 YELLOW STARS
        =================================================== */}

        {!starsHidden && (
          <div
            className={[
              "yellowStarOrbit",
              starsLeaving
                ? "yellowStarOrbitLeaving"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="orbitRotator">
              {ORBIT_ITEMS.map((item) => (
                <div
                  key={`star-${item.index}`}
                  className="orbitSlot"
                  style={{
                    transform:
                      `rotate(${item.angle}deg)`,
                  }}
                >
                  <div className="orbitItemPosition">
                    <div
                      className="orbitItemFacing"
                      style={{
                        transform:
                          `rotate(-${item.angle}deg)`,
                      }}
                    >
                      <Image
                        src="/images/phenakistoscope/starvang.png"
                        alt=""
                        width={100}
                        height={100}
                        priority
                        className="yellowStar"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================
            RABBIT SYSTEM
        =================================================== */}

        {rabbitVisible && (
          <div
            className={[
              "rabbitSystem",

              rabbitTransforming
                ? "rabbitSystemTransforming"
                : "",

              rabbitsFullyVisible
                ? "rabbitSystemVisible"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="rabbitOrbitRotator">
              {ORBIT_ITEMS.map((item) => (
                <div
                  key={`rabbit-${item.index}`}
                  className="rabbitOrbitSlot"
                  style={{
                    transform:
                      `rotate(${item.angle}deg)`,
                  }}
                >
                  <div className="rabbitOrbitPosition">
                    <div
                      className="rabbitFacing"
                      style={{
                        transform:
                          `rotate(-${item.angle}deg)`,
                      }}
                    >
                      <RabbitFrame
                        frame={rabbitFrame}
                        instance={item.index}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================
            MOON
        =================================================== */}

        <div
          className={[
            "moonWrapper",
            moonIsLarge
              ? "moonWrapperBig"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Image
            src={
              moonIsLarge
                ? "/images/phenakistoscope/moon1.png"
                : "/images/phenakistoscope/moon.png"
            }
            alt=""
            width={800}
            height={800}
            priority
            className="moonImage"
          />

          {/* =================================================
              TEXT

              Không dùng <br />.
              Mỗi dòng là 1 span riêng.
              Browser không được tự bẻ chữ.
          ================================================= */}

          <div
            className={[
              "moonContent",
              titleVisible
                ? "moonContentVisible"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <h1
              className="moonTitle"
              aria-label="Vòng xoay Vòng"
            >
              <span className="moonTitleLine">
                Vòng
              </span>

              <span className="moonTitleLine">
                xoay
              </span>

              <span className="moonTitleLine">
                Vòng
              </span>
            </h1>

            <button
              type="button"
              className="moonStartButton"
              aria-label="Bắt đầu"
              onClick={startOrbitScene}
            >
              <span className="moonStartLabel">Bắt đầu</span>
            </button>
          </div>
        </div>
      </section>

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
    { label: "Cốm", asset: "/images/phenakistoscope/com.png" },
    { label: "Đậu xanh", asset: "/images/phenakistoscope/dauxanh.png" },
    { label: "Khoai môn", asset: "/images/phenakistoscope/khoaimon.png" },
    { label: "Trà xanh", asset: "/images/phenakistoscope/traxanh.png" },
  ],
};

const UNUSUAL_FILLINGS: QuizOption[] = [
  { label: "Thịt kangaroo", asset: "/images/phenakistoscope/kanggoru.png" },
  { label: "Ớt", asset: "/images/phenakistoscope/ot.png" },
  { label: "Mắm tôm", asset: "/images/phenakistoscope/tom.png" },
  { label: "Thịt bò", asset: "/images/phenakistoscope/conbo.png" },
  { label: "Phô mai mật ong", asset: "/images/phenakistoscope/kembo.png" },
  { label: "Rau trộn", asset: "/images/phenakistoscope/kimchi.png" },
  { label: "Thịt rắn", asset: "/images/phenakistoscope/ran.png" },
  { label: "Nấm", asset: "/images/phenakistoscope/nam.png" },
  { label: "Coca", asset: "/images/phenakistoscope/coca.png" },
  { label: "Xíu mại", asset: "/images/phenakistoscope/xiumai.png" },
  { label: "Đậu hũ", asset: "/images/phenakistoscope/dauhu.png" },
  { label: "Thịt cá", asset: "/images/phenakistoscope/cahoi.png" },
  { label: "Mực", asset: "/images/phenakistoscope/muc.png" },
  { label: "Cá nóc", asset: "/images/phenakistoscope/canoc.png" },
  { label: "Sting", asset: "/images/phenakistoscope/sting.png" },
  { label: "Con tôm", asset: "/images/phenakistoscope/contom.png" },
  { label: "Củ kiệu", asset: "/images/phenakistoscope/cukieu.png" },
  { label: "Tôm khô", asset: "/images/phenakistoscope/tomkho.png" },
  { label: "Thịt khô", asset: "/images/phenakistoscope/thitkho.png" },
];

const ZODIAC_OPTIONS: QuizOption[] = [
  { label: "Tý", asset: "/images/phenakistoscope/ty.png" },
  { label: "Sửu", asset: "/images/phenakistoscope/suu.png" },
  { label: "Dần", asset: "/images/phenakistoscope/dan.png" },
  { label: "Mão", asset: "/images/phenakistoscope/rabbit.png" },
  { label: "Thìn", asset: "/images/phenakistoscope/thin.png" },
  { label: "Tỵ", asset: "/images/phenakistoscope/ran.png" },
  { label: "Ngọ", asset: "/images/phenakistoscope/ngo.png" },
  { label: "Mùi", asset: "/images/phenakistoscope/mui.png" },
  { label: "Thân", asset: "/images/phenakistoscope/than.png" },
  { label: "Dậu", asset: "/images/phenakistoscope/dau.png" },
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
  const [team, setTeam] = useState<FillingTeam | null>(null);
  const [ring1, setRing1] = useState<QuizOption | null>(null);
  const [ring2, setRing2] = useState<QuizOption | null>(null);
  const [ring3, setRing3] = useState<QuizOption | null>(null);
  const [finalOpen, setFinalOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [view, setView] = useState<"decorate" | "gallery">("decorate");
  const [gallery, setGallery] = useState<SavedCake[]>([]);
  const [notice, setNotice] = useState("");

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
    try {
      const raw = window.localStorage.getItem(CAKE_STORAGE_KEY);
      if (raw) setGallery(JSON.parse(raw) as SavedCake[]);
    } catch {
      setGallery([]);
    }
  }, []);

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

  const persistGallery = (next: SavedCake[]) => {
    setGallery(next);
    try {
      window.localStorage.setItem(CAKE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // UI still works when storage is unavailable.
    }
  };

  const saveCake = () => {
    if (!ring1 || !ring2 || !ring3) return;
    const name = displayName.trim();
    if (!name) {
      setNotice("Vui lòng nhập tên trước khi cho bánh lên kệ.");
      return;
    }
    const cake: SavedCake = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      rings: [ring1, ring2, ring3],
      createdAt: new Date().toISOString(),
    };
    persistGallery([cake, ...gallery].slice(0, 60));
    setFinalOpen(false);
    setView("gallery");
    setNotice("Đã lưu bánh vào Kệ bánh trên thiết bị này.");
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
          message: sendMessage.trim().slice(0, 50),
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
    setTeam(nextTeam);
    setRing1(null);
    setRing2(null);
    setRing3(null);
  };

  const resetDecoration = () => {
    setTeam(null);
    setRing1(null);
    setRing2(null);
    setRing3(null);
    setFinalOpen(false);
    setDisplayName("");
  };

  return (
    <>
      <section
        className={["orbitScene", active ? "orbitSceneActive" : "", decorating ? "orbitSceneDecorating" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label="Bầu trời quỹ đạo"
      >
        <div className="orbitBoundary" aria-hidden="true" />

        {!decorating && (
          <div className="orbitParticleField" aria-hidden="true">
            {ORBIT_PARTICLES.map((particle, index) => {
              const leftNumber = Number.parseFloat(particle.left);
              const topNumber = Number.parseFloat(particle.top);
              const style = {
                "--from-x": `${leftNumber - 50}vw`,
                "--from-y": `${topNumber - 50}vh`,
                "--particle-radius": particle.radius,
                "--particle-angle": `${particle.angle}deg`,
                "--particle-duration": `${particle.duration}s`,
                "--particle-delay": `${particle.delay}s`,
                "--particle-size": `${particle.size}px`,
                "--particle-index": index,
              } as CSSProperties;

              return (
                <button
                  key={particle.id}
                  type="button"
                  className={`orbitParticleTrack ${sentCakeRings ? "orbitParticleTrackClickable" : ""}`}
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
        )}

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
        <section
          className="sentGiftSky"
          aria-label="Bầu trời những chiếc bánh đã gửi"
        >
          <button
            type="button"
            className="sentGiftHomeButton"
            onClick={() => {
              setSentCakeOpen(false);
              setSentSkyOpen(false);
              onReturnHome();
            }}
            aria-label="Về trang chủ"
          >
            <span aria-hidden="true">←</span>
            <span>Về trang chủ</span>
          </button>

          <div className="sentGiftSkyParticles">
            {ORBIT_PARTICLES.map((particle, index) => {
              const style = {
                left: particle.left,
                top: particle.top,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                "--sent-delay": `${(index % 9) * 0.18}s`,
                "--sent-duration": `${2.6 + (index % 6) * 0.45}s`,
                "--sent-drift-x": `${((index % 5) - 2) * 9}px`,
                "--sent-drift-y": `${((index % 7) - 3) * 6}px`,
              } as CSSProperties;

              return (
                <button
                  key={`sent-${particle.id}`}
                  type="button"
                  className={[
                    "sentGiftParticle",
                    particle.kind === "star"
                      ? "sentGiftParticleStar"
                      : "sentGiftParticleDot",
                  ].join(" ")}
                  style={style}
                  aria-label="Mở chiếc bánh"
                  onClick={() => setSentCakeOpen(true)}
                >
                  {particle.kind === "star" ? (
                    <Image
                      src="/images/phenakistoscope/starxanh.png"
                      alt=""
                      width={100}
                      height={100}
                      className="sentGiftStarImage"
                      unoptimized
                    />
                  ) : (
                    <span className="sentGiftDotCore" />
                  )}
                </button>
              );
            })}
          </div>

          <style>{`
            .sentGiftSky {
              position: fixed;
              inset: 0;
              z-index: 80;
              overflow: hidden;
              background:
                radial-gradient(circle at 50% 48%, rgba(5, 28, 38, .22), transparent 34%),
                #000;
            }

            .sentGiftHomeButton {
              position: fixed;
              top: 28px;
              right: 34px;
              z-index: 12;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 9px;
              min-height: 42px;
              padding: 0 18px;
              border: 1px solid rgba(255, 255, 255, .5);
              border-radius: 999px;
              background: rgba(0, 0, 0, .36);
              color: #fff;
              font: inherit;
              font-size: 12px;
              font-weight: 600;
              letter-spacing: .035em;
              line-height: 1;
              white-space: nowrap;
              cursor: pointer;
              backdrop-filter: blur(9px);
              -webkit-backdrop-filter: blur(9px);
              box-shadow:
                0 0 0 1px rgba(255,255,255,.04) inset,
                0 7px 26px rgba(0,0,0,.3);
              transition:
                background .2s ease,
                color .2s ease,
                border-color .2s ease,
                transform .2s ease,
                box-shadow .2s ease;
            }

            .sentGiftHomeButton:hover {
              background: #fff;
              color: #050505;
              border-color: #fff;
              transform: translateY(-2px);
              box-shadow: 0 8px 28px rgba(255,255,255,.16);
            }

            .sentGiftHomeButton:focus-visible {
              outline: 2px solid #fff;
              outline-offset: 4px;
            }

            .sentGiftHomeButton > span:first-child {
              font-size: 16px;
              line-height: 1;
              transform: translateY(-1px);
            }

            .sentGiftSkyParticles {
              position: absolute;
              inset: 0;
            }

            .sentGiftParticle {
              position: absolute;
              z-index: 2;
              display: grid;
              place-items: center;
              margin: 0;
              padding: 0;
              border: 0;
              outline: 0;
              background: transparent;
              cursor: pointer;
              transform: translate(-50%, -50%);
              animation:
                sentGiftFloat var(--sent-duration) ease-in-out var(--sent-delay) infinite alternate,
                sentGiftBlink calc(var(--sent-duration) * .72) ease-in-out var(--sent-delay) infinite alternate;
            }

            .sentGiftParticle:hover {
              filter: brightness(1.7);
            }

            .sentGiftParticleDot {
              min-width: 18px;
              min-height: 18px;
            }

            .sentGiftDotCore {
              display: block;
              width: var(--particle-size, 6px);
              height: var(--particle-size, 6px);
              min-width: 5px;
              min-height: 5px;
              border-radius: 999px;
              background: #fff;
              box-shadow:
                0 0 6px rgba(255,255,255,.95),
                0 0 14px rgba(255,255,255,.48);
            }

            .sentGiftParticleStar {
              min-width: 40px;
              min-height: 40px;
            }

            .sentGiftStarImage {
              display: block;
              width: 100%;
              height: 100%;
              object-fit: contain;
              filter: drop-shadow(0 0 5px rgba(38, 161, 255, .95));
            }

            @keyframes sentGiftFloat {
              0% {
                transform: translate(-50%, -50%) translate(0, 0) scale(.92);
              }
              100% {
                transform:
                  translate(-50%, -50%)
                  translate(var(--sent-drift-x), var(--sent-drift-y))
                  scale(1.08);
              }
            }

            @keyframes sentGiftBlink {
              0% { opacity: .38; }
              45% { opacity: 1; }
              100% { opacity: .62; }
            }

            @media (max-width: 640px) {
              .sentGiftHomeButton {
                top: 18px;
                right: 16px;
                min-height: 40px;
                padding: 0 15px;
                font-size: 11px;
              }

              .sentGiftParticleStar {
                min-width: 34px;
                min-height: 34px;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .sentGiftParticle,
            }
          `}</style>
        </section>
      )}

      <nav className="gameTopNav" aria-label="Điều hướng trò chơi">
        <button
          type="button"
          className={`gameNavButton ${quizOpen ? "gameNavButtonActive" : ""}`}
          onClick={() => { setView("decorate"); setQuizOpen((value) => !value); }}
        >
          Trang trí bánh
        </button>
        <button
          type="button"
          className={`gameNavButton ${view === "gallery" ? "gameNavButtonActive" : ""}`}
          onClick={() => { setQuizOpen(false); setView("gallery"); }}
        >
          Kệ bánh
        </button>
        <button type="button" className="gameNavButton" onClick={openSendCurrentCake}>
          Gửi tới ai đó
        </button>
      </nav>

      {view === "gallery" && (
        <section className="cakeGallery" aria-label="Kệ bánh">
          <div className="cakeGalleryHeader">
            <div><h2>Kệ bánh</h2><p>Bánh thơm đã đợi dưới trăng rằm - 
Chạm vào một chiếc bánh, gửi chút ngọt ngào đến người thương. 🌕
</p></div>
            <button type="button" onClick={() => setView("decorate")}>Trang trí bánh mới</button>
          </div>
          {gallery.length === 0 ? (
            <div className="cakeGalleryEmpty">Chưa có chiếc bánh nào trên kệ.</div>
          ) : (
            <div className="cakeGalleryGrid">
              {gallery.map((cake) => (
                <article
                  className="cakeGalleryCard"
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
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {notice && <div className="cakeNotice" role="status" onClick={() => setNotice("")}>{notice}</div>}

      <aside className={`cakeQuizPanel ${quizOpen ? "cakeQuizPanelOpen" : ""}`}>
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
            <h2>Câu 1: Bạn thuộc team bánh nhân gì?</h2>
            <div className="cakeQuizOptions">
              {FILLING_TEAMS.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  className={`cakeQuizOption ${team === option.key ? "cakeQuizOptionSelected" : ""}`}
                  onClick={() => chooseTeam(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {team && (
              <div className="cakeQuizSubQuestion">
                <h3>Chọn {FILLING_TEAMS.find((item) => item.key === team)?.label.toLowerCase()}</h3>
                <p></p>
                <div className="cakeQuizOptions">
                  {FILLING_OPTIONS[team].map((option) => (
                    <button
                      type="button"
                      key={option.label}
                      className={`cakeQuizOption ${ring1?.label === option.label ? "cakeQuizOptionSelected" : ""}`}
                      onClick={() => {
                        setRing1(option);
                        setRing2(null);
                        setRing3(null);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {ring1 && (
            <section className="cakeQuizQuestion cakeQuizQuestionReveal">
              <h2>Câu 2: Nếu được tự chọn một loại nhân bánh thật khác lạ, bạn sẽ chọn nhân gì?</h2>
              <p className="cakeQuizHint"></p>
              <div className="cakeQuizOptions">
                {UNUSUAL_FILLINGS.map((option) => (
                  <button
                    type="button"
                    key={option.label}
                    className={`cakeQuizOption ${ring2?.label === option.label ? "cakeQuizOptionSelected" : ""}`}
                    onClick={() => {
                      setRing2(option);
                      setRing3(null);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {ring2 && (
            <section className="cakeQuizQuestion cakeQuizQuestionReveal">
              <h2>Câu 3: Bạn tuổi con gì?</h2>
              <p className="cakeQuizHint"></p>
              <div className="cakeQuizOptions">
                {ZODIAC_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.label}
                    className={`cakeQuizOption ${ring3?.label === option.label ? "cakeQuizOptionSelected" : ""}`}
                    onClick={() => {
                      setRing3(option);
                      window.setTimeout(() => {
                        setQuizOpen(false);
                        setFinalOpen(true);
                      }, 520);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}
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
              Trưng bày chiếc bánh này cùng những người khác
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
        <div className="cakeResultOverlay" role="dialog" aria-modal="true" aria-label="Gửi tới ai đó">
          <div className="cakeResultModal">
            <button
              type="button"
              className="cakeResultClose"
              aria-label="Đóng"
              onClick={closeSendCake}
              disabled={sending}
            >
              ×
            </button>

            <h2>Gửi tới ai đó</h2>
            <p className="cakeResultSubtitle">
              Gửi chiếc bánh của {selectedCake.name} tới người bạn muốn nhớ đến.
            </p>

            <div className="cakeResultPreview" aria-hidden="true">
              {selectedCake.rings.map((answer, index) => (
                <PhenakistoscopeRing
                  key={`send-preview-${selectedCake.id}-${index}`}
                  src={answer.asset}
                  ring={index}
                  preview
                />
              ))}
            </div>

            <label className="cakeResultLabel" htmlFor="recipient-email">
              Email người nhận
            </label>
            <input
              id="recipient-email"
              className="cakeResultInput"
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              placeholder="nguoinhan@gmail.com"
              autoComplete="email"
              disabled={sending}
            />

            <label className="cakeResultLabel" htmlFor="send-message">
              Lời nhắn <span>{sendMessage.length}/50</span>
            </label>
            <textarea
              id="send-message"
              className="cakeResultInput"
              value={sendMessage}
              onChange={(event) => setSendMessage(event.target.value.slice(0, 50))}
              placeholder="Chúc bạn một mùa Trung Thu thật vui!"
              maxLength={50}
              rows={3}
              disabled={sending}
              style={{ resize: "none", minHeight: 72, paddingTop: 10 }}
            />

            {sendError && (
              <p role="alert" style={{ margin: "9px 0 0", color: "#ff9b9b", fontSize: 12 }}>
                {sendError}
              </p>
            )}

            <div className="cakeResultActions">
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
                {sending ? "Đang gửi..." : "Gửi bánh"}
              </button>
            </div>
          </div>
        </div>
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
        <button type="button" className="orbitBottomButton">Tải xuống</button>
      </div>
    </>
  );
}

function PhenakistoscopeRing({ src, ring, preview = false }: { src: string; ring: number; preview?: boolean }) {
  const ringSizes = [40, 66, 92];
  // Gallery/result previews need a little more breathing room so the
  // artwork of adjacent rings does not visually stick together.
  const previewRingSizes = [32, 62, 96];
  const ringDurations = [1, 1, 1];
  const activeRingSizes = preview ? previewRingSizes : ringSizes;

  const style = {
    "--selected-ring-size": `${activeRingSizes[ring]}%`,
    "--selected-ring-duration": `${ringDurations[ring]}s`,
  } as CSSProperties;

  return (
    <div className={`${preview ? "resultPreviewRing" : "selectedRing"} selectedRing${ring + 1}`} style={style}>
      <Image
        src={src}
        alt=""
        width={1200}
        height={1200}
        className="selectedRingArtwork"
        unoptimized
      />
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
   * Các rabbit lệch pose nhau.
   *
   * 10 con không đồng thời dùng cùng một
   * body pose.
   */

  const actualFrame =
    (frame + instance) %
    TOTAL_RABBIT_FRAMES;

  const crop = useMemo(() => {
    const step =
      360 / TOTAL_RABBIT_FRAMES;

    const angleDegrees =
      RABBIT_SOURCE.startAngle +
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
        src="/images/phenakistoscope/rabbit.png"
        alt=""
        draggable={false}
        className="rabbitFrameSource"
      />
    </div>
  );
}
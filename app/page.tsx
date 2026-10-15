"use client";

import { useEffect, useRef, useState } from "react";

const alertSpacing: React.CSSProperties = { margin: "8px auto 0" };

type Item = {
  type: "video" | "photo";
  src: string;
  download: string;
  direct: string | null;
  thumb: string | null;
  thumbDirect: string | null;
  hasAudio: boolean | null;
  width: number | null;
  height: number | null;
};

type MediaData = {
  id: string;
  url: string;
  profileUrl: string | null;
  mediaType: "video" | "photo" | "mixed";
  text: string | null;
  timestamp: number | null;
  author: {
    username: string | null;
    name: string | null;
    verified: boolean;
    avatar: string | null;
    avatarDirect: string | null;
  };
  stats: {
    likes: number | null;
    replies: number | null;
    reposts: number | null;
    quotes: number | null;
    shares: number | null;
  };
  items: Item[];
};

type ApiResponse = {
  ok?: boolean;
  data?: MediaData;
  error?: string;
};

const compact = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCount(value: number | null) {
  return value === null ? "–" : compact.format(value);
}

function formatDate(seconds: number | null) {
  if (!seconds) return "";

  return new Date(seconds * 1000).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Icon({
  children,
  size = 20,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function LinkIcon() {
  return (
    <Icon size={22}>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </Icon>
  );
}

function DownloadIcon({ size = 22 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </Icon>
  );
}

function ExternalIcon() {
  return (
    <Icon size={18}>
      <path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </Icon>
  );
}

function CaptionIcon() {
  return (
    <Icon size={22}>
      <path d="M4 5h16" />
      <path d="M4 10h10" />
      <path d="M4 15h16" />
      <path d="M4 20h10" />
    </Icon>
  );
}

function HeartIcon() {
  return (
    <Icon>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </Icon>
  );
}

function ReplyIcon() {
  return (
    <Icon>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.2A8.4 8.4 0 1 1 21 11.5Z" />
    </Icon>
  );
}

function RetweetIcon() {
  return (
    <Icon>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </Icon>
  );
}

function QuoteIcon() {
  return (
    <Icon>
      <path d="M4 18h16" />
      <path d="M4 12h10" />
      <path d="M4 6h16" />
      <path d="m17 10 3 2-3 2" />
    </Icon>
  );
}

function ShareIcon() {
  return (
    <Icon>
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </Icon>
  );
}

function VerifiedIcon() {
  return (
    <svg
      className="verified"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Terverifikasi"
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" />
      <path d="m7.5 12.3 3 3 6-6.3" stroke="#0b0b0c" />
    </svg>
  );
}

type SmartImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  direct?: string | null;
  proxy: string;
  onFail?: () => void;
  onEarlyFail?: () => void;
};

function SmartImage({
  direct,
  proxy,
  onFail,
  onEarlyFail,
  ...rest
}: SmartImageProps) {
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [direct, proxy]);

  const separator = proxy.includes("?") ? "&" : "?";

  const src =
    direct && attempt === 0
      ? direct
      : attempt <= 1
        ? proxy
        : `${proxy}${separator}_retry=${attempt}`;

  function handleError() {
    if (attempt === 1) {
      onEarlyFail?.();
    }

    if (attempt >= 6) {
      onFail?.();
      return;
    }

    const delay = attempt === 0 ? 0 : 700 * attempt;

    setTimeout(() => setAttempt((value) => value + 1), delay);
  }

  return (
    <img
      {...rest}
      src={src}
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<MediaData | null>(null);
  const [playing, setPlaying] = useState(false);
  const [slide, setSlide] = useState(0);
  const [bulk, setBulk] = useState(false);
  const [notice, setNotice] = useState("");
    const [ratio, setRatio] = useState<number | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<number | null>(null);
  const submittedUrl = useRef("");
  const refreshed = useRef(false);

  function announce(message: string) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);

    setNotice(message);

    noticeTimer.current = setTimeout(() => setNotice(""), 7000);
  }

  async function refreshOnce() {
    if (refreshed.current || !submittedUrl.current) return;

    refreshed.current = true;

    try {
      const response = await fetch(
        `/api/threads?url=${encodeURIComponent(submittedUrl.current)}`,
        { cache: "no-store" }
      );

      const result = (await response
        .json()
        .catch(() => null)) as ApiResponse | null;

      if (response.ok && result?.ok && result.data) {
        setAvatarFailed(false);
        setData(result.data);
      }
    } catch {
      return;
    }
  }

  useEffect(() => {
    if (!data) return;

    data.items.forEach((item) => {
      const preload = item.direct ?? item.thumbDirect;

      if (!preload) return;

      const image = new Image();

      image.referrerPolicy = "no-referrer";
      image.src = preload;
    });

  }, [data]);

  const items = data?.items ?? [];
  const active = items[slide] ?? null;
  const multiple = items.length > 1;
  const playingVideo = playing && active?.type === "video";

  const stageStyle = ratio
    ? { aspectRatio: String(Math.min(2, Math.max(0.5, ratio))) }
    : active?.type === "video"
      ? { aspectRatio: "9 / 16" }
      : undefined;

  function captureRatio(event: React.SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;

    if (ratio === null && image.naturalWidth && image.naturalHeight) {
      setRatio(image.naturalWidth / image.naturalHeight);
    }
  }

  const fullCaption = data?.text?.trim() ?? "";

  const hashtags = [
    ...new Set(fullCaption.match(/#[\p{L}\p{N}_]+/gu) ?? []),
  ];

  const caption = fullCaption
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/^[ \t]*[.•·]+[ \t]*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  function resetView() {
    setPlaying(false);
    setSlide(0);
    setRatio(null);
    setAvatarFailed(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = url.trim();

    if (!value) {
      setError("Masukkan tautan postingan Threads terlebih dahulu.");
      return;
    }

    submittedUrl.current = value;
    refreshed.current = false;

    setLoading(true);
    setError("");
    setData(null);
    resetView();

    try {
      const response = await fetch(
        `/api/threads?url=${encodeURIComponent(value)}`,
        { cache: "no-store" }
      );

      const result = (await response
        .json()
        .catch(() => null)) as ApiResponse | null;

      if (!response.ok || !result?.ok || !result.data) {
        throw new Error(
          result?.error || "Gagal memproses media. Pastikan link masih aktif."
        );
      }

      setData(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memproses postingan."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    submittedUrl.current = "";
    setUrl("");
    setError("");
    setData(null);
    resetView();
  }

  function goTo(index: number) {
    if (!items.length) return;

    setPlaying(false);
    setSlide((index + items.length) % items.length);
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (touchStart.current === null) return;

    if (playingVideo) {
      touchStart.current = null;
      return;
    }

    const delta = event.changedTouches[0].clientX - touchStart.current;

    touchStart.current = null;

    if (Math.abs(delta) > 40) {
      goTo(delta < 0 ? slide + 1 : slide - 1);
    }
  }

  async function downloadAll() {
    if (bulk) return;

    setBulk(true);
    announce(`Mengunduh ${items.length} file satu per satu...`);

    try {
      for (const item of items) {
        const link = document.createElement("a");

        link.href = item.download;
        link.download = "";
        document.body.appendChild(link);
        link.click();
        link.remove();

        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } finally {
      setBulk(false);
    }
  }

  const username = data?.author.username;
  const displayName = data?.author.name || username || "Threads User";
  const label = active?.type === "video" ? "Video" : "Foto";
  const date = formatDate(data?.timestamp ?? null);

  const downloadHref = active?.download ?? "#";

  const statList = data
    ? [
        { key: "likes", name: "Suka", value: data.stats.likes, icon: <HeartIcon /> },
        { key: "replies", name: "Balasan", value: data.stats.replies, icon: <ReplyIcon /> },
        { key: "reposts", name: "Posting ulang", value: data.stats.reposts, icon: <RetweetIcon /> },
        { key: "quotes", name: "Kutipan", value: data.stats.quotes, icon: <QuoteIcon /> },
        { key: "shares", name: "Dibagikan", value: data.stats.shares, icon: <ShareIcon /> },
      ].filter((stat) => stat.value !== null)
    : [];

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ThreadMedia beranda">
          ThreadMedia
        </a>
        <span className="brand-note">Threads Downloader</span>
      </header>

      <section className="hero" id="top">
        <h1 className="hero-title">Unduh konten Threads</h1>
        <p className="tagline">Video dan foto, dengan mudah.</p>
      </section>

      <form className="search" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-icon">
            <LinkIcon />
          </span>

          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Tempel URL Threads..."
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="url"
          />

          {url && (
            <button
              type="button"
              className="field-clear"
              onClick={handleClear}
              aria-label="Hapus URL"
            >
              ×
            </button>
          )}
        </label>

        <button
          type="submit"
          className="btn btn-primary btn-search"
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <DownloadIcon size={20} />
          )}
          <span>{loading ? "Memproses" : "Unduh"}</span>
        </button>
      </form>

      {error && (
        <div className="alert" role="alert">
          <span className="alert-icon">!</span>
          <div>
            <strong>Gagal memproses media</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <section className="card" aria-busy="true">
          <div className="stage skeleton" />
          <div className="skeleton skeleton-btn" />
        </section>
      )}

      {data && !loading && active && (
        <>
          <section className="card">
            <div
              className={
                playingVideo ? "stage stage-slide stage-playing" : "stage stage-slide"
              }
              style={playingVideo ? undefined : stageStyle}
              onTouchStart={(event) => {
                touchStart.current = event.touches[0].clientX;
              }}
              onTouchEnd={onTouchEnd}
            >
              {active.type === "photo" && (
                <SmartImage
                  className="stage-blur"
                  direct={active.direct}
                  proxy={active.src}
                  alt=""
                  aria-hidden="true"
                />
              )}

              {items.map((item, index) =>
                item.type === "photo" ? (
                  <SmartImage
                    key={item.src}
                    className={
                      index === slide && !playingVideo
                        ? "stage-img stage-img-on"
                        : "stage-img"
                    }
                    direct={item.direct}
                    proxy={item.src}
                    alt={`Foto ${index + 1}`}
                    aria-hidden={index !== slide}
                    draggable={false}
                    onLoad={(event) => {
                      if (index === slide) captureRatio(event);
                    }}
                    onEarlyFail={refreshOnce}
                  />
                ) : null
              )}

              {active.type === "photo" ? null : playingVideo ? (
                <video
                  key={active.src}
                  className="player"
                  src={active.src}
                  poster={active.thumb ?? undefined}
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <button
                  type="button"
                  className="thumb-button"
                  onClick={() => setPlaying(true)}
                  aria-label="Putar video"
                >
                  {active.thumb ? (
                    <>
                      <SmartImage
                        key={`blur-${active.thumb}`}
                        className="stage-blur"
                        direct={active.thumbDirect}
                        proxy={active.thumb}
                        alt=""
                        aria-hidden="true"
                      />
                      <SmartImage
                        key={active.thumb}
                        className="thumb"
                        direct={active.thumbDirect}
                        proxy={active.thumb}
                        alt="Thumbnail video"
                        onLoad={captureRatio}
                        onEarlyFail={refreshOnce}
                      />
                    </>
                  ) : (
                    <span className="thumb thumb-empty" />
                  )}
                  <span className="play">
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 5.5v13a1 1 0 0 0 1.5.9L20 12.9a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z" />
                    </svg>
                  </span>
                </button>
              )}

              <span className="badge badge-left">{label}</span>

              {multiple && (
                <>
                  <span className="badge badge-right">
                    {slide + 1} / {items.length}
                  </span>

                  {!playingVideo && (
                    <>
                      <button
                        type="button"
                        className="nav nav-left"
                        onClick={() => goTo(slide - 1)}
                        aria-label="Sebelumnya"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className="nav nav-right"
                        onClick={() => goTo(slide + 1)}
                        aria-label="Berikutnya"
                      >
                        ›
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

            {multiple && (
              <div className="pager">
                <button
                  type="button"
                  className="pager-btn"
                  onClick={() => goTo(slide - 1)}
                  aria-label="Sebelumnya"
                >
                  ‹
                </button>

                <div className="dots">
                  {items.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={index === slide ? "dot active" : "dot"}
                      onClick={() => goTo(index)}
                      aria-label={`Item ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="pager-btn"
                  onClick={() => goTo(slide + 1)}
                  aria-label="Berikutnya"
                >
                  ›
                </button>
              </div>
            )}

            <div className="actions">
              <a
                className="btn btn-primary btn-block"
                href={downloadHref}
                onClick={() => announce(`Mengunduh ${label.toLowerCase()}...`)}
              >
                <DownloadIcon />
                <span>
                  {multiple
                    ? `Download ${label} ${slide + 1}`
                    : `Download ${label}`}
                </span>
              </a>

              {multiple && (
                <button
                  type="button"
                  className="btn btn-accent btn-block"
                  onClick={downloadAll}
                  disabled={bulk}
                >
                  <DownloadIcon />
                  <span>
                    {bulk ? "Mengunduh..." : `Download Semua (${items.length})`}
                  </span>
                </button>
              )}
            </div>

            {notice && (
              <div className="alert" role="status" style={alertSpacing}>
                <span className="alert-icon">i</span>
                <div>
                  <strong>{notice}</strong>
                  <p>
                    Unduhan diserahkan ke browser. Pantau di notifikasi
                    unduhan Chrome atau menu ⋮ lalu Unduhan.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="card info">
            <div className="profile">
              {data.author.avatar && !avatarFailed ? (
                <SmartImage
                  key={data.author.avatar}
                  className="avatar"
                  direct={data.author.avatarDirect}
                  proxy={data.author.avatar}
                  alt={displayName}
                  onFail={() => setAvatarFailed(true)}
                  onEarlyFail={refreshOnce}
                />
              ) : (
                <span className="avatar avatar-fallback">
                  {displayName[0].toUpperCase()}
                </span>
              )}

              <div className="profile-text">
                <strong>
                  <span className="name">{displayName}</span>
                  {data.author.verified && <VerifiedIcon />}
                </strong>
                {username && <span>@{username}</span>}
              </div>

              {data.profileUrl && (
                <a
                  className="btn btn-outline"
                  href={data.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalIcon />
                  <span>Kunjungi</span>
                </a>
              )}
            </div>

            {statList.length > 0 && (
              <div className={`stats stats-${statList.length}`}>
                {statList.map((stat) => (
                  <div className="stat" key={stat.key}>
                    <div className="stat-top">
                      {stat.icon}
                      <strong>{formatCount(stat.value)}</strong>
                    </div>
                    <span>{stat.name}</span>
                  </div>
                ))}
              </div>
            )}

            {caption && (
              <div className="caption">
                <div className="caption-label caption-head">
                  <CaptionIcon />
                  <span>Postingan</span>
                  {date && <span className="caption-date">{date}</span>}
                </div>
                <p>{caption}</p>
              </div>
            )}

            {!caption && date && (
              <div className="caption">
                <div className="caption-label caption-head">
                  <span>Diunggah</span>
                  <span className="caption-date">{date}</span>
                </div>
              </div>
            )}

            {hashtags.length > 0 && (
              <div className="hashtags">
                <div className="caption-label">
                  <span>#Hashtag</span>
                </div>
                <div className="hashtag-list">
                  {hashtags.map((tag) => (
                    <span className="hashtag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <footer className="footer">
        Gunakan hanya untuk konten yang kamu berhak unduh. Hormati karya kreator.
      </footer>
    </main>
  );
}

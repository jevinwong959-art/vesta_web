import { useEffect, useId, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

/** A finite, replayable brand sequence; the authentication form never waits. */
export function LoginBrand() {
  const [sequence, setSequence] = useState(0);
  const [paused, setPaused] = useState(document.hidden);
  const stage = useRef<HTMLElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");
  useEffect(() => {
    const surface = stage.current;
    const object = tilt.current;
    if (!surface || !object) return;
    const motion = matchMedia("(prefers-reduced-motion: no-preference)");
    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    let visible = true;
    let frame = 0;
    let previous = 0;
    let x = 0,
      y = 0,
      targetX = 0,
      targetY = 0;
    const enabled = () =>
      visible && !document.hidden && motion.matches && pointer.matches;
    const paint = () => {
      object.style.setProperty("--prism-rx", `${8 - y * 6}deg`);
      object.style.setProperty("--prism-ry", `${-12 + x * 10}deg`);
      object.style.setProperty("--prism-light", `${330 + x * 180 + y * 60}px`);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      x = y = targetX = targetY = 0;
      paint();
    };
    const tick = (time: number) => {
      frame = 0;
      if (!enabled()) {
        stop();
        return;
      }
      const step =
        1 - Math.exp(-Math.min(previous ? time - previous : 16, 48) / 85);
      previous = time;
      x += (targetX - x) * step;
      y += (targetY - y) * step;
      const settled = Math.abs(targetX - x) + Math.abs(targetY - y) < 0.002;
      if (settled) {
        x = targetX;
        y = targetY;
        previous = 0;
      }
      paint();
      if (!settled) frame = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (!frame && enabled()) frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      if (!enabled() || event.pointerType !== "mouse") return;
      const rect = surface.getBoundingClientRect();
      targetX = Math.max(
        -1,
        Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1),
      );
      targetY = Math.max(
        -1,
        Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
      schedule();
    };
    const leave = () => {
      targetX = targetY = 0;
      schedule();
    };
    const onVisibility = () => {
      setPaused(document.hidden || !visible);
      if (!enabled()) stop();
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            onVisibility();
          });
    observer?.observe(surface);
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerleave", leave);
    motion.addEventListener("change", onVisibility);
    pointer.addEventListener("change", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      observer?.disconnect();
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerleave", leave);
      motion.removeEventListener("change", onVisibility);
      pointer.removeEventListener("change", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return (
    <section ref={stage} className="login-brand-stage" aria-label="VESTA">
      <div ref={tilt} className="brand-tilt">
        <svg
          key={sequence}
          className="login-brand-art"
          data-paused={paused}
          viewBox="0 0 640 620"
          role="img"
          aria-label="VESTA"
        >
          <defs>
            <linearGradient
              id={`${id}-left`}
              x1="94"
              y1="100"
              x2="340"
              y2="450"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6998ff" />
              <stop offset="0.28" stopColor="#2855d9" />
              <stop offset="1" stopColor="#142d80" />
            </linearGradient>
            <linearGradient
              id={`${id}-right`}
              x1="425"
              y1="90"
              x2="290"
              y2="450"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#c0d9ff" />
              <stop offset="0.24" stopColor="#7ba6ff" />
              <stop offset="0.64" stopColor="#3869e4" />
              <stop offset="1" stopColor="#2045b2" />
            </linearGradient>
            <linearGradient
              id={`${id}-fold`}
              x1="263"
              y1="310"
              x2="365"
              y2="445"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#a1c6ff" />
              <stop offset="0.48" stopColor="#5a8bf2" />
              <stop offset="1" stopColor="#2449b2" />
            </linearGradient>
            <linearGradient
              id={`${id}-side`}
              x1="320"
              y1="460"
              x2="556"
              y2="110"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#0d2159" />
              <stop offset="0.5" stopColor="#2449a4" />
              <stop offset="1" stopColor="#799de6" />
            </linearGradient>
            <linearGradient id={`${id}-light`}>
              <stop stopColor="#e7f4ff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#e7f4ff" stopOpacity="0.45" />
              <stop offset="1" stopColor="#e7f4ff" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}-clip`}>
              <path d="M94 100H209L320 276 431 100H546L320 458Z" />
            </clipPath>
          </defs>
          <g className="brand-prism">
            <g className="brand-depth">
              <path fill="#162c64" d="M94 100 110 122 336 480 320 458Z" />
              <path
                fill={`url(#${id}-side)`}
                d="M546 100 562 122 336 480 320 458Z"
              />
              <path fill="#7799e2" d="M209 100 225 122 320 276Z" />
            </g>
            <path
              className="brand-wing brand-wing-left"
              fill={`url(#${id}-left)`}
              d="M94 100H209L376 368 320 458Z"
            />
            <path
              className="brand-wing brand-wing-right"
              fill={`url(#${id}-right)`}
              d="M431 100H546L320 458 263 367Z"
            />
            <path
              className="brand-fold"
              fill={`url(#${id}-fold)`}
              d="M320 276 376 368 320 458 263 367Z"
            />
            <g clipPath={`url(#${id}-clip)`}>
              <rect
                className="brand-reflection"
                x="-90"
                y="60"
                width="180"
                height="450"
                fill={`url(#${id}-light)`}
              />
            </g>
            <path
              className="brand-bevel"
              d="M99 103H207L320 282 433 103H540M320 282 267 367 320 451"
            />
            <path
              className="brand-edge"
              pathLength="1"
              d="M94 100H209L320 276 431 100H546L320 458Z"
            />
            <path
              className="brand-edge-light"
              pathLength="1"
              d="M94 100H209L320 276 431 100H546L320 458Z"
            />
          </g>
          <g
            className="brand-wordmark"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinejoin="miter"
          >
            <path pathLength="1" d="m168 535 24 48 24-48" />
            <path pathLength="1" d="M278 535H238V583H278M238 559H272" />
            <path
              pathLength="1"
              d="M340 535H306L298 543V551L306 559H330L338 567V575L330 583H296"
            />
            <path pathLength="1" d="M358 535H408M383 535V583" />
            <path pathLength="1" d="m424 583 24-48 24 48M434 564H462" />
          </g>
        </svg>
      </div>
      <button
        className="brand-replay"
        type="button"
        aria-label="重播 VESTA 动画"
        onClick={() => setSequence((value) => value + 1)}
      >
        <RotateCcw size={17} aria-hidden="true" />
      </button>
    </section>
  );
}

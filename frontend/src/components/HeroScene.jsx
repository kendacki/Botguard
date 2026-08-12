import { motion } from "framer-motion";

const PURPLE = "#8A3FFC";
const PURPLE_SOFT = "#A78BFA";

const nodes = [
  { id: "a", x: 0, y: -78 },
  { id: "b", x: 42, y: -58 },
  { id: "c", x: 72, y: -28 },
  { id: "d", x: 82, y: 12 },
  { id: "e", x: 58, y: 48 },
  { id: "f", x: 18, y: 72 },
  { id: "g", x: -28, y: 70 },
  { id: "h", x: -64, y: 42 },
  { id: "i", x: -80, y: 2 },
  { id: "j", x: -68, y: -36 },
  { id: "k", x: -34, y: -64 },
  { id: "l", x: 12, y: -22 },
  { id: "m", x: -16, y: 8 },
  { id: "n", x: 34, y: 22 },
  { id: "o", x: -40, y: 28 },
];

const links = [
  ["a", "b"],
  ["b", "c"],
  ["c", "d"],
  ["d", "e"],
  ["e", "f"],
  ["f", "g"],
  ["g", "h"],
  ["h", "i"],
  ["i", "j"],
  ["j", "k"],
  ["k", "a"],
  ["a", "l"],
  ["l", "n"],
  ["n", "e"],
  ["l", "m"],
  ["m", "o"],
  ["o", "g"],
  ["m", "i"],
  ["b", "l"],
  ["c", "n"],
  ["j", "m"],
  ["d", "n"],
  ["h", "o"],
];

const map = Object.fromEntries(nodes.map((n) => [n.id, n]));

const orbitDots = (count, radius, start = 0) =>
  Array.from({ length: count }, (_, i) => {
    const deg = start + (360 / count) * i;
    const rad = (deg * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
      r: i % 3 === 0 ? 2.2 : 1.4,
    };
  });

function Spin({ children, dur, reverse = false }) {
  return (
    <g>
      {children}
      <animateTransform
        attributeName="transform"
        type="rotate"
        from={reverse ? "360 0 0" : "0 0 0"}
        to={reverse ? "0 0 0" : "360 0 0"}
        dur={dur}
        repeatCount="indefinite"
      />
    </g>
  );
}

function Signal({ from, to, delay }) {
  const a = map[from];
  const b = map[to];
  return (
    <circle r="2" fill={PURPLE} opacity="0">
      <animate
        attributeName="cx"
        values={`${a.x};${b.x}`}
        dur="2.2s"
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
      <animate
        attributeName="cy"
        values={`${a.y};${b.y}`}
        dur="2.2s"
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="0;1;1;0"
        keyTimes="0;0.12;0.8;1"
        dur="2.2s"
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
    </circle>
  );
}

export default function HeroScene() {
  const ringA = orbitDots(8, 118, 12);
  const ringB = orbitDots(10, 136, 8);
  const ringC = orbitDots(6, 152, 28);

  return (
    <motion.div
      className="relative mx-auto aspect-square w-full"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      <svg viewBox="-170 -170 340 340" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id="globeFill" cx="34%" cy="28%" r="68%">
            <stop offset="0%" stopColor="rgba(167,139,250,0.4)" />
            <stop offset="40%" stopColor="rgba(138,63,252,0.18)" />
            <stop offset="78%" stopColor="rgba(138,63,252,0.06)" />
            <stop offset="100%" stopColor="rgba(247,246,243,0.94)" />
          </radialGradient>
          <linearGradient id="globeRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={PURPLE_SOFT} stopOpacity="0.9" />
            <stop offset="100%" stopColor={PURPLE} stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="arcStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={PURPLE} stopOpacity="0" />
            <stop offset="50%" stopColor={PURPLE_SOFT} stopOpacity="1" />
            <stop offset="100%" stopColor={PURPLE} stopOpacity="0" />
          </linearGradient>
          <clipPath id="globeClip">
            <circle cx="0" cy="0" r="98" />
          </clipPath>
          <linearGradient id="horizonFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="50%" stopColor="#F7F6F3" stopOpacity="0" />
            <stop offset="100%" stopColor="#F7F6F3" stopOpacity="0.65" />
          </linearGradient>
        </defs>

        <Spin dur="55s" reverse>
          <circle
            cx="0"
            cy="0"
            r="152"
            fill="none"
            stroke="rgba(138,63,252,0.14)"
            strokeWidth="0.8"
            strokeDasharray="1.5 14"
          />
          {ringC.map((d, i) => (
            <circle key={`c-${i}`} cx={d.x} cy={d.y} r={d.r} fill={PURPLE} opacity="0.5" />
          ))}
        </Spin>

        <Spin dur="36s">
          <circle
            cx="0"
            cy="0"
            r="136"
            fill="none"
            stroke="rgba(138,63,252,0.2)"
            strokeWidth="1"
            strokeDasharray="3 9"
          />
          {ringB.map((d, i) => (
            <circle key={`b-${i}`} cx={d.x} cy={d.y} r={d.r} fill={PURPLE} />
          ))}
        </Spin>

        <Spin dur="22s" reverse>
          <circle
            cx="0"
            cy="0"
            r="118"
            fill="none"
            stroke="rgba(167,139,250,0.28)"
            strokeWidth="1.1"
          />
          {ringA.map((d, i) => (
            <circle
              key={`a-${i}`}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill={i % 2 ? PURPLE_SOFT : PURPLE}
            />
          ))}
        </Spin>

        <Spin dur="13s">
          <circle
            cx="0"
            cy="0"
            r="124"
            fill="none"
            stroke="url(#arcStroke)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="68 720"
          />
        </Spin>

        <Spin dur="18s" reverse>
          <circle
            cx="0"
            cy="0"
            r="108"
            fill="none"
            stroke="url(#arcStroke)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="40 640"
            opacity="0.85"
          />
        </Spin>

        {/* Perfect sphere shell */}
        <circle cx="0" cy="0" r="98" fill="url(#globeFill)" stroke="url(#globeRim)" strokeWidth="1.6" />
        <circle cx="0" cy="0" r="98" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.55" />

        <Spin dur="30s">
          <g clipPath="url(#globeClip)">
            {[-70, -45, -20, 0, 20, 45, 70].map((lat) => {
              const cy = Math.sin((lat * Math.PI) / 180) * 98;
              const rx = Math.cos((lat * Math.PI) / 180) * 98;
              return (
                <ellipse
                  key={`lat-${lat}`}
                  cx="0"
                  cy={cy}
                  rx={Math.max(8, Math.abs(rx))}
                  ry={Math.max(5, Math.abs(rx) * 0.16)}
                  fill="none"
                  stroke="rgba(138,63,252,0.16)"
                  strokeWidth="0.65"
                />
              );
            })}

            {[0, 22, 45, 67, 90, 112, 135, 157].map((lon) => (
              <ellipse
                key={`lon-${lon}`}
                cx="0"
                cy="0"
                rx={10 + Math.abs(Math.cos((lon * Math.PI) / 180)) * 88}
                ry="98"
                fill="none"
                stroke="rgba(138,63,252,0.12)"
                strokeWidth="0.6"
                transform={`rotate(${lon})`}
              />
            ))}

            {links.map(([from, to]) => {
              const a = map[from];
              const b = map[to];
              return (
                <line
                  key={`${from}-${to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgba(138,63,252,0.36)"
                  strokeWidth="0.85"
                  strokeLinecap="round"
                />
              );
            })}

            <Signal from="a" to="e" delay={0.2} />
            <Signal from="c" to="g" delay={1.1} />
            <Signal from="i" to="d" delay={1.9} />
            <Signal from="k" to="n" delay={0.7} />
            <Signal from="m" to="f" delay={2.5} />

            {nodes.map((n) => (
              <circle key={n.id} cx={n.x} cy={n.y} r="2.3" fill={PURPLE} />
            ))}
          </g>
        </Spin>

        <circle cx="0" cy="0" r="98" fill="none" stroke="rgba(138,63,252,0.32)" strokeWidth="1" />
        <rect x="-170" y="24" width="340" height="146" fill="url(#horizonFade)" />
      </svg>
    </motion.div>
  );
}

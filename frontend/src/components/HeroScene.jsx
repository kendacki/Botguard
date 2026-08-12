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
    return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius, r: i % 3 === 0 ? 2.4 : 1.5 };
  });

function Signal({ from, to, delay }) {
  const a = map[from];
  const b = map[to];
  return (
    <circle r="2.1" fill={PURPLE_SOFT} opacity="0" filter="url(#softGlow)">
      <animate
        attributeName="cx"
        values={`${a.x};${b.x}`}
        dur="2.4s"
        begin={`${delay}s`}
        repeatCount="indefinite"
        calcMode="spline"
        keySplines="0.42 0 0.58 1"
      />
      <animate
        attributeName="cy"
        values={`${a.y};${b.y}`}
        dur="2.4s"
        begin={`${delay}s`}
        repeatCount="indefinite"
        calcMode="spline"
        keySplines="0.42 0 0.58 1"
      />
      <animate
        attributeName="opacity"
        values="0;1;1;0"
        keyTimes="0;0.15;0.75;1"
        dur="2.4s"
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
    </circle>
  );
}

export default function HeroScene() {
  const ringA = orbitDots(8, 118, 12);
  const ringB = orbitDots(12, 136, 0);
  const ringC = orbitDots(6, 152, 28);

  return (
    <motion.div
      className="relative mx-auto aspect-square w-full"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      {/* Ambient blooms */}
      <motion.div
        className="pointer-events-none absolute inset-[8%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(138,63,252,0.38) 0%, rgba(138,63,252,0.12) 38%, transparent 68%)",
          filter: "blur(28px)",
        }}
        animate={{ opacity: [0.55, 0.9, 0.55], scale: [0.96, 1.04, 0.96] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[18%] h-[42%] w-[42%] -translate-x-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.55), transparent 70%)",
          filter: "blur(18px)",
        }}
      />

      <svg viewBox="-170 -170 340 340" className="relative h-full w-full overflow-visible">
        <defs>
          <radialGradient id="globeFill" cx="34%" cy="26%" r="70%">
            <stop offset="0%" stopColor="rgba(167,139,250,0.45)" />
            <stop offset="35%" stopColor="rgba(138,63,252,0.22)" />
            <stop offset="72%" stopColor="rgba(138,63,252,0.08)" />
            <stop offset="100%" stopColor="rgba(247,246,243,0.92)" />
          </radialGradient>
          <linearGradient id="globeRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={PURPLE_SOFT} stopOpacity="0.95" />
            <stop offset="55%" stopColor={PURPLE} stopOpacity="0.55" />
            <stop offset="100%" stopColor={PURPLE} stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="arcStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={PURPLE} stopOpacity="0" />
            <stop offset="45%" stopColor={PURPLE_SOFT} stopOpacity="0.95" />
            <stop offset="100%" stopColor={PURPLE} stopOpacity="0" />
          </linearGradient>
          <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="globeClip">
            <circle cx="0" cy="0" r="98" />
          </clipPath>
        </defs>

        {/* Slow outer atmosphere rings */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 58, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "0px 0px" }}
        >
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
            <circle key={`c-${i}`} cx={d.x} cy={d.y} r={d.r} fill={PURPLE} opacity="0.55" />
          ))}
        </motion.g>

        <motion.g
          animate={{ rotate: -360 }}
          transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "0px 0px" }}
        >
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
            <g key={`b-${i}`}>
              <circle cx={d.x} cy={d.y} r={d.r + 2.5} fill="rgba(138,63,252,0.12)" />
              <circle cx={d.x} cy={d.y} r={d.r} fill={PURPLE} />
            </g>
          ))}
        </motion.g>

        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "0px 0px" }}
        >
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
              filter="url(#softGlow)"
            />
          ))}
        </motion.g>

        {/* Sweeping accent arcs */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "0px 0px" }}
        >
          <motion.circle
            cx="0"
            cy="0"
            r="124"
            fill="none"
            stroke="url(#arcStroke)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="70 710"
            filter="url(#softGlow)"
          />
        </motion.g>
        <motion.g
          animate={{ rotate: -360 }}
          transition={{ duration: 19, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "0px 0px" }}
        >
          <circle
            cx="0"
            cy="0"
            r="108"
            fill="none"
            stroke="url(#arcStroke)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="42 640"
            opacity="0.85"
          />
        </motion.g>

        {/* Globe body */}
        <circle cx="0" cy="0" r="98" fill="url(#globeFill)" stroke="url(#globeRim)" strokeWidth="1.7" />
        <circle cx="0" cy="0" r="98" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />

        {/* Wireframe + network */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "0px 0px" }}
        >
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
                  stroke="rgba(138,63,252,0.18)"
                  strokeWidth="0.7"
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
                stroke="rgba(138,63,252,0.14)"
                strokeWidth="0.65"
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
                  stroke="rgba(138,63,252,0.38)"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />
              );
            })}

            <Signal from="a" to="e" delay={0.2} />
            <Signal from="c" to="g" delay={1.1} />
            <Signal from="i" to="d" delay={1.9} />
            <Signal from="k" to="n" delay={0.7} />
            <Signal from="m" to="f" delay={2.5} />

            {nodes.map((n, i) => (
              <g key={n.id} filter="url(#softGlow)">
                <circle cx={n.x} cy={n.y} r="7" fill="rgba(138,63,252,0.12)">
                  <animate
                    attributeName="r"
                    values="5;10;5"
                    dur="2.6s"
                    begin={`${i * 0.12}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.25;0.75;0.25"
                    dur="2.6s"
                    begin={`${i * 0.12}s`}
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx={n.x} cy={n.y} r="2.5" fill={PURPLE} />
                <circle cx={n.x - 0.6} cy={n.y - 0.6} r="0.7" fill="rgba(255,255,255,0.7)" />
              </g>
            ))}
          </g>
        </motion.g>

        {/* Specular + rim light */}
        <ellipse cx="-36" cy="-42" rx="30" ry="18" fill="rgba(255,255,255,0.48)" />
        <circle cx="0" cy="0" r="98" fill="none" stroke="rgba(138,63,252,0.35)" strokeWidth="1.1" />

        {/* Soft horizon fade for half-crop look */}
        <defs>
          <linearGradient id="horizonFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="55%" stopColor="#F7F6F3" stopOpacity="0" />
            <stop offset="100%" stopColor="#F7F6F3" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect x="-170" y="20" width="340" height="150" fill="url(#horizonFade)" />
      </svg>
    </motion.div>
  );
}

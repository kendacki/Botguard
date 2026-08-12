import { motion } from "framer-motion";

const PURPLE = "#8A3FFC";

const nodes = [
  { id: "a", x: 0, y: -72 },
  { id: "b", x: 58, y: -38 },
  { id: "c", x: 78, y: 8 },
  { id: "d", x: 48, y: 52 },
  { id: "e", x: -8, y: 70 },
  { id: "f", x: -62, y: 36 },
  { id: "g", x: -76, y: -12 },
  { id: "h", x: -42, y: -54 },
  { id: "i", x: 18, y: -18 },
  { id: "j", x: -22, y: 22 },
  { id: "k", x: 36, y: 18 },
];

const links = [
  ["a", "b"],
  ["b", "c"],
  ["c", "d"],
  ["d", "e"],
  ["e", "f"],
  ["f", "g"],
  ["g", "h"],
  ["h", "a"],
  ["a", "i"],
  ["i", "k"],
  ["k", "d"],
  ["i", "j"],
  ["j", "f"],
  ["j", "e"],
  ["b", "k"],
  ["g", "j"],
];

const map = Object.fromEntries(nodes.map((n) => [n.id, n]));

export default function HeroScene() {
  return (
    <motion.div
      className="relative mx-auto aspect-square w-full max-w-[440px]"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      <div
        className="pointer-events-none absolute inset-[10%] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(138,63,252,0.32) 0%, rgba(138,63,252,0.1) 42%, transparent 70%)",
        }}
      />

      <svg viewBox="-150 -150 300 300" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id="globeFill" cx="32%" cy="28%" r="68%">
            <stop offset="0%" stopColor="rgba(138,63,252,0.28)" />
            <stop offset="50%" stopColor="rgba(138,63,252,0.1)" />
            <stop offset="100%" stopColor="rgba(250,249,252,0.95)" />
          </radialGradient>
          <linearGradient id="globeRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={PURPLE} stopOpacity="0.65" />
            <stop offset="100%" stopColor={PURPLE} stopOpacity="0.25" />
          </linearGradient>
          <clipPath id="globeClip">
            <circle cx="0" cy="0" r="96" />
          </clipPath>
        </defs>

        {/* Outer orbit */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 42, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "0px 0px" }}
        >
          <circle
            cx="0"
            cy="0"
            r="128"
            fill="none"
            stroke="rgba(138,63,252,0.22)"
            strokeWidth="1"
            strokeDasharray="2 10"
          />
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <circle
                key={`orbit-${deg}`}
                cx={Math.cos(rad) * 128}
                cy={Math.sin(rad) * 128}
                r="2.2"
                fill={PURPLE}
              />
            );
          })}
        </motion.g>

        {/* Counter-orbit of tiny satellite dots */}
        <motion.g
          animate={{ rotate: -360 }}
          transition={{ duration: 56, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "0px 0px" }}
        >
          <circle
            cx="0"
            cy="0"
            r="142"
            fill="none"
            stroke="rgba(138,63,252,0.12)"
            strokeWidth="0.8"
          />
          {[30, 100, 170, 250, 320].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <circle
                key={`sat-${deg}`}
                cx={Math.cos(rad) * 142}
                cy={Math.sin(rad) * 142}
                r="1.5"
                fill={PURPLE}
                opacity="0.7"
              />
            );
          })}
        </motion.g>

        {/* Globe shell */}
        <circle cx="0" cy="0" r="96" fill="url(#globeFill)" stroke="url(#globeRim)" strokeWidth="1.5" />

        {/* Revolving mesh + network */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "0px 0px" }}
        >
          <g clipPath="url(#globeClip)">
            {[-60, -30, 0, 30, 60].map((lat) => {
              const cy = Math.sin((lat * Math.PI) / 180) * 96;
              const rx = Math.cos((lat * Math.PI) / 180) * 96;
              return (
                <ellipse
                  key={`lat-${lat}`}
                  cx="0"
                  cy={cy}
                  rx={Math.max(10, Math.abs(rx))}
                  ry={Math.max(6, Math.abs(rx) * 0.18)}
                  fill="none"
                  stroke="rgba(138,63,252,0.2)"
                  strokeWidth="0.85"
                />
              );
            })}

            {[0, 30, 60, 90, 120, 150].map((lon) => (
              <ellipse
                key={`lon-${lon}`}
                cx="0"
                cy="0"
                rx={14 + Math.abs(Math.cos((lon * Math.PI) / 180)) * 82}
                ry="96"
                fill="none"
                stroke="rgba(138,63,252,0.18)"
                strokeWidth="0.8"
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
                  stroke="rgba(138,63,252,0.42)"
                  strokeWidth="0.95"
                  strokeLinecap="round"
                />
              );
            })}

            {nodes.map((n, i) => (
              <g key={n.id}>
                <motion.circle
                  cx={n.x}
                  cy={n.y}
                  r="6"
                  fill="rgba(138,63,252,0.14)"
                  animate={{ r: [4.5, 8, 4.5], opacity: [0.4, 0.85, 0.4] }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    delay: i * 0.16,
                    ease: "easeInOut",
                  }}
                />
                <circle cx={n.x} cy={n.y} r="2.3" fill={PURPLE} />
              </g>
            ))}
          </g>
        </motion.g>

        <ellipse cx="-34" cy="-40" rx="26" ry="16" fill="rgba(255,255,255,0.42)" />
        <circle cx="0" cy="0" r="96" fill="none" stroke="rgba(138,63,252,0.3)" strokeWidth="1" />
      </svg>
    </motion.div>
  );
}

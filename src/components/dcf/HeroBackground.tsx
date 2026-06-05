// Decorative landing-page backdrop: Carta's isometric icons slowly drifting on
// a black field with warm orange glows. Purely cosmetic (aria-hidden), pointer
// events disabled, and motion is removed for users who prefer reduced motion.

type Drift = "heroDriftA" | "heroDriftB" | "heroDriftC" | "heroFloat";

interface Floater {
  src: string;
  top: string;
  left: string;
  size: number;
  opacity: number;
  anim: Drift;
  dur: number; // seconds
  delay: number; // seconds (negative = start mid-cycle)
}

const ICONS: Floater[] = [
  { src: "/icons/insight.svg", top: "8%", left: "6%", size: 124, opacity: 0.3, anim: "heroDriftA", dur: 26, delay: -3 },
  { src: "/icons/automation.svg", top: "14%", left: "82%", size: 150, opacity: 0.26, anim: "heroDriftB", dur: 32, delay: -9 },
  { src: "/icons/multitask.svg", top: "62%", left: "3%", size: 140, opacity: 0.24, anim: "heroDriftC", dur: 30, delay: -14 },
  { src: "/icons/automation.svg", top: "70%", left: "88%", size: 120, opacity: 0.28, anim: "heroFloat", dur: 22, delay: -5 },
  { src: "/icons/multitask.svg", top: "30%", left: "44%", size: 96, opacity: 0.12, anim: "heroDriftB", dur: 38, delay: -18 },
  { src: "/icons/insight.svg", top: "78%", left: "52%", size: 88, opacity: 0.16, anim: "heroDriftA", dur: 34, delay: -7 },
  { src: "/icons/automation.svg", top: "4%", left: "40%", size: 80, opacity: 0.14, anim: "heroFloat", dur: 28, delay: -11 },
  { src: "/icons/insight.svg", top: "46%", left: "92%", size: 76, opacity: 0.18, anim: "heroDriftC", dur: 36, delay: -2 },
  { src: "/icons/multitask.svg", top: "88%", left: "24%", size: 70, opacity: 0.14, anim: "heroDriftA", dur: 40, delay: -20 },
  { src: "/icons/automation.svg", top: "40%", left: "16%", size: 64, opacity: 0.12, anim: "heroDriftB", dur: 30, delay: -15 },
  { src: "/icons/insight.svg", top: "20%", left: "66%", size: 60, opacity: 0.12, anim: "heroFloat", dur: 26, delay: -6 },
];

export function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* warm orange glows over the black field */}
      <div
        className="absolute left-1/2 top-[-12%] h-[560px] w-[860px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(238,131,95,0.28), transparent)", filter: "blur(48px)" }}
      />
      <div
        className="absolute bottom-[-18%] right-[-8%] h-[520px] w-[680px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(238,131,95,0.16), transparent)", filter: "blur(48px)" }}
      />
      <div
        className="absolute bottom-[-10%] left-[-10%] h-[440px] w-[560px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.05), transparent)", filter: "blur(48px)" }}
      />

      {ICONS.map((ic, i) => (
        <img
          key={i}
          src={ic.src}
          alt=""
          className="hero-icon absolute"
          style={{
            top: ic.top,
            left: ic.left,
            width: ic.size,
            opacity: ic.opacity,
            animation: `${ic.anim} ${ic.dur}s ease-in-out infinite`,
            animationDelay: `${ic.delay}s`,
          }}
        />
      ))}

      {/* gentle vignette to anchor the centred content */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)" }}
      />
    </div>
  );
}

import { useRef, useEffect } from 'react'

interface Props {
  isSpeaking: boolean
  wordBoundaryCount: number
  currentWordLength: number
}

// SVG viewport — 1000 wide so wave points are high-resolution;
// the SVG scales to fill its container via width="100%".
const VB_W = 1000
const VB_H = 64
const CY   = VB_H / 2

// Three wave layers rendered back-to-front.
// bg  → wide stroke, very faint → creates the bloom/glow cloud
// mid → medium stroke, partial opacity
// fg  → thin stroke, nearly opaque → crisp bright signal line
const LAYERS = [
  { freq: 1.8, speedMul: 0.79, idleAmp: 3,  peakAmp: 11, strokeW: 9,   cls: 'ewf-layer--bg'  },
  { freq: 3.2, speedMul: 1.13, idleAmp: 4,  peakAmp: 17, strokeW: 3,   cls: 'ewf-layer--mid' },
  { freq: 2.5, speedMul: 1.00, idleAmp: 5,  peakAmp: 26, strokeW: 1.5, cls: 'ewf-layer--fg'  },
] as const

// Energy decays at 3.5× per second — halves in ~200 ms, matching natural
// speech word cadence so bars visibly pulse between word boundaries.
const DECAY = 3.5

function buildPath(amp: number, freq: number, phase: number): string {
  const N = 160
  const parts: string[] = []
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * VB_W
    const y = CY + amp * Math.sin(2 * Math.PI * freq * (i / N) + phase)
    parts.push(i === 0 ? `M${x.toFixed(1)},${y.toFixed(2)}` : `L${x.toFixed(1)},${y.toFixed(2)}`)
  }
  return parts.join(' ')
}

export default function EchoWaveform({ isSpeaking, wordBoundaryCount, currentWordLength }: Props) {
  // Refs let the rAF loop mutate SVG paths without triggering React re-renders.
  const bgRef  = useRef<SVGPathElement>(null)
  const midRef = useRef<SVGPathElement>(null)
  const fgRef  = useRef<SVGPathElement>(null)

  const rafRef    = useRef(0)
  const prevTsRef = useRef<number | null>(null)
  // Staggered initial phases so layers don't start in phase-lock.
  const phaseRef  = useRef<[number, number, number]>([0, Math.PI * 0.42, Math.PI * 0.88])
  const energyRef = useRef(0)

  // Word boundary → amplitude spike scaled by word length.
  // "I" (1 char) → ~0.49 energy. "extraordinary" (14 chars) → 1.0 energy.
  useEffect(() => {
    if (!isSpeaking || wordBoundaryCount === 0) return
    const spike = 0.45 + Math.min(currentWordLength / 14, 1) * 0.55
    energyRef.current = Math.max(energyRef.current, spike)
  }, [wordBoundaryCount, isSpeaking, currentWordLength])

  // Immediate kick when speech starts so bars react before the first
  // boundary event (which can lag 100–300 ms after utterance begins).
  useEffect(() => {
    if (isSpeaking) energyRef.current = Math.max(energyRef.current, 0.55)
  }, [isSpeaking])

  // Permanent rAF loop — drives idle drift and speaking animation.
  // Runs at ~60 fps but never causes React re-renders; only updates
  // the SVG `d` attribute directly on the DOM nodes.
  useEffect(() => {
    const refs = [bgRef, midRef, fgRef]

    const loop = (ts: number) => {
      const dt = prevTsRef.current !== null ? (ts - prevTsRef.current) / 1000 : 0.016
      prevTsRef.current = ts

      energyRef.current = Math.max(0, energyRef.current - dt * DECAY)
      const e = energyRef.current

      // Phase speed: gentle idle drift, accelerates with energy when speaking.
      const speed = 0.35 + e * 1.8

      LAYERS.forEach((cfg, i) => {
        phaseRef.current[i] += dt * speed * cfg.speedMul
        const amp = cfg.idleAmp + e * (cfg.peakAmp - cfg.idleAmp)
        refs[i].current?.setAttribute('d', buildPath(amp, cfg.freq, phaseRef.current[i]))
      })

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      prevTsRef.current = null
    }
  }, [])

  return (
    <div
      className={`echo-waveform${isSpeaking ? ' echo-waveform--active' : ''}`}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height={VB_H}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
      >
        <defs>
          {/* Fade the wave to transparent at both edges — premium "display panel" feel */}
          <linearGradient
            id="ewf-edge-fade"
            x1="0" y1="0" x2={VB_W} y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0"    stopColor="white" stopOpacity="0" />
            <stop offset="0.06" stopColor="white" stopOpacity="1" />
            <stop offset="0.94" stopColor="white" stopOpacity="1" />
            <stop offset="1"    stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="ewf-fade-mask">
            <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#ewf-edge-fade)" />
          </mask>
        </defs>

        <g mask="url(#ewf-fade-mask)">
          <path ref={bgRef}  className="ewf-layer ewf-layer--bg"  fill="none" strokeWidth={LAYERS[0].strokeW} vectorEffect="non-scaling-stroke" />
          <path ref={midRef} className="ewf-layer ewf-layer--mid" fill="none" strokeWidth={LAYERS[1].strokeW} vectorEffect="non-scaling-stroke" />
          <path ref={fgRef}  className="ewf-layer ewf-layer--fg"  fill="none" strokeWidth={LAYERS[2].strokeW} vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
    </div>
  )
}

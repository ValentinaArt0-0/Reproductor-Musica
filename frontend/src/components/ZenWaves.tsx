import { useEffect, useRef } from "react";
import { INK, mix, rgba, type Palette, type Rgb } from "../lib/palette";

interface ZenWavesProps {
  /** Real audio analysis. When null, a gentle simulated motion is used while playing. */
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  palette: Palette;
  /** False = draw a single still frame (reduced motion). */
  animate: boolean;
}

/** Three layered lines: bass, mids and highs each drive one of them. */
const LAYERS = [
  { frequency: 1.1, speed: 0.55, phase: 0, opacity: 0.8, width: 2.4 },
  { frequency: 1.7, speed: 0.38, phase: 2.1, opacity: 0.55, width: 2 },
  { frequency: 2.5, speed: 0.27, phase: 4.2, opacity: 0.38, width: 1.6 },
] as const;

/**
 * Minimal canvas waves. Amplitude follows the music (frequency bands of the analyser) and
 * relaxes into a slow "breathing" line when the music is paused. Colors glide toward the
 * current album palette instead of jumping.
 */
export function ZenWaves({ analyser, isPlaying, palette, animate }: ZenWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Latest props for the animation loop, which must not restart on every change.
  const live = useRef({ analyser, isPlaying, palette });
  useEffect(() => {
    live.current = { analyser, isPlaying, palette };
  }, [analyser, isPlaying, palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    const { primary, secondary, accent } = live.current.palette;
    const colors: Rgb[] = [{ ...primary }, { ...secondary }, { ...accent }];
    const levels = [0, 0, 0];
    const bins = new Uint8Array(1024); // large enough for any analyser size

    const average = (from: number, to: number) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += bins[i];
      return sum / ((to - from) * 255);
    };

    /** Target energy (0..1) for bass, mids and highs. */
    const readEnergy = (seconds: number): [number, number, number] => {
      const { analyser: node, isPlaying: playing } = live.current;
      if (!playing) return [0, 0, 0];
      if (node) {
        node.getByteFrequencyData(bins);
        // Higher bands carry less energy, so they are boosted to move visibly.
        return [
          Math.min(1, average(0, 6) * 1.25),
          Math.min(1, average(6, 30) * 1.6),
          Math.min(1, average(30, 90) * 2.4),
        ];
      }
      return [
        0.45 + 0.25 * Math.sin(seconds * 1.7),
        0.4 + 0.2 * Math.sin(seconds * 2.3 + 1),
        0.3 + 0.15 * Math.sin(seconds * 3.1 + 2),
      ];
    };

    function draw(timeMs: number) {
      if (!context) return;
      const seconds = timeMs / 1000;
      const energy = readEnergy(seconds);
      const target = live.current.palette;
      const targets = [target.primary, target.secondary, target.accent];

      context.clearRect(0, 0, width, height);
      const middle = height * 0.5;

      LAYERS.forEach((layer, i) => {
        levels[i] += (energy[i] - levels[i]) * 0.12;
        const color = colors[i];
        color.r += (targets[i].r - color.r) * 0.04;
        color.g += (targets[i].g - color.g) * 0.04;
        color.b += (targets[i].b - color.b) * 0.04;

        const breathing = 0.022 + 0.01 * Math.sin(seconds * 0.5 + layer.phase);
        const amplitude = height * (breathing + levels[i] * 0.2);

        context.beginPath();
        for (let x = 0; x <= width; x += 4) {
          const position = x / width;
          const envelope = Math.pow(Math.sin(Math.PI * position), 1.4); // calm at the edges
          const wave =
            Math.sin(position * Math.PI * 2 * layer.frequency + seconds * layer.speed * 2 + layer.phase) +
            0.45 * Math.sin(position * Math.PI * 2 * layer.frequency * 2.3 - seconds * layer.speed * 1.4);
          const y = middle + (i - 1) * height * 0.035 + wave * amplitude * envelope;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = rgba(mix(color, INK, 0.25), layer.opacity);
        context.lineWidth = layer.width;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.stroke();
      });
    }

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (!animate) draw(0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    if (animate) {
      const loop = (time: number) => {
        draw(time);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [animate]);

  return <canvas ref={canvasRef} className="size-full" aria-hidden="true" />;
}

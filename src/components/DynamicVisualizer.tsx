/**
 * DynamicVisualizer - Ultra-smooth 60fps audio reactive canvas visualizer.
 * Renders dynamic waveforms, reactive glowing orb, radial equalizer, and particle field
 * driven by live Web Audio API analyser data from both user input and Sameera output.
 * Features subtle, continuous gradient color shifting based on Sameera's predicted emotional state.
 */

import React, { useEffect, useRef } from 'react';
import { AssistantState, EmotionalState, VisualTheme, VisualizerMode } from '../types/assistant';
import { THEMES } from '../utils/themeStyles';
import { EMOTION_PALETTES, lerpRGB, lerpRGBA } from '../utils/emotionAnalyzer';
import { AudioPlayer } from '../services/AudioPlayer';
import { AudioStreamer } from '../services/AudioStreamer';

interface DynamicVisualizerProps {
  state: AssistantState;
  theme: VisualTheme;
  mode: VisualizerMode;
  emotionalState?: EmotionalState;
  audioPlayer: AudioPlayer;
  audioStreamer: AudioStreamer;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  alpha: number;
  color: string;
  angle: number;
  distance: number;
  speed: number;
}

export const DynamicVisualizer: React.FC<DynamicVisualizerProps> = ({
  state,
  theme,
  mode,
  emotionalState = 'neutral',
  audioPlayer,
  audioStreamer,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const phaseRef = useRef<number>(0);

  // Smooth color tweening state across frames
  const currentColorState = useRef<{
    userWave: [number, number, number];
    modelWave: [number, number, number];
    orbCore: [number, number, number];
    orbGlow: [number, number, number, number];
  }>({
    userWave: [56, 189, 248],
    modelWave: [192, 132, 252],
    orbCore: [168, 85, 247],
    orbGlow: [168, 85, 247, 0.45],
  });

  // Initialize particle field
  useEffect(() => {
    const particles: Particle[] = [];
    const count = 50;
    const themeColors = THEMES[theme]?.canvasColors.particles || ['#c084fc', '#38bdf8'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 140;
      const color = themeColors[Math.floor(Math.random() * themeColors.length)];
      particles.push({
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 1 + Math.random() * 2.5,
        baseRadius: 1 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.6,
        color,
        angle,
        distance,
        speed: 0.005 + Math.random() * 0.015,
      });
    }
    particlesRef.current = particles;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const freqData = new Uint8Array(256);
    const timeData = new Uint8Array(256);

    const render = () => {
      phaseRef.current += 0.03;
      const phase = phaseRef.current;

      // 1. Target color palette from predicted emotional state
      const targetPalette = EMOTION_PALETTES[emotionalState] || EMOTION_PALETTES.neutral;

      // 2. Subtle, smooth color interpolation (0.04 per frame = ~1.5s transition time)
      const smoothingSpeed = 0.04;
      currentColorState.current.userWave = lerpRGB(
        currentColorState.current.userWave,
        targetPalette.userWave,
        smoothingSpeed
      );
      currentColorState.current.modelWave = lerpRGB(
        currentColorState.current.modelWave,
        targetPalette.modelWave,
        smoothingSpeed
      );
      currentColorState.current.orbCore = lerpRGB(
        currentColorState.current.orbCore,
        targetPalette.orbCore,
        smoothingSpeed
      );
      currentColorState.current.orbGlow = lerpRGBA(
        currentColorState.current.orbGlow,
        targetPalette.orbGlow,
        smoothingSpeed
      );

      const [uwR, uwG, uwB] = currentColorState.current.userWave;
      const [mwR, mwG, mwB] = currentColorState.current.modelWave;
      const [ocR, ocG, ocB] = currentColorState.current.orbCore;
      const [ogR, ogG, ogB, ogA] = currentColorState.current.orbGlow;

      const dynamicColors = {
        userWave: `rgb(${uwR}, ${uwG}, ${uwB})`,
        modelWave: `rgb(${mwR}, ${mwG}, ${mwB})`,
        orbCore: `rgb(${ocR}, ${ocG}, ${ocB})`,
        orbGlow: `rgba(${ogR}, ${ogG}, ${ogB}, ${ogA})`,
        ring: `rgba(${mwR}, ${mwG}, ${mwB}, 0.35)`,
      };

      // Determine active audio source based on state
      let activeLevel = 0;
      const isModelSpeaking = state === 'speaking';
      const isUserSpeaking = state === 'listening';
      const isThinking = state === 'thinking';

      if (isModelSpeaking) {
        audioPlayer.getFrequencyData(freqData);
        audioPlayer.getTimeDomainData(timeData);
        activeLevel = audioPlayer.getAudioLevel();
      } else if (isUserSpeaking) {
        audioStreamer.getFrequencyData(freqData);
        audioStreamer.getTimeDomainData(timeData);
        activeLevel = audioStreamer.getAudioLevel();
      } else if (isThinking) {
        // Subtle energetic neural harmonic pulse while thinking
        const thinkingPulse = (Math.sin(phase * 3.5) * 0.5 + 0.5) * 0.35 + 0.15;
        activeLevel = thinkingPulse;
        for (let i = 0; i < freqData.length; i++) {
          freqData[i] = Math.round((Math.sin(i * 0.2 + phase * 3) * 0.5 + 0.5) * 130);
          timeData[i] = Math.round(128 + Math.sin(i * 0.15 + phase * 4) * 30);
        }
      } else {
        freqData.fill(0);
        timeData.fill(128);
        activeLevel = 0.05;
      }

      // Smooth idle breathing oscillation if low audio
      const idlePulse = Math.sin(phase * 1.5) * 0.15 + 0.85;
      const effectiveLevel = Math.max(activeLevel, 0.08 * idlePulse);

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.22;

      // Draw depending on visualizer mode using emotional gradient colors
      switch (mode) {
        case 'waveform':
          drawWaveformMode(ctx, width, height, timeData, effectiveLevel, dynamicColors, phase, isModelSpeaking);
          break;
        case 'nebula':
          drawNebulaMode(ctx, centerX, centerY, freqData, effectiveLevel, dynamicColors, phase);
          break;
        case 'frequency-ring':
          drawFrequencyRingMode(ctx, centerX, centerY, baseRadius, freqData, effectiveLevel, dynamicColors, phase);
          break;
        case 'orb':
        default:
          drawOrbMode(
            ctx,
            centerX,
            centerY,
            baseRadius,
            timeData,
            freqData,
            effectiveLevel,
            dynamicColors,
            phase,
            isModelSpeaking,
            isUserSpeaking
          );
          break;
      }

      // Render floating ambient particles
      drawParticles(ctx, centerX, centerY, effectiveLevel, phase, targetPalette.particles);

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    animationFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [state, theme, mode, emotionalState, audioPlayer, audioStreamer]);

  /**
   * Orb Mode: Core pulsing sphere with organic ripples and aura
   */
  const drawOrbMode = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    baseRadius: number,
    timeData: Uint8Array,
    freqData: Uint8Array,
    level: number,
    colors: any,
    phase: number,
    isModel: boolean,
    isUser: boolean
  ) => {
    const currentRadius = baseRadius * (1 + level * 0.45);

    // 1. Outer ambient glow aura with emotional gradient shift
    const auraGradient = ctx.createRadialGradient(
      cx, cy, currentRadius * 0.2,
      cx, cy, currentRadius * 2.8
    );
    auraGradient.addColorStop(0, colors.orbGlow);
    auraGradient.addColorStop(0.5, colors.ring);
    auraGradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.save();
    ctx.fillStyle = auraGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, currentRadius * 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Harmonic radial waveform ripples around the sphere
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isModel ? colors.modelWave : (isUser ? colors.userWave : colors.orbCore);
    ctx.shadowColor = isModel ? colors.modelWave : colors.userWave;
    ctx.shadowBlur = 18;

    const points = 72;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const freqIndex = Math.floor((i / points) * (freqData.length / 3));
      const freqAmp = (freqData[freqIndex] || 0) / 255;
      
      const wave = Math.sin(angle * 6 + phase * 2) * (8 + level * 35 * freqAmp);
      const r = currentRadius + wave;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 3. Counter-rotating orbital harmonic ring
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = colors.ring;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const wave = Math.cos(angle * 4 - phase * 1.5) * (6 + level * 20);
      const r = currentRadius * 1.25 + wave;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 4. Inner glowing sphere with emotional gradient
    const coreGrad = ctx.createRadialGradient(
      cx - currentRadius * 0.3, cy - currentRadius * 0.3, currentRadius * 0.05,
      cx, cy, currentRadius
    );
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.3, colors.orbCore);
    coreGrad.addColorStop(0.8, isModel ? colors.modelWave : colors.userWave);
    coreGrad.addColorStop(1, 'rgba(15, 12, 30, 0.95)');

    ctx.save();
    ctx.shadowColor = colors.orbCore;
    ctx.shadowBlur = 30 + level * 40;
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 5. Plasma highlight flare
    ctx.save();
    const highlightGrad = ctx.createRadialGradient(
      cx, cy, 0,
      cx, cy, currentRadius * 0.6
    );
    highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    highlightGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
    highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, currentRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /**
   * Waveform Mode: Flowing horizontal ribbons weaving across the viewport
   */
  const drawWaveformMode = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeData: Uint8Array,
    level: number,
    colors: any,
    phase: number,
    isModel: boolean
  ) => {
    const centerY = h / 2;
    const waves = [
      { color: isModel ? colors.modelWave : colors.userWave, speed: 1.5, amp: 70, freq: 0.008, alpha: 0.9, blur: 20 },
      { color: colors.orbCore, speed: -1.2, amp: 55, freq: 0.012, alpha: 0.6, blur: 15 },
      { color: colors.ring, speed: 2.0, amp: 40, freq: 0.015, alpha: 0.4, blur: 10 },
    ];

    waves.forEach((wObj, idx) => {
      ctx.save();
      ctx.strokeStyle = wObj.color;
      ctx.lineWidth = 3 - idx * 0.5;
      ctx.globalAlpha = wObj.alpha;
      ctx.shadowColor = wObj.color;
      ctx.shadowBlur = wObj.blur;

      ctx.beginPath();
      const step = 4;
      for (let x = 0; x <= w; x += step) {
        const timeIndex = Math.floor((x / w) * timeData.length);
        const sample = (timeData[timeIndex] - 128) / 128;
        const sineComponent = Math.sin(x * wObj.freq + phase * wObj.speed);
        const y = centerY + (sineComponent * wObj.amp * (0.3 + level * 2.5)) + (sample * 50 * level);

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    });
  };

  /**
   * Frequency Ring Mode: Circular bar equalizer
   */
  const drawFrequencyRingMode = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    freqData: Uint8Array,
    level: number,
    colors: any,
    phase: number
  ) => {
    const bars = 64;
    ctx.save();
    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2 + phase * 0.2;
      const freqIndex = Math.floor((i / bars) * (freqData.length / 2));
      const val = (freqData[freqIndex] || 0) / 255;
      const barHeight = 8 + val * 90 * (0.4 + level * 2);

      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const x2 = cx + Math.cos(angle) * (radius + barHeight);
      const y2 = cy + Math.sin(angle) * (radius + barHeight);

      ctx.strokeStyle = colors.modelWave;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.shadowColor = colors.orbCore;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Inner glowing ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = colors.ring;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  };

  /**
   * Nebula Mode: Cosmic spiral vortex
   */
  const drawNebulaMode = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    freqData: Uint8Array,
    level: number,
    colors: any,
    phase: number
  ) => {
    ctx.save();
    const spiralArms = 4;
    const pointsPerArm = 50;

    for (let arm = 0; arm < spiralArms; arm++) {
      const armOffset = (arm / spiralArms) * Math.PI * 2;
      ctx.beginPath();

      for (let i = 0; i < pointsPerArm; i++) {
        const t = i / pointsPerArm;
        const angle = armOffset + t * 4 * Math.PI + phase * 0.5;
        const freqVal = (freqData[i * 2] || 0) / 255;
        const distance = t * 180 * (1 + level * 0.6) + freqVal * 20;

        const x = cx + Math.cos(angle) * distance;
        const y = cy + Math.sin(angle) * distance;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = arm % 2 === 0 ? colors.userWave : colors.modelWave;
      ctx.lineWidth = 2;
      ctx.shadowColor = colors.orbCore;
      ctx.shadowBlur = 12;
      ctx.stroke();
    }
    ctx.restore();
  };

  /**
   * Orbital Particle System with emotional tint
   */
  const drawParticles = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    level: number,
    phase: number,
    paletteColors: string[]
  ) => {
    const particles = particlesRef.current;
    ctx.save();

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.angle += p.speed * (1 + level * 2);
      const currentDist = p.distance + Math.sin(phase + p.angle) * 15 * (1 + level * 2);
      const px = cx + Math.cos(p.angle) * currentDist;
      const py = cy + Math.sin(p.angle) * currentDist;

      const dynamicRadius = p.baseRadius * (1 + level * 1.2);
      const particleColor = paletteColors[i % paletteColors.length] || p.color;

      ctx.beginPath();
      ctx.arc(px, py, dynamicRadius, 0, Math.PI * 2);
      ctx.fillStyle = particleColor;
      ctx.globalAlpha = p.alpha * (0.6 + level * 0.4);
      ctx.shadowColor = particleColor;
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    ctx.restore();
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};

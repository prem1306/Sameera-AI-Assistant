/**
 * Theme style definitions for Sameera AI Assistant
 */

import { VisualTheme } from '../types/assistant';

export interface ThemeConfig {
  id: VisualTheme;
  name: string;
  subtitle: string;
  bgGradient: string;
  cardBg: string;
  accentColor: string;
  accentBorder: string;
  accentGlow: string;
  // Canvas Colors
  canvasColors: {
    userWave: string;
    modelWave: string;
    orbCore: string;
    orbGlow: string;
    ring: string;
    particles: string[];
  };
}

export const THEMES: Record<VisualTheme, ThemeConfig> = {
  'midnight-violet': {
    id: 'midnight-violet',
    name: 'Midnight Violet',
    subtitle: 'Deep Amethyst & Stellar Aurora',
    bgGradient: 'from-slate-950 via-[#0d0a1a] to-[#150d2a]',
    cardBg: 'bg-indigo-950/30 backdrop-blur-2xl border-indigo-500/20',
    accentColor: 'text-violet-400',
    accentBorder: 'border-violet-500/40',
    accentGlow: 'shadow-[0_0_50px_rgba(139,92,246,0.25)]',
    canvasColors: {
      userWave: '#38bdf8', // sky-400
      modelWave: '#c084fc', // purple-400
      orbCore: '#a855f7', // violet-500
      orbGlow: 'rgba(168, 85, 247, 0.45)',
      ring: 'rgba(192, 132, 252, 0.3)',
      particles: ['#c084fc', '#818cf8', '#38bdf8', '#e879f9'],
    },
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    subtitle: 'High Contrast Cyan & Hot Magenta',
    bgGradient: 'from-[#070b14] via-[#091428] to-[#120a24]',
    cardBg: 'bg-cyan-950/30 backdrop-blur-2xl border-cyan-500/30',
    accentColor: 'text-cyan-400',
    accentBorder: 'border-cyan-500/50',
    accentGlow: 'shadow-[0_0_50px_rgba(6,182,212,0.3)]',
    canvasColors: {
      userWave: '#06b6d4', // cyan-500
      modelWave: '#f43f5e', // rose-500
      orbCore: '#06b6d4',
      orbGlow: 'rgba(244, 63, 94, 0.5)',
      ring: 'rgba(6, 182, 212, 0.4)',
      particles: ['#06b6d4', '#f43f5e', '#a855f7', '#22d3ee'],
    },
  },
  'aurora-emerald': {
    id: 'aurora-emerald',
    name: 'Aurora Emerald',
    subtitle: 'Luminescent Borealis & Deep Mint',
    bgGradient: 'from-slate-950 via-[#041614] to-[#06241f]',
    cardBg: 'bg-emerald-950/30 backdrop-blur-2xl border-emerald-500/20',
    accentColor: 'text-emerald-400',
    accentBorder: 'border-emerald-500/40',
    accentGlow: 'shadow-[0_0_50px_rgba(16,185,129,0.25)]',
    canvasColors: {
      userWave: '#2dd4bf', // teal-400
      modelWave: '#34d399', // emerald-400
      orbCore: '#10b981',
      orbGlow: 'rgba(16, 185, 129, 0.45)',
      ring: 'rgba(52, 211, 153, 0.3)',
      particles: ['#34d399', '#2dd4bf', '#6ee7b7', '#a7f3d0'],
    },
  },
  'crimson-neon': {
    id: 'crimson-neon',
    name: 'Crimson Flame',
    subtitle: 'Ruby Glow & Sunset Coral',
    bgGradient: 'from-slate-950 via-[#180a0e] to-[#250d14]',
    cardBg: 'bg-rose-950/30 backdrop-blur-2xl border-rose-500/20',
    accentColor: 'text-rose-400',
    accentBorder: 'border-rose-500/40',
    accentGlow: 'shadow-[0_0_50px_rgba(244,63,94,0.25)]',
    canvasColors: {
      userWave: '#fb923c', // orange-400
      modelWave: '#fb7185', // rose-400
      orbCore: '#f43f5e',
      orbGlow: 'rgba(244, 63, 94, 0.45)',
      ring: 'rgba(251, 113, 133, 0.3)',
      particles: ['#fb7185', '#f43f5e', '#fb923c', '#fda4af'],
    },
  },
  'solar-gold': {
    id: 'solar-gold',
    name: 'Solar Amber',
    subtitle: 'Warm Sunburst & Royal Radiance',
    bgGradient: 'from-slate-950 via-[#191307] to-[#261c0a]',
    cardBg: 'bg-amber-950/30 backdrop-blur-2xl border-amber-500/20',
    accentColor: 'text-amber-400',
    accentBorder: 'border-amber-500/40',
    accentGlow: 'shadow-[0_0_50px_rgba(245,158,11,0.25)]',
    canvasColors: {
      userWave: '#fbbf24', // amber-400
      modelWave: '#f59e0b', // amber-500
      orbCore: '#d97706',
      orbGlow: 'rgba(245, 158, 11, 0.45)',
      ring: 'rgba(251, 191, 36, 0.3)',
      particles: ['#fbbf24', '#f59e0b', '#fde68a', '#fcd34d'],
    },
  },
};

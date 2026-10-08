/**
 * EmotionAnalyzer - Predicts Sameera's emotional state from speech cues,
 * punctuation, and conversational tone, providing subtle dynamic color palettes
 * and smooth gradient interpolation for the audio waveform visualizer.
 */

import { EmotionalState } from '../types/assistant';

export interface EmotionPalette {
  name: string;
  badgeLabel: string;
  badgeClass: string;
  // Canvas RGB values for smooth interpolation
  userWave: [number, number, number];
  modelWave: [number, number, number];
  orbCore: [number, number, number];
  orbGlow: [number, number, number, number]; // rgba
  particles: string[];
}

export const EMOTION_PALETTES: Record<EmotionalState, EmotionPalette> = {
  neutral: {
    name: 'Attentive & Calm',
    badgeLabel: 'Attentive',
    badgeClass: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
    userWave: [56, 189, 248], // Sky cyan
    modelWave: [192, 132, 252], // Amethyst purple
    orbCore: [168, 85, 247], // Violet
    orbGlow: [168, 85, 247, 0.4],
    particles: ['#c084fc', '#818cf8', '#38bdf8', '#e879f9'],
  },
  playful: {
    name: 'Playful & Witty',
    badgeLabel: 'Playful',
    badgeClass: 'text-pink-300 bg-pink-500/10 border-pink-500/30',
    userWave: [244, 114, 182], // Pink-400
    modelWave: [244, 63, 94], // Rose-500
    orbCore: [236, 72, 153], // Pink-500
    orbGlow: [244, 63, 94, 0.45],
    particles: ['#f43f5e', '#ec4899', '#fb7185', '#f472b6'],
  },
  curious: {
    name: 'Curious & Inquisitive',
    badgeLabel: 'Curious',
    badgeClass: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
    userWave: [45, 212, 191], // Teal-400
    modelWave: [6, 182, 212], // Cyan-500
    orbCore: [14, 165, 233], // Sky-500
    orbGlow: [6, 182, 212, 0.45],
    particles: ['#06b6d4', '#2dd4bf', '#38bdf8', '#67e8f9'],
  },
  empathetic: {
    name: 'Empathetic & Warm',
    badgeLabel: 'Empathetic',
    badgeClass: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    userWave: [251, 146, 60], // Orange-400
    modelWave: [251, 113, 133], // Rose-400
    orbCore: [244, 63, 94], // Crimson
    orbGlow: [251, 146, 60, 0.45],
    particles: ['#fb923c', '#fb7185', '#fca5a5', '#fed7aa'],
  },
  excited: {
    name: 'Excited & Vibrant',
    badgeLabel: 'Excited',
    badgeClass: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    userWave: [52, 211, 153], // Emerald-400
    modelWave: [245, 158, 11], // Amber-500
    orbCore: [16, 185, 129], // Emerald-500
    orbGlow: [16, 185, 129, 0.5],
    particles: ['#34d399', '#fbbf24', '#10b981', '#a7f3d0'],
  },
};

/**
 * Analyzes conversational text to predict Sameera's emotional tone
 */
export function detectEmotionalState(text: string, currentEmotion: EmotionalState = 'neutral'): EmotionalState {
  if (!text || text.trim().length === 0) return currentEmotion;

  const lower = text.toLowerCase();

  // 1. Curious: questions, inquiring about the user's world
  const curiousPatterns = [
    /\?/,
    /\b(what|how|why|where|who|which)\b/,
    /\b(project|projects|sports|workout|gym|hobby|hobbies|music|plans|think)\b/,
    /\b(tell me|wonder|curious|do you|are you|have you)\b/,
  ];
  const curiousScore = curiousPatterns.reduce((acc, p) => acc + (p.test(lower) ? 1.5 : 0), 0);

  // 2. Playful: teasing, banter, jokes, laughter
  const playfulPatterns = [
    /\b(haha|hehe|joke|kidding|silly|tease|teasing|wink|bet you|fun|cheeky|sneaky)\b/,
    /\b(trouble|mischief|dare|smooth|clever|obviously)\b/,
    /!{2,}/,
  ];
  const playfulScore = playfulPatterns.reduce((acc, p) => acc + (p.test(lower) ? 2 : 0), 0);

  // 3. Empathetic: comfort, listening, sweetness, understanding
  const empatheticPatterns = [
    /\b(aww|sorry|understand|breathe|listen|here for you|comfort|sweet|gentle)\b/,
    /\b(take care|take it easy|rest|tough|rough day|hard day|proud of you|hug)\b/,
  ];
  const empatheticScore = empatheticPatterns.reduce((acc, p) => acc + (p.test(lower) ? 2 : 0), 0);

  // 4. Excited: energetic, high-octane praise, enthusiasm
  const excitedPatterns = [
    /\b(wow|awesome|amazing|incredible|brilliant|fantastic|love that|let's go|yay)\b/,
    /\b(unreal|spectacular|thrilled|epic|hype|fire)\b/,
    /!/,
  ];
  const excitedScore = excitedPatterns.reduce((acc, p) => acc + (p.test(lower) ? 1.8 : 0), 0);

  const scores = [
    { emotion: 'playful' as EmotionalState, score: playfulScore },
    { emotion: 'curious' as EmotionalState, score: curiousScore },
    { emotion: 'empathetic' as EmotionalState, score: empatheticScore },
    { emotion: 'excited' as EmotionalState, score: excitedScore },
  ];

  scores.sort((a, b) => b.score - a.score);

  if (scores[0].score >= 1.5) {
    return scores[0].emotion;
  }

  return 'neutral';
}

/**
 * Linear interpolation helper between two numbers
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Linear interpolation helper between two RGB arrays
 */
export function lerpRGB(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

/**
 * Linear interpolation between RGBA arrays
 */
export function lerpRGBA(
  c1: [number, number, number, number],
  c2: [number, number, number, number],
  t: number
): [number, number, number, number] {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
    lerp(c1[3], c2[3], t),
  ];
}

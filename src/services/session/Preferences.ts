export const LANGUAGES = [
  { id: 'telugu', label: 'తెలుగు · Telugu' }, { id: 'tamil', label: 'தமிழ் · Tamil' },
  { id: 'kannada', label: 'ಕನ್ನಡ · Kannada' }, { id: 'malayalam', label: 'മലയാളം · Malayalam' },
  { id: 'hindi', label: 'हिन्दी · Hindi' }, { id: 'english', label: 'English' },
] as const;
export type BaseLanguage = typeof LANGUAGES[number]['id'];
export type Language = BaseLanguage | 'bilingual' | `${Exclude<BaseLanguage, 'english'>}-english`;
export const languageValues: string[] = [...LANGUAGES.map(row => row.id), 'bilingual', ...LANGUAGES.filter(row => row.id !== 'english').map(row => `${row.id}-english`)];
export function validLanguage(value: unknown): value is Language { return typeof value === 'string' && languageValues.includes(value); }
export function languageInstruction(value: Language): string {
  const base = value === 'bilingual' ? 'telugu' : value.replace('-english', '');
  const label = LANGUAGES.find(row => row.id === base)?.label || 'English';
  return `Speak naturally in ${label}${value === 'bilingual' || value.endsWith('-english') ? ', mixing English naturally when the user does' : ''}. Preserve native script. Clarify uncertain names, numbers and file selections before acting.`;
}
export type Persona = 'companion' | 'butler';
export type PrivacyMode = 'controlled-cloud' | 'task-cloud' | 'local-only';
export const PERSONAS = { companion: { voice: 'Aoede', instruction: 'Be warm and conversational.' }, butler: { voice: 'Charon', instruction: 'You are the user’s calm, professional male butler. Be concise, courteous and precise. No teasing, flirting, unsolicited questions or exaggerated enthusiasm. Report verified outcomes.' } };

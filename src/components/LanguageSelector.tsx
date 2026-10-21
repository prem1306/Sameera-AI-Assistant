import { LANGUAGES, type Language } from '../services/session/Preferences';
export function LanguageSelector({ language, onSelect }: { language: Language; onSelect: (language: Language) => void }) {
  return <label className="flex flex-col gap-1 text-xs text-white/80">Voice language
    <select aria-label="Voice language" className="rounded-lg border border-white/20 bg-slate-950 p-2 text-white max-w-52" value={language === 'bilingual' ? 'telugu-english' : language} onChange={event => onSelect(event.target.value as Language)}>
      {LANGUAGES.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
      {LANGUAGES.filter(row => row.id !== 'english').map(row => <option key={`${row.id}-english`} value={`${row.id}-english`}>{row.label} + English</option>)}
    </select>
  </label>;
}

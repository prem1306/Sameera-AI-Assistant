import { Radio, UserCheck, Activity } from 'lucide-react';
import type { Capabilities } from '../services/RuntimeCapabilities';

export function HelpModal({ isOpen, onClose, capabilities }: { isOpen: boolean; onClose: () => void; capabilities: Capabilities }) {
      return isOpen ? (
        <div role="dialog" aria-modal="true" aria-labelledby="sameera-help-title" onKeyDown={event => { if (event.key === 'Escape') onClose(); }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
            onClick={onClose}
          />
          <div className="relative w-full max-w-lg bg-slate-950/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-2xl z-10 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="sameera-help-title" className="text-lg font-semibold text-white">About Sameera</h3>
                  <p className="text-xs text-white/50">Your charming real-time conversational AI</p>
                </div>
              </div>
              <button
                aria-label="Close help"
                autoFocus
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-white/80 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-1">
                <h4 className="font-semibold text-cyan-300 text-sm flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  Roommate & Side-Chatter Silence Filter
                </h4>
                <p className="text-white/70">
                  When your friends or roommate talk to you or each other in the room (e.g., asking for keys or food), Sameera stays <strong>100% completely silent</strong>. She will never interrupt your real-world conversations! Once you finish, just say <strong className="text-white">&ldquo;Hey Sameera&rdquo;</strong> (or <strong className="text-white">&ldquo;హే సమీరా&rdquo;</strong> in Telugu) to resume chatting right where you left off.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 space-y-1">
                <h4 className="font-semibold text-violet-300 text-sm flex items-center gap-1.5">
                  <span>🇮🇳</span>
                  Telugu & Bilingual Language Modes (తెలుగు భాష)
                </h4>
                <p className="text-white/70">
                  Switch between <strong>తెలుగు (Telugu)</strong>, <strong>ద్వంద్వ (Bilingual / Tenglish)</strong>, and <strong>English</strong> anytime with the top language menu. Sameera speaks warm, natural spoken Telugu, understands Telugu YouTube song requests, and reads Telugu articles aloud!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <h4 className="font-semibold text-emerald-300 text-sm flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Continuous Stability & Speech Booster
                </h4>
                <p className="text-white/70">
                  Includes low-latency jitter buffering so Sameera&apos;s voice never breaks down or stutters during extended conversations, plus an acoustic voice booster that picks up your microphone effortlessly even at conversational distance.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
                <h4 className="font-semibold text-white text-sm">Real-time Browser Actions</h4>
                <ul className="space-y-1.5 text-white/60">
                  <li>• <strong className="text-white">Open YouTube Videos:</strong> &ldquo;Open YouTube lo-fi beats&rdquo; or &ldquo;Open MrBeast on YouTube&rdquo; to launch the video player on your screen.</li>
                  <li>• <strong className="text-white">Read Articles & Novels:</strong> &ldquo;Read this article for me: [link]&rdquo; or &ldquo;Read chapter 1 of this story&rdquo; and Sameera will open reader mode and read it aloud with her expressive voice!</li>
                  <li>• <strong className="text-white">Open Websites:</strong> &ldquo;Sameera, open Wikipedia&rdquo; or GitHub, etc.</li>
                  <li>• <strong className="text-white">Web Search:</strong> &ldquo;Search Google for today&apos;s tech news.&rdquo;</li>
                  <li>• <strong className="text-white">Date & Time:</strong> &ldquo;What time and day is it?&rdquo;</li>
                  <li>• <strong className="text-white">Change Theme:</strong> &ldquo;Sameera, switch theme to Cyberpunk or Emerald.&rdquo;</li>
                  <li>• <strong className="text-white">Take Notes:</strong> &ldquo;Take a note to call Alex tomorrow at 10.&rdquo;</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <h4 className="font-semibold text-white text-sm mb-1">{capabilities.windowsControls ? 'Windows Computer Actions' : 'Sameera on the Web'}</h4>
                {capabilities.windowsControls ? <>
                  <p className="text-white/60">Ask Sameera to open or close an installed app by name, manage files, adjust volume, or create a Notepad working draft. Closing an app preserves its save prompts. She asks when a command needs clarification.</p>
                  <p className="text-white/60 mt-2">For Gmail in Chrome, connect the Gmail bridge. Drafting and sending are separate requests; sending requires your click on the exact-message approval preview.</p>
                </> : <p className="text-white/60">Talk with Sameera, search the web, read articles, watch videos, and take browser notes. To control installed apps, files, or PC settings, use Sameera for Windows.</p>}
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <h4 className="font-semibold text-white text-sm mb-1">Natural Interruptions</h4>
                <p className="text-white/60">
                  You never have to wait for Sameera to finish speaking. Whenever you start talking, she will stop immediately and listen to you.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-sm transition-all"
            >
              Got it, let&apos;s talk!
            </button>
          </div>
        </div>
      ) : null;
}

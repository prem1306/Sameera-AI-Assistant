/**
 * SessionMemoDrawer - Slide-over drawer displaying:
 * 1. Active session notes recorded by Sameera
 * 2. Persisted conversation memories and topic recall from past interactions
 */

import React, { useState } from 'react';
import { X, StickyNote, Trash2, Copy, Check, Brain, Clock, Tag } from 'lucide-react';
import { QuickNote, ConversationMemory } from '../types/assistant';

interface SessionMemoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notes: QuickNote[];
  memories: ConversationMemory[];
  onDeleteNote: (id: string) => void;
  onClearAllNotes: () => void;
  onDeleteMemory: (id: string) => void;
  onClearAllMemories: () => void;
}

export const SessionMemoDrawer: React.FC<SessionMemoDrawerProps> = ({
  isOpen,
  onClose,
  notes,
  memories,
  onDeleteNote,
  onClearAllNotes,
  onDeleteMemory,
  onClearAllMemories,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'memories'>('memories');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-slate-950/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Memory &amp; Memos</h3>
                <p className="text-xs text-white/50">Personalized context remembered across chats</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 p-1 bg-white/[0.04] rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab('memories')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'memories'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-violet-400" />
              <span>Memories ({memories.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'notes'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5 text-cyan-400" />
              <span>Notes ({notes.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Persistent Conversation Memories */}
        {activeTab === 'memories' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <div className="flex items-center justify-between text-xs text-white/50 mb-1">
              <span>What Sameera remembers from past chats</span>
              {memories.length > 0 && (
                <button
                  onClick={onClearAllMemories}
                  className="text-rose-400/80 hover:text-rose-300 text-[11px] hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {memories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-3">
                  <Brain className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-white/70">No past conversation memories yet</p>
                <p className="text-xs text-white/40 mt-1 max-w-xs leading-relaxed">
                  Enable encrypted summaries in Agent privacy settings to retain selected topics after a session. Sharing those summaries with Google needs a separate review.
                </p>
              </div>
            ) : (
              memories.map((mem) => (
                <div
                  key={mem.id}
                  className="group relative rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 p-4 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-white/40">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-violet-400" />
                      <span>{mem.dateStr} • {mem.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyText(mem.id, mem.summary)}
                        className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white"
                        title="Copy summary"
                      >
                        {copiedId === mem.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onDeleteMemory(mem.id)}
                        className="p-1 rounded-md hover:bg-rose-500/20 text-rose-400/70 hover:text-rose-300"
                        title="Delete memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-medium">
                    {mem.summary}
                  </p>

                  {/* Topic Badges */}
                  {mem.topics && mem.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {mem.topics.map((topic, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Key Details */}
                  {mem.keyDetails && mem.keyDetails.length > 0 && (
                    <div className="text-[11px] text-white/50 border-t border-white/5 pt-2 space-y-1">
                      <span className="font-semibold text-white/40 block text-[10px] uppercase">
                        Facts Remembered:
                      </span>
                      {mem.keyDetails.map((detail, idx) => (
                        <div key={idx} className="line-clamp-1 italic text-white/70">
                          &ldquo;{detail}&rdquo;
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Pinned Quick Notes */}
        {activeTab === 'notes' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <div className="flex items-center justify-between text-xs text-white/50 mb-1">
              <span>Notes pinned during voice calls</span>
              {notes.length > 0 && (
                <button
                  onClick={onClearAllNotes}
                  className="text-rose-400/80 hover:text-rose-300 text-[11px] hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-3">
                  <StickyNote className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-white/70">No notes recorded yet</p>
                <p className="text-xs text-white/40 mt-1 max-w-xs">
                  During your voice chat, just tell Sameera: &ldquo;Sameera, take a note that...&rdquo; and she will instantly pin it here.
                </p>
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="group relative rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 p-4 transition-all"
                >
                  <div className="flex items-center justify-between text-[11px] text-white/40 mb-1.5">
                    <span>{note.timestamp}</span>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyText(note.id, note.text)}
                        className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white"
                        title="Copy text"
                      >
                        {copiedId === note.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onDeleteNote(note.id)}
                        className="p-1 rounded-md hover:bg-rose-500/20 text-rose-400/70 hover:text-rose-300"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                    {note.text}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer tip */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02]">
          <p className="text-[11px] text-white/40 text-center">
            Memories are saved locally in your browser and used to personalize future conversations
          </p>
        </div>
      </div>
    </div>
  );
};

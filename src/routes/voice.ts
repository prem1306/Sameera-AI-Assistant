import { Router } from 'express';
import type { AgentService } from '../services/agent/AgentService.ts';
import type { LocalRuntime } from '../services/local/Runtime.ts';
import { PERSONAS, validLanguage } from '../services/session/Preferences.ts';

export function voiceRoutes(agent: AgentService, local: () => LocalRuntime | null, token: string, key: () => string | undefined) {
  const router = Router(); let busy = false;
  router.post('/sample', async (req, res) => {
    if (req.headers['x-sameera-token'] !== token) return res.sendStatus(403);
    res.setHeader('Cache-Control', 'no-store');
    if (busy) return res.status(429).json({ error: 'A preview is already running.' });
    busy = true;
    const text = agent.privacy.persona === 'butler' ? 'Good evening. I am Sameera, your assistant. I will prepare your tasks and report verified results.' : 'Hello! I am Sameera. I am here to help with your day.';
    try {
      if (agent.privacy.mode === 'local-only') {
        const runtime = local(); if (!runtime) throw new Error('Local speech is unavailable.');
        const speech = await runtime.exclusive(signal => runtime.speak(text, validLanguage(req.body?.language) ? req.body.language : 'english', agent.privacy.persona, signal));
        return res.json(speech);
      }
      if (!key()) throw new Error('Configure the Google API key first.');
      // Only this fixed public sample is sent. Private text never enters this endpoint.
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', { method: 'POST', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key()! }, body: JSON.stringify({ model: 'gemini-3.8-flash-tts', input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: agent.privacy.persona === 'butler' ? 'calm and professional' : 'warm and conversational' }] }] }], response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: PERSONAS[agent.privacy.persona].voice }] } }) });
      if (!response.ok) throw new Error('Google voice preview is unavailable for this API project.');
      const result = await response.json();
      const audio = result.steps?.flatMap((step: any) => step.content || []).filter((item: any) => item.type === 'audio').at(-1);
      if (!audio?.data) throw new Error('No voice sample returned.');
      const buffer = Buffer.from(audio.data, 'base64');
      let pcm = buffer;
      if (buffer.toString('ascii', 0, 4) === 'RIFF') {
        let offset = 12, found = false;
        while (offset + 8 <= buffer.length) {
          const size = buffer.readUInt32LE(offset + 4), type = buffer.toString('ascii', offset, offset + 4);
          if (type === 'fmt ' && (buffer.readUInt16LE(offset + 8) !== 1 || buffer.readUInt16LE(offset + 10) !== 1 || buffer.readUInt32LE(offset + 12) !== 24000 || buffer.readUInt16LE(offset + 22) !== 16)) throw new Error('Unsupported preview audio format.');
          if (type === 'data') { pcm = buffer.subarray(offset + 8, offset + 8 + size); found = true; break; }
          offset += 8 + size + (size % 2);
        }
        if (!found) throw new Error('Invalid preview audio.');
      }
      if (agent.privacy.state().mode === 'local-only') throw new Error('Mode changed; preview discarded.');
      res.json({ audio: pcm.toString('base64') });
    } catch (error) { res.status(503).json({ error: (error as Error).message }); }
    finally { busy = false; }
  });
  return router;
}

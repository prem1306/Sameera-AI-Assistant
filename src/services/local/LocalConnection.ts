import { VoiceTaskApproval } from '../agent/VoiceTaskApproval.ts';
import { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { AgentService } from '../agent/AgentService.ts';
import type { LocalRuntime } from './Runtime.ts';
import { validLanguage, type Language } from '../session/Preferences.ts';

export function localConnection(runtime: LocalRuntime, agent: AgentService) {
  return async (socket: WebSocket, request: IncomingMessage) => {
    if (!(await runtime.status()).ready) { socket.send(JSON.stringify({ type: 'error', message: 'Install the offline package in Agent settings. No cloud connection was opened.' })); socket.close(1008); return; }
    let language: Language = 'telugu';
    const requested = new URL(request.url || '', 'http://localhost').searchParams.get('lang'); if (validLanguage(requested)) language = requested;
    const voiceApproval = new VoiceTaskApproval(agent.tasks, () => agent.privacy.state().disclosures.some(row => row.state === 'pending'));
    let preRoll: Buffer[] = [];
    let active = false, chunks: Buffer[] = [], bytes = 0, controller = new AbortController(), generation = 0;
    const send = (message: object) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
    const reset = () => { controller.abort(); controller = new AbortController(); generation++; chunks = []; bytes = 0; };
    const unsubscribe = agent.privacy.onChange(() => { voiceApproval.clear(); reset(); socket.close(1000, 'Preferences changed'); });
    socket.on('close', () => { voiceApproval.clear(); preRoll = []; reset(); unsubscribe(); });
    socket.on('message', async raw => {
      const receivedGeneration = generation;
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === 'ping') return send({ type: 'pong' });
        if (message.type === 'setLanguage' && validLanguage(message.language)) { language = message.language; return; }
        if (message.type === 'speechActivity') {
          if (message.active === true) { reset(); chunks = preRoll; bytes = chunks.reduce((total, chunk) => total + chunk.length, 0); preRoll = []; active = true; send({ type: 'interrupted' }); return; }
          active = false;
          if (!bytes) return;
          const pcm = Buffer.concat(chunks), current = generation, signal = controller.signal; chunks = []; bytes = 0;
          send({ type: 'thinking' });
          await runtime.exclusive(async operationSignal => {
            send({ type: 'localProgress', stage: 'Recognizing speech locally' });
            const text = await runtime.transcribe(pcm, operationSignal); if (!text) throw new Error('No speech recognized. Try again.');
            send({ type: 'transcription', role: 'user', text });
            send({ type: 'localProgress', stage: 'Planning locally' });
            const decision = await voiceApproval.input(text, true);
            const result = decision ? { steps: [], reply: `Task ${decision.state}. ${decision.results.length} steps completed. Inspect the local results in Agent activity.` } : await runtime.reason(text, language, agent.privacy.persona, operationSignal);
            if (result.steps.length) { const task = await agent.tasks.create(result.steps); send({ type: 'agentUpdate' }); result.reply = voiceApproval.propose(task.id) ? `Proposed steps: ${task.steps.map(step => `${step.capability} ${step.action}: ${JSON.stringify(step.args)}`).join("; ")}. The proposed scope is shown in Agent activity. May I proceed? You can say go for it or use the review panel.` : 'Review the proposed task in Agent activity before it runs. This request requires panel approval.'; }
            if (decision) send({ type: 'agentUpdate' });
            send({ type: 'transcription', role: 'assistant', text: result.reply });
            send({ type: 'localProgress', stage: 'Generating local speech' });
            const speech = await runtime.speak(result.reply, language, agent.privacy.persona, operationSignal);
            if (current === generation && !signal.aborted) { send({ type: 'audio', data: speech.audio }); send({ type: 'turnComplete' }); voiceApproval.announced(result.reply); }
          }, signal);
        } else if (message.type === 'audio') {
          if (typeof message.data !== 'string' || message.data.length > 64000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(message.data)) throw new Error('Invalid audio packet.');
          const chunk = Buffer.from(message.data, 'base64');
          if (!active) { preRoll.push(chunk); while (preRoll.reduce((total, chunk) => total + chunk.length, 0) > 9600) preRoll.shift(); return; }
          bytes += chunk.length;
          if (bytes > 1920000) { reset(); active = false; throw new Error('Spoken request exceeds one minute.'); }
          chunks.push(chunk);
        } else if (message.type === 'agentStatus') {
          const task = agent.tasks.get(String(message.id)); send({ type: 'transcription', role: 'assistant', text: `Task ${task.state}. ${task.results.length} steps completed. Inspect local results in Agent activity.` });
        }
      } catch { if (generation === receivedGeneration && !controller.signal.aborted) { send({ type: 'error', message: 'Local processing failed or was interrupted. Check the offline pack and try a shorter request; cloud fallback is disabled.' }); send({ type: 'turnComplete' }); voiceApproval.clear(); } }
    });
    send({ type: 'connected', assistantName: 'Sameera', voice: `Local ${agent.privacy.persona}` });
  };
}

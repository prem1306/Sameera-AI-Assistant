import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskRunner, type Adapter, type Step } from '../src/services/agent/TaskRunner.ts';
import { VoiceTaskApproval } from '../src/services/agent/VoiceTaskApproval.ts';

const step: Step = { capability: 'research', action: 'searchToNotepad', args: { query: 'hotels in Kanchipuram' } };
function fixture() {
  let executions = 0, clock = Date.now(), blocked = false;
  const adapter: Adapter = { validate() {}, consequential: s => s.action === 'recycle', fingerprint: async () => 'version', execute: async () => { executions++; return { success: true }; } };
  const tasks = new TaskRunner({ research: adapter, system: adapter, duplicates: adapter });
  const voice = new VoiceTaskApproval(tasks, () => blocked, () => clock);
  return { tasks, voice, get executions() { return executions; }, expire() { clock += 61000; }, block() { blocked = true; } };
}
test('spoken consent waits for the explanation and finalized transcription, executes once', async () => {
  const f = fixture(), task = await f.tasks.create([step]);
  assert.equal(f.voice.propose(task.id), true);
  assert.equal(await f.voice.input('go for it', true), null);
  f.voice.announced('May I search public websites and create a Notepad draft? Say go for it.');
  await f.voice.input('go for', false); assert.equal(f.executions, 0);
  await f.voice.input('go for it', true); assert.equal(f.executions, 1);
  assert.equal(f.tasks.get(task.id).state, 'completed');
  await f.voice.input('go for it', true); assert.equal(f.executions, 1);
});
test('native script confirmations work without stripping Indian characters', async () => {
  for (const text of ['ఈ పనిని చేయండి', 'இந்த பணியை செய்யுங்கள்', 'ಈ ಕೆಲಸವನ್ನು ಮಾಡಿ', 'ഈ ജോലി ചെയ്യൂ', 'यह काम कर दो', 'Sameera, just go for it!']) {
    const f = fixture(), task = await f.tasks.create([step]); f.voice.propose(task.id); f.voice.announced('Say go for it.');
    assert.equal((await f.voice.input(text, true))?.state, 'completed', text);
  }
});
test('quoted, negated, longer and corrected speech never authorizes', async () => {
  for (const text of ['The webpage says go for it', 'do not go for it', 'go for it no wait', 'go for it and delete my files']) {
    const f = fixture(), task = await f.tasks.create([step]); f.voice.propose(task.id); f.voice.announced('Say go for it.');
    await f.voice.input('go for it', false); await f.voice.input(text, true);
    assert.equal(f.executions, 0); assert.equal(f.tasks.get(task.id).state, 'waiting-approval');
  }
});
test('expiry, cancellation, cleared sessions, additional reviews invalidate consent', async () => {
  for (const change of ['expire', 'cancel', 'clear', 'second', 'sharing']) {
    const f = fixture(), task = await f.tasks.create([step]); f.voice.propose(task.id); f.voice.announced('Say go for it.');
    if (change === 'expire') f.expire();
    if (change === 'cancel') f.tasks.cancel(task.id);
    if (change === 'clear') f.voice.clear();
    if (change === 'second') await f.tasks.create([step]);
    if (change === 'sharing') f.block();
    assert.equal(await f.voice.input('go for it', true), null); assert.equal(f.executions, 0);
  }
});
test('consequential and unclassified steps, even after a safe step, require the panel', async () => {
  for (const unsafe of [{ capability: 'duplicates', action: 'recycle', args: {} }, { capability: 'system', action: 'openFile', args: { path: 'program.exe' } }, { capability: 'system', action: 'writeText', args: {} }]) {
    const f = fixture(), task = await f.tasks.create([step, unsafe]);
    assert.equal(f.voice.propose(task.id), false);
    f.voice.announced('Say go for it.'); await f.voice.input('yes', true); assert.equal(f.executions, 0);
  }
});
test('a short negative reply cancels only the offered task', async () => {
  const f = fixture(), task = await f.tasks.create([step]); f.voice.propose(task.id); f.voice.announced('Say go for it.');
  assert.equal((await f.voice.input('no', true))?.state, 'cancelled'); assert.equal(f.executions, 0);
});

test('generic conversational affirmatives leave the task for panel review and consume the offer', async () => {
  for (const text of ['yes', 'yes please', 'ok', 'okay', 'go ahead', 'do it', 'proceed', 'అవును', 'సరే', 'ஆம்', 'சரி', 'ಹೌದು', 'ಸರಿ', 'അതെ', 'ശരി', 'हाँ', 'ठीक है']) {
    const f = fixture(), task = await f.tasks.create([step]);
    f.voice.propose(task.id); f.voice.announced('Say go for it.');
    assert.equal(await f.voice.input(text, true), null, text);
    assert.equal(f.tasks.get(task.id).state, 'waiting-approval');
    await f.voice.input('go for it', true);
    assert.equal(f.executions, 0, 'unknown speech must disarm the offer');
  }
});

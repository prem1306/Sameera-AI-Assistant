import test from 'node:test';
import assert from 'node:assert/strict';
import { ConversationContext, ResponseWatchdog } from '../src/services/ConversationContext.ts';
import { AudioStreamer } from '../src/services/AudioStreamer.ts';
import { ToolManager } from '../src/services/ToolManager.ts';

test('a long fragmented command survives more than twelve exchanges', () => {
  const history = new ConversationContext();
  for (let i = 0; i < 20; i++) {
    history.append('user', `Request ${i}: `);
    history.append('user', 'open a page, ');
    history.append('user', 'then save my note.');
    history.append('assistant', `Acknowledged ${i}.`);
  }
  const context = history.format();
  assert.match(context, /Request 0: open a page, then save my note\./);
  assert.match(context, /Request 19:/);
  assert.equal((context.match(/User:/g) || []).length, 20);
});

test('context remains bounded and keeps the latest request', () => {
  const history = new ConversationContext();
  for (let i = 0; i < 300; i++) {
    history.append(i % 2 ? 'assistant' : 'user', `${i}:` + 'x'.repeat(2000));
  }
  assert.ok(history.format().length <= 60000);
  assert.match(history.format(), /299:/);
});

test('continuous overlapping speech does not trigger a response timeout', () => {
  const watchdog = new ResponseWatchdog();
  watchdog.speech(true, 0);
  watchdog.input(500);
  assert.equal(watchdog.poll(120000), null);
  watchdog.speech(false, 120000);
  assert.equal(watchdog.poll(121000), null);
  assert.equal(watchdog.poll(135000), 'flush');
  assert.equal(watchdog.poll(136000), null);
  assert.equal(watchdog.poll(160000), 'recover');
  assert.equal(watchdog.poll(200000), null);
});

test('model output and new speech prevent premature recovery', () => {
  const watchdog = new ResponseWatchdog();
  watchdog.input(0);
  assert.equal(watchdog.poll(15000), 'flush');
  watchdog.progress();
  assert.equal(watchdog.poll(50000), null);
  watchdog.input(60000);
  watchdog.speech(true, 61000);
  assert.equal(watchdog.poll(120000), null);
});

test('speech detection tolerates short pauses even with diagnostics disabled', () => {
  const streamer = new AudioStreamer();
  streamer.disableDiagnostics();
  let starts = 0;
  let ends = 0;
  streamer.onSpeechStartCallback = () => starts++;
  streamer.onSpeechEndCallback = () => ends++;
  const observe = (samples: Int16Array) => (streamer as any).observeSpeech(samples);
  observe(new Int16Array(1600).fill(2000));
  observe(new Int16Array(8000)); // 500ms pause in a long command
  observe(new Int16Array(1600).fill(2000));
  assert.equal(starts, 1);
  assert.equal(ends, 0);
  observe(new Int16Array(19200)); // 1.2 seconds after the final speaker
  assert.equal(ends, 1);
  observe(new Int16Array(1600).fill(2000));
  assert.equal(starts, 2);
});

test('resumed tool calls do not repeat side effects and cancellation skips remaining actions', async () => {
  const tools = new ToolManager();
  let count = 0;
  (tools as any).executeSingleCall = async () => { count++; return { success: true }; };
  const call = { id: 'same-id', name: 'takeQuickNote', args: { note: 'Remember this' } };
  await Promise.all([tools.executeToolCalls([call]), tools.executeToolCalls([call])]);
  assert.equal(count, 1);
  tools.cancelToolCalls(['cancelled']);
  assert.deepEqual(await tools.executeToolCalls([{ ...call, id: 'cancelled' }]), []);
  assert.equal(count, 1);
});

test('failed tools return a response so the model is not left waiting', async () => {
  const tools = new ToolManager();
  (tools as any).executeSingleCall = async () => { throw new Error('Unavailable'); };
  const [response] = await tools.executeToolCalls([{ id: 'failure', name: 'openWebsite', args: {} }]);
  assert.equal(response.response.output.success, false);
  assert.equal(response.response.output.error, 'Unavailable');
});

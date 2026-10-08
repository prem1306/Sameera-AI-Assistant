// Requires the local server. Connects to Gemini without microphone audio or tool actions.
import WebSocket from 'ws';

const health = await fetch('http://127.0.0.1:3000/api/health').then((response) => response.json());
if (health.status !== 'ok') throw new Error('Local server is unhealthy');
const socket = new WebSocket('ws://127.0.0.1:3000/live?lang=english');
const timeout = setTimeout(() => {
  console.error('Live connection did not become ready within 30 seconds');
  socket.terminate();
  process.exitCode = 1;
}, 30000);
socket.on('message', (raw) => {
  const message = JSON.parse(raw.toString());
  if (message.type === 'connected') {
    console.log('PASS: local health and Gemini Live setup with compression, resumption, and speech detection');
    clearTimeout(timeout);
    socket.close();
  } else if (message.type === 'error') {
    console.error('FAIL: Gemini Live setup rejected:', message.message);
    clearTimeout(timeout);
    process.exitCode = 1;
    socket.close();
  }
});
socket.on('error', (error) => {
  clearTimeout(timeout);
  console.error(error.message);
  process.exitCode = 1;
});

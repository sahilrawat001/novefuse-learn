import { WebSocket } from 'ws';

const sessionId = process.argv[2] || '54a9343a-a8a8-4405-a9b0-d7dd1ef60985';
const url = `ws://localhost:3000/ws/voice-session/${sessionId}`;

console.log(`Connecting WebSocket to ${url}...`);

const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket relay successfully!');

  // Send a PCM16 binary buffer chunk (e.g. 512 bytes of silence)
  const dummyPcm = Buffer.alloc(512);
  ws.send(dummyPcm);
  console.log('Sent binary PCM16 audio chunk');

  // After 1 second, send end_session
  setTimeout(() => {
    console.log('Sending end_session...');
    ws.send(JSON.stringify({ type: 'end_session' }));
  }, 1000);
});

ws.on('message', (data) => {
  console.log('📩 Received message from server:', data.toString());
});

ws.on('close', (code, reason) => {
  console.log(`WebSocket closed: ${code} ${reason.toString()}`);
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  process.exit(1);
});

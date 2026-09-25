import { WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import { ASSEMBLYAI_TOOLS } from '../src/services/promptBuilder.js';
dotenv.config();

const apiKey = process.env.ASSEMBLYAI_API_KEY;

const ws = new WebSocket('wss://agents.assemblyai.com/v1/ws', {
  headers: {
    Authorization: `Bearer ${apiKey}`,
  },
});

ws.on('open', () => {
  console.log('✅ WebSocket connected to AssemblyAI!');
  
  const updateMsg = {
    type: 'session.update',
    session: {
      system_prompt: 'You are an energetic tutor doing a 10-second drill. Ask: What is the main pigment in plants?',
      greeting: 'Welcome to your 10-second drill! What is the main pigment used in photosynthesis?',
      output: { voice: 'ivy' },
      tools: ASSEMBLYAI_TOOLS,
      input: {
        turn_detection: {
          min_silence: 250,
          max_silence: 800,
        },
      },
    },
  };
  console.log('Sending session.update with tools...');
  ws.send(JSON.stringify(updateMsg));
});

let audioChunks = 0;
let bytesTotal = 0;

ws.on('message', (data: Buffer | string) => {
  const text = typeof data === 'string' ? data : data.toString();
  const json = JSON.parse(text);
  console.log('📩 [EVENT]:', json.type);
  if (json.type === 'session.error') {
    console.error('❌ session.error payload:', JSON.stringify(json, null, 2));
  } else if (json.type === 'reply.audio') {
    audioChunks++;
    const b64 = json.data || json.audio;
    if (b64) bytesTotal += b64.length;
    if (audioChunks === 1) {
      console.log(`🔊 First chunk received! b64 length: ${b64?.length}`);
    }
  } else if (json.type === 'transcript.agent') {
    console.log(`💬 Agent text: "${json.text}"`);
  }
});

ws.on('close', (code, reason) => {
  console.log(`Total audio chunks: ${audioChunks}, total bytes: ${bytesTotal}`);
  process.exit(0);
});

setTimeout(() => {
  console.log(`Test done. Total audio chunks: ${audioChunks}, total bytes: ${bytesTotal}`);
  ws.close();
  process.exit(0);
}, 6000);

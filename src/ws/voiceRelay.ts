import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { config } from '../config.js';
import { buildSystemPrompt, ASSEMBLYAI_TOOLS, SessionCustomConfig, resolveTurnDetection } from '../services/promptBuilder.js';
import {
  handleLogAnswerQuality,
  handleEndSessionSummary,
  handleSessionEnd,
} from '../services/toolHandlers.js';

export interface ActiveSessionContext {
  sessionId: string;
  studentId: string;
  mode: 'revision' | 'interview';
  title: string;
  content: string;
  weakTopics: string[];
  startedAt: Date;
  rawTranscript: string;
  sessionConfig?: SessionCustomConfig;
  assemblyWs?: WebSocket | null;
  assemblySessionId?: string;
  clientWs?: WebSocket | null;
  disconnectTimer?: NodeJS.Timeout | null;
}

// In-memory registry of active and resumable sessions
export const sessionRegistry: Map<string, ActiveSessionContext> = new Map();

const ASSEMBLYAI_WS_URL = 'wss://agents.assemblyai.com/v1/ws';

export function setupVoiceRelayWebSocket(wss: WebSocketServer) {
  wss.on('connection', (clientWs: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname; // e.g. /ws/voice-session/:sessionId

    const match = pathname.match(/\/ws\/voice-session\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      clientWs.close(4000, 'Invalid WebSocket path. Expected /ws/voice-session/:sessionId');
      return;
    }

    const sessionId = match[1];
    console.log(`[WS] Client connected for session: ${sessionId}`);

    let sessionCtx = sessionRegistry.get(sessionId);

    // If session doesn't exist yet (e.g. direct connection or Phase 1 mock), initialize default
    if (!sessionCtx) {
      sessionCtx = {
        sessionId,
        studentId: 'default-student',
        mode: 'revision',
        title: 'Photosynthesis & Cellular Respiration',
        content: `Photosynthesis is the process by which green plants and certain other organisms transform light energy into chemical energy.
Key concepts:
- Light-dependent reactions take place in the thylakoid membrane, converting light into ATP and NADPH, releasing O2 from water.
- Light-independent reactions (Calvin Cycle) occur in the stroma, using ATP and NADPH to fix CO2 into glucose.
- Cellular respiration occurs in mitochondria, breaking glucose into CO2, H2O, and 36-38 ATP via Glycolysis, Krebs Cycle, and Electron Transport Chain.`,
        weakTopics: [],
        startedAt: new Date(),
        rawTranscript: '',
      };
      sessionRegistry.set(sessionId, sessionCtx);
    }

    const isReconnection = Boolean(sessionCtx.disconnectTimer);

    // Cancel disconnect timeout if client is reconnecting
    if (sessionCtx.disconnectTimer) {
      clearTimeout(sessionCtx.disconnectTimer);
      sessionCtx.disconnectTimer = null;
      console.log(`[WS] Reconnection detected within 30s grace period for session ${sessionId}`);
    }

    sessionCtx.clientWs = clientWs;

    if (isReconnection) {
      // Silently notify the client that session resumption succeeded
      clientWs.send(JSON.stringify({
        type: 'session.resumed',
        sessionId,
        assemblySessionId: sessionCtx.assemblySessionId,
        rawTranscript: sessionCtx.rawTranscript,
        message: 'Resumed voice session within 30s window',
      }));
    }

    // Always attach client message handlers for control and audio
    clientWs.on('message', (data, isBinary) => {
      if (isBinary) {
        // Raw PCM16 audio bytes from client microphone (AudioWorkletNode)
        if (sessionCtx?.assemblyWs && sessionCtx.assemblyWs.readyState === WebSocket.OPEN) {
          const b64Audio = (data as Buffer).toString('base64');
          sessionCtx.assemblyWs.send(JSON.stringify({
            type: 'input.audio',
            audio: b64Audio,
          }));
        }
      } else {
        // Text control messages
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'end_session') {
            console.log(`[WS] Explicit end_session received from client: ${sessionId}`);
            closeSession(sessionId);
          } else if (msg.type === 'user_speech' && msg.text) {
            console.log(`[WS] Received user_speech for session ${sessionId}: "${msg.text}"`);
            if (!sessionCtx.assemblyWs || sessionCtx.assemblyWs.readyState !== WebSocket.OPEN) {
              // Confirm and echo user speech transcript back to client in mock simulation
              clientWs.send(JSON.stringify({
                type: 'transcript.user',
                text: msg.text,
              }));
              handleMockUserTurn(sessionCtx, msg.text);
            } else {
              console.log(`[WS] Active AssemblyAI session; ignoring redundant user_speech to prevent mock conflict`);
            }
          } else if (msg.type === 'input.audio' && msg.audio) {
            // Client sent base64 input audio in JSON
            if (sessionCtx?.assemblyWs && sessionCtx.assemblyWs.readyState === WebSocket.OPEN) {
              sessionCtx.assemblyWs.send(JSON.stringify({
                type: 'input.audio',
                audio: msg.audio,
              }));
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    clientWs.on('close', (code, reason) => {
      console.log(`[WS] Client disconnected from session ${sessionId} (code: ${code}, reason: ${reason})`);
      if (sessionCtx) {
        sessionCtx.clientWs = null;
        sessionCtx.disconnectTimer = setTimeout(() => {
          console.log(`[WS] 30s resumption window elapsed for session ${sessionId}. Closing permanently.`);
          closeSession(sessionId);
        }, 30000);
      }
    });

    clientWs.on('error', (err) => {
      console.error(`[WS] Client socket error on session ${sessionId}:`, err.message);
    });

    if (!config.assemblyAiApiKey) {
      if (isReconnection) {
        console.log(`[WS] Client resumed mock ${sessionCtx.mode} session ${sessionId}. Keeping existing context.`);
        return;
      }
      console.warn(`[WS] Notice: ASSEMBLYAI_API_KEY is not set. Running interactive mock ${sessionCtx.mode} simulation.`);
      runMockVoiceLoop(sessionCtx);
      return;
    }

    // Connect to real AssemblyAI Voice Agent API
    connectToAssemblyAI(sessionCtx);
  });
}

const mockTurnCounters: Map<string, number> = new Map();

function runMockVoiceLoop(sessionCtx: ActiveSessionContext) {
  const clientWs = sessionCtx.clientWs;
  if (!clientWs) return;

  mockTurnCounters.set(sessionCtx.sessionId, 0);

  // 1. Send session.ready
  setTimeout(() => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'session.ready',
        assemblySessionId: 'mock-session-' + Date.now(),
        isMock: true,
      }));
    }
  }, 400);

  // 2. Mode-specific greeting & initial question
  setTimeout(() => {
    if (clientWs.readyState === WebSocket.OPEN) {
      let initialQuestion = '';
      const cfg = sessionCtx.sessionConfig;
      if (sessionCtx.mode === 'interview') {
        const companyStr = cfg?.company ? ` at ${cfg.company}` : '';
        const levelStr = cfg?.roleLevel ? ` (${cfg.roleLevel} level)` : '';
        initialQuestion = `Hi, thanks for coming in today. Let's start with a quick question. Could you introduce yourself and tell me what interests you about the ${sessionCtx.title}${levelStr} role${companyStr}?`;
      } else {
        const focusStr = cfg?.focusTopics && cfg.focusTopics.length > 0
          ? ` focusing on ${cfg.focusTopics.slice(0, 2).join(' and ')}`
          : '';
        initialQuestion = `Ready to go over ${sessionCtx.title}${focusStr}? Let's start. What are the key concepts and principles of ${sessionCtx.title} you'd like to test your recall on?`;
      }

      sessionCtx.rawTranscript += `\nAgent: ${initialQuestion}`;
      clientWs.send(JSON.stringify({
        type: 'transcript.agent',
        text: initialQuestion,
      }));
      clientWs.send(JSON.stringify({ type: 'reply.done' }));
    }
  }, 1000);
}

async function handleMockUserTurn(sessionCtx: ActiveSessionContext, userSpeech: string) {
  const clientWs = sessionCtx.clientWs;
  if (!clientWs || clientWs.readyState !== WebSocket.OPEN) return;

  sessionCtx.rawTranscript += `\nStudent: ${userSpeech}`;

  const currentTurn = mockTurnCounters.get(sessionCtx.sessionId) || 0;
  mockTurnCounters.set(sessionCtx.sessionId, currentTurn + 1);

  // Simulate short thinking pause
  setTimeout(async () => {
    if (clientWs.readyState !== WebSocket.OPEN) return;

    let topic = '';
    let status: 'strong' | 'partial' | 'weak' = 'strong';
    let note = '';
    let agentReply = '';

    const cfg = sessionCtx.sessionConfig;
    const lowerSpeech = userSpeech.toLowerCase();
    const isStruggling = lowerSpeech.includes("don't know") || lowerSpeech.includes("not sure") || lowerSpeech.includes("confused") || userSpeech.trim().length < 15;

    if (sessionCtx.mode === 'interview') {
      const targetComp = cfg?.focusCompetencies?.[currentTurn] || null;
      if (currentTurn === 0) {
        topic = targetComp || 'Background & Communication';
        status = isStruggling ? 'partial' : 'strong';
        note = isStruggling
          ? 'Brief initial introduction; candidate asked for narrower question scope.'
          : 'Clear, articulate introduction aligning experience with role.';

        if (isStruggling) {
          agentReply = "No problem, take your time. Let's start with something focused: what is one project you worked on that you are most proud of?";
        } else {
          const nextPrompt = cfg?.focusCompetencies?.[1]
            ? `specifically around ${cfg.focusCompetencies[1]}`
            : 'including the measurable impact of your solution';
          agentReply = `Great overview. Since you have solid foundations here, let's look at a complex scenario: can you describe a challenging problem you solved, ${nextPrompt}?`;
        }
      } else if (currentTurn === 1) {
        topic = targetComp || 'STAR Method & Technical Depth';
        status = isStruggling ? 'weak' : 'strong';
        note = isStruggling
          ? 'Struggled to articulate technical depth and measurable results.'
          : 'Structured answer covering Situation, Task, Action, and Results with strong depth.';

        if (isStruggling) {
          agentReply = "That's a tough one. Let's ease into it using the STAR method: what was the specific situation or constraint your team was facing?";
        } else {
          agentReply = "Exceptional depth on that answer! Let's escalate the difficulty: suppose that system experienced a 50x spike during a regional network outage. How would you redesign it to prevent cascading failure?";
        }
      } else {
        topic = targetComp || 'Conflict Resolution & Collaboration';
        status = 'strong';
        note = 'Constructive approach to consensus and professional communication.';
        agentReply = "Thank you, that demonstrates great collaborative maturity. That covers our interview questions for today! Click 'End Session' to view your complete evaluation summary.";
      }
    } else {
      // Revision mode
      const targetTopic = cfg?.focusTopics?.[currentTurn] || null;
      if (currentTurn === 0) {
        topic = targetTopic || 'Core Fundamentals';
        status = isStruggling ? 'partial' : 'strong';
        note = isStruggling
          ? 'Hesitant on initial recall; needed foundational scaffolding.'
          : 'Accurate conceptual explanation of main principles.';

        if (isStruggling) {
          agentReply = "No worries at all, let's break it down into simpler steps. What is the very first input or molecule involved in this process?";
        } else {
          const nextTopicPrompt = cfg?.focusTopics?.[1]
            ? `around ${cfg.focusTopics[1]}`
            : 'involved in that process';
          agentReply = `Spot on recall! Since you know the basics well, let's go a level deeper: can you elaborate on the exact mechanism or intermediate steps ${nextTopicPrompt}?`;
        }
      } else if (currentTurn === 1) {
        topic = targetTopic || 'Mechanism & Reactions';
        status = isStruggling ? 'weak' : 'strong';
        note = isStruggling
          ? 'Missed key intermediate steps and enzyme interactions.'
          : 'Accurately explained interconnected reactions and energy yields.';

        if (isStruggling) {
          agentReply = "Let's pause and simplify that mechanism: think of it like an assembly line. Where is the energy (ATP) actually generated in that step?";
        } else {
          agentReply = "Great mastery of the reaction mechanics! Let's challenge you with an exam-level edge case: what happens to this pathway if the oxygen supply is completely cut off?";
        }
      } else {
        topic = targetTopic || 'System Synthesis';
        status = 'strong';
        note = 'Successfully connected concepts across the entire topic.';
        agentReply = "Excellent revision work! We've covered the key material adaptively. Click 'End Session' whenever you are ready to review your summary.";
      }
    }

    // Persist tool call
    await handleLogAnswerQuality(sessionCtx.sessionId, sessionCtx.studentId, {
      topic,
      status,
      notes: note,
    });

    clientWs.send(JSON.stringify({
      type: 'tool.call',
      name: 'log_answer_quality',
      data: { topic, status, notes: note },
    }));

    clientWs.send(JSON.stringify({
      type: 'transcript.agent',
      text: agentReply,
    }));
    sessionCtx.rawTranscript += `\nAgent: ${agentReply}`;
    clientWs.send(JSON.stringify({ type: 'reply.done' }));
  }, 300);
}

function connectToAssemblyAI(sessionCtx: ActiveSessionContext) {
  // If already connected and active, skip reconnect
  if (sessionCtx.assemblyWs && sessionCtx.assemblyWs.readyState === WebSocket.OPEN) {
    return;
  }

  const isResuming = Boolean(sessionCtx.assemblySessionId);
  console.log(`[AssemblyAI] Connecting to Voice Agent API at ${ASSEMBLYAI_WS_URL} (resuming: ${isResuming})...`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.assemblyAiApiKey}`,
  };

  const assemblyWs = new WebSocket(ASSEMBLYAI_WS_URL, { headers });
  sessionCtx.assemblyWs = assemblyWs;

  let hasOpened = false;

  assemblyWs.on('open', () => {
    hasOpened = true;
    console.log(`[AssemblyAI] Connection established.`);

    if (isResuming && sessionCtx.assemblySessionId) {
      console.log(`[AssemblyAI] Sending session.resume with ID: ${sessionCtx.assemblySessionId}`);
      assemblyWs.send(JSON.stringify({
        type: 'session.resume',
        session_id: sessionCtx.assemblySessionId,
      }));
    } else {
      const { systemPrompt, greeting } = buildSystemPrompt({
        mode: sessionCtx.mode,
        title: sessionCtx.title,
        content: sessionCtx.content,
        weakTopics: sessionCtx.weakTopics,
        config: sessionCtx.sessionConfig,
      });

      const turnSettings = resolveTurnDetection(
        sessionCtx.mode,
        sessionCtx.sessionConfig?.difficulty,
        sessionCtx.sessionConfig?.turnDetection
      );

      console.log(
        `[AssemblyAI] Sending session.update for mode: ${sessionCtx.mode}, title: "${sessionCtx.title}". Turn detection: isNeural=${turnSettings.isNeural}, min_silence=${turnSettings.minSilence}ms, max_silence=${turnSettings.maxSilence}ms, vad=${turnSettings.vadThreshold}`
      );

      const sessionUpdatePayload: any = {
        type: 'session.update',
        session: {
          system_prompt: systemPrompt,
          greeting: greeting,
          output: { voice: 'ivy' },
          tools: ASSEMBLYAI_TOOLS,
          input: turnSettings.isNeural
            ? {}
            : {
                turn_detection: {
                  min_silence: turnSettings.minSilence,
                  max_silence: turnSettings.maxSilence,
                  vad_threshold: turnSettings.vadThreshold,
                },
              },
        },
      };

      assemblyWs.send(JSON.stringify(sessionUpdatePayload));
    }
  });

  assemblyWs.on('message', async (data: Buffer | string) => {
    try {
      const text = typeof data === 'string' ? data : data.toString();
      const event = JSON.parse(text);
      const audioPayload = event.data || event.audio;
      console.log(
        `[AssemblyAI Event] ${event.type}`,
        event.type === 'reply.audio'
          ? `(PCM16 audio bytes: ${audioPayload?.length || 0})`
          : (event.text || event.session_id || '')
      );

      if (event.type === 'session.error') {
        console.error(`[AssemblyAI Session Error]`, JSON.stringify(event));
      }

      switch (event.type) {
        case 'session.ready':
          sessionCtx.assemblySessionId = event.session_id;
          console.log(`[AssemblyAI] Session ready. Assembly Session ID: ${event.session_id}`);
          if (sessionCtx.clientWs && sessionCtx.clientWs.readyState === WebSocket.OPEN) {
            sessionCtx.clientWs.send(JSON.stringify({
              type: 'session.ready',
              assemblySessionId: event.session_id,
              isMock: false,
            }));
          }
          break;

        case 'reply.audio': {
          // Base64 PCM16 audio chunk from agent speech (AssemblyAI sends it in event.data)
          const b64Audio = event.data || event.audio;
          if (sessionCtx.clientWs && sessionCtx.clientWs.readyState === WebSocket.OPEN && b64Audio) {
            sessionCtx.clientWs.send(JSON.stringify({
              type: 'reply.audio',
              audio: b64Audio,
              data: b64Audio,
            }));
          }
          break;
        }

        case 'transcript.agent':
        case 'transcript.agent.delta':
        case 'transcript.user':
        case 'transcript.user.delta':
        case 'reply.done':
        case 'agent.interrupted':
          // Append finalized transcripts to raw_transcript
          if (event.type === 'transcript.user' && event.text) {
            sessionCtx.rawTranscript += `\nStudent: ${event.text}`;
          } else if (event.type === 'transcript.agent' && event.text) {
            sessionCtx.rawTranscript += `\nAgent: ${event.text}`;
          }

          // Forward transcript and state events directly to client
          if (sessionCtx.clientWs && sessionCtx.clientWs.readyState === WebSocket.OPEN) {
            sessionCtx.clientWs.send(JSON.stringify(event));
          }
          break;

        case 'tool.call':
          console.log(`[AssemblyAI] Received tool.call: ${event.name}`, event.arguments);
          const callId = event.call_id;
          const toolName = event.name;
          const args = typeof event.arguments === 'string' ? JSON.parse(event.arguments) : (event.arguments || {});

          if (toolName === 'log_answer_quality') {
            await handleLogAnswerQuality(sessionCtx.sessionId, sessionCtx.studentId, {
              topic: args.topic,
              status: args.status,
              notes: args.notes,
            });

            // Notify client for UI badge display
            if (sessionCtx.clientWs && sessionCtx.clientWs.readyState === WebSocket.OPEN) {
              sessionCtx.clientWs.send(JSON.stringify({
                type: 'tool.call',
                name: 'log_answer_quality',
                data: args,
              }));
            }

            // Respond to AssemblyAI with result
            assemblyWs.send(JSON.stringify({
              type: 'tool.result',
              call_id: callId,
              result: JSON.stringify({ success: true, logged: true }),
            }));
          } else if (toolName === 'end_session_summary') {
            await handleEndSessionSummary(sessionCtx.sessionId, {
              topics_covered: args.topics_covered,
              weak_topics: args.weak_topics,
              recommended_next_focus: args.recommended_next_focus,
              session_notes: args.session_notes,
              star_breakdown: args.star_breakdown,
            });

            assemblyWs.send(JSON.stringify({
              type: 'tool.result',
              call_id: callId,
              result: JSON.stringify({ success: true, ended: true }),
            }));
          }
          break;

        default:
          // Forward any other relevant event
          if (sessionCtx.clientWs && sessionCtx.clientWs.readyState === WebSocket.OPEN) {
            sessionCtx.clientWs.send(text);
          }
          break;
      }
    } catch (err: any) {
      console.error(`[AssemblyAI] Message handling error:`, err.message);
    }
  });

  assemblyWs.on('error', (err) => {
    console.error(`[AssemblyAI] WebSocket error:`, err.message);
    sessionCtx.assemblyWs = null;

    if (!hasOpened) {
      console.warn(`[AssemblyAI] Cloud connection failed (${err.message}). Seamlessly falling back to local simulation engine.`);
      if (sessionCtx.clientWs && sessionCtx.clientWs.readyState === WebSocket.OPEN) {
        sessionCtx.clientWs.send(JSON.stringify({
          type: 'notice',
          message: `AssemblyAI cloud unreachable (${err.message}). Switched to local interactive simulation engine so you can continue speaking.`,
        }));
      }
      runMockVoiceLoop(sessionCtx);
      return;
    }

    if (sessionCtx.clientWs && sessionCtx.clientWs.readyState === WebSocket.OPEN) {
      sessionCtx.clientWs.send(JSON.stringify({
        type: 'error',
        message: `AssemblyAI Voice Agent error: ${err.message}`,
      }));
    }
  });

  assemblyWs.on('close', (code, reason) => {
    console.log(`[AssemblyAI] Connection closed (code: ${code}, reason: ${reason.toString()})`);
  });
}

export async function closeSession(sessionId: string) {
  const sessionCtx = sessionRegistry.get(sessionId);
  if (!sessionCtx) return;

  if (sessionCtx.disconnectTimer) {
    clearTimeout(sessionCtx.disconnectTimer);
    sessionCtx.disconnectTimer = null;
  }

  // Handle final calculations & DB writes
  const result = await handleSessionEnd(sessionId, sessionCtx.startedAt, sessionCtx.rawTranscript);

  // Close AssemblyAI WebSocket
  if (sessionCtx.assemblyWs && sessionCtx.assemblyWs.readyState === WebSocket.OPEN) {
    sessionCtx.assemblyWs.close();
    sessionCtx.assemblyWs = null;
  }

  // Notify client if still connected and close
  if (sessionCtx.clientWs && sessionCtx.clientWs.readyState === WebSocket.OPEN) {
    sessionCtx.clientWs.send(JSON.stringify({
      type: 'session_ended',
      summary: result.summaryJson,
      durationMinutes: result.durationMinutes,
      costUsd: result.apiCostEstimateUsd,
    }));
    sessionCtx.clientWs.close();
    sessionCtx.clientWs = null;
  }

  sessionRegistry.delete(sessionId);
  console.log(`[Session] Closed and cleaned up session ${sessionId}`);
}

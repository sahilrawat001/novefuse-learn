import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AudioCaptureService } from '../audio/audioCapture';
import { AudioPlayerService } from '../audio/audioPlayer';
import { StateIndicator, VoiceState } from '../components/StateIndicator';
import { TopicBadge, TopicQualityItem } from '../components/TopicBadge';
import {
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Clock,
  DollarSign,
  Activity,
  Hand,
  Send,
  Volume2,
  VolumeX,
  Zap,
  Target,
} from 'lucide-react';
import { apiFetch, getWebSocketUrl } from '../api/apiClient';

export const VoiceSession: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [voiceState, setVoiceState] = useState<VoiceState>('disconnected');
  const [agentSpeech, setAgentSpeech] = useState<string>('');
  const [agentSpeechDelta, setAgentSpeechDelta] = useState<string>('');
  const [userSpeech, setUserSpeech] = useState<string>('');
  const [userSpeechDelta, setUserSpeechDelta] = useState<string>('');
  const [typedInput, setTypedInput] = useState<string>('');
  const [topicResults, setTopicResults] = useState<TopicQualityItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [resumptionSecondsLeft, setResumptionSecondsLeft] = useState<number | null>(null);
  const [reconnectedNotice, setReconnectedNotice] = useState<boolean>(false);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [sessionDetails, setSessionDetails] = useState<{ mode?: string; title?: string }>({});
  const [micVolume, setMicVolume] = useState<number>(0);
  const [agentVolume, setAgentVolume] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [agentMuted, setAgentMuted] = useState<boolean>(false);
  const [sttStatus, setSttStatus] = useState<'idle' | 'listening' | 'transcribing' | 'unsupported' | 'error'>('idle');
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const audioCaptureRef = useRef<AudioCaptureService | null>(null);
  const audioPlayerRef = useRef<AudioPlayerService | null>(null);
  const hasReceivedAssemblyAudioRef = useRef<boolean>(false);
  const speechRecognitionRef = useRef<any>(null);
  const isMockSessionRef = useRef<boolean>(false);

  const userEndedSessionRef = useRef<boolean>(false);
  const sessionActiveRef = useRef<boolean>(false);
  const isMicMutedRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    sessionActiveRef.current = sessionActive;
  }, [sessionActive]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // Timer for session duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (sessionActive) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionActive]);

  // Fetch session metadata
  useEffect(() => {
    if (!sessionId) return;
    apiFetch(`/api/sessions/${sessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.session) {
          setSessionDetails({
            mode: data.session.mode,
            title: data.session.studyMaterial?.title || (data.session.mode === 'interview' ? 'Mock Interview' : 'Revision Session'),
          });
        }
      })
      .catch(() => {});
  }, [sessionId]);

  const refreshMics = async () => {
    const devices = await AudioCaptureService.getAudioInputDevices();
    setAvailableMics(devices);
    if (devices.length > 0 && !selectedMicId) {
      setSelectedMicId(devices[0].deviceId);
    }
  };

  const handleMicSelect = async (deviceId: string) => {
    setSelectedMicId(deviceId);
    if (audioCaptureRef.current) {
      await audioCaptureRef.current.switchDevice(deviceId);
    }
  };

  useEffect(() => {
    refreshMics();
    if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
      navigator.mediaDevices.addEventListener('devicechange', refreshMics);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshMics);
      };
    }
  }, []);

  useEffect(() => {
    // Initialize audio player
    audioPlayerRef.current = new AudioPlayerService((isPlaying) => {
      setVoiceState((prev) => (isPlaying ? 'speaking' : prev === 'speaking' ? 'listening' : prev));
    });

    return () => {
      cleanupSession();
    };
  }, []);

  const stopReconnectTimers = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setResumptionSecondsLeft(null);
  };

  const cleanupSession = () => {
    userEndedSessionRef.current = true;
    sessionActiveRef.current = false;
    stopReconnectTimers();

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioCaptureRef.current) {
      audioCaptureRef.current.stop();
      audioCaptureRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.close();
      audioPlayerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSessionActive(false);
    setVoiceState('disconnected');
    setMicVolume(0);
    setSttStatus('idle');
  };

  const handleConnectionLost = () => {
    if (userEndedSessionRef.current) return;
    console.log('[Client WS] Connection dropped. Starting 30-second session resumption...');
    setVoiceState('reconnecting');

    if (!countdownIntervalRef.current) {
      let secondsRemaining = 30;
      setResumptionSecondsLeft(secondsRemaining);

      countdownIntervalRef.current = setInterval(() => {
        secondsRemaining -= 1;
        if (secondsRemaining <= 0) {
          stopReconnectTimers();
          setErrorMessage('Session ended: 30-second resumption window elapsed.');
          cleanupSession();
          navigate(`/session/${sessionId}/summary`);
        } else {
          setResumptionSecondsLeft(secondsRemaining);
        }
      }, 1000);
    }

    scheduleNextReconnect();
  };

  const scheduleNextReconnect = () => {
    if (userEndedSessionRef.current) return;
    const attempt = reconnectAttemptsRef.current;
    const delay = Math.min(800 * Math.pow(1.3, attempt), 3000);
    reconnectAttemptsRef.current += 1;

    console.log(`[Client WS] Scheduling reconnect attempt #${reconnectAttemptsRef.current} in ${Math.round(delay)}ms...`);
    reconnectTimeoutRef.current = setTimeout(() => {
      startVoiceSession(true);
    }, delay);
  };

  const initSpeechRecognition = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('[STT] Web Speech API not supported in this browser.');
      setSttStatus('unsupported');
      return;
    }

    try {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {}
        speechRecognitionRef.current = null;
      }

      const recognizer = new SpeechRec();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onstart = () => {
        console.log('[STT] Speech recognition active');
        setSttStatus('listening');
      };

      let silenceTimeout: NodeJS.Timeout | null = null;
      let accumulatedText = '';

      const commitSpeech = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (silenceTimeout) {
          clearTimeout(silenceTimeout);
          silenceTimeout = null;
        }
        accumulatedText = '';

        // In an active AssemblyAI session, microphone PCM16 audio is already streaming directly.
        // AssemblyAI performs its own speech-to-text and end-of-turn detection in the cloud.
        if (!isMockSessionRef.current) {
          console.log('[STT] Browser recognized text (AssemblyAI handling audio stream):', trimmed);
          setUserSpeech(trimmed);
          setUserSpeechDelta('');
          return;
        }

        console.log('[STT] Committing speech for mock simulation:', trimmed);
        setUserSpeech(trimmed);
        setUserSpeechDelta('');
        setVoiceState('processing');
        setSttStatus('listening');

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'user_speech', text: trimmed }));
        }
      };

      recognizer.onresult = (e: any) => {
        let interim = '';
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            final += e.results[i][0].transcript;
          } else {
            interim += e.results[i][0].transcript;
          }
        }

        const currentSpoken = (final || interim).trim();
        if (currentSpoken) {
          accumulatedText = currentSpoken;
          setUserSpeechDelta(interim || final);
          triggerBargeIn();

          // Reset snappy silence timer (650ms of quiet after speaking = turn end)
          if (silenceTimeout) clearTimeout(silenceTimeout);
          silenceTimeout = setTimeout(() => {
            if (accumulatedText && !isMicMutedRef.current && sessionActiveRef.current) {
              commitSpeech(accumulatedText);
            }
          }, 650);
        }

        if (final) {
          commitSpeech(final);
        }
      };

      recognizer.onerror = (event: any) => {
        console.warn('[STT] Speech recognition notice:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSttStatus('error');
          setErrorMessage('Microphone Speech-to-Text was blocked by your browser. Please allow microphone permissions or use the response bar below.');
        } else if (event.error !== 'no-speech') {
          // Handled gracefully via onend
        }
      };

      recognizer.onend = () => {
        console.log('[STT] Speech recognition cycled');
        // Auto-restart if session is still active
        if (!userEndedSessionRef.current && sessionActiveRef.current && !isMicMutedRef.current) {
          setTimeout(() => {
            if (!userEndedSessionRef.current && sessionActiveRef.current && !isMicMutedRef.current) {
              try {
                recognizer.start();
              } catch (e) {
                console.log('[STT] Restart notice:', e);
              }
            }
          }, 300);
        } else {
          setSttStatus('idle');
        }
      };

      recognizer.start();
      speechRecognitionRef.current = recognizer;
      setSttStatus('listening');
    } catch (err: any) {
      console.warn('[STT] Speech recognition initialization notice:', err);
      setSttStatus('error');
    }
  };

  const startVoiceSession = async (isReconnect = false) => {
    if (!sessionId) return;
    if (userEndedSessionRef.current) return;

    if (!isReconnect) {
      setErrorMessage(null);
      setVoiceState('connecting');
      userEndedSessionRef.current = false;
      reconnectAttemptsRef.current = 0;
      hasReceivedAssemblyAudioRef.current = false;
    } else {
      setVoiceState('reconnecting');
    }

    // Explicitly unlock browser Web Audio hardware during user gesture
    if (audioPlayerRef.current) {
      await audioPlayerRef.current.resume();
    }

    try {
      // 1. Initialize Microphone Audio Capture & Volume Meter
      if (!audioCaptureRef.current) {
        const captureService = new AudioCaptureService();
        audioCaptureRef.current = captureService;
      }
      const captureService = audioCaptureRef.current;

      // 2. Open WebSocket connection to our backend
      const wsUrl = getWebSocketUrl(`/ws/voice-session/${sessionId}`);
      console.log(`[Client WS] ${isReconnect ? 'Reconnecting' : 'Connecting'} to:`, wsUrl);

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log(`[Client WS] Connected to backend (isReconnect: ${isReconnect})`);
        setSessionActive(true);
        sessionActiveRef.current = true;
        setVoiceState('listening');
        stopReconnectTimers();

        if (isReconnect) {
          setReconnectedNotice(true);
          setTimeout(() => setReconnectedNotice(false), 4000);
        }

        // Start/resume streaming mic audio to backend WebSocket + Volume Meter
        try {
          await captureService.start(
            (pcm16Buffer) => {
              if (ws.readyState === WebSocket.OPEN && !isMicMutedRef.current) {
                ws.send(pcm16Buffer);
              }
            },
            (vol) => {
              setMicVolume(vol);
            },
            selectedMicId || undefined
          );
          refreshMics();
        } catch (e) {
          console.warn('[Client WS] Audio capture restart notice:', e);
        }

        // Initialize SpeechRecognition
        initSpeechRecognition();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'session.ready':
                isMockSessionRef.current = !!data.isMock;
                console.log('[Client WS] Agent session ready. Cloud Mode:', !data.isMock);
                setVoiceState('listening');
                audioPlayerRef.current?.playConnectedChime();
                break;

              case 'session.resumed':
                console.log('[Client WS] Agent session resumed confirmation');
                setVoiceState('listening');
                stopReconnectTimers();
                setReconnectedNotice(true);
                setTimeout(() => setReconnectedNotice(false), 4000);
                break;

              case 'reply.started':
                hasReceivedAssemblyAudioRef.current = false;
                setVoiceState('speaking');
                break;

              case 'reply.audio': {
                const b64Audio = data.audio || data.data;
                if (b64Audio) {
                  hasReceivedAssemblyAudioRef.current = true;
                  if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                  if (audioPlayerRef.current) {
                    audioPlayerRef.current.playPcm16Chunk(b64Audio);
                  }
                }
                break;
              }

              case 'transcript.agent.delta':
                setAgentSpeechDelta((prev) => prev + (data.text || ''));
                break;

              case 'transcript.agent':
                setAgentSpeech(data.text || '');
                setAgentSpeechDelta('');
                // If running local mock simulation without cloud audio, use browser SpeechSynthesis
                if (isMockSessionRef.current && 'speechSynthesis' in window && data.text) {
                  try {
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.resume();
                    const utterance = new SpeechSynthesisUtterance(data.text);
                    const voices = window.speechSynthesis.getVoices();
                    const enVoice = voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Karen'))) || voices.find((v) => v.lang.startsWith('en'));
                    if (enVoice) utterance.voice = enVoice;
                    utterance.rate = 1.0;
                    utterance.onstart = () => setVoiceState('speaking');
                    utterance.onend = () => setVoiceState('listening');
                    window.speechSynthesis.speak(utterance);
                  } catch (e) {
                    console.warn('[Client] SpeechSynthesis fallback error:', e);
                  }
                }
                break;

              case 'transcript.user.delta':
                triggerBargeIn();
                setUserSpeechDelta(data.text || '');
                setVoiceState('listening');
                break;

              case 'transcript.user':
                console.log('[Client WS] Received transcript.user:', data.text);
                setUserSpeech(data.text || '');
                setUserSpeechDelta('');
                setVoiceState('processing');
                break;

              case 'reply.done':
                setVoiceState('listening');
                audioPlayerRef.current?.playTurnReadyChime();
                break;

              case 'tool.call':
                if (data.name === 'log_answer_quality' && data.data) {
                  setTopicResults((prev) => [
                    ...prev,
                    {
                      topic: data.data.topic,
                      status: data.data.status,
                      notes: data.data.notes,
                    },
                  ]);
                }
                break;

              case 'session_ended':
                console.log('[Client WS] Session terminated. Navigating to summary.');
                cleanupSession();
                navigate(`/session/${sessionId}/summary`);
                break;

              case 'notice':
                setErrorMessage(data.message || null);
                setTimeout(() => setErrorMessage(null), 8000);
                break;

              case 'error':
                setErrorMessage(data.message || 'An error occurred during voice session');
                setVoiceState('disconnected');
                break;
            }
          } catch (e) {
            console.error('Error parsing WS message:', e);
          }
        }
      };

      ws.onerror = (err) => {
        console.error('[Client WS] Socket error:', err);
        if (!userEndedSessionRef.current && sessionActive) {
          handleConnectionLost();
        } else {
          setErrorMessage('Failed to connect to voice server.');
          setVoiceState('disconnected');
        }
      };

      ws.onclose = (event) => {
        console.log(`[Client WS] Socket closed (code: ${event.code})`);
        if (!userEndedSessionRef.current && sessionActive) {
          handleConnectionLost();
        } else {
          setVoiceState('disconnected');
        }
      };
    } catch (err: any) {
      console.error('Failed to start audio session:', err);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access to speak.'
          : err.message || 'Could not start voice session.'
      );
      cleanupSession();
    }
  };

  const triggerBargeIn = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.interrupt();
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setVoiceState('listening');
  };

  const handleSendResponse = (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : typedInput).trim();
    if (!text) return;

    setUserSpeech(text);
    setUserSpeechDelta('');
    setTypedInput('');
    setVoiceState('processing');
    triggerBargeIn();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'user_speech', text }));
    }
  };

  const handleEndSession = () => {
    userEndedSessionRef.current = true;
    stopReconnectTimers();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_session' }));
    }
    setTimeout(() => {
      cleanupSession();
      navigate(`/session/${sessionId}/summary`);
    }, 600);
  };

  const playTestChime = () => {
    try {
      if (audioPlayerRef.current) {
        const ctx = audioPlayerRef.current.initAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        const u = new SpeechSynthesisUtterance('Audio check: speaker output is active.');
        u.volume = 0.8;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      console.warn('Audio check error:', e);
    }
  };

  // Live amplitude tracking for agent speech visualization
  useEffect(() => {
    let animId: number;
    const poll = () => {
      if (voiceState === 'speaking' && audioPlayerRef.current) {
        setAgentVolume(audioPlayerRef.current.getAudioLevel());
      } else if (voiceState !== 'speaking' && agentVolume !== 0) {
        setAgentVolume(0);
      }
      animId = requestAnimationFrame(poll);
    };
    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [voiceState]);

  const handleCyclePlaybackSpeed = () => {
    const speeds = [1.0, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.setPlaybackRate(nextSpeed);
    }
  };

  const handleToggleAgentMute = () => {
    const nextMuted = !agentMuted;
    setAgentMuted(nextMuted);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.setVolume(nextMuted ? 0 : 1.0);
    }
  };

  const strongCount = topicResults.filter((t) => t.status === 'strong').length;
  const partialCount = topicResults.filter((t) => t.status === 'partial').length;
  const weakCount = topicResults.filter((t) => t.status === 'weak').length;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const estimatedCost = ((secondsElapsed / 60) * 0.075).toFixed(4);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Telemetry Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/[0.08]">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.06] transition"
            title="Return to Studio"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-wide">
                {sessionDetails.title || 'Live Voice Studio'}
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                {sessionDetails.mode === 'interview' ? 'STAR Interview' : 'Revision Partner'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              ID: {sessionId?.slice(0, 8)}... • PCM 16kHz Streaming
            </p>
          </div>
        </div>

        {/* Live Telemetry Pills */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {topicResults.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-purple-500/30 text-xs font-mono">
              <Target className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-300">{topicResults.length} Evaluated</span>
              <span className="text-emerald-400 font-bold">({strongCount}S</span>
              {partialCount > 0 && <span className="text-amber-400 font-bold"> {partialCount}P</span>}
              {weakCount > 0 && <span className="text-rose-400 font-bold"> {weakCount}W</span>}
              <span className="text-slate-500">)</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/[0.06] text-xs text-slate-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{formatTimer(secondsElapsed)}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/[0.06] text-xs text-slate-300 font-mono">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>~140ms</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/[0.06] text-xs text-slate-300 font-mono">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <span>${estimatedCost}</span>
          </div>
        </div>
      </div>

      {/* Top Notification / Error banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-xs sm:text-sm text-rose-300 flex items-start gap-3 backdrop-blur-md">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-200">Voice Session Notice</p>
            <p className="text-xs text-rose-400 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* 30s Session Resumption Countdown Banner */}
      {resumptionSecondsLeft !== null && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl text-xs sm:text-sm text-amber-200 flex items-center justify-between backdrop-blur-md animate-pulse">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-amber-400 animate-spin" />
            <div>
              <p className="font-bold text-amber-100">Connection Blip Detected — Silently Reconnecting...</p>
              <p className="text-xs text-amber-300/80">
                Preserving session memory & audio buffer. 30s Resumption Window: {resumptionSecondsLeft}s remaining
              </p>
            </div>
          </div>
          <button
            onClick={() => startVoiceSession(true)}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition shrink-0"
          >
            Force Reconnect
          </button>
        </div>
      )}

      {/* Seamless Reconnection Success Toast */}
      {reconnectedNotice && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-xs font-semibold text-emerald-300 flex items-center gap-2.5 backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Session resumed seamlessly within the 30-second window. Microphone is live!</span>
        </div>
      )}

      {/* Main Voice Interactive Stage */}
      <div className="relative glass-card rounded-3xl p-8 sm:p-12 flex flex-col items-center text-center overflow-hidden border border-white/[0.08]">
        {/* Ambient background glow orb */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Dynamic Voice State Indicator reacting to live audio amplitudes */}
        <div className="my-6 z-10">
          <StateIndicator state={voiceState} audioLevel={voiceState === 'speaking' ? agentVolume : micVolume} />
        </div>

        {/* Dynamic Interactive Controls */}
        <div className="flex items-center gap-3 mt-4 mb-4 z-10 flex-wrap justify-center">
          {!sessionActive ? (
            <button
              onClick={() => startVoiceSession(false)}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm sm:text-base px-8 py-4 rounded-2xl shadow-xl shadow-indigo-500/25 transition transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Mic className="w-5 h-5" />
              <span>Initialize Voice Session</span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 p-1.5 rounded-2xl bg-slate-900/90 border border-white/[0.08] shadow-2xl backdrop-blur-md flex-wrap justify-center">
              <button
                onClick={() => setIsMicMuted(!isMicMuted)}
                className={`p-3.5 rounded-xl border transition ${
                  isMicMuted
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-slate-200'
                }`}
                title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMicMuted ? <MicOff className="w-5 h-5 text-rose-400" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                onClick={handleToggleAgentMute}
                className={`p-3.5 rounded-xl border transition ${
                  agentMuted
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-slate-200'
                }`}
                title={agentMuted ? 'Unmute agent speaker' : 'Mute agent speaker'}
              >
                {agentMuted ? <VolumeX className="w-5 h-5 text-amber-400" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <button
                onClick={handleCyclePlaybackSpeed}
                className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs font-mono font-semibold transition"
                title={`Current voice speed: ${playbackSpeed}x. Click to cycle.`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{playbackSpeed}x</span>
              </button>

              <button
                onClick={triggerBargeIn}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs font-semibold transition"
                title="Interrupt agent mid-speech"
              >
                <Hand className="w-4 h-4 text-amber-400" />
                <span>Interrupt</span>
              </button>

              <button
                onClick={playTestChime}
                className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs font-semibold transition"
                title="Verify speaker audio output"
              >
                <Volume2 className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">Audio Check</span>
              </button>

              <button
                onClick={handleEndSession}
                className="inline-flex items-center gap-2 bg-rose-600/90 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm px-5 py-3 rounded-xl shadow-lg shadow-rose-600/20 transition"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End & Analyze</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 max-w-md z-10 leading-relaxed font-mono">
          {sessionActive
            ? 'Voice engine listening. Speak naturally into your microphone or use the response bar below.'
            : 'Click "Initialize Voice Session" and allow microphone permission when prompted.'}
        </p>
      </div>

      {/* Dual Conversation Stream (Agent vs Student) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Agent Turn Card */}
        <div className="glass-panel rounded-2xl p-6 border border-white/[0.08] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  AI Partner
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400">
                {voiceState === 'speaking' ? 'Speaking...' : 'Ready'}
              </span>
            </div>

            <div className="min-h-[100px] text-sm text-slate-200 leading-relaxed">
              {agentSpeech || agentSpeechDelta ? (
                <p>
                  <span>{agentSpeech}</span>{' '}
                  <span className="text-emerald-400 font-mono animate-pulse">{agentSpeechDelta}</span>
                </p>
              ) : (
                <span className="text-slate-500 italic text-xs font-mono">
                  Agent audio prompt will appear here as spoken...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Student Turn Card */}
        <div className="glass-panel rounded-2xl p-6 border border-white/[0.08] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06] flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition ${
                  micVolume > 10
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                    : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                }`}>
                  <Mic className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  You (Microphone)
                </span>
                {availableMics.length > 0 && (
                  <select
                    value={selectedMicId}
                    onChange={(e) => handleMicSelect(e.target.value)}
                    className="bg-slate-900/90 text-slate-300 text-[11px] font-mono border border-white/[0.08] rounded-lg px-2 py-0.5 focus:outline-none focus:border-indigo-500 max-w-[170px] sm:max-w-[220px] truncate cursor-pointer hover:border-white/[0.2] transition"
                    title="Select audio input device"
                  >
                    {availableMics.map((device, idx) => (
                      <option key={device.deviceId || idx} value={device.deviceId} className="bg-slate-900 text-slate-200">
                        {device.label || `Microphone ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Live VU / Audio Level Meter */}
              <div className="flex items-center gap-2">
                {sessionActive && (
                  <div className="flex items-center gap-1 h-3 px-2 py-0.5 rounded-full bg-slate-900 border border-white/[0.06]">
                    <span className="text-[9px] font-mono text-slate-400">VU:</span>
                    <div className="flex items-center gap-0.5">
                      <span className={`w-1 rounded-full transition-all duration-75 ${micVolume > 5 ? 'h-3 bg-emerald-400' : 'h-1 bg-slate-700'}`} />
                      <span className={`w-1 rounded-full transition-all duration-75 ${micVolume > 20 ? 'h-3.5 bg-emerald-400' : 'h-1 bg-slate-700'}`} />
                      <span className={`w-1 rounded-full transition-all duration-75 ${micVolume > 40 ? 'h-4 bg-teal-300' : 'h-1 bg-slate-700'}`} />
                      <span className={`w-1 rounded-full transition-all duration-75 ${micVolume > 65 ? 'h-4.5 bg-amber-400' : 'h-1 bg-slate-700'}`} />
                    </div>
                  </div>
                )}

                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-300">
                  {sttStatus === 'listening' ? 'STT Active' : sttStatus === 'transcribing' ? 'Transcribing...' : sttStatus === 'unsupported' ? 'Text Input Mode' : 'Mic Ready'}
                </span>
              </div>
            </div>

            <div className="min-h-[100px] text-sm text-slate-200 leading-relaxed">
              {userSpeech || userSpeechDelta ? (
                <p>
                  <span className="text-white font-medium">{userSpeech}</span>{' '}
                  <span className="text-indigo-400 font-mono italic animate-pulse">{userSpeechDelta}</span>
                </p>
              ) : (
                <div className="space-y-1 py-1">
                  <p className="text-slate-400 text-xs font-mono">
                    Speak into your microphone. Your spoken words will appear here in real-time.
                  </p>
                  {micVolume > 10 && (
                    <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5 animate-pulse">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Audio detected from your microphone!</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Response & Direct Interaction Bar */}
      {sessionActive && (
        <div className="glass-panel rounded-2xl p-4 border border-white/[0.08] space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendResponse();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder="Speak into microphone or type your answer here..."
                className="w-full pl-4 pr-10 py-3 bg-slate-900/90 border border-white/[0.1] rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono"
              />
              {micVolume > 15 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={!typedInput.trim()}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs sm:text-sm px-4 py-3 rounded-xl shadow-md transition"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>

          {/* Quick Reply Helper Prompts */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-400 font-mono text-[11px]">Quick prompts:</span>
            <button
              type="button"
              onClick={() => handleSendResponse("Could you give me a hint on this concept?")}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 text-[11px] transition"
            >
              💡 Ask for a hint
            </button>
            <button
              type="button"
              onClick={() => handleSendResponse("Can you give an example of how this works?")}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 text-[11px] transition"
            >
              🔍 Ask for an example
            </button>
            <button
              type="button"
              onClick={() => handleSendResponse("I'm ready for the next question.")}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 text-[11px] transition"
            >
              ⏩ Next question
            </button>
          </div>
        </div>
      )}

      {/* Real-Time Assessed Topics (Answer Quality Tags) */}
      <div className="glass-panel rounded-2xl p-6 border border-white/[0.08]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Real-time Evaluated Topics
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-md border border-white/[0.06]">
            {topicResults.length} Assessed
          </span>
        </div>

        {topicResults.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-slate-500 font-mono">
              Answer the AI agent's questions to see competency & retention tags (Strong, Partial, Weak) appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5 pt-1">
            {topicResults.map((item, idx) => (
              <TopicBadge
                key={idx}
                topic={item.topic}
                status={item.status}
                notes={item.notes}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

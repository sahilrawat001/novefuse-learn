import { buildSystemPrompt, ASSEMBLYAI_TOOLS, resolveTurnDetection } from '../src/services/promptBuilder.js';
import {
  handleLogAnswerQuality,
  handleEndSessionSummary,
  handleSessionEnd,
  getSessionSummaryInMemory,
  getSessionTopicsInMemory,
} from '../src/services/toolHandlers.js';

async function runTests() {
  console.log('🧪 Starting Voice Study Agent Integration & Unit Tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Test Prompt Builder for Revision Mode
  console.log('--- 1. Testing Prompt Builder (Revision Mode) ---');
  const revPrompt = buildSystemPrompt({
    mode: 'revision',
    title: 'Photosynthesis & Cellular Respiration',
    content: 'Light reactions produce ATP and NADPH.',
    weakTopics: ['Calvin Cycle', 'Krebs Cycle'],
  });

  assert(
    revPrompt.greeting.includes('Photosynthesis & Cellular Respiration'),
    'Revision greeting includes material title'
  );
  assert(
    revPrompt.systemPrompt.includes('Calvin Cycle, Krebs Cycle'),
    'Revision system prompt injects known weak topics'
  );
  assert(
    revPrompt.systemPrompt.includes('log_answer_quality'),
    'Revision system prompt instructs calling log_answer_quality'
  );

  // 2. Test Prompt Builder for Interview Mode
  console.log('\n--- 2. Testing Prompt Builder (Interview Mode) ---');
  const interviewPrompt = buildSystemPrompt({
    mode: 'interview',
    title: 'Senior Frontend Engineer',
    content: 'Requires proficiency in React, WebSockets, and state design.',
  });

  assert(
    interviewPrompt.greeting.includes("Senior Frontend Engineer"),
    'Interview greeting includes target role'
  );
  assert(
    interviewPrompt.systemPrompt.includes('STAR method'),
    'Interview system prompt emphasizes STAR method evaluation'
  );

  // 2b. Test Custom Configuration Parameters
  console.log('\n--- 2b. Testing Custom Configuration Builder ---');
  const customRevPrompt = buildSystemPrompt({
    mode: 'revision',
    title: 'Cellular Respiration',
    content: 'Glycolysis, Krebs Cycle, ETC',
    weakTopics: ['Glycolysis'],
    config: {
      focusTopics: ['Krebs Cycle', 'Electron Transport Chain'],
      difficulty: 'exam_prep',
      customWeakTopics: ['ATP Synthase'],
    },
  });

  assert(
    customRevPrompt.systemPrompt.includes('Krebs Cycle, Electron Transport Chain'),
    'Custom focus topics injected into revision prompt'
  );
  assert(
    customRevPrompt.systemPrompt.includes('Glycolysis, ATP Synthase'),
    'Merged custom and historical weak topics injected'
  );
  assert(
    customRevPrompt.systemPrompt.includes('Comprehensive Exam Prep'),
    'Exam prep difficulty instructions injected'
  );

  const customInterviewPrompt = buildSystemPrompt({
    mode: 'interview',
    title: 'Staff Infrastructure Engineer',
    content: 'Distributed systems, Kubernetes, consensus protocols.',
    config: {
      company: 'Stripe',
      roleLevel: 'lead',
      interviewType: 'system_design',
      focusCompetencies: ['Raft Consensus', 'Multi-region failover'],
      candidateNotes: '8 years distributed systems lead',
    },
  });

  assert(
    customInterviewPrompt.greeting.includes('Staff Infrastructure Engineer at Stripe'),
    'Company and role included in custom interview greeting'
  );
  assert(
    customInterviewPrompt.systemPrompt.includes('Staff / Lead'),
    'Lead seniority guidance included in prompt'
  );
  assert(
    customInterviewPrompt.systemPrompt.includes('System Design & Scalability'),
    'System design interview style guidance included'
  );
  assert(
    customInterviewPrompt.systemPrompt.includes('Raft Consensus, Multi-region failover'),
    'Focus competencies included in prompt'
  );

  // 2c. Test Adaptive Difficulty Prompt Directives
  console.log('\n--- 2c. Testing Adaptive Difficulty Directives ---');
  assert(
    customRevPrompt.systemPrompt.includes('Adaptive Difficulty & Real-Time Pacing'),
    'Revision prompt includes Adaptive Difficulty & Real-Time Pacing directives'
  );
  assert(
    customRevPrompt.systemPrompt.includes('last 2-3 answers were "strong"'),
    'Revision prompt instructs going harder on strong streak'
  );
  assert(
    customRevPrompt.systemPrompt.includes('Break the concept down into simpler foundational steps'),
    'Revision prompt instructs easing up on struggle'
  );
  assert(
    customInterviewPrompt.systemPrompt.includes('Adaptive Pacing & Candidate Calibration'),
    'Interview prompt includes Adaptive Pacing & Candidate Calibration directives'
  );

  // 2d. Test Turn-Detection Tuning Resolver
  console.log('\n--- 2d. Testing Turn-Detection Tuning Resolver ---');
  const revTurn = resolveTurnDetection('revision', 'exam_prep');
  assert(revTurn.isNeural === true, 'Revision mode defaults to ~300ms neural semantic turn detection');

  const rapidTurn = resolveTurnDetection('revision', 'rapid_drill');
  assert(rapidTurn.isNeural === false && rapidTurn.minSilence === 200 && rapidTurn.maxSilence === 600, 'Rapid drill provides ultra-snappy pacing (200ms / 600ms)');

  const snappyPreset = resolveTurnDetection('interview', undefined, { preset: 'snappy' });
  assert(snappyPreset.isNeural === false && snappyPreset.minSilence === 200 && snappyPreset.maxSilence === 600, 'Snappy preset enforces ultra-fast turn-taking');

  const interviewTurn = resolveTurnDetection('interview');
  assert(interviewTurn.isNeural === true, 'Interview mode defaults to neural semantic turn detection');

  const customTurn = resolveTurnDetection('revision', undefined, { minSilence: 850, maxSilence: 2800 });
  assert(customTurn.minSilence === 850 && customTurn.maxSilence === 2800 && customTurn.isNeural === false, 'Custom millisecond turn detection overrides defaults');

  // 3. Test Tool Definitions
  console.log('\n--- 3. Testing Tool Definitions ---');
  assert(ASSEMBLYAI_TOOLS.length === 2, 'Two tools configured (log_answer_quality, end_session_summary)');
  const toolNames = ASSEMBLYAI_TOOLS.map((t) => t.name);
  assert(toolNames.includes('log_answer_quality'), 'log_answer_quality tool is declared');
  assert(toolNames.includes('end_session_summary'), 'end_session_summary tool is declared');

  // 4. Test Tool Handlers & Session Lifecycle
  console.log('\n--- 4. Testing Tool Handlers & Durability ---');
  const testSessionId = 'test-session-' + Date.now();
  const testStudentId = 'test-student-1';
  const startedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

  await handleLogAnswerQuality(testSessionId, testStudentId, {
    topic: 'Calvin Cycle',
    status: 'weak',
    notes: 'Could not explain ATP consumption during carbon fixation',
  });

  await handleLogAnswerQuality(testSessionId, testStudentId, {
    topic: 'Light Reactions',
    status: 'strong',
    notes: 'Accurately described photolysis of water in thylakoid membrane',
  });

  const loggedTopics = getSessionTopicsInMemory(testSessionId);
  assert(loggedTopics.length === 2, 'Both topic results recorded immediately in-memory');
  assert(loggedTopics[0].status === 'weak', 'First topic status recorded as weak');
  assert(loggedTopics[1].status === 'strong', 'Second topic status recorded as strong');

  // 5. Test Session End & Cost Calculation
  console.log('\n--- 5. Testing Session End & Cost Calculation ---');
  const endResult = await handleSessionEnd(
    testSessionId,
    startedAt,
    'Student: Hello\nAgent: Hi, what is the Calvin Cycle?\nStudent: It uses light.\nAgent: Actually, it uses ATP.'
  );

  assert(endResult.durationMinutes >= 4.9, 'Duration calculated in minutes accurately');
  assert(
    Math.abs(endResult.apiCostEstimateUsd - (endResult.durationMinutes * 0.075)) < 0.01,
    'api_cost_estimate_usd computed as duration_minutes * 0.075'
  );
  assert(
    endResult.summaryJson.weak_topics.includes('Calvin Cycle'),
    'Fallback summary correctly extracts weak topics from topic_results'
  );
  assert(
    endResult.summaryJson.topics_covered.includes('Light Reactions'),
    'Fallback summary correctly lists topics covered'
  );

  // 6. Test STAR Rubric Declaration & Durability
  console.log('\n--- 6. Testing STAR Rubric Declaration & Durability ---');
  const summaryTool = ASSEMBLYAI_TOOLS.find((t) => t.name === 'end_session_summary');
  const starProps = (summaryTool?.parameters as any)?.properties?.star_breakdown?.properties;
  assert(starProps !== undefined, 'end_session_summary declares star_breakdown');
  assert(starProps?.situation !== undefined, 'star_breakdown has situation schema');
  assert(starProps?.task !== undefined, 'star_breakdown has task schema');
  assert(starProps?.action !== undefined, 'star_breakdown has action schema');
  assert(starProps?.result !== undefined, 'star_breakdown has result schema');
  assert(starProps?.overall_hire_recommendation !== undefined, 'star_breakdown has overall_hire_recommendation');

  assert(
    interviewPrompt.systemPrompt.includes('star_breakdown'),
    'Interview system prompt instructs scoring with star_breakdown'
  );

  // 7. Test Local File Persistence Engine
  console.log('\n--- 7. Testing Local File Persistence Engine (FileStorage) ---');
  const { FileStorage } = await import('../src/db/fileStorage.js');
  const storedTopics = FileStorage.getTopicResults(testSessionId);
  assert(storedTopics.length === 2, 'FileStorage persisted both topic results');
  const storedSummary = FileStorage.getSessionSummary(testSessionId);
  assert(storedSummary !== undefined, 'FileStorage persisted session summary');

  console.log(`\n================================`);
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

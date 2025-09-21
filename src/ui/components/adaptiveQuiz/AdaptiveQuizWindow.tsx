'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventBus } from '@/lib/eventBus';
import { MarkdownText } from '@/ui/components/markdownText/MarkdownText';

type QuizTopic =
  | 'addition'
  | 'multiplication'
  | 'subtraction'
  | 'division'
  | 'single_integral'
  | 'double_integral'
  | 'derivative'
  | 'series_ratio'
  | 'series_root'
  | 'matrix_2x2_mul';

interface AdaptiveQuizWindowProps {
  topic?: string;
  windowId?: string;
}

interface Question {
  id: string;
  prompt: string;
  latexPrompt: string;
  answer: number;
  operands: number[];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildAdditionQuestion(level: number): Question {
  // Level bands
  // 1: 0-9, 2: 10-20, 3: up to 50, 4: up to 100, 5: up to 999
  let max = 9;
  if (level === 2) max = 20;
  else if (level === 3) max = 50;
  else if (level === 4) max = 100;
  else if (level >= 5) max = 999;

  const a = randomInt(0, max);
  const b = randomInt(0, max);
  const answer = a + b;
  const prompt = `What is ${a} + ${b}?`;
  const latexPrompt = `\\[ ${a} + ${b} = \\; ? \\]`;
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, prompt, latexPrompt, answer, operands: [a, b] };
}

function buildMultiplicationQuestion(level: number): Question {
  let max = 9; if (level === 2) max = 12; else if (level === 3) max = 20; else if (level === 4) max = 50; else if (level >= 5) max = 100;
  const a = randomInt(0, max); const b = randomInt(0, max);
  const answer = a * b; const prompt = `What is ${a} × ${b}?`;
  const latexPrompt = `\\[ ${a} \\;×\\; ${b} = \\; ? \\]`;
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, prompt, latexPrompt, answer, operands: [a, b] };
}

function buildSubtractionQuestion(level: number): Question {
  let max = 9; if (level === 2) max = 20; else if (level === 3) max = 50; else if (level === 4) max = 100; else if (level >= 5) max = 999;
  const a = randomInt(0, max); const b = randomInt(0, max);
  const x = Math.max(a, b), y = Math.min(a, b);
  const answer = x - y; const prompt = `What is ${x} - ${y}?`;
  const latexPrompt = `\\[ ${x} - ${y} = \\; ? \\]`;
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, prompt, latexPrompt, answer, operands: [x, y] };
}

function buildDivisionQuestion(level: number): Question {
  let max = 9; if (level === 2) max = 12; else if (level === 3) max = 50; else if (level === 4) max = 100; else if (level >= 5) max = 200;
  const b = randomInt(1, Math.max(1, Math.floor(max/2)));
  const q = randomInt(0, max);
  const a = b * q;
  const answer = q; const prompt = `What is ${a} ÷ ${b}?`;
  const latexPrompt = `\\[ ${a} \\div ${b} = \\; ? \\]`;
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, prompt, latexPrompt, answer, operands: [a, b] };
}

function buildMatrix2x2MulQuestion(level: number): Question {
  const r = () => randomInt(-3 - level, 3 + level);
  const A = [[r(), r()], [r(), r()]]; const B = [[r(), r()], [r(), r()]];
  const C = [
    [A[0][0]*B[0][0] + A[0][1]*B[1][0], A[0][0]*B[0][1] + A[0][1]*B[1][1]],
    [A[1][0]*B[0][0] + A[1][1]*B[1][0], A[1][0]*B[0][1] + A[1][1]*B[1][1]]
  ];
  const prompt = 'Compute the (1,1) entry of A·B (top-left).';
  const latexPrompt = `\\[ A=\\begin{bmatrix} ${A[0][0]} & ${A[0][1]} \\ \\ ${A[1][0]} & ${A[1][1]} \\end{bmatrix}, \quad B=\\begin{bmatrix} ${B[0][0]} & ${B[0][1]} \\ \\ ${B[1][0]} & ${B[1][1]} \\end{bmatrix} \\] \\[(A\\cdot B)_{1,1}=\\;? \\]`;
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, prompt, latexPrompt, answer: C[0][0], operands: [] };
}

function buildDoubleIntegralQuestion(level: number): Question {
  // Ask for evaluation of a simple separable integral numeric answer
  const a = randomInt(0, 2 + level); const b = randomInt(1, 3 + level);
  // ∫_0^a ∫_0^b 1 dx dy = a*b
  const answer = a * b;
  const latexPrompt = `\\[ I = \\int_{0}^{${a}} \\int_{0}^{${b}} 1 \\, dx \\, dy = \\; ? \\]`;
  const prompt = `Evaluate the double integral of 1 over rectangle [0,${b}]×[0,${a}].`;
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, prompt, latexPrompt, answer, operands: [a,b] };
}

function buildSingleIntegralQuestion(level: number): Question {
  // Generate ∫_0^u (ax^2 + bx + c) dx with integer result
  const a = 3 * randomInt(0, 2 + level); // multiple of 3
  const b = 2 * randomInt(0, 3 + level); // multiple of 2
  const c = randomInt(0, 5 + level);
  const upper = randomInt(1, 3 + level);
  const F = (x: number) => (a/3) * x*x*x + (b/2) * x*x + c * x;
  const answer = Math.round(F(upper) - F(0));
  const poly = `${a ? `${a}x^{2}` : ''}${a && (b||c) ? ' + ' : ''}${b ? `${b}x` : ''}${(b && c) ? ' + ' : ''}${(!b && c) ? `${c}` : (c ? `${c}` : (a||b? '' : '0'))}`;
  const latexPrompt = `\\[ \\int_{0}^{${upper}} (${poly}) \\, dx = \\; ? \\]`;
  const prompt = `Evaluate the definite integral of a quadratic from 0 to ${upper}.`;
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, prompt, latexPrompt, answer, operands: [] };
}

function buildDerivativeQuestion(level: number): Question {
  // f(x) = ax^2 + bx + c -> f'(x) at x0
  const a = randomInt(1, 3 + level);
  const b = randomInt(0, 4 + level);
  const c = randomInt(0, 5);
  const x0 = randomInt(0, 4 + level);
  const answer = 2*a*x0 + b;
  const latexPrompt = `\\[ f(x) = ${a}x^{2} + ${b}x + ${c}, \quad f'(${x0}) = \\; ? \\]`;
  const prompt = `Differentiate a quadratic and evaluate at x = ${x0}.`;
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, prompt, latexPrompt, answer, operands: [] };
}

function buildSeriesRatioQuestion(level: number): Question {
  // Geometric sequence a_n = r^n
  let r = randomInt(-3 - level, 3 + level);
  if (r === 0) r = 2; // avoid 0
  const answer = Math.abs(r);
  const latexPrompt = `\\[ a_n = (${r})^{n}, \quad L = \lim_{n\\to\\infty} \left| \frac{a_{n+1}}{a_n} \right| = \\; ? \\]`;
  const prompt = 'Use the ratio test: compute L.';
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, prompt, latexPrompt, answer, operands: [] };
}

function buildSeriesRootQuestion(level: number): Question {
  let r = randomInt(-3 - level, 3 + level);
  if (r === 0) r = 2;
  const answer = Math.abs(r);
  const latexPrompt = `\\[ a_n = (${r})^{n}, \quad L = \limsup_{n\\to\\infty} \sqrt[n]{|a_n|} = \\; ? \\]`;
  const prompt = 'Use the root test: compute L.';
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, prompt, latexPrompt, answer, operands: [] };
}

function normalizeTopic(raw?: string): QuizTopic {
  const s = String(raw || '').toLowerCase();
  if (/matrix/.test(s) && /(2x2|2\s*x\s*2|2 by 2)/.test(s)) return 'matrix_2x2_mul';
  if (/double\s*integral|∬/.test(s)) return 'double_integral';
  if (/integral|integration/.test(s)) return 'single_integral';
  if (/derivative|differentiate|d\//.test(s)) return 'derivative';
  if (/ratio\s*test/.test(s)) return 'series_ratio';
  if (/root\s*test/.test(s)) return 'series_root';
  if (/multiply|times|multiplication|x\b/.test(s)) return 'multiplication';
  if (/division|divide|÷|over\b/.test(s)) return 'division';
  if (/subtract|minus|subtraction/.test(s)) return 'subtraction';
  if (/add|plus|addition/.test(s)) return 'addition';
  return 'addition';
}

function displayTopicLabel(t: QuizTopic): string {
  switch (t) {
    case 'matrix_2x2_mul': return '2×2 matrix multiplication';
    case 'double_integral': return 'double integrals';
    case 'single_integral': return 'integration';
    case 'derivative': return 'derivatives';
    case 'series_ratio': return 'ratio test';
    case 'series_root': return 'root test';
    default: return t;
  }
}

function buildQuestion(topic: QuizTopic, level: number): Question {
  switch (topic) {
    case 'addition': return buildAdditionQuestion(level);
    case 'multiplication': return buildMultiplicationQuestion(level);
    case 'subtraction': return buildSubtractionQuestion(level);
    case 'division': return buildDivisionQuestion(level);
    case 'matrix_2x2_mul': return buildMatrix2x2MulQuestion(level);
    case 'double_integral': return buildDoubleIntegralQuestion(level);
    case 'single_integral': return buildSingleIntegralQuestion(level);
    case 'derivative': return buildDerivativeQuestion(level);
    case 'series_ratio': return buildSeriesRatioQuestion(level);
    case 'series_root': return buildSeriesRootQuestion(level);
    default:
      return buildAdditionQuestion(level);
  }
}

function parseNumberFromTranscript(text: string): number | null {
  const normalized = text.toLowerCase();
  // Extract last integer in the string if any
  const matches = normalized.match(/-?\d+/g);
  if (matches && matches.length) {
    const last = matches[matches.length - 1];
    const n = Number(last);
    if (Number.isFinite(n)) return n;
  }
  // Basic word-number mapping up to ninety-nine
  const map: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };
  const tokens = normalized.split(/[^a-z]+/g).filter(Boolean);
  let total = 0; let seen = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (map[t] !== undefined) {
      const base = map[t];
      // Try combine tens + ones
      if (base >= 20 && i + 1 < tokens.length && map[tokens[i + 1]] !== undefined && map[tokens[i + 1]] < 10) {
        total = base + map[tokens[i + 1]];
        seen = true;
        i++;
      } else {
        total += base;
        seen = true;
      }
    }
  }
  return seen ? total : null;
}

export function AdaptiveQuizWindow({ topic = 'addition', windowId }: AdaptiveQuizWindowProps) {
  const [level, setLevel] = useState<number>(1);
  const [streak, setStreak] = useState<number>(0);
  const [recentWrong, setRecentWrong] = useState<number>(0);
  const [question, setQuestion] = useState<Question>(() => buildQuestion(normalizeTopic(topic), 1));
  const [feedback, setFeedback] = useState<string>('');
  const [manualAnswer, setManualAnswer] = useState<string>('');
  const awaitingRef = useRef<boolean>(true);

  const nextQuestion = useCallback((harder: boolean | null) => {
    setFeedback('');
    // Compute target level synchronously based on current level
    let targetLevel = level;
    if (harder === true) targetLevel = Math.min(level + 1, 5);
    else if (harder === false) targetLevel = Math.max(level - 1, 1);

    setLevel(targetLevel);

    setTimeout(() => {
      const newQ = buildQuestion(normalizeTopic(topic), targetLevel);
      setQuestion(newQ);
      awaitingRef.current = true;
      eventBus.emit('quiz:question', { windowId, questionId: newQ.id });
    }, 0);
  }, [level, topic, windowId]);

  const handleAnswer = useCallback((value: number) => {
    if (!awaitingRef.current) return;
    awaitingRef.current = false;
    if (value === question.answer) {
      setFeedback('✅ Correct Answer!');
      setStreak(s => s + 1);
      setRecentWrong(w => Math.max(0, w - 1));
      eventBus.emit('quiz:answer_correct', { windowId, questionId: question.id, value });
      // Increase difficulty after short delay
      const shouldLevelUp = streak + 1 >= 2;
      if (shouldLevelUp) setStreak(0);
      setTimeout(() => nextQuestion(shouldLevelUp ? true : null), 600);
    } else {
      setFeedback(`❌ Incorrect. You said ${value}. Try again!`);
      setStreak(0);
      setRecentWrong(w => w + 1);
      eventBus.emit('quiz:answer_wrong', { windowId, questionId: question.id, value, correct: question.answer });
      // Open an explanation window
      const [a, b] = question.operands;
      const diff = Math.abs(value - question.answer);
      const explain = `## Why ${value} is not correct\n\nYou evaluated $${a} + ${b}$ and answered $${value}$.\n\nThe correct sum is $$${a} + ${b} = ${question.answer}$$\n\nThe difference is $|${value} - ${question.answer}| = ${diff}$.`;
      eventBus.emit('ui:open_window', {
        type: 'general',
        title: 'Explanation',
        content: explain,
        size: { width: 520, height: 320 }
      });
      // Decrease difficulty if multiple wrong recently
      const shouldLevelDown = recentWrong + 1 >= 2;
      setTimeout(() => nextQuestion(shouldLevelDown ? false : null), 800);
    }
  }, [nextQuestion, question, recentWrong, streak, windowId]);

  // Voice transcript listener
  useEffect(() => {
    const unsub = eventBus.on('speech:transcript', (data: { final?: string; fullText?: string }) => {
      const text = (data?.final || '').trim();
      if (!text) return;
      const parsed = parseNumberFromTranscript(text);
      if (parsed !== null) {
        handleAnswer(parsed);
      }
    });
    return () => { unsub(); };
  }, [handleAnswer]);

  const submitManual = useCallback(() => {
    const n = Number(manualAnswer.trim());
    if (Number.isFinite(n)) {
      handleAnswer(n);
      setManualAnswer('');
    }
  }, [handleAnswer, manualAnswer]);

  const header = useMemo(() => {
    const t = normalizeTopic(topic);
    return `### Adaptive Quiz (${displayTopicLabel(t)}) — Level ${level}`;
  }, [topic, level]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="p-3 border-b border-cyan-400/30 bg-gradient-to-r from-cyan-900/40 via-blue-900/30 to-purple-900/40">
        <div className="flex items-center justify-between">
          <MarkdownText className="text-sm">{header}</MarkdownText>
          <span className="text-[11px] text-cyan-200/90 bg-cyan-900/40 rounded px-2 py-1 border border-cyan-400/30">Answer by voice (preferred) — typing allowed</span>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-3 bg-black/20 rounded-b-xl">
        <MarkdownText className="text-base">
          {`**Question:** ${question.prompt}\n\n${question.latexPrompt}`}
        </MarkdownText>
        {feedback && (
          <div className="text-sm">
            <MarkdownText>{feedback}</MarkdownText>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <input
            value={manualAnswer}
            onChange={e => setManualAnswer(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitManual(); }}
            placeholder="Speak the answer… or type and press Enter"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-900/60 text-cyan-100 border border-cyan-500/30 outline-none focus:border-cyan-400/60"
          />
          <button onClick={submitManual} className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400/40">Submit</button>
          <button onClick={() => nextQuestion(null)} className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white border border-gray-500/40">Skip</button>
        </div>
      </div>
      <div className="border-t border-cyan-400/30 bg-black/20 px-3 py-2 text-xs text-cyan-200/80 flex justify-between">
        <span>Streak: {streak}</span>
        <span>Level: {level}</span>
      </div>
    </div>
  );
}

export default AdaptiveQuizWindow;



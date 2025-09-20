
'use client';

import { useState, useEffect } from 'react';
import { eventBus } from '@/lib/eventBus';
import type { Task } from '@/ai/types';

type OpenSidebar = 'ui' | 'input' | 'ai' | null;

interface DebugSidebarProps {
  inputStatus: 'idle' | 'listening' | 'processing' | 'error';
  aiStatus: 'idle' | 'processing' | 'ready' | 'error';
  apiBudget: { used: number; nextMs: number | null };
  openInputWindow: () => void;
  openAIWindow: () => void;
  openUserNotesWindow: () => void;
  openSystemOutputWindow: () => void;
  openGraphWindow: () => void;
  openBarGraphWindow: () => void;
  openPieChartWindow: () => void;
  openPreloadedImageWindow: () => void;
}

export function DebugSidebar({ 
  inputStatus, 
  aiStatus, 
  apiBudget, 
  openInputWindow, 
  openAIWindow, 
  openUserNotesWindow, 
  openSystemOutputWindow, 
  openGraphWindow, 
  openBarGraphWindow, 
  openPieChartWindow, 
  openPreloadedImageWindow 
}: DebugSidebarProps) {
  const [openSidebar, setOpenSidebar] = useState<OpenSidebar>(null);
  const [taskQueue, setTaskQueue] = useState<Task[]>([]);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [recentToolCalls, setRecentToolCalls] = useState<Array<{ task: Task; tool: string; params?: unknown; status: string; timestamp: number; result?: unknown }>>([]);
  const [inputBuffer, setInputBuffer] = useState<string>('');
  type SubmittedEntry = { kind: 'submitted'; id: string; text: string; source: string; timestamp: number };
  type RunEntry = { kind: 'run'; id: string; tool: string; description: string; timestamp: number; status: 'started' | 'completed' | 'failed'; result?: unknown; error?: unknown };
  type ActionLogEntry = SubmittedEntry | RunEntry;
  const [aiActionLog, setAiActionLog] = useState<ActionLogEntry[]>([]);

  useEffect(() => {
    const listeners = [
      // Input
      eventBus.on('input:voice_debug', (d: { bufferText?: string }) => {
        if (d && typeof d.bufferText === 'string') {
          setInputBuffer(d.bufferText);
        }
      }),
      eventBus.on('input:transcript_updated', (data: { transcript?: string }) => {
        try {
          const transcript = String(data?.transcript || '').trim();
          if (!transcript) return;
          const entry: SubmittedEntry = { kind: 'submitted', id: Math.random().toString(36).slice(2), text: transcript, source: 'transcript', timestamp: Date.now() };
          setAiActionLog(prev => [entry, ...prev].slice(0, 30));
        } catch {}
      }),

      // AI tasks lifecycle
      eventBus.on('ai:task_queue_updated', (tasks: Task[]) => setTaskQueue(tasks)),
      eventBus.on('ai:task_started', ({ task }: { task: Task }) => {
        setCurrentTask(task);
        setTaskQueue(prev => prev.filter(t => t.id !== task.id));
        const entry: RunEntry = { kind: 'run', id: task.id, tool: task.tool, description: task.description, timestamp: Date.now(), status: 'started' };
        setAiActionLog(prev => [entry, ...prev].slice(0, 30));
      }),
      eventBus.on('ai:task_completed', ({ task, result }: { task: Task; result: unknown }) => {
        setCurrentTask(null);
        setAiActionLog(prev => prev.map(e => (e.kind === 'run' && e.id === task?.id) ? { ...e, status: 'completed', result } as RunEntry : e));
      }),
      eventBus.on('ai:task_failed', ({ task, error }: { task: Task; error: unknown }) => {
        setCurrentTask(null);
        setAiActionLog(prev => prev.map(e => (e.kind === 'run' && e.id === task?.id) ? { ...e, status: 'failed', error } as RunEntry : e));
      }),
      eventBus.on('ai:tool_call_started', (data: { task: Task; tool: string; params?: unknown }) => {
        setRecentToolCalls(prev => [{ ...data, status: 'started', timestamp: Date.now() }, ...prev].slice(0, 5));
      }),
      eventBus.on('ai:tool_call_completed', (data: { task: Task; tool: string; result?: unknown }) => {
        setRecentToolCalls(prev => 
          prev.map(call => call.task.id === data.task.id ? { ...call, status: 'completed', result: data.result } : call)
        );
      }),
    ];

    return () => {
      listeners.forEach(off => off());
    };
  }, []);

  const toggleSidebar = (sidebar: OpenSidebar) => {
    setOpenSidebar(openSidebar === sidebar ? null : sidebar);
  };

  return (
    <div className="fixed right-0 top-0 h-full bg-gray-800/80 backdrop-blur-sm text-white p-4 w-80 z-20 overflow-y-auto">
      <div className="flex flex-col space-y-2">
        <button onClick={() => toggleSidebar('ui')} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          UI
        </button>
        <button onClick={() => toggleSidebar('input')} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
          Input
        </button>
        <button onClick={() => toggleSidebar('ai')} className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
          AI
        </button>
      </div>

      {openSidebar && <div className="mt-4 border-t border-gray-600 pt-4" />}

      {openSidebar === 'ui' && (
        <div>
          <h2 className="text-lg font-bold mb-2">UI Debug</h2>
          <div className="space-y-2">
            <button onClick={openInputWindow} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">Open Input Window</button>
            <button onClick={openAIWindow} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">Open AI Window</button>
            <button onClick={openUserNotesWindow} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">Open Personal Notes</button>
            <button onClick={openSystemOutputWindow} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">Open System Output</button>
            <button onClick={openGraphWindow} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">Open Line Graph</button>
            <button onClick={openBarGraphWindow} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">Open Bar Graph</button>
            <button onClick={openPieChartWindow} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">Open Pie Chart</button>
            <button onClick={openPreloadedImageWindow} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">Open Sample Image</button>
          </div>
        </div>
      )}

      {openSidebar === 'input' && (
        <div>
          <h2 className="text-lg font-bold">Input State</h2>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between"><span>Status:</span> <span className={`px-2 py-0.5 rounded ${inputStatus === 'listening' ? 'bg-red-500' : inputStatus === 'processing' ? 'bg-yellow-500' : inputStatus === 'error' ? 'bg-rose-600' : 'bg-gray-500'}`}>{inputStatus}</span></div>
            <div className="flex justify-between"><span>API Calls/min:</span> <span>{apiBudget.used}</span></div>
            {apiBudget.nextMs != null && <div className="flex justify-between"><span>Next Call In:</span> <span>{Math.max(0, Math.round(apiBudget.nextMs/1000))}s</span></div>}
          </div>

          <div className="mt-4">
            <h3 className="font-bold">Text Buffer</h3>
            <div className="mt-1 text-xs bg-gray-700/50 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap break-words">
              {inputBuffer ? inputBuffer : <span className="text-gray-400">Empty</span>}
            </div>
          </div>
        </div>
      )}

      {openSidebar === 'ai' && (
        <div>
          <h2 className="text-lg font-bold">AI State</h2>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between"><span>Status:</span> <span className={`px-2 py-0.5 rounded ${aiStatus === 'processing' ? 'bg-yellow-500' : aiStatus === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{aiStatus}</span></div>
          </div>

          <div className="mt-4">
            <h3 className="font-bold">Task Queue ({taskQueue.length})</h3>
            <ul className="mt-1 space-y-1 text-xs bg-gray-700/50 p-2 rounded">
              {taskQueue.map(task => (
                <li key={task.id} className="truncate">{task.tool}: {task.description}</li>
              ))}
              {taskQueue.length === 0 && <li className="text-gray-400">Empty</li>}
            </ul>
          </div>

          <div className="mt-4">
            <h3 className="font-bold">Current Task</h3>
            <div className="mt-1 text-xs bg-gray-700/50 p-2 rounded">
              {currentTask ? (
                <div>
                  <p><strong>ID:</strong> {currentTask.id}</p>
                  <p><strong>Tool:</strong> {currentTask.tool}</p>
                  <p><strong>Desc:</strong> {currentTask.description}</p>
                </div>
              ) : (
                <p className="text-gray-400">None</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h3 className="font-bold">Recent Tool Calls</h3>
            <ul className="mt-1 space-y-2 text-xs">
              {recentToolCalls.map((call, i) => (
                <li key={i} className="bg-gray-700/50 p-2 rounded">
                  <p><strong>Tool:</strong> {call.tool} ({call.status})</p>
                  <p className="truncate"><strong>Params:</strong> {JSON.stringify(call.params)}</p>
                  {call.status === 'completed' && <p className="truncate"><strong>Result:</strong> {JSON.stringify(call.result)}</p>}
                </li>
              ))}
              {recentToolCalls.length === 0 && <li className="text-gray-400">None</li>}
            </ul>
          </div>

          <div className="mt-4">
            <h3 className="font-bold">Action Log</h3>
            <ul className="mt-1 space-y-2 text-xs">
              {aiActionLog.map((entry, i) => (
                <li key={i} className="bg-gray-700/50 p-2 rounded">
                  {entry.kind === 'submitted' ? (
                    <div>
                      <p><strong>Submitted</strong> <span className="text-gray-300">({entry.source})</span></p>
                      <p className="truncate">{entry.text}</p>
                    </div>
                  ) : (
                    <div>
                      <p><strong>Run</strong>: {entry.tool} <span className="text-gray-300">({entry.status})</span></p>
                      <p className="truncate">{entry.description}</p>
                      {entry.status === 'completed' && !!entry.result && (
                        <p className="truncate"><strong>Result:</strong> {JSON.stringify(entry.result)}</p>
                      )}
                      {entry.status === 'failed' && !!entry.error && (
                        <p className="truncate text-rose-300"><strong>Error:</strong> {String(entry.error)}</p>
                      )}
                    </div>
                  )}
                </li>
              ))}
              {aiActionLog.length === 0 && <li className="text-gray-400">No actions yet</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

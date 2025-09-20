'use client';

import { useEffect, useState } from 'react';
import { eventBus } from '@/lib/eventBus';
import VoiceTaskListener from '@/input/VoiceTaskListener';
import { aiManager } from '@/ai';

type TaskItem = { id: string; text: string; timestamp: number; source: string };

type WindowData = {
  id: string;
  type: string;
  title: string;
  content: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  context?: any;
  timestamp: number;
};

export function MainUI() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [debug, setDebug] = useState<any>({});
  const [windows, setWindows] = useState<WindowData[]>([]);
  const [logs, setLogs] = useState<{ level: 'info' | 'error'; message: string; data?: any; t: number }[]>([]);
  const [manual, setManual] = useState('');

  // Initialize AI worker once
  useEffect(() => {
    aiManager.initialize();
  }, []);

  // Bridge input tasks -> AI and keep local list
  useEffect(() => {
    const unsubTasks = eventBus.on('input:tasks', (data: { tasks: TaskItem[] }) => {
      setTasks(prev => [...data.tasks, ...prev].slice(0, 100));
      // Forward each task text to AI for parsing/execution
      data.tasks.forEach(task => aiManager.processTextCommand(task.text));
    });

    const unsubDebug = eventBus.on('input:voice_debug', (data: any) => {
      setDebug(data);
    });

    return () => {
      unsubTasks();
      unsubDebug();
    };
  }, []);

  // Listen to AI and UI events
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      eventBus.on('ai:text_command_processed', (data: any) => {
        setLogs(prev => [{ level: 'info', message: 'Text command processed', data, t: Date.now() }, ...prev].slice(0, 200));
      })
    );
    unsubs.push(
      eventBus.on('ai:ai_request_processed', (data: any) => {
        setLogs(prev => [{ level: 'info', message: 'AI request processed', data, t: Date.now() }, ...prev].slice(0, 200));
      })
    );
    unsubs.push(
      eventBus.on('ai:ai_response_generated', (data: any) => {
        setLogs(prev => [{ level: 'info', message: 'AI response generated', data, t: Date.now() }, ...prev].slice(0, 200));
      })
    );
    unsubs.push(
      eventBus.on('ai:ai_analysis_complete', (data: any) => {
        setLogs(prev => [{ level: 'info', message: 'AI analysis complete', data, t: Date.now() }, ...prev].slice(0, 200));
      })
    );
    unsubs.push(
      eventBus.on('ai:error', (error: any) => {
        setLogs(prev => [{ level: 'error', message: 'AI error', data: error, t: Date.now() }, ...prev].slice(0, 200));
      })
    );

    // Window open/close from tool executor
    unsubs.push(
      eventBus.on('ui:open_window', (data: WindowData) => {
        setWindows(prev => [data, ...prev].slice(0, 100));
      })
    );
    unsubs.push(
      eventBus.on('ui:close_window', (data: { windowId: string }) => {
        setWindows(prev => prev.filter(w => w.id !== data.windowId));
      })
    );

    // Mirror general window events to logs
    unsubs.push(
      eventBus.on('window:opened', (data: any) => {
        setLogs(prev => [{ level: 'info', message: `Window opened (${data?.type || 'window'})`, data, t: Date.now() }, ...prev].slice(0, 200));
      })
    );
    unsubs.push(
      eventBus.on('window:closed', (data: any) => {
        setLogs(prev => [{ level: 'info', message: 'Window closed', data, t: Date.now() }, ...prev].slice(0, 200));
      })
    );

    return () => {
      unsubs.forEach(u => u());
    };
  }, []);

  const statusColor = debug?.status === 'processing' ? 'bg-yellow-500' : debug?.status === 'listening' ? 'bg-green-500' : debug?.status === 'error' ? 'bg-red-500' : 'bg-gray-400';

  return (
    <div className="min-h-screen p-8">
      <VoiceTaskListener />

      {!debug?.isSupported && (
        <div className="mb-4 p-4 rounded bg-red-50 text-red-700">
          Speech recognition not supported in this browser.
        </div>
      )}

      {!debug?.isOnline && (
        <div className="mb-4 p-4 rounded bg-yellow-50 text-yellow-800">
          Network disconnected
        </div>
      )}

      <h1 className="text-2xl font-bold mb-6">Jarvis Debug UI</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 border rounded">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${statusColor}`} />
            <span className="font-semibold">Status:</span>
            <span>{debug?.status ?? 'idle'}</span>
          </div>
          {debug?.lastError && (
            <div className="text-red-600 text-sm mt-2">{debug.lastError}</div>
          )}
        </div>
        <div className="p-4 border rounded">
          <div className="font-semibold">API usage (last minute)</div>
          <div className="text-2xl">{debug?.apiCallsUsedLastMinute ?? 0} / 30</div>
          {typeof debug?.nextCallInMs === 'number' && (
            <div className="text-sm text-gray-600">Next call in ~{Math.ceil((debug.nextCallInMs as number)/100)/10}s</div>
          )}
        </div>
        <div className="p-4 border rounded">
          <div className="font-semibold">Buffer length</div>
          <div className="text-2xl">{debug?.bufferLength ?? 0}</div>
        </div>
        <div className="p-4 border rounded">
          <div className="font-semibold mb-2">Manual command</div>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Type a command (e.g., open a sticky note)"
              className="flex-1 px-2 py-1 border rounded bg-transparent"
            />
            <button
              onClick={() => {
                if (manual.trim()) {
                  aiManager.processTextCommand(manual.trim());
                  setLogs(prev => [{ level: 'info', message: 'Manual command sent', data: { text: manual.trim() }, t: Date.now() }, ...prev].slice(0, 200));
                  setManual('');
                }
              }}
              className="px-3 py-1 border rounded hover:bg-gray-50"
            >Send</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-3">Emitted Tasks</h2>
          {tasks.length === 0 ? (
            <div className="text-gray-500">Speak to create tasks...</div>
          ) : (
            <ul className="space-y-2">
              {tasks.map(t => (
                <li key={t.id} className="p-3 bg-gray-50 rounded border">
                  <div className="flex items-center justify-between">
                    <span>{t.text}</span>
                    <span className="text-xs text-gray-500">{new Date(t.timestamp).toLocaleTimeString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border rounded">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">AI Logs</h2>
            <button className="text-sm text-gray-600 hover:underline" onClick={() => setLogs([])}>Clear</button>
          </div>
          {logs.length === 0 ? (
            <div className="text-gray-500">No AI events yet...</div>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-auto">
              {logs.map((l, i) => (
                <li key={i} className={`p-2 rounded border ${l.level === 'error' ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={l.level === 'error' ? 'text-red-700 font-medium' : 'font-medium'}>{l.message}</span>
                    <span className="text-xs text-gray-500">{new Date(l.t).toLocaleTimeString()}</span>
                  </div>
                  {l.data && (
                    <pre className="whitespace-pre-wrap break-words text-xs mt-1 text-gray-700">{JSON.stringify(l.data, null, 2)}</pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 p-4 border rounded relative min-h-[300px]">
        <h2 className="text-lg font-semibold mb-3">Windows</h2>
        <div className="relative" style={{ minHeight: 240 }}>
          {windows.length === 0 ? (
            <div className="text-gray-500">Windows opened by AI will appear here.</div>
          ) : (
            <div className="relative">
              {windows.map(win => {
                const left = win.position?.x ?? 40;
                const top = win.position?.y ?? 40;
                const width = win.size?.width ?? 300;
                const height = win.size?.height ?? 200;
                return (
                  <div key={win.id} className="absolute border rounded shadow bg-white/90 backdrop-blur p-0 overflow-hidden" style={{ left, top, width, height }}>
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-600">{win.type}</span>
                        <span className="font-semibold">{win.title}</span>
                      </div>
                      <button
                        className="text-sm text-gray-600 hover:text-black"
                        onClick={() => {
                          eventBus.emit('ui:close_window', { windowId: win.id, timestamp: Date.now() });
                          eventBus.emit('window:closed', { windowId: win.id, timestamp: Date.now() });
                        }}
                        aria-label={`Close ${win.title}`}
                      >✕</button>
                    </div>
                    <div className="p-3 text-sm h-full overflow-auto">
                      {win.content || (win.context?.content ?? '')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
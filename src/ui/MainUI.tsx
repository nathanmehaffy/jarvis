'use client';

import { useEffect, useState } from 'react';
import { eventBus } from '@/lib/eventBus';
import VoiceTaskListener from '@/input/VoiceTaskListener';

type TaskItem = { id: string; text: string; timestamp: number; source: string };

export function MainUI() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [debug, setDebug] = useState<any>({});

  useEffect(() => {
    const unsubTasks = eventBus.on('input:tasks', (data: { tasks: TaskItem[] }) => {
      setTasks(prev => [...data.tasks, ...prev].slice(0, 100));
    });
    const unsubDebug = eventBus.on('input:voice_debug', (data: any) => {
      setDebug(data);
    });
    return () => {
      unsubTasks();
      unsubDebug();
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

      <h1 className="text-2xl font-bold mb-6">Voice Task Debug</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
      </div>

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
    </div>
  );
}
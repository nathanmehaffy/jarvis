
'use client';

import { useState } from 'react';

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

  const toggleSidebar = (sidebar: OpenSidebar) => {
    setOpenSidebar(openSidebar === sidebar ? null : sidebar);
  };

  return (
    <div className="fixed right-0 top-0 h-full bg-gray-800/80 backdrop-blur-sm text-white p-4 w-64 z-20">
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
        </div>
      )}

      {openSidebar === 'ai' && (
        <div>
          <h2 className="text-lg font-bold">AI State</h2>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between"><span>Status:</span> <span className={`px-2 py-0.5 rounded ${aiStatus === 'processing' ? 'bg-yellow-500' : aiStatus === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{aiStatus}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

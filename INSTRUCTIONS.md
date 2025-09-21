Here is the detailed implementation document for your developer. It is self-contained and provides specific code and functional descriptions, adapted for the architecture of your main (`target`) repository.

---

## **Implementation Document: Integrating New Tools into Jarvis**

### **1. Introduction**

The goal of this initiative is to enhance the Jarvis application by integrating several new, powerful tools from a feature branch. This document outlines the step-by-step process for a developer to implement these features into the main codebase.

The integration will focus on preserving the advanced, stateful AI parsing architecture of the main branch while adding the following capabilities:
-   **Web Browsing & Content Interaction:** Opening URLs in a sandboxed webview, summarizing articles, and opening specific search results.
-   **Document Analysis:** Analyzing and summarizing PDF documents.
-   **Productivity Tools:** Simple task and reminder management.

We will not be integrating data-driven tools (weather, news), image analysis, window grouping, or content-similarity connections. The concept of a `windowRegistry` will be integrated directly into the UI-to-AI context passing mechanism.

### **2. Prerequisite: Backend API Endpoints**

First, we need to create the server-side APIs that power these new features.

#### **2.1. New Dependencies**

Run the following command to add the necessary libraries for parsing web pages and PDFs:
```bash
npm install jsdom @mozilla/readability pdf-parse
```

#### **2.2. Create New API Route Files**

Create the following files and directories within `src/app/api/`.

**A. Article Fetching (`/api/fetch-article/route.ts`)**
This route uses reader mode to extract clean article text from a URL.

```typescript
// src/app/api/fetch-article/route.ts
import { NextRequest } from 'next/server';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url: string | undefined = body?.url;

    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: 'Valid url is required' }), { status: 400 });
    }

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }
    });

    if (!resp.ok) throw new Error(`Fetch HTTP ${resp.status}`);
    const html = await resp.text();

    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article) {
      return new Response(JSON.stringify({ error: 'Could not extract article content' }), { status: 422 });
    }

    return new Response(JSON.stringify({
      url: url,
      title: article.title || '',
      byline: article.byline || '',
      textContent: article.textContent || '',
      content: article.content || '',
    }), { status: 200 });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to parse article: ${msg}` }), { status: 500 });
  }
}
```

**B. PDF Analysis (`/api/analyze-pdf/route.ts`)**
This route accepts a PDF file upload, extracts its text, and uses Gemini to summarize it.

```typescript
// src/app/api/analyze-pdf/route.ts
import { NextRequest } from 'next/server';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string || 'Summarize this PDF and extract key bullet points.';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No PDF file provided' }), { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdfParse(buffer);
    const text = data.text || '';

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'Could not extract text from PDF' }), { status: 422 });
    }

    if (!process.env.GEMINI_API_KEY) {
      // Fallback to simple truncation if Gemini is not available
      const summary = text.split('.').slice(0, 5).join('.') + '.';
      return new Response(JSON.stringify({ summary }), { status: 200 });
    }
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(`${prompt}\n\n---\n\n${text.slice(0, 100000)}`);
    const summary = await result.response.text();

    return new Response(JSON.stringify({ summary }), { status: 200 });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
```

### **3. AI Core Integration**

Now, we'll integrate the new tools into the AI's "brain".

#### **3.1. Define New Tools (`src/ai/tools.ts`)**

Modify `src/ai/tools.ts` to include the new tool definitions. Replace the existing `AVAILABLE_TOOLS` array with the following comprehensive list:

```typescript
// src/ai/tools.ts
import { Tool } from './types';

export const AVAILABLE_TOOLS: Tool[] = [
  // ... Keep existing tools: organize_windows, edit_window, open_window, close_window, search ...

  // ADD THE FOLLOWING NEW TOOLS:
  {
    name: 'open_webview',
    description: 'Opens a sandboxed webview (iframe) to display a URL inside a window. Use this to show a webpage.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to load in the webview' },
        title: { type: 'string', description: 'Optional window title' }
      },
      required: ['url']
    }
  },
  {
    name: 'summarize_article',
    description: 'Reads a URL, extracts the main content, and generates a concise bullet-point summary in a new window.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Article URL to read and summarize' }
      },
      required: ['url']
    }
  },
  {
    name: 'open_search_result',
    description: 'Opens one of the links from the most recent search result. Use commands like "open the first link" or "show me the third result".',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number', description: '1-based index of the search result to open (default 1)' }
      },
      required: ['index']
    }
  },
  {
    name: 'analyze_pdf',
    description: 'Prompts the user to upload a PDF file, then analyzes and summarizes its content in a new window.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'A question or prompt about the PDF content, e.g., "Summarize this document."' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'create_task',
    description: 'Creates a new task in the task list. Use for reminders like "remind me to..." or "add a task to...".',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The title or content of the task' },
        due: { type: 'string', description: 'An optional due date or time in natural language (e.g., "tomorrow at 5pm")' }
      },
      required: ['title']
    }
  },
  {
    name: 'view_tasks',
    description: 'Opens a window displaying the current list of tasks.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'set_reminder',
    description: 'Schedules a one-time notification to appear at a future time.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The reminder message to display' },
        time: { type: 'string', description: 'When to send the reminder, in natural language (e.g., "in 10 minutes", "at 3:30pm")' }
      },
      required: ['message', 'time']
    }
  }
];
// ... keep getToolByName and getAllToolNames functions ...
```

#### **3.2. Implement Tool Execution Logic (`src/ai/toolExecutor.ts`)**

Add the execution logic for the new tools.

1.  **Add `case` statements** for each new tool inside the `switch (task.tool)` block in the `executeTask` method:

    ```typescript
    // src/ai/toolExecutor.ts -> executeTask()
    // ... inside switch block ...
        case 'open_webview':
          result = await this.executeOpenWebView(task);
          break;
        case 'summarize_article':
          result = await this.executeSummarizeArticle(task);
          break;
        case 'open_search_result':
          result = await this.executeOpenSearchResult(task, uiContext);
          break;
        case 'analyze_pdf':
          result = await this.executeAnalyzePdf(task);
          break;
        case 'create_task':
          result = await this.executeCreateTask(task);
          break;
        case 'view_tasks':
          result = await this.executeViewTasks(task);
          break;
        case 'set_reminder':
          result = await this.executeSetReminder(task);
          break;
    // ...
    ```

2.  **Add the new `execute...` methods** to the `ToolExecutor` class. Place this code before the `generateWindowId` method.

    ```typescript
    // src/ai/toolExecutor.ts

    private async executeOpenWebView(task: Task): Promise<ExecutionResult> {
      const params = task.parameters as { url: string; title?: string };
      if (!params.url) throw new Error('open_webview requires a URL');
      
      const windowId = this.generateWindowId();
      const windowData = {
        id: windowId,
        type: 'webview',
        title: params.title || params.url,
        // The 'content' will be the URL, which the WindowManager will use to render an iframe
        content: params.url,
        timestamp: Date.now()
      };
      
      eventBus.emit('ui:open_window', windowData);
      return { taskId: task.id, success: true, result: { windowId }, timestamp: Date.now() };
    }

    private async executeSummarizeArticle(task: Task): Promise<ExecutionResult> {
      const params = task.parameters as { url: string };
      if (!params.url) throw new Error('summarize_article requires a URL');

      eventBus.emit('system:output', { text: `Reading article: ${params.url}...\n` });
      const resp = await fetch('/api/fetch-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: params.url })
      });

      if (!resp.ok) throw new Error(`Failed to fetch article (HTTP ${resp.status})`);
      const article = await resp.json();
      
      const summary = `**Summary of: [${article.title}](${article.url})**\n\n${article.textContent.substring(0, 1500)}...`;

      const windowId = this.generateWindowId();
      eventBus.emit('ui:open_window', {
        id: windowId,
        type: 'summary',
        title: `Summary: ${article.title}`,
        content: summary
      });

      return { taskId: task.id, success: true, result: { windowId }, timestamp: Date.now() };
    }

    private async executeOpenSearchResult(task: Task, uiContext: any): Promise<ExecutionResult> {
      const params = task.parameters as { index: number };
      const index = Math.max(0, (params.index || 1) - 1);

      const searchWindows = (uiContext?.windows || [])
        .filter((w: any) => w.id.includes('search-results'))
        .sort((a: any, b: any) => b.zIndex - a.zIndex);

      if (searchWindows.length === 0) throw new Error('No recent search results found.');
      
      const lastSearchWindow = searchWindows[0];
      const content = lastSearchWindow.content || '';
      const urls = Array.from(content.matchAll(/🔗 (https?:\/\/[^\s]+)/g)).map(m => m[1]);

      if (urls.length <= index) throw new Error(`Result index ${index + 1} is out of bounds.`);
      
      const urlToOpen = urls[index];
      return this.executeOpenWebView({
        ...task,
        parameters: { url: urlToOpen, title: `Result ${index + 1}` }
      });
    }

    private async executeAnalyzePdf(task: Task): Promise<ExecutionResult> {
      // This tool's primary job is to trigger the UI to show a file picker.
      const params = task.parameters as { prompt: string };
      eventBus.emit('ui:request_pdf_upload', { prompt: params.prompt });
      return { taskId: task.id, success: true, result: { message: 'PDF upload requested' }, timestamp: Date.now() };
    }

    private async executeCreateTask(task: Task): Promise<ExecutionResult> {
      const params = task.parameters as { title: string; due?: string };
      if (!params.title) throw new Error('create_task requires a title');
      
      const taskData = { ...params, id: `task_${Date.now()}` };
      eventBus.emit('tasks:create', taskData);

      // Optionally open the tasks window to show confirmation
      await this.executeViewTasks(task);

      return { taskId: task.id, success: true, result: { taskId: taskData.id }, timestamp: Date.now() };
    }

    private async executeViewTasks(task: Task): Promise<ExecutionResult> {
      const windowId = 'tasks-window'; // Use a singleton ID
      eventBus.emit('ui:open_window', {
        id: windowId,
        type: 'tasks',
        title: 'My Tasks'
      });
      return { taskId: task.id, success: true, result: { windowId }, timestamp: Date.now() };
    }

    private async executeSetReminder(task: Task): Promise<ExecutionResult> {
      const params = task.parameters as { message: string; time: string };
      if (!params.message || !params.time) throw new Error('set_reminder requires message and time');
      
      // The worker will parse the time and schedule the notification
      const parseDelay = (t: string): number | null => {
          // This is a simple parser, a more robust library could be used
          const now = Date.now();
          const minutesMatch = t.match(/in (\d+) minutes?/i);
          if (minutesMatch) return parseInt(minutesMatch[1], 10) * 60 * 1000;
          
          const timeMatch = t.match(/at (\d{1,2}):(\d{2})\s?(am|pm)?/i);
          if (timeMatch) {
              let hour = parseInt(timeMatch[1], 10);
              const minute = parseInt(timeMatch[2], 10);
              const isPm = (timeMatch[3] || '').toLowerCase() === 'pm';
              if (isPm && hour < 12) hour += 12;
              if (!isPm && hour === 12) hour = 0; // Midnight case

              const reminderDate = new Date();
              reminderDate.setHours(hour, minute, 0, 0);
              if (reminderDate.getTime() < now) reminderDate.setDate(reminderDate.getDate() + 1); // If time is in the past, schedule for tomorrow
              return reminderDate.getTime() - now;
          }
          return null;
      };

      const delay = parseDelay(params.time);
      if (delay === null) throw new Error(`Could not parse reminder time: "${params.time}"`);

      setTimeout(() => {
        eventBus.emit('ui:open_window', {
          id: `reminder-${Date.now()}`,
          type: 'notification',
          title: 'Reminder',
          content: params.message
        });
      }, delay);
      
      return { taskId: task.id, success: true, result: { scheduledIn: `${delay}ms` }, timestamp: Date.now() };
    }
    ```

#### **3.3. Teach the AI About New Tools (`src/ai/taskParser.ts`)**

Update the `systemPrompt` in `src/ai/taskParser.ts` to include examples of the new tools. This is crucial for the AI to learn how and when to use them.

```typescript
// src/ai/taskParser.ts

// Find the systemPrompt string and add the following examples within it.
// A good place is after the existing few-shot guidance.

// ... inside the systemPrompt string ...
'  * "summarize the article at example.com/news" → summarize_article { url: "http://example.com/news" }',
'  * "open the second link from my last search" → open_search_result { index: 2 }',
'  * "show me the page google.com" → open_webview { url: "https://google.com" }',
'  * "add a task to buy milk" → create_task { title: "buy milk" }',
'  * "remind me to check the oven in 15 minutes" → set_reminder { message: "check the oven", time: "in 15 minutes" }',
'  * "summarize this PDF about machine learning" → analyze_pdf { prompt: "Summarize this PDF about machine learning" }',
'  * "show my tasks" → view_tasks {}',
// ... continue with existing prompt ...
```

### **4. UI Implementation**

Finally, update the UI to handle the new window types and provide the necessary context to the AI.

#### **4.1. Integrated Window Registry (`src/ui/MainUI.tsx`)**

Modify `MainUI.tsx` to pass the current window state to the `AIManager` whenever it changes. This fulfills the "integrated window registry" requirement.

```typescript
// src/ui/MainUI.tsx

// ... inside MainUI component ...
<WindowManager
  ref={windowManagerRef}
  onWindowsChange={(windows) => {
    // ADD THIS LINE: This keeps the AI's context up-to-date
    aiManager.setUIContext({ windows });
  }}
>
// ... rest of the component
```

#### **4.2. New Window Type Handlers (`src/ui/components/WindowManager.tsx`)**

The `WindowManager` needs to know how to render the new window types.

1.  **Webview Component:** Create a new component to render the `iframe`.

    ```typescript
    // Create a new file: src/ui/components/webview/WebView.tsx
    'use client';
    import { useEffect, useState } from 'react';

    export function WebView({ url }: { url: string }) {
      const [proxyUrl, setProxyUrl] = useState('');

      useEffect(() => {
        // Use our own API as a proxy to help with CORS/iframe restrictions
        setProxyUrl(`/api/proxy-page?url=${encodeURIComponent(url)}`);
      }, [url]);

      if (!proxyUrl) return <div>Loading...</div>;

      return (
        <iframe
          src={proxyUrl}
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      );
    }
    ```

2.  **Tasks Component:** Create a component for the task list.

    ```typescript
    // Create a new file: src/ui/components/tasks/TasksWindow.tsx
    'use client';
    import { useEffect, useState } from 'react';
    import { eventBus } from '@/lib/eventBus';

    interface Task { id: string; title: string; due?: string; done: boolean; }

    export function TasksWindow() {
      const [tasks, setTasks] = useState<Task[]>([]);

      const loadTasks = () => {
        try {
          const stored = localStorage.getItem('jarvis.tasks') || '[]';
          setTasks(JSON.parse(stored));
        } catch { setTasks([]); }
      };

      useEffect(() => {
        loadTasks();
        const off = eventBus.on('tasks:create', loadTasks);
        return () => off();
      }, []);

      const toggleTask = (taskId: string) => {
        const newTasks = tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t);
        setTasks(newTasks);
        localStorage.setItem('jarvis.tasks', JSON.stringify(newTasks));
      };

      return (
        <div className="p-4 text-cyan-200">
          {tasks.length === 0 ? <p>No tasks yet.</p> : (
            <ul className="space-y-2">
              {tasks.map(task => (
                <li key={task.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                  <span className={task.done ? 'line-through text-gray-500' : ''}>{task.title}</span>
                  {task.due && <span className="text-xs text-gray-400">({task.due})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    ```

3.  **Update `WindowManager.tsx` to use the new components.** Modify the `ui:open_window` event listener to select the correct component based on `type`.

    ```typescript
    // src/ui/components/WindowManager.tsx
    import { WebView } from '../webview/WebView'; // ADD IMPORT
    import { TasksWindow } from '../tasks/TasksWindow'; // ADD IMPORT

    // ... inside the useEffect for eventBus listeners ...
    eventBus.on('ui:open_window', (data: { /* ... */ type?: string; content?: string }) => {
      // ...
      let component: React.ComponentType<{ content?: string }>;
      
      switch (data.type) {
        case 'webview':
          component = () => <WebView url={data.content || ''} />;
          break;
        case 'tasks':
          component = TasksWindow;
          break;
        // ... keep existing cases for search-results and the default case ...
        default:
          component = ({ content }) => (
            <div className="p-4 overflow-auto h-full"><MarkdownText>{content || ''}</MarkdownText></div>
          );
      }
      // ... call openWindow with the determined component
    });
    ```

#### **4.3. PDF Upload UI Trigger**

In `MainUI.tsx`, listen for the `ui:request_pdf_upload` event to open a file dialog. When a file is selected, POST it to the `analyze-pdf` API.

```typescript
// src/ui/MainUI.tsx
// ... inside MainUI component's useEffect
useEffect(() => {
    // ...
    const unsub = eventBus.on('ui:request_pdf_upload', async (data: { prompt: string }) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            eventBus.emit('system:output', { text: `Uploading and analyzing ${file.name}...\n` });

            const formData = new FormData();
            formData.append('file', file);
            formData.append('prompt', data.prompt);

            try {
                const resp = await fetch('/api/analyze-pdf', { method: 'POST', body: formData });
                if (!resp.ok) throw new Error(`Analysis failed: HTTP ${resp.status}`);
                
                const result = await resp.json();
                windowManagerRef.current?.openWindow({
                    id: `pdf-summary-${Date.now()}`,
                    title: `Summary: ${file.name}`,
                    component: () => <div className="p-4 overflow-auto h-full"><MarkdownText>{result.summary}</MarkdownText></div>,
                    content: result.summary,
                    // ... other window props
                });
            } catch (error) {
                eventBus.emit('system:output', { text: `Error analyzing PDF: ${error instanceof Error ? error.message : String(error)}\n` });
            }
        };
        input.click();
    });
    // ...
    return () => { unsub(); /* ... other unsubs ... */ };
}, []);
```

### **5. Testing and Verification**

After implementing the above changes, test the new functionality with voice commands:
-   `"Summarize the article at [URL]"`
-   `"Open google.com in a window"`
-   `"Search for recent AI advancements"`, followed by `"Open the first result"`
-   `"Summarize this PDF about quantum computing"` (should trigger file upload)
-   `"Add a task to call John"`
-   `"Show my tasks"`
-   `"Remind me to take a break in 25 minutes"`

This detailed plan ensures that the new features are integrated cleanly, leveraging the strengths of the existing main branch architecture while expanding its capabilities significantly.

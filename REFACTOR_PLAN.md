Of course. We have a clear, agreed-upon plan. Here is the final refactoring document detailing the necessary changes, their locations, and the implementation strategy for each.

---

### **Final Refactoring Specification: Jarvis Prototype v2.0**

**Objective:** To refactor the Jarvis prototype by addressing key architectural inefficiencies and inconsistencies. The goal is to create a more robust, efficient, and maintainable system centered around a single, stateful AI processing core.

---

### **Change #1: Implement a Single, Stateful AI Processing Loop**

*   **Problem:** The current system uses an inefficient two-step AI call process (one to clean the transcript, one to parse it) and is stateless, leading to high latency and potential for redundant actions.
*   **Solution:** Convert the AI system into a single-call, stateful agent that processes a continuous transcript by comparing it against a history of its own recent actions.

#### **Implementation Details:**

1.  **`src/input/VoiceTaskListener.tsx`:**
    *   **Action:** Remove all `cerebrasClient` calls and logic for `extractTasksFromTranscript`.
    *   **New Logic:** The component's sole responsibility is to buffer the raw speech transcript. Upon detecting a natural pause, it will emit the *entire current transcript* to the event bus.
    *   **Event Change:** It will now emit `input:transcript_updated` with a `{ transcript: string }` payload, instead of `input:tasks`.

2.  **`src/ai/aiWorker.ts`:**
    *   **Action:** This worker must become stateful. Introduce a `ConversationState` object at the top level of the worker.
    *   **New State Interfaces:**
        ```typescript
        interface ActionRecord {
          actionId: string; // Unique ID for this action
          tool: string;
          parameters: Record<string, any>;
          sourceText: string; // The text snippet that triggered this action
          timestamp: number;
        }

        interface ConversationState {
          transcriptHistory: string; // Sliding window (e.g., last 2000 chars)
          actionHistory: ActionRecord[]; // Sliding window (e.g., last 10 actions)
          uiContext: any;
        }
        ```
    *   **New Logic:**
        *   On receiving `PROCESS_TEXT_COMMAND`, update `state.transcriptHistory` with the new transcript.
        *   Assemble the full `ConversationState` object and pass it to `taskParser.parseTextToTasks`.
        *   On receiving a response from the parser, iterate through the `new_tool_calls` array. For each call:
            1.  Generate a unique `actionId`.
            2.  Execute the tool call via `toolExecutor`.
            3.  Create an `ActionRecord` with the result.
            4.  Push the new `ActionRecord` to the `state.actionHistory`.
        *   Implement sliding window logic for both `transcriptHistory` and `actionHistory` to manage context size.

3.  **`src/ai/taskParser.ts`:**
    *   **Action:** The `parseTextToTasks` method signature will change to accept the `ConversationState` object.
    *   **New System Prompt:** Replace the existing system prompt with the following stateful, diffing-based prompt:
        ```plaintext
        You are Jarvis, an AI assistant. Your primary function is to analyze an ongoing speech transcript and identify any NEW user commands that have not yet been executed.

        You will receive a JSON input with the user's full transcript, your recent action history, and the current UI state.

        Your task is to:
        1.  Carefully read the entire `fullTranscript`.
        2.  Compare the user's commands in the transcript against the `actionHistory`.
        3.  Identify any explicit commands in the transcript that do NOT have a corresponding entry in the `actionHistory`.
        4.  If you find new, complete commands, respond with a JSON object containing a `new_tool_calls` array.
        5.  Each tool call in the array MUST include a `sourceText` property, containing the exact phrase from the transcript that justifies the action.
        6.  If there are no new commands, or if a command is incomplete (e.g., "open a graph showing..."), respond with an empty `new_tool_calls` array.
        7.  DO NOT re-issue tool calls for commands that are already present in the `actionHistory`.
        ```
    *   **API Response Format:** The Cerebras API call should now expect a JSON response structured as `{ "new_tool_calls": [...] }`.

---

### **Change #2: Unify UI State Management**

*   **Problem:** Window state is duplicated between `WindowManager.tsx` (React state) and `ai/windowRegistry.ts` (event-based replication), creating a risk of de-synchronization.
*   **Solution:** Establish `WindowManager` as the single source of truth for UI state and directly pipe this information to the AI manager.

#### **Implementation Details:**

1.  **`src/ai/windowRegistry.ts`:**
    *   **Action:** **Delete this file.** Its functionality will be replaced by a direct data flow.

2.  **`src/ui/MainUI.tsx`:**
    *   **Action:** Utilize the `onWindowsChange` prop of the `WindowManager` component.
    *   **New Logic:**
        ```tsx
        <WindowManager
          ref={windowManagerRef}
          onWindowsChange={(windows) => {
            // This is the direct pipe of truth to the AI system
            aiManager.setUIContext({ windows });
          }}
        >
          {/* ... */}
        </WindowManager>
        ```

3.  **`src/ai/AIManager.ts`:**
    *   **Action:** The `setUIContext` method is now the primary way the AI system learns about the UI. It should forward this context to the `aiWorker` so it can be included in the `ConversationState`.

4.  **`src/ai/toolExecutor.ts`:**
    *   **Action:** Remove the import and any usage of `windowRegistry`.
    *   **New Logic:** The method `executeTasks` must be updated to accept the `uiContext` as a parameter. When resolving selectors like "active" or "newest," it will now perform that logic on the `uiContext.windows` array that it receives, not on a separate registry.

---

### **Change #3: Consolidate Redundant Components**

*   **Problem:** Multiple components serve overlapping functions (`ImageWindow` vs. `Window`, and the trio of `SystemOutput`/`UserNotes`/`TextOutput`).
*   **Solution:** Refactor into fewer, more capable components to reduce code duplication and clarify purpose.

#### **Implementation Details:**

1.  **Window Components:**
    *   **Action:** **Delete `src/ui/components/imageWindow/ImageWindow.tsx`**.
    *   **Action:** In `src/ui/components/window/Window.tsx`, enhance the component to support the image window's features via props.
    *   **New Props:**
        *   `lockAspectRatio?: boolean`
        *   `headerStyle?: 'standard' | 'minimal'` (for the different title bar styles)
        *   `resizable?: boolean`
    *   **Action:** Modify the resize logic in `Window.tsx` to respect the `lockAspectRatio` prop when it's true.
    *   **Action:** In `WindowManager.tsx`, when an image window is created, it will now render a `<Window>` component with the appropriate new props set.

2.  **Output/Notes Components:**
    *   **Action:** **Delete the entire `src/ui/components/textOutput/` directory.**
    *   **Action:** Review `SystemOutput.tsx` to ensure it captures all necessary system-level log events. Its role as a *read-only system log* should be solidified.
    *   **Action:** `UserNotes.tsx` remains as the dedicated, *user-editable* scratchpad.
    *   **Action:** In `MainUI.tsx`, remove any UI elements or logic related to opening the "TextOutput" window.

---

### **Change #4: Eliminate the Local Parser for a Unified AI-First Approach**

*   **Problem:** The local/fallback parser is brittle, inconsistent with LLM behavior, and adds maintenance overhead.
*   **Solution:** Remove all non-LLM parsing logic. Handle API failures by notifying the user that the AI is unavailable, rather than degrading functionality.

#### **Implementation Details:**

1.  **`src/ai/taskParser.ts`:**
    *   **Action:** **Delete the `fallbackParsing` and `detectCloseCommand` methods.** The `parseTextToTasks` method will now only contain the logic to call the Cerebras API.

2.  **`src/ai/aiWorker.ts`:**
    *   **Action:** In the main `try...catch` block where `taskParser.parseTextToTasks` is called, modify the `catch` block.
    *   **New Logic:** Instead of calling a fallback parser, the `catch` block should immediately `postMessage({ type: 'AI_ERROR', data: { message: 'AI service unavailable', ...errorDetails } })` back to the main thread.

3.  **`src/ui/MainUI.tsx`:**
    *   **Action:** Implement a listener for the `ai:error` event.
    *   **New Logic:** When this event is caught, update the UI to show a clear, user-friendly error state (e.g., set `aiStatus` to `'error'`, display a toast notification). This becomes the new "graceful failure" mechanism. A simple retry with backoff can also be triggered from here.
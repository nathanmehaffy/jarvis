'use client';
import { useEffect, useState } from 'react';
import { eventBus } from '@/lib/eventBus';

interface Task {
  id: string;
  title: string;
  due?: string;
  done?: boolean;
  createdAt?: number;
}

export function TasksWindow() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const loadTasks = () => {
    try {
      const stored = localStorage.getItem('jarvis.tasks') || '[]';
      const parsedTasks = JSON.parse(stored);
      setTasks(Array.isArray(parsedTasks) ? parsedTasks : []);
    } catch {
      setTasks([]);
    }
  };

  const saveTasks = (updatedTasks: Task[]) => {
    try {
      localStorage.setItem('jarvis.tasks', JSON.stringify(updatedTasks));
      setTasks(updatedTasks);
    } catch (error) {
      console.error('Failed to save tasks:', error);
    }
  };

  useEffect(() => {
    loadTasks();

    const handleTaskCreate = (data: { title: string; due?: string; id?: string }) => {
      const newTask: Task = {
        id: data.id || `task_${Date.now()}`,
        title: data.title,
        due: data.due,
        done: false,
        createdAt: Date.now()
      };

      const updatedTasks = [...tasks, newTask];
      saveTasks(updatedTasks);
    };

    const unsubscribe = eventBus.on('tasks:create', handleTaskCreate);
    return () => unsubscribe();
  }, [tasks]);

  const toggleTask = (taskId: string) => {
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, done: !t.done } : t
    );
    saveTasks(updatedTasks);
  };

  const deleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    saveTasks(updatedTasks);
  };

  const addTask = () => {
    if (newTaskTitle.trim()) {
      const newTask: Task = {
        id: `task_${Date.now()}`,
        title: newTaskTitle.trim(),
        done: false,
        createdAt: Date.now()
      };

      const updatedTasks = [...tasks, newTask];
      saveTasks(updatedTasks);
      setNewTaskTitle('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTask();
    }
  };

  return (
    <div className="p-4 h-full flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">My Tasks</h2>

        {/* Add new task */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Add a new task..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={addTask}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="text-center text-slate-500 mt-8">
            <div className="text-4xl mb-2">📝</div>
            <p>No tasks yet.</p>
            <p className="text-sm mt-1">Add one above or say &quot;remind me to...&quot;</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks
              .sort((a, b) => {
                // Show incomplete tasks first, then sort by creation time
                if (a.done !== b.done) {
                  return a.done ? 1 : -1;
                }
                return (b.createdAt || 0) - (a.createdAt || 0);
              })
              .map(task => (
                <li key={task.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  task.done
                    ? 'bg-green-50 border-green-200'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={task.done || false}
                    onChange={() => toggleTask(task.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className={`block ${
                      task.done
                        ? 'line-through text-slate-500'
                        : 'text-slate-800'
                    }`}>
                      {task.title}
                    </span>
                    {task.due && (
                      <span className="text-xs text-slate-400 mt-1 block">
                        Due: {task.due}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-red-400 hover:text-red-600 transition-colors p-1"
                    title="Delete task"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Tasks summary */}
      {tasks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>{tasks.filter(t => !t.done).length} remaining</span>
            <span>{tasks.filter(t => t.done).length} completed</span>
          </div>
        </div>
      )}
    </div>
  );
}
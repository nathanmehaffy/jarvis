'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

export function SearchResultsWindow({ content }: { content: string }) {
  return (
    <div className="p-4 overflow-auto h-full bg-white/5 rounded-lg">
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-xl font-bold text-white mb-4 mt-2 first:mt-0">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold text-white mb-3 mt-4">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-medium text-white mb-2 mt-3">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="text-gray-200 mb-3 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="text-gray-200 mb-3 ml-4 space-y-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="text-gray-200 mb-3 ml-4 space-y-1">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-gray-200 leading-relaxed">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="text-white font-semibold">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="text-blue-200 italic">{children}</em>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-blue-400 pl-4 py-2 my-4 bg-blue-900/20 text-gray-200 italic">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="bg-gray-800 text-green-300 px-2 py-1 rounded text-sm font-mono">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-gray-900 text-gray-200 p-4 rounded-lg overflow-x-auto my-4 border border-gray-700">
                {children}
              </pre>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                className="text-blue-400 hover:text-blue-300 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

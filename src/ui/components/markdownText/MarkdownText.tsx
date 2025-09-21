'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { SimpleMarkdownText } from './SimpleMarkdownText';

interface MarkdownTextProps {
  children: string;
  className?: string;
}

export function MarkdownText({ children, className = '' }: MarkdownTextProps) {
  // Safety check for children
  if (!children || typeof children !== 'string') {
    return <div className={`text-cyan-400/60 text-sm italic ${className}`}>No content to display</div>;
  }

  try {
    return (
      <div className={`markdown-content ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
          components={{
        // Custom styling for markdown elements
        h1: ({ children }) => (
          <h1 className="text-xl font-bold text-cyan-100 mb-2 border-b border-cyan-400/30 pb-1">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold text-cyan-200 mb-2 mt-3">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-md font-medium text-cyan-300 mb-1 mt-2">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-cyan-200 mb-2 leading-relaxed">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-bold text-cyan-100">
            {children}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic text-cyan-200">
            {children}
          </em>
        ),
        code: ({ children, className }) => {
          const raw = String(children ?? '');
          // Pass through $$...$$ blocks directly so KaTeX renders them
          if (!className && /^\$\$[\s\S]*\$\$$/.test(raw.trim())) {
            return <div>{raw}</div>;
          }
          const isInline = !className;
          return isInline ? (
            <code className="bg-gray-800/50 text-green-300 px-1 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          ) : (
            <code className="block bg-gray-900/60 text-green-300 p-3 rounded-lg text-sm font-mono overflow-x-auto border border-gray-700/50">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-gray-900/60 p-3 rounded-lg overflow-x-auto border border-gray-700/50 mb-3">
            {children}
          </pre>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-cyan-200 mb-2 ml-4">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-cyan-200 mb-2 ml-4">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="mb-1">
            {children}
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-cyan-400/50 pl-4 italic text-cyan-300 bg-gray-800/20 py-2 mb-2 rounded-r">
            {children}
          </blockquote>
        ),
        hr: () => (
          <hr className="border-cyan-400/30 my-4" />
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="min-w-full border border-gray-700/50 rounded-lg">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="bg-gray-800/50 border border-gray-700/50 px-3 py-2 text-left text-cyan-100 font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-700/50 px-3 py-2 text-cyan-200">
            {children}
          </td>
        ),
        a: ({ children, href }) => (
          <a 
            href={href} 
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        )
      }}
    >
      {children}
    </ReactMarkdown>
      </div>
    );
  } catch (error) {
    console.error('ReactMarkdown rendering error, falling back to simple renderer:', error);
    // Fallback to simple markdown renderer
    return <SimpleMarkdownText className={className}>{children}</SimpleMarkdownText>;
  }
}

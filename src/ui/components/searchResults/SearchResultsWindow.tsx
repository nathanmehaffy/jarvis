'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import 'katex/dist/katex.min.css';

export function SearchResultsWindow({ content }: { content: string }) {
  return (
    <div className="p-4 h-full bg-white/5 rounded-lg">
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[
            rehypeRaw,
            [rehypeSanitize, {
              ...defaultSchema,
              tagNames: [
                ...(defaultSchema.tagNames || []),
                // KaTeX & MathML
                'span','div','math','semantics','mrow','mi','mo','mn','mfrac','msup','msub','msubsup','mtable','mtr','mtd','mspace','annotation',
                // Rich content
                'img','sup','sub','table','thead','tbody','tr','td','th'
              ],
              attributes: {
                ...(defaultSchema.attributes || {}),
                '*': ['className','style','aria-hidden','aria-label'],
                img: ['src','alt','title','width','height','loading','decoding'],
                td: ['colspan','rowspan'],
                th: ['colspan','rowspan']
              }
            }],
            rehypeKatex
          ]}
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
            // Ensure paragraphs break properly and avoid merged header styling
            p: ({ children }) => {
              return (
                <p className="text-gray-200 mb-3 leading-relaxed whitespace-pre-wrap break-words">{children}</p>
              );
            },
            ul: ({ children }) => (
              <ul className="text-gray-200 mb-3 ml-4 space-y-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="text-gray-200 mb-3 ml-4 space-y-1">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{children}</li>
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
            table: ({ children }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-gray-700 rounded-lg">
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className="bg-gray-800 border border-gray-700 px-3 py-2 text-left text-white/90 font-semibold">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-700 px-3 py-2 text-gray-200">
                {children}
              </td>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                className="text-blue-400 hover:text-blue-300 underline break-all"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            img: ({ src, alt, width, height }) => (
              <img
                src={typeof src === 'string' ? src : ''}
                alt={alt || ''}
                width={Number(width) || 500}
                height={Number(height) || 300}
                className="rounded-md object-cover"
              />
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
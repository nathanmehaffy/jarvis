'use client';

interface SimpleMarkdownTextProps {
  children: string;
  className?: string;
}

export function SimpleMarkdownText({ children, className = '' }: SimpleMarkdownTextProps) {
  // Simple fallback markdown renderer for when react-markdown fails
  const renderSimpleMarkdown = (text: string) => {
    if (!text) return '';
    
    return text
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-cyan-100">$1</strong>')
      // Italic text
      .replace(/\*(.*?)\*/g, '<em class="italic text-cyan-200">$1</em>')
      // Inline code
      .replace(/`(.*?)`/g, '<code class="bg-gray-800/50 text-green-300 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-md font-medium text-cyan-300 mb-1 mt-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold text-cyan-200 mb-2 mt-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-cyan-100 mb-2 border-b border-cyan-400/30 pb-1">$1</h1>')
      // Line breaks
      .replace(/\n/g, '<br/>');
  };

  try {
    const htmlContent = renderSimpleMarkdown(children);
    
    return (
      <div 
        className={`text-cyan-200 leading-relaxed ${className}`}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  } catch (error) {
    console.error('Simple markdown rendering error:', error);
    return (
      <div className={`text-cyan-200 leading-relaxed ${className}`}>
        {children}
      </div>
    );
  }
}

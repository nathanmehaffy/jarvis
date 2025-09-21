'use client';

import { useMemo } from 'react';
import { create, all } from 'mathjs';
import { LineGraph } from '@/ui/components/lineGraph/LineGraph';
import { MarkdownText } from '@/ui/components/markdownText/MarkdownText';

const math = create(all, {});

type IntegralGraphWindowProps = {
  expression: string;
  variable?: string;
  lower: number;
  upper: number;
  samples?: number;
  title?: string;
};

function sampleFunction(
  expr: string,
  variable: string,
  lower: number,
  upper: number,
  samples: number
): Array<{ x: number; y: number; label: string }> {
  const node = math.parse(expr);
  const code = node.compile();
  const data: Array<{ x: number; y: number; label: string }> = [];
  const n = Math.max(10, samples);

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = lower + (upper - lower) * t;
    let y = NaN;
    try {
      y = Number(code.evaluate({ [variable]: x }));
      if (!Number.isFinite(y)) y = NaN;
    } catch {}
    data.push({ x, y: Number.isFinite(y) ? y : NaN, label: `f(${x.toFixed(3)})` });
  }

  return data.filter(p => Number.isFinite(p.y));
}

export function IntegralGraphWindow({
  expression,
  variable = 'x',
  lower,
  upper,
  samples = 200,
  title
}: IntegralGraphWindowProps) {
  const data = useMemo(() => sampleFunction(expression, variable, lower, upper, samples), [expression, variable, lower, upper, samples]);

  const integralLatex = useMemo(() => {
    const escaped = expression.replace(/\*/g, '\\cdot ');
    return `\\[ \\int_{${lower}}^{${upper}} ${escaped}\\, d${variable} \\]`;
  }, [expression, variable, lower, upper]);

  const approx = useMemo(() => {
    if (data.length < 2) return undefined;
    let area = 0;
    for (let i = 1; i < data.length; i++) {
      const x0 = data[i-1].x, y0 = data[i-1].y;
      const x1 = data[i].x, y1 = data[i].y;
      area += 0.5 * (y0 + y1) * (x1 - x0);
    }
    return area;
  }, [data]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="p-4 border-b border-cyan-400/20">
        <MarkdownText className="text-sm">
          {`Integral Visual${title ? `: ${title}` : ''}\n\n${integralLatex}\n\nApproximate area: ${approx !== undefined ? approx.toFixed(4) : 'n/a'}`}
        </MarkdownText>
      </div>
      <div className="flex-1 p-4">
        <div className="h-full w-full">
          <LineGraph
            data={data}
            width={700}
            height={420}
            title="f(x)"
            xAxisLabel={variable}
            yAxisLabel="f(x)"
            shadeFromY={0}
            shadeBetweenX={{ from: lower, to: upper }}
            areaFill="rgba(59,130,246,0.18)"
            areaStroke="#60a5fa"
          />
        </div>
      </div>
    </div>
  );
}

export default IntegralGraphWindow;



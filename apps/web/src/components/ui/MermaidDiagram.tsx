import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid once with custom minimal theme
let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized) return;
  mermaidInitialized = true;

  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    themeVariables: {
      // Minimal, subtle colors matching the app
      primaryColor: '#f8fafc',
      primaryTextColor: '#374151',
      primaryBorderColor: '#e5e7eb',
      lineColor: '#d1d5db',
      secondaryColor: '#f1f5f9',
      tertiaryColor: '#ffffff',
      background: '#ffffff',
      mainBkg: '#ffffff',
      nodeBorder: '#e5e7eb',
      clusterBkg: '#f8fafc',
      titleColor: '#111827',
      edgeLabelBackground: '#ffffff',
      fontSize: '13px',
      fontFamily: 'Inter, system-ui, sans-serif',
      // Node styling
      nodeTextColor: '#374151',
    },
    flowchart: {
      curve: 'basis',
      padding: 12,
      nodeSpacing: 25,
      rankSpacing: 35,
      htmlLabels: true,
      useMaxWidth: false,
    },
  });
}

// Add global styles for clickable mermaid nodes
const clickableStyles = `
  /* Target the shape */
  .clickable rect, .clickable circle, .clickable path {
    cursor: pointer !important;
    transition: all 0.2s ease;
  }
  .clickable:hover rect, .clickable:hover circle, .clickable:hover path {
    stroke: #3b82f6 !important;
    stroke-width: 2px !important;
    filter: drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.06));
  }

  /* STYLE FOR EXPLICIT NODE HEADERS (Injected via HTML) */
  .node-header {
    color: #2563eb !important; /* text-blue-600 */
    font-weight: 500 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    text-decoration: none !important;
  }
  
  /* Ensure small tag remains consistent */
  small {
    color: #6b7280 !important; /* text-gray-500 */
    font-weight: 400 !important;
    font-family: Inter, system-ui, sans-serif !important;
  }
`;

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

let globalId = 0;

export function MermaidDiagram({
  chart,
  className = '',
}: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid_${globalId++}_${Date.now()}`);

  useEffect(() => {
    initMermaid();

    const renderChart = async () => {
      if (!chart) return;

      try {
        setError(null);
        const uniqueId = `${idRef.current}_${Math.random().toString(36).slice(2)}`;

        const { svg: renderedSvg } = await mermaid.render(
          uniqueId,
          chart
        );

        // Post-process SVG to add custom styling
        const styledSvg = renderedSvg
          // Make text smaller and use app font
          .replace(/font-size:\s*\d+px/g, 'font-size: 12px')
          .replace(
            /font-family:[^;]+/g,
            'font-family: Inter, system-ui, sans-serif'
          );

        setSvg(styledSvg);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to render chart'
        );
      }
    };

    renderChart();
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
        <p className="font-medium">Chart rendering error:</p>
        <pre className="mt-2 text-xs overflow-auto">{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="p-4 text-gray-400 text-sm">
        Loading diagram...
      </div>
    );
  }

  return (
    <div className={className}>
      <style>
        {`
          .mermaid-left-align svg {
            display: block !important;
            margin: 0 !important;
            max-width: none !important;
          }
          ${clickableStyles}
        `}
      </style>
      <div
        ref={containerRef}
        className="mermaid-left-align"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

export default MermaidDiagram;

import { useMemo, useState } from 'react';
import { MermaidDiagram } from '@/components/ui/MermaidDiagram';
import { formatDateTime, formatCurrency } from '@/utils/format';
import { OrderStatusSchema } from '@sync-erp/shared';

interface POTimelineProps {
  order: {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    computed?: {
      hasDpRequired?: boolean;
      isDpPaid?: boolean;
      actualDpPercent?: number;
      actualDpAmount?: number;
      totalBilled?: number;
      outstanding?: number;
    };
    invoices?: Array<{
      id: string;
      invoiceNumber: string | null;
      isDownPayment: boolean;
      amount: unknown;
      createdAt: Date;
      fulfillmentId: string | null;
    }>;
    fulfillments?: Array<{
      id: string;
      createdAt: Date;
      number: string;
      items?: Array<{ quantity: number }>;
    }>;
  };
  isUpfrontOrder?: boolean;
  totalAmount?: number;
}

// Color indicators as Unicode circles
const COLORS = {
  blue: '🔵',
  green: '🟢',
  purple: '🟣',
  amber: '🟠',
  emerald: '🟢',
  red: '🔴',
  gray: '⚪',
};

type Direction = 'LR' | 'TD';
type LayoutMode = 'adaptive' | 'auto' | 'manual';

export function POTimelineMermaid({
  order,
  isUpfrontOrder = false,
  totalAmount = 0,
}: POTimelineProps) {
  // View options state
  const [direction, setDirection] = useState<Direction>('LR');
  const [showMetadata, setShowMetadata] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [layoutMode, setLayoutMode] =
    useState<LayoutMode>('adaptive');

  const chart = useMemo(() => {
    const lines: string[] = [`graph ${direction}`];
    const styles: string[] = [];
    let nodeId = 0;

    const addNode = (
      label: string,
      colorKey: keyof typeof COLORS
    ): string => {
      const nodeKey = `N${nodeId++}`;
      const colorDot = COLORS[colorKey];
      const escapedLabel = label
        .replace(/"/g, "'")
        .replace(/\n/g, '<br/>');
      lines.push(`    ${nodeKey}("${colorDot} ${escapedLabel}")`);
      styles.push(
        `style ${nodeKey} fill:#fff,stroke:#e5e7eb,stroke-width:1px,color:#374151`
      );
      return nodeKey;
    };

    const addEdge = (from: string, to: string) => {
      lines.push(`    ${from} --> ${to}`);
    };

    // Helper for metadata display
    const meta = (text: string) =>
      showMetadata ? `<br/><small>${text}</small>` : '';

    // Build the timeline
    // Created
    const created = addNode(
      `Created${meta(formatDateTime(order.createdAt))}`,
      'blue'
    );
    let lastNode = created;

    // Confirmed
    if (
      order.status !== OrderStatusSchema.enum.DRAFT &&
      order.status !== OrderStatusSchema.enum.CANCELLED
    ) {
      const confirmed = addNode(
        `Confirmed${meta(formatDateTime(order.createdAt))}`,
        'green'
      );
      addEdge(lastNode, confirmed);
      lastNode = confirmed;
    }

    // DP Paid
    if (order.computed?.hasDpRequired && order.computed.isDpPaid) {
      const dpBill = order.invoices?.find((inv) => inv.isDownPayment);
      const dpDate = dpBill ? formatDateTime(dpBill.createdAt) : '';
      const dpAmount = order.computed.actualDpAmount || 0;
      const dpLabel = isUpfrontOrder
        ? `<span class='node-header'>Upfront Paid</span>${meta(`${dpDate}<br/>${formatCurrency(totalAmount)}`)}`
        : `<span class='node-header'>DP Paid</span>${meta(`${dpDate}<br/>DP ${order.computed.actualDpPercent}% = ${formatCurrency(dpAmount)}`)}`;
      const dpPaid = addNode(dpLabel, 'purple');
      if (dpBill) {
        lines.push(
          `    click ${dpPaid} "/bills/${dpBill.id}" "View DP Bill"`
        );
        lines.push(`    class ${dpPaid} clickable`);
      }
      addEdge(lastNode, dpPaid);
      lastNode = dpPaid;
    }

    // Get regular bills (non-DP)
    const regularBills =
      order.invoices?.filter((inv) => !inv.isDownPayment) || [];

    // GRN -> Bill flow (linked by fulfillmentId)
    if (order.fulfillments && order.fulfillments.length > 0) {
      // Create a map of fulfillmentId -> bill
      const billByFulfillment = new Map<
        string,
        (typeof regularBills)[0]
      >();
      regularBills.forEach((bill) => {
        if (bill.fulfillmentId) {
          billByFulfillment.set(bill.fulfillmentId, bill);
        }
      });

      // Build GRN chains: GRN -> Bill (if linked)
      const endNodes: string[] = [];

      order.fulfillments.forEach((grn) => {
        // Calculate total items in GRN
        const totalQty =
          grn.items?.reduce((sum, item) => sum + item.quantity, 0) ||
          0;
        // GRN node with more info
        const grnNode = addNode(
          `<span class='node-header'>${grn.number}</span>${meta(`${formatDateTime(grn.createdAt)}${totalQty > 0 ? `<br/>${totalQty} items` : ''}`)}`,
          'emerald'
        );
        lines.push(
          `    click ${grnNode} "/receipts/${grn.id}" "View GRN"`
        );
        lines.push(`    class ${grnNode} clickable`);
        addEdge(lastNode, grnNode);

        // Check if this GRN has a linked bill
        const linkedBill = billByFulfillment.get(grn.id);
        if (linkedBill) {
          const billNode = addNode(
            `<span class='node-header'>${linkedBill.invoiceNumber || 'Bill'}</span>${meta(`${formatDateTime(linkedBill.createdAt)} • ${formatCurrency(Number(linkedBill.amount))}`)}`,
            'blue'
          );
          lines.push(
            `    click ${billNode} "/bills/${linkedBill.id}" "View Bill"`
          );
          lines.push(`    class ${billNode} clickable`);
          addEdge(grnNode, billNode);
          endNodes.push(billNode);
        } else {
          endNodes.push(grnNode);
        }
      });

      // Bills without fulfillmentId (standalone bills)
      const standaloneBills = regularBills.filter(
        (b) => !b.fulfillmentId
      );
      standaloneBills.forEach((bill) => {
        const billNode = addNode(
          `<span class='node-header'>${bill.invoiceNumber || 'Bill'}</span>${meta(`${formatDateTime(bill.createdAt)} • ${formatCurrency(Number(bill.amount))}`)}`,
          'blue'
        );
        lines.push(
          `    click ${billNode} "/bills/${bill.id}" "View Bill"`
        );
        lines.push(`    class ${billNode} clickable`);
        addEdge(lastNode, billNode);
        endNodes.push(billNode);
      });

      // Final status
      if (
        order.status === OrderStatusSchema.enum.COMPLETED ||
        order.status === OrderStatusSchema.enum.CANCELLED
      ) {
        const finalLabel =
          order.status === OrderStatusSchema.enum.COMPLETED
            ? `Completed${meta(formatDateTime(order.updatedAt))}`
            : `Cancelled${meta(formatDateTime(order.updatedAt))}`;
        const finalColor =
          order.status === OrderStatusSchema.enum.COMPLETED
            ? 'gray'
            : 'red';
        const final = addNode(finalLabel, finalColor);
        endNodes.forEach((n) => addEdge(n, final));
      }
    } else {
      // No GRNs - fallback to direct bill flow
      if (regularBills.length > 0) {
        const billNodes: string[] = [];
        regularBills.forEach((bill) => {
          const billNode = addNode(
            `<span class='node-header'>${bill.invoiceNumber || 'Bill'}</span>${meta(`${formatDateTime(bill.createdAt)} • ${formatCurrency(Number(bill.amount))}`)}`,
            'blue'
          );
          lines.push(
            `    click ${billNode} "/bills/${bill.id}" "View Bill"`
          );
          lines.push(`    class ${billNode} clickable`);
          addEdge(lastNode, billNode);
          billNodes.push(billNode);
        });

        // Final status
        if (
          order.status === OrderStatusSchema.enum.COMPLETED ||
          order.status === OrderStatusSchema.enum.CANCELLED
        ) {
          const finalLabel =
            order.status === OrderStatusSchema.enum.COMPLETED
              ? `Completed${meta(formatDateTime(order.updatedAt))}`
              : `Cancelled${meta(formatDateTime(order.updatedAt))}`;
          const finalColor =
            order.status === OrderStatusSchema.enum.COMPLETED
              ? 'gray'
              : 'red';
          const final = addNode(finalLabel, finalColor);
          billNodes.forEach((n) => addEdge(n, final));
        }
      } else {
        // Final status without bills
        if (
          order.status === OrderStatusSchema.enum.COMPLETED ||
          order.status === OrderStatusSchema.enum.CANCELLED
        ) {
          const final = addNode(
            order.status === OrderStatusSchema.enum.COMPLETED
              ? `Completed${meta(formatDateTime(order.updatedAt))}`
              : `Cancelled${meta(formatDateTime(order.updatedAt))}`,
            order.status === OrderStatusSchema.enum.COMPLETED
              ? 'gray'
              : 'red'
          );
          addEdge(lastNode, final);
        }
      }
    }

    return [...lines, ...styles].join('\n');
  }, [order, isUpfrontOrder, totalAmount, direction, showMetadata]);

  // Layout mode styles
  const containerStyle: React.CSSProperties = {
    transform: `scale(${zoom / 100})`,
    transformOrigin: 'top left',
    ...(layoutMode === 'manual' ? { cursor: 'grab' } : {}),
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 border-b pb-2">
        {/* Layout Mode */}
        <div className="flex items-center gap-1">
          <span className="font-medium">Layout:</span>
          <select
            value={layoutMode}
            onChange={(e) =>
              setLayoutMode(e.target.value as LayoutMode)
            }
            className="border rounded px-1 py-0.5 text-xs"
          >
            <option value="adaptive">Adaptive</option>
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        {/* Direction */}
        <div className="flex items-center gap-1">
          <span className="font-medium">Direction:</span>
          <button
            onClick={() =>
              setDirection(direction === 'LR' ? 'TD' : 'LR')
            }
            className="border rounded px-2 py-0.5 hover:bg-gray-100"
          >
            {direction === 'LR' ? '→ Horizontal' : '↓ Vertical'}
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <span className="font-medium">Zoom:</span>
          <input
            type="range"
            min="50"
            max="200"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-20"
          />
          <span>{zoom}%</span>
        </div>

        {/* Show Metadata */}
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={showMetadata}
            onChange={(e) => setShowMetadata(e.target.checked)}
            className="rounded"
          />
          <span>Show Details</span>
        </label>
      </div>

      {/* Diagram */}
      <style>
        {`
          .mermaid-scroll-container::-webkit-scrollbar {
            height: 8px; /* Thinner horizontal scrollbar */
            width: 8px; /* Thinner vertical scrollbar */
          }
          .mermaid-scroll-container::-webkit-scrollbar-track {
            background: transparent;
          }
          .mermaid-scroll-container::-webkit-scrollbar-thumb {
            background-color: #cbd5e1; /* slate-300 */
            border-radius: 4px;
          }
          .mermaid-scroll-container::-webkit-scrollbar-thumb:hover {
            background-color: #94a3b8; /* slate-400 */
          }
        `}
      </style>
      <div
        className={`mermaid-scroll-container overflow-x-auto overflow-y-hidden border rounded-lg bg-white/50 max-w-full mx-auto`}
        style={{
          maxHeight: '600px',
          width: layoutMode === 'adaptive' ? '100%' : 'fit-content',
        }}
      >
        <div style={containerStyle} className="min-w-fit">
          <MermaidDiagram
            chart={chart}
            className={layoutMode === 'adaptive' ? 'w-full' : ''}
          />
        </div>
      </div>
    </div>
  );
}

export default POTimelineMermaid;

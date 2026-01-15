import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import {
  CodeBracketIcon,
  BookOpenIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

function CodeBlock({
  title,
  code,
  language = 'bash',
}: {
  title?: string;
  code: string;
  language?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/50 overflow-hidden my-4">
      {title && (
        <div className="bg-muted px-4 py-2 border-b text-xs font-mono text-muted-foreground flex justify-between items-center">
          <span>{title}</span>
          <span className="uppercase text-[10px]">{language}</span>
        </div>
      )}
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm font-mono text-foreground leading-relaxed">
          <code>{code.trim()}</code>
        </pre>
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          API Documentation
        </h1>
        <p className="text-muted-foreground text-lg">
          Connect your applications with Sync ERP using our secure
          API.
        </p>
      </div>

      {/* Authentication Section */}
      <section id="authentication" className="space-y-4">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <ShieldCheckIcon className="h-6 w-6 text-primary" />
          <h2>Authentication</h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="mb-4">
              Authenticate requests by including your API key in the{' '}
              <code>Authorization</code> header using the Bearer
              scheme.
            </p>
            <CodeBlock
              title="Example Request Header"
              code={`Authorization: Bearer sk_ProductionKey123`}
            />
            <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md border border-yellow-200 mt-4">
              <strong>Security Note:</strong> Never expose your API
              keys in client-side code (browsers, mobile apps). Only
              use them from your backend servers.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Endpoints Section */}
      <section id="endpoints" className="space-y-4">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <CodeBracketIcon className="h-6 w-6 text-primary" />
          <h2>Core Endpoints</h2>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">
                POST /trpc/publicRental.createOrder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Create a new rental order from your platform.
              </p>
              <CodeBlock
                title="Payload (JSON)"
                language="json"
                code={`{
  "customerName": "John Doe",
  "customerPhone": "6281234567890",
  "startDate": "2024-03-20T10:00:00Z",
  "endDate": "2024-03-22T10:00:00Z",
  "items": [
    { "itemId": "uuid-of-item", "quantity": 1 }
  ],
  "externalId": "YOUR_ORDER_ID_123"
}`}
              />
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">
                POST /trpc/publicRental.confirmPayment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Confirm payment for an order. Triggers status update
                to AWAITING_CONFIRM.
              </p>
              <CodeBlock
                title="Payload (JSON)"
                language="json"
                code={`{
  "orderId": "uuid-of-order",
  "amount": 150000,
  "paymentMethod": "TRANSFER_BCA",
  "proofUrl": "https://example.com/receipt.jpg"
}`}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Webhooks Section */}
      <section id="webhooks" className="space-y-4">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <BookOpenIcon className="h-6 w-6 text-primary" />
          <h2>Webhooks</h2>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p>
              Receive real-time updates for order status changes and
              payments. Configure your webhook URL in the API key
              settings.
            </p>

            <h3 className="font-semibold text-lg mt-6">
              Signature Verification
            </h3>
            <p className="text-sm text-muted-foreground">
              Verify the webhook authenticity using the HMAC-SHA256
              signature in the <code>x-webhook-signature</code>{' '}
              header.
            </p>

            <CodeBlock
              title="Verification Example (Node.js)"
              language="javascript"
              code={`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return signature === digest;
}`}
            />

            <h3 className="font-semibold text-lg mt-6">
              Event Types
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>
                <code>order.created</code>: Triggered when a new order
                is created.
              </li>
              <li>
                <code>order.status_updated</code>: Triggered when
                order status changes (e.g. to CONFIRMED).
              </li>
              <li>
                <code>payment.received</code>: Triggered when a
                payment is marked as received.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

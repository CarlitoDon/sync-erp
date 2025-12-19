import { trpc } from '@/lib/trpc';

export default function TRPCTest() {
  // Simple test: fetch bills using tRPC
  const { data, isLoading, error } = trpc.bill.list.useQuery();

  if (isLoading)
    return <div className="p-4">Loading bills via tRPC...</div>;
  if (error)
    return (
      <div className="p-4 text-red-600">Error: {error.message}</div>
    );

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">✅ tRPC Working!</h2>
      <p className="mb-2">Fetched {data?.length || 0} bills</p>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

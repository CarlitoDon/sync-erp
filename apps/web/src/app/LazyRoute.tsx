import { Suspense, type ReactNode } from 'react';
import { LoadingState } from '@/components/ui';

export function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}


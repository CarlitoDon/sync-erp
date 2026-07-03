import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
<<<<<<< HEAD
      className={`rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 ${className}`}
=======
      className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}
>>>>>>> origin/dev
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div className={`p-6 pb-0 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
<<<<<<< HEAD
      className={`text-lg font-semibold text-slate-950 ${className}`}
=======
      className={`text-lg font-semibold text-gray-900 ${className}`}
>>>>>>> origin/dev
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
<<<<<<< HEAD
      className={`mt-1 text-sm text-slate-500 ${className}`}
=======
      className={`text-sm text-gray-500 mt-1 ${className}`}
>>>>>>> origin/dev
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

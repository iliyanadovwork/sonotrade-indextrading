import React from 'react';
import NextLink, { LinkProps } from 'next/link';

// Simple wrapper for Next.js Link to allow easy import aliasing
export const Link: React.FC<LinkProps & { className?: string; children: React.ReactNode }> = ({ children, ...props }) => (
  <NextLink {...props}>{children}</NextLink>
);

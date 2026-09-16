import '@inkforge/editor-content/content.css';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

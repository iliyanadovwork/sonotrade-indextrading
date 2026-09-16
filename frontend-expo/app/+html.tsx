import React from 'react';

const BG = 'rgb(10, 10, 10)';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ backgroundColor: BG }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no" />
        {/* Set bg before JS loads so there's no white flash */}
        <style dangerouslySetInnerHTML={{ __html: `html,body,#root{background-color:${BG};}` }} />
      </head>
      <body style={{ backgroundColor: BG }}>{children}</body>
    </html>
  );
}

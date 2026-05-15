import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://kev-o.kevinmurphywebdev.com'),
  title: {
    default: 'Kev-O — Ask anything about Kevin Murphy',
    template: '%s · Kev-O',
  },
  description:
    'Grounded AI assistant trained exclusively on Kevin Murphy\'s public work: blog posts, project case studies, resume, and the READMEs of his open-source AI artifacts. Hybrid retrieval over a corpus he wrote himself.',
  openGraph: {
    type: 'website',
    url: 'https://kev-o.kevinmurphywebdev.com',
    title: 'Kev-O — Ask anything about Kevin Murphy',
    description:
      'A small RAG-grounded chatbot trained on Kevin Murphy\'s blog, portfolio, resume, and OSS READMEs.',
    siteName: 'Kev-O',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kev-O — Ask anything about Kevin Murphy',
    description: 'Hybrid BM25 + Voyage rerank over Kevin\'s public corpus.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="grain">{children}</body>
    </html>
  );
}

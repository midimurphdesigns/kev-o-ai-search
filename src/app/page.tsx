import { KevOChat } from '@/components/KevOChat';
import { SITE } from '@/lib/brand';

const STARTER_PROMPTS = [
  'What did Kevin actually do on the FedNow rebuild?',
  'Which open-source AI projects should I look at first?',
  'Why did an anthropology major end up writing TypeScript?',
  'What is fieldops-mcp and why does it matter?',
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[820px] flex-col px-6 pt-[14vh] pb-32 md:px-8">
      <header className="mb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--color-ink-faint)]">
          a kevinmurphywebdev.com side door
        </p>
        <h1 className="mt-6 font-display italic font-normal leading-[0.95] text-[clamp(56px,9vw,96px)] tracking-[-0.02em]">
          Ask Kev-O.
        </h1>
        <p className="mt-6 max-w-[52ch] text-[clamp(17px,2.1vw,21px)] leading-[1.55] text-[color:var(--color-ink-muted)]">
          Grounded AI trained exclusively on Kevin&apos;s public corpus. Blog posts, project case studies, resume, OSS READMEs. He won&apos;t make stuff up. He&apos;ll cite his receipts.
        </p>
        <p className="mt-4 font-mono text-[12px] text-[color:var(--color-ink-faint)]">
          ←{' '}
          <a
            href={SITE.mainSite}
            className="underline decoration-[color:var(--color-divider)] underline-offset-[4px] hover:text-[color:var(--color-accent)] hover:decoration-[color:var(--color-accent)]"
          >
            back to kevinmurphywebdev.com
          </a>
        </p>
      </header>
      <KevOChat starters={STARTER_PROMPTS} />
    </main>
  );
}

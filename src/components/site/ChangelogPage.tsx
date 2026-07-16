import Link from "next/link";
import { SiteBreadcrumb } from "@/components/site/SiteBreadcrumb";
import {
  CHANGELOG_LIVE,
  CHANGELOG_PLANNED,
  CHANGELOG_SHARE_LINKS,
} from "@/lib/site/changelog-data";

function LcxLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="https://lcx.com"
      target="_blank"
      rel="noopener noreferrer"
      className="site-link"
    >
      {children}
    </a>
  );
}

export function ChangelogPage() {
  return (
    <div className="blog-root">
      <main className="blog-main site-page">
        <div className="blog-wrap site-page__wrap">
          <SiteBreadcrumb
            items={[{ label: "Home", href: "/" }, { label: "Changelog" }]}
          />

          <article className="site-prose site-prose--changelog">
            <div className="site-changelog-meta">
              <span className="site-badge site-badge--green">Beta Launch</span>
              <span className="site-badge site-badge--muted">
                February 16, 2026 · 1:00 PM CET
              </span>
            </div>

            <h1 className="site-changelog-title">Payagent is Live</h1>
            <p className="site-lead">
              Crypto payments for humans and AI agents. Create payment links, earn
              LCX token rewards, track payments in real time, and preview AI agent
              payment functionality. Built by <LcxLink>LCX</LcxLink> AI Labs.
            </p>

            <div className="site-callout">
              <p>
                Every AI agent will need a wallet, payment rails, and financial
                autonomy. Payagent is how they pay.
              </p>
            </div>

            <h2>What is Payagent</h2>
            <p>
              Payagent by <LcxLink>LCX (Liberty Crypto Exchange)</LcxLink> is the
              first crypto payment infrastructure built for both humans and AI
              agents. As AI systems evolve from tools into economic actors, they
              need the ability to pay APIs, buy compute, settle micro-transactions,
              and transact with other agents without human intervention.
            </p>
            <p>
              Payagent fills this gap. Free for humans to create payment links.
              Programmable payment rails for AI agents, firms, and developers via
              API. Flat LCX token fees. Non-custodial. On-chain settlement.
            </p>

            <h2>
              What is Live{" "}
              <span className="site-badge site-badge--green site-badge--inline">
                Live
              </span>
            </h2>
            <ul className="site-changelog-list">
              {CHANGELOG_LIVE.map((item) => (
                <li key={item.title} className="site-changelog-list__item">
                  <span className="site-changelog-list__dot site-changelog-list__dot--live" />
                  <div>
                    <h4>
                      {item.title}
                      {item.tag && (
                        <span className="site-badge site-badge--blue site-badge--inline">
                          {item.tag}
                        </span>
                      )}
                    </h4>
                    <p>{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <h2>
              What is Coming{" "}
              <span className="site-badge site-badge--amber site-badge--inline">
                Planned
              </span>
            </h2>
            <ul className="site-changelog-list">
              {CHANGELOG_PLANNED.map((item) => (
                <li key={item.title} className="site-changelog-list__item">
                  <span className="site-changelog-list__dot site-changelog-list__dot--planned" />
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <h2>The Opportunity</h2>
            <p>
              There will be 10 billion AI agents by 2030. Every one of them needs to
              pay and get paid. Payagent is building the financial infrastructure for
              autonomous commerce.
            </p>
            <p>
              Today, no one owns this space. Stripe is not crypto-native. Existing
              crypto wallets are not built for agents. Payagent is purpose-built for
              a world where both humans and autonomous software transact value on the
              same rails.
            </p>

            <div className="site-callout">
              <p>
                Payagent is live at <Link href="/">Payagent.co</Link>. Read the{" "}
                <Link href="/docs">documentation</Link> or{" "}
                <Link href="/">create your first payment link</Link>.
              </p>
            </div>

            <div className="site-share">
              <span>Share:</span>
              {CHANGELOG_SHARE_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </article>

          <footer className="blog-footer site-footer">
            <p>Payagent developed by LCX AI Labs. Beta product launch.</p>
            <p>
              <a
                href="https://lcx.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                LCX (Liberty Crypto Exchange)
              </a>
              {" · "}
              <Link href="/">Payagent.co</Link>
              {" · "}
              <Link href="/docs">Docs</Link>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

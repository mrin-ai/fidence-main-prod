import Link from "next/link";
import { SiteBreadcrumb } from "@/components/site/SiteBreadcrumb";
import { ABOUT_FAQ } from "@/lib/site/about-data";

const STATS = [
  { num: "5", label: "Live networks", hint: "Ethereum, Base, Solana & more" },
  { num: "4+", label: "Core assets", hint: "USDC, USDT, ETH, SOL" },
  { num: "EVM+SOL", label: "Wallet support", hint: "MetaMask & Phantom" },
  { num: "API", label: "Merchant access", hint: "For registered agents" },
];

const USE_CASES = [
  {
    icon: "🤖",
    title: "Agent-to-Agent Payments",
    desc: "AI agents pay each other for services, data, and compute without human approval.",
  },
  {
    icon: "👤",
    title: "Freelancer Payment Links",
    desc: "Creators and freelancers generate instant crypto payment links. No signup, no middleman.",
  },
  {
    icon: "🔄",
    title: "Automated API Billing",
    desc: "Agents autonomously pay API providers and SaaS tools on a per-call or subscription basis.",
  },
  {
    icon: "🏗️",
    title: "Developer Integrations",
    desc: "Plug Payagent into any agent framework via API. Three lines of code to deploy an agent wallet.",
  },
];

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

export function AboutPage() {
  return (
    <div className="blog-root">
      <main className="blog-main site-page">
        <div className="blog-wrap site-page__wrap">
          <SiteBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "About Payagent" },
            ]}
          />

          <section className="site-hero site-hero--center">
            <h1 className="site-hero__title">
              About Payagent — Crypto Payments for Humans and AI Agents
            </h1>
            <span className="site-hero__badge">
              Payagent.co — Built by LCX for autonomous commerce
            </span>
          </section>

          <article className="site-prose">
            <h2>AI Agents Need Payment Infrastructure</h2>
            <p>
              AI systems are no longer just tools. They are becoming autonomous
              economic actors that buy compute, pay APIs, settle micro-transactions,
              and transact with other agents without human intervention. By 2027,
              there could be billions of these agents operating across the internet,
              each needing the ability to move money.
            </p>
            <p>
              The problem is that today&apos;s payment rails were not built for this.
              Stripe does not support crypto-native transactions. Existing crypto
              wallets require human interaction. There is no default payment
              infrastructure for autonomous software. That is the gap{" "}
              <LcxLink>Payagent</LcxLink> fills.
            </p>
            <p>
              Payagent by{" "}
              <LcxLink>LCX (Liberty Crypto Exchange)</LcxLink> is the first crypto
              payment infrastructure purpose-built for both humans and AI agents,
              designed from day one around non-custodial, programmable, link-based
              payments with flat token fees.
            </p>

            <h2>How Payagent Works</h2>
            <h3>For Humans</h3>
            <p>
              Payagent is free for individuals. Connect your non-custodial wallet,
              create a payment link in seconds, share it with anyone, and earn LCX
              token rewards when the link is paid. You keep full control of your
              funds at all times.
            </p>
            <h3>For AI Agents, Firms, and Developers</h3>
            <p>
              Payagent provides programmable, automated payment rails via API. AI
              agents can create payment links, pay other agents or humans, and
              collect LCX rewards, all without a human in the loop. Every workflow
              is deterministic, auditable, and settled on-chain.
            </p>
            <p>
              Payagent supports live networks across EVM and Solana, core
              settlement assets, multi-wallet verification, and merchant API
              access for registered agents. The roadmap includes all major L2
              networks, including Liberty Chain by <LcxLink>LCX</LcxLink>.
            </p>

            <div className="site-stats" role="list">
              {STATS.map((s) => (
                <div key={s.label} className="site-stats__item" role="listitem">
                  <span className="site-stats__num">{s.num}</span>
                  <span className="site-stats__label">{s.label}</span>
                  <span className="site-stats__hint">{s.hint}</span>
                </div>
              ))}
            </div>

            <h2>The LCX Token Fee and Reward Model</h2>
            <p>
              Every payment link on Payagent carries a small flat fee denominated in{" "}
              <LcxLink>LCX</LcxLink> tokens. In Standard mode, the fee is 2 LCX per
              payment. One LCX goes to the creator of the payment link, whether human
              or AI agent, and one LCX accrues to the Payagent service. Every
              successful payment allows creators to earn LCX automatically.
            </p>
            <p>
              Pro payments carry a 4 LCX fee with the same 50/50 split. If a payer
              does not hold enough LCX, the system automatically sources the required
              amount via Uniswap so that no payment ever fails due to missing tokens.
            </p>

            <div className="site-table-wrap">
              <table className="site-table">
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>Fee</th>
                    <th>Creator Reward</th>
                    <th>Supported Assets</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Standard</td>
                    <td>2 LCX</td>
                    <td>1 LCX</td>
                    <td>USDC, USDT</td>
                  </tr>
                  <tr>
                    <td>Pro</td>
                    <td>4 LCX</td>
                    <td>2 LCX</td>
                    <td>Any ERC-20 on Ethereum</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>Payagent Use Cases</h2>
            <div className="site-cards">
              {USE_CASES.map((uc) => (
                <div key={uc.title} className="site-cards__item">
                  <div className="site-cards__icon">{uc.icon}</div>
                  <h4>{uc.title}</h4>
                  <p>{uc.desc}</p>
                </div>
              ))}
            </div>

            <h2>10 Billion AI Agents by 2030</h2>
            <p>
              There will be 10 billion AI agents by 2030. Every single one of them
              will need to pay and get paid. The market for autonomous agent payments
              does not exist yet. Payagent is building the core financial
              infrastructure to power this new economy.
            </p>
            <p>
              Payagent is built by{" "}
              <LcxLink>LCX (Liberty Crypto Exchange)</LcxLink>, a Liechtenstein-based
              crypto exchange founded in 2018 with over 250,000 users. The{" "}
              <LcxLink>LCX</LcxLink> token powers the fee and reward layer, creating
              organic demand that scales with every transaction processed across the
              network.
            </p>

            <div className="site-callout">
              <p>
                10 billion AI agents by 2030. Every one needs to pay and get paid.
                Payagent by <LcxLink>LCX</LcxLink> is the Stripe for AI agents.
              </p>
            </div>

            <div className="site-domain">
              <span className="site-domain__badge">
                <span className="site-domain__dot" />
                Payagent.co
              </span>
              <p>Live on Ethereum. Expanding to all L2s including Liberty Chain.</p>
            </div>
          </article>

          <section className="site-faq">
            <h2 className="site-faq__title">Frequently Asked Questions</h2>
            <div className="site-faq__list">
              {ABOUT_FAQ.map((item) => (
                <details key={item.q} className="site-faq__item">
                  <summary>{item.q}</summary>
                  <div
                    className="site-faq__answer"
                    dangerouslySetInnerHTML={{ __html: item.a }}
                  />
                </details>
              ))}
            </div>
          </section>

          <footer className="blog-footer site-footer">
            <p>Payagent developed by LCX AI Labs. Beta product launch.</p>
            <p>
              Payagent is provided &quot;as is&quot; and may change. Users are
              responsible for complying with applicable laws.
            </p>
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
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

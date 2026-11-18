import Image from "next/image";
import Link from "next/link";
import LucideIcon from "@/components/LucideIcon";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-glow not-found-glow-left" />
      <div className="not-found-glow not-found-glow-right" />

      <section className="not-found-inner">
        <div className="not-found-visual" aria-hidden="true">
          <span className="not-found-ring ring-one"><i className="orbit-moving-dot" /></span>
          <span className="not-found-ring ring-two"><i className="orbit-moving-dot is-mint" /></span>
          <span className="not-found-orbit-dot" />
          <strong className="not-found-number number-four-left">4</strong>
          <div className="not-found-tooth">
            <Image src="/tooth.png" alt="" fill sizes="210px" priority />
          </div>
          <strong className="not-found-number number-four-right">4</strong>
          <span className="not-found-status">
            <LucideIcon name="alert" size={17} /> Page not found
          </span>
        </div>

        <div className="not-found-copy">
          <span className="not-found-eyebrow">404 ERROR</span>
          <h1>This page missed the <span>treatment plan.</span></h1>
          <p>
            The page you are looking for may have moved, or the address may be
            incorrect. Let&apos;s get you back to a healthy workflow.
          </p>
          <div className="not-found-actions">
            <Link className="button button-primary" href="/">
              <LucideIcon name="arrowLeft" size={18} /> Back to home
            </Link>
            <Link className="button button-secondary" href="/platform">
              Explore platform <LucideIcon name="arrowRight" size={18} />
            </Link>
          </div>
          <small>Need help? <Link href="/book-demo">Book a demo</Link> with our team.</small>
        </div>
      </section>
    </main>
  );
}

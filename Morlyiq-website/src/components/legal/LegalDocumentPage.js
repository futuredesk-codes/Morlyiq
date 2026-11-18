import Link from "next/link";
import LucideIcon from "@/components/LucideIcon";

const effectiveDate = "November 18, 2026";

function LegalSection({ section, index }) {
  return (
    <section className="legal-section" id={section.id}>
      <span className="legal-section-number">{String(index + 1).padStart(2, "0")}</span>
      <div>
        <h2>{section.title}</h2>
        {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {section.bullets && (
          <ul>
            {section.bullets.map((item) => <li key={item}><LucideIcon name="check" size={14} /><span>{item}</span></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function LegalDocumentPage({ eyebrow, title, intro, icon, sections }) {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <span className="legal-glow legal-glow-left" />
        <span className="legal-glow legal-glow-right" />
        <div className="section-inner legal-hero-inner">
          <div className="legal-hero-copy">
            <span className="legal-label">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{intro}</p>
            <div className="legal-meta">
              <span><LucideIcon name="clock" size={16} /> Effective {effectiveDate}</span>
              <span><LucideIcon name="fileCheck" size={16} /> Version 1.0</span>
            </div>
          </div>
          <div className="legal-hero-visual" aria-hidden="true">
            <span className="legal-visual-orbit"><i className="orbit-moving-dot is-mint" /></span>
            <div className="legal-document-stack legal-document-stack-back" />
            <div className="legal-document-card">
              <span><LucideIcon name={icon} size={40} /></span>
              <i /><i /><i /><i />
              <b>MorlyIQ</b>
            </div>
          </div>
        </div>
      </section>

      <section className="legal-content-section">
        <div className="section-inner legal-content-layout">
          <aside className="legal-toc">
            <span>ON THIS PAGE</span>
            <nav aria-label={`${title} sections`}>
              {sections.map((section, index) => (
                <a href={`#${section.id}`} key={section.id}><b>{String(index + 1).padStart(2, "0")}</b>{section.title}</a>
              ))}
            </nav>
          </aside>

          <article className="legal-document">
            <div className="legal-summary">
              <span><LucideIcon name={icon} size={24} /></span>
              <p>This document applies to MorlyIQ website visitors, account holders and authorized users. Your order form or subscription agreement may include additional terms.</p>
            </div>
            {sections.map((section, index) => <LegalSection section={section} index={index} key={section.id} />)}
          </article>
        </div>
      </section>

      <section className="legal-help-section">
        <div className="section-inner legal-help-inner">
          <div><span>QUESTIONS?</span><h2>Talk to the MorlyIQ team.</h2><p>Contact us if you need help understanding these terms or how information is handled.</p></div>
          <div className="legal-help-actions">
            <a className="button button-white" href="mailto:morlyiq@gmail.com">morlyiq@gmail.com</a>
            <Link className="button button-outline-light" href="/security">View security</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
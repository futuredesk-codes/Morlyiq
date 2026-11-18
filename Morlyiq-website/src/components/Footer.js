import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="section-inner footer-main">
        <div className="footer-brand">
          <span className="footer-logo"><Image src="/morlyiq-logo.png" alt="MorlyIQ" width={30} height={30} /></span>
          <div><b>MorlyIQ</b><p>Dental insurance verification and revenue cycle, for practices with one clinic or many.</p></div>
        </div>
        <nav aria-label="Footer">
          <div><b>Product</b><Link href="/how-it-works">How it works</Link><Link href="/platform">Platform</Link><Link href="/pricing">Pricing</Link><Link href="/roles">Roles</Link></div>
          <div><b>Company</b><Link href="/security">Security</Link><Link href="/get-started">Get started</Link><Link href="/#demo">Contact</Link><Link href="/sign-in">Sign in</Link></div><div><b>Legal</b><Link href="/terms-and-conditions">Terms &amp; Conditions</Link><Link href="/privacy-policy">Privacy Policy</Link></div>
        </nav>
      </div>
      <div className="section-inner copyright">© 2026 MorlyIQ. Coverage estimates are supporting information, not a guarantee of approval or reimbursement.</div>
    </footer>
  );
}

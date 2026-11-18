"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

const links = [
  ["How it works", "/how-it-works"],
  ["Platform", "/platform"],
  ["Pricing", "/pricing"],
  ["Roles", "/roles"],
  ["Security", "/security"],
  ["Get started", "/get-started"],
];

export default function Header() {
  const pathname = usePathname();
  const mobileNavRef = useRef(null);
  const closeMobileNav = () => mobileNavRef.current?.removeAttribute("open");

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="MorlyIQ home">
        <span className="brand-mark"><Image src="/morlyiq-logo.png" alt="" fill sizes="44px" priority /></span>
        <span><strong>MorlyIQ</strong><small>SMARTER DENTAL OPERATIONS</small></span>
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        {links.map(([label, href]) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              className={isActive ? "active" : undefined}
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="header-actions">
        <Link className="sign-in" href="/sign-in">Sign in</Link>
        <Link className="button button-primary button-small" href="/book-demo">Book a demo</Link>
        <details className="mobile-nav" ref={mobileNavRef}>
          <summary aria-label="Open navigation"><span /><span /><span /></summary>
          <nav aria-label="Mobile navigation">
            {links.map(([label, href]) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  className={isActive ? "active" : undefined}
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={closeMobileNav}
                >
                  {label}
                </Link>
              );
            })}
            <Link href="/sign-in" onClick={closeMobileNav}>Sign in</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

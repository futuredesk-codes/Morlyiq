"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import LucideIcon from "@/components/LucideIcon";

const benefits = [
  ["clock", "30-minute walkthrough", "Verification, claims and remittances, using your clinics and roles."],
  ["people", "Bring your team", "Owners, managers and billing leads are all welcome."],
  ["support", "Already a customer?", <>Open a ticket from Support in your Client Panel, or email <a href="mailto:morlyiq@gmail.com">morlyiq@gmail.com</a>.</>],
];

const clinicOptions = ["1", "2–5", "6–15", "16+"];
const roleOptions = ["Owner", "Practice manager", "Billing", "Front desk", "Dentist", "Other"];

function BenefitIcon({ type }) { return <LucideIcon name={type === "people" ? "users" : type === "support" ? "lifeBuoy" : "clock"} size={22}/>; }

function ThemeSelect({ name, value, onChange, options, placeholder, invalid }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function close(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div className={`theme-select ${open ? "open" : ""} ${invalid ? "invalid" : ""}`} ref={rootRef}>
      <input type="hidden" name={name} value={value} />
      <button type="button" className="theme-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={value ? "selected-value" : "placeholder"}>{value || placeholder}</span>
        <LucideIcon name="chevronDown" size={20}/>
      </button>
      {open && <div className="theme-select-menu" role="listbox" aria-label={name}>
        {options.map((option) => <button type="button" role="option" aria-selected={value === option} key={option} onClick={() => { onChange(option); setOpen(false); }}><span>{option}</span>{value === option && <i><LucideIcon name="check" size={14}/></i>}</button>)}
      </div>}
    </div>
  );
}

export default function BookDemoPage() {
  const [sent, setSent] = useState(false);
  const [clinics, setClinics] = useState("");
  const [role, setRole] = useState("");
  const [selectError, setSelectError] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (!clinics || !role) {
      setSelectError(true);
      return;
    }
    setSelectError(false);
    setSent(true);
  }

  return <main className="book-demo-page"><section className="book-demo-section"><span className="book-demo-glow"/><div className="section-inner book-demo-layout">
    <div className="book-demo-copy"><span className="book-demo-label">BOOK A DEMO</span><h1>Let&apos;s look at <span>your practice</span> together.</h1><p>Tell us a little about your clinics and we&apos;ll tailor the walkthrough to the way your team works.</p><div className="book-demo-benefits">{benefits.map(([icon,title,copy]) => <article key={title}><span><BenefitIcon type={icon}/></span><div><h2>{title}</h2><p>{copy}</p></div></article>)}</div></div>
    <div className="book-demo-form-wrap"><span className="form-backdrop"/><span className="form-tooth"><Image src="/tooth.png" alt="" fill sizes="120px"/></span><div className="book-demo-form-card">{sent ? <div className="demo-success"><span><LucideIcon name="check" size={36}/></span><h2>Request received</h2><p>Thanks — our team will email you to pick a time that suits your schedule.</p><button type="button" onClick={() => setSent(false)}>Send another request</button></div> : <form onSubmit={submit}>
      <div className="form-two"><label><span className="field-title">Full name</span><input name="name" type="text" required autoComplete="name"/></label><label><span className="field-title">Work email</span><input name="email" type="email" required autoComplete="email"/></label></div>
      <div className="form-two"><label><span className="field-title">Practice name</span><input name="practice" type="text" required autoComplete="organization"/></label><label><span className="field-title">Phone <small>(optional)</small></span><input name="phone" type="tel" autoComplete="tel"/></label></div>
      <div className="form-two"><label><span className="field-title">Number of clinics</span><ThemeSelect name="clinics" value={clinics} onChange={(value) => { setClinics(value); setSelectError(false); }} options={clinicOptions} placeholder="Choose…" invalid={selectError && !clinics}/></label><label><span className="field-title">Your role</span><ThemeSelect name="role" value={role} onChange={(value) => { setRole(value); setSelectError(false); }} options={roleOptions} placeholder="Choose…" invalid={selectError && !role}/></label></div>
      {selectError && <p className="select-error-message">Please choose the number of clinics and your role.</p>}
      <label><span className="field-title">What would you like to see? <small>(optional)</small></span><textarea name="message" rows="4"/></label><button className="demo-submit" type="submit">Request a demo <LucideIcon name="arrowRight" size={18}/></button><p className="form-privacy">We&apos;ll only use these details to arrange your demo.</p>
    </form>}</div></div>
  </div></section></main>;
}

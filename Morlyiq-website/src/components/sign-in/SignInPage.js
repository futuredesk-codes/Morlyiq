"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LucideIcon from "@/components/LucideIcon";

export default function SignInPage(){
  const[showPassword,setShowPassword]=useState(false);
  const[recovering,setRecovering]=useState(false);
  const[recoverySent,setRecoverySent]=useState(false);
  function submitLogin(event){event.preventDefault()}
  function submitRecovery(event){event.preventDefault();setRecoverySent(true)}
  return <main className="signin-page">
    <section className="signin-showcase">
      <span className="signin-showcase-glow"/>
      <Link href="/" className="signin-brand"><span><Image src="/morlyiq-logo.png" alt="" fill sizes="34px"/></span><b>MorlyIQ</b></Link>
      <div className="signin-showcase-content">
        <div className="signin-dashboard-art" aria-hidden="true"><div className="signin-mini-dashboard"><b>Good morning</b><div><span><strong>4</strong><small>Pending</small></span><span><strong className="green">12</strong><small>Completed</small></span><span><strong className="red">1</strong><small>Failed</small></span></div><i><em/></i></div><span className="signin-tooth"><Image src="/tooth.png" alt="" fill sizes="120px"/></span><span className="signin-status"><i/>Eligibility completed · 9:02 AM</span><span className="signin-art-ring"><i className="orbit-moving-dot"/></span></div>
        <div><h1>Your morning, already verified.</h1><p>Sign in to check today&apos;s eligibility, work your claims and review remittances for your clinics.</p></div>
      </div>
    </section>
    <section className="signin-panel">
      <Link href="/" className="back-to-site"><LucideIcon name="arrowLeft" size={18}/><span>Back to site</span></Link>
      <div className="signin-form-wrap">
        {!recovering?<div className="signin-state"><h2>Sign in</h2><p>Welcome back to MorlyIQ.</p><form onSubmit={submitLogin}><label>Email<input type="email" required autoComplete="email"/></label><label>Password<span className="signin-password"><input type={showPassword?"text":"password"} required autoComplete="current-password"/><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?"Hide":"Show"}</button></span></label><button className="forgot-password" type="button" onClick={()=>setRecovering(true)}>Forgot password?</button><button className="signin-submit" type="submit">Sign in</button></form><div className="signin-invite"><b>Invited to MorlyIQ?</b> Use the link in your invitation email to create your password. New practice? <Link href="/book-demo">Book a demo</Link>.</div></div>:
        <div className={`signin-state recovery-state ${recoverySent?"sent":""}`}>{!recoverySent?<><h2>Reset your password</h2><p>Enter your account email and we&apos;ll send a secure reset link.</p><form onSubmit={submitRecovery}><label>Email<input type="email" required autoComplete="email"/></label><button className="signin-submit" type="submit">Send reset link</button></form></>:<><span className="recovery-icon success"><LucideIcon name="mail" size={30}/></span><h2>Check your inbox</h2><p>If an account matches that email, a reset link is on its way.</p></>}<button className="back-to-login" type="button" onClick={()=>{setRecovering(false);setRecoverySent(false)}}><LucideIcon name="arrowLeft" size={17}/> Back to sign in</button></div>}
      </div>
      <p className="signin-help">Need help? <a href="mailto:morlyiq@gmail.com">Contact support</a></p>
    </section>
  </main>;
}

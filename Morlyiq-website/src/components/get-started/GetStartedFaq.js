"use client";
import { useState } from "react";
const faqs=[
  ["What happens if checkout is interrupted?","Nothing is activated until payment is confirmed. You'll see a clear status and a way to retry or get help."],
  ["Can I use MorlyIQ before creating a clinic?","Yes. Account, billing and support pages work right away. Actions that need a clinic explain that and point you to clinic setup without blocking anything else."],
  ["My invitation link has expired. What now?","Expired, cancelled or replaced invitations show a plain message with a way to request a new one or contact support."],
  ["Can a staff member work at more than one clinic?","Yes. Each clinic assignment has its own role, so someone can be a Manager at one clinic and Billing at another."],
  ["What happens when a trial ends?","Clinical operations like verification and claims pause, while account access, billing and support stay available so you can continue."],
  ["Is a coverage estimate a guarantee of payment?","No. Procedure coverage and cost estimates are supporting information. They don't guarantee approval or reimbursement."],
];
export default function GetStartedFaq(){const[open,setOpen]=useState(0);return <section className="get-started-faq"><div className="section-inner get-started-faq-layout"><div><span className="kicker">FAQ</span><h2>Questions practices ask first.</h2><p>Still curious? <a href="mailto:morlyiq@gmail.com">Talk to our team</a>.</p></div><div className="faq-list">{faqs.map(([question,answer],index)=><article className={open===index?"open":""} key={question}><button type="button" aria-expanded={open===index} onClick={()=>setOpen(open===index?-1:index)}><span>{question}</span><i>{open===index?"−":"+"}</i></button>{open===index&&<p>{answer}</p>}</article>)}</div></div></section>}

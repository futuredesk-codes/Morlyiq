"use client";
import { useState } from "react";
import LucideIcon from "@/components/LucideIcon";

const modules = ["Dashboard","Patients & eligibility","Clinics","Staff & roles","Insurance connections","Claims & remittances","Reports","Billing & subscription","Notifications","Account security","Support"];
const roles = {
  owner:{name:"Owner", access:[1,1,1,1,1,1,1,1,1,1,1], blurb:"Practice-wide access, clinic creation, practice security policies and activity history."},
  manager:{name:"Manager", access:[1,1,1,1,1,1,1,0,1,1,1], blurb:"Runs their clinics and permitted staff — but cannot change the Owner or other Managers."},
  billing:{name:"Billing", access:[1,1,0,0,0,1,1,1,1,1,1], blurb:"Submits claims, reviews remittances, reports and the practice subscription."},
  front:{name:"Front Desk", access:[1,1,0,0,0,1,0,0,1,1,1], blurb:"Verifies eligibility and prepares and validates claims. Submission stays with Billing."},
  dentist:{name:"Dentist", access:[1,1,0,0,0,0,0,0,1,1,1], blurb:"Patient and eligibility context — no financial or claims access through unrelated permissions."},
};
export default function RolesSection(){const [selected,setSelected]=useState("front");const role=roles[selected];return <section className="roles-section" id="roles"><div className="section-inner roles-grid"><div className="roles-copy"><span className="kicker">BUILT FOR THE WHOLE TEAM</span><h2>Everyone sees exactly what their job needs.</h2><p>Access follows role, clinic assignment and subscription. Front Desk can prepare claims but not submit them. Dentists never inherit financial access by accident.</p><div className="role-tabs">{Object.entries(roles).map(([id,r])=><button key={id} onClick={()=>setSelected(id)} aria-pressed={selected===id}>{r.name}</button>)}</div><p className="role-blurb">{role.blurb}</p></div><div className="permission-card"><div className="permission-head"><b>Module access · {role.name}</b><span>{role.access.filter(Boolean).length} of {modules.length} modules</span></div><div className="permission-grid">{modules.map((item,i)=><div className={`permission-row ${role.access[i]?"allowed":"denied"}`} key={item}><span>{item}</span><i className={role.access[i]?"yes":"no"}><LucideIcon name={role.access[i]?"check":"x"} size={17}/></i></div>)}</div></div></div></section>}

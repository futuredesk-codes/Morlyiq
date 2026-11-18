"use client";

import { useState } from "react";
import { modules, roles } from "./roleData";
import LucideIcon from "@/components/LucideIcon";

export default function RolePickerSection() {
  const [selected, setSelected] = useState("front");
  const role = roles.find((item) => item.id === selected);
  const allowed = role.access.filter(Boolean).length;

  return (
    <section className="role-picker-section">
      <div className="section-inner role-picker-layout">
        <div className="role-picker-copy">
          <span className="kicker">TRY IT</span>
          <h2>Pick a role. See what they get.</h2>
          <p>Opening a module doesn&apos;t grant every action inside it — permissions apply to each action, record and clinic.</p>
          <div className="role-picker-tabs" role="tablist" aria-label="Choose a role">
            {roles.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={selected === item.id} onClick={() => setSelected(item.id)}>{item.name}</button>
            ))}
          </div>
          <p className="role-picker-blurb">{role.blurb}</p>
        </div>
        <div className="role-access-card" role="tabpanel">
          <div className="role-access-head"><b>Module access · {role.name}</b><span>{allowed} of {modules.length} modules</span></div>
          <div className="role-access-grid">
            {modules.map((module, index) => {
              const hasAccess = Boolean(role.access[index]);
              return <div className={`role-access-row ${hasAccess ? "is-allowed" : "is-denied"}`} key={module}><span>{module}</span><b aria-label={hasAccess ? "Has access" : "No access"}><LucideIcon name={hasAccess ? "check" : "x"} size={18}/></b></div>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

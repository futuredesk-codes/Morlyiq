import Image from "next/image";
import LucideIcon from "@/components/LucideIcon";

const nav=["Dashboard","Patients","Clinics","Staff & Roles","Claims & ERAs","Reports","Billing"];
const payers=[["Payer A",90],["Payer B",64],["Payer C",38],["Payer D",22]];
const codes=["D0120 · 100%","D1110 · 100%","D2391 · 80%","D2740 · 50%","D4341 · 80%"];
export default function DashboardScene(){return <div className="scene" aria-label="MorlyIQ dashboard preview"><div className="scene-stage">
  <div className="dashboard-card"><aside className="dash-sidebar"><div className="dash-brand"><b>MIQ</b><span>MorlyIQ</span></div>{nav.map((x,i)=><span className={i===0?"active":""} key={x}>{x}</span>)}</aside><div className="dash-main">
    <div className="dash-top"><b>Good morning, Dr. Patel</b><span>Uptown clinic⌄</span></div>
    <div className="metric-row"><div><small>TODAY&apos;S VERIFICATIONS</small><b>4 <em>12</em> <i>1</i></b></div><div><small>MONTHLY USAGE</small><b>62 / 150</b><span className="usage"><i/></span></div><div><small>CLAIM-RISK ALERTS</small><b className="red">3</b><span>1 high · 2 medium</span></div></div>
    <div className="dash-panels"><div className="payer-panel"><b>Insurance breakdown</b>{payers.map(([x,n])=><div key={x}><span>{x}</span><i><em style={{width:`${n}%`}}/></i></div>)}</div><div className="codes-panel"><b>Top CDT codes</b><div>{codes.map(x=><span key={x}>{x}</span>)}</div></div></div>
  </div></div>
  <div className="eligibility-chip"><i><LucideIcon name="check" size={17}/></i><span><b>Eligibility completed</b><small>Primary coverage · verified 9:02 AM</small></span></div>
  <div className="risk-chip"><i>△</i><b>Missing tooth # on D2391</b></div>
  <div className="claim-chip"><div><b>Claim · D2740 Crown</b><em>Live</em></div><span><i/>Accepted by submission provider</span><span><i/>Awaiting payer adjudication</span><span><i/>Payment (ERA) not yet received</span></div>
  <div className="tooth-orbit"><div className="orbit-ring"><i className="orbit-moving-dot"/><em className="orbit-moving-dot is-mint"/></div><div className="tooth-asset"><Image src="/tooth.png" alt="Protected dental coverage" fill sizes="190px" priority /></div></div>
  </div></div>}

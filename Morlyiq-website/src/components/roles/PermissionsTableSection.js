import { modules, roles } from "./roleData";
import LucideIcon from "@/components/LucideIcon";

export default function PermissionsTableSection() {
  return (
    <section className="permission-table-section">
      <div className="section-inner">
        <span className="kicker">FULL MATRIX</span>
        <h2>Client Panel permissions at a glance.</h2>
        <div className="permission-table-wrap">
          <table>
            <thead><tr><th scope="col">MODULE</th>{roles.map((role) => <th scope="col" key={role.id}>{role.name}</th>)}</tr></thead>
            <tbody>{modules.map((module, moduleIndex) => <tr key={module}><th scope="row">{module}</th>{roles.map((role) => { const yes = Boolean(role.access[moduleIndex]); return <td key={role.id}><span className={yes ? "matrix-yes" : "matrix-no"} aria-label={yes ? "Yes" : "No"}><LucideIcon name={yes ? "check" : "x"} size={18}/></span></td>; })}</tr>)}</tbody>
          </table>
        </div>
        <p className="matrix-note">Module access is further limited by clinic assignment, record ownership, account status and subscription.</p>
      </div>
    </section>
  );
}

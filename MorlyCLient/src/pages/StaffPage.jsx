import React, { useState, useEffect } from "react";
import { Plus, RotateCcw, Ban } from "lucide-react";
import { ROLES, canDo } from "../constants/rbac";
import { Card } from "../components/common/Card";
import { Btn, IconBtn } from "../components/common/Button";
import { Badge, StatusBadge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { Field, Input, Select, SearchBox } from "../components/common/FormControls";
import { SectionHeader, LockedNote } from "../components/common/Feedback";
import { useApp } from "../store/useApp";
import { fetchStaffApi, inviteStaffApi, updateStaffApi } from "../services/staffService";

// Owner is created by the seed script only, so it is never offered in the Staff page
const ASSIGNABLE_ROLES = ROLES.filter((r) => r !== "Owner");

// "Bright Smiles Dental — Downtown" -> "Downtown". Names without a dash are shown in full.
const clinicLabel = (name = "") => (name.includes("—") ? name.split("—").pop().trim() : name);

function InviteStaffModal({ clinics, activeClinicId, onClose, onInvite }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Front Desk");
  const [clinicId, setClinicId] = useState(activeClinicId);

  return (
    <Modal
      title="Invite staff member"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            disabled={!name.trim() || !email.trim()}
            onClick={() =>
              onInvite({ name: name.trim(), email: email.trim(), role, clinicId })
            }
          >
            Send invitation
          </Btn>
        </>
      }
    >
      <Field label="Full name">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Clinic">
        <Select
          value={clinicId}
          onChange={(e) => setClinicId(e.target.value)}
        >
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Role">
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

export default function StaffPage() {
  const { staff, setStaff, clinics, clinicId, role, push } = useApp();
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [created, setCreated] = useState(null); // { name, email, temporaryPassword }
  const allowed = canDo(["Owner", "Manager"], role);

  const filtered = staff.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    // Global clinic filter: reload this clinic's staff (and their roles here) on every clinic switch
    setStaff([]);
    fetchStaffApi(clinicId)
      .then(setStaff)
      .catch((err) => push(err.message, "danger"));
  }, [clinicId, setStaff, push]);

  async function change(s, changes, message) {
    try {
      const updated = await updateStaffApi(clinicId, s.id, changes);
      setStaff((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
      push(message);
    } catch (err) {
      push(err.message, "danger");
    }
  }

  const setStaffRole = (s, newRole) =>
    change(s, { role: newRole }, `${s.name}'s role changed to ${newRole}`);

  function toggleActive(s) {
    const next = s.status === "deactivated" ? "active" : "deactivated";
    change(
      s,
      { status: next },
      next === "deactivated" ? `${s.name} deactivated` : `${s.name} reactivated`
    );
  }

  async function invite(payload) {
    try {
      const { staff: added, emailSent, emailError, temporaryPassword } = await inviteStaffApi(clinicId, payload);
      if (added.clinicId === clinicId) setStaff((prev) => [...prev, added]);
      setInviting(false);
      if (emailSent) {
        push(`Invitation email sent to ${added.email}`);
      } else if (temporaryPassword) {
        // Email not delivered: show the credentials once so they can be shared by hand
        setCreated({ name: added.name, email: added.email, temporaryPassword, emailError });
        push(`Invitation created for ${added.email} — email not sent`, "warn");
      } else {
        push(`${added.name} added to the clinic`); // already had an account in this practice
      }
    } catch (err) {
      push(err.message, "danger");
    }
  }

  return (
    <div>
      <SectionHeader
        title="Staff & Roles"
        subtitle="Owner, Manager, Front Desk, Billing and Dentist roles"
        action={
          allowed ? (
            <Btn icon={Plus} onClick={() => setInviting(true)}>
              Invite staff
            </Btn>
          ) : (
            <LockedNote text="Owner / Manager only" />
          )
        }
      />
      <div className="mb-3.5">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search staff..."
        />
      </div>
      <Card noPad className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[660px]">
            <div className="grid grid-cols-[1.3fr_1.1fr_1fr_0.9fr_0.9fr_90px] px-4 py-[11px] bg-[#F4F7FD] text-[11px] font-bold text-textMute uppercase font-sans">
              <div>Name</div>
              <div>Clinic</div>
              <div>Role</div>
              <div>Last active</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {filtered.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[1.3fr_1.1fr_1fr_0.9fr_0.9fr_90px] items-center px-4 py-[11px] border-t border-brand-border font-sans text-[13px] hover:bg-slate-50/70 transition-colors"
              >
                <div>
                  <div className="font-semibold text-brand-text">{s.name}</div>
                  <div className="text-[11.5px] text-textFaint">{s.email}</div>
                </div>
                <div className="text-textMute">
                  {clinicLabel(clinics.find((c) => c.id === s.clinicId)?.name)}
                </div>
                <div>
                  {allowed && s.role !== "Owner" ? (
                    <Select
                      value={s.role}
                      onChange={(e) => setStaffRole(s, e.target.value)}
                      className="py-1 px-2 text-[12.5px]"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Badge text={s.role} tone="blue" />
                  )}
                </div>
                <div className="text-textFaint text-[12px]">{s.lastActive}</div>
                <div>
                  <StatusBadge status={s.status} />
                </div>
                <div>
                  {allowed && s.role !== "Owner" && (
                    <IconBtn
                      icon={s.status === "deactivated" ? RotateCcw : Ban}
                      tone={s.status === "deactivated" ? "success" : "danger"}
                      title={s.status === "deactivated" ? "Reactivate" : "Deactivate"}
                      onClick={() => toggleActive(s)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
      {inviting && (
        <InviteStaffModal
          clinics={clinics}
          activeClinicId={clinicId}
          onClose={() => setInviting(false)}
          onInvite={invite}
        />
      )}
      {created && (
        <Modal
          title="Invitation created — email not sent"
          onClose={() => setCreated(null)}
          footer={<Btn onClick={() => setCreated(null)}>Done</Btn>}
        >
          <p className="font-sans text-[13px] text-textMute m-0 mb-3">
            {created.emailError ? `${created.emailError}. ` : ""}Share these sign-in details with {created.name} yourself. The temporary password is shown only once.
          </p>
          <Field label="Email">
            <Input readOnly value={created.email} />
          </Field>
          <Field label="Temporary password">
            <Input readOnly value={created.temporaryPassword} onFocus={(e) => e.target.select()} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

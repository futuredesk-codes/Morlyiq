import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { C } from "../constants/theme.js";
import { RESOURCES, PERMS } from "../constants/navigation.js";
import { countGranted } from "../utils/grid.js";
import { Card, EmptyState, SectionHeader } from "../components/common/Card.jsx";
import { Btn, IconBtn } from "../components/common/Button.jsx";
import { Badge } from "../components/common/Badge.jsx";
import { Modal, ConfirmDialog } from "../components/common/Modal.jsx";
import { Input, TextArea, Field } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import {
  createRoleApi,
  deleteRoleApi,
  fetchRolesApi,
  updateRoleApi,
} from "../services/roleService.js";

export default function RolesPage() {
  const { roles, setRoles, push, logAudit } = useAdmin();
  const [editingRole, setEditingRole] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchRolesApi()
      .then((rows) => {
        if (active) setRoles(rows);
      })
      .catch((error) => {
        if (active) push(`Could not load roles: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [push, setRoles]);

  async function savePermissions(role) {
    if (saving || role.system) return;
    setSaving(true);
    try {
      const updated = await updateRoleApi(role.id, { permissions: role.permissions });
      setRoles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      logAudit("Role permissions updated", `${updated.name} — ${countGranted(updated.permissions)} permissions granted`, "info");
      push(`${updated.name} permissions updated`);
      setEditingRole(null);
    } catch (error) {
      push(`Could not update role: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function createRole(newRole) {
    if (saving) return;
    setSaving(true);
    try {
      const created = await createRoleApi(newRole);
      setRoles((prev) => [...prev, created]);
      logAudit("Role created", created.name, "info");
      push(`Role "${created.name}" created`);
      setCreating(false);
      setEditingRole(created);
    } catch (error) {
      push(`Could not create role: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function remove(role) {
    if (saving) return;
    setSaving(true);
    try {
      await deleteRoleApi(role.id);
      setRoles((prev) => prev.filter((item) => item.id !== role.id));
      logAudit("Role deleted", role.name, "warn");
      push(`Role "${role.name}" deleted`, "warn");
      setDeleting(null);
    } catch (error) {
      push(`Could not delete role: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="Roles & Permissions"
        subtitle="Granular View / Create / Edit / Delete / Assign / Export / Approve / Execute / Administer control, per resource"
        action={<Btn icon={Plus} disabled={loading || saving} onClick={() => setCreating(true)}>New custom role</Btn>}
      />

      {loading && <Card><div className="p-4 text-center text-sm" style={{ color: C.textFaint }}>Loading roles from database…</div></Card>}
      {!loading && roles.length === 0 && <Card><EmptyState text="No roles found." /></Card>}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {roles.map((role) => (
            <Card key={role.id}>
              <div className="flex justify-between items-start">
                <div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14.5, fontWeight: 700, color: C.text }}>
                    {role.name}
                  </div>
                  {role.system && <div className="mt-1"><Badge text="System role" tone="blue" /></div>}
                </div>
              </div>

              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.textMute, margin: "8px 0 12px", lineHeight: 1.5, minHeight: 40 }}>
                {role.desc}
              </div>

              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11.5, color: C.textFaint, marginBottom: 12 }}>
                {countGranted(role.permissions)} of {RESOURCES.length * PERMS.length} permissions granted
                {Number(role.userCount) > 0 ? ` · ${role.userCount} user(s)` : ""}
              </div>

              <div className="flex gap-1.5 items-center">
                <Btn
                  size="sm"
                  variant="outline"
                  icon={Pencil}
                  onClick={() => setEditingRole(role)}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {role.system ? "View permissions" : "Edit permissions"}
                </Btn>
                {!role.system && (
                  <IconBtn icon={Trash2} tone="danger" title="Delete role" onClick={() => setDeleting(role)} />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editingRole && (
        <PermissionMatrixModal
          role={editingRole}
          saving={saving}
          onClose={() => setEditingRole(null)}
          onSave={savePermissions}
        />
      )}
      {creating && <CreateRoleModal saving={saving} onClose={() => setCreating(false)} onCreate={createRole} />}
      {deleting && (
        <ConfirmDialog
          title="Delete role?"
          message={deleting.userCount
            ? `"${deleting.name}" is assigned to ${deleting.userCount} user(s). Reassign them before deleting this role.`
            : `"${deleting.name}" will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function PermissionMatrixModal({ role, saving, onClose, onSave }) {
  const [permissions, setPermissions] = useState(role.permissions);

  function toggle(resource, permission) {
    if (role.system) return;
    setPermissions((previous) => ({
      ...previous,
      [resource]: {
        ...previous[resource],
        [permission]: !previous[resource][permission],
      },
    }));
  }

  return (
    <Modal
      title={`Permissions — ${role.name}`}
      width={760}
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>{role.system ? "Close" : "Cancel"}</Btn>
          {!role.system && <Btn disabled={saving} onClick={() => onSave({ ...role, permissions })}>{saving ? "Saving…" : "Save permissions"}</Btn>}
        </>
      }
    >
      {role.system && (
        <div style={{ background: C.blueSoft2, borderRadius: 9, padding: "9px 12px", fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.navy, marginBottom: 14 }}>
          Super Admin is a system role with full access across all resources and cannot be edited.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr>
              <th className="text-left py-1.5 px-2 text-[11px] uppercase sticky left-0 bg-white" style={{ color: C.textMute }}>Resource</th>
              {PERMS.map((permission) => (
                <th key={permission} className="py-1.5 px-1.5 text-[10.5px] uppercase text-center" style={{ color: C.textMute }}>{permission}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((resource, index) => (
              <tr key={resource} style={{ background: index % 2 === 0 ? "#fff" : C.blueSoft2 }}>
                <td className="py-2 px-2 text-[12.5px] font-semibold whitespace-nowrap sticky left-0" style={{ color: C.text, background: "inherit" }}>{resource}</td>
                {PERMS.map((permission) => (
                  <td key={permission} className="text-center py-2 px-1">
                    <input
                      type="checkbox"
                      checked={Boolean(permissions[resource]?.[permission])}
                      disabled={role.system || saving}
                      onChange={() => toggle(resource, permission)}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: C.blue }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function CreateRoleModal({ saving, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <Modal
      title="Create custom role"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn disabled={saving || !name.trim()} onClick={() => onCreate({ name: name.trim(), desc: desc.trim() || "Custom role." })}>
            {saving ? "Creating…" : "Create role"}
          </Btn>
        </>
      }
    >
      <Field label="Role name"><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Billing Specialist" /></Field>
      <Field label="Description"><TextArea value={desc} onChange={(event) => setDesc(event.target.value)} placeholder="What does this role do?" /></Field>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11.5, color: C.textFaint }}>
        Permissions start at none — grant them on the next screen.
      </div>
    </Modal>
  );
}

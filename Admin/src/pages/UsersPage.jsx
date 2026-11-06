import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Ban, Mail, Plus, RotateCcw, UserCog, Users } from "lucide-react";
import { C } from "../constants/theme.js";
import { Card, EmptyState, SectionHeader } from "../components/common/Card.jsx";
import { Btn, IconBtn } from "../components/common/Button.jsx";
import { StatusBadge } from "../components/common/Badge.jsx";
import { ConfirmDialog, Modal } from "../components/common/Modal.jsx";
import { Field, Input, SearchBox, Select } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import { fetchClientUserOptionsApi, fetchUsersApi, inviteUserApi, resendUserInvitationApi, updateUserApi } from "../services/userService.js";

export default function UsersPage() {
  const [searchParams] = useSearchParams();
  const requestedQuery = searchParams.get("q") || "";
  const navigate = useNavigate();
  const { currentUser, users, setUsers, push, logAudit } = useAdmin();
  const [availableRoles, setAvailableRoles] = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [query, setQuery] = useState(requestedQuery);
  useEffect(() => { setQuery(requestedQuery); }, [requestedQuery]);
  const [inviting, setInviting] = useState(false);
  const [confirmUser, setConfirmUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setUsers([]);
    fetchUsersApi()
      .then(({ users: rows, roles, clients }) => {
        if (!active) return;
        setUsers(rows);
        setAvailableRoles(roles);
        setClientOptions(clients);
      })
      .catch((error) => {
        if (active) push(`Could not load users: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [push, setUsers]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.name, user.email, user.client, user.role].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [query, users]);

  async function setRole(user, roleId) {
    if (saving || roleId === user.roleId) return;
    const selectedRole = availableRoles.find((role) => role.id === roleId);
    if (!selectedRole) return;
    setSaving(true);
    try {
      const updated = await updateUserApi(user.id, { roleId });
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      logAudit("Role changed", `${user.name} → ${selectedRole.name}`, "info", user.client);
      push(`${user.name}'s role changed to ${selectedRole.name}`);
    } catch (error) {
      push(`Could not change role: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(user, status) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateUserApi(user.id, { status });
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      logAudit(status === "deactivated" ? "User disabled" : "User reactivated", user.name, status === "deactivated" ? "warn" : "info", user.client);
      push(status === "deactivated" ? `${user.name} deactivated` : `${user.name} reactivated`);
      setConfirmUser(null);
    } catch (error) {
      push(`Could not update user: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function resendInvitation(user) {
    if (saving) return;
    setSaving(true);
    try {
      await resendUserInvitationApi(user.id);
      logAudit("Invitation resent", user.name, "info", user.client);
      push(`A new invitation link was sent to ${user.email}`);
    } catch (error) {
      push(`Could not resend invitation: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function invite(newUser) {
    if (saving) return;
    setSaving(true);
    try {
      const created = await inviteUserApi(newUser);
      setUsers((prev) => [created, ...prev]);
      logAudit("User invited", `${created.name} (${created.role})`, "info", created.client);
      push(`Invitation sent to ${created.email}`);
      setInviting(false);
    } catch (error) {
      push(`Could not invite user: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="Users"
        subtitle="Everyone with an Admin login across all client tenants"
        action={
          <div className="flex items-center gap-2">
            <Btn variant="outline" icon={UserCog} onClick={() => navigate("/roles")}>Manage roles</Btn>
            <Btn icon={Plus} disabled={loading || saving || clientOptions.length === 0} onClick={() => setInviting(true)}>Invite user</Btn>
          </div>
        }
      />

      <div className="mb-3.5">
        <SearchBox value={query} onChange={setQuery} placeholder="Search by name, email, client, or role..." />
      </div>

      <Card noPad className="overflow-x-auto">
        <div className="min-w-[720px] grid grid-cols-[1.3fr_1.5fr_1.1fr_0.9fr_0.9fr_90px] p-[11px_16px] uppercase font-bold text-xs" style={{ background: C.blueSoft2, color: C.textMute, fontFamily: "Inter, sans-serif" }}>
          <div>Name</div><div>Client (tenant)</div><div>Role</div><div>Last active</div><div>Status</div><div>Actions</div>
        </div>

        {loading && <div className="p-8 text-center text-sm" style={{ color: C.textFaint }}>Loading users from database…</div>}
        {!loading && filtered.length === 0 && <EmptyState icon={Users} text="No users match your search." />}

        {!loading && filtered.map((user) => {
          const isCurrentUser = user.id === currentUser?.id;
          return (
            <div key={user.id} className="min-w-[720px] grid grid-cols-[1.3fr_1.5fr_1.1fr_0.9fr_0.9fr_90px] items-center p-[11px_16px] border-t text-[13px]" style={{ borderColor: C.border, fontFamily: "Inter, sans-serif" }}>
              <div>
                <div style={{ fontWeight: 600, color: C.text }}>{user.name}</div>
                <div style={{ fontSize: 11.5, color: C.textFaint }}>{user.email}</div>
              </div>
              <div style={{ color: C.textMute }}>{user.client}</div>
              <div>
                <Select
                  disabled={saving || isCurrentUser}
                  value={user.roleId || availableRoles.find((role) => role.name === user.role)?.id || ""}
                  onChange={(event) => setRole(user, event.target.value)}
                  style={{ padding: "5px 8px", fontSize: 12.5 }}
                >
                  {availableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </Select>
              </div>
              <div style={{ color: C.textFaint, fontSize: 12 }}>{user.lastActive}</div>
              <div><StatusBadge status={user.status} /></div>
              <div>
                {isCurrentUser ? (
                  <span style={{ color: C.textFaint, fontSize: 11 }}>You</span>
                ) : user.status === "deactivated" ? (
                  <IconBtn icon={RotateCcw} tone="success" title="Reactivate" onClick={() => changeStatus(user, "active")} />
                ) : user.status === "invited" ? (
                  <div className="flex items-center gap-1">
                    <IconBtn icon={Mail} title="Resend invitation" onClick={() => resendInvitation(user)} />
                    <IconBtn icon={Ban} tone="danger" title="Deactivate" onClick={() => setConfirmUser(user)} />
                  </div>
                ) : (
                  <IconBtn icon={Ban} tone="danger" title="Deactivate" onClick={() => setConfirmUser(user)} />
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {inviting && <InviteUserModal roles={availableRoles} clients={clientOptions} saving={saving} onClose={() => setInviting(false)} onInvite={invite} />}

      {confirmUser && (
        <ConfirmDialog
          title="Deactivate user?"
          message={`${confirmUser.name} will immediately lose access to the Admin panel.`}
          confirmLabel="Deactivate"
          onConfirm={() => changeStatus(confirmUser, "deactivated")}
          onCancel={() => setConfirmUser(null)}
        />
      )}
    </div>
  );
}

function InviteUserModal({ roles, clients, saving, onClose, onInvite }) {
  const [tenantId, setTenantId] = useState("");
  const [clientUsers, setClientUsers] = useState([]);
  const [clientUserId, setClientUserId] = useState("");
  const [loadingClientUsers, setLoadingClientUsers] = useState(false);
  const [clientUserError, setClientUserError] = useState("");
  const [roleId, setRoleId] = useState(roles.find((role) => role.name === "Staff")?.id || roles[0]?.id || "");
  const selectedUser = clientUsers.find((user) => user.id === clientUserId);
  const eligibleClientUsers = clientUsers.filter((user) => !user.hasAdminAccess);
  const valid = tenantId && clientUserId && roleId && !loadingClientUsers;

  useEffect(() => {
    let active = true;
    setClientUsers([]);
    setClientUserId("");
    setClientUserError("");
    if (!tenantId) return () => { active = false; };

    setLoadingClientUsers(true);
    fetchClientUserOptionsApi(tenantId)
      .then((users) => {
        if (active) setClientUsers(users);
      })
      .catch((error) => {
        if (active) setClientUserError(error.message);
      })
      .finally(() => {
        if (active) setLoadingClientUsers(false);
      });

    return () => { active = false; };
  }, [tenantId]);

  return (
    <Modal
      title="Invite user"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn disabled={saving || !valid} onClick={() => onInvite({ tenantId, clientUserId, roleId })}>
            {saving ? "Sending…" : "Send invitation"}
          </Btn>
        </>
      }
    >
      <Field label="Client / tenant" hint="Select an existing registered client.">
        <Select autoFocus value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
          <option value="" disabled>Select registered client</option>
          {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
      <Field
        label="Existing client user"
        hint={
          clientUserError
            ? clientUserError
            : tenantId && !loadingClientUsers && clientUsers.length === 0
              ? "No active or invited client users were found for this tenant."
              : tenantId && !loadingClientUsers && eligibleClientUsers.length === 0
                ? "Every listed client user already has Admin access. Existing accounts are shown but cannot be invited twice."
                : "Users with existing Admin access remain visible but cannot be selected again."
        }
      >
        <Select
          value={clientUserId}
          disabled={!tenantId || loadingClientUsers || eligibleClientUsers.length === 0}
          onChange={(event) => setClientUserId(event.target.value)}
        >
          <option value="" disabled>
            {!tenantId
              ? "Select a client first"
              : loadingClientUsers
                ? "Loading client users…"
                : eligibleClientUsers.length === 0
                  ? "No eligible users available"
                  : "Select client user"}
          </option>
          {clientUsers.map((user) => (
            <option key={user.id} value={user.id} disabled={user.hasAdminAccess}>
              {user.name} — {user.email}{user.clientRoles.length ? ` (${user.clientRoles.join(", ")})` : ""}
              {user.hasAdminAccess ? ` — Already Admin: ${user.adminRole} [${user.adminStatus}]` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Full name"><Input disabled value={selectedUser?.name || ""} placeholder="Filled from selected client user" /></Field>
      <Field label="Email"><Input disabled type="email" value={selectedUser?.email || ""} placeholder="Filled from selected client user" /></Field>
      <Field label="Role">
        <Select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
          {roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
    </Modal>
  );
}

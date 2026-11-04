import React, { useEffect, useState } from "react";
import { Plus, Trash2, Link2 } from "lucide-react";
import { C } from "../constants/theme.js";
import { canAdminDo } from "../constants/navigation.js";
import { Card, SectionHeader, EmptyState } from "../components/common/Card.jsx";
import { Btn, IconBtn } from "../components/common/Button.jsx";
import { Badge } from "../components/common/Badge.jsx";
import { Modal, ConfirmDialog } from "../components/common/Modal.jsx";
import { Input, Select, Field, CheckRow, Toggle } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import {
  createExternalLinkApi,
  deleteExternalLinkApi,
  fetchExternalLinksApi,
  updateExternalLinkApi,
} from "../services/externalLinkService.js";

const DEFAULT_ROLE_OPTIONS = ["Owner", "Manager", "Front Desk", "Billing", "Dentist"];
const DEFAULT_OPEN_MODES = ["New tab", "Embedded"];

export default function ExternalLinksPage() {
  const { currentUser, links, setLinks, push, logAudit } = useAdmin();
  const canCreate = canAdminDo(currentUser, "external_links", "create");
  const canEdit = canAdminDo(currentUser, "external_links", "edit");
  const canDelete = canAdminDo(currentUser, "external_links", "delete");
  const [options, setOptions] = useState({
    clients: [],
    roleOptions: DEFAULT_ROLE_OPTIONS,
    openModeOptions: DEFAULT_OPEN_MODES,
  });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchExternalLinksApi()
      .then((data) => {
        if (!active) return;
        setLinks(data.links || []);
        setOptions({
          clients: data.clients || [],
          roleOptions: data.roleOptions || DEFAULT_ROLE_OPTIONS,
          openModeOptions: data.openModeOptions || DEFAULT_OPEN_MODES,
        });
      })
      .catch((error) => {
        if (!active) return;
        setLinks([]);
        push(`Could not load external links: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [push, setLinks]);

  async function toggleEnabled(link) {
    if (saving || !canEdit) return;
    setSaving(true);
    try {
      const updated = await updateExternalLinkApi(link.id, { enabled: !link.enabled });
      setLinks((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      logAudit(updated.enabled ? "External link enabled" : "External link disabled", updated.title, "info");
      push(`${updated.title} ${updated.enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      push(`Could not update external link: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function create(value) {
    if (saving || !canCreate) return;
    setSaving(true);
    try {
      const created = await createExternalLinkApi(value);
      setLinks((previous) => [created, ...previous]);
      logAudit("External link created", created.title, "info");
      push(`${created.title} created`);
      setCreating(false);
    } catch (error) {
      push(`Could not create external link: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function remove(link) {
    if (saving || !canDelete) return;
    setSaving(true);
    try {
      await deleteExternalLinkApi(link.id);
      setLinks((previous) => previous.filter((item) => item.id !== link.id));
      logAudit("External link deleted", link.title, "warn");
      push(`${link.title} deleted`, "warn");
      setDeleting(null);
    } catch (error) {
      push(`Could not delete external link: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="External Links"
        subtitle="Public client-specific resources assigned by client and role"
        action={
          <Btn
            icon={Plus}
            disabled={loading || saving || !canCreate}
            title={canCreate ? "Create external link" : "Missing external_links:create permission"}
            onClick={() => setCreating(true)}
          >
            New link
          </Btn>
        }
      />

      <div className="flex flex-col gap-3">
        {loading && (
          <Card><div className="text-center text-sm" style={{ color: C.textFaint }}>Loading external links from database...</div></Card>
        )}

        {!loading && links.length === 0 && <EmptyState icon={Link2} text="No external links configured yet." />}

        {!loading && links.map((link) => {
          const roleLabel = link.restrictedRoles?.length ? link.restrictedRoles.join(", ") : "All client roles";
          return (
            <Card key={link.id}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14.5, fontWeight: 700, color: C.text }}>
                      {link.title}
                    </div>
                    <Badge
                      text={link.enabled ? "Enabled" : "Disabled"}
                      tone={link.enabled ? "success" : "neutral"}
                    />
                  </div>
                  <div className="mb-2 break-all text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.blue }}>
                    {link.url}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ fontFamily: "Inter, sans-serif", color: C.textMute }}>
                    <span><strong style={{ color: C.text }}>Clients:</strong> {link.assignedClients.map((client) => client.name).join(", ")}</span>
                    <span><strong style={{ color: C.text }}>Roles:</strong> {roleLabel}</span>
                    <span><strong style={{ color: C.text }}>Opens:</strong> {link.openMode}</span>
                  </div>
                </div>
                <div className="flex gap-1 items-center shrink-0">
                  <Toggle
                    disabled={!canEdit || saving}
                    on={link.enabled}
                    onChange={() => toggleEnabled(link)}
                  />
                  <IconBtn
                    icon={Trash2}
                    tone="danger"
                    disabled={!canDelete || saving}
                    onClick={() => setDeleting(link)}
                    title={canDelete ? "Delete link" : "Missing external_links:delete permission"}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-3 text-xs" style={{ fontFamily: "Inter, sans-serif", color: C.textFaint }}>
        External links are public resources and are ready immediately after creation.
      </div>

      {creating && (
        <CreateLinkModal
          {...options}
          saving={saving}
          onClose={() => setCreating(false)}
          onCreate={create}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete external link?"
          message={`"${deleting.title}" will be removed and become inaccessible to assigned clients.`}
          confirmLabel={saving ? "Deleting..." : "Delete"}
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function CreateLinkModal({ clients, roleOptions, openModeOptions, saving, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [assignedClients, setAssignedClients] = useState([]);
  const [restrictedRoles, setRestrictedRoles] = useState([]);
  const [openMode, setOpenMode] = useState("New tab");
  const valid = title.trim() && /^https:\/\//i.test(url.trim()) && assignedClients.length > 0;

  const toggle = (setValue, id) => setValue((previous) =>
    previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
  );

  return (
    <Modal
      title="New external link"
      width={620}
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" disabled={saving} onClick={onClose}>Cancel</Btn>
          <Btn
            disabled={saving || !valid}
            onClick={() => onCreate({
              title: title.trim(),
              url: url.trim(),
              assignedClients,
              restrictedRoles,
              openMode,
            })}
          >
            {saving ? "Creating..." : "Create link"}
          </Btn>
        </>
      }
    >
      <Field label="Tab / menu title">
        <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Clearinghouse Portal" />
      </Field>
      <Field label="URL" hint="Production links must use HTTPS.">
        <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
      </Field>

      <Field label="Open mode">
        <Select value={openMode} onChange={(event) => setOpenMode(event.target.value)}>
          {openModeOptions.map((option) => <option key={option}>{option}</option>)}
        </Select>
      </Field>
      {openMode === "Embedded" && (
        <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: C.blueSoft, color: C.textMute }}>
          Embedded mode works only when the target site allows iframe embedding through its CSP and X-Frame-Options policy.
        </div>
      )}

      <Field label="Assign to clients">
        <div className="max-h-32 overflow-y-auto border rounded-lg p-2" style={{ borderColor: C.border }}>
          {clients.length === 0 && <div className="text-xs p-1" style={{ color: C.textFaint }}>No registered clients available.</div>}
          {clients.map((client) => (
            <CheckRow
              key={client.id}
              label={client.name}
              checked={assignedClients.includes(client.id)}
              onChange={() => toggle(setAssignedClients, client.id)}
            />
          ))}
        </div>
      </Field>

      <Field label="Restrict to client roles (optional)" hint="Leave empty to allow every role within the assigned clients.">
        <div className="border rounded-lg p-2" style={{ borderColor: C.border }}>
          {roleOptions.map((role) => (
            <CheckRow
              key={role}
              label={role}
              checked={restrictedRoles.includes(role)}
              onChange={() => toggle(setRestrictedRoles, role)}
            />
          ))}
        </div>
      </Field>
    </Modal>
  );
}

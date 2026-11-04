import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { C } from "../constants/theme.js";
import { Card, SectionHeader } from "../components/common/Card.jsx";
import { Btn, IconBtn } from "../components/common/Button.jsx";
import { Modal, ConfirmDialog } from "../components/common/Modal.jsx";
import { Input, TextArea, Field } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import { createFeatureApi, deleteFeatureApi, fetchFeaturesApi, updateFeatureApi } from "../services/featureService.js";
import { fetchClientsApi, updateClientApi } from "../services/clientService.js";

export default function FeaturesPage() {
  const { catalogue, setCatalogue, clients, setClients, plans, setPlans, push, logAudit } = useAdmin();
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchFeaturesApi()
      .then((features) => {
        if (active) setCatalogue(features);
      })
      .catch((error) => {
        if (!active) return;
        setCatalogue([]);
        push(`Could not load feature catalogue: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetchClientsApi()
      .then((rows) => {
        if (active) setClients(rows);
      })
      .catch((error) => {
        if (active) push(`Could not load client entitlements: ${error.message}`, "danger");
      });

    return () => { active = false; };
  }, [push, setCatalogue, setClients]);

  async function save(f) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateFeatureApi(f.id, f);
      setCatalogue((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      logAudit("Feature updated", updated.name, "info");
      push(`${updated.name} updated`);
      setEditing(null);
    } catch (error) {
      push(`Could not update feature: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function add(f) {
    if (saving) return;
    setSaving(true);
    try {
      const created = await createFeatureApi(f);
      setCatalogue((prev) => [...prev, created]);
      logAudit("Feature created", created.name, "info");
      push(`${created.name} added to catalogue`);
      setAdding(false);
    } catch (error) {
      push(`Could not add feature: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function remove(f) {
    if (saving) return;
    setSaving(true);
    try {
      await deleteFeatureApi(f.id);
      setCatalogue((prev) => prev.filter((item) => item.id !== f.id));
      setPlans((prev) => prev.map((plan) => ({ ...plan, features: (plan.features || []).filter((key) => key !== f.key) })));
      logAudit("Feature deleted", f.name, "warn");
      push(`${f.name} removed`, "warn");
      setDeleting(null);
    } catch (error) {
      push(`Could not delete feature: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEntitlement(client, key) {
    if (saving) return;
    setSaving(true);
    const entitlements = { ...client.entitlements, [key]: !client.entitlements?.[key] };
    try {
      const updated = await updateClientApi(client.id, { entitlements });
      setClients((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      const featureName = catalogue.find((feature) => feature.key === key)?.name || key;
      logAudit("Feature entitlement toggled", `${client.name}: ${featureName}`, "info", client.name);
    } catch (error) {
      push(`Could not update entitlement: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="Feature Catalogue"
        subtitle="Master modules available on the platform, and which clients have each one enabled"
        action={
          <Btn icon={Plus} disabled={loading || saving} onClick={() => setAdding(true)}>
            Add feature
          </Btn>
        }
      />

      {/* Master Catalogue Table */}
      <Card noPad style={{ marginBottom: 24 }} className="overflow-x-auto">
        <div
          className="min-w-[650px] grid grid-cols-[1.2fr_2.2fr_100px] p-[11px_16px] uppercase font-bold text-xs"
          style={{
            background: C.blueSoft2,
            color: C.textMute,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div>Feature</div>
          <div>Description</div>
          <div>Actions</div>
        </div>

        {loading && (
          <div className="p-8 text-center text-sm" style={{ color: C.textFaint }}>
            Loading feature catalogue…
          </div>
        )}

        {!loading && catalogue.length === 0 && (
          <div className="p-8 text-center text-sm" style={{ color: C.textFaint }}>
            No features found. Use Add feature to create the first one.
          </div>
        )}

        {!loading && catalogue.map((f) => (
          <div
            key={f.key}
            className="min-w-[650px] grid grid-cols-[1.2fr_2.2fr_100px] items-center p-[11px_16px] border-t text-[13px]"
            style={{
              borderColor: C.border,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div style={{ fontWeight: 600, color: C.text }}>{f.name}</div>
            <div style={{ color: C.textMute }}>{f.desc}</div>
            <div className="flex gap-1 items-center">
              <IconBtn
                icon={Pencil}
                onClick={() => setEditing(f)}
                title="Edit"
              />
              <IconBtn
                icon={Trash2}
                tone="danger"
                onClick={() => setDeleting(f)}
                title="Delete"
              />
            </div>
          </div>
        ))}
      </Card>

      {/* Entitlements Matrix */}
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: C.text,
          marginBottom: 4,
        }}
      >
        Per-client entitlements
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 12.5,
          color: C.textMute,
          marginBottom: 14,
        }}
      >
        UI hiding is not enough — disabled features are also rejected
        server-side, per tenant.
      </div>

      <Card noPad className="overflow-x-auto">
        <table
          className="border-collapse w-full min-w-[900px]"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          <thead>
            <tr style={{ background: C.blueSoft2 }}>
              <th
                className="text-left py-2.5 px-3.5 text-[11px] uppercase sticky left-0 z-10"
                style={{
                  color: C.textMute,
                  background: C.blueSoft2,
                }}
              >
                Client
              </th>
              {catalogue.map((f) => (
                <th
                  key={f.key}
                  className="py-2.5 px-2 text-[10.5px] uppercase text-center max-w-[90px]"
                  style={{ color: C.textMute }}
                >
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr
                key={c.id}
                style={{ background: i % 2 === 0 ? "#fff" : C.blueSoft2 }}
              >
                <td
                  className="py-2.5 px-3.5 text-[12.5px] font-semibold whitespace-nowrap sticky left-0 z-10"
                  style={{ color: C.navy, background: "inherit" }}
                >
                  {c.name}
                </td>
                {catalogue.map((f) => (
                  <td key={f.key} className="text-center py-2.5 px-1">
                    <input
                      type="checkbox"
                      checked={!!c.entitlements?.[f.key]}
                      disabled={saving}
                      onChange={() => toggleEntitlement(c, f.key)}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: C.blue }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Edit Feature Modal */}
      {editing && (
        <Modal
          title={`Edit ${editing.name}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Btn variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Btn>
              <Btn disabled={saving || !editing.name.trim()} onClick={() => save(editing)}>
                {saving ? "Saving…" : "Save"}
              </Btn>
            </>
          }
        >
          <Field label="Feature name">
            <Input
              value={editing.name}
              onChange={(e) =>
                setEditing({ ...editing, name: e.target.value })
              }
            />
          </Field>
          <Field label="Description">
            <TextArea
              value={editing.desc}
              onChange={(e) =>
                setEditing({ ...editing, desc: e.target.value })
              }
            />
          </Field>
        </Modal>
      )}

      {/* Add Feature Modal */}
      {adding && (
        <AddFeatureModal
          saving={saving}
          onClose={() => setAdding(false)}
          onAdd={add}
        />
      )}

      {/* Delete Feature Confirmation */}
      {deleting && (
        <ConfirmDialog
          title="Delete feature?"
          message={`"${deleting.name}" will be removed from the catalogue and unassigned from every plan and client.`}
          confirmLabel="Delete"
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function AddFeatureModal({ saving, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <Modal
      title="Add feature"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            disabled={saving || !name.trim()}
            onClick={() =>
              onAdd({ name: name.trim(), desc: desc.trim() })
            }
          >
            {saving ? "Adding…" : "Add feature"}
          </Btn>
        </>
      }
    >
      <Field label="Feature name">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Prior Authorization"
        />
      </Field>
      <Field label="Description">
        <TextArea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

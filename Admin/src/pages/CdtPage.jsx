import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import { C } from "../constants/theme.js";
import { canAdminDo } from "../constants/navigation.js";
import { Card, SectionHeader, EmptyState } from "../components/common/Card.jsx";
import { Btn, IconBtn } from "../components/common/Button.jsx";
import { Modal, ConfirmDialog } from "../components/common/Modal.jsx";
import { Input, Field, SearchBox } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import {
  createCdtCodeApi,
  deleteCdtCodeApi,
  fetchCdtCodesApi,
  updateCdtCodeApi,
} from "../services/cdtService.js";

const byCode = (rows) => [...rows].sort((left, right) => left.code.localeCompare(right.code));

export default function CdtPage() {
  const { currentUser, cdt: codes, setCdt: setCodes, push, logAudit } = useAdmin();
  const canCreate = canAdminDo(currentUser, "eligibility", "create");
  const canEdit = canAdminDo(currentUser, "eligibility", "edit");
  const canDelete = canAdminDo(currentUser, "eligibility", "delete");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCdtCodesApi()
      .then((rows) => {
        if (active) setCodes(rows);
      })
      .catch((error) => {
        if (!active) return;
        setCodes([]);
        push(`Could not load CDT codes: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [push, setCodes]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return codes;
    return codes.filter(
      (entry) =>
        entry.code.toLowerCase().includes(term) ||
        entry.desc.toLowerCase().includes(term)
    );
  }, [codes, query]);

  async function save(entry) {
    if (saving || !canEdit) return;
    setSaving(true);
    try {
      const updated = await updateCdtCodeApi(entry.id, entry);
      setCodes((previous) => byCode(previous.map((item) => (item.id === updated.id ? updated : item))));
      logAudit("CDT code updated", updated.code, "info");
      push(`${updated.code} updated`);
      setEditing(null);
    } catch (error) {
      push(`Could not update CDT code: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function add(entry) {
    if (saving || !canCreate) return;
    setSaving(true);
    try {
      const created = await createCdtCodeApi(entry);
      setCodes((previous) => byCode([...previous, created]));
      logAudit("CDT code added", created.code, "info");
      push(`${created.code} added`);
      setAdding(false);
    } catch (error) {
      push(`Could not add CDT code: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry) {
    if (saving || !canDelete) return;
    setSaving(true);
    try {
      await deleteCdtCodeApi(entry.id);
      setCodes((previous) => previous.filter((item) => item.id !== entry.id));
      logAudit("CDT code removed", entry.code, "warn");
      push(`${entry.code} removed`, "warn");
      setDeleting(null);
    } catch (error) {
      push(`Could not delete CDT code: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="CDT Master Table"
        subtitle="Default coverage rules used across all client verifications"
        action={
          <Btn
            icon={Plus}
            disabled={loading || saving || !canCreate}
            title={canCreate ? "Add CDT code" : "Missing eligibility:create permission"}
            onClick={() => setAdding(true)}
          >
            Add CDT code
          </Btn>
        }
      />

      <div className="mb-3.5">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search code or description..."
        />
      </div>

      <Card noPad className="overflow-x-auto">
        <div
          className="min-w-[650px] grid grid-cols-[0.7fr_2fr_0.7fr_1fr_100px] p-[11px_16px] uppercase font-bold text-xs"
          style={{
            background: C.blueSoft2,
            color: C.textMute,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div>Code</div>
          <div>Description</div>
          <div>Default %</div>
          <div>Frequency</div>
          <div>Actions</div>
        </div>

        {loading && (
          <div className="p-8 text-center text-sm" style={{ color: C.textFaint }}>
            Loading CDT codes from database...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={ListChecks}
            text="No CDT codes found matching your search."
          />
        )}

        {!loading && filtered.map((entry) => (
          <div
            key={entry.id}
            className="min-w-[650px] grid grid-cols-[0.7fr_2fr_0.7fr_1fr_100px] items-center p-[11px_16px] border-t text-[13px]"
            style={{
              borderColor: C.border,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 600,
                color: C.navy,
              }}
            >
              {entry.code}
            </div>
            <div style={{ color: C.textMute }}>{entry.desc}</div>
            <div>{entry.pct}%</div>
            <div style={{ color: C.textMute }}>{entry.freq}</div>
            <div className="flex gap-1 items-center">
              <IconBtn
                icon={Pencil}
                disabled={!canEdit || saving}
                onClick={() => setEditing(entry)}
                title={canEdit ? "Edit" : "Missing eligibility:edit permission"}
              />
              <IconBtn
                icon={Trash2}
                tone="danger"
                disabled={!canDelete || saving}
                onClick={() => setDeleting(entry)}
                title={canDelete ? "Delete" : "Missing eligibility:delete permission"}
              />
            </div>
          </div>
        ))}
      </Card>

      {editing && (
        <CdtFormModal
          title={`Edit ${editing.code}`}
          initialValue={editing}
          saving={saving}
          submitLabel="Save"
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}

      {adding && (
        <CdtFormModal
          title="Add CDT code"
          saving={saving}
          submitLabel="Add code"
          onClose={() => setAdding(false)}
          onSubmit={add}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete CDT code?"
          message={`${deleting.code} — ${deleting.desc} will be removed from the master table.`}
          confirmLabel={saving ? "Deleting..." : "Delete"}
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function CdtFormModal({
  title,
  initialValue = { code: "", desc: "", pct: 80, freq: "—" },
  saving,
  submitLabel,
  onClose,
  onSubmit,
}) {
  const [value, setValue] = useState(initialValue);
  const normalizedCode = value.code.trim().toUpperCase();
  const coverage = Number(value.pct);
  const valid =
    /^D\d{4}$/.test(normalizedCode) &&
    value.desc.trim() &&
    Number.isFinite(coverage) &&
    coverage >= 0 &&
    coverage <= 100;

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            disabled={saving || !valid}
            onClick={() =>
              onSubmit({
                ...value,
                code: normalizedCode,
                desc: value.desc.trim(),
                pct: coverage,
                freq: value.freq.trim() || "—",
              })
            }
          >
            {saving ? "Saving..." : submitLabel}
          </Btn>
        </>
      }
    >
      <Field label="CDT code" hint="Use D followed by four digits, for example D2330.">
        <Input
          autoFocus
          value={value.code}
          maxLength={5}
          onChange={(event) => setValue({ ...value, code: event.target.value.toUpperCase() })}
          placeholder="e.g. D2330"
        />
      </Field>
      <Field label="Description">
        <Input
          value={value.desc}
          onChange={(event) => setValue({ ...value, desc: event.target.value })}
        />
      </Field>
      <Field label="Default coverage %">
        <Input
          type="number"
          min={0}
          max={100}
          value={value.pct}
          onChange={(event) => setValue({ ...value, pct: event.target.value })}
        />
      </Field>
      <Field label="Frequency rule">
        <Input
          value={value.freq}
          onChange={(event) => setValue({ ...value, freq: event.target.value })}
          placeholder="e.g. 1x / 12 mo"
        />
      </Field>
    </Modal>
  );
}

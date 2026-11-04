import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { C } from "../constants/theme.js";
import { Card, SectionHeader, EmptyState } from "../components/common/Card.jsx";
import { Btn } from "../components/common/Button.jsx";
import { StatusBadge } from "../components/common/Badge.jsx";
import { Modal } from "../components/common/Modal.jsx";
import { Input, Select, Field } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import {
  createInsurerApi,
  fetchInsurerDirectoryApi,
  fetchInsurersApi,
  updateInsurerStatusApi,
} from "../services/insurerService.js";

const eligibilityLabel = (value) => ({
  SUPPORTED: "Supported",
  ENROLLMENT_REQUIRED: "Enrollment required",
  NOT_SUPPORTED: "Not supported",
}[value] || String(value || "Unknown").replaceAll("_", " "));

export default function InsurersPage() {
  const { insurers, setInsurers, push } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const loadInsurers = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setInsurers(await fetchInsurersApi());
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsurers();
  }, []);

  const updateStatus = async (insurer, status) => {
    if (status === insurer.configuredStatus) return;
    setUpdatingId(insurer.id);
    try {
      const updated = await updateInsurerStatusApi(insurer.id, status);
      setInsurers((current) => current.map((item) => item.id === updated.id ? updated : item));
      push(`${updated.name} is now ${updated.status}`,
        updated.status === "error" ? "danger" : "success");
    } catch (error) {
      push(error.message, "danger");
    } finally {
      setUpdatingId("");
    }
  };

  const addInsurer = async (payload) => {
    const created = await createInsurerApi(payload);
    setInsurers((current) => [...current, created]
      .sort((a, b) => a.name.localeCompare(b.name)));
    push(created.status === "error"
      ? `${created.name} added, but its connection needs attention`
      : `${created.name} added`, created.status === "error" ? "danger" : "success");
    setAdding(false);
  };

  return (
    <div>
      <SectionHeader
        title="Insurers / Clearinghouse"
        subtitle="Choose which dental payers are available across MorlyIQ and monitor directory availability"
        action={
          <div className="flex gap-2">
            <Btn variant="outline" icon={RefreshCw} onClick={loadInsurers} disabled={loading}>
              Refresh
            </Btn>
            <Btn icon={Plus} onClick={() => setAdding(true)}>
              Add insurer
            </Btn>
          </div>
        }
      />

      {loadError && (
        <div className="mb-4 rounded-xl flex items-center justify-between gap-3 p-3"
          style={{ background: C.dangerSoft, color: C.danger, fontFamily: "Inter, sans-serif", fontSize: 13 }}>
          <span>{loadError}</span>
          <Btn size="sm" variant="outline" onClick={loadInsurers}>Try again</Btn>
        </div>
      )}

      <Card noPad className="overflow-x-auto">
        <div
          className="min-w-[1050px] grid grid-cols-[1.7fr_0.8fr_1.05fr_1.1fr_0.65fr_1.25fr_1fr] p-[11px_16px] uppercase font-bold text-xs"
          style={{ background: C.blueSoft2, color: C.textMute, fontFamily: "Inter, sans-serif" }}
        >
          <div>Insurer</div>
          <div>Payer ID</div>
          <div>Integration type</div>
          <div>Eligibility</div>
          <div>Clients</div>
          <div>Connection status</div>
          <div>Application access</div>
        </div>

        {loading && insurers.length === 0 && (
          <EmptyState icon={RefreshCw} text="Loading configured insurers..." />
        )}
        {!loading && insurers.length === 0 && !loadError && (
          <EmptyState icon={ShieldCheck} text="No insurers selected yet. Add one from the payer directory." />
        )}

        {insurers.map((insurer) => (
          <div
            key={insurer.id}
            className="min-w-[1050px] grid grid-cols-[1.7fr_0.8fr_1.05fr_1.1fr_0.65fr_1.25fr_1fr] items-center p-[13px_16px] border-t text-[13px]"
            style={{ borderColor: C.border, fontFamily: "Inter, sans-serif" }}
          >
            <div className="min-w-0 pr-4">
              <div className="truncate" style={{ fontWeight: 650, color: C.text }}>{insurer.name}</div>
              <div className="truncate text-[11.5px] mt-0.5" style={{ color: C.textFaint }}>
                Directory ID: {insurer.stediId}
              </div>
            </div>
            <div style={{ color: C.textMute }}>{insurer.primaryPayerId}</div>
            <div style={{ color: C.textMute }}>{insurer.type}</div>
            <div style={{ color: insurer.eligibilityCheck === "NOT_SUPPORTED" ? C.danger : C.textMute }}>
              {eligibilityLabel(insurer.eligibilityCheck)}
            </div>
            <div style={{ color: C.textMute }}>{insurer.clientsUsing}</div>
            <div className="pr-4">
              <StatusBadge status={insurer.status} />
              {insurer.statusReason && (
                <div className="text-[11px] leading-4 mt-1.5" style={{ color: insurer.status === "error" ? C.danger : C.textFaint }}>
                  {insurer.statusReason}
                </div>
              )}
            </div>
            <div>
              <Select
                value={insurer.configuredStatus}
                disabled={updatingId === insurer.id}
                onChange={(event) => updateStatus(insurer, event.target.value)}
                aria-label={`Application status for ${insurer.name}`}
                style={{ padding: "7px 9px", minWidth: 112 }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>
        ))}
      </Card>

      <p className="mt-3 text-xs" style={{ color: C.textFaint, fontFamily: "Inter, sans-serif" }}>
        Active insurers appear in new-patient and secondary-insurance dropdowns. Existing patient policies remain unchanged.
      </p>

      {adding && <AddInsurerModal onClose={() => setAdding(false)} onAdd={addInsurer} />}
    </div>
  );
}

function AddInsurerModal({ onClose, onAdd }) {
  const [directory, setDirectory] = useState([]);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [stediId, setStediId] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInsurerDirectoryApi()
      .then((data) => setDirectory((data.payers || []).filter((payer) => !payer.alreadySelected)))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return directory;
    return directory.filter((payer) => [
      payer.displayName,
      payer.conciseName,
      payer.primaryPayerId,
      payer.stediId,
      ...(payer.aliases || []),
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [directory, search]);

  const selected = directory.find((payer) => payer.stediId === stediId);
  const unavailable = selected && (!selected.directoryActive || selected.eligibilityCheck === "NOT_SUPPORTED");

  const submit = async () => {
    if (!stediId || saving) return;
    setSaving(true);
    setError("");
    try {
      await onAdd({ stediId, status });
    } catch (submitError) {
      setError(submitError.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add insurer"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn disabled={!stediId || loading || saving} onClick={submit}>
            {saving ? "Adding..." : "Add insurer"}
          </Btn>
        </>
      }
    >
      <Field label="Insurer" hint="Type an insurer name, payer ID or directory ID, then select an option.">
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDropdownOpen(false);
          }}
        >
          <Search size={15} color={C.textFaint} className="absolute left-3 top-3 z-10" />
          <Input
            autoFocus
            role="combobox"
            aria-expanded={dropdownOpen}
            aria-controls="insurer-directory-options"
            autoComplete="off"
            disabled={loading}
            value={search}
            onFocus={() => setDropdownOpen(true)}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              setDropdownOpen(true);
              if (selected && value !== selected.displayName) setStediId("");
            }}
            placeholder={loading ? "Loading payer directory..." : "Search and select an insurer..."}
            style={{ paddingLeft: 34 }}
          />

          {dropdownOpen && !loading && (
            <div
              id="insurer-directory-options"
              role="listbox"
              className="absolute left-0 right-0 mt-1.5 overflow-y-auto rounded-xl bg-white z-30"
              style={{
                maxHeight: 260,
                border: `1px solid ${C.borderStrong}`,
                boxShadow: "0 12px 32px rgba(11,27,51,0.14)",
              }}
            >
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs" style={{ color: C.textFaint }}>
                  No matching insurers found.
                </div>
              ) : filtered.map((payer) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={payer.stediId === stediId}
                  key={payer.stediId}
                  onClick={() => {
                    setStediId(payer.stediId);
                    setSearch(payer.displayName);
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 border-0 border-b last:border-b-0 hover:bg-blue-50 transition-colors"
                  style={{
                    background: payer.stediId === stediId ? C.blueSoft2 : "#fff",
                    borderColor: C.border,
                    color: C.text,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[13px] font-semibold">{payer.displayName}</span>
                    {!payer.directoryActive && (
                      <span className="text-[10px] uppercase font-bold" style={{ color: C.danger }}>Unavailable</span>
                    )}
                  </div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: C.textFaint }}>
                    Payer ID: {payer.primaryPayerId} · Directory ID: {payer.stediId}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      <Field label="Application status" hint="Only active insurers are offered when a patient policy is added.">
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Field>

      {selected && (
        <div className="rounded-xl p-3 text-[12.5px] leading-5"
          style={{ background: unavailable ? C.dangerSoft : C.blueSoft2, color: unavailable ? C.danger : C.textMute }}>
          <div className="flex items-center gap-2 font-semibold" style={{ color: unavailable ? C.danger : C.text }}>
            {unavailable ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
            {selected.displayName}
          </div>
          <div>Payer ID: {selected.primaryPayerId} · Eligibility: {eligibilityLabel(selected.eligibilityCheck)}</div>
          {unavailable && status === "active" && (
            <div className="mt-1">It can be added, but will show Error until the payer becomes operational.</div>
          )}
        </div>
      )}

      {error && <div className="mt-3 text-xs" style={{ color: C.danger }}>{error}</div>}
    </Modal>
  );
}

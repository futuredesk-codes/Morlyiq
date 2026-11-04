import React, { useState } from "react";
import { Building, CloudCog, Pencil, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { canDo } from "../constants/rbac";
import { Card } from "../components/common/Card";
import { Btn, IconBtn } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { Field, Input, Select } from "../components/common/FormControls";
import { SectionHeader, EmptyState, LockedNote } from "../components/common/Feedback";
import { useApp } from "../store/useApp";
import {
  createClinicApi,
  fetchClinicsApi,
  fetchClaimProviderApi,
  refreshClaimProviderStediApi,
  syncClaimProviderStediApi,
  updateClinicApi,
  updateClaimProviderApi,
} from "../services/clinicService";

const stediPresentation = (stedi = {}) => {
  if (stedi.automationEnabled === false) return { text: "Automation off", tone: "neutral" };
  if (stedi.syncStatus === "live" || stedi.enrollmentStatus === "LIVE") return { text: "ERA enrollment live", tone: "success" };
  if (stedi.syncStatus === "error") return { text: "Stedi sync error", tone: "danger" };
  if (stedi.syncStatus === "syncing") return { text: "Syncing with Stedi", tone: "blue" };
  if (stedi.syncStatus === "submitted" || stedi.enrollmentStatus) return { text: (stedi.enrollmentStatus || "Enrollment submitted").replaceAll("_", " "), tone: "warn" };
  return { text: "Not synced", tone: "neutral" };
};

const formatTaxId = (value, type) => {
  const taxId = String(value || "").replace(/\D/g, "").slice(0, 9);
  if (type === "SSN") return [taxId.slice(0, 3), taxId.slice(3, 5), taxId.slice(5)].filter(Boolean).join("-");
  return taxId.length > 2 ? `${taxId.slice(0, 2)}-${taxId.slice(2)}` : taxId;
};

export default function ClinicsPage() {
  const { clinics, clinicId, setClinics, role, push, currentUser } = useApp();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [stediBusy, setStediBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const allowed = canDo(["Owner", "Manager"], role);

  async function save(c) {
    setSaving(true);
    try {
      await updateClinicApi(c.id, {
        name: c.name,
      });
      const claimProvider = await updateClaimProviderApi(c.id, c.claimProvider);
      setClinics(await fetchClinicsApi());
      const sync = claimProvider?.stediEnrollment || {};
      if (sync.syncStatus === "error" && sync.automationEnabled !== false) {
        setEditing({ ...c, claimProvider });
        push(sync.errorMessage || "Clinic saved, but Stedi enrollment needs attention", "danger");
      } else {
        push(sync.syncStatus === "live" ? `${c.name} updated and ERA enrollment is live` : `${c.name} updated`);
        setEditing(null);
      }
    } catch (err) {
      push(err.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function openEdit(c) {
    try {
      const claimProvider = await fetchClaimProviderApi(c.id);
      setEditing({
        ...c,
        claimProvider: {
          ...claimProvider,
          enrollmentContactEmail: claimProvider.enrollmentContactEmail || currentUser?.email || "",
        },
      });
    } catch (err) {
      push(err.message, "danger");
    }
  }

  async function syncStedi() {
    if (!editing) return;
    setStediBusy(true);
    try {
      const claimProvider = await syncClaimProviderStediApi(editing.id);
      setEditing({ ...editing, claimProvider });
      setClinics(await fetchClinicsApi());
      push("Stedi provider and test ERA enrollment synchronized");
    } catch (err) {
      push(err.message, "danger");
      try {
        const claimProvider = await fetchClaimProviderApi(editing.id);
        setEditing({ ...editing, claimProvider });
      } catch {
        // Keep the form usable even when the follow-up status request fails.
      }
    } finally {
      setStediBusy(false);
    }
  }

  async function refreshStedi() {
    if (!editing) return;
    setStediBusy(true);
    try {
      const claimProvider = await refreshClaimProviderStediApi(editing.id);
      setEditing({ ...editing, claimProvider });
      setClinics(await fetchClinicsApi());
      push("Stedi enrollment status refreshed");
    } catch (err) {
      push(err.message, "danger");
    } finally {
      setStediBusy(false);
    }
  }

  async function add(c) {
    try {
      setClinics(await createClinicApi(c));
      push(`${c.name} added`);
      setAdding(false);
    } catch (err) {
      push(err.message, "danger");
    }
  }

  return (
    <div>
      <SectionHeader
        title="Clinics"
        subtitle="Multi-clinic locations under this account"
        action={
          allowed ? (
            <Btn icon={Plus} onClick={() => setAdding(true)}>
              Add clinic
            </Btn>
          ) : (
            <LockedNote text="Owner / Manager only" />
          )
        }
      />
      {clinics.length === 0 && (
        <EmptyState icon={Building} text="No clinics yet — use Add clinic to create your first location." />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {clinics.map((c) => (
          <Card key={c.id} className={c.id === clinicId ? "!border-brand-blue ring-2 ring-blueSoft" : ""}>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Building size={16} className="text-navy" />
                  <div className="font-sans text-[15px] font-bold text-brand-text">
                    {c.name}
                  </div>
                  {c.id === clinicId && <Badge text="Active" tone="blue" />}
                </div>
                <div className="font-sans text-[12.5px] text-textMute mt-1.5">
                  {c.address}
                </div>
                <div className="font-sans text-[11.5px] text-textMute mt-2">
                  Provider: {c.provider?.npi
                    ? `${c.provider.organizationName || c.name} · NPI ${c.provider.npi}`
                    : "Not configured"}
                </div>
                <div className="mt-2">
                  <Badge {...stediPresentation(c.stediEnrollment)} />
                </div>
              </div>
              {allowed && (
                <IconBtn
                  icon={Pencil}
                  onClick={() => openEdit(c)}
                  title="Edit"
                />
              )}
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal
          title={`Edit ${editing.name}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Btn variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Btn>
              <Btn disabled={saving} onClick={() => save(editing)}>{saving ? "Saving…" : "Save"}</Btn>
            </>
          }
        >
          <Field label="Clinic name" required>
            <Input
              value={editing.name}
              onChange={(e) =>
                setEditing({ ...editing, name: e.target.value })
              }
            />
          </Field>
          <div className="mt-4 pt-4 border-t border-brand-border">
            <div className="font-sans text-[13px] font-semibold text-brand-text mb-1">Provider & billing setup</div>
            <div className="font-sans text-[11.5px] text-textMute mb-3">Provider identity and NPI are shared by eligibility, enrollment and dental claims.</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
              <Field label={editing.claimProvider?.taxIdType === "SSN" ? "Provider full legal name" : "Provider display / organization name"} required className="sm:col-span-2">
                <Input value={editing.claimProvider?.organizationName || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, organizationName: e.target.value } })} />
              </Field>
              <Field label="Billing NPI" required>
                <Input inputMode="numeric" maxLength={10} value={editing.claimProvider?.npi || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, npi: e.target.value.replace(/\D/g, "").slice(0, 10) } })} />
              </Field>
              <Field label="Tax ID" required>
                <div className="flex items-center gap-2 rounded-[9px] border border-brand-border bg-white p-1 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-blueSoft">
                  <div className="flex items-center gap-2 px-2 shrink-0">
                    {["EIN", "SSN"].map((type) => (
                      <label key={type} className="inline-flex items-center gap-1.5 font-sans text-[12.5px] text-brand-text cursor-pointer">
                        <input
                          type="radio"
                          name={`tax-id-type-${editing.id}`}
                          value={type}
                          checked={(editing.claimProvider?.taxIdType || "EIN") === type}
                          onChange={() => setEditing({
                            ...editing,
                            claimProvider: {
                              ...editing.claimProvider,
                              taxIdType: type,
                              providerType: type === "SSN" ? "individual" : "organization",
                            },
                          })}
                          className="accent-brand-blue"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                  <input
                    aria-label="Tax ID"
                    inputMode="numeric"
                    maxLength={(editing.claimProvider?.taxIdType || "EIN") === "SSN" ? 11 : 10}
                    placeholder={(editing.claimProvider?.taxIdType || "EIN") === "SSN" ? "123-45-6789" : "12-3456789"}
                    value={formatTaxId(editing.claimProvider?.employerId, editing.claimProvider?.taxIdType || "EIN")}
                    onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, employerId: e.target.value.replace(/\D/g, "").slice(0, 9) } })}
                    className="w-full min-w-0 px-2 py-2 border-0 border-l border-brand-border bg-transparent font-sans text-[13.5px] text-brand-text outline-none"
                  />
                </div>
              </Field>
              <Field label="Taxonomy code" required>
                <Input maxLength={10} value={editing.claimProvider?.taxonomyCode || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, taxonomyCode: e.target.value.toUpperCase() } })} />
              </Field>
              <Field label="Submitter ID (optional)">
                <Input value={editing.claimProvider?.submitterId || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, submitterId: e.target.value } })} />
              </Field>
              <div className="sm:col-span-2 mt-1 mb-3 pt-3 border-t border-brand-border">
                <div className="font-sans text-[12.5px] font-semibold text-brand-text">Provider contact</div>
                <div className="font-sans text-[11.5px] text-textMute mt-1">Sent to Stedi for provider and enrollment communication.</div>
              </div>
              <Field label="Country" required className="sm:col-span-2">
                <Select className="w-full" value={editing.claimProvider?.countryCode || "US"} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, countryCode: e.target.value } })}>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                </Select>
              </Field>
              <Field label="Contact organization name" required className="sm:col-span-2">
                <Input value={editing.claimProvider?.contactOrganizationName || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, contactOrganizationName: e.target.value } })} />
              </Field>
              <Field label="Enrollment contact email" required hint="Used for enrollment status communication.">
                <Input type="email" value={editing.claimProvider?.enrollmentContactEmail || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, enrollmentContactEmail: e.target.value } })} />
              </Field>
              <Field label="Phone number" required>
                <Input inputMode="tel" maxLength={10} value={editing.claimProvider?.phoneNumber || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, phoneNumber: e.target.value.replace(/\D/g, "").slice(0, 10) } })} />
              </Field>
              <Field label="Street address 1" required className="sm:col-span-2">
                <Input value={editing.claimProvider?.address1 || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, address1: e.target.value } })} />
              </Field>
              <Field label="Street address 2 (optional)" className="sm:col-span-2">
                <Input value={editing.claimProvider?.address2 || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, address2: e.target.value } })} />
              </Field>
              <Field label="City" required>
                <Input value={editing.claimProvider?.city || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, city: e.target.value } })} />
              </Field>
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <Field label={editing.claimProvider?.countryCode === "CA" ? "Province" : "State"} required><Input maxLength={2} value={editing.claimProvider?.state || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, state: e.target.value.toUpperCase() } })} /></Field>
                <Field label={editing.claimProvider?.countryCode === "CA" ? "Postal code" : "ZIP code"} required><Input value={editing.claimProvider?.postalCode || ""} onChange={(e) => setEditing({ ...editing, claimProvider: { ...editing.claimProvider, postalCode: editing.claimProvider?.countryCode === "CA" ? e.target.value.toUpperCase() : e.target.value } })} /></Field>
              </div>
            </div>
            {(() => {
              const sync = editing.claimProvider?.stediEnrollment || {};
              const presentation = stediPresentation(sync);
              return (
                <div className={`mt-2 rounded-[10px] border p-3.5 ${sync.syncStatus === "error" ? "border-red-200 bg-dangerSoft" : "border-brand-border bg-[#F8FAFE]"}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-brand-blue" />
                        <div className="font-sans text-[12.5px] font-bold text-brand-text">Stedi Test Payer · Claim Payment (835)</div>
                        <Badge {...presentation} />
                      </div>
                      <div className="mt-1.5 font-sans text-[11.5px] text-textMute">
                        Saving this form automatically reuses or creates the matching Stedi provider and test ERA enrollment. Real payers are never enrolled by this automation.
                      </div>
                      {sync.errorMessage && <div className="mt-1.5 font-sans text-[11.5px] text-brand-danger">{sync.errorMessage}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Btn size="sm" variant="outline" icon={CloudCog} disabled={stediBusy || saving || sync.automationEnabled === false} onClick={syncStedi} title={sync.automationEnabled === false ? "Enable Stedi auto-enrollment on the backend first" : "Create or reconcile the test-payer enrollment"}>
                        {stediBusy ? "Working…" : "Retry sync"}
                      </Btn>
                      {sync.enrollmentId && (
                        <Btn size="sm" variant="outline" icon={RefreshCw} disabled={stediBusy || saving} onClick={refreshStedi}>
                          Refresh status
                        </Btn>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}


      {adding && (
        <Modal
          title="Add clinic"
          onClose={() => setAdding(false)}
          footer={
            <>
              <Btn variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Btn>
              <Btn onClick={() => add({ name: "New Clinic", address: "" })}>
                Add
              </Btn>
            </>
          }
        >
          <div className="font-sans text-[13px] text-textMute">
            A blank clinic will be added — edit its details right after.
          </div>
        </Modal>
      )}
    </div>
  );
}

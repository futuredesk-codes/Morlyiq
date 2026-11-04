import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Upload, Users } from "lucide-react";
import { StatusBadge } from "../components/common/Badge";
import { Btn } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Field, Input, SearchBox, Select } from "../components/common/FormControls";
import { EmptyState, SectionHeader } from "../components/common/Feedback";
import { Modal } from "../components/common/Modal";
import { PatientImportModal } from "../components/patients/PatientImportModal";
import { fetchDentalPayersApi } from "../services/payerService";
import { byAppointment, createPatientApi, importPatientsApi } from "../services/patientService";
import { useApp } from "../store/useApp";
import { usePatients } from "../store/usePatients";

function PatientRow({ p, onSelect }) {
  return (
    <div
      onClick={() => onSelect(p)}
      className="grid grid-cols-[1.4fr_1.2fr_1fr_0.9fr_24px] items-center px-4 py-[13px] border-b border-brand-border cursor-pointer font-sans text-[13.5px] hover:bg-slate-50/70 transition-colors"
    >
      <div className="font-medium text-brand-text">{p.name}</div>
      <div className="text-textMute">{p.payer}</div>
      <div className="text-textMute">{p.appt}</div>
      <div>
        <StatusBadge status={p.status} />
      </div>
      <ChevronRight size={16} className="text-textMute" />
    </div>
  );
}

function AddPatientModal({ saving, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [payers, setPayers] = useState([]);
  const [payerStediId, setPayerStediId] = useState("");
  const [payerQuery, setPayerQuery] = useState("");
  const [payersLoading, setPayersLoading] = useState(true);
  const [payerError, setPayerError] = useState("");
  const [payerReload, setPayerReload] = useState(0);
  const [subscriberId, setSubscriberId] = useState("");
  const [groupNumber, setGroupNumber] = useState("");
  const [appointment, setAppointment] = useState("");
  const valid = name.trim() && dob && payerStediId && subscriberId.trim();
  const today = new Date();
  const maxDob = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    let active = true;
    setPayersLoading(true);
    setPayerError("");
    fetchDentalPayersApi()
      .then((data) => {
        if (active) setPayers(data.payers || []);
      })
      .catch((error) => {
        if (active) setPayerError(error.message);
      })
      .finally(() => {
        if (active) setPayersLoading(false);
      });
    return () => { active = false; };
  }, [payerReload]);

  const filteredPayers = useMemo(() => {
    const query = payerQuery.trim().toLowerCase();
    const matches = query
      ? payers.filter((payer) =>
          payer.displayName.toLowerCase().includes(query)
          || payer.primaryPayerId.toLowerCase().includes(query)
          || payer.aliases?.some((alias) => alias.toLowerCase().includes(query))
        )
      : payers;
    return matches.slice(0, 150);
  }, [payerQuery, payers]);

  return (
    <Modal
      title="Add patient"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            disabled={saving || !valid}
            onClick={() => onAdd({
              name: name.trim(),
              dob,
              payerStediId,
              subscriberId: subscriberId.trim(),
              groupNumber: groupNumber.trim(),
              appointment: appointment ? new Date(appointment).toISOString() : null,
            })}
          >
            {saving ? "Adding..." : "Add patient"}
          </Btn>
        </>
      }
    >
      <Field label="Patient name *">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jordan Blake"
        />
      </Field>
      <Field label="Date of birth *">
        <Input type="date" max={maxDob} value={dob} onChange={(e) => setDob(e.target.value)} />
      </Field>
      <Field
        label="Insurance payer *"
        hint={payersLoading ? "Loading the Stedi dental payer directory..." : "Search by payer name or payer ID. Up to 150 matches are shown."}
      >
        <Input
          value={payerQuery}
          onChange={(event) => {
            setPayerQuery(event.target.value);
            setPayerStediId("");
          }}
          placeholder="Search payer name or ID..."
          disabled={payersLoading}
          className="mb-2"
        />
        <Select
          className="w-full"
          value={payerStediId}
          disabled={payersLoading || Boolean(payerError)}
          onChange={(event) => setPayerStediId(event.target.value)}
        >
          <option value="">{payersLoading ? "Loading payers..." : "Select insurance payer"}</option>
          {filteredPayers.map((payer) => (
            <option key={payer.stediId} value={payer.stediId}>
              {payer.displayName} — {payer.primaryPayerId}
            </option>
          ))}
        </Select>
        {payerError && (
          <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-brand-danger font-sans">
            <span>{payerError}</span>
            <Btn size="sm" variant="outline" onClick={() => setPayerReload((value) => value + 1)}>
              Retry
            </Btn>
          </div>
        )}
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Subscriber ID / Member ID *">
          <Input
            value={subscriberId}
            onChange={(e) => setSubscriberId(e.target.value)}
            placeholder="e.g. ABC123456789"
          />
        </Field>
        <Field label="Group number (Group #)">
          <Input
            value={groupNumber}
            onChange={(e) => setGroupNumber(e.target.value)}
            placeholder="e.g. GRP-2048"
          />
        </Field>
      </div>
      <Field label="Appointment date & time" hint="Optional">
        <Input
          type="datetime-local"
          value={appointment}
          onChange={(e) => setAppointment(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

export default function PatientsPage() {
  const { patients, setPatients, clinics, clinicId, push } = useApp();
  const navigate = useNavigate();
  usePatients();

  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creatingPatient, setCreatingPatient] = useState(false);

  const filtered = useMemo(
    () =>
      patients.filter(
        (patient) =>
          patient.clinicId === clinicId
          && patient.name.toLowerCase().includes(query.toLowerCase())
      ),
    [patients, clinicId, query]
  );

  async function addPatient(payload) {
    if (creatingPatient) return;
    setCreatingPatient(true);
    try {
      const added = await createPatientApi(clinicId, payload);
      setPatients((current) => [...current, added].sort(byAppointment));
      const clinicName = clinics.find((clinic) => clinic.id === clinicId)?.name || "this clinic";
      push(`${added.name} added to ${clinicName}`);
      setAdding(false);
    } catch (error) {
      push(error.message, "danger");
    } finally {
      setCreatingPatient(false);
    }
  }

  async function importPatients(rows) {
    try {
      const result = await importPatientsApi(clinicId, rows);
      setPatients((current) => [...current, ...(result.patients || [])].sort(byAppointment));
      const skipped = result.summary?.rejected || 0;
      push(
        `${result.summary?.imported || 0} patient${result.summary?.imported === 1 ? "" : "s"} imported${skipped ? `; ${skipped} skipped` : ""}`,
        result.summary?.imported ? "success" : "warn"
      );
      setImporting(false);
      return result;
    } catch (error) {
      push(error.message, "danger");
      throw error;
    }
  }

  return (
    <div>
      <SectionHeader
        title="Patients"
        subtitle={clinics.find((clinic) => clinic.id === clinicId)?.name || ""}
        action={
          <div className="flex gap-2">
            <Btn variant="outline" icon={Upload} onClick={() => setImporting(true)}>
              Import CSV/Excel
            </Btn>
            <Btn icon={Plus} onClick={() => setAdding(true)}>
              Add patient
            </Btn>
          </div>
        }
      />

      <div className="mb-4">
        <SearchBox value={query} onChange={setQuery} placeholder="Search patients..." />
      </div>

      <Card noPad className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[620px]">
            <div className="grid grid-cols-[1.4fr_1.2fr_1fr_0.9fr_24px] px-4 py-[11px] bg-[#F4F7FD] text-[11.5px] font-semibold text-textMute uppercase tracking-[0.3px]">
              <div>Patient</div>
              <div>Payer</div>
              <div>Appointment</div>
              <div>Status</div>
              <div />
            </div>
            {filtered.length === 0 && (
              <EmptyState icon={Users} text="No patients match your search." />
            )}
            {filtered.map((patient) => (
              <PatientRow
                key={patient.id}
                p={patient}
                onSelect={(selectedPatient) =>
                  navigate(
                    `/patients/${encodeURIComponent(selectedPatient.id)}/eligibility`
                  )
                }
              />
            ))}
          </div>
        </div>
      </Card>

      {importing && (
        <PatientImportModal
          onClose={() => setImporting(false)}
          onImport={importPatients}
        />
      )}
      {adding && (
        <AddPatientModal
          saving={creatingPatient}
          onClose={() => setAdding(false)}
          onAdd={addPatient}
        />
      )}
    </div>
  );
}

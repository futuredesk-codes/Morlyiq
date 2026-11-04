import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, FileSpreadsheet, Upload } from "lucide-react";
import { Badge } from "../common/Badge";
import { Btn } from "../common/Button";
import { Select } from "../common/FormControls";
import { Modal } from "../common/Modal";
import { fetchDentalPayersApi } from "../../services/payerService";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;
const REQUIRED_FIELDS = ["name", "dob", "payer", "subscriberId"];
const FIELDS = [
  { key: "name", label: "Patient name", required: true, aliases: ["patientname", "fullname", "patient", "ptfirstlastname", "firstnamelastname", "name"] },
  { key: "dob", label: "Date of birth", required: true, aliases: ["dob", "dateofbirth", "birthdate"] },
  { key: "payer", label: "Insurance payer", required: true, aliases: ["payer", "insurancepayer", "insurancecompany", "insurance", "insco", "payerid"] },
  { key: "subscriberId", label: "Subscriber / Member ID", required: true, aliases: ["subscriberid", "memberid", "subscriber", "subscriber#", "member#"] },
  { key: "groupNumber", label: "Group number", required: false, aliases: ["groupnumber", "group", "group#", "groupid"] },
  { key: "appointment", label: "Appointment date & time", required: false, aliases: ["appointment", "appointmentdate", "apptdate", "apptdatetime", "scheduledate"] },
];

const cleanHeader = (value, index) => String(value ?? "").replace(/^\uFEFF/, "").trim() || `Column ${index + 1}`;
const normalizedHeader = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9#]/g, "");
const normalizedPayer = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const cellText = (value) => value === null || value === undefined ? "" : String(value).trim();

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

async function readMatrix(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parseCsv(await file.text());
  if (extension === "xlsx") {
    const { readSheet } = await import("read-excel-file/browser");
    return readSheet(file, 1);
  }
  throw new Error("Select a CSV or Excel .xlsx file");
}

const excelDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && value > 0 && value < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000));
  }
  return null;
};

const dateParts = (date) => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
});

const isoDate = ({ year, month, day }) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function normalizeDob(value) {
  const spreadsheetDate = excelDate(value);
  if (spreadsheetDate) return isoDate(dateParts(spreadsheetDate));
  const text = cellText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return "";
  return isoDate({ year: Number(match[3]), month: Number(match[1]), day: Number(match[2]) });
}

function validDob(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    && parsed.getTime() <= Date.now();
}

function normalizeAppointment(value) {
  if (value === null || value === undefined || cellText(value) === "") return null;
  const spreadsheetDate = excelDate(value);
  if (spreadsheetDate) return spreadsheetDate.toISOString();
  const parsed = new Date(cellText(value));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function autoMapping(headers) {
  return Object.fromEntries(FIELDS.map((field) => {
    const index = headers.findIndex((header) => field.aliases.includes(normalizedHeader(header)));
    return [field.key, index >= 0 ? String(index) : ""];
  }));
}

function payerIndex(payers) {
  const index = new Map();
  payers.forEach((payer) => {
    [payer.stediId, payer.primaryPayerId, payer.displayName, payer.conciseName, ...(payer.aliases || [])]
      .forEach((value) => {
        const key = normalizedPayer(value);
        if (key && !index.has(key)) index.set(key, payer);
      });
  });
  return index;
}

function validateRows(rows, mapping, payers) {
  const payersByValue = payerIndex(payers);
  const seen = new Set();
  const valid = [];
  const invalid = [];
  const read = (row, key) => mapping[key] === "" ? "" : row[Number(mapping[key])];

  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    const name = cellText(read(row, "name"));
    const dob = normalizeDob(read(row, "dob"));
    const payerInput = cellText(read(row, "payer"));
    const payer = payersByValue.get(normalizedPayer(payerInput));
    const subscriberId = cellText(read(row, "subscriberId"));
    const groupNumber = cellText(read(row, "groupNumber"));
    const appointment = normalizeAppointment(read(row, "appointment"));
    const errors = [];

    if (!name) errors.push("Patient name is missing");
    else if (name.length > 160) errors.push("Patient name is longer than 160 characters");
    if (!validDob(dob)) errors.push("Date of birth is missing or invalid");
    if (!payer) errors.push(payerInput ? `Payer “${payerInput}” was not found in the Stedi directory` : "Insurance payer is missing");
    if (!subscriberId) errors.push("Subscriber / Member ID is missing");
    else if (subscriberId.length > 120) errors.push("Subscriber / Member ID is longer than 120 characters");
    if (groupNumber.length > 120) errors.push("Group number is longer than 120 characters");
    if (appointment === "") errors.push("Appointment date/time is invalid");

    const duplicateKey = `${payer?.stediId || ""}|${subscriberId.toLowerCase()}|${dob}`;
    if (!errors.length && seen.has(duplicateKey)) errors.push("Duplicate policy in this file");
    if (!errors.length) seen.add(duplicateKey);

    const mapped = {
      sourceRow,
      name,
      dob,
      payerStediId: payer?.stediId || "",
      subscriberId,
      groupNumber,
      appointment,
    };
    if (errors.length) invalid.push({ sourceRow, name: name || "Unnamed patient", errors });
    else valid.push(mapped);
  });
  return { valid, invalid };
}

export function PatientImportModal({ onClose, onImport }) {
  const inputRef = useRef(null);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const [payers, setPayers] = useState([]);
  const [payerError, setPayerError] = useState("");
  const [payersLoading, setPayersLoading] = useState(true);
  const [validation, setValidation] = useState({ valid: [], invalid: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchDentalPayersApi()
      .then((data) => { if (active) setPayers(data.payers || []); })
      .catch((error) => { if (active) setPayerError(error.message); })
      .finally(() => { if (active) setPayersLoading(false); });
    return () => { active = false; };
  }, []);

  const mappedIndexes = Object.values(mapping).filter((value) => value !== "");
  const mappingReady = REQUIRED_FIELDS.every((key) => mapping[key] !== undefined && mapping[key] !== "")
    && new Set(mappedIndexes).size === mappedIndexes.length;

  const sampleRows = useMemo(() => rows.slice(0, 3), [rows]);

  async function chooseFile(selected) {
    if (!selected) return;
    setFileError("");
    setReading(true);
    try {
      if (selected.size > MAX_FILE_BYTES) throw new Error("File must be 5 MB or smaller");
      const matrix = await readMatrix(selected);
      if (matrix.length < 2) throw new Error("The file must contain a header row and at least one patient row");
      const nextHeaders = matrix[0].map(cleanHeader);
      const nextRows = matrix.slice(1).filter((row) => row.some((value) => cellText(value)));
      if (!nextRows.length) throw new Error("No patient rows were found");
      if (nextRows.length > MAX_ROWS) throw new Error(`Import up to ${MAX_ROWS} patient rows at a time`);
      setFile(selected);
      setHeaders(nextHeaders);
      setRows(nextRows);
      setMapping(autoMapping(nextHeaders));
    } catch (error) {
      setFile(null);
      setHeaders([]);
      setRows([]);
      setMapping({});
      setFileError(error.message || "Could not read this file");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function runValidation() {
    const next = validateRows(rows, mapping, payers);
    setValidation(next);
    setStep(3);
  }

  async function commit() {
    if (!validation.valid.length || saving) return;
    setSaving(true);
    try {
      await onImport(validation.valid);
    } finally {
      setSaving(false);
    }
  }

  const close = () => { if (!saving) onClose(); };

  return (
    <Modal title={`Import patients — Step ${step} of 3`} onClose={close} width={760}>
      {step === 1 && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={reading}
            className="w-full border-[1.5px] border-dashed border-brand-border rounded-[12px] p-9 text-center bg-[#F4F7FD] hover:border-brand-blue transition-colors disabled:opacity-60"
          >
            <Upload size={27} className="text-textMute mb-2.5 mx-auto" />
            <div className="font-sans text-[14px] text-brand-text font-semibold">
              {reading ? "Reading file..." : file ? file.name : "Choose CSV or Excel file"}
            </div>
            <div className="font-sans text-[12px] text-textMute mt-1">
              CSV or .xlsx · first worksheet · maximum 500 rows / 5 MB
            </div>
          </button>
          {file && (
            <div className="mt-3 flex items-center gap-2 font-sans text-[12.5px] text-brand-success">
              <CheckCircle2 size={15} /> {rows.length} patient row{rows.length === 1 ? "" : "s"} detected
            </div>
          )}
          {fileError && (
            <div className="mt-3 flex items-start gap-2 rounded-[9px] bg-dangerSoft px-3 py-2.5 font-sans text-[12.5px] text-brand-danger">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {fileError}
            </div>
          )}
          <div className="mt-4 rounded-[10px] border border-brand-border p-3.5 font-sans text-[12px] text-textMute">
            Required columns: patient name, date of birth, insurance payer and subscriber/member ID. Group number and appointment are optional.
          </div>
          <div className="mt-4 flex justify-end"><Btn icon={ChevronRight} disabled={!file || reading} onClick={() => setStep(2)}>Map columns</Btn></div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-3 font-sans">
            <div className="text-[13px] font-semibold text-brand-text">Map spreadsheet columns</div>
            <Badge text={`${rows.length} rows`} tone="blue" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            {FIELDS.map((field) => (
              <div key={field.key} className="mb-3">
                <div className="font-sans text-[11.5px] font-semibold text-textMute uppercase mb-1.5">
                  {field.label}{field.required ? " *" : ""}
                </div>
                <Select
                  className="w-full"
                  value={mapping[field.key] ?? ""}
                  onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}
                >
                  <option value="">{field.required ? "Select column" : "Do not import"}</option>
                  {headers.map((header, index) => <option key={`${header}-${index}`} value={String(index)}>{header}</option>)}
                </Select>
              </div>
            ))}
          </div>
          {!mappingReady && mappedIndexes.length !== new Set(mappedIndexes).size && (
            <div className="font-sans text-[12px] text-brand-danger mb-3">Each spreadsheet column can be mapped only once.</div>
          )}
          <div className="border border-brand-border rounded-[10px] overflow-x-auto mb-4">
            <table className="w-full min-w-[560px] font-sans text-[11.5px]">
              <thead className="bg-[#F4F7FD] text-textMute"><tr>{headers.map((header, index) => <th key={`${header}-${index}`} className="text-left px-2.5 py-2 font-semibold">{header}</th>)}</tr></thead>
              <tbody>{sampleRows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-brand-border">{headers.map((_, columnIndex) => <td key={columnIndex} className="px-2.5 py-2 text-brand-text max-w-[180px] truncate">{cellText(row[columnIndex]) || "—"}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {payerError && <div className="mb-3 font-sans text-[12px] text-brand-danger">Payer directory unavailable: {payerError}</div>}
          <div className="flex justify-between gap-2"><Btn variant="outline" onClick={() => setStep(1)}>Back</Btn><Btn icon={ChevronRight} disabled={!mappingReady || payersLoading || Boolean(payerError)} onClick={runValidation}>{payersLoading ? "Loading payers..." : "Validate rows"}</Btn></div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-successSoft rounded-[10px] p-3.5 text-center"><div className="text-[22px] font-bold text-brand-success font-sans">{validation.valid.length}</div><div className="text-[12px] text-textMute font-sans">Ready to import</div></div>
            <div className="bg-warnSoft rounded-[10px] p-3.5 text-center"><div className="text-[22px] font-bold text-brand-warn font-sans">{validation.invalid.length}</div><div className="text-[12px] text-textMute font-sans">Rows need correction</div></div>
          </div>
          {validation.invalid.length > 0 && (
            <div className="mb-4">
              <div className="font-sans text-[12.5px] font-semibold text-brand-text mb-2">Rows that will not be imported</div>
              <div className="border border-brand-border rounded-[10px] max-h-[220px] overflow-y-auto">
                {validation.invalid.slice(0, 50).map((row) => (
                  <div key={row.sourceRow} className="px-3 py-2.5 border-b last:border-b-0 border-brand-border font-sans text-[12px]">
                    <div className="font-semibold text-brand-text">Row {row.sourceRow}: {row.name}</div>
                    <div className="text-brand-danger mt-0.5">{row.errors.join(" · ")}</div>
                  </div>
                ))}
              </div>
              {validation.invalid.length > 50 && <div className="font-sans text-[11.5px] text-textMute mt-1.5">Showing the first 50 invalid rows.</div>}
            </div>
          )}
          <div className="rounded-[10px] bg-blueSoft px-3.5 py-3 flex items-start gap-2 font-sans text-[12px] text-navy mb-4">
            <FileSpreadsheet size={16} className="mt-0.5 shrink-0" /> Only valid rows will be sent to the active clinic. The original file is not stored by MorlyIQ.
          </div>
          <div className="flex justify-between gap-2"><Btn variant="outline" disabled={saving} onClick={() => setStep(2)}>Back</Btn><Btn icon={CheckCircle2} disabled={saving || !validation.valid.length} onClick={commit}>{saving ? "Importing..." : `Import ${validation.valid.length} patients`}</Btn></div>
        </div>
      )}
    </Modal>
  );
}

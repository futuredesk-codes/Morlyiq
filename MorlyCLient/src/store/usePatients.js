import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { patientsLoaded } from "./slices/dataSlice.js";
import { fetchPatientsApi } from "../services/patientService.js";
import { useApp } from "./useApp.js";

// Fetches in progress, so two components asking for the same data at once make a single request
const inflight = new Set();

/**
 * Loads the ACTIVE clinic's patients for the pages that show them (Patients, Dashboard, Reports).
 * Other pages never call this, so they never hit GET /patients.
 *
 * Patients are fetched once per (login session + clinic): moving between those pages does not refetch,
 * switching clinic fetches that clinic, and a new login starts fresh (the key contains the session token).
 */
export function usePatients() {
  const dispatch = useDispatch();
  const { authed, token, clinicId, push } = useApp();
  const loadedKey = useSelector((state) => state.data.patientsKey);
  const key = authed && token && clinicId ? `${token}:${clinicId}` : null;

  useEffect(() => {
    if (!key || key === loadedKey || inflight.has(key)) return;
    inflight.add(key);
    fetchPatientsApi(clinicId)
      .then((list) => dispatch(patientsLoaded({ key, list })))
      .catch((err) => push(err.message, "danger"))
      .finally(() => inflight.delete(key));
  }, [key, loadedKey, clinicId, dispatch, push]);
}

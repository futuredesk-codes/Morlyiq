import React, { useEffect, useState } from "react";
import { Plus, Pencil, Archive, Trash2 } from "lucide-react";
import { C } from "../constants/theme.js";
import { STATUS_TONE } from "../constants/navigation.js";
import { Card, SectionHeader } from "../components/common/Card.jsx";
import { Btn, IconBtn } from "../components/common/Button.jsx";
import { Badge } from "../components/common/Badge.jsx";
import { Modal, ConfirmDialog } from "../components/common/Modal.jsx";
import {
  Input,
  Select,
  Field,
  CheckRow,
  Toggle,
} from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import { fetchFeaturesApi } from "../services/featureService.js";
import {
  createCouponApi,
  createPlanApi,
  deleteCouponApi,
  fetchCouponsApi,
  fetchPlansApi,
  updateCouponApi,
  updatePlanApi,
} from "../services/planService.js";

export default function PlansPage() {
  const {
    plans,
    setPlans,
    coupons,
    setCoupons,
    catalogue,
    setCatalogue,
    push,
    logAudit,
  } = useAdmin();

  const [editingPlan, setEditingPlan] = useState(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [creatingCoupon, setCreatingCoupon] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(null);
  const [deletingCoupon, setDeletingCoupon] = useState(null);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setCatalogueLoading(true);
    fetchFeaturesApi()
      .then((features) => {
        if (active) setCatalogue(features);
      })
      .catch((error) => {
        if (!active) return;
        setCatalogue([]);
        push(`Could not load plan features: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setCatalogueLoading(false);
      });
    return () => { active = false; };
  }, [push, setCatalogue]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchPlansApi(), fetchCouponsApi()])
      .then(([planRows, couponRows]) => {
        if (!active) return;
        setPlans(planRows);
        setCoupons(couponRows);
      })
      .catch((error) => {
        if (!active) return;
        setPlans([]);
        setCoupons([]);
        push(`Could not load plans and coupons: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [push, setCoupons, setPlans]);

  async function savePlan(plan) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updatePlanApi(plan.id, plan);
      setPlans((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      logAudit("Plan updated", updated.name, "info");
      push(`${updated.name} updated`);
      setEditingPlan(null);
    } catch (error) {
      push(`Could not update plan: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function createPlan(plan) {
    if (saving) return;
    setSaving(true);
    try {
      const created = await createPlanApi(plan);
      setPlans((prev) => [...prev, created]);
      logAudit("Plan created", created.name, "info");
      push(`Plan "${created.name}" created`);
      setCreatingPlan(false);
    } catch (error) {
      push(`Could not create plan: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function archivePlan(plan) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updatePlanApi(plan.id, { status: "Archived" });
      setPlans((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      logAudit("Plan archived", updated.name, "warn");
      push(`${updated.name} archived`, "warn");
      setDeletingPlan(null);
    } catch (error) {
      push(`Could not archive plan: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCoupon(coupon) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateCouponApi(coupon.id, { active: !coupon.active });
      setCoupons((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      push(updated.active ? `${updated.code} activated` : `${updated.code} deactivated`);
    } catch (error) {
      push(`Could not update coupon: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCoupon(coupon) {
    if (saving) return;
    setSaving(true);
    try {
      await deleteCouponApi(coupon.id);
      setCoupons((prev) => prev.filter((item) => item.id !== coupon.id));
      push(`${coupon.code} deleted`, "warn");
      setDeletingCoupon(null);
    } catch (error) {
      push(`Could not delete coupon: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function createCoupon(coupon) {
    if (saving) return;
    setSaving(true);
    try {
      const created = await createCouponApi(coupon);
      setCoupons((prev) => [created, ...prev]);
      push(`Coupon ${created.code} created`);
      setCreatingCoupon(false);
    } catch (error) {
      push(`Could not create coupon: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="Plans & Coupons"
        subtitle="Build any number of custom plans — no fixed Basic/Pro/Monthly/Annual tiers"
        action={
          <Btn icon={Plus} disabled={catalogueLoading || loading || saving} onClick={() => setCreatingPlan(true)}>
            New plan
          </Btn>
        }
      />

      {/* Plans Table */}
      <Card noPad style={{ marginBottom: 24 }} className="overflow-x-auto">
        <div
          className="min-w-[760px] grid grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_1fr_0.7fr_130px] p-[11px_16px] uppercase font-bold text-xs"
          style={{
            background: C.blueSoft2,
            color: C.textMute,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div>Plan name</div>
          <div>Price</div>
          <div>Period</div>
          <div>Usage limit</div>
          <div>Features</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {loading && (
          <div className="p-8 text-center text-sm" style={{ color: C.textFaint }}>
            Loading plans from database…
          </div>
        )}

        {!loading && plans.length === 0 && (
          <div className="p-8 text-center text-sm" style={{ color: C.textFaint }}>
            No plans found. Create the first plan to get started.
          </div>
        )}

        {!loading && plans.map((p) => (
          <div
            key={p.id}
            className="min-w-[760px] grid grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_1fr_0.7fr_130px] items-center p-[11px_16px] border-t text-[13px]"
            style={{
              borderColor: C.border,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: C.navy }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: C.textFaint }}>
                {p.clientCount} client(s) assigned
              </div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {p.price === null ? "Custom" : `$${p.price}`}
            </div>
            <div style={{ color: C.textMute }}>{p.period}</div>
            <div style={{ color: C.textMute }}>
              {p.usageLimit === null ? "Unlimited" : p.usageLimit}
            </div>
            <div style={{ color: C.textMute, fontSize: 12 }}>
              {(p.features || []).filter((key) => catalogue.some((feature) => feature.key === key)).length} of {catalogue.length}
            </div>
            <div>
              <Badge text={p.status} tone={STATUS_TONE[p.status] || "neutral"} />
            </div>
            <div className="flex gap-1 items-center">
              <IconBtn
                icon={Pencil}
                title="Edit plan"
                onClick={() => setEditingPlan(p)}
              />
              {p.status !== "Archived" && (
                <IconBtn
                  icon={Archive}
                  title="Archive plan"
                  onClick={() => setDeletingPlan(p)}
                />
              )}
            </div>
          </div>
        ))}
      </Card>

      {/* Coupons Section */}
      <div className="flex justify-between items-center mb-3.5">
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: C.text,
          }}
        >
          Coupons
        </div>
        <Btn icon={Plus} size="sm" disabled={loading || saving} onClick={() => setCreatingCoupon(true)}>
          New coupon
        </Btn>
      </div>

      <Card noPad className="overflow-x-auto">
        <div
          className="min-w-[620px] grid grid-cols-[1fr_0.7fr_0.7fr_0.9fr_0.7fr_90px] p-[11px_16px] uppercase font-bold text-xs"
          style={{
            background: C.blueSoft2,
            color: C.textMute,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div>Code</div>
          <div>Discount</div>
          <div>Redemptions</div>
          <div>Expires</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {loading && (
          <div className="p-8 text-center text-sm" style={{ color: C.textFaint }}>
            Loading coupons from database…
          </div>
        )}

        {!loading && coupons.length === 0 && (
          <div className="p-8 text-center text-sm" style={{ color: C.textFaint }}>
            No coupons found.
          </div>
        )}

        {!loading && coupons.map((c) => (
          <div
            key={c.id}
            className="min-w-[620px] grid grid-cols-[1fr_0.7fr_0.7fr_0.9fr_0.7fr_90px] items-center p-[11px_16px] border-t text-[13px]"
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
              {c.code}
            </div>
            <div>{c.pct}%</div>
            <div style={{ color: C.textMute }}>{c.redemptions}</div>
            <div style={{ color: C.textMute }}>{c.expires}</div>
            <div>
              <Toggle disabled={saving} on={c.active} onChange={() => toggleCoupon(c)} />
            </div>
            <div>
              <IconBtn
                icon={Trash2}
                tone="danger"
                title="Delete coupon"
                onClick={() => setDeletingCoupon(c)}
              />
            </div>
          </div>
        ))}
      </Card>

      {/* Plan Form Modal (Edit) */}
      {editingPlan && (
        <PlanFormModal
          title={`Edit ${editingPlan.name}`}
          initial={editingPlan}
          catalogue={catalogue}
          saving={saving}
          onClose={() => setEditingPlan(null)}
          onSave={savePlan}
        />
      )}

      {/* Plan Form Modal (Create) */}
      {creatingPlan && (
        <PlanFormModal
          title="Create new plan"
          initial={{
            name: "",
            price: 0,
            currency: "USD",
            period: "1 month",
            usageLimit: 100,
            status: "Draft",
            features: [],
          }}
          catalogue={catalogue}
          saving={saving}
          onClose={() => setCreatingPlan(false)}
          onSave={createPlan}
          isNew
        />
      )}

      {/* Create Coupon Modal */}
      {creatingCoupon && (
        <CreateCouponModal
          saving={saving}
          onClose={() => setCreatingCoupon(false)}
          onCreate={createCoupon}
        />
      )}

      {/* Archive Plan Confirmation */}
      {deletingPlan && (
        <ConfirmDialog
          title="Archive plan?"
          message={`"${deletingPlan.name}" will be archived. Clients already on this plan keep it until moved.`}
          confirmLabel="Archive"
          onConfirm={() => archivePlan(deletingPlan)}
          onCancel={() => setDeletingPlan(null)}
        />
      )}

      {deletingCoupon && (
        <ConfirmDialog
          title="Delete coupon?"
          message={`"${deletingCoupon.code}" will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={() => deleteCoupon(deletingCoupon)}
          onCancel={() => setDeletingCoupon(null)}
        />
      )}
    </div>
  );
}

function PlanFormModal({ title, initial, catalogue, saving, onClose, onSave, isNew }) {
  const [plan, setPlan] = useState({ ...initial, id: initial.id || undefined });

  function toggleFeature(key) {
    setPlan((p) => ({
      ...p,
      features: p.features.includes(key)
        ? p.features.filter((k) => k !== key)
        : [...p.features, key],
    }));
  }

  return (
    <Modal
      title={title}
      width={640}
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>
            Cancel
          </Btn>
          <Btn disabled={saving || !plan.name.trim() || !plan.period.trim()} onClick={() => onSave(plan)}>
            {saving ? "Saving…" : isNew ? "Create plan" : "Save plan"}
          </Btn>
        </>
      }
    >
      <Field label="Plan name">
        <Input
          autoFocus
          value={plan.name}
          onChange={(e) => setPlan({ ...plan, name: e.target.value })}
          placeholder="Any custom title — no fixed tiers"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Field label="Price (blank = custom)">
          <Input
            type="number"
            value={plan.price ?? ""}
            onChange={(e) =>
              setPlan({
                ...plan,
                price: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Currency">
          <Select
            value={plan.currency}
            onChange={(e) => setPlan({ ...plan, currency: e.target.value })}
          >
            <option>USD</option>
            <option>INR</option>
            <option>EUR</option>
            <option>GBP</option>
          </Select>
        </Field>
        <Field label="Billing period">
          <Input
            value={plan.period}
            onChange={(e) => setPlan({ ...plan, period: e.target.value })}
            placeholder="e.g. 1 month, 3 months, 9 months"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Usage limit (verifications, blank = unlimited)">
          <Input
            type="number"
            value={plan.usageLimit ?? ""}
            onChange={(e) =>
              setPlan({
                ...plan,
                usageLimit:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Status">
          <Select
            value={plan.status}
            onChange={(e) => setPlan({ ...plan, status: e.target.value })}
          >
            <option>Draft</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>Archived</option>
          </Select>
        </Field>
      </div>

      <Field
        label="Feature bundle"
        hint="Attach any combination — plans aren't tied to a fixed feature set."
      >
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 border rounded-lg p-2 max-h-56 overflow-y-auto"
          style={{ borderColor: C.border }}
        >
          {catalogue.map((f) => (
            <CheckRow
              key={f.key}
              label={f.name}
              checked={plan.features.includes(f.key)}
              onChange={() => toggleFeature(f.key)}
            />
          ))}
        </div>
      </Field>
    </Modal>
  );
}

function CreateCouponModal({ saving, onClose, onCreate }) {
  const [code, setCode] = useState("");
  const [pct, setPct] = useState(10);
  const [expires, setExpires] = useState("2026-12-31");

  return (
    <Modal
      title="Create coupon"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            disabled={saving || !code.trim() || !expires}
            onClick={() =>
              onCreate({
                code: code.trim().toUpperCase(),
                pct: Number(pct),
                expires,
              })
            }
          >
            {saving ? "Creating…" : "Create coupon"}
          </Btn>
        </>
      }
    >
      <Field label="Coupon code">
        <Input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. FALL2026"
        />
      </Field>
      <Field label="Discount %">
        <Input
          type="number"
          min={1}
          max={100}
          value={pct}
          onChange={(e) => setPct(e.target.value)}
        />
      </Field>
      <Field label="Expires">
        <Input
          type="date"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

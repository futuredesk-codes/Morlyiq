import React, { useEffect, useState } from "react";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { C } from "../constants/theme.js";
import { Card, SectionHeader, EmptyState } from "../components/common/Card.jsx";
import { Btn, IconBtn } from "../components/common/Button.jsx";
import { Badge } from "../components/common/Badge.jsx";
import { Modal, ConfirmDialog } from "../components/common/Modal.jsx";
import { Input, TextArea, Select, Field, CheckRow } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import {
  createAnnouncementApi,
  deleteAnnouncementApi,
  fetchAnnouncementsApi,
  updateAnnouncementStatusApi,
} from "../services/announcementService.js";

const AUDIENCE_OPTIONS = ["All clients", "Selected plans", "Trial accounts"];
const displayDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : "—";

export default function AnnouncementsPage() {
  const { announcements, setAnnouncements, push, logAudit } = useAdmin();
  const [plans, setPlans] = useState([]);
  const [audienceOptions, setAudienceOptions] = useState(AUDIENCE_OPTIONS);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAnnouncementsApi()
      .then((data) => {
        if (!active) return;
        setAnnouncements(data.announcements || []);
        setPlans(data.plans || []);
        setAudienceOptions(data.audienceOptions || AUDIENCE_OPTIONS);
      })
      .catch((error) => {
        if (!active) return;
        setAnnouncements([]);
        push(`Could not load announcements: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [push, setAnnouncements]);

  async function togglePublish(announcement) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateAnnouncementStatusApi(announcement.id, !announcement.published);
      setAnnouncements((previous) => previous.map((item) => item.id === updated.id ? updated : item));
      logAudit(updated.published ? "Announcement published" : "Announcement unpublished", updated.title, "info");
      push(`"${updated.title}" ${updated.published ? "published" : "unpublished"}`);
    } catch (error) {
      push(`Could not update announcement: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function create(announcement) {
    if (saving) return;
    setSaving(true);
    try {
      const created = await createAnnouncementApi(announcement);
      setAnnouncements((previous) => [created, ...previous]);
      logAudit("Announcement drafted", created.title, "info");
      push("Announcement drafted");
      setCreating(false);
    } catch (error) {
      push(`Could not create announcement: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function remove(announcement) {
    if (saving) return;
    setSaving(true);
    try {
      await deleteAnnouncementApi(announcement.id);
      setAnnouncements((previous) => previous.filter((item) => item.id !== announcement.id));
      logAudit("Announcement deleted", announcement.title, "warn");
      push("Announcement deleted", "warn");
      setDeleting(null);
    } catch (error) {
      push(`Could not delete announcement: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="Announcements"
        subtitle="Broadcast updates to client accounts"
        action={
          <Btn icon={Plus} disabled={loading || saving} onClick={() => setCreating(true)}>
            New announcement
          </Btn>
        }
      />

      <div className="flex flex-col gap-3">
        {loading && (
          <Card><div className="text-center text-sm" style={{ color: C.textFaint }}>Loading announcements from database...</div></Card>
        )}

        {!loading && announcements.length === 0 && (
          <EmptyState icon={Megaphone} text="No announcements drafted or published yet." />
        )}

        {!loading && announcements.map((announcement) => {
          const selectedPlanNames = announcement.targetPlans?.map((plan) => plan.name).join(", ");
          const audienceLabel = announcement.audience === "Selected plans" && selectedPlanNames
            ? `Selected plans (${selectedPlanNames})`
            : announcement.audience;
          return (
            <Card key={announcement.id}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14.5, fontWeight: 700, color: C.text }}>
                      {announcement.title}
                    </div>
                    <Badge
                      text={announcement.published ? "Published" : "Draft"}
                      tone={announcement.published ? "success" : "neutral"}
                    />
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.textMute, lineHeight: 1.5, marginBottom: 8 }}>
                    {announcement.body}
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11.5, color: C.textFaint }}>
                    Audience: {audienceLabel} · {displayDate(announcement.createdAt)}
                  </div>
                </div>
                <div className="flex gap-1 items-center shrink-0">
                  <Btn
                    size="sm"
                    variant={announcement.published ? "outline" : "accent"}
                    disabled={saving}
                    onClick={() => togglePublish(announcement)}
                  >
                    {announcement.published ? "Unpublish" : "Publish"}
                  </Btn>
                  <IconBtn
                    icon={Trash2}
                    tone="danger"
                    disabled={saving}
                    onClick={() => setDeleting(announcement)}
                    title="Delete"
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {creating && (
        <CreateAnnouncementModal
          plans={plans}
          audienceOptions={audienceOptions}
          saving={saving}
          onClose={() => setCreating(false)}
          onCreate={create}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete announcement?"
          message={`"${deleting.title}" will be permanently removed.`}
          confirmLabel={saving ? "Deleting..." : "Delete"}
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function CreateAnnouncementModal({ plans, audienceOptions, saving, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("All clients");
  const [targetPlans, setTargetPlans] = useState([]);
  const valid = title.trim() && body.trim() && (audience !== "Selected plans" || targetPlans.length > 0);

  function togglePlan(id) {
    setTargetPlans((previous) => previous.includes(id)
      ? previous.filter((planId) => planId !== id)
      : [...previous, id]
    );
  }

  return (
    <Modal
      title="New announcement"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" disabled={saving} onClick={onClose}>Cancel</Btn>
          <Btn
            disabled={saving || !valid}
            onClick={() => onCreate({ title: title.trim(), body: body.trim(), audience, targetPlans })}
          >
            {saving ? "Saving..." : "Save as draft"}
          </Btn>
        </>
      }
    >
      <Field label="Title">
        <Input autoFocus maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Message">
        <TextArea maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} />
      </Field>
      <Field label="Audience">
        <Select value={audience} onChange={(event) => setAudience(event.target.value)}>
          {audienceOptions.map((option) => <option key={option}>{option}</option>)}
        </Select>
      </Field>

      {audience === "Selected plans" && (
        <Field label="Plans" hint="Select one or more plans that should receive this announcement.">
          <div className="max-h-36 overflow-y-auto border rounded-lg p-2" style={{ borderColor: C.border }}>
            {plans.length === 0 && <div className="text-xs p-1" style={{ color: C.textFaint }}>No plans available.</div>}
            {plans.map((plan) => (
              <CheckRow
                key={plan.id}
                label={`${plan.name} (${plan.status})`}
                checked={targetPlans.includes(plan.id)}
                onChange={() => togglePlan(plan.id)}
              />
            ))}
          </div>
        </Field>
      )}
    </Modal>
  );
}

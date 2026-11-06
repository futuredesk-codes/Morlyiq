import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, FileText, PhoneCall, Search, Users, X } from "lucide-react";
import { C } from "../../constants/theme.js";
import { NAV_SECTIONS, canAccessAdminView, canAdminDo } from "../../constants/navigation.js";
import { useAdmin } from "../../store/useAdmin.js";
import { searchAdminApi } from "../../services/searchService.js";

const TYPES = { client: { label: "Client", Icon: Building2 }, user: { label: "Admin user", Icon: Users }, lead: { label: "Lead", Icon: PhoneCall }, page: { label: "Page", Icon: FileText } };

export function GlobalSearch() {
  const { currentUser } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const listId = useId();
  const root = useRef(null);
  const input = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [response, setResponse] = useState({ key: "", rows: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  const term = query.trim();
  const accessKey = JSON.stringify([currentUser?.id, currentUser?.role, currentUser?.client, currentUser?.permissions]);
  const resultKey = `${accessKey}:${term}`;
  const canSearchRecords = currentUser?.role === "Super Admin" || canAdminDo(currentUser, "leads", "view");
  const pages = useMemo(() => term.length < 2 ? [] : NAV_SECTIONS.flatMap((section) => section.items)
    .filter((item) => canAccessAdminView(item.key, currentUser) && item.label.toLowerCase().includes(term.toLowerCase()))
    .slice(0, 5).map((item) => ({ type: "page", id: item.key, title: item.label, subtitle: "Open page", url: item.path })), [term, accessKey]);
  const rows = [...pages, ...(response.key === resultKey ? response.rows : [])];

  useEffect(() => {
    if (!open || term.length < 2 || !canSearchRecords) { setLoading(false); setError(""); return undefined; }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      searchAdminApi(term, controller.signal).then((results) => {
        if (active) setResponse({ key: resultKey, rows: results });
      }).catch((failure) => {
        if (active && failure.name !== "AbortError") { setError("Search could not be loaded. Please try again."); setResponse({ key: resultKey, rows: [] }); }
      }).finally(() => { if (active) setLoading(false); });
    }, 500);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [term, resultKey, open, canSearchRecords]);

  useEffect(() => {
    const outside = (event) => { if (!root.current?.contains(event.target)) { setOpen(false); setMobileOpen(false); } };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  useEffect(() => { setOpen(false); setMobileOpen(false); setQuery(""); setSelected(0); setResponse({ key: "", rows: [] }); }, [location.pathname, location.search, accessKey]);
  useEffect(() => { if (mobileOpen) input.current?.focus(); }, [mobileOpen]);
  useEffect(() => {
    if (open && rows.length) document.getElementById(`${listId}-${Math.min(selected, rows.length - 1)}`)?.scrollIntoView({ block: "nearest" });
  }, [selected, open, rows.length, listId]);

  function choose(row) {
    setOpen(false); setMobileOpen(false); setQuery("");
    navigate(row.url);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") { setOpen(false); setMobileOpen(false); input.current?.blur(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); setOpen(true);
      if (rows.length) setSelected((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length);
    }
    if (event.key === "Enter" && open && rows.length) { event.preventDefault(); choose(rows[Math.min(selected, rows.length - 1)]); }
  }

  return <div ref={root} className="relative" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setMobileOpen(false); }
  }}>
    <button type="button" className="md:hidden flex p-1.5 rounded-lg hover:bg-slate-100" title="Search Admin" aria-label="Search Admin" onClick={() => { setMobileOpen(true); setOpen(true); }}><Search size={18} /></button>
    <div className={mobileOpen ? "fixed left-4 right-4 top-[70px] md:static md:w-[300px]" : "hidden md:block md:w-[300px]"}>
      <div className="relative">
        <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textFaint }} />
        <input ref={input} type="search" maxLength={100} value={query} autoComplete="off" placeholder="Search clients, users, leads..."
          role="combobox" aria-label="Search Admin pages and records" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && rows.length ? `${listId}-${Math.min(selected, rows.length - 1)}` : undefined}
          className="w-full rounded-lg border bg-white py-2 pl-9 pr-9 text-[12.5px] outline-none focus:ring-2 focus:ring-blue-100"
          style={{ borderColor: C.border, color: C.text }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setSelected(0); setError(""); }} />
        {query && <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1" onClick={() => { setQuery(""); input.current?.focus(); }}><X size={13} /></button>}
      </div>
      {open && <div id={listId} role="listbox" aria-label="Search results" className="absolute right-0 mt-2 w-full md:w-[380px] overflow-hidden rounded-xl border bg-white shadow-xl z-50" style={{ borderColor: C.border }}>
        <div className="max-h-[min(440px,65vh)] overflow-y-auto">
          {term.length < 2 && <p className="px-4 py-5 text-xs" style={{ color: C.textMute }}>Type at least 2 characters to search permitted pages and records.</p>}
          {rows.map((row, index) => {
            const { label, Icon } = TYPES[row.type] || TYPES.page;
            return <button key={`${row.type}:${row.id}`} id={`${listId}-${index}`} type="button" tabIndex={-1} role="option" aria-selected={selected === index}
              className="flex w-full items-start gap-3 px-4 py-3 text-left border-b last:border-0"
              style={{ borderColor: C.border, background: selected === index ? C.blueSoft2 : "white" }}
              onMouseEnter={() => setSelected(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(row)}>
              <Icon size={16} className="mt-0.5 shrink-0" style={{ color: C.navy }} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold" style={{ color: C.text }}>{row.title}</span>
                <span className="block truncate text-[11px] mt-0.5" style={{ color: C.textMute }}>{label} · {row.subtitle}</span></span>
            </button>;
          })}
          {loading && term.length >= 2 && <p role="status" className="px-4 py-3 text-xs" style={{ color: C.textMute }}>Searching...</p>}
          {error && <p role="alert" className="px-4 py-3 text-xs" style={{ color: C.danger }}>{error}</p>}
          {term.length >= 2 && !loading && !error && !rows.length && <p className="px-4 py-5 text-xs" style={{ color: C.textMute }}>No accessible results found.</p>}
        </div>
        {rows.length > 0 && <div className="px-4 py-2 text-[10px] border-t" style={{ color: C.textFaint, borderColor: C.border }}>↑ ↓ to select · Enter to open · Esc to close · Up to 5 matches per record type</div>}
      </div>}
    </div>
  </div>;
}

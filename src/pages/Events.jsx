// @ts-nocheck
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Edit, Plus, Save, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CUSTOMER_EVENTS_SETTINGS_KEY,
  DEFAULT_EVENT_BUTTONS,
  LOS_TIOS_DEFAULT_EVENT_LOCATION,
  SEEDED_CUSTOMER_EVENTS,
  eventDateLabel,
  isCustomerEventPast,
  listLocalCustomerEvents,
  normalizeEventButtons,
  parseCustomerEvents,
  saveLocalCustomerEvents,
  serializeCustomerEvents,
} from "@/lib/customerEvents";
import { DEFAULT_APP_SETTINGS, buildDefaultAppSettings } from "@/lib/appSettings";
import { appParams } from "@/lib/app-params";

const emptyForm = () => ({
  id: "",
  startDate: "",
  endDate: "",
  badgeEs: "",
  badgeEn: "",
  titleEs: "",
  titleEn: "",
  descriptionEs: "",
  descriptionEn: "",
  location: LOS_TIOS_DEFAULT_EVENT_LOCATION,
  buttonsEs: DEFAULT_EVENT_BUTTONS.map((b) => ({ emoji: b.emoji, text: b.es })),
  buttonsEn: DEFAULT_EVENT_BUTTONS.map((b) => ({ emoji: b.emoji, text: b.en })),
});

function slugify(text) {
  return String(text || "event")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeForm(form) {
  return {
    ...form,
    id: form.id || `${slugify(form.titleEn || form.titleEs)}-${Date.now()}`,
    endDate: form.endDate || form.startDate,
    location: form.location?.trim() || LOS_TIOS_DEFAULT_EVENT_LOCATION,
    buttonsEs: normalizeEventButtons(form.buttonsEs, "es"),
    buttonsEn: normalizeEventButtons(form.buttonsEn, "en"),
  };
}

const labelClass = "text-sm font-semibold text-yellow-50";
const fieldClass =
  "border-yellow-500/40 bg-[#252319] text-yellow-50 placeholder:text-gray-300 focus-visible:ring-yellow-400/35 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert";
const textareaClass =
  "border-yellow-500/40 bg-[#252319] text-yellow-50 placeholder:text-gray-300 focus-visible:ring-yellow-400/35";

const EVENT_EMOJI_OPTIONS = [
  { value: "\uD83C\uDF7A", label: "Beer" },
  { value: "\uD83C\uDF55", label: "Pizza" },
  { value: "\u2728", label: "Sparkle" },
  { value: "\uD83C\uDF89", label: "Party" },
  { value: "\uD83E\uDD42", label: "Welcome" },
  { value: "\uD83E\uDD43", label: "Mezcal" },
  { value: "\u26BD", label: "Football" },
  { value: "\uD83C\uDFB5", label: "Music" },
  { value: "\uD83D\uDD25", label: "Fire" },
  { value: "\uD83C\uDF7D\uFE0F", label: "Food" },
  { value: "\uD83C\uDF05", label: "Sunset" },
  { value: "\uD83C\uDF2E", label: "Taco" },
  { value: "\uD83C\uDF74", label: "Dinner" },
  { value: "\uD83C\uDF81", label: "Special" },
  { value: "\uD83D\uDCCD", label: "Location" },
  { value: "\uD83D\uDC6B", label: "Friends" },
  { value: "\uD83C\uDFD6\uFE0F", label: "Beach" },
  { value: "\uD83D\uDC83", label: "Dance" },
  { value: "\uD83C\uDFC6", label: "Win" },
  { value: "\uD83D\uDCA5", label: "Pop" },
];

function appSettingsPayload(settings) {
  return Object.fromEntries(
    Object.keys(DEFAULT_APP_SETTINGS).map((key) => [key, settings?.[key] ?? DEFAULT_APP_SETTINGS[key]]),
  );
}

function isAppNotFoundError(error) {
  return String(error?.message || error || "").toLowerCase().includes("app not found");
}

function EventSummary({ event, onEdit, onDelete }) {
  const past = isCustomerEventPast(event);
  return (
    <div className="rounded-xl border border-yellow-500/15 bg-black/25 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-500/70">
            {event.source === "seed" ? "Previously registered" : "Admin event"} · {past ? "Past" : "Upcoming"}
          </p>
          <h3 className="mt-1 text-lg font-bold text-yellow-50">{event.titleEn || event.titleEs}</h3>
          <p className="mt-1 text-sm text-gray-400">
            {eventDateLabel(event, "en")} · {event.location || "No location"}
          </p>
        </div>
        <div className="flex gap-2">
          {event.source !== "seed" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEdit(event)}
                className="border-yellow-500/35 bg-[#242018] text-yellow-100 hover:bg-yellow-400/10"
              >
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onDelete(event.id)}
                className="border-red-500/40 bg-red-950/20 text-red-200 hover:bg-red-500/10"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-[#171717] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Español mexicano</p>
          <p className="mt-2 font-semibold text-gray-100">{event.titleEs}</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-400">{event.descriptionEs}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#171717] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">English</p>
          <p className="mt-2 font-semibold text-gray-100">{event.titleEn}</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-400">{event.descriptionEn}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {normalizeEventButtons(event.buttonsEn, "en").map((button, index) => (
          <div key={`${event.id}-button-${index}`} className="rounded-lg bg-yellow-400/10 p-2 text-center text-xs font-semibold text-yellow-200">
            <span className="block text-base">{button.emoji}</span>
            {button.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Events() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [saveError, setSaveError] = useState("");
  const [localEvents, setLocalEvents] = useState(() => listLocalCustomerEvents());
  const hasBase44App = Boolean(appParams.appId && appParams.serverUrl);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      if (!hasBase44App) return [];
      try {
        return await base44.entities.AppSettings.list();
      } catch (error) {
        if (isAppNotFoundError(error)) return [];
        throw error;
      }
    },
    retry: false,
  });

  const currentSettings = buildDefaultAppSettings(settings[0] || {});
  const remoteEvents = useMemo(() => parseCustomerEvents(currentSettings), [currentSettings]);
  const adminEvents = hasBase44App && remoteEvents.length > 0 ? remoteEvents : localEvents;
  const allEvents = useMemo(
    () =>
      [...adminEvents.map((event) => ({ ...event, source: "admin" })), ...SEEDED_CUSTOMER_EVENTS]
        .sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || ""))),
    [adminEvents],
  );

  const saveSettings = useMutation({
    mutationFn: async (nextEvents) => {
      if (!hasBase44App) {
        saveLocalCustomerEvents(nextEvents);
        return { local: true, events: nextEvents };
      }
      const payload = {
        ...appSettingsPayload(currentSettings),
        [CUSTOMER_EVENTS_SETTINGS_KEY]: serializeCustomerEvents(nextEvents),
      };
      try {
        const result = settings[0]
          ? await base44.entities.AppSettings.update(settings[0].id, payload)
          : await base44.entities.AppSettings.create(payload);
        return { local: false, result };
      } catch (error) {
        if (!isAppNotFoundError(error)) throw error;
        saveLocalCustomerEvents(nextEvents);
        return { local: true, events: nextEvents, fallback: true };
      }
    },
    onSuccess: (result) => {
      if (result?.local) {
        setLocalEvents(result.events || listLocalCustomerEvents());
      } else {
        queryClient.invalidateQueries({ queryKey: ["appSettings"] });
      }
      setForm(emptyForm());
      setEditingId("");
      setSaveError("");
      alert(result?.local ? "Event saved locally." : "Event saved.");
    },
    onError: (error) => {
      const message = error?.message || "Could not save the event. Check Base44 connection and try again.";
      setSaveError(message);
      alert(`Event could not be saved: ${message}`);
    },
  });

  const setButton = (langKey, index, patch) => {
    setForm((prev) => {
      const next = [...prev[langKey]];
      next[index] = { ...next[index], ...patch };
      return { ...prev, [langKey]: next };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaveError("");
    if (!form.startDate || !form.titleEs || !form.titleEn || !form.descriptionEs || !form.descriptionEn) {
      alert("Date, Spanish title/description, and English title/description are required.");
      return;
    }
    const nextEvent = normalizeForm(form);
    const nextEvents = editingId
      ? adminEvents.map((event) => (event.id === editingId ? nextEvent : event))
      : [nextEvent, ...adminEvents];
    saveSettings.mutate(nextEvents);
  };

  const handleEdit = (event) => {
    setEditingId(event.id);
    setForm({
      ...emptyForm(),
      ...event,
      buttonsEs: normalizeEventButtons(event.buttonsEs, "es"),
      buttonsEn: normalizeEventButtons(event.buttonsEn, "en"),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (eventId) => {
    if (!window.confirm("Delete this event from the customer page?")) return;
    saveSettings.mutate(adminEvents.filter((event) => event.id !== eventId));
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#111] p-8 text-gray-300">Loading events...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0c] p-4 text-gray-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yellow-500/80">Admin</p>
          <h1 className="text-3xl font-black text-yellow-50">Events</h1>
          <p className="max-w-3xl text-sm text-gray-400">
            Create customer-facing events with a date or date range. Past/upcoming is calculated automatically from the end date.
            Both Mexican Spanish and English copy are required.
          </p>
        </div>

        <Card className="border-yellow-500/20 bg-[#181610]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-50">
              <CalendarDays className="h-5 w-5 text-yellow-400" />
              {editingId ? "Edit event" : "Create event"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {saveError ? (
                <div className="rounded-lg border border-red-500/35 bg-red-950/30 px-3 py-2 text-sm font-medium text-red-100">
                  {saveError}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label className={labelClass}>Start date *</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={fieldClass} />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>End date</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={fieldClass} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className={labelClass}>Location / small footer</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={fieldClass} placeholder={LOS_TIOS_DEFAULT_EVENT_LOCATION} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-yellow-500/15 bg-black/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-500/80">Mexican Spanish</p>
                  <Input value={form.badgeEs} onChange={(e) => setForm({ ...form, badgeEs: e.target.value })} className={fieldClass} placeholder="Badge, e.g. 4 PM HASTA TARDE" />
                  <Input required value={form.titleEs} onChange={(e) => setForm({ ...form, titleEs: e.target.value })} className={fieldClass} placeholder="Title in Spanish" />
                  <Textarea required rows={5} value={form.descriptionEs} onChange={(e) => setForm({ ...form, descriptionEs: e.target.value })} className={textareaClass} placeholder="Descripcion en espanol mexicano" />
                </div>
                <div className="space-y-3 rounded-xl border border-yellow-500/15 bg-black/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-500/80">English</p>
                  <Input value={form.badgeEn} onChange={(e) => setForm({ ...form, badgeEn: e.target.value })} className={fieldClass} placeholder="Badge, e.g. 4 PM TILL LATE" />
                  <Input required value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} className={fieldClass} placeholder="Title in English" />
                  <Textarea required rows={5} value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} className={textareaClass} placeholder="Description in English" />
                </div>
              </div>

              <div className="rounded-xl border border-yellow-500/15 bg-black/20 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-500/80">Four buttons on the event card</p>
                <p className="mt-1 text-xs text-gray-500">Each button has one emoji plus short text. Spanish and English are shown on their own language card.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="space-y-2 rounded-lg border border-white/15 bg-[#1d1d18] p-3">
                      <Label className={labelClass}>Button {index + 1}</Label>
                      <Select
                        value={form.buttonsEs[index]?.emoji || ""}
                        onValueChange={(value) => {
                          setButton("buttonsEs", index, { emoji: value });
                          setButton("buttonsEn", index, { emoji: value });
                        }}
                      >
                        <SelectTrigger className="h-11 border-yellow-500/40 bg-[#252319] text-yellow-50 focus:ring-yellow-400/35">
                          <SelectValue placeholder="Choose emoji" />
                        </SelectTrigger>
                        <SelectContent className="border-yellow-500/25 bg-[#181610] text-yellow-50">
                          {EVENT_EMOJI_OPTIONS.map((option) => (
                            <SelectItem key={`${option.value}-${option.label}`} value={option.value}>
                              <span className="mr-2">{option.value}</span>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="space-y-1">
                        <span className="inline-flex rounded border border-yellow-500/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-yellow-300">
                          ES
                        </span>
                        <Input value={form.buttonsEs[index]?.text || ""} onChange={(e) => setButton("buttonsEs", index, { text: e.target.value })} className={fieldClass} placeholder="Spanish text" />
                      </div>
                      <div className="space-y-1">
                        <span className="inline-flex rounded border border-sky-400/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200">
                          EN
                        </span>
                        <Input value={form.buttonsEn[index]?.text || ""} onChange={(e) => setButton("buttonsEn", index, { text: e.target.value })} className={fieldClass} placeholder="English text" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                {editingId && (
                  <Button type="button" variant="outline" onClick={() => { setEditingId(""); setForm(emptyForm()); }} className="border-yellow-500/30 bg-[#252014] text-yellow-50 hover:bg-yellow-400/10">
                    Cancel edit
                  </Button>
                )}
                <Button type="submit" disabled={saveSettings.isPending} className="bg-yellow-400 font-bold text-black hover:bg-yellow-300">
                  {saveSettings.isPending ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save event</>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-yellow-50">Registered events</h2>
            <Button type="button" onClick={() => { setEditingId(""); setForm(emptyForm()); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="bg-yellow-400 text-black hover:bg-yellow-300">
              <Plus className="mr-2 h-4 w-4" /> New
            </Button>
          </div>
          {allEvents.map((event) => (
            <EventSummary key={`${event.source}-${event.id}`} event={event} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    </div>
  );
}

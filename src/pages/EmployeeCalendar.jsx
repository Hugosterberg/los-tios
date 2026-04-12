import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Plus,
  Trash2,
  Edit,
  Check,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  getISODay,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  isLocalFinanceMode,
  localListEmployees,
  localCreateEmployee,
  localUpdateEmployee,
  localDeleteEmployee,
  localListShifts,
  localCreateShift,
  localUpdateShift,
  localDeleteShift,
  localCreateExpense,
} from "@/lib/localDevFinance";

const EMPLOYEE_WRITE_KEYS = [
  "name",
  "phone",
  "email",
  "role",
  "hourly_rate",
  "daily_rate",
  "payment_type",
  "is_active",
  "notes",
];

const VALID_EMPLOYEE_ROLES = new Set(["cook", "waiter", "cashier", "delivery", "manager", "cleaner", "other"]);

function formatMutationError(err) {
  const d = err?.response?.data;
  const fromApi =
    (typeof d === "string" && d) ||
    d?.message ||
    d?.error ||
    (Array.isArray(d?.errors) ? d.errors.join("; ") : null);
  return fromApi || err?.message || String(err);
}

/** Persisted at end of notes: ISO weekdays 1=Mon … 7=Sun */
const WORK_DAYS_NOTE_RE = /\[lt_work_days:([0-7,]+)\]\s*$/;

const WORK_DAY_DEFS = [
  { key: "mon", label: "Mon", iso: 1 },
  { key: "tue", label: "Tue", iso: 2 },
  { key: "wed", label: "Wed", iso: 3 },
  { key: "thu", label: "Thu", iso: 4 },
  { key: "fri", label: "Fri", iso: 5 },
  { key: "sat", label: "Sat", iso: 6 },
  { key: "sun", label: "Sun", iso: 7 },
];

function defaultWorkDayChecks() {
  return { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false };
}

function checksFromIsoSet(set) {
  const o = {};
  for (const d of WORK_DAY_DEFS) {
    o[d.key] = set.has(d.iso);
  }
  return o;
}

function isoDaysFromChecks(checks) {
  return WORK_DAY_DEFS.filter((d) => checks[d.key]).map((d) => d.iso);
}

/** @param {Record<string, boolean>} checks */
function parseWorkDaysFromEmployee(employee) {
  if (!employee) return defaultWorkDayChecks();
  const raw = employee.work_days;
  if (typeof raw === "string" && raw.trim()) {
    const set = new Set(
      raw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => n >= 1 && n <= 7)
    );
    if (set.size) return checksFromIsoSet(set);
  }
  const m = String(employee.notes || "").match(WORK_DAYS_NOTE_RE);
  if (m) {
    const set = new Set(
      m[1]
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => n >= 1 && n <= 7)
    );
    if (set.size) return checksFromIsoSet(set);
  }
  return defaultWorkDayChecks();
}

function stripWorkDaysTag(notes) {
  return String(notes || "")
    .replace(WORK_DAYS_NOTE_RE, "")
    .replace(/\s+$/, "");
}

function mergeNotesWithWorkDays(userNotes, checks) {
  const base = stripWorkDaysTag(userNotes);
  const days = isoDaysFromChecks(checks);
  const tag = `[lt_work_days:${days.join(",")}]`;
  if (!days.length) return base;
  if (!base) return tag;
  return `${base}\n\n${tag}`;
}

function buildEmployeePayload(form) {
  const { workDays, ...raw } = form;
  const mergedNotes = mergeNotesWithWorkDays(raw.notes ?? "", workDays);
  const role = VALID_EMPLOYEE_ROLES.has(raw.role) ? raw.role : "waiter";
  const payment_type = raw.payment_type === "hourly" ? "hourly" : "daily";
  const out = {};
  for (const k of EMPLOYEE_WRITE_KEYS) {
    if (k === "notes") out.notes = mergedNotes;
    else if (k === "role") out.role = role;
    else if (k === "payment_type") out.payment_type = payment_type;
    else if (k === "hourly_rate" || k === "daily_rate") {
      out[k] = Number(raw[k]) || 0;
    } else if (k === "is_active") {
      out[k] = Boolean(raw.is_active);
    } else if (k === "name") {
      out[k] = String(raw.name ?? "").trim();
    } else if (raw[k] !== undefined) out[k] = raw[k];
  }
  return out;
}

/** Only fields the Shift entity expects — avoids sending React/local metadata to Base44. */
const SHIFT_WRITE_KEYS = [
  "employee_id",
  "employee_name",
  "date",
  "start_time",
  "end_time",
  "hours_worked",
  "amount",
  "status",
  "notes",
  "expense_id",
];

function sanitizeShiftPayload(raw) {
  const out = {};
  for (const k of SHIFT_WRITE_KEYS) {
    if (!(k in raw) || raw[k] === undefined || raw[k] === null) continue;
    if (k === "hours_worked" || k === "amount") out[k] = Number(raw[k]) || 0;
    else out[k] = raw[k];
  }
  return out;
}

function formatWorkDaysSummary(employee) {
  const checks = parseWorkDaysFromEmployee(employee);
  const labels = WORK_DAY_DEFS.filter((d) => checks[d.key]).map((d) => d.label);
  return labels.length ? labels.join(" · ") : "—";
}

function formatMx(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function shiftAmountForEmployee(employee, hoursWorked) {
  if (!employee) return 0;
  const h = Number(hoursWorked) || 0;
  if (employee.payment_type === "daily") {
    return Number(employee.daily_rate) || 0;
  }
  return h * (Number(employee.hourly_rate) || 0);
}

export default function EmployeeCalendar() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingShift, setEditingShift] = useState(null);
  const [templateEmployeeId, setTemplateEmployeeId] = useState("");
  const [templateStart, setTemplateStart] = useState("09:00");
  const [templateEnd, setTemplateEnd] = useState("17:00");
  const [templateBusy, setTemplateBusy] = useState(false);
  const queryClient = useQueryClient();
  const useLocalFinance = isLocalFinanceMode();

  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    phone: "",
    email: "",
    role: "waiter",
    hourly_rate: 0,
    daily_rate: 0,
    payment_type: "daily",
    is_active: true,
    notes: "",
    workDays: defaultWorkDayChecks(),
  });

  const [shiftForm, setShiftForm] = useState({
    employee_id: "",
    employee_name: "",
    date: "",
    start_time: "09:00",
    end_time: "17:00",
    hours_worked: 8,
    amount: 0,
    status: "scheduled",
    notes: "",
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListEmployees() : base44.entities.Employee.list("name")),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListShifts() : base44.entities.Shift.list("-date")),
  });

  const createEmployee = useMutation({
    mutationFn: (data) => (useLocalFinance ? localCreateEmployee(data) : base44.entities.Employee.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      resetEmployeeForm();
    },
    onError: (err) => alert(`Could not create employee: ${formatMutationError(err)}`),
  });

  const updateEmployee = useMutation({
    mutationFn: ({ id, data }) =>
      useLocalFinance ? localUpdateEmployee(id, data) : base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      resetEmployeeForm();
    },
    onError: (err) => alert(`Could not update employee: ${formatMutationError(err)}`),
  });

  const deleteEmployee = useMutation({
    mutationFn: (id) => (useLocalFinance ? localDeleteEmployee(id) : base44.entities.Employee.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (err) => alert(`Could not delete employee: ${formatMutationError(err)}`),
  });

  const createShift = useMutation({
    mutationFn: (data) => (useLocalFinance ? localCreateShift(data) : base44.entities.Shift.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      resetShiftForm();
    },
    onError: (err) => alert(`Could not save shift: ${formatMutationError(err)}`),
  });

  const updateShift = useMutation({
    mutationFn: ({ id, data }) =>
      useLocalFinance ? localUpdateShift(id, data) : base44.entities.Shift.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      resetShiftForm();
    },
    onError: (err) => alert(`Could not update shift: ${formatMutationError(err)}`),
  });

  const deleteShift = useMutation({
    mutationFn: (id) => (useLocalFinance ? localDeleteShift(id) : base44.entities.Shift.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (err) => alert(`Could not delete shift: ${formatMutationError(err)}`),
  });

  const createExpense = useMutation({
    mutationFn: (data) => (useLocalFinance ? localCreateExpense(data) : base44.entities.Expense.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err) => alert(`Could not record expense: ${formatMutationError(err)}`),
  });

  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
  });

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

  const roleLabels = {
    cook: "Cook",
    waiter: "Waiter",
    cashier: "Cashier",
    delivery: "Delivery",
    manager: "Manager",
    cleaner: "Cleaner",
    other: "Other",
  };

  const roleColors = {
    cook: "border-yellow-500/30 bg-yellow-400/15 text-yellow-200",
    waiter: "border-yellow-500/30 bg-yellow-400/15 text-yellow-200",
    cashier: "border-yellow-500/30 bg-yellow-400/15 text-yellow-200",
    delivery: "border-yellow-500/30 bg-yellow-400/15 text-yellow-200",
    manager: "border-amber-500/40 bg-amber-400/20 text-amber-100",
    cleaner: "border-yellow-500/20 bg-yellow-400/10 text-yellow-100/90",
    other: "border-white/10 bg-white/5 text-gray-300",
  };

  const weekForecast = useMemo(() => {
    const startStr = format(currentWeekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    let total = 0;
    let count = 0;
    for (const s of shifts) {
      if (!s.date || s.status === "cancelled") continue;
      if (s.date >= startStr && s.date <= endStr) {
        total += Number(s.amount || 0);
        count += 1;
      }
    }
    return { total, count };
  }, [shifts, currentWeekStart, weekEnd]);

  const getShiftsForDay = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return shifts.filter((s) => s.date === dateStr);
  };

  const openShiftDialog = (date, shift = null) => {
    setSelectedDate(date);
    if (shift) {
      setEditingShift(shift);
      setShiftForm(shift);
    } else {
      setEditingShift(null);
      setShiftForm({
        employee_id: "",
        employee_name: "",
        date: format(date, "yyyy-MM-dd"),
        start_time: "09:00",
        end_time: "17:00",
        hours_worked: 8,
        amount: 0,
        status: "scheduled",
        notes: "",
      });
    }
    setShowShiftDialog(true);
  };

  const handleEmployeeSelect = (employeeId) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      const hours = shiftForm.hours_worked;
      const amount = shiftAmountForEmployee(employee, hours);
      setShiftForm({
        ...shiftForm,
        employee_id: employeeId,
        employee_name: employee.name,
        amount: amount || 0,
      });
    }
  };

  const syncAmountFromEmployee = () => {
    const employee = employees.find((e) => e.id === shiftForm.employee_id);
    if (!employee) return;
    const amount = shiftAmountForEmployee(employee, shiftForm.hours_worked);
    setShiftForm((prev) => ({ ...prev, amount: amount || 0 }));
  };

  const calculateHours = (start, end) => {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    return ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
  };

  const handleTimeChange = (field, value) => {
    const newForm = { ...shiftForm, [field]: value };
    if (newForm.start_time && newForm.end_time) {
      const hours = calculateHours(newForm.start_time, newForm.end_time);
      newForm.hours_worked = hours > 0 ? hours : 0;
      const employee = employees.find((e) => e.id === newForm.employee_id);
      if (employee) {
        newForm.amount = shiftAmountForEmployee(employee, newForm.hours_worked);
      }
    }
    setShiftForm(newForm);
  };

  const handleShiftSubmit = (e) => {
    e.preventDefault();
    const payload = sanitizeShiftPayload(shiftForm);
    if (editingShift) {
      updateShift.mutate({ id: editingShift.id, data: payload });
    } else {
      createShift.mutate(payload);
    }
  };

  const completeShiftAndPay = async (shift) => {
    const paymentMethod = prompt(
      "How will it be paid?\n\n1 = Company Cash\n2 = Company Account\n\nEnter 1 or 2:",
      "1"
    );
    if (!paymentMethod) return;

    const paymentSource = paymentMethod === "2" ? "company_account" : "company_cash";

    const expenseData = {
      name: `Salary: ${shift.employee_name} - ${format(parseISO(shift.date), "MM/dd/yyyy")}`,
      category: "salaries",
      amount: shift.amount || 0,
      date: shift.date,
      payment_source: paymentSource,
      paid_by_company: true,
      notes: `Shift: ${shift.start_time} - ${shift.end_time} (${shift.hours_worked}h)`,
    };

    const createdExpense = await createExpense.mutateAsync(expenseData);
    await updateShift.mutateAsync({
      id: shift.id,
      data: sanitizeShiftPayload({
        ...shift,
        status: "paid",
        expense_id: createdExpense.id,
      }),
    });

    alert("Shift completed and salary added to expenses");
  };

  const handleEmployeeSubmit = (e) => {
    e.preventDefault();
    if (isoDaysFromChecks(employeeForm.workDays).length === 0) {
      alert("Select at least one workday.");
      return;
    }
    const payload = buildEmployeePayload(employeeForm);
    if (!payload.name) {
      alert("Enter a name.");
      return;
    }
    if (editingEmployee) {
      updateEmployee.mutate({ id: editingEmployee.id, data: payload });
    } else {
      createEmployee.mutate(payload);
    }
  };

  const freshEmployeeFormState = () => ({
    name: "",
    phone: "",
    email: "",
    role: "waiter",
    hourly_rate: 0,
    daily_rate: 0,
    payment_type: "daily",
    is_active: true,
    notes: "",
    workDays: defaultWorkDayChecks(),
  });

  const openNewEmployeeForm = () => {
    setEditingEmployee(null);
    setEmployeeForm(freshEmployeeFormState());
    setShowEmployeeForm(true);
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    const safeRole = VALID_EMPLOYEE_ROLES.has(employee?.role) ? employee.role : "waiter";
    const safePay = employee?.payment_type === "hourly" ? "hourly" : "daily";
    setEmployeeForm({
      ...employee,
      name: employee?.name != null ? String(employee.name) : "",
      phone: employee?.phone != null ? String(employee.phone) : "",
      email: employee?.email != null ? String(employee.email) : "",
      role: safeRole,
      payment_type: safePay,
      hourly_rate: Number(employee?.hourly_rate) || 0,
      daily_rate: Number(employee?.daily_rate) || 0,
      is_active: employee?.is_active !== false,
      notes: stripWorkDaysTag(employee?.notes || ""),
      workDays: parseWorkDaysFromEmployee(employee),
    });
    setShowEmployeeForm(true);
  };

  const resetEmployeeForm = () => {
    setEmployeeForm(freshEmployeeFormState());
    setEditingEmployee(null);
    setShowEmployeeForm(false);
  };

  const resetShiftForm = () => {
    setShiftForm({
      employee_id: "",
      employee_name: "",
      date: "",
      start_time: "09:00",
      end_time: "17:00",
      hours_worked: 8,
      amount: 0,
      status: "scheduled",
      notes: "",
    });
    setEditingShift(null);
    setShowShiftDialog(false);
  };

  const applyWeekTemplate = async () => {
    if (!templateEmployeeId) {
      alert("Select an employee first.");
      return;
    }
    const employee = employees.find((e) => e.id === templateEmployeeId);
    if (!employee || !employee.is_active) return;

    const allowedIso = new Set(isoDaysFromChecks(parseWorkDaysFromEmployee(employee)));
    if (allowedIso.size === 0) {
      alert("This employee has no workdays configured. Edit the employee and select weekdays.");
      return;
    }

    setTemplateBusy(true);
    try {
      let created = 0;
      for (const day of weekDays) {
        const iso = getISODay(day);
        if (!allowedIso.has(iso)) continue;

        const dateStr = format(day, "yyyy-MM-dd");
        const exists = shifts.some(
          (s) => s.employee_id === employee.id && s.date === dateStr && s.status !== "cancelled"
        );
        if (exists) continue;

        const hours = calculateHours(templateStart, templateEnd);
        const hw = hours > 0 ? hours : 8;
        const payload = {
          employee_id: employee.id,
          employee_name: employee.name,
          date: dateStr,
          start_time: templateStart,
          end_time: templateEnd,
          hours_worked: hw,
          amount: shiftAmountForEmployee(employee, hw),
          status: "scheduled",
          notes: "Auto: weekly template (employee workdays)",
        };
        await createShift.mutateAsync(sanitizeShiftPayload(payload));
        created += 1;
      }
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      alert(
        created > 0
          ? `Created ${created} shift(s) for ${format(currentWeekStart, "MMM d", { locale: enUS })} – ${format(weekEnd, "MMM d, yyyy", { locale: enUS })}. Days that already had a shift were skipped.`
          : "No new shifts — every matching workday already has a shift this week."
      );
    } catch (err) {
      console.error(err);
      alert("Could not create all shifts. Try again.");
    } finally {
      setTemplateBusy(false);
    }
  };

  const activeEmployees = employees.filter((e) => e.is_active);

  const resolvedRole = VALID_EMPLOYEE_ROLES.has(employeeForm.role) ? employeeForm.role : "waiter";
  const resolvedPayType = employeeForm.payment_type === "hourly" ? "hourly" : "daily";

  const panelClass = "rounded-2xl border border-yellow-500/15 bg-[#141210] shadow-none";
  const cardDayClass =
    "rounded-2xl border shadow-none transition-colors border-yellow-500/15 bg-[#141210] hover:border-yellow-500/25";

  const dateLocale = enUS;

  return (
    <div className="min-h-screen bg-[#0f0f0c] text-white">
      <div className="relative overflow-hidden border-b border-yellow-500/15 bg-gradient-to-br from-[#1a1810] via-[#14120c] to-[#0c0c0a]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(250,204,21,0.12),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-500/25 bg-yellow-400/10 shadow-[0_0_24px_rgba(250,204,21,0.12)]">
                <Users className="h-5 w-5 text-yellow-400" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yellow-500/80">
                  Staff
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-yellow-100 sm:text-3xl">
                  Employees
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Calendar, shifts, and daily wage. The weekly total below sums scheduled amounts so you can forecast labor
                  cost.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {useLocalFinance && (
        <div className="border-b border-amber-500/25 bg-amber-950/35">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-xs leading-relaxed text-amber-100/90">
              <span className="font-semibold text-amber-200">Local dev mode.</span> Employees and shifts are stored in this
              browser only. Configure the backend in <code className="rounded bg-black/30 px-1">.env.local</code> to sync with
              the server.
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Tabs defaultValue="calendar" className="space-y-5">
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl border border-yellow-500/20 bg-[#161616] p-1">
            <TabsTrigger
              value="calendar"
              className="rounded-lg text-xs font-medium text-gray-500 data-[state=active]:bg-yellow-400 data-[state=active]:text-black data-[state=active]:shadow-sm"
            >
              Calendar
            </TabsTrigger>
            <TabsTrigger
              value="employees"
              className="rounded-lg text-xs font-medium text-gray-500 data-[state=active]:bg-yellow-400 data-[state=active]:text-black data-[state=active]:shadow-sm"
            >
              Employees
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-5">
            <Card className={cn(panelClass)}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
                    className="rounded-xl border-0 bg-white font-semibold text-black hover:bg-yellow-100"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous week
                  </Button>
                  <div className="text-center">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Displayed week</p>
                    <h2 className="text-lg font-semibold text-gray-200">
                      {format(currentWeekStart, "MMM d", { locale: dateLocale })} –{" "}
                      {format(weekEnd, "MMM d, yyyy", { locale: dateLocale })}
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
                    className="rounded-xl border-0 bg-white font-semibold text-black hover:bg-yellow-100"
                  >
                    Next week <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className={cn(panelClass, "lg:col-span-2")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-yellow-400" />
                    <CardTitle className="text-base font-semibold text-gray-200">Weekly forecast (scheduled)</CardTitle>
                  </div>
                  <p className="text-xs text-gray-500">
                    Sums <span className="text-gray-400">amounts</span> for every shift in the displayed week (excludes
                    cancelled).
                  </p>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-6 pt-0">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Week total</p>
                    <p className="text-2xl font-bold text-yellow-300">{formatMx(weekForecast.total)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Shift count</p>
                    <p className="text-xl font-semibold text-gray-200">{weekForecast.count}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(panelClass)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                    <CardTitle className="text-base font-semibold text-gray-200">Weekly template</CardTitle>
                  </div>
                  <p className="text-xs leading-relaxed text-gray-500">
                    Creates one shift per selected workday for this employee (from their weekday checkboxes). Daily wage =
                    same amount each day; hourly uses the time range.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400">Employee</Label>
                    <Select value={templateEmployeeId} onValueChange={setTemplateEmployeeId}>
                      <SelectTrigger className="border-yellow-500/20 bg-black/30 text-left text-gray-100">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent className="border-yellow-500/20 bg-[#1a1810] text-gray-100">
                        {activeEmployees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-400">Start</Label>
                      <Input
                        type="time"
                        value={templateStart}
                        onChange={(ev) => setTemplateStart(ev.target.value)}
                        className="border-yellow-500/20 bg-black/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-400">End</Label>
                      <Input
                        type="time"
                        value={templateEnd}
                        onChange={(ev) => setTemplateEnd(ev.target.value)}
                        className="border-yellow-500/20 bg-black/30"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={templateBusy || !templateEmployeeId}
                    onClick={applyWeekTemplate}
                    className="w-full rounded-xl bg-yellow-400 font-semibold text-black hover:bg-yellow-300"
                  >
                    {templateBusy ? "Creating…" : "Create shifts for workdays"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
              {weekDays.map((day) => {
                const dayShifts = getShiftsForDay(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <Card
                    key={day.toISOString()}
                    className={cn(
                      cardDayClass,
                      isToday && "border-yellow-400/60 ring-1 ring-yellow-400/30"
                    )}
                  >
                    <CardHeader className={cn("rounded-t-2xl pb-2", isToday ? "bg-yellow-400/10" : "bg-black/20")}>
                      <CardTitle className="text-center">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                          {format(day, "EEE", { locale: dateLocale })}
                        </div>
                        <div
                          className={cn(
                            "text-2xl font-bold tabular-nums",
                            isToday ? "text-yellow-300" : "text-gray-200"
                          )}
                        >
                          {format(day, "d")}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-[140px] space-y-2 p-2">
                      <div className="space-y-2">
                        {dayShifts.map((shift) => (
                          <button
                            key={shift.id}
                            type="button"
                            onClick={() => openShiftDialog(day, shift)}
                            className={cn(
                              "w-full rounded-xl border p-2 text-left text-xs transition-all hover:brightness-110",
                              shift.status === "paid" && "border-yellow-400/50 bg-yellow-400/20",
                              shift.status === "completed" && "border-yellow-500/30 bg-yellow-400/10",
                              shift.status === "cancelled" && "border-white/10 bg-black/30 opacity-50",
                              shift.status === "scheduled" && "border-yellow-500/25 bg-yellow-400/10"
                            )}
                          >
                            <div className="truncate font-semibold text-gray-100">{shift.employee_name}</div>
                            <div className="text-[11px] text-gray-500">
                              {shift.start_time} – {shift.end_time}
                            </div>
                            <div className="font-bold text-yellow-300">{formatMx(shift.amount)}</div>
                            {shift.status === "paid" && (
                              <Badge className="mt-1 border-0 bg-yellow-400 text-[10px] text-black">Paid</Badge>
                            )}
                          </button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openShiftDialog(day)}
                        className="w-full text-gray-500 hover:bg-yellow-400/10 hover:text-yellow-200"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className={panelClass}>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-200">Today&apos;s shifts</CardTitle>
                <p className="text-xs text-gray-500">Quick view for today on this device.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getShiftsForDay(new Date()).length > 0 ? (
                    getShiftsForDay(new Date()).map((shift) => (
                      <div
                        key={shift.id}
                        className="flex flex-col gap-3 rounded-xl border border-yellow-500/15 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400/15">
                            <span className="font-bold text-yellow-300">{shift.employee_name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-100">{shift.employee_name}</p>
                            <p className="text-sm text-gray-500">
                              {shift.start_time} – {shift.end_time} ({shift.hours_worked} h)
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-lg font-bold text-yellow-200">{formatMx(shift.amount)}</span>
                          {shift.status === "scheduled" && (
                            <Button
                              size="sm"
                              onClick={() => completeShiftAndPay(shift)}
                              className="rounded-lg bg-yellow-400 font-semibold text-black hover:bg-yellow-300"
                            >
                              <Check className="mr-2 h-4 w-4" /> Complete &amp; pay
                            </Button>
                          )}
                          {shift.status === "paid" && (
                            <Badge className="border-0 bg-yellow-400 text-black">Paid</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-10 text-center text-sm text-gray-500">No shifts scheduled for today.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees" className="space-y-5">
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => (showEmployeeForm ? resetEmployeeForm() : openNewEmployeeForm())}
                className="rounded-xl bg-yellow-400 font-semibold text-black hover:bg-yellow-300"
              >
                <Plus className="h-4 w-4" /> New employee
              </Button>
            </div>

            {showEmployeeForm && (
              <div>
                <Card className={panelClass}>
                  <CardHeader>
                    <CardTitle className="text-gray-100">
                      {editingEmployee ? "Edit employee" : "New employee"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleEmployeeSubmit} className="space-y-6 pb-4">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="employee-name" className="text-gray-300">
                            Name *
                          </Label>
                          <Input
                            id="employee-name"
                            name="employee-name"
                            required
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            data-1p-ignore
                            data-lpignore="true"
                            data-form-type="other"
                            value={employeeForm.name ?? ""}
                            onChange={(e) => setEmployeeForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="relative z-10 border-yellow-500/20 bg-black/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-300">Role *</Label>
                          <Select
                            value={resolvedRole}
                            onValueChange={(v) => setEmployeeForm((prev) => ({ ...prev, role: v }))}
                          >
                            <SelectTrigger className="border-yellow-500/20 bg-black/30">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent className="border-yellow-500/20 bg-[#1a1810] text-gray-100">
                              {Object.entries(roleLabels).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-300">Phone</Label>
                          <Input
                            value={employeeForm.phone ?? ""}
                            onChange={(e) => setEmployeeForm((prev) => ({ ...prev, phone: e.target.value }))}
                            className="border-yellow-500/20 bg-black/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-300">Email</Label>
                          <Input
                            type="email"
                            value={employeeForm.email ?? ""}
                            onChange={(e) => setEmployeeForm((prev) => ({ ...prev, email: e.target.value }))}
                            className="border-yellow-500/20 bg-black/30"
                          />
                        </div>

                        <div className="space-y-3 md:col-span-2">
                          <Label className="text-gray-300">Workdays *</Label>
                          <p className="text-xs text-gray-500">
                            Used for the weekly template and forecasting. Then set daily wage below (or hourly rate).
                          </p>
                          <div className="flex flex-wrap gap-3 rounded-xl border border-yellow-500/15 bg-black/20 p-3">
                            {WORK_DAY_DEFS.map((d) => (
                              <label
                                key={d.key}
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 text-sm text-gray-200 hover:bg-white/5"
                              >
                                <Checkbox
                                  checked={employeeForm.workDays[d.key]}
                                  onCheckedChange={(checked) =>
                                    setEmployeeForm((prev) => ({
                                      ...prev,
                                      workDays: { ...prev.workDays, [d.key]: checked === true },
                                    }))
                                  }
                                  className="border-yellow-500/50 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                                />
                                {d.label}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-gray-300">Pay type</Label>
                          <Select
                            value={resolvedPayType}
                            onValueChange={(v) => setEmployeeForm((prev) => ({ ...prev, payment_type: v }))}
                          >
                            <SelectTrigger className="border-yellow-500/20 bg-black/30">
                              <SelectValue placeholder="Pay type" />
                            </SelectTrigger>
                            <SelectContent className="border-yellow-500/20 bg-[#1a1810] text-gray-100">
                              <SelectItem value="daily">Daily (fixed per shift day)</SelectItem>
                              <SelectItem value="hourly">Hourly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {resolvedPayType === "daily" ? (
                          <div className="space-y-2">
                            <Label className="text-gray-300">Daily wage (MXN)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={employeeForm.daily_rate}
                              onChange={(e) =>
                                setEmployeeForm((prev) => ({
                                  ...prev,
                                  daily_rate: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="border-yellow-500/20 bg-black/30"
                            />
                            <p className="text-xs text-gray-500">
                              Applied automatically as shift amount when you pick this employee (one scheduled day = one daily
                              wage).
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label className="text-gray-300">Hourly rate (MXN)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={employeeForm.hourly_rate}
                              onChange={(e) =>
                                setEmployeeForm((prev) => ({
                                  ...prev,
                                  hourly_rate: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="border-yellow-500/20 bg-black/30"
                            />
                          </div>
                        )}
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-gray-300">Notes</Label>
                          <Textarea
                            value={employeeForm.notes}
                            onChange={(e) => setEmployeeForm((prev) => ({ ...prev, notes: e.target.value }))}
                            rows={2}
                            className="border-yellow-500/20 bg-black/30"
                          />
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                          <input
                            type="checkbox"
                            id="is_active"
                            checked={employeeForm.is_active}
                            onChange={(e) => setEmployeeForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                            className="rounded border-yellow-500/40"
                          />
                          <Label htmlFor="is_active" className="text-gray-300">
                            Active (can be scheduled)
                          </Label>
                        </div>
                      </div>
                      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-yellow-500/20 bg-[#141210]/95 py-4 backdrop-blur-sm sm:static sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
                        <Button type="button" variant="outline" onClick={resetEmployeeForm} className="border-yellow-500/30">
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createEmployee.isPending || updateEmployee.isPending}
                          className="bg-yellow-400 font-semibold text-black hover:bg-yellow-300"
                        >
                          {createEmployee.isPending || updateEmployee.isPending
                            ? "Saving…"
                            : editingEmployee
                              ? "Save"
                              : "Create"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {employees.map((employee) => (
                <motion.div key={employee.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={cn(panelClass, !employee.is_active && "opacity-60")}>
                    <CardContent className="p-5">
                      <div className="mb-4 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400/15">
                            <span className="text-xl font-bold text-yellow-300">{employee.name.charAt(0)}</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-100">{employee.name}</h3>
                            <Badge variant="outline" className={cn("mt-1 text-[11px]", roleColors[employee.role])}>
                              {roleLabels[employee.role]}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 border-yellow-500/25"
                            onClick={() => handleEditEmployee(employee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() => deleteEmployee.mutate(employee.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {employee.phone && (
                        <p className="mb-1 text-sm text-gray-500">{employee.phone}</p>
                      )}
                      {employee.email && <p className="mb-3 text-sm text-gray-500">{employee.email}</p>}
                      <p className="mb-3 text-xs text-gray-500">
                        <span className="text-gray-400">Workdays:</span> {formatWorkDaysSummary(employee)}
                      </p>
                      <div className="border-t border-yellow-500/10 pt-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-yellow-400" />
                          <span className="text-lg font-bold text-yellow-200">
                            {employee.payment_type === "daily"
                              ? formatMx(employee.daily_rate)
                              : `${formatMx(employee.hourly_rate)} / h`}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {employee.payment_type === "daily" ? "Daily wage" : "Hourly"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent className="max-w-md border border-yellow-500/20 bg-[#141210] text-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-yellow-100">
              {editingShift ? "Edit shift" : "New shift"} —{" "}
              {selectedDate && format(selectedDate, "MMM d, yyyy", { locale: dateLocale })}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleShiftSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Employee *</Label>
              <Select value={shiftForm.employee_id} onValueChange={handleEmployeeSelect}>
                <SelectTrigger className="border-yellow-500/20 bg-black/30">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent className="border-yellow-500/20 bg-[#1a1810] text-gray-100">
                  {activeEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {roleLabels[e.role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-gray-300">Start</Label>
                <Input
                  type="time"
                  value={shiftForm.start_time}
                  onChange={(e) => handleTimeChange("start_time", e.target.value)}
                  className="border-yellow-500/20 bg-black/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">End</Label>
                <Input
                  type="time"
                  value={shiftForm.end_time}
                  onChange={(e) => handleTimeChange("end_time", e.target.value)}
                  className="border-yellow-500/20 bg-black/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-gray-300">Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={shiftForm.hours_worked}
                  onChange={(e) => {
                    const hw = parseFloat(e.target.value);
                    setShiftForm((prev) => {
                      const next = { ...prev, hours_worked: hw };
                      const emp = employees.find((x) => x.id === prev.employee_id);
                      if (emp) next.amount = shiftAmountForEmployee(emp, hw);
                      return next;
                    });
                  }}
                  className="border-yellow-500/20 bg-black/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Amount (MXN)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={shiftForm.amount}
                  onChange={(e) =>
                    setShiftForm({ ...shiftForm, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="border-yellow-500/20 bg-black/30"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={syncAmountFromEmployee}
              className="w-full border-yellow-500/30 text-yellow-200 hover:bg-yellow-400/10"
            >
              Sync amount from daily wage / hourly rate
            </Button>
            <div className="space-y-2">
              <Label className="text-gray-300">Notes</Label>
              <Textarea
                value={shiftForm.notes}
                onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                rows={2}
                className="border-yellow-500/20 bg-black/30"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={resetShiftForm} className="flex-1 border-yellow-500/30">
                Cancel
              </Button>
              {editingShift && editingShift.status !== "paid" && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                  onClick={() => {
                    deleteShift.mutate(editingShift.id);
                    resetShiftForm();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button type="submit" className="flex-1 bg-yellow-400 font-semibold text-black hover:bg-yellow-300">
                {editingShift ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

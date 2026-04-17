import React, { useEffect, useMemo, useState } from "react";
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
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  format,
  addDays,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  parseISO,
  getISODay,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMexicoLongDateEn, withMexicoCreatedDateForPayload } from "@/lib/mexicoTime";
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
  localDeleteExpense,
} from "@/lib/localDevFinance";
import {
  WORK_DAY_DEFS,
  defaultWorkDayChecks,
  isoDaysFromChecks,
  anyActiveEmployeeWorksOnCalendarDate,
  employeeWorksOnCalendarDate,
  mergeNotesWithDefaultHours,
  mergeNotesWithWorkDays,
  parseDefaultWorkHoursFromEmployee,
  parseWorkDaysFromEmployee,
  shiftAmountForEmployee,
  stripWorkDaysTag,
  stripWorkHoursTag,
  templateLaborAccrualForDate,
  getAutoRegisterShifts,
} from "@/lib/employeeLabor";

const EMPLOYEE_WRITE_KEYS = [
  "name",
  "phone",
  "email",
  "role",
  "hourly_rate",
  "daily_rate",
  "payment_type",
  "is_active",
  "auto_register_shifts",
  "notes",
  "work_days",
];

const VALID_EMPLOYEE_ROLES = new Set(["cook", "waiter", "cashier", "delivery", "manager", "cleaner", "other"]);

const LAST_CALENDAR_EMPLOYEE_LS = "los_tios_employee_calendar_preferred_employee_id";
const REMOVED_SHIFT_STATUS = "removed";
const REMOVED_SHIFT_NOTE = "[lt_removed_shift]";

function isRemovedShift(shift) {
  return shift?.status === REMOVED_SHIFT_STATUS || String(shift?.notes || "").includes(REMOVED_SHIFT_NOTE);
}

/** Readable on dark panels; `color-scheme: dark` fixes native time picker contrast in Chromium. */
const calendarFieldClass =
  "border-yellow-500/45 bg-[#252014] font-medium text-yellow-50 placeholder:text-gray-400 [color-scheme:dark] focus-visible:ring-yellow-500/50";

function formatMutationError(err) {
  const d = err?.response?.data;
  const fromApi =
    (typeof d === "string" && d) ||
    d?.message ||
    d?.error ||
    (Array.isArray(d?.errors) ? d.errors.join("; ") : null);
  return fromApi || err?.message || String(err);
}

function buildEmployeePayload(form) {
  const { workDays, defaultShiftStart, defaultShiftEnd, ...raw } = form;
  const start = defaultShiftStart || "09:00";
  const end = defaultShiftEnd || "17:00";
  // Store workdays both as a field and as a notes tag for hosted schemas that drop new fields.
  const cleanNotes = stripWorkDaysTag(stripWorkHoursTag(raw.notes ?? ""));
  const mergedNotes = mergeNotesWithDefaultHours(mergeNotesWithWorkDays(cleanNotes, workDays), start, end);
  const role = VALID_EMPLOYEE_ROLES.has(raw.role) ? raw.role : "waiter";
  const payment_type = raw.payment_type === "hourly" ? "hourly" : "daily";
  const wd = isoDaysFromChecks(workDays);
  const work_days = wd.length ? wd.join(",") : "";
  const out = {};
  for (const k of EMPLOYEE_WRITE_KEYS) {
    if (k === "notes") out.notes = mergedNotes;
    else if (k === "role") out.role = role;
    else if (k === "payment_type") out.payment_type = payment_type;
    else if (k === "work_days") out.work_days = work_days;
    else if (k === "hourly_rate" || k === "daily_rate") {
      out[k] = Number(raw[k]) || 0;
    } else if (k === "is_active") {
      out[k] = Boolean(raw.is_active);
    } else if (k === "auto_register_shifts") {
      out[k] = raw.auto_register_shifts !== false;
    } else if (k === "name") {
      out[k] = String(raw.name ?? "").trim();
    } else if (k === "email") {
      out[k] = String(raw.email ?? "").trim();
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

function formatDefaultShiftLine(employee) {
  const { defaultShiftStart, defaultShiftEnd } = parseDefaultWorkHoursFromEmployee(employee);
  return `${defaultShiftStart} – ${defaultShiftEnd}`;
}

function formatMx(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatShiftClock(t) {
  const s = String(t || "").trim();
  if (s.length >= 5) return s.slice(0, 5);
  return s || "—";
}

function buildMonthGrid(anchorInMonth) {
  const monthStart = startOfMonth(anchorInMonth);
  const monthEnd = endOfMonth(anchorInMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

function dayShiftStats(date, shiftsList) {
  const dateStr = format(date, "yyyy-MM-dd");
  const list = shiftsList.filter((s) => s.date === dateStr && s.status !== "cancelled" && !isRemovedShift(s));
  const count = list.length;
  const total = list.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  return { count, total, list };
}

export default function EmployeeCalendar() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [scheduleView, setScheduleView] = useState(/** @type {"week" | "month"} */ ("month"));
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
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
    auto_register_shifts: true,
    notes: "",
    workDays: defaultWorkDayChecks(),
    defaultShiftStart: "09:00",
    defaultShiftEnd: "17:00",
  });
  /** String inputs so number fields stay editable (controlled `type="number"` fights partial input). */
  const [dailyRateText, setDailyRateText] = useState("");
  const [hourlyRateText, setHourlyRateText] = useState("");

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

  const persistPreferredEmployeeId = (employeeId) => {
    if (!employeeId) return;
    try {
      localStorage.setItem(LAST_CALENDAR_EMPLOYEE_LS, employeeId);
    } catch {
      /* ignore */
    }
  };

  // Live preview: when editing an employee, overlay form workdays so the calendar updates in real-time
  const previewEmployees = useMemo(() => {
    if (!showEmployeeForm || !editingEmployee) return employees;
    const wd = isoDaysFromChecks(employeeForm.workDays);
    const work_days = wd.length ? wd.join(",") : "";
    return employees.map((e) =>
      e.id === editingEmployee.id ? { ...e, work_days, notes: e.notes } : e,
    );
  }, [employees, showEmployeeForm, editingEmployee, employeeForm.workDays]);

  const activeEmployees = useMemo(() => previewEmployees.filter((e) => e.is_active), [previewEmployees]);

  const templateEmployee = useMemo(
    () => (templateEmployeeId ? activeEmployees.find((e) => e.id === templateEmployeeId) ?? null : null),
    [activeEmployees, templateEmployeeId],
  );
  const templateAllowsBulkShifts = templateEmployee ? getAutoRegisterShifts(templateEmployee) : true;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_CALENDAR_EMPLOYEE_LS);
      if (!raw || !activeEmployees.some((e) => e.id === raw)) return;
      setTemplateEmployeeId((prev) => (prev ? prev : raw));
    } catch {
      /* ignore */
    }
  }, [activeEmployees]);

  useEffect(() => {
    if (activeEmployees.length !== 1) return;
    setTemplateEmployeeId((prev) => prev || activeEmployees[0].id);
  }, [activeEmployees]);

  useEffect(() => {
    if (!templateEmployeeId) return;
    const emp = employees.find((e) => e.id === templateEmployeeId);
    if (!emp) return;
    const { defaultShiftStart, defaultShiftEnd } = parseDefaultWorkHoursFromEmployee(emp);
    setTemplateStart(defaultShiftStart);
    setTemplateEnd(defaultShiftEnd);
  }, [templateEmployeeId, employees]);

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
    mutationFn: async ({ shift, keepLaborBlocker = false }) => {
      if (!shift?.id) throw new Error("Shift not found");
      if (shift.expense_id) {
        try {
          if (useLocalFinance) {
            await localDeleteExpense(shift.expense_id);
          } else {
            await base44.entities.Expense.delete(shift.expense_id);
          }
        } catch (err) {
          const msg = String(err?.message || err || "");
          if (!msg.toLowerCase().includes("not found")) throw err;
        }
      }
      if (keepLaborBlocker) {
        const deletedAt = new Date().toISOString();
        const notes = String(shift.notes || "").trim();
        const deletedNote = `${REMOVED_SHIFT_NOTE} Deleted shift ${deletedAt}`;
        return useLocalFinance
          ? localUpdateShift(
              shift.id,
              sanitizeShiftPayload({
                ...shift,
                status: "completed",
                hours_worked: 0,
                amount: 0,
                notes: notes ? `${notes}\n${deletedNote}` : deletedNote,
              }),
            )
          : base44.entities.Shift.update(
              shift.id,
              sanitizeShiftPayload({
                ...shift,
                status: "completed",
                hours_worked: 0,
                amount: 0,
                notes: notes ? `${notes}\n${deletedNote}` : deletedNote,
              }),
            );
      }
      return useLocalFinance ? localDeleteShift(shift.id) : base44.entities.Shift.delete(shift.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      resetShiftForm();
    },
    onError: (err) => alert(`Could not delete shift: ${formatMutationError(err)}`),
  });

  const createExpense = useMutation({
    mutationFn: (data) =>
      useLocalFinance
        ? localCreateExpense(data)
        : base44.entities.Expense.create(withMexicoCreatedDateForPayload(data)),
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
    let shiftTotal = 0;
    let count = 0;
    for (const s of shifts) {
      if (!s.date || s.status === "cancelled" || isRemovedShift(s)) continue;
      if (s.date >= startStr && s.date <= endStr) {
        shiftTotal += Number(s.amount || 0);
        count += 1;
      }
    }
    let templateTotal = 0;
    for (const day of eachDayOfInterval({ start: currentWeekStart, end: weekEnd })) {
      const ds = format(day, "yyyy-MM-dd");
      templateTotal += templateLaborAccrualForDate(ds, employees, shifts);
    }
    return { total: shiftTotal + templateTotal, count };
  }, [shifts, employees, currentWeekStart, weekEnd]);

  const monthLaborSummary = useMemo(() => {
    const start = startOfMonth(monthCursor);
    const end = endOfMonth(monthCursor);
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");
    let shiftTotal = 0;
    let count = 0;
    for (const s of shifts) {
      if (!s.date || s.status === "cancelled" || isRemovedShift(s)) continue;
      if (s.date >= startStr && s.date <= endStr) {
        shiftTotal += Number(s.amount || 0);
        count += 1;
      }
    }
    let templateTotal = 0;
    for (const day of eachDayOfInterval({ start, end })) {
      templateTotal += templateLaborAccrualForDate(format(day, "yyyy-MM-dd"), employees, shifts);
    }
    return { total: shiftTotal + templateTotal, count };
  }, [shifts, employees, monthCursor]);

  const monthGridDays = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  const getShiftsForDay = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return shifts.filter((s) => s.date === dateStr && !isRemovedShift(s));
  };

  const openShiftDialog = (date, shift = null) => {
    setSelectedDate(date);
    if (shift) {
      setEditingShift(shift);
      setShiftForm(shift);
    } else {
      setEditingShift(null);
      let preferredId = "";
      let preferredName = "";
      try {
        const raw = localStorage.getItem(LAST_CALENDAR_EMPLOYEE_LS);
        const match = raw ? activeEmployees.find((e) => e.id === raw) : null;
        if (match) {
          preferredId = match.id;
          preferredName = match.name;
        }
      } catch {
        /* ignore */
      }
      const emp = employees.find((e) => e.id === preferredId);
      const dh = emp
        ? parseDefaultWorkHoursFromEmployee(emp)
        : { defaultShiftStart: "09:00", defaultShiftEnd: "17:00" };
      const startT = dh.defaultShiftStart;
      const endT = dh.defaultShiftEnd;
      const hours = calculateHours(startT, endT);
      const hw = hours > 0 ? hours : 8;
      setShiftForm({
        employee_id: preferredId,
        employee_name: preferredName,
        date: format(date, "yyyy-MM-dd"),
        start_time: startT,
        end_time: endT,
        hours_worked: hw,
        amount: emp ? shiftAmountForEmployee(emp, hw) || 0 : 0,
        status: "scheduled",
        notes: "",
      });
    }
    setShowShiftDialog(true);
  };

  const openTemplateShiftDialog = (date, employee) => {
    if (!employee) {
      openShiftDialog(date);
      return;
    }
    const startT = templateStart || parseDefaultWorkHoursFromEmployee(employee).defaultShiftStart || "09:00";
    const endT = templateEnd || parseDefaultWorkHoursFromEmployee(employee).defaultShiftEnd || "17:00";
    const hours = calculateHours(startT, endT);
    const hw = hours > 0 ? hours : 8;
    setSelectedDate(date);
    setEditingShift(null);
    persistPreferredEmployeeId(employee.id);
    setShiftForm({
      employee_id: employee.id,
      employee_name: employee.name,
      date: format(date, "yyyy-MM-dd"),
      start_time: startT,
      end_time: endT,
      hours_worked: hw,
      amount: shiftAmountForEmployee(employee, hw) || 0,
      status: "scheduled",
      notes: "Manual: from weekly template",
    });
    setShowShiftDialog(true);
  };

  const handleEmployeeSelect = (employeeId) => {
    persistPreferredEmployeeId(employeeId);
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
    const employee = employees.find((x) => x.id === shiftForm.employee_id);
    if (!employee) {
      alert("Select an employee.");
      return;
    }
    persistPreferredEmployeeId(employee.id);
    const payload = sanitizeShiftPayload({
      ...shiftForm,
      employee_id: employee.id,
      employee_name: employee.name,
    });
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

  const requestDeleteShift = (shift, dateOverride = null) => {
    if (!shift) return;
    const shiftDate = dateOverride || selectedDate || new Date(`${shift.date}T12:00:00`);
    const emp = employees.find((e) => e.id === shift.employee_id);
    const keepLaborBlocker = emp ? employeeWorksOnCalendarDate(emp, shiftDate) : false;
    const isPaid = shift.status === "paid";
    const message = isPaid
      ? `Delete this registered paid shift? This will also delete the linked salary expense so Dashboard and Daily Cash no longer count ${formatMx(shift.amount)}.${keepLaborBlocker ? " The day will stay blocked from roster-template labor." : ""}`
      : `Delete this scheduled shift?${keepLaborBlocker ? " The day will stay blocked from roster-template labor so the cost does not reappear." : ""}`;
    if (window.confirm(message)) {
      deleteShift.mutate({ shift, keepLaborBlocker });
    }
  };

  const requestRemoveTemplateShift = () => {
    const employee = employees.find((e) => e.id === shiftForm.employee_id);
    const shiftDate = selectedDate || (shiftForm.date ? new Date(`${shiftForm.date}T12:00:00`) : null);
    if (!employee || !shiftDate) return;
    const dateStr = format(shiftDate, "yyyy-MM-dd");
    const message = `Delete this workday shift for ${employee.name} on ${formatMexicoLongDateEn(shiftDate)}? This removes the expected labor cost for this day and keeps it from coming back from the roster template.`;
    if (!window.confirm(message)) return;
    createShift.mutate(
      sanitizeShiftPayload({
        employee_id: employee.id,
        employee_name: employee.name,
        date: dateStr,
        start_time: shiftForm.start_time || templateStart || "09:00",
        end_time: shiftForm.end_time || templateEnd || "17:00",
        hours_worked: 0,
        amount: 0,
        status: "completed",
        notes: `${REMOVED_SHIFT_NOTE} Removed workday/template shift ${new Date().toISOString()}`,
      }),
    );
  };

  const autoCreateShiftsForWeek = async (employee, payload) => {
    if (!payload.auto_register_shifts) return;
    const allowedIso = new Set(
      (payload.work_days || "")
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => n >= 1 && n <= 7),
    );
    if (!allowedIso.size) return;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const { defaultShiftStart, defaultShiftEnd } = parseDefaultWorkHoursFromEmployee({ notes: payload.notes });
    const start = defaultShiftStart || "09:00";
    const end = defaultShiftEnd || "17:00";
    const hours = (() => {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const h = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      return h > 0 ? h : 8;
    })();
    const empObj = { ...employee, ...payload };
    for (const day of days) {
      const iso = getISODay(day);
      if (!allowedIso.has(iso)) continue;
      const dateStr = format(day, "yyyy-MM-dd");
      const alreadyExists = shifts.some(
        (s) => s.employee_id === employee.id && s.date === dateStr && s.status !== "cancelled",
      );
      if (alreadyExists) continue;
      const shiftPayload = sanitizeShiftPayload({
        employee_id: employee.id,
        employee_name: payload.name,
        date: dateStr,
        start_time: start,
        end_time: end,
        hours_worked: hours,
        amount: shiftAmountForEmployee(empObj, hours),
        status: "scheduled",
        notes: "Auto: saved workdays",
      });
      await createShift.mutateAsync(shiftPayload);
    }
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (isoDaysFromChecks(employeeForm.workDays).length === 0) {
      alert("Select at least one workday.");
      return;
    }
    const merged = {
      ...employeeForm,
      daily_rate: parseFloat(String(dailyRateText).replace(",", ".")) || 0,
      hourly_rate: parseFloat(String(hourlyRateText).replace(",", ".")) || 0,
    };
    const payload = buildEmployeePayload(merged);
    if (!payload.name) {
      alert("Enter a name.");
      return;
    }
    if (!editingEmployee && !String(payload.phone || "").trim()) {
      alert("Enter a phone number.");
      return;
    }
    if (editingEmployee) {
      updateEmployee.mutate(
        { id: editingEmployee.id, data: payload },
        {
          onSuccess: async () => {
            if (payload.auto_register_shifts) {
              await autoCreateShiftsForWeek(editingEmployee, payload);
            }
          },
        },
      );
    } else {
      createEmployee.mutate(payload, {
        onSuccess: async (created) => {
          if (payload.auto_register_shifts && created?.id) {
            await autoCreateShiftsForWeek(created, payload);
          }
        },
      });
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
    auto_register_shifts: true,
    notes: "",
    workDays: defaultWorkDayChecks(),
    defaultShiftStart: "09:00",
    defaultShiftEnd: "17:00",
  });

  const openNewEmployeeForm = () => {
    setEditingEmployee(null);
    setEmployeeForm(freshEmployeeFormState());
    setDailyRateText("");
    setHourlyRateText("");
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
      auto_register_shifts: getAutoRegisterShifts(employee),
      notes: stripWorkHoursTag(stripWorkDaysTag(employee?.notes || "")),
      workDays: parseWorkDaysFromEmployee(employee),
      ...parseDefaultWorkHoursFromEmployee(employee),
    });
    setDailyRateText(
      employee?.daily_rate != null && String(employee.daily_rate).trim() !== ""
        ? String(employee.daily_rate)
        : "",
    );
    setHourlyRateText(
      employee?.hourly_rate != null && String(employee.hourly_rate).trim() !== ""
        ? String(employee.hourly_rate)
        : "",
    );
    setShowEmployeeForm(true);
  };

  const resetEmployeeForm = () => {
    setEmployeeForm(freshEmployeeFormState());
    setDailyRateText("");
    setHourlyRateText("");
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

    if (!getAutoRegisterShifts(employee)) {
      alert(
        'This employee is set to manual shifts only. Open their profile and enable "Auto-register shifts" to use bulk create, or add shifts with + on each day.',
      );
      return;
    }

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
              <span className="font-semibold text-amber-200">Local finance dev mode.</span> Employees and shifts are in this
              browser only because <code className="rounded bg-black/30 px-1">VITE_LOCAL_DEV_FINANCE=true</code>. Turn it off and
              set Base44 env vars in <code className="rounded bg-black/30 px-1">.env.local</code> to use the database.
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
              <CardContent className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScheduleView("week")}
                    className={cn(
                      "rounded-xl border font-semibold",
                      scheduleView === "week"
                        ? "border-yellow-400/60 bg-yellow-400 text-black hover:bg-yellow-300"
                        : "border-yellow-500/30 bg-transparent text-gray-300 hover:bg-yellow-400/10 hover:text-yellow-100"
                    )}
                  >
                    Week
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMonthCursor(startOfMonth(currentWeekStart));
                      setScheduleView("month");
                    }}
                    className={cn(
                      "rounded-xl border font-semibold",
                      scheduleView === "month"
                        ? "border-yellow-400/60 bg-yellow-400 text-black hover:bg-yellow-300"
                        : "border-yellow-500/30 bg-transparent text-gray-300 hover:bg-yellow-400/10 hover:text-yellow-100"
                    )}
                  >
                    <Calendar className="mr-1.5 h-4 w-4" />
                    Month
                  </Button>
                </div>

                {scheduleView === "week" ? (
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
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Displayed week</p>
                      <h2 className="text-lg font-semibold text-gray-100">
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
                ) : (
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMonthCursor((d) => addMonths(d, -1))}
                      className="rounded-xl border-0 bg-white font-semibold text-black hover:bg-yellow-100"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" /> Previous month
                    </Button>
                    <div className="text-center">
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Displayed month</p>
                      <h2 className="text-lg font-semibold text-gray-100">
                        {format(monthCursor, "MMMM yyyy", { locale: dateLocale })}
                      </h2>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMonthCursor((d) => addMonths(d, 1))}
                      className="rounded-xl border-0 bg-white font-semibold text-black hover:bg-yellow-100"
                    >
                      Next month <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className={cn(panelClass, "lg:col-span-2")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-yellow-400" />
                    <CardTitle className="text-base font-semibold text-gray-100">
                      {scheduleView === "week" ? "Weekly forecast (scheduled)" : "Monthly forecast (scheduled)"}
                    </CardTitle>
                  </div>
                  <p className="text-xs text-gray-400">
                    {scheduleView === "week"
                      ? "Sums amounts for every shift in the displayed week (excludes cancelled), plus template accrual for days without a shift row."
                      : "Sums amounts for the whole displayed month the same way as the week view (excludes cancelled)."}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-6 pt-0">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                      {scheduleView === "week" ? "Week total" : "Month total"}
                    </p>
                    <p className="text-2xl font-bold text-yellow-300">
                      {formatMx(scheduleView === "week" ? weekForecast.total : monthLaborSummary.total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Shift count</p>
                    <p className="text-xl font-semibold text-gray-100">
                      {scheduleView === "week" ? weekForecast.count : monthLaborSummary.count}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(panelClass)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                    <CardTitle className="text-base font-semibold text-gray-200">Weekly template</CardTitle>
                  </div>
                  <p className="text-xs leading-relaxed text-gray-400">
                    Creates one shift per selected workday for this employee (from their weekday checkboxes). Daily wage =
                    same amount each day; hourly uses the time range. Your last choice is remembered for new shifts.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-300">Employee</Label>
                    <Select
                      value={templateEmployeeId}
                      onValueChange={(id) => {
                        setTemplateEmployeeId(id);
                        persistPreferredEmployeeId(id);
                      }}
                    >
                      <SelectTrigger className={cn("text-left", calendarFieldClass)}>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent className="z-[300] border-yellow-500/20 bg-[#1a1810] text-gray-100">
                        {activeEmployees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {templateEmployeeId && !templateAllowsBulkShifts ? (
                    <p className="text-[11px] leading-snug text-amber-200/90">
                      <span className="font-medium text-amber-100">Manual shifts only</span> for this person — turn on{" "}
                      <strong className="font-medium text-amber-50">Auto-register shifts</strong> in their employee profile to use
                      this button.
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-300">Start</Label>
                      <Input
                        type="time"
                        value={templateStart}
                        onChange={(ev) => setTemplateStart(ev.target.value)}
                        className={calendarFieldClass}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-300">End</Label>
                      <Input
                        type="time"
                        value={templateEnd}
                        onChange={(ev) => setTemplateEnd(ev.target.value)}
                        className={calendarFieldClass}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={templateBusy || !templateEmployeeId || !templateAllowsBulkShifts}
                    onClick={applyWeekTemplate}
                    className="w-full rounded-xl bg-yellow-400 font-semibold text-black hover:bg-yellow-300 disabled:opacity-40"
                  >
                    {templateBusy ? "Creating…" : "Create shifts for workdays"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {scheduleView === "week" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
                {weekDays.map((day) => {
                  const dayShifts = getShiftsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isScheduledWeekday = anyActiveEmployeeWorksOnCalendarDate(activeEmployees, day);
                  const dayStr = format(day, "yyyy-MM-dd");
                  const hasTemplateEmployeeShift =
                    templateEmployee &&
                    shifts.some(
                      (s) => s.date === dayStr && s.employee_id === templateEmployee.id && s.status !== "cancelled",
                    );
                  const showTemplateRosterHint =
                    Boolean(templateEmployee) &&
                    employeeWorksOnCalendarDate(templateEmployee, day) &&
                    !hasTemplateEmployeeShift;
                  return (
                    <Card
                      key={day.toISOString()}
                      className={cn(
                        cardDayClass,
                        isScheduledWeekday && !isToday && "border-yellow-500/40 bg-yellow-400/[0.07]",
                        isToday && "border-yellow-400/60 ring-1 ring-yellow-400/30"
                      )}
                    >
                      <CardHeader className={cn("rounded-t-2xl pb-2", isToday ? "bg-yellow-400/10" : "bg-black/20")}>
                        <CardTitle className="text-center">
                          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                            {format(day, "EEE", { locale: dateLocale })}
                          </div>
                          <div
                            className={cn(
                              "text-2xl font-bold tabular-nums",
                              isToday ? "text-yellow-300" : "text-gray-100"
                            )}
                          >
                            {format(day, "d")}
                          </div>
                          {isScheduledWeekday && (
                            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-yellow-500/95">
                              Workday
                            </div>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="min-h-[140px] space-y-2 p-2">
                        {showTemplateRosterHint && (
                          <button
                            type="button"
                            onClick={() => openTemplateShiftDialog(day, templateEmployee)}
                            className="w-full rounded-lg border border-dashed border-yellow-400/50 bg-yellow-400/10 px-2 py-1.5 text-center transition-colors hover:border-yellow-300/70 hover:bg-yellow-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/60"
                            title="Workday for the employee selected in Weekly template — no shift row yet. Use Create shifts or + below."
                          >
                            <p className="truncate text-[11px] font-semibold leading-tight text-yellow-50">
                              {templateEmployee.name}
                            </p>
                            <p className="text-[10px] font-medium tabular-nums text-gray-200">
                              {formatShiftClock(templateStart)}–{formatShiftClock(templateEnd)}
                            </p>
                          </button>
                        )}
                        <div className="space-y-1.5">
                          {dayShifts.map((shift) => (
                            <button
                              key={shift.id}
                              type="button"
                              onClick={() => openShiftDialog(day, shift)}
                              className={cn(
                                "w-full rounded-lg border px-2 py-1.5 text-left transition-all hover:border-yellow-300/70 hover:bg-yellow-400/18 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/60",
                                shift.status === "paid" && "border-yellow-400/55 bg-yellow-400/20",
                                shift.status === "completed" && "border-yellow-400/40 bg-yellow-400/14",
                                shift.status === "cancelled" && "border-white/15 bg-black/30 opacity-60",
                                shift.status === "scheduled" && "border-yellow-400/40 bg-yellow-400/14",
                              )}
                            >
                              <div className="truncate text-[11px] font-semibold leading-snug text-yellow-50">
                                <span>{shift.employee_name}</span>
                                <span className="text-gray-600"> · </span>
                                <span className="font-medium tabular-nums text-gray-100">
                                  {formatShiftClock(shift.start_time)}–{formatShiftClock(shift.end_time)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold tabular-nums text-yellow-200">
                                  {formatMx(shift.amount)}
                                </span>
                                {shift.status === "paid" && (
                                  <Badge className="h-4 shrink-0 border-0 bg-yellow-400 px-1 py-0 text-[9px] text-black">
                                    Paid
                                  </Badge>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openShiftDialog(day)}
                          className="w-full border-yellow-500/35 bg-black/20 text-yellow-400 hover:border-yellow-400/50 hover:bg-yellow-400/15 hover:text-yellow-200"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className={panelClass}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-100">Month overview</CardTitle>
                  <p className="text-xs text-gray-400">
                    Days that match an active employee&apos;s saved workdays are tinted. When an employee is selected in{" "}
                    <strong className="font-medium text-gray-300">Weekly template</strong>, their workdays show{" "}
                    <strong className="font-medium text-gray-300">name + times</strong> from the template (same as week view)
                    until a shift exists. Other workdays show &quot;Workday&quot;. Scheduled shifts show name, hours, and total.
                    Click a day to open that week and add a shift.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((wd) => (
                      <div key={wd} className="py-1">
                        {wd}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {monthGridDays.map((day) => {
                      const inMonth = isSameMonth(day, monthCursor);
                      const stats = dayShiftStats(day, shifts);
                      const isToday = isSameDay(day, new Date());
                      const isScheduledWeekday = anyActiveEmployeeWorksOnCalendarDate(activeEmployees, day);
                      const dayStr = format(day, "yyyy-MM-dd");
                      const hasTemplateEmployeeShift =
                        templateEmployee &&
                        shifts.some(
                          (s) => s.date === dayStr && s.employee_id === templateEmployee.id && s.status !== "cancelled",
                        );
                      const showMonthTemplateRoster =
                        Boolean(templateEmployee) &&
                        employeeWorksOnCalendarDate(templateEmployee, day) &&
                        !hasTemplateEmployeeShift;
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => {
                            if (stats.list.length > 0) {
                              openShiftDialog(day, stats.list[0]);
                              return;
                            }
                            setCurrentWeekStart(startOfWeek(day, { weekStartsOn: 1 }));
                            setScheduleView("week");
                            if (showMonthTemplateRoster) {
                              openTemplateShiftDialog(day, templateEmployee);
                              return;
                            }
                            openShiftDialog(day);
                          }}
                          className={cn(
                            "flex min-h-[4.5rem] flex-col rounded-xl border p-1.5 text-left transition-colors sm:min-h-[5.25rem] sm:p-2",
                            "border-yellow-500/15 bg-[#141210] hover:border-yellow-400/40 hover:bg-yellow-400/5",
                            isScheduledWeekday && !isToday && "border-yellow-500/40 bg-yellow-400/[0.07]",
                            !inMonth && "opacity-35",
                            isToday && "border-yellow-400/55 ring-1 ring-yellow-400/25"
                          )}
                        >
                          <span
                            className={cn(
                              "text-sm font-bold tabular-nums sm:text-base",
                              isToday ? "text-yellow-300" : inMonth ? "text-gray-100" : "text-gray-500"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                          {stats.count > 0 ? (
                            <span className="mt-auto flex min-w-0 flex-col gap-0.5 text-[9px] leading-tight text-yellow-200/90 sm:text-[10px]">
                              <span className="truncate font-medium text-gray-200">
                                {stats.list[0].employee_name}
                                <span className="font-normal text-gray-500"> · </span>
                                <span className="tabular-nums text-gray-400">
                                  {formatShiftClock(stats.list[0].start_time)}–
                                  {formatShiftClock(stats.list[0].end_time)}
                                </span>
                              </span>
                              {stats.count > 1 && (
                                <span className="text-[9px] text-gray-500">+{stats.count - 1} more</span>
                              )}
                              <span className="tabular-nums text-yellow-500/85">{formatMx(stats.total)}</span>
                            </span>
                          ) : showMonthTemplateRoster ? (
                            <span className="mt-auto flex min-w-0 flex-col gap-0.5 text-[9px] leading-tight sm:text-[10px]">
                              <span className="truncate font-medium text-gray-200">{templateEmployee.name}</span>
                              <span className="tabular-nums text-gray-500">
                                {formatShiftClock(templateStart)}–{formatShiftClock(templateEnd)}
                              </span>
                            </span>
                          ) : isScheduledWeekday ? (
                            <span className="mt-auto text-[10px] font-semibold uppercase tracking-wide text-yellow-500/95 sm:text-[11px]">
                              Workday
                            </span>
                          ) : (
                            <span className="mt-auto text-[9px] text-gray-500 sm:text-[10px]">
                              {inMonth ? "Off" : "—"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

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
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openShiftDialog(new Date(`${shift.date}T12:00:00`), shift)}
                            className="rounded-lg border-yellow-400/45 bg-[#252014] font-semibold text-yellow-50 hover:bg-yellow-400/15 hover:text-yellow-100"
                          >
                            <Edit className="mr-2 h-4 w-4" /> Open
                          </Button>
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
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => requestDeleteShift(shift, new Date(`${shift.date}T12:00:00`))}
                            className="rounded-lg border-red-500/45 bg-red-950/20 font-semibold text-red-200 hover:bg-red-500/15 hover:text-red-100"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </Button>
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
                      <p className="mb-3 text-xs text-gray-400">
                        <span className="font-medium text-gray-300">Workdays:</span> {formatWorkDaysSummary(employee)}
                      </p>
                      <p className="mb-3 text-xs text-gray-400">
                        <span className="font-medium text-gray-300">Default shift:</span>{" "}
                        {formatDefaultShiftLine(employee)}
                      </p>
                      <p className="mb-3 text-xs text-gray-400">
                        <span className="font-medium text-gray-300">Weekly template:</span>{" "}
                        {getAutoRegisterShifts(employee) ? (
                          <span className="text-emerald-400/90">bulk create allowed</span>
                        ) : (
                          <span className="text-amber-400/90">manual shifts only</span>
                        )}
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

      <Dialog
        open={showEmployeeForm}
        onOpenChange={(open) => {
          if (!open) resetEmployeeForm();
        }}
      >
        <DialogContent className="pointer-events-auto max-h-[min(90vh,720px)] max-w-xl overflow-y-auto border border-yellow-500/20 bg-[#141210] p-5 text-gray-100 shadow-2xl z-[200] sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-gray-100">
              {editingEmployee ? "Edit employee" : "New employee"}
            </DialogTitle>
            <DialogDescription className="text-left text-sm text-gray-400">
              Name and phone are required for scheduling. Email is optional. Pick workdays and daily wage — amounts roll
              into the calendar, Daily Cash (when paid), and Dashboard labor totals.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEmployeeSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employee-name" className="text-gray-200">
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
                  className={calendarFieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-phone" className="text-gray-200">
                  Phone *
                </Label>
                <Input
                  id="employee-phone"
                  inputMode="tel"
                  autoComplete="tel"
                  value={employeeForm.phone ?? ""}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className={calendarFieldClass}
                  placeholder="+52 …"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-email" className="text-gray-200">
                  Email (optional)
                </Label>
                <Input
                  id="employee-email"
                  type="email"
                  autoComplete="email"
                  value={employeeForm.email ?? ""}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, email: e.target.value }))}
                  className={calendarFieldClass}
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label className="text-gray-200">Workdays *</Label>
                <p className="text-xs leading-relaxed text-gray-400">
                  Used for the weekly template and labor totals. Daily wage applies for each scheduled day.
                </p>
                <div className="flex flex-wrap gap-3 rounded-xl border border-yellow-500/30 bg-[#1c1914] p-3">
                  {WORK_DAY_DEFS.map((d) => (
                    <label
                      key={d.key}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 text-sm text-gray-100 hover:bg-white/5"
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

              <div className="space-y-3 md:col-span-2">
                <Label className="text-gray-200">Default working hours</Label>
                <p className="text-xs leading-relaxed text-gray-400">
                  Default start and end for the calendar weekly template, labor estimates without a shift row, and
                  quick-add when this person is pre-selected.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                  <div className="space-y-1.5">
                    <Label htmlFor="employee-default-start" className="text-xs text-gray-300">
                      Start
                    </Label>
                    <Input
                      id="employee-default-start"
                      type="time"
                      value={employeeForm.defaultShiftStart ?? "09:00"}
                      onChange={(e) =>
                        setEmployeeForm((prev) => ({ ...prev, defaultShiftStart: e.target.value }))
                      }
                      className={calendarFieldClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="employee-default-end" className="text-xs text-gray-300">
                      End
                    </Label>
                    <Input
                      id="employee-default-end"
                      type="time"
                      value={employeeForm.defaultShiftEnd ?? "17:00"}
                      onChange={(e) =>
                        setEmployeeForm((prev) => ({ ...prev, defaultShiftEnd: e.target.value }))
                      }
                      className={calendarFieldClass}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-200">Pay type</Label>
                <Select
                  value={resolvedPayType}
                  onValueChange={(v) => setEmployeeForm((prev) => ({ ...prev, payment_type: v }))}
                >
                  <SelectTrigger className={calendarFieldClass}>
                    <SelectValue placeholder="Pay type" />
                  </SelectTrigger>
                  <SelectContent className="z-[300] border-yellow-500/20 bg-[#1a1810] text-gray-100">
                    <SelectItem value="daily">Daily (fixed per shift day)</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {resolvedPayType === "daily" ? (
                <div className="space-y-2">
                  <Label className="text-gray-200">Daily wage (MXN) *</Label>
                  <Input
                    inputMode="decimal"
                    value={dailyRateText}
                    onChange={(e) => setDailyRateText(e.target.value)}
                    className={calendarFieldClass}
                    placeholder="0.00"
                  />
                  <p className="text-xs leading-relaxed text-gray-400">
                    One shift on the calendar = this amount until you mark the shift paid from cash/bank.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-gray-200">Hourly rate (MXN)</Label>
                  <Input
                    inputMode="decimal"
                    value={hourlyRateText}
                    onChange={(e) => setHourlyRateText(e.target.value)}
                    className={calendarFieldClass}
                    placeholder="0.00"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2 rounded-xl border border-yellow-500/25 bg-[#1c1914] p-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor="employee-auto-shifts" className="text-gray-200">
                      Auto-register shifts
                    </Label>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                      When off, only <strong className="font-medium text-gray-400">manual</strong> shift rows are used. Weekly
                      template &quot;Create shifts for workdays&quot; stays disabled for this person. Workdays and default hours
                      still drive forecasts and Daily Cash labor.
                    </p>
                  </div>
                  <Switch
                    id="employee-auto-shifts"
                    checked={employeeForm.auto_register_shifts !== false}
                    onCheckedChange={(checked) =>
                      setEmployeeForm((prev) => ({ ...prev, auto_register_shifts: checked === true }))
                    }
                    className="shrink-0 data-[state=checked]:bg-yellow-400"
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-gray-200">Notes (optional)</Label>
                <p className="text-xs text-gray-500">
                  Free text only — workdays and hours are saved from the fields above (you don&apos;t need tags like{" "}
                  <code className="rounded bg-black/40 px-1 text-[10px] text-gray-400">[lt_work_days:…]</code> here).
                </p>
                <Textarea
                  value={employeeForm.notes}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className={cn(calendarFieldClass, "min-h-[72px]")}
                />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={employeeForm.is_active}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-yellow-500/50 bg-[#252014] text-yellow-400 accent-yellow-400"
                />
                <Label htmlFor="is_active" className="text-gray-200">
                  Active (can be scheduled)
                </Label>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-yellow-500/20 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={resetEmployeeForm}
                className="border-yellow-500/40 bg-[#1a1810] text-yellow-50 hover:bg-yellow-400/10 hover:text-yellow-100"
              >
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
        </DialogContent>
      </Dialog>

      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent className="max-w-lg border border-yellow-400/35 bg-[#181610] text-gray-100 shadow-2xl shadow-black/60">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-yellow-50">
              {editingShift ? "Edit shift" : "New shift"} —{" "}
              {selectedDate && formatMexicoLongDateEn(selectedDate)}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-gray-300">
              {editingShift ? "Update this shift or delete it from labor costs." : "Create a scheduled shift for this day."}
            </DialogDescription>
          </DialogHeader>
          {editingShift && (
            <div className="grid gap-2 rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-3 py-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300/70">Employee</p>
                <p className="mt-1 font-semibold text-yellow-50">{editingShift.employee_name}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300/70">Time</p>
                <p className="mt-1 font-semibold tabular-nums text-gray-100">
                  {formatShiftClock(editingShift.start_time)}-{formatShiftClock(editingShift.end_time)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300/70">Cost</p>
                <p className="mt-1 font-semibold tabular-nums text-yellow-100">{formatMx(editingShift.amount)}</p>
              </div>
            </div>
          )}
          <form onSubmit={handleShiftSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold text-gray-100">Employee *</Label>
              <Select value={shiftForm.employee_id} onValueChange={handleEmployeeSelect}>
                <SelectTrigger className={calendarFieldClass}>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent className="z-[300] border-yellow-500/20 bg-[#1a1810] text-gray-100">
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
                <Label className="font-semibold text-gray-100">Start</Label>
                <Input
                  type="time"
                  value={shiftForm.start_time}
                  onChange={(e) => handleTimeChange("start_time", e.target.value)}
                  className={calendarFieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-gray-100">End</Label>
                <Input
                  type="time"
                  value={shiftForm.end_time}
                  onChange={(e) => handleTimeChange("end_time", e.target.value)}
                  className={calendarFieldClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-semibold text-gray-100">Hours</Label>
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
                  className={calendarFieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-gray-100">Amount (MXN)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={shiftForm.amount}
                  onChange={(e) =>
                    setShiftForm({ ...shiftForm, amount: parseFloat(e.target.value) || 0 })
                  }
                  className={calendarFieldClass}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={syncAmountFromEmployee}
              className="w-full border-yellow-400/45 bg-[#252014] font-semibold text-yellow-50 hover:bg-yellow-400/15 hover:text-yellow-100"
            >
              Sync amount from daily wage / hourly rate
            </Button>
            <div className="space-y-2">
              <Label className="font-semibold text-gray-100">Notes</Label>
              <Textarea
                value={shiftForm.notes}
                onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                rows={2}
                className={cn(calendarFieldClass, "min-h-[72px]")}
              />
            </div>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={resetShiftForm}
                className="flex-1 border-yellow-400/45 bg-[#252014] font-semibold text-yellow-50 hover:bg-yellow-400/15 hover:text-yellow-100"
              >
                Cancel
              </Button>
              {editingShift && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-2 border-red-500/55 bg-red-950/20 font-semibold text-red-200 hover:bg-red-500/15 hover:text-red-100"
                  onClick={() => requestDeleteShift(editingShift)}
                >
                  <Trash2 className="h-4 w-4" />
                  {editingShift.status === "paid"
                    ? "Delete registered shift"
                    : editingShift.status === "scheduled"
                      ? "Delete scheduled shift"
                      : "Delete shift"}
                </Button>
              )}
              {!editingShift &&
                shiftForm.employee_id &&
                selectedDate &&
                employeeWorksOnCalendarDate(
                  employees.find((e) => e.id === shiftForm.employee_id),
                  selectedDate,
                ) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-2 border-red-500/55 bg-red-950/20 font-semibold text-red-200 hover:bg-red-500/15 hover:text-red-100"
                    onClick={requestRemoveTemplateShift}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete workday shift
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

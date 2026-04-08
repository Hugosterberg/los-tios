import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Users, Plus, Trash2, Edit, Clock, DollarSign, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function EmployeeCalendar() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingShift, setEditingShift] = useState(null);
  const queryClient = useQueryClient();

  const [employeeForm, setEmployeeForm] = useState({
    name: "", phone: "", email: "", role: "waiter",
    hourly_rate: 0, daily_rate: 0, payment_type: "daily",
    is_active: true, notes: ""
  });

  const [shiftForm, setShiftForm] = useState({
    employee_id: "", employee_name: "", date: "",
    start_time: "09:00", end_time: "17:00",
    hours_worked: 8, amount: 0, status: "scheduled", notes: ""
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('name'),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => base44.entities.Shift.list('-date'),
  });

  const createEmployee = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); resetEmployeeForm(); },
  });

  const updateEmployee = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); resetEmployeeForm(); },
  });

  const deleteEmployee = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); },
  });

  const createShift = useMutation({
    mutationFn: (data) => base44.entities.Shift.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); resetShiftForm(); },
  });

  const updateShift = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Shift.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); resetShiftForm(); },
  });

  const deleteShift = useMutation({
    mutationFn: (id) => base44.entities.Shift.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); },
  });

  const createExpense = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); },
  });

  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
  });

  const roleLabels = {
    cook: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚Â¨ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â³ Cocinero", waiter: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â½ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Mesero", cashier: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â° Cajero",
    delivery: "Delivery", manager: "Manager", cleaner: "Cleaner", other: "Other"
  };

  const roleColors = {
    cook: "bg-yellow-400/20 text-yellow-400", waiter: "bg-yellow-400/20 text-yellow-400",
    cashier: "bg-yellow-400/20 text-yellow-400", delivery: "bg-yellow-400/20 text-yellow-400",
    manager: "bg-yellow-400/30 text-yellow-300", cleaner: "bg-yellow-400/15 text-yellow-400/80", other: "bg-yellow-400/10 text-yellow-400/60"
  };

  const getShiftsForDay = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts.filter(s => s.date === dateStr);
  };

  const openShiftDialog = (date, shift = null) => {
    setSelectedDate(date);
    if (shift) {
      setEditingShift(shift);
      setShiftForm(shift);
    } else {
      setEditingShift(null);
      setShiftForm({
        employee_id: "", employee_name: "", date: format(date, 'yyyy-MM-dd'),
        start_time: "09:00", end_time: "17:00", hours_worked: 8, amount: 0,
        status: "scheduled", notes: ""
      });
    }
    setShowShiftDialog(true);
  };

  const handleEmployeeSelect = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    if (employee) {
      const amount = employee.payment_type === 'daily' ? employee.daily_rate : (employee.hourly_rate * shiftForm.hours_worked);
      setShiftForm({
        ...shiftForm,
        employee_id: employeeId,
        employee_name: employee.name,
        amount: amount || 0
      });
    }
  };

  const calculateHours = (start, end) => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
  };

  const handleTimeChange = (field, value) => {
    const newForm = { ...shiftForm, [field]: value };
    if (newForm.start_time && newForm.end_time) {
      const hours = calculateHours(newForm.start_time, newForm.end_time);
      newForm.hours_worked = hours > 0 ? hours : 0;
      const employee = employees.find(e => e.id === newForm.employee_id);
      if (employee && employee.payment_type === 'hourly') {
        newForm.amount = hours * (employee.hourly_rate || 0);
      }
    }
    setShiftForm(newForm);
  };

  const handleShiftSubmit = (e) => {
    e.preventDefault();
    if (editingShift) {
      updateShift.mutate({ id: editingShift.id, data: shiftForm });
    } else {
      createShift.mutate(shiftForm);
    }
  };

  const completeShiftAndPay = async (shift) => {
    const paymentMethod = prompt(
      'How will it be paid?\n\n1 = Company Cash\n2 = Company Account\n\nEnter 1 or 2:',
      '1'
    );
    if (!paymentMethod) return;

    const paymentSource = paymentMethod === '2' ? 'company_account' : 'company_cash';

    const expenseData = {
      name: `Salario: ${shift.employee_name} - ${format(parseISO(shift.date), 'dd/MM/yyyy')}`,
      category: 'salaries',
      amount: shift.amount || 0,
      date: shift.date,
      payment_source: paymentSource,
      paid_by_company: true,
      notes: `Turno: ${shift.start_time} - ${shift.end_time} (${shift.hours_worked}h)`
    };

    const createdExpense = await createExpense.mutateAsync(expenseData);
    await updateShift.mutateAsync({
      id: shift.id,
      data: { ...shift, status: 'paid', expense_id: createdExpense.id }
    });

    alert('Shift completed and salary added to expenses');
  };

  const handleEmployeeSubmit = (e) => {
    e.preventDefault();
    if (editingEmployee) {
      updateEmployee.mutate({ id: editingEmployee.id, data: employeeForm });
    } else {
      createEmployee.mutate(employeeForm);
    }
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEmployeeForm(employee);
    setShowEmployeeForm(true);
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({ name: "", phone: "", email: "", role: "waiter", hourly_rate: 0, daily_rate: 0, payment_type: "daily", is_active: true, notes: "" });
    setEditingEmployee(null);
    setShowEmployeeForm(false);
  };

  const resetShiftForm = () => {
    setShiftForm({ employee_id: "", employee_name: "", date: "", start_time: "09:00", end_time: "17:00", hours_worked: 8, amount: 0, status: "scheduled", notes: "" });
    setEditingShift(null);
    setShowShiftDialog(false);
  };

  const activeEmployees = employees.filter(e => e.is_active);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="bg-[#1a1a1a] border-b border-yellow-500/20 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold text-yellow-400">Employees</h1>
              <p className="text-xs text-gray-500">Calendar and Shifts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 lg:py-7 lg:space-y-7">
        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-[#242424] border border-yellow-500/20">
            <TabsTrigger value="calendar" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Calendar</TabsTrigger>
            <TabsTrigger value="employees" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Employees</TabsTrigger>
          </TabsList>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-6">
            {/* Week Navigation */}
            <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
                    <ChevronLeft className="w-4 h-4 mr-2" /> Previous Week
                  </Button>
                  <h2 className="text-xl font-bold">
                    {format(currentWeekStart, 'dd MMM', { locale: es })} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'dd MMM yyyy', { locale: es })}
                  </h2>
                  <Button variant="outline" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
                    Next Week <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Weekly Calendar */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {weekDays.map((day) => {
                const dayShifts = getShiftsForDay(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <Card key={day.toISOString()} className={`bg-[#242424] border shadow-none ${isToday ? 'border-yellow-400' : 'border-yellow-500/15'}`}>
                    <CardHeader className={`pb-2 ${isToday ? 'bg-yellow-400/10' : 'bg-[#1a1a1a]'}`}>
                      <CardTitle className="text-sm text-center">
                        <div className="font-medium text-gray-600">{format(day, 'EEEE', { locale: es })}</div>
                        <div className={`text-2xl ${isToday ? 'text-yellow-400' : ''}`}>{format(day, 'd')}</div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 min-h-[150px]">
                      <div className="space-y-2">
                        {dayShifts.map((shift) => {
                          const employee = employees.find(e => e.id === shift.employee_id);
                          return (
                            <div
                              key={shift.id}
                              onClick={() => openShiftDialog(day, shift)}
                              className={`p-2 rounded-lg text-xs cursor-pointer transition-all hover:shadow-md ${
                                shift.status === 'paid' ? 'bg-yellow-400/20 border border-yellow-400/40' :
                                 shift.status === 'completed' ? 'bg-yellow-400/10 border border-yellow-400/20' :
                                 shift.status === 'cancelled' ? 'bg-[#1a1a1a] border border-yellow-500/10 opacity-50' :
                                 'bg-yellow-400/10 border border-yellow-500/20'
                              }`}
                            >
                              <div className="font-semibold truncate">{shift.employee_name}</div>
                              <div className="text-gray-600">{shift.start_time} - {shift.end_time}</div>
                              <div className="font-bold text-yellow-400">${shift.amount?.toFixed(2)}</div>
                              {shift.status === 'paid' && <Badge className="bg-yellow-400 text-black text-xs mt-1">Paid</Badge>}
                            </div>
                          );
                        })}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openShiftDialog(day)}
                        className="w-full mt-2 text-gray-500 hover:text-red-600"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Today's Shifts Summary */}
            <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
              <CardHeader>
                <CardTitle>Today's Shifts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getShiftsForDay(new Date()).length > 0 ? (
                    getShiftsForDay(new Date()).map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-yellow-400/20 rounded-full flex items-center justify-center">
                            <span className="font-bold text-yellow-400">{shift.employee_name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-semibold">{shift.employee_name}</p>
                            <p className="text-sm text-gray-600">{shift.start_time} - {shift.end_time} ({shift.hours_worked}h)</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg">${shift.amount?.toFixed(2)}</span>
                          {shift.status === 'scheduled' && (
                            <Button size="sm" onClick={() => completeShiftAndPay(shift)} className="bg-yellow-400 hover:bg-yellow-300 text-black">
                              <Check className="w-4 h-4 mr-2" /> Complete and Pay
                            </Button>
                          )}
                          {shift.status === 'paid' && <Badge className="bg-yellow-400 text-black">Paid</Badge>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8">No shifts scheduled for today</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowEmployeeForm(!showEmployeeForm)} className="bg-yellow-400 hover:bg-yellow-300 text-black gap-2">
                <Plus className="w-4 h-4" /> New Employee / New Employee
              </Button>
            </div>

            {showEmployeeForm && (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                  <CardHeader>
                    <CardTitle>{editingEmployee ? 'Edit Employee' : 'New Employee'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleEmployeeSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Name *</Label>
                          <Input required value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Role *</Label>
                          <Select value={employeeForm.role} onValueChange={(v) => setEmployeeForm({ ...employeeForm, role: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(roleLabels).map(([key, label]) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>TelÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono / Phone</Label>
                          <Input value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Payment Type</Label>
                          <Select value={employeeForm.payment_type} onValueChange={(v) => setEmployeeForm({ ...employeeForm, payment_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Por DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a / Daily</SelectItem>
                              <SelectItem value="hourly">Hourly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {employeeForm.payment_type === 'daily' ? (
                          <div className="space-y-2">
                            <Label>Pago por DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a / Daily Rate (MXN)</Label>
                            <Input type="number" step="0.01" value={employeeForm.daily_rate} onChange={(e) => setEmployeeForm({ ...employeeForm, daily_rate: parseFloat(e.target.value) || 0 })} />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>Hourly Rate (MXN)</Label>
                            <Input type="number" step="0.01" value={employeeForm.hourly_rate} onChange={(e) => setEmployeeForm({ ...employeeForm, hourly_rate: parseFloat(e.target.value) || 0 })} />
                          </div>
                        )}
                        <div className="space-y-2 md:col-span-2">
                          <Label>Notes</Label>
                          <Textarea value={employeeForm.notes} onChange={(e) => setEmployeeForm({ ...employeeForm, notes: e.target.value })} rows={2} />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="is_active" checked={employeeForm.is_active} onChange={(e) => setEmployeeForm({ ...employeeForm, is_active: e.target.checked })} />
                          <Label htmlFor="is_active">Active Employee</Label>
                        </div>
                      </div>
                      <div className="flex gap-3 justify-end">
                        <Button type="button" variant="outline" onClick={resetEmployeeForm}>Cancel</Button>
                        <Button type="submit" className="bg-yellow-400 hover:bg-yellow-300 text-black">{editingEmployee ? 'Update' : 'Save'}</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employees.map((employee) => (
                <motion.div key={employee.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={`bg-[#242424] border border-yellow-500/15 shadow-none ${!employee.is_active ? 'opacity-60' : ''}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-yellow-400/20 rounded-full flex items-center justify-center">
                              <span className="text-xl font-bold text-yellow-400">{employee.name.charAt(0)}</span>
                            </div>
                          <div>
                            <h3 className="font-bold text-lg">{employee.name}</h3>
                            <Badge className={roleColors[employee.role]}>{roleLabels[employee.role]}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="outline" onClick={() => handleEditEmployee(employee)}><Edit className="w-4 h-4" /></Button>
                          <Button size="icon" variant="outline" className="text-red-600" onClick={() => deleteEmployee.mutate(employee.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      {employee.phone && <p className="text-sm text-gray-600 mb-1">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â± {employee.phone}</p>}
                      {employee.email && <p className="text-sm text-gray-600 mb-3">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â§ {employee.email}</p>}
                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-yellow-400" />
                            <span className="font-bold text-yellow-400">
                            ${employee.payment_type === 'daily' ? employee.daily_rate?.toFixed(2) : employee.hourly_rate?.toFixed(2)} MXN
                          </span>
                          <span className="text-sm text-gray-500">/ {employee.payment_type === 'daily' ? 'dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a' : 'hora'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Shift Dialog */}
      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit Shift' : 'New Shift'} - {selectedDate && format(selectedDate, 'dd MMM yyyy', { locale: es })}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleShiftSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select value={shiftForm.employee_id} onValueChange={handleEmployeeSelect}>
                <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} - {roleLabels[e.role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={shiftForm.start_time} onChange={(e) => handleTimeChange('start_time', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={shiftForm.end_time} onChange={(e) => handleTimeChange('end_time', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hours</Label>
                <Input type="number" step="0.5" value={shiftForm.hours_worked} onChange={(e) => setShiftForm({ ...shiftForm, hours_worked: parseFloat(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Amount (MXN)</Label>
                <Input type="number" step="0.01" value={shiftForm.amount} onChange={(e) => setShiftForm({ ...shiftForm, amount: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={shiftForm.notes} onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={resetShiftForm} className="flex-1">Cancel</Button>
              {editingShift && editingShift.status !== 'paid' && (
                <Button type="button" variant="outline" className="text-red-600" onClick={() => { deleteShift.mutate(editingShift.id); resetShiftForm(); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button type="submit" className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black">{editingShift ? 'Update' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Plus, TrendingUp, TrendingDown, Users, DollarSign, Trash2, Edit, Receipt, Calendar as CalendarIcon, Building2, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { startOfDay, endOfDay } from "date-fns";
import {
  dateFromMexicoDateKey,
  formatMexicoDateShort,
  formatMexicoLongDateEs,
  formatMexicoMonthDayShort,
  getMexicoNowDateKey,
} from "@/lib/mexicoTime";
import { createEntityWithOptionalTimestamp, updateEntityWithOptionalTimestamp } from "@/lib/businessTimestamps";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listOrders } from "@/lib/local-dev-orders";
import { getLoyverseOverview, hasLoyverseApiConfig } from "@/api/loyverse";
import { getClipOverview, hasClipApiConfig } from "@/api/clip";

export default function CompanyAccount() {
  const [selectedDate, setSelectedDate] = useState(getMexicoNowDateKey());
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showContributorForm, setShowContributorForm] = useState(false);
  const [editingContributor, setEditingContributor] = useState(null);
  const queryClient = useQueryClient();

  const [transactionForm, setTransactionForm] = useState({
    type: "contribution",
    contributor_name: "",
    amount: 0,
    date: getMexicoNowDateKey(),
    payment_method: "cash",
    description: "",
    notes: "",
    reference_number: "",
  });

  const [contributorForm, setContributorForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "partner",
    is_active: true,
    notes: "",
  });

  // Expense form state
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState("all");
  const [expenseForm, setExpenseForm] = useState({
    name: "",
    category: "ingredients",
    amount: 0,
    quantity: 1,
    unit: "units",
    is_recurring: false,
    recurring_frequency: "monthly",
    date: getMexicoNowDateKey(),
    notes: "",
    supplier: "",
    payment_source: "company_cash",
    paid_by_company: false,
    from_shopping_list: false,
    contributors: [],
  });
  const [contributorInput, setContributorInput] = useState({ name: "", amount: 0 });

  const { data: transactions = [] } = useQuery({
    queryKey: ['companyTransactions'],
    queryFn: () => base44.entities.CompanyTransaction.list('-date'),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const appSettings = settings[0] || {};

  const loyverseOverviewQuery = useQuery({
    queryKey: ['companyFinance', 'loyverse', settings[0]?.id || 'none'],
    queryFn: () => getLoyverseOverview(appSettings),
    enabled: hasLoyverseApiConfig(appSettings),
    staleTime: 60_000,
  });

  const clipOverviewQuery = useQuery({
    queryKey: ['companyFinance', 'clip', settings[0]?.id || 'none'],
    queryFn: () => getClipOverview(appSettings),
    enabled: hasClipApiConfig(appSettings),
    staleTime: 60_000,
  });

  const { data: contributors = [] } = useQuery({
    queryKey: ['contributors'],
    queryFn: () => base44.entities.Contributor.list('name'),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date'),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => listOrders((orderBy) => base44.entities.Order.list(orderBy), '-created_date'),
  });

  const createTransaction = useMutation({
    mutationFn: (data) =>
      createEntityWithOptionalTimestamp(base44.entities.CompanyTransaction, data, {
        dateField: "date",
        timestampField: "recorded_at",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['contributors'] });
      resetTransactionForm();
    },
  });

  const updateTransaction = useMutation({
    mutationFn: ({ id, data }) =>
      updateEntityWithOptionalTimestamp(base44.entities.CompanyTransaction, id, data, {
        timestampField: "recorded_at",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['contributors'] });
      resetTransactionForm();
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: (id) => base44.entities.CompanyTransaction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyTransactions'] });
    },
  });

  const createContributor = useMutation({
    mutationFn: (data) => base44.entities.Contributor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributors'] });
      resetContributorForm();
    },
  });

  const updateContributor = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contributor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributors'] });
      resetContributorForm();
    },
  });

  const deleteContributor = useMutation({
    mutationFn: (id) => base44.entities.Contributor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributors'] });
    },
  });

  const createExpense = useMutation({
    mutationFn: (data) =>
      createEntityWithOptionalTimestamp(base44.entities.Expense, data, {
        dateField: "date",
        timestampField: "recorded_at",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      resetExpenseForm();
    },
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, data }) =>
      updateEntityWithOptionalTimestamp(base44.entities.Expense, id, data, {
        timestampField: "recorded_at",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      resetExpenseForm();
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  // Calculate balances
  const totalContributions = transactions
    .filter(t => t.type === 'contribution')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdrawal')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Expenses paid from company cash
  const expensesFromCompanyCash = expenses
    .filter(e => e.payment_source === 'company_cash')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Expenses paid from company bank account
  const expensesFromCompanyAccount = expenses
    .filter(e => e.payment_source === 'company_account')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Total company expenses (both cash and account)
  const companyExpenses = expensesFromCompanyCash + expensesFromCompanyAccount;

  // Cash from customer orders (delivered orders paid in cash)
  const cashFromOrders = orders
    .filter(o => o.payment_method === 'cash' && o.status === 'delivered')
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Card/Online from customer orders (delivered/confirmed orders paid in card)
  const cardFromOrders = orders
    .filter(o => o.payment_method === 'card' && (o.status === 'delivered' || o.payment_status === 'confirmed' || o.payment_status === 'paid'))
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Cash contributions to the company
  const cashContributions = transactions
    .filter(t => t.type === 'contribution' && t.payment_method === 'cash')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Cash withdrawals from the company
  const cashWithdrawals = transactions
    .filter(t => t.type === 'withdrawal' && t.payment_method === 'cash')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Bank contributions (not cash)
  const bankContributions = transactions
    .filter(t => t.type === 'contribution' && t.payment_method !== 'cash')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Bank withdrawals (not cash)
  const bankWithdrawals = transactions
    .filter(t => t.type === 'withdrawal' && t.payment_method !== 'cash')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Available company cash = cash from orders + cash contributions - cash withdrawals - expenses paid with cash
  const availableCash = cashFromOrders + cashContributions - cashWithdrawals - expensesFromCompanyCash;

  // Bank Account Balance = Bank contributions + Card Sales - Bank Withdrawals - Expenses paid with Account
  // This separates the "Balance" (Bank) from "Cash" as requested
  const companyBalance = bankContributions + cardFromOrders - bankWithdrawals - expensesFromCompanyAccount;

  // Update contributor totals
  const contributorTotals = contributors.map(contributor => {
    const contributed = transactions
      .filter(t => t.type === 'contribution' && t.contributor_name === contributor.name)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const withdrawn = transactions
      .filter(t => t.type === 'withdrawal' && t.contributor_name === contributor.name)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
      ...contributor,
      total_contributed: contributed,
      total_withdrawn: withdrawn,
      net_contribution: contributed - withdrawn,
    };
  });

  // Calculate Balance Equalization (who owes whom relative to equal contribution)
  const equityHolders = contributorTotals.filter(c => 
    c.is_active && (c.role === 'partner' || c.role === 'owner' || c.role === 'investor')
  );
  const totalEquityNet = equityHolders.reduce((sum, c) => sum + c.net_contribution, 0);
  const averageEquityNet = equityHolders.length > 0 ? totalEquityNet / equityHolders.length : 0;

  const loyverseOverview = loyverseOverviewQuery.data;
  const clipOverview = clipOverviewQuery.data;
  const manualTransactionCount = transactions.length;
  const manualContributionCount = transactions.filter((transaction) => transaction.type === 'contribution').length;
  const manualWithdrawalCount = transactions.filter((transaction) => transaction.type === 'withdrawal').length;
  const loyverseGrossSales = loyverseOverview?.metrics?.grossSales || 0;
  const loyverseReceiptsCount = loyverseOverview?.metrics?.receiptsCount || 0;
  const loyverseCompletedReceiptsCount = loyverseOverview?.metrics?.completedReceiptsCount || 0;
  const loyverseCancelledReceiptsCount = loyverseOverview?.metrics?.cancelledReceiptsCount || 0;
  const clipGrossVolume = clipOverview?.metrics?.grossVolume || 0;
  const clipRefundedVolume = clipOverview?.metrics?.refundedVolume || 0;
  const clipNetDeposits = clipOverview?.metrics?.netDeposits || 0;
  const clipPaymentsCount = clipOverview?.metrics?.paymentsCount || 0;
  const totalTrackedSourceVolume = loyverseGrossSales + clipGrossVolume + totalContributions;
  const recentManualEntries = [
    ...transactions.map((transaction) => ({
      id: `transaction-${transaction.id}`,
      kind: transaction.type === 'contribution' ? 'Contribution' : 'Withdrawal',
      title: transaction.contributor_name || 'Manual transaction',
      subtitle: transaction.description || transaction.payment_method || 'Manual entry',
      amount: transaction.amount || 0,
      date: transaction.date,
      recordedAt: transaction.recorded_at || transaction.created_date || '',
      tone: transaction.type === 'contribution' ? 'positive' : 'negative',
    })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      kind: 'Expense',
      title: expense.name || 'Expense',
      subtitle: expense.from_shopping_list
        ? `Shopping list · ${expense.category || 'ingredients'}`
        : expense.category || 'Expense',
      amount: expense.amount || 0,
      date: expense.date,
      recordedAt: expense.recorded_at || expense.created_date || '',
      tone: 'negative',
    })),
  ]
    .sort((a, b) => new Date(b.recordedAt || b.date || 0).getTime() - new Date(a.recordedAt || a.date || 0).getTime())
    .slice(0, 12);

  const handleTransactionSubmit = (e) => {
    e.preventDefault();
    if (editingTransaction) {
      updateTransaction.mutate({ id: editingTransaction.id, data: transactionForm });
    } else {
      createTransaction.mutate(transactionForm);
    }
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setTransactionForm({
      type: transaction.type,
      contributor_name: transaction.contributor_name,
      amount: transaction.amount,
      date: transaction.date,
      payment_method: transaction.payment_method,
      description: transaction.description || "",
      notes: transaction.notes || "",
      reference_number: transaction.reference_number || "",
    });
    setShowTransactionForm(true);
  };

  const handleContributorSubmit = (e) => {
    e.preventDefault();
    if (editingContributor) {
      updateContributor.mutate({ id: editingContributor.id, data: contributorForm });
    } else {
      createContributor.mutate(contributorForm);
    }
  };

  const handleEditContributor = (contributor) => {
    setEditingContributor(contributor);
    setContributorForm(contributor);
    setShowContributorForm(true);
  };

  const handleDeleteTransaction = (id) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteTransaction.mutate(id);
    }
  };

  const handleDeleteContributor = (id) => {
    if (confirm("Are you sure you want to delete this contributor?")) {
      deleteContributor.mutate(id);
    }
  };

  const resetTransactionForm = () => {
    setTransactionForm({
      type: "contribution",
      contributor_name: "",
      amount: 0,
      date: getMexicoNowDateKey(),
      payment_method: "cash",
      description: "",
      notes: "",
      reference_number: "",
    });
    setEditingTransaction(null);
    setShowTransactionForm(false);
  };

  const resetContributorForm = () => {
    setContributorForm({
      name: "",
      email: "",
      phone: "",
      role: "partner",
      is_active: true,
      notes: "",
    });
    setEditingContributor(null);
    setShowContributorForm(false);
  };

  // Expense categories and units
  const expenseCategories = [
    { id: "all", name: "All", color: "bg-gray-100 text-gray-800", icon: "\u{1F4CB}" },
    { id: "ingredients", name: "Ingredients", color: "bg-yellow-400/20 text-yellow-400", icon: "\u{1F957}" },
    { id: "rent", name: "Rent", color: "bg-yellow-400/20 text-yellow-400", icon: "\u{1F3E0}" },
    { id: "utilities", name: "Utilities", color: "bg-yellow-400/20 text-yellow-400", icon: "\u{1F4A1}" },
    { id: "salaries", name: "Salaries", color: "bg-yellow-400/20 text-yellow-400", icon: "\u{1F464}" },
    { id: "equipment", name: "Equipment", color: "bg-yellow-400/20 text-yellow-400", icon: "\u{1F527}" },
    { id: "marketing", name: "Marketing", color: "bg-yellow-400/20 text-yellow-400", icon: "\u{1F4E2}" },
    { id: "other", name: "Other", color: "bg-yellow-400/10 text-yellow-400/70", icon: "\u{1F4E6}" },
  ];

  const expenseUnits = [
    { value: "kg", label: "Kg" },
    { value: "g", label: "g" },
    { value: "l", label: "L" },
    { value: "ml", label: "ml" },
    { value: "units", label: "Units" },
    { value: "pieces", label: "Pieces" },
    { value: "months", label: "Months" },
    { value: "other", label: "Other" },
  ];

  const filteredExpenses = selectedExpenseCategory === "all"
    ? expenses
    : expenses.filter(e => e.category === selectedExpenseCategory);

  const totalExpensesFiltered = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const recurringExpenses = filteredExpenses.filter(e => e.is_recurring);
  const monthlyRecurring = recurringExpenses
    .filter(e => e.recurring_frequency === "monthly")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const handleExpenseSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...expenseForm,
      paid_by_company: expenseForm.payment_source === 'company_cash' || expenseForm.payment_source === 'company_account'
    };
    if (editingExpense) {
      updateExpense.mutate({ id: editingExpense.id, data: submitData });
    } else {
      createExpense.mutate(submitData);
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      ...expense,
      contributors: expense.contributors || [],
      payment_source: expense.payment_source || 'company_cash',
    });
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = (id) => {
    if (confirm("Delete this expense?")) {
      deleteExpense.mutate(id);
    }
  };

  const addExpenseContributor = () => {
    if (contributorInput.name && contributorInput.amount > 0) {
      setExpenseForm({
        ...expenseForm,
        contributors: [...(expenseForm.contributors || []), { ...contributorInput }]
      });
      setContributorInput({ name: "", amount: 0 });
    }
  };

  const removeExpenseContributor = (index) => {
    setExpenseForm({
      ...expenseForm,
      contributors: expenseForm.contributors.filter((_, i) => i !== index)
    });
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      name: "",
      category: "ingredients",
      amount: 0,
      quantity: 1,
      unit: "units",
      is_recurring: false,
      recurring_frequency: "monthly",
      date: getMexicoNowDateKey(),
      notes: "",
      supplier: "",
      payment_source: "company_cash",
      paid_by_company: false,
      from_shopping_list: false,
      contributors: [],
    });
    setContributorInput({ name: "", amount: 0 });
    setEditingExpense(null);
    setShowExpenseForm(false);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="bg-[#1a1a1a] border-b border-yellow-500/20 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Wallet className="w-6 h-6 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold text-yellow-400">Company Account</h1>
              <p className="text-xs text-gray-500">Finance and Contributors</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 lg:py-7 lg:space-y-7">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                Account Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${companyBalance >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                ${companyBalance.toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">MXN in bank</p>
            </CardContent>
          </Card>

          <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                Available Cash
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${availableCash >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                ${availableCash.toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                +${cashFromOrders.toFixed(2)} cash sales
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-yellow-400" />
                Contributions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400">${totalContributions.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">{transactions.filter(t => t.type === 'contribution').length} transactions</p>
            </CardContent>
          </Card>

          <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-yellow-400" />
                Company Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400/70">${companyExpenses.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">
                Cash ${expensesFromCompanyCash.toFixed(2)} | Account ${expensesFromCompanyAccount.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4 text-yellow-400" />
                Contributors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400">{contributors.filter(c => c.is_active).length}</div>
              <p className="text-xs text-gray-500 mt-1">{contributors.length} total</p>
            </CardContent>
          </Card>
        </div>

        {/* Cash Flow Summary */}
        <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-400">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            Cash Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-gray-400 mb-2">Total Available Cash</p>
            <div className={`text-6xl font-bold ${availableCash >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                ${availableCash.toFixed(2)}
              </div>
              <p className="text-sm text-gray-500 mt-2">MXN</p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="expenses" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-[#242424] border border-yellow-500/20">
            <TabsTrigger value="daily-income" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Daily Income</TabsTrigger>
            <TabsTrigger value="expenses" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Expenses</TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Transactions</TabsTrigger>
            <TabsTrigger value="contributors" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Contributors</TabsTrigger>
          </TabsList>

          {/* Daily Income Tab */}
          <TabsContent value="daily-income" className="space-y-6">
            <div className="flex gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="income-date">Select Date</Label>
                <Input
                  id="income-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-yellow-500/20 bg-[#242424]"
                />
              </div>
              <div className="text-sm text-gray-400 pb-2">
                {formatMexicoLongDateEs(dateFromMexicoDateKey(selectedDate))}
              </div>
            </div>

            {(() => {
              const dateRange = {
                start: startOfDay(new Date(selectedDate)),
                end: endOfDay(new Date(selectedDate)),
              };

              const loyverseIncome = orders.filter(o => {
                const orderDate = new Date(o.created_date);
                return orderDate >= dateRange.start && orderDate <= dateRange.end && o.status === 'delivered';
              });

              const loyverseCash = loyverseIncome
                .filter(o => o.payment_method === 'cash')
                .reduce((sum, o) => sum + (o.total_amount || 0), 0);

              const loyverseCard = loyverseIncome
                .filter(o => o.payment_method === 'card')
                .reduce((sum, o) => sum + (o.total_amount || 0), 0);

              const manualCash = transactions
                .filter(t => {
                  const txDate = new Date(t.date);
                  return txDate >= dateRange.start && txDate <= dateRange.end && 
                         t.type === 'contribution' && t.payment_method === 'cash';
                })
                .reduce((sum, t) => sum + (t.amount || 0), 0);

              const revolut = transactions
                .filter(t => {
                  const txDate = new Date(t.date);
                  return txDate >= dateRange.start && txDate <= dateRange.end && 
                         t.type === 'contribution' && t.payment_method === 'transfer';
                })
                .reduce((sum, t) => sum + (t.amount || 0), 0);

              const totalIncome = loyverseCash + loyverseCard + manualCash + revolut;

              return (
                <>
                  <Card className="bg-gradient-to-r from-yellow-400/10 to-yellow-400/5 border border-yellow-500/30 shadow-none">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Total Daily Income</p>
                          <div className="text-5xl font-bold text-yellow-400">${totalIncome.toFixed(2)}</div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          {loyverseIncome.length} orders
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-400">Clip (cards)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-400">${loyverseCard.toFixed(2)}</div>
                        <p className="text-xs text-gray-500 mt-1">{loyverseIncome.filter(o => o.payment_method === 'card').length} orders</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-400">Loyverse (cash)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-400">${loyverseCash.toFixed(2)}</div>
                        <p className="text-xs text-gray-500 mt-1">{loyverseIncome.filter(o => o.payment_method === 'cash').length} orders</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-400">Manual cash</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-400">${manualCash.toFixed(2)}</div>
                        <p className="text-xs text-gray-500 mt-1">Manual entries</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-400">Revolut / bank</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-400">${revolut.toFixed(2)}</div>
                        <p className="text-xs text-gray-500 mt-1">Transfers</p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              );
            })()}
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex gap-2 overflow-x-auto pb-2 flex-1">
                {expenseCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedExpenseCategory === cat.id ? "default" : "outline"}
                    onClick={() => setSelectedExpenseCategory(cat.id)}
                    className={`flex items-center gap-2 whitespace-nowrap ${
                      selectedExpenseCategory === cat.id ? 'bg-yellow-400 text-black hover:bg-yellow-300' : 'bg-[#1a1a1a] border-yellow-500/20 text-gray-400 hover:text-white'
                    }`}
                    size="sm"
                  >
                    <span>{cat.icon}</span>
                    {cat.name}
                  </Button>
                ))}
              </div>
              <Button
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="bg-yellow-400 hover:bg-yellow-300 text-black gap-2"
              >
                <Plus className="w-4 h-4" />
                New Expense
              </Button>
            </div>

            {/* Expense Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <TrendingDown className="w-4 h-4" />
                    Total Expenses
                  </div>
                  <div className="text-2xl font-bold text-yellow-400/70">${totalExpensesFiltered.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <CalendarIcon className="w-4 h-4" />
                    Monthly recurring
                  </div>
                  <div className="text-2xl font-bold text-yellow-400">${monthlyRecurring.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600 mb-1">Total recurring</div>
                  <div className="text-2xl font-bold text-yellow-400">{recurringExpenses.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Expense Form */}
            {showExpenseForm && (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                  <CardHeader>
                    <CardTitle>{editingExpense ? "Edit Expense" : "New Expense"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleExpenseSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="exp_name">Name *</Label>
                          <Input
                            id="exp_name"
                            required
                            value={expenseForm.name}
                            onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Category *</Label>
                          <Select
                            value={expenseForm.category}
                            onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {expenseCategories.filter(c => c.id !== "all").map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Amount (MXN) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={expenseForm.amount}
                            onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Fecha *</Label>
                          <Input
                            type="date"
                            required
                            value={expenseForm.date}
                            onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={expenseForm.quantity}
                            onChange={(e) => setExpenseForm({ ...expenseForm, quantity: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unidad</Label>
                          <Select
                            value={expenseForm.unit}
                            onValueChange={(v) => setExpenseForm({ ...expenseForm, unit: v })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {expenseUnits.map(u => (
                                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Supplier</Label>
                          <Input
                            value={expenseForm.supplier}
                            onChange={(e) => setExpenseForm({ ...expenseForm, supplier: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="exp_recurring"
                              checked={expenseForm.is_recurring}
                              onChange={(e) => setExpenseForm({ ...expenseForm, is_recurring: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="exp_recurring" className="cursor-pointer">Recurring</Label>
                          </div>
                          {expenseForm.is_recurring && (
                            <Select
                              value={expenseForm.recurring_frequency}
                              onValueChange={(v) => setExpenseForm({ ...expenseForm, recurring_frequency: v })}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="yearly">Yearly</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>

                      {/* Payment Source */}
                      <div className="space-y-2">
                        <Label>Payment source *</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'company_cash', label: 'Cash', sublabel: 'Company' },
                            { id: 'company_account', label: 'Account', sublabel: 'Company' },
                            { id: 'individual', label: 'Individual', sublabel: 'Person' },
                          ].map(ps => (
                            <button
                              key={ps.id}
                              type="button"
                              onClick={() => setExpenseForm({ ...expenseForm, payment_source: ps.id, contributors: ps.id !== 'individual' ? [] : expenseForm.contributors })}
                              className={`p-3 border-2 rounded-lg text-center transition-all ${
                                expenseForm.payment_source === ps.id ? 'border-yellow-400 bg-yellow-400/10 text-white' : 'border-yellow-500/20 text-gray-400 hover:border-yellow-500/40'
                              }`}
                            >
                              <div className="font-semibold text-sm">{ps.label}</div>
                              <div className="text-xs text-gray-500">{ps.sublabel}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {expenseForm.payment_source === 'individual' && (
                        <div className="space-y-2 p-4 bg-[#1a1a1a] rounded-lg">
                          <Label>Individual Contributors</Label>
                          <div className="flex gap-2">
                            <Select
                              value={contributorInput.name}
                              onValueChange={(v) => setContributorInput({ ...contributorInput, name: v })}
                            >
                              <SelectTrigger className="flex-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>
                                {contributors.map(c => (
                                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={contributorInput.amount}
                              onChange={(e) => setContributorInput({ ...contributorInput, amount: parseFloat(e.target.value) })}
                              className="w-24"
                            />
                            <Button type="button" onClick={addExpenseContributor} variant="outline" size="sm">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          {expenseForm.contributors?.length > 0 && (
                            <div className="space-y-1 mt-2">
                              {expenseForm.contributors.map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                                  <span>{c.name}: ${c.amount?.toFixed(2)}</span>
                                  <Button type="button" size="icon" variant="ghost" onClick={() => removeExpenseContributor(i)} className="h-6 w-6">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={expenseForm.notes}
                          onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                          rows={2}
                        />
                      </div>

                      <div className="flex gap-3 justify-end">
                        <Button type="button" variant="outline" onClick={resetExpenseForm}>Cancel</Button>
                        <Button type="submit" disabled={createExpense.isPending || updateExpense.isPending} className="bg-yellow-400 hover:bg-yellow-300 text-black">
                          {editingExpense ? "Update" : "Save"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Expenses List */}
            <div className="space-y-3">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((expense) => {
                  const cat = expenseCategories.find(c => c.id === expense.category) || expenseCategories[expenseCategories.length - 1];
                  return (
                    <Card key={expense.id} className="bg-[#242424] border border-yellow-500/15 shadow-none">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-xl">{cat.icon}</span>
                            <div className="flex-1">
                              <h3 className="font-semibold">{expense.name}</h3>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <Badge className={cat.color} variant="secondary">{cat.name}</Badge>
                                {expense.is_recurring && <Badge variant="outline">Recurring</Badge>}
                                <Badge variant="outline">{formatMexicoMonthDayShort(expense.date)}</Badge>
                                {expense.payment_source && (
                                  <Badge variant="outline" className="text-xs">
                                    {expense.payment_source === 'company_cash'
                                      ? 'Cash'
                                      : expense.payment_source === 'company_account'
                                        ? 'Account'
                                        : 'Individual'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xl font-bold text-yellow-400/70">${expense.amount?.toFixed(2)}</div>
                              <p className="text-xs text-gray-500">{expense.quantity} {expense.unit}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleEditExpense(expense)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="text-red-600" onClick={() => handleDeleteExpense(expense.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                  <CardContent className="text-center py-12">
                    <Receipt className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500">No expenses recorded</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <div className="flex justify-end">
              <Button
                onClick={() => setShowTransactionForm(!showTransactionForm)}
                className="bg-yellow-400 hover:bg-yellow-300 text-black gap-2"
              >
                <Plus className="w-4 h-4" />
                New Transaction
              </Button>
            </div>

            {/* Transaction Form */}
            {showTransactionForm && (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-2xl">
                      {editingTransaction ? "Edit Transaction" : "New Transaction"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleTransactionSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="type">Type *</Label>
                          <Select
                            value={transactionForm.type}
                            onValueChange={(value) => setTransactionForm({ ...transactionForm, type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contribution">Contribution</SelectItem>
                              <SelectItem value="withdrawal">Withdrawal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contributor">Contributor *</Label>
                          <Select
                            value={transactionForm.contributor_name}
                            onValueChange={(value) => setTransactionForm({ ...transactionForm, contributor_name: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {contributors.map(c => (
                                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="amount">Amount (MXN) *</Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={transactionForm.amount}
                            onChange={(e) => setTransactionForm({ ...transactionForm, amount: parseFloat(e.target.value) })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="date">Fecha / Date *</Label>
                          <Input
                            id="date"
                            type="date"
                            required
                            value={transactionForm.date}
                            onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>
                            {transactionForm.type === 'contribution'
                              ? 'Money destination *'
                              : 'Money source *'}
                          </Label>
                          <div className="grid grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => setTransactionForm({ ...transactionForm, payment_method: 'cash' })}
                              className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all text-left ${
                                transactionForm.payment_method === 'cash'
                                  ? 'border-yellow-400 bg-yellow-400/10 text-white'
                                  : 'border-yellow-500/20 text-gray-400 hover:border-yellow-500/40'
                              }`}
                            >
                              <DollarSign className="w-8 h-8 shrink-0 text-yellow-400" aria-hidden />
                              <div>
                                <p className="font-semibold">Cash</p>
                                <p className="text-xs text-gray-600">Petty cash</p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setTransactionForm({ ...transactionForm, payment_method: 'transfer' })}
                              className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all text-left ${
                                transactionForm.payment_method === 'transfer'
                                  ? 'border-yellow-400 bg-yellow-400/10 text-white'
                                  : 'border-yellow-500/20 text-gray-400 hover:border-yellow-500/40'
                              }`}
                            >
                              <Building2 className="w-8 h-8 shrink-0 text-yellow-400" aria-hidden />
                              <div>
                                <p className="font-semibold">Bank</p>
                                <p className="text-xs text-gray-600">Account</p>
                              </div>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="reference">Reference Number</Label>
                          <Input
                            id="reference"
                            value={transactionForm.reference_number}
                            onChange={(e) => setTransactionForm({ ...transactionForm, reference_number: e.target.value })}
                            placeholder="Ej: REF123456"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="description">Description</Label>
                          <Input
                            id="description"
                            value={transactionForm.description}
                            onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                            placeholder="Short description..."
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            value={transactionForm.notes}
                            onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                            rows={3}
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end">
                        <Button type="button" variant="outline" onClick={resetTransactionForm}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createTransaction.isPending || updateTransaction.isPending} className="bg-yellow-400 hover:bg-yellow-300 text-black">
                          {editingTransaction ? "Update" : "Save"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Transactions List */}
            <div className="space-y-4">
              {transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <motion.div key={transaction.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-start gap-3 mb-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                transaction.type === 'contribution' ? 'bg-yellow-400/20' : 'bg-red-500/20'
                              }`}>
                                {transaction.type === 'contribution' ? (
                                  <TrendingUp className="w-6 h-6 text-yellow-400" />
                                ) : (
                                  <TrendingDown className="w-6 h-6 text-yellow-400/60" />
                                )}
                              </div>
                              <div className="flex-1">
                                <h3 className="font-bold text-lg">{transaction.contributor_name}</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Badge className={transaction.type === 'contribution' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}>
                                    {transaction.type === 'contribution' ? 'Contribution' : 'Withdrawal'}
                                  </Badge>
                                  <Badge variant="outline">
                                    {formatMexicoDateShort(transaction.date)}
                                  </Badge>
                                  <Badge variant="outline" className="capitalize">
                                    {transaction.payment_method}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {transaction.description && (
                              <p className="text-sm text-gray-700 mb-2">{transaction.description}</p>
                            )}
                            {transaction.reference_number && (
                              <p className="text-xs text-gray-500">Ref: {transaction.reference_number}</p>
                            )}
                            {transaction.notes && (
                              <div className="mt-3 p-3 bg-[#1a1a1a] rounded-lg">
                                <p className="text-sm text-gray-700">{transaction.notes}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-3">
                            <div className={`text-3xl font-bold ${
                              transaction.type === 'contribution' ? 'text-yellow-400' : 'text-yellow-400/60'
                            }`}>
                              {transaction.type === 'contribution' ? '+' : '-'}${transaction.amount?.toFixed(2)}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleEditTransaction(transaction)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="text-yellow-400/60 hover:text-yellow-400"
                                onClick={() => handleDeleteTransaction(transaction.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                  <CardContent className="text-center py-20">
                    <Wallet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500 text-lg">No transactions recorded</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Contributors Tab */}
          <TabsContent value="contributors" className="space-y-6">
            <div className="flex justify-end">
              <Button
                onClick={() => setShowContributorForm(!showContributorForm)}
                className="bg-yellow-400 hover:bg-yellow-300 text-black gap-2"
              >
                <Plus className="w-4 h-4" />
                New Contributor
              </Button>
            </div>

            {/* Contributor Form */}
            {showContributorForm && (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-2xl">
                      {editingContributor ? "Edit Contributor" : "New Contributor"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleContributorSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name *</Label>
                          <Input
                            id="name"
                            required
                            value={contributorForm.name}
                            onChange={(e) => setContributorForm({ ...contributorForm, name: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="role">Role *</Label>
                          <Select
                            value={contributorForm.role}
                            onValueChange={(value) => setContributorForm({ ...contributorForm, role: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="partner">Partner</SelectItem>
                              <SelectItem value="investor">Investor</SelectItem>
                              <SelectItem value="employee">Employee</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={contributorForm.email}
                            onChange={(e) => setContributorForm({ ...contributorForm, email: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={contributorForm.phone}
                            onChange={(e) => setContributorForm({ ...contributorForm, phone: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="c_notes">Notes</Label>
                          <Textarea
                            id="c_notes"
                            value={contributorForm.notes}
                            onChange={(e) => setContributorForm({ ...contributorForm, notes: e.target.value })}
                            rows={3}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="is_active"
                            checked={contributorForm.is_active}
                            onChange={(e) => setContributorForm({ ...contributorForm, is_active: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <Label htmlFor="is_active" className="cursor-pointer">
                            Active Contributor
                          </Label>
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end">
                        <Button type="button" variant="outline" onClick={resetContributorForm}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createContributor.isPending || updateContributor.isPending}
                          className="bg-yellow-400 hover:bg-yellow-300 text-black"
                        >
                          {editingContributor ? "Update" : "Save"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Balance Equalization Card */}
            {equityHolders.length > 1 && (
              <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-400">
                    <Users className="w-5 h-5 text-yellow-400" />
                    Partner Balance Equalization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 p-4 bg-[#1a1a1a] rounded-lg">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-gray-600">Total Net Contribution:</span>
                      <span className="font-bold">${totalEquityNet.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Average per Partner:</span>
                      <span className="font-bold text-yellow-400">${averageEquityNet.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {equityHolders.map(holder => {
                      const diff = holder.net_contribution - averageEquityNet;
                      const isAbove = diff >= 0;
                      return (
                        <div key={holder.id} className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-yellow-500/10">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              isAbove ? 'bg-yellow-400/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {holder.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{holder.name}</p>
                              <p className="text-xs text-gray-500">
                                Net: ${holder.net_contribution.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-sm ${isAbove ? 'text-yellow-400' : 'text-red-400'}`}>
                              {isAbove ? '+' : ''}{diff.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {isAbove ? 'Credit' : 'Owes'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contributors List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contributorTotals.length > 0 ? (
                contributorTotals.map((contributor) => (
                  <motion.div key={contributor.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className={`bg-[#242424] border border-yellow-500/15 shadow-none ${
                      !contributor.is_active ? 'opacity-60' : ''
                    }`}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-yellow-400/20 rounded-full flex items-center justify-center">
                              <span className="text-xl font-bold text-yellow-400">
                                {contributor.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{contributor.name}</h3>
                              <Badge className="capitalize">{contributor.role}</Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleEditContributor(contributor)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="text-yellow-400/60 hover:text-yellow-400"
                              onClick={() => handleDeleteContributor(contributor.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {contributor.email && (
                          <p className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                            <Mail className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                            {contributor.email}
                          </p>
                        )}
                        {contributor.phone && (
                          <p className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                            <Phone className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                            {contributor.phone}
                          </p>
                        )}

                        <div className="space-y-2 pt-4 border-t">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Contributed:</span>
                            <span className="font-semibold text-yellow-400">+${contributor.total_contributed.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Withdrawn:</span>
                            <span className="font-semibold text-yellow-400/60">-${contributor.total_withdrawn.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <span className="font-semibold">Net Balance:</span>
                            <span className="font-bold text-yellow-400">
                              ${contributor.net_contribution.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {contributor.notes && (
                          <div className="mt-3 p-3 bg-[#1a1a1a] rounded-lg">
                            <p className="text-sm text-gray-700">{contributor.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <Card className="bg-[#242424] border border-yellow-500/15 shadow-none md:col-span-2">
                  <CardContent className="text-center py-20">
                    <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500 text-lg">No contributors registered</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

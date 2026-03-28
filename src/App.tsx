import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Moon, Sun, PieChart, ChevronRight, ChevronLeft,
  ArrowUp, ArrowDown, Trash2, Plus, Minus, Utensils, Receipt,
  Bus, Home, Wifi, Handshake, Sofa, Shirt, Car, PackageOpen,
  Banknote, TrendingUp, TrendingDown, MoreHorizontal, Landmark, CreditCard,
  X, FileSpreadsheet, Search, Calendar
} from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type TransactionType = 'income' | 'expense';
type FilterMode = 'daily' | 'monthly' | 'yearly';

interface Transaction {
  id: number;
  type: TransactionType;
  catId: number;
  amount: number;
  method: string;
  receipt?: string;
  date: string;
}

interface Category {
  id: number;
  name: string;
  icon: React.ElementType;
  type: TransactionType;
  color: string;
  bg: string;
}

// --- Constants ---
const CATEGORIES: Category[] = [
  { id: 1, name: "الغذاء", icon: Utensils, type: "expense", color: "text-orange-500", bg: "bg-orange-500" },
  { id: 2, name: "الفواتير", icon: Receipt, type: "expense", color: "text-blue-500", bg: "bg-blue-500" },
  { id: 3, name: "النقل", icon: Bus, type: "expense", color: "text-purple-500", bg: "bg-purple-500" },
  { id: 4, name: "السكن", icon: Home, type: "expense", color: "text-slate-700", bg: "bg-slate-700" },
  { id: 5, name: "الاتصالات", icon: Wifi, type: "expense", color: "text-teal-500", bg: "bg-teal-500" },
  { id: 6, name: "التزامات", icon: Handshake, type: "expense", color: "text-gray-500", bg: "bg-gray-500" },
  { id: 7, name: "المنزل", icon: Sofa, type: "expense", color: "text-orange-600", bg: "bg-orange-600" },
  { id: 8, name: "الملابس", icon: Shirt, type: "expense", color: "text-yellow-500", bg: "bg-yellow-500" },
  { id: 9, name: "السيارة", icon: Car, type: "expense", color: "text-rose-600", bg: "bg-rose-600" },
  { id: 10, name: "مستلزمات", icon: PackageOpen, type: "expense", color: "text-emerald-600", bg: "bg-emerald-600" },
  { id: 11, name: "راتب", icon: Banknote, type: "income", color: "text-emerald-500", bg: "bg-emerald-500" },
  { id: 12, name: "أرباح", icon: TrendingUp, type: "income", color: "text-emerald-600", bg: "bg-emerald-600" },
  { id: 13, name: "أخرى", icon: MoreHorizontal, type: "income", color: "text-yellow-400", bg: "bg-yellow-400" }
];

const INCOME_METHODS = [
  { name: 'كاش', icon: Banknote, color: 'bg-emerald-600' },
  { name: 'تحويل', icon: Landmark, color: 'bg-indigo-600' }
];

const EXPENSE_METHODS = [
  { name: 'كاش', icon: Banknote, color: 'bg-orange-500' },
  { name: 'بطاقة', icon: CreditCard, color: 'bg-indigo-600' }
];

// --- Helpers ---
const formatCurrency = (amount: number) => {
  return amount.toLocaleString('ar-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getCategory = (id: number) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// --- Main App ---
export default function App() {
  // State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('hissabi_pro_v2026_react');
    return saved ? JSON.parse(saved) : [];
  });
  const [filterMode, setFilterMode] = useState<FilterMode>('daily');
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Add Transaction State
  const [addStep, setAddStep] = useState(1);
  const [newTxDate, setNewTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newTxType, setNewTxType] = useState<TransactionType | ''>('');
  const [newTxCatId, setNewTxCatId] = useState<number | null>(null);
  const [newTxMethod, setNewTxMethod] = useState<string>('');
  const [newTxAmount, setNewTxAmount] = useState<string>('');
  const [newTxReceipt, setNewTxReceipt] = useState<string>('');

  // Effects
  useEffect(() => {
    localStorage.setItem('hissabi_pro_v2026_react', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Derived Data
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const d = new Date(tx.date);
      let dateMatch = false;
      
      if (filterMode === 'daily') {
        dateMatch = d.toDateString() === filterDate.toDateString();
      } else if (filterMode === 'monthly') {
        dateMatch = d.getMonth() === filterDate.getMonth() && d.getFullYear() === filterDate.getFullYear();
      } else {
        dateMatch = d.getFullYear() === filterDate.getFullYear();
      }

      if (!dateMatch) return false;

      if (searchQuery.trim() !== '') {
        const cat = getCategory(tx.catId);
        const q = searchQuery.toLowerCase();
        return cat.name.toLowerCase().includes(q) || 
               tx.method.toLowerCase().includes(q) || 
               (tx.receipt && tx.receipt.toLowerCase().includes(q));
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterMode, filterDate, searchQuery]);

  const { totalIncome, totalExpense, latestIncome, latestExpense } = useMemo(() => {
    let inc = 0, exp = 0;
    let latestInc: Transaction | null = null;
    let latestExp: Transaction | null = null;

    filteredTransactions.forEach(tx => {
      if (tx.type === 'income') {
        inc += tx.amount;
        if (!latestInc || tx.id > latestInc.id) latestInc = tx;
      } else {
        exp += tx.amount;
        if (!latestExp || tx.id > latestExp.id) latestExp = tx;
      }
    });
    return { totalIncome: inc, totalExpense: exp, latestIncome: latestInc, latestExpense: latestExp };
  }, [filteredTransactions]);

  const netBalance = totalIncome - totalExpense;

  // Handlers
  const changePeriod = (delta: number) => {
    const newDate = new Date(filterDate);
    if (filterMode === 'daily') newDate.setDate(newDate.getDate() + delta);
    else if (filterMode === 'monthly') newDate.setMonth(newDate.getMonth() + delta);
    else newDate.setFullYear(newDate.getFullYear() + delta);
    setFilterDate(newDate);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("هل أنت متأكد من حذف هذه العملية؟")) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const exportToExcel = () => {
    if (filterMode === 'daily') {
      alert("التصدير متاح فقط للتقارير الشهرية والسنوية.");
      return;
    }

    if (filteredTransactions.length === 0) {
      alert("لا توجد بيانات لتصديرها.");
      return;
    }

    const data = filteredTransactions.map(tx => {
      const cat = getCategory(tx.catId);
      return {
        'التاريخ': new Date(tx.date).toLocaleDateString('ar-LY'),
        'الوقت': new Date(tx.date).toLocaleTimeString('ar-LY', {hour:'2-digit', minute:'2-digit'}),
        'التصنيف': cat.name,
        'النوع': tx.type === 'income' ? 'إيراد' : 'مصروف',
        'المبلغ': tx.amount,
        'طريقة الدفع': tx.method,
        'رقم المرجع': tx.receipt || 'لا يوجد'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التقرير");

    const fileName = `تقرير_${filterMode === 'monthly' ? 'شهري' : 'سنوي'}_${filterDate.getFullYear()}${filterMode === 'monthly' ? '_' + (filterDate.getMonth() + 1) : ''}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  };

  const handleSaveTransaction = () => {
    const amt = parseFloat(newTxAmount);
    if (!amt || isNaN(amt)) {
      alert("الرجاء إدخال مبلغ صحيح");
      return;
    }

    const timestamp = new Date(newTxDate);
    timestamp.setHours(new Date().getHours(), new Date().getMinutes());

    const newTx: Transaction = {
      id: Date.now(),
      type: newTxType as TransactionType,
      catId: newTxCatId!,
      amount: amt,
      method: newTxMethod,
      receipt: newTxReceipt,
      date: timestamp.toISOString()
    };

    setTransactions(prev => [...prev, newTx]);
    closeAddModal();
  };

  const openAddModal = () => {
    setNewTxDate(new Date().toISOString().split('T')[0]);
    setAddStep(1);
    setNewTxType('');
    setNewTxCatId(null);
    setNewTxMethod('');
    setNewTxAmount('');
    setNewTxReceipt('');
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => setIsAddModalOpen(false);

  // Formatting
  let dateDisplayTitle = "";
  if (filterMode === 'daily') {
    dateDisplayTitle = filterDate.toLocaleDateString('ar-LY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } else if (filterMode === 'monthly') {
    dateDisplayTitle = filterDate.toLocaleDateString('ar-LY', { year: 'numeric', month: 'long' });
  } else {
    dateDisplayTitle = "سنة " + filterDate.getFullYear();
  }

  // Chart Data
  const chartData = [
    { name: 'إيرادات', value: totalIncome || (totalIncome === 0 && totalExpense === 0 ? 1 : 0), color: totalIncome ? '#10b981' : '#e2e8f0' },
    { name: 'مصروفات', value: totalExpense || (totalIncome === 0 && totalExpense === 0 ? 1 : 0), color: totalExpense ? '#f43f5e' : '#e2e8f0' }
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300 pb-28 selection:bg-indigo-500/30">
      
      {/* Sticky Header with Glassmorphism */}
      <header className="sticky top-0 z-30 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-md mx-auto px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
            <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2 rounded-xl">
              <Wallet size={24} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-black tracking-tight">معاملاتي</h1>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-5 pt-6">
        
        {/* Premium Dashboard Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-600/20 mb-6 relative overflow-hidden"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
              <div className="text-indigo-100/80 text-sm font-medium">الرصيد الصافي</div>
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                <Calendar size={12} />
                {filterMode === 'daily' ? 'يومي' : filterMode === 'monthly' ? 'شهري' : 'سنوي'}
              </div>
            </div>
            <div className="text-4xl font-black mb-8 tracking-tight" dir="ltr">
              {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
            </div>

            <div className="flex justify-between items-end">
              <div>
                <div className="text-indigo-100/70 text-xs flex items-center gap-1 mb-1 font-medium">
                  <div className="bg-emerald-500/20 p-0.5 rounded-full"><ArrowUp size={12} className="text-emerald-300"/></div>
                  الإيرادات
                </div>
                <div className="font-bold text-lg">{formatCurrency(totalIncome)}</div>
              </div>
              <div className="text-left">
                <div className="text-indigo-100/70 text-xs flex items-center gap-1 mb-1 font-medium justify-end">
                  <div className="bg-rose-500/20 p-0.5 rounded-full"><ArrowDown size={12} className="text-rose-300"/></div>
                  المصروفات
                </div>
                <div className="font-bold text-lg">{formatCurrency(totalExpense)}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Latest Transactions Summary */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <TrendingUp size={20} />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-0.5 truncate">أحدث إيراد</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate" dir="ltr">
                {latestIncome ? `+${formatCurrency(latestIncome.amount)}` : '-'}
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <TrendingDown size={20} />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-0.5 truncate">أحدث مصروف</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate" dir="ltr">
                {latestExpense ? `-${formatCurrency(latestExpense.amount)}` : '-'}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters & Actions */}
        <div className="flex gap-2 mb-6">
          <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 flex justify-between shadow-sm">
            {(['daily', 'monthly', 'yearly'] as FilterMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  filterMode === mode 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {mode === 'daily' ? 'اليوم' : mode === 'monthly' ? 'الشهر' : 'السنة'}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="w-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors active:scale-95"
          >
            <PieChart size={20} />
          </button>
          <button 
            onClick={exportToExcel}
            disabled={filterMode === 'daily'}
            title="تصدير إلى Excel (شهري وسنوي فقط)"
            className={`w-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center rounded-2xl shadow-sm transition-all active:scale-95 ${
              filterMode === 'daily' 
                ? 'opacity-50 cursor-not-allowed text-slate-300 dark:text-slate-600' 
                : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
            }`}
          >
            <FileSpreadsheet size={20} />
          </button>
        </div>

        {/* Date Navigator & Search */}
        <div className="space-y-3 mb-8">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm">
            <button onClick={() => changePeriod(-1)} className="p-2.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors">
              <ChevronRight size={20} />
            </button>
            <div className="flex-1 text-center font-bold text-sm text-slate-700 dark:text-slate-200">
              {dateDisplayTitle}
            </div>
            <button onClick={() => changePeriod(1)} className="p-2.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors">
              <ChevronLeft size={20} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="ابحث عن معاملة، تصنيف، أو مرجع..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pr-11 pl-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredTransactions.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] border-dashed"
              >
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Wallet size={28} />
                </div>
                <h3 className="text-slate-600 dark:text-slate-300 font-bold mb-1">لا توجد عمليات</h3>
                <p className="text-slate-400 text-sm">لم تقم بإضافة أي عمليات في هذه الفترة.</p>
              </motion.div>
            ) : (
              filteredTransactions.map((tx, i) => {
                const cat = getCategory(tx.catId);
                const Icon = cat.icon;
                const isIncome = tx.type === 'income';
                
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30, delay: i * 0.05 }}
                    key={tx.id} 
                    className="bg-white dark:bg-slate-900 rounded-2xl p-4 flex justify-between items-center shadow-sm border border-slate-200 dark:border-slate-800 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-inner ${cat.bg}`}>
                        <Icon size={22} />
                      </div>
                      <div>
                        <strong className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-0.5">
                          {cat.name}
                        </strong>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
                            {tx.receipt ? `${tx.method} #${tx.receipt}` : tx.method}
                          </span>
                          <span>•</span>
                          <span>{new Date(tx.date).toLocaleTimeString('ar-LY', {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <strong className={`text-base tracking-tight ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`} dir="ltr">
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                      </strong>
                      <button 
                        onClick={() => handleDelete(tx.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* FAB */}
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={openAddModal}
        className="fixed bottom-8 left-8 w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-600/40 z-40"
      >
        <Plus size={28} strokeWidth={2.5} />
      </motion.button>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm max-h-[85vh] overflow-y-auto p-7 rounded-[2.5rem] text-center relative shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <button 
                onClick={closeAddModal}
                className="absolute top-6 right-6 w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
              
              <h3 className="text-xl font-black mb-6 text-slate-800 dark:text-slate-100">إضافة عملية جديدة</h3>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-2xl inline-flex mb-8 border border-slate-200 dark:border-slate-700">
                <input 
                  type="date" 
                  value={newTxDate}
                  onChange={(e) => setNewTxDate(e.target.value)}
                  className="bg-transparent border-none text-slate-800 dark:text-slate-100 text-sm font-bold focus:outline-none px-3 py-1"
                />
              </div>

              <AnimatePresence mode="wait">
                {addStep === 1 && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex justify-center gap-6"
                  >
                    <div className="cursor-pointer group" onClick={() => { setNewTxType('income'); setAddStep(2); }}>
                      <div className="w-24 h-24 rounded-[2rem] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 mx-auto group-active:scale-95 transition-all border border-emerald-200 dark:border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-500/30">
                        <Plus size={36} strokeWidth={2.5} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">إيراد</span>
                    </div>
                    <div className="cursor-pointer group" onClick={() => { setNewTxType('expense'); setAddStep(2); }}>
                      <div className="w-24 h-24 rounded-[2rem] bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3 mx-auto group-active:scale-95 transition-all border border-rose-200 dark:border-rose-500/20 group-hover:bg-rose-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-rose-500/30">
                        <Minus size={36} strokeWidth={2.5} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">مصروف</span>
                    </div>
                  </motion.div>
                )}

                {addStep === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="grid grid-cols-3 gap-3"
                  >
                    {CATEGORIES.filter(c => c.type === newTxType).map(cat => {
                      const Icon = cat.icon;
                      return (
                        <div 
                          key={cat.id} 
                          onClick={() => { setNewTxCatId(cat.id); setAddStep(3); }}
                          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all group"
                        >
                          <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 transition-colors ${cat.bg} text-white`}>
                            <Icon size={20} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{cat.name}</span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}

                {addStep === 3 && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex justify-center gap-6"
                  >
                    {(newTxType === 'income' ? INCOME_METHODS : EXPENSE_METHODS).map(method => {
                      const Icon = method.icon;
                      return (
                        <div 
                          key={method.name} 
                          className="cursor-pointer group" 
                          onClick={() => { setNewTxMethod(method.name); setAddStep(4); }}
                        >
                          <div className={`w-20 h-20 rounded-[1.5rem] text-white flex items-center justify-center mb-3 mx-auto group-active:scale-95 transition-all shadow-lg ${method.color}`}>
                            <Icon size={32} />
                          </div>
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{method.name}</span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}

                {addStep === 4 && (
                  <motion.div 
                    key="step4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">د.ل</span>
                      <input 
                        type="number" 
                        placeholder="0.00" 
                        value={newTxAmount}
                        onChange={(e) => setNewTxAmount(e.target.value)}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-center text-2xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        dir="ltr"
                        autoFocus
                      />
                    </div>
                    
                    {newTxMethod === 'كاش' && (
                      <input 
                        type="text" 
                        placeholder="رقم المرجع (اختياري)" 
                        value={newTxReceipt}
                        onChange={(e) => setNewTxReceipt(e.target.value)}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                      />
                    )}
                    
                    <button 
                      onClick={handleSaveTransaction}
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 active:scale-[0.98] transition-all mt-6 shadow-lg shadow-indigo-600/30"
                    >
                      تأكيد وحفظ
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {addStep > 1 && (
                <button 
                  onClick={() => setAddStep(addStep - 1)} 
                  className="mt-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-sm transition-colors"
                >
                  الرجوع للخطوة السابقة
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm p-7 rounded-[2.5rem] text-center relative shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <h3 className="text-xl font-black mb-6 text-slate-800 dark:text-slate-100">تحليل {filterMode === 'daily' ? 'اليوم' : filterMode === 'monthly' ? 'الشهر' : 'السنة'}</h3>
              
              <div className="w-56 h-56 mx-auto relative mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius="75%"
                      outerRadius="100%"
                      dataKey="value"
                      stroke="none"
                      isAnimationActive={true}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">الصافي</span>
                  <span className={`text-xl font-black ${netBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} dir="ltr">
                    {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-8 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center py-1">
                  <span className="font-bold text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div> إجمالي الإيرادات
                  </span>
                  <span className="font-black text-emerald-500" dir="ltr">{formatCurrency(totalIncome)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="font-bold text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div> إجمالي المصروفات
                  </span>
                  <span className="font-black text-rose-500" dir="ltr">{formatCurrency(totalExpense)}</span>
                </div>
              </div>

              <button 
                onClick={() => setIsReportModalOpen(false)}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-4 rounded-2xl font-black text-lg hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition-all"
              >
                إغلاق
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copyright Footer */}
      <div className="text-center pb-8 pt-4 text-xs text-slate-400 dark:text-slate-500 font-medium" dir="ltr">
        &copy; حقوق الملكية محفوظة Dabrouzvic 2026
      </div>

    </div>
  );
}

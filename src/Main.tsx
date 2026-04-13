import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, PieChart, ChevronRight, ChevronLeft,
  ArrowUpRight, ArrowDownRight, Trash2, Plus, Minus, Utensils, Receipt,
  Bus, Home, Wifi, Handshake, Sofa, Shirt, Car, PackageOpen,
  Banknote, TrendingUp, TrendingDown, MoreHorizontal, Landmark, CreditCard,
  X, Search, Calendar, Activity, Bell, Camera, Download, AlertCircle, Globe
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { translations, categoryTranslations, Language } from './translations';

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
  merchant?: string;
  notes?: string;
  date: string;
}

interface Category {
  id: number;
  name: string;
  icon: React.ElementType;
  type: TransactionType;
}

// --- Constants ---
const CATEGORIES: Category[] = [
  { id: 1, name: "Food & Dining", icon: Utensils, type: "expense" },
  { id: 2, name: "Bills & Utilities", icon: Receipt, type: "expense" },
  { id: 3, name: "Transportation", icon: Bus, type: "expense" },
  { id: 4, name: "Housing", icon: Home, type: "expense" },
  { id: 5, name: "Internet", icon: Wifi, type: "expense" },
  { id: 6, name: "Obligations", icon: Handshake, type: "expense" },
  { id: 7, name: "Home", icon: Sofa, type: "expense" },
  { id: 8, name: "Clothing", icon: Shirt, type: "expense" },
  { id: 9, name: "Vehicle", icon: Car, type: "expense" },
  { id: 10, name: "Supplies", icon: PackageOpen, type: "expense" },
  { id: 11, name: "Salary", icon: Banknote, type: "income" },
  { id: 12, name: "Investments", icon: TrendingUp, type: "income" },
  { id: 13, name: "Other", icon: MoreHorizontal, type: "income" }
];

const INCOME_METHODS = [
  { name: 'Cash', icon: Banknote },
  { name: 'Transfer', icon: Landmark }
];

const EXPENSE_METHODS = [
  { name: 'Cash', icon: Banknote },
  { name: 'Card', icon: CreditCard }
];

// --- Helpers ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const getCategory = (id: number) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// --- Main App ---
export default function Main() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('financeflow_lang');
    return (saved as Language) || 'en';
  });
  const t = translations[lang];
  const tc = categoryTranslations[lang];

  // State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('hissabi_pro_v2026_react');
    return saved ? JSON.parse(saved) : [];
  });
  const [filterMode, setFilterMode] = useState<FilterMode>('monthly');
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Transaction State
  const [addStep, setAddStep] = useState(1);
  const [newTxType, setNewTxType] = useState<TransactionType>('expense');
  const [newTxCatId, setNewTxCatId] = useState<number | null>(null);
  const [newTxAmount, setNewTxAmount] = useState<string>('');
  const [newTxMethod, setNewTxMethod] = useState<string>('Cash');
  const [newTxReference, setNewTxReference] = useState<string>('');
  const [newTxMerchant, setNewTxMerchant] = useState<string>('');
  const [newTxNotes, setNewTxNotes] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    const saved = localStorage.getItem('financeflow_budget');
    return saved ? parseFloat(saved) : 5000;
  });

  // Effects
  useEffect(() => {
    localStorage.setItem('hissabi_pro_v2026_react', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('financeflow_budget', monthlyBudget.toString());
  }, [monthlyBudget]);

  useEffect(() => {
    localStorage.setItem('financeflow_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Derived Data
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const d = new Date(tx.date);
      if (filterMode === 'daily') {
        return d.toDateString() === filterDate.toDateString();
      } else if (filterMode === 'monthly') {
        return d.getMonth() === filterDate.getMonth() && d.getFullYear() === filterDate.getFullYear();
      } else {
        return d.getFullYear() === filterDate.getFullYear();
      }
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterMode, filterDate]);

  const { totalIncome, totalExpense } = useMemo(() => {
    let inc = 0, exp = 0;
    filteredTransactions.forEach(tx => {
      if (tx.type === 'income') inc += tx.amount;
      else exp += tx.amount;
    });
    return { totalIncome: inc, totalExpense: exp };
  }, [filteredTransactions]);

  const netBalance = totalIncome - totalExpense;

  // Budget & Trends
  const { currentMonthExpense, lastMonthExpense } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let curr = 0, last = 0;
    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      const d = new Date(tx.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) curr += tx.amount;
      if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) last += tx.amount;
    });
    return { currentMonthExpense: curr, lastMonthExpense: last };
  }, [transactions]);

  const budgetPercent = Math.min((currentMonthExpense / monthlyBudget) * 100, 100);
  const trendPercent = lastMonthExpense ? ((currentMonthExpense - lastMonthExpense) / lastMonthExpense) * 100 : 0;

  // Chart Data (Last 7 Days Cash Flow)
  const chartData = useMemo(() => {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayTxs = transactions.filter(t => t.date.startsWith(dateStr));
      const inc = dayTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const exp = dayTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      
      data.push({
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        balance: inc - exp,
        income: inc,
        expense: exp
      });
    }
    return data;
  }, [transactions]);

  // Handlers
  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise(resolve => reader.onload = resolve);
      const base64Data = (reader.result as string).split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: base64Data, mimeType: file.type } },
              { text: `Analyze this receipt and extract the following in JSON format:
                - amount (number, total amount)
                - merchant (string, name of the store)
                - reference (string, receipt or transaction number, if any)
                - categoryId (number, choose the best fit from this list: 1:Food, 2:Bills, 3:Transport, 4:Housing, 5:Internet, 6:Obligations, 7:Home, 8:Clothing, 9:Vehicle, 10:Supplies. Default to 13 if unknown)
                Return ONLY valid JSON without markdown blocks.` }
            ]
          }
        ]
      });

      const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim();
      if (text) {
        const data = JSON.parse(text);
        if (data.amount) setNewTxAmount(data.amount.toString());
        if (data.merchant) setNewTxMerchant(data.merchant);
        if (data.reference) {
          setNewTxMethod('Bank Card');
          setNewTxReference(data.reference);
        }
        if (data.categoryId) setNewTxCatId(data.categoryId);
        setNewTxType('expense');
      }
    } catch (error) {
      console.error("OCR Error:", error);
      alert(t.failedScan);
    } finally {
      setIsScanning(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Merchant', 'Amount', 'Method', 'Reference', 'Notes'];
    const rows = filteredTransactions.map(tx => [
      new Date(tx.date).toLocaleDateString(),
      tx.type,
      getCategory(tx.catId).name,
      tx.merchant || '',
      tx.amount,
      tx.method,
      tx.receipt || '',
      tx.notes || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "financeflow_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (id: number) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleQuickAdd = () => {
    const amt = parseFloat(newTxAmount);
    if (!amt || isNaN(amt) || !newTxCatId) return;
    if (newTxMethod === 'Bank Card' && !newTxReference.trim()) {
      alert(t.refRequired);
      return;
    }

    const newTx: Transaction = {
      id: Date.now(),
      type: newTxType,
      catId: newTxCatId,
      amount: amt,
      method: newTxMethod,
      receipt: newTxMethod === 'Bank Card' ? newTxReference : undefined,
      merchant: newTxMerchant.trim() || undefined,
      notes: newTxNotes.trim() || undefined,
      date: new Date().toISOString()
    };

    setTransactions(prev => [...prev, newTx]);
    closeAddModal();
  };

  const openAddModal = () => {
    setAddStep(1);
    setNewTxType('expense');
    setNewTxCatId(null);
    setNewTxAmount('');
    setNewTxMethod('Cash');
    setNewTxReference('');
    setNewTxMerchant('');
    setNewTxNotes('');
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => setIsAddModalOpen(false);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {/* Background Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px]"></div>

        <div className="absolute top-6 right-6 z-20">
          <button 
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 text-slate-300 px-4 py-2 rounded-xl transition-colors font-medium"
          >
            <Globe size={18} />
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-sm"
        >
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-emerald-400/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20 border border-emerald-500/20">
              <Activity size={40} className="text-emerald-400" strokeWidth={2.5} />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-3">{t.appName}</h1>
            <p className="text-slate-400 font-medium">{t.subtitle}</p>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6 text-center">{t.welcomeBack}</h2>
            
            <form onSubmit={(e) => { e.preventDefault(); setIsAuthenticated(true); }} className="space-y-4">
              <div>
                <input 
                  type="email" 
                  placeholder={t.email} 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50 transition-colors"
                  required
                />
              </div>
              <div>
                <input 
                  type="password" 
                  placeholder={t.password} 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50 transition-colors"
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-emerald-400 text-[#0B1120] py-4 rounded-2xl font-bold text-base hover:bg-emerald-300 active:scale-[0.98] transition-all shadow-lg mt-2"
              >
                {t.signIn}
              </button>
              <div className="text-center mt-4">
                <button type="button" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">
                  {t.createAccount}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans pb-28 selection:bg-emerald-500/30" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0B1120]/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-md mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-400/10 p-2.5 rounded-2xl">
              <Activity size={22} className="text-emerald-400" strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">{t.appName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              title={lang === 'en' ? 'العربية' : 'English'}
            >
              <Globe size={18} />
            </button>
            <button onClick={handleExportCSV} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors" title="Export CSV">
              <Download size={18} />
            </button>
            <button className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <Bell size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-6 pt-6 space-y-8">
        
        {/* Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-slate-900 rounded-[2rem] p-7 border border-slate-800 shadow-2xl overflow-hidden"
        >
          {/* Subtle glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-emerald-500/5 blur-[80px]"></div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="text-slate-400 text-sm font-medium">{t.totalBalance}</div>
              <div className="flex bg-slate-800/50 p-1 rounded-xl">
                {(['daily', 'monthly', 'yearly'] as FilterMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      filterMode === mode 
                        ? 'bg-emerald-400 text-[#0B1120] shadow-sm' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {t[mode as keyof typeof t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-4xl font-black text-white tracking-tight mb-8">
              {formatCurrency(netBalance)}
            </div>

            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-400/10 flex items-center justify-center">
                  <ArrowUpRight size={18} className="text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t.income}</div>
                  <div className="text-sm font-bold text-slate-200">{formatCurrency(totalIncome)}</div>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-800"></div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                  <ArrowDownRight size={18} className="text-slate-400" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t.expense}</div>
                  <div className="text-sm font-bold text-slate-200">{formatCurrency(totalExpense)}</div>
                </div>
              </div>
            </div>

            {/* Budget & Trends */}
            <div className="pt-6 border-t border-slate-800">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <div className="text-slate-400 text-xs font-medium mb-1">{t.monthlyBudget}</div>
                  <div className="text-sm font-bold text-white">{formatCurrency(currentMonthExpense)} <span className="text-slate-500 font-normal">/ {formatCurrency(monthlyBudget)}</span></div>
                </div>
                <div className={`text-${lang === 'ar' ? 'left' : 'right'}`}>
                  <div className="text-slate-400 text-xs font-medium mb-1">{t.vsLastMonth}</div>
                  <div className={`text-sm font-bold flex items-center justify-${lang === 'ar' ? 'start' : 'end'} gap-1 ${trendPercent > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {trendPercent > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(trendPercent).toFixed(1)}%
                  </div>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${budgetPercent >= 100 ? 'bg-rose-500' : budgetPercent >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}`} 
                  style={{ width: `${budgetPercent}%` }}
                ></div>
              </div>
              {budgetPercent >= 80 && (
                <div className={`mt-3 flex items-center gap-2 text-xs font-medium ${budgetPercent >= 100 ? 'text-rose-400' : 'text-amber-400'}`}>
                  <AlertCircle size={14} />
                  {budgetPercent >= 100 ? t.budgetExceeded : t.approachingBudget}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Cash Flow Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 shadow-lg"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white">{t.cashFlow}</h2>
            <span className="text-xs font-medium text-slate-500 bg-slate-800 px-3 py-1 rounded-full">{t.last7Days}</span>
          </div>
          <div className="h-48 w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4ADE80" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748B', fontSize: 12 }} 
                  dy={10}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '12px', color: '#F8FAFC' }}
                  itemStyle={{ color: '#4ADE80', fontWeight: 'bold' }}
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#4ADE80" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorBalance)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">{t.recentActivity}</h2>
            <button className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors">{t.viewAll}</button>
          </div>
          
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredTransactions.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-10 bg-slate-900/50 rounded-[2rem] border border-slate-800/50 border-dashed"
                >
                  <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-500">
                    <Wallet size={20} />
                  </div>
                  <p className="text-slate-400 text-sm">{t.noTransactions}</p>
                </motion.div>
              ) : (
                filteredTransactions.slice(0, 5).map((tx, i) => {
                  const cat = getCategory(tx.catId);
                  const Icon = cat.icon;
                  const isIncome = tx.type === 'income';
                  
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.05 }}
                      key={tx.id} 
                      className="bg-slate-900 rounded-2xl p-4 flex justify-between items-center border border-slate-800 group hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300">
                          <Icon size={20} />
                        </div>
                        <div>
                          <strong className="block text-sm font-bold text-slate-200 mb-0.5">
                            {tx.merchant || tc[cat.name as keyof typeof tc]}
                          </strong>
                          <div className="text-xs text-slate-500 font-medium">
                            {new Date(tx.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                            {tx.notes && ` • ${tx.notes}`}
                          </div>
                        </div>
                      </div>
                      <div className={`flex flex-col items-${lang === 'ar' ? 'start' : 'end'} gap-1`}>
                        <strong className={`text-sm font-bold ${isIncome ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </strong>
                        <button 
                          onClick={() => handleDelete(tx.id)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          {t.delete}
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>

      {/* Frictionless Quick Add FAB */}
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={openAddModal}
        className={`fixed bottom-8 ${lang === 'ar' ? 'right-1/2 translate-x-1/2' : 'left-1/2 -translate-x-1/2'} px-6 py-4 bg-emerald-400 text-[#0B1120] rounded-full flex items-center gap-2 shadow-[0_8px_30px_rgb(52,211,153,0.3)] z-40 font-bold tracking-wide`}
      >
        <Plus size={20} strokeWidth={3} />
        <span>{t.quickAdd}</span>
      </motion.button>

      {/* Quick Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0B1120]/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4 pb-0 sm:pb-4"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-slate-900 w-full max-w-md p-6 sm:p-8 rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-slate-800 shadow-2xl relative"
            >
              <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-6 sm:hidden"></div>
              
              <button 
                onClick={closeAddModal}
                className={`absolute top-6 ${lang === 'ar' ? 'left-6' : 'right-6'} w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors`}
              >
                <X size={16} />
              </button>
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">{t.newTransaction}</h3>
                <label className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-500/20 transition-colors">
                  {isScanning ? <Activity size={14} className="animate-spin" /> : <Camera size={14} />}
                  {isScanning ? t.scanning : t.aiScan}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanReceipt} disabled={isScanning} />
                </label>
              </div>
              
              {/* Amount Input */}
              <div className="mb-8 relative">
                <span className={`absolute ${lang === 'ar' ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 text-slate-500 text-3xl font-light`}>$</span>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={newTxAmount}
                  onChange={(e) => setNewTxAmount(e.target.value)}
                  className={`w-full bg-transparent border-none text-white text-5xl font-black focus:outline-none ${lang === 'ar' ? 'pr-10' : 'pl-10'} py-2 placeholder:text-slate-800`}
                  autoFocus
                />
              </div>

              {/* Type Toggle */}
              <div className="flex bg-slate-800/50 p-1 rounded-2xl mb-6">
                <button 
                  onClick={() => setNewTxType('expense')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${newTxType === 'expense' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'}`}
                >
                  {t.expense}
                </button>
                <button 
                  onClick={() => setNewTxType('income')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${newTxType === 'income' ? 'bg-emerald-400 text-[#0B1120] shadow-sm' : 'text-slate-500'}`}
                >
                  {t.income}
                </button>
              </div>

              {/* Category Selection */}
              <div className="mb-8">
                <div className="text-xs font-medium text-slate-500 mb-3">{t.selectCategory}</div>
                <div className="grid grid-cols-4 gap-3">
                  {CATEGORIES.filter(c => c.type === newTxType).slice(0, 8).map(cat => {
                    const Icon = cat.icon;
                    const isSelected = newTxCatId === cat.id;
                    return (
                      <button 
                        key={cat.id} 
                        onClick={() => setNewTxCatId(cat.id)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                          isSelected 
                            ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' 
                            : 'bg-slate-800/30 border-transparent text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="text-[10px] font-bold truncate w-full text-center">{tc[cat.name as keyof typeof tc]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-8">
                <div className="text-xs font-medium text-slate-500 mb-3">{t.paymentMethod}</div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setNewTxMethod('Cash'); setNewTxReference(''); }}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${newTxMethod === 'Cash' ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' : 'bg-slate-800/30 border-transparent text-slate-400 hover:bg-slate-800'}`}
                  >
                    {t.cash}
                  </button>
                  <button 
                    onClick={() => setNewTxMethod('Bank Card')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${newTxMethod === 'Bank Card' ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' : 'bg-slate-800/30 border-transparent text-slate-400 hover:bg-slate-800'}`}
                  >
                    {t.bankCard}
                  </button>
                </div>
                
                <AnimatePresence>
                  {newTxMethod === 'Bank Card' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <input 
                        type="text" 
                        placeholder={t.referenceNumber} 
                        value={newTxReference}
                        onChange={(e) => setNewTxReference(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50 transition-colors"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Details */}
              <div className="mb-8 space-y-3">
                <input 
                  type="text" 
                  placeholder={t.merchantTitle} 
                  value={newTxMerchant}
                  onChange={(e) => setNewTxMerchant(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50 transition-colors"
                />
                <textarea 
                  placeholder={t.notesOptional} 
                  value={newTxNotes}
                  onChange={(e) => setNewTxNotes(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50 transition-colors resize-none h-20"
                />
              </div>
              
              <button 
                onClick={handleQuickAdd}
                disabled={!newTxAmount || !newTxCatId || (newTxMethod === 'Bank Card' && !newTxReference.trim())}
                className="w-full bg-emerald-400 text-[#0B1120] py-4 rounded-2xl font-bold text-lg hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {t.saveEntry}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

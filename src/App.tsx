import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Bitcoin,
  BarChart3,
  Info,
  RefreshCw,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { getMNAVInsights } from "./services/geminiService";

// Data fetching and calculation
async function fetchAllData() {
  try {
    const [stockRes, btcRes, btcHistoryRes, holdingsRes] = await Promise.all([
      fetch("/api/mstr-stock").then((r) => r.json()),
      fetch("/api/btc-price").then((r) => r.json()),
      fetch("/api/btc-history").then((r) => r.json()),
      fetch("/api/mstr-holdings").then((r) => r.json()),
    ]);

    const timestamps = stockRes.chart.result[0].timestamp;
    const quotes = stockRes.chart.result[0].indicators.quote[0].close;
    const btcPrice = btcRes.bitcoin.usd;
    const btcChange = btcRes.bitcoin.usd_24h_change;
    const btcHeld = holdingsRes.totalBitcoinHeld || 766970;
    const sharesOutstanding = 379425000; // ADSO from strategy.com

    // Create a map of date -> btcPrice for lookup
    const btcPriceMap = new Map();
    btcHistoryRes.prices.forEach(([ts, price]: [number, number]) => {
      const dateStr = format(new Date(ts), "MMM dd");
      btcPriceMap.set(dateStr, price);
    });

    const chartData = timestamps.map((ts: number, i: number) => {
      const date = new Date(ts * 1000);
      const dateStr = format(date, "MMM dd");
      const mstrPrice = quotes[i];
      if (!mstrPrice) return null;

      // Use historical BTC price if available, otherwise fallback to current
      const historicalBtcPrice = btcPriceMap.get(dateStr) || btcPrice;
      const nav = (btcHeld * historicalBtcPrice) / sharesOutstanding;
      const mnav = mstrPrice / nav;

      return {
        date: dateStr,
        timestamp: ts * 1000,
        mstr: mstrPrice,
        btc: historicalBtcPrice,
        nav: Number(nav.toFixed(2)),
        mnav: Number(mnav.toFixed(2)),
      };
    }).filter(Boolean);

    const mstrQuotes = quotes.filter((q: number | null) => q !== null);
    const mstrChange = mstrQuotes.length >= 2 
      ? ((mstrQuotes[mstrQuotes.length - 1] - mstrQuotes[mstrQuotes.length - 2]) / mstrQuotes[mstrQuotes.length - 2]) * 100 
      : 0;

    const currentNav = (btcHeld * btcPrice) / sharesOutstanding;

    return {
      chartData,
      currentMstr: quotes[quotes.length - 1],
      mstrChange,
      currentBtc: btcPrice,
      btcChange,
      btcHeld,
      currentNav,
      mnav: quotes[quotes.length - 1] / currentNav,
    };
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string>("");
  const [generatingInsights, setGeneratingInsights] = useState(false);
  
  // Table state
  const [filterText, setFilterText] = useState("");
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>({
    field: 'date',
    direction: 'desc'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchAllData();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const generateAIInsights = async () => {
    if (!data) return;
    setGeneratingInsights(true);
    try {
      const insightsText = await getMNAVInsights(data);
      setInsights(insightsText || "No insights generated.");
    } catch (err) {
      setInsights("Failed to generate insights.");
    } finally {
      setGeneratingInsights(false);
    }
  };

  const handleSort = (field: string) => {
    setSortConfig(prev => {
      if (prev?.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'desc' };
    });
  };

  const sortedData = useMemo(() => {
    if (!data?.chartData) return [];
    
    let filtered = data.chartData.filter((item: any) => 
      item.date.toLowerCase().includes(filterText.toLowerCase())
    );

    if (sortConfig) {
      filtered = [...filtered].sort((a: any, b: any) => {
        let valA = a[sortConfig.field];
        let valB = b[sortConfig.field];
        
        if (sortConfig.field === 'date') {
          valA = a.timestamp;
          valB = b.timestamp;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, filterText, sortConfig]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-200">
        <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-lg font-medium animate-pulse">Fetching Financial Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="text-blue-500" />
            MSTR mNAV Tracker
          </h1>
          <p className="text-slate-400 mt-1">MicroStrategy Digital Asset Treasury Analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadData}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-medium">
            Live Updates
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Summary Grid */}
        <div className="space-y-4">
          {/* Row 1: Bitcoin Price (Featured) */}
          <div className="w-full">
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Bitcoin className="w-24 h-24 text-orange-400 rotate-12" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Bitcoin Market Price</span>
                  <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
                    <Bitcoin className="text-orange-400 w-6 h-6" />
                  </div>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                    ${data.currentBtc.toLocaleString()}
                  </span>
                  {data.btcChange !== undefined && (
                    <span className={cn(
                      "text-lg font-medium flex items-center",
                      data.btcChange >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {data.btcChange >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      {Math.abs(data.btcChange).toFixed(2)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">Real-time BTC/USD spot price</p>
              </div>
            </div>
          </div>
          
          {/* Row 2: Other Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="MSTR Price" 
              value={`$${data.currentMstr.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={<TrendingUp className="text-blue-400" />}
              trend={data.mstrChange}
            />
            <StatCard 
              title="BTC Holdings" 
              value={data.btcHeld.toLocaleString()}
              icon={<Info className="text-slate-400" />}
              subValue="Total BTC"
            />
            <StatCard 
              title="NAV per Share" 
              value={`$${data.currentNav.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={<BarChart3 className="text-green-400" />}
              subValue="BTC Value per MSTR"
            />
            <StatCard 
              title="Current mNAV" 
              value={data.mnav.toFixed(2)}
              icon={<Cpu className="text-purple-400" />}
              subValue={data.mnav > 1 ? "Premium" : "Discount"}
              highlight={data.mnav > 1 ? "text-orange-400" : "text-green-400"}
            />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Chart & Table */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chart Section */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">mNAV Trend (30D)</h2>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-slate-400">mNAV Ratio</span>
                  </div>
                </div>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chartData}>
                    <defs>
                      <linearGradient id="colorMnav" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg shadow-xl">
                              <p className="text-slate-400 text-xs mb-2 font-medium">{label}</p>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-slate-500 text-xs">mNAV Ratio:</span>
                                  <span className="text-blue-400 font-bold">{payload[0].value}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-slate-500 text-xs">MSTR Price:</span>
                                  <span className="text-slate-200 font-medium">${payload[0].payload.mstr.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-slate-500 text-xs">NAV per Share:</span>
                                  <span className="text-green-400 font-medium">${payload[0].payload.nav.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="mnav" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorMnav)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Data Table Section */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-white">Historical Data</h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="text"
                    placeholder="Filter by date..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                      <SortableHeader label="Date" field="date" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableHeader label="MSTR Price" field="mstr" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableHeader label="BTC Price" field="btc" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableHeader label="NAV per Share" field="nav" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableHeader label="mNAV Ratio" field="mnav" sortConfig={sortConfig} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sortedData.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-300 font-medium">{row.date}</td>
                        <td className="px-6 py-4 text-sm text-slate-200">${row.mstr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-sm text-slate-200">${row.btc.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-slate-200">${row.nav.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-semibold",
                            row.mnav > 1 ? "bg-orange-500/10 text-orange-400" : "bg-green-500/10 text-green-400"
                          )}>
                            {row.mnav.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {sortedData.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm italic">
                          No matching records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: AI Insights Panel */}
          <div className="lg:sticky lg:top-8 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col max-h-[calc(100vh-4rem)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-400" />
                AI Insights
              </h2>
              <button 
                onClick={generateAIInsights}
                disabled={generatingInsights}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  generatingInsights 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                    : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
                )}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", generatingInsights && "animate-spin")} />
                {generatingInsights ? "Regenerating..." : insights ? "Refresh" : "Generate"}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              {generatingInsights ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
                  <p className="text-sm text-slate-400">Analyzing market trends...</p>
                </div>
              ) : insights ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{insights}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                    <Info className="w-6 h-6 text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-400 px-4">
                    Click generate to get an AI-powered analysis of MicroStrategy's current valuation.
                  </p>
                  <button 
                    onClick={generateAIInsights}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20"
                  >
                    Generate Analysis
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
        <p>© 2026 DAT.co Analytics Platform. Data sourced from Yahoo Finance & Strategy.com.</p>
      </footer>
    </div>
  );
}

function StatCard({ title, value, icon, trend, subValue, highlight }: any) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl hover:border-slate-700 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-bold text-white", highlight)}>{value}</span>
        {trend !== undefined && (
          <span className={cn(
            "text-xs font-medium flex items-center",
            trend >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
    </div>
  );
}

function SortableHeader({ label, field, sortConfig, onSort }: any) {
  const isActive = sortConfig?.field === field;
  
  return (
    <th 
      className="px-6 py-4 cursor-pointer hover:text-white transition-colors group"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-2">
        {label}
        <div className={cn(
          "transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
        )}>
          {isActive ? (
            sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3" />
          )}
        </div>
      </div>
    </th>
  );
}

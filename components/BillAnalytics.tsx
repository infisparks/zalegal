'use client';

import { useState, useEffect, useMemo } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  DollarSign,
  Calendar,
  BarChart3,
  Loader2,
  FileText,
  Wallet, // For payments
} from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isToday, format, parseISO, startOfYear, endOfYear } from 'date-fns';

// --- INTERFACES ---
interface Payment {
  amount: number;
  method: 'Cash' | 'Online' | '';
  date: string;
}

interface CaseData {
  id: string;
  date: string;
  totalAmount: number; // Total billed amount for the case
  caseDescription: string;
  billNumber: string;
  payments?: Payment[]; // Optional array of payments
  paidAmount?: number; // Calculated total paid for this case
  remainingAmount?: number; // Calculated remaining for this case
}

type TimeFilter = 'today' | 'week' | 'month' | 'year' | 'all'; // Added 'year' filter

export function BillAnalytics() {
  const [allCases, setAllCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month'); // Default to month for a more immediate view

  // Helper function to safely parse dates that might be in non-standard formats.
  const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    try {
      // Attempt to parse ISO string first (e.g., "YYYY-MM-DD")
      let date = parseISO(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
      // Fallback for DD/MM/YYYY or DD-MM-YYYY
      const parts = dateString.split(/[-/]/);
      if (parts.length === 3) {
        const [day, month, year] = parts;
        // Note: The month argument in new Date() is 0-indexed (0-11)
        date = new Date(Number(year), Number(month) - 1, Number(day));
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // --- DATA FETCHING ---
  useEffect(() => {
    const casesRef = ref(database, 'cases');
    const unsubscribe = onValue(casesRef, (snapshot) => {
      const data = snapshot.val();
      const casesArray: CaseData[] = data
        ? Object.entries(data).map(([id, caseData]: [string, any]) => {
            const payments = caseData.payments || [];
            const paidAmount = payments.reduce((sum: number, p: Payment) => sum + p.amount, 0);
            const totalAmount = caseData.totalAmount || 0;
            return {
              id,
              ...caseData,
              payments: payments, // Ensure payments array exists
              paidAmount: paidAmount, // Calculate paid amount
              remainingAmount: totalAmount - paidAmount, // Calculate remaining amount
            };
          })
        : [];
      setAllCases(casesArray);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- FILTERING & STATS CALCULATION LOGIC ---
  const filteredData = useMemo(() => {
    const now = new Date();
    let casesForPeriod = allCases;

    if (timeFilter !== 'all') {
      casesForPeriod = allCases.filter(c => {
        const caseDate = parseDate(c.date);
        if (!caseDate) return false;

        if (timeFilter === 'today') return isToday(caseDate);
        if (timeFilter === 'week') return isWithinInterval(caseDate, { start: startOfWeek(now), end: endOfWeek(now) });
        if (timeFilter === 'month') return isWithinInterval(caseDate, { start: startOfMonth(now), end: endOfMonth(now) });
        if (timeFilter === 'year') return isWithinInterval(caseDate, { start: startOfYear(now), end: endOfYear(now) });
        return false;
      });
    }

    const totalBilled = casesForPeriod.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
    const totalPaid = casesForPeriod.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
    const totalRemaining = totalBilled - totalPaid; // Recalculate based on filtered billed and paid

    const stats = {
      totalBilled: totalBilled,
      totalCases: casesForPeriod.length,
      totalPaymentsReceived: totalPaid,
      totalRemainingAmount: totalRemaining,
    };

    // Sort cases by date descending for display
    casesForPeriod.sort((a, b) => {
      const dateA = parseDate(a.date)?.getTime() || 0;
      const dateB = parseDate(b.date)?.getTime() || 0;
      return dateB - dateA;
    });

    return { filteredCases: casesForPeriod, stats };
  }, [allCases, timeFilter]);

  // --- CHART DATA GENERATION ---
  const chartData = useMemo(() => {
    const dataMap = new Map<string, { billed: number; paid: number; dateForSort?: Date }>();

    filteredData.filteredCases.forEach(c => {
      const caseDate = parseDate(c.date);
      if (!caseDate) return;

      let key = '';
      let sortDate: Date | undefined;

      if (timeFilter === 'today') {
        key = format(caseDate, 'HH:00'); // Group by hour
        sortDate = caseDate;
      } else if (timeFilter === 'week') {
        key = format(caseDate, 'EEE'); // Group by day of week
        sortDate = caseDate; // Use caseDate for sorting, but map to name for display
      } else if (timeFilter === 'month') {
        key = format(caseDate, 'dd MMM'); // Group by day
        sortDate = caseDate;
      } else if (timeFilter === 'year') {
        key = format(caseDate, 'MMM'); // Group by month
        sortDate = caseDate;
      } else { // 'all'
        key = format(caseDate, 'MMM yyyy'); // Group by month and year
        sortDate = caseDate;
      }

      const currentData = dataMap.get(key) || { billed: 0, paid: 0, dateForSort: sortDate };
      dataMap.set(key, {
        billed: currentData.billed + (c.totalAmount || 0),
        paid: currentData.paid + (c.paidAmount || 0),
        dateForSort: currentData.dateForSort || sortDate // Keep the first date encountered for sorting consistency
      });
    });

    let dataArray = Array.from(dataMap, ([name, values]) => ({ name, billed: values.billed, paid: values.paid, dateForSort: values.dateForSort }));

    // Robust sorting by actual date
    dataArray.sort((a, b) => {
        if (a.dateForSort && b.dateForSort) {
            return a.dateForSort.getTime() - b.dateForSort.getTime();
        }
        return 0; // Maintain original order if dates are invalid
    });
    
    // For 'week' filter, ensure standard day order
    if (timeFilter === 'week') {
      const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      dataArray.sort((a, b) => dayOrder.indexOf(a.name) - dayOrder.indexOf(b.name));
    } else if (timeFilter === 'year') { // For month names, ensure chronological order
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dataArray.sort((a,b) => monthOrder.indexOf(a.name) - monthOrder.indexOf(b.name));
    }


    return dataArray;
  }, [filteredData.filteredCases, timeFilter]);

  // --- UTILITY FUNCTIONS ---
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount || 0);

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return 'Invalid Date'; }
  };

  // --- RENDER LOGIC ---
  if (loading) {
    return <div className="text-center py-12 text-white/80 flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin"/>Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-white/95 shadow-lg">
        <CardContent className="p-4 flex flex-wrap gap-2 justify-center">
          {(['today', 'week', 'month', 'year', 'all'] as TimeFilter[]).map(filter => (
            <Button
              key={filter}
              variant={timeFilter === filter ? 'default' : 'outline'}
              onClick={() => setTimeFilter(filter)}
              className={timeFilter === filter ? 'bg-[#CAA068] hover:bg-[#B8A799] text-white' : 'border-[#CAA068] text-[#2B2F32] hover:bg-[#CAA068] hover:text-white'}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/95 border-l-4 border-l-[#CAA068] shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Billed ({timeFilter === 'all' ? 'All Time' : `This ${timeFilter}`})</CardTitle>
            <DollarSign className="h-5 w-5 text-gray-500"/>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2B2F32]">{formatCurrency(filteredData.stats.totalBilled)}</div>
            <p className="text-xs text-muted-foreground">Sum of all billed amounts</p>
          </CardContent>
        </Card>

        <Card className="bg-white/95 border-l-4 border-l-green-600 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Payments Received ({timeFilter === 'all' ? 'All Time' : `This ${timeFilter}`})</CardTitle>
            <Wallet className="h-5 w-5 text-gray-500"/>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{formatCurrency(filteredData.stats.totalPaymentsReceived)}</div>
            <p className="text-xs text-muted-foreground">Sum of all payments received</p>
          </CardContent>
        </Card>

        <Card className="bg-white/95 border-l-4 border-l-red-600 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Amount Remaining ({timeFilter === 'all' ? 'All Time' : `This ${timeFilter}`})</CardTitle>
            <DollarSign className="h-5 w-5 text-gray-500"/>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">{formatCurrency(filteredData.stats.totalRemainingAmount)}</div>
            <p className="text-xs text-muted-foreground">Total outstanding balance</p>
          </CardContent>
        </Card>

        <Card className="bg-white/95 border-l-4 border-l-[#B8A799] shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Cases ({timeFilter === 'all' ? 'All Time' : `This ${timeFilter}`})</CardTitle>
            <FileText className="h-5 w-5 text-gray-500"/>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2B2F32]">{filteredData.stats.totalCases}</div>
            <p className="text-xs text-muted-foreground">Number of cases in period</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-white/95 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#2B2F32]"><BarChart3/>Financial Overview</CardTitle>
          <CardDescription>Billed vs. Paid amounts for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${(Number(value)/1000).toLocaleString()}k`}/>
              <Tooltip
                formatter={(value, name) => [`${formatCurrency(Number(value))}`, name === 'billed' ? 'Billed Amount' : 'Paid Amount']}
                cursor={{ fill: 'rgba(202, 160, 104, 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar dataKey="billed" fill="#CAA068" radius={[4, 4, 0, 0]} name="Billed Amount"/>
              <Bar dataKey="paid" fill="#4CAF50" radius={[4, 4, 0, 0]} name="Paid Amount"/>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Case List for selected period */}
      <Card className="bg-white/95 shadow-lg">
        <CardHeader>
            <CardTitle className="text-[#2B2F32]">Cases in Current View ({filteredData.filteredCases.length})</CardTitle>
            <CardDescription>Detailed list of cases for the selected time filter.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-3">
                {filteredData.filteredCases.length > 0 ? filteredData.filteredCases.map(caseItem => (
                    <div key={caseItem.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div className="mb-2 md:mb-0">
                            <p className="font-semibold text-lg text-[#2B2F32]">{caseItem.caseDescription}</p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                <Badge variant="outline" className="bg-gray-100 text-gray-700">Bill No: {caseItem.billNumber}</Badge>
                                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-gray-500"/>{formatDateDisplay(caseItem.date)}</span>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <p className="font-bold text-[#CAA068] text-xl">Billed: {formatCurrency(caseItem.totalAmount)}</p>
                            {caseItem.paidAmount !== undefined && caseItem.paidAmount > 0 && (
                                <p className="text-sm text-green-700 font-medium">Paid: {formatCurrency(caseItem.paidAmount)}</p>
                            )}
                            {caseItem.remainingAmount !== undefined && caseItem.remainingAmount > 0 && (
                                <p className="text-sm text-red-700 font-medium">Due: {formatCurrency(caseItem.remainingAmount)}</p>
                            )}
                            {caseItem.remainingAmount !== undefined && caseItem.remainingAmount <= 0 && (
                                <p className="text-sm text-blue-700 font-medium">Fully Paid</p>
                            )}
                        </div>
                    </div>
                )) : <p className="text-center py-8 text-muted-foreground">No cases found for this period. Try adjusting your filter.</p>}
            </div>
        </CardContent>
      </Card>

    </div>
  );
}
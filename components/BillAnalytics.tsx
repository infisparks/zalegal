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
} from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isToday, format } from 'date-fns';

// --- INTERFACES ---
interface CaseData {
  id: string;
  date: string;
  totalAmount: number;
  caseDescription: string;
  billNumber: string;
}

type TimeFilter = 'today' | 'week' | 'month' | 'all';

export function BillAnalytics() {
  const [allCases, setAllCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // --- DATA FETCHING ---
  useEffect(() => {
    const casesRef = ref(database, 'cases');
    const unsubscribe = onValue(casesRef, (snapshot) => {
      const data = snapshot.val();
      const casesArray: CaseData[] = data
        ? Object.entries(data).map(([id, caseData]: [string, any]) => ({
            id,
            ...caseData,
          }))
        : [];
      setAllCases(casesArray);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- FILTERING & CALCULATION LOGIC ---
  const filteredData = useMemo(() => {
    const now = new Date();
    let filteredCases = allCases;

    if (timeFilter !== 'all') {
      filteredCases = allCases.filter(c => {
        try {
          const caseDate = new Date(c.date);
          if (timeFilter === 'today') return isToday(caseDate);
          if (timeFilter === 'week') return isWithinInterval(caseDate, { start: startOfWeek(now), end: endOfWeek(now) });
          if (timeFilter === 'month') return isWithinInterval(caseDate, { start: startOfMonth(now), end: endOfMonth(now) });
          return false;
        } catch {
            return false;
        }
      });
    }
    
    const stats = {
        totalRevenue: filteredCases.reduce((sum, c) => sum + c.totalAmount, 0),
        totalCases: filteredCases.length,
    };
    
    // Sort cases by date for display
    filteredCases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { filteredCases, stats };
  }, [allCases, timeFilter]);

  const chartData = useMemo(() => {
    const dataMap = new Map<string, number>();
    
    filteredData.filteredCases.forEach(c => {
      try {
        const date = new Date(c.date);
        let key = '';
        if (timeFilter === 'today') key = format(date, 'HH:00'); // Group by hour
        else if (timeFilter === 'week') key = format(date, 'EEE'); // Group by day of week
        else if (timeFilter === 'month') key = format(date, 'dd MMM'); // Group by day
        else key = format(date, 'MMM yyyy'); // Group by month

        dataMap.set(key, (dataMap.get(key) || 0) + c.totalAmount);
      } catch {}
    });
    
    return Array.from(dataMap, ([name, amount]) => ({ name, amount })).reverse();
  }, [filteredData.filteredCases, timeFilter]);

  // --- UTILITY FUNCTIONS ---
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount || 0);

  const formatDate = (dateString: string) => {
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
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'all'] as TimeFilter[]).map(filter => (
              <Button
                key={filter}
                variant={timeFilter === filter ? 'default' : 'outline'}
                onClick={() => setTimeFilter(filter)}
                className={timeFilter === filter ? 'bg-[#CAA068] hover:bg-[#B8A799]' : ''}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-[#CAA068]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue ({timeFilter === 'all' ? 'All Time' : `This ${timeFilter}`})</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(filteredData.stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Total amount from filtered cases</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#B8A799]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cases ({timeFilter === 'all' ? 'All Time' : `This ${timeFilter}`})</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredData.stats.totalCases}</div>
            <p className="text-xs text-muted-foreground">Total number of filtered cases</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3/>Billing Overview</CardTitle>
          <CardDescription>Visual representation of revenue for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value)/1000}k`}/>
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} cursor={{ fill: 'rgba(202, 160, 104, 0.1)' }}/>
                    <Legend />
                    <Bar dataKey="amount" fill="#CAA068" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Case List for selected period */}
      <Card>
        <CardHeader>
            <CardTitle>Filtered Cases ({filteredData.filteredCases.length})</CardTitle>
            <CardDescription>All cases matching the selected time period.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-3">
                {filteredData.filteredCases.length > 0 ? filteredData.filteredCases.map(caseItem => (
                    <div key={caseItem.id} className="p-3 bg-gray-50 border rounded-md flex justify-between items-center">
                        <div>
                            <p className="font-semibold">{caseItem.caseDescription}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <Badge variant="outline">Bill: {caseItem.billNumber}</Badge>
                                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3"/>{formatDate(caseItem.date)}</span>
                            </div>
                        </div>
                        <div className="font-bold text-[#CAA068]">
                            {formatCurrency(caseItem.totalAmount)}
                        </div>
                    </div>
                )) : <p className="text-center py-8 text-muted-foreground">No cases found for this period.</p>}
            </div>
        </CardContent>
      </Card>

    </div>
  );
}

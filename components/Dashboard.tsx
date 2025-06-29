'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  FileText,
  BarChart3,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  Wallet // New icon for payments
} from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';

// --- INTERFACES ---
interface Payment {
  amount: number;
  method: 'Cash' | 'Online' | '';
  date: string;
}

interface CaseData {
  id: string;
  billNumber: string;
  caseNumber: string;
  caseDescription: string;
  date: string;
  totalAmount: number;
  particulars: any[];
  payments: Payment[]; // Added for payments
  paidAmount: number; // Added for total paid
  remainingAmount: number; // Added for remaining amount
}

export function Dashboard() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCases: 0,
    totalAmount: 0,
    thisMonthCases: 0,
    thisMonthAmount: 0,
    totalPaymentsReceived: 0, // New stat
    thisMonthPaymentsReceived: 0, // New stat
  });

  // Helper function to safely parse dates that might be in non-standard formats.
  const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;

    // First, try parsing directly, which works for ISO formats (YYYY-MM-DD)
    let date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // If it fails, try parsing formats like DD/MM/YYYY or DD-MM-YYYY
    const parts = dateString.split(/[-/]/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      // Note: The month argument in new Date() is 0-indexed (0-11)
      date = new Date(Number(year), Number(month) - 1, Number(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Return null if parsing fails, to avoid crashes
    return null;
  };

  useEffect(() => {
    const casesRef = ref(database, 'cases');
    const unsubscribe = onValue(casesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const casesArray = Object.entries(data).map(([id, caseData]: [string, any]) => {
          const payments = caseData.payments || [];
          const paidAmount = payments.reduce((sum: number, p: Payment) => sum + p.amount, 0);
          const totalAmount = caseData.totalAmount || 0; // Ensure totalAmount exists
          return {
            id,
            ...caseData,
            particulars: caseData.particulars || [],
            payments: payments,
            paidAmount: paidAmount,
            remainingAmount: totalAmount - paidAmount,
          };
        });
        
        // Sort cases by date descending to show the most recent ones first
        const sortedCases = casesArray.sort((a, b) => {
            const dateA = parseDate(a.date)?.getTime() || 0;
            const dateB = parseDate(b.date)?.getTime() || 0;
            return dateB - dateA;
        });

        setCases(sortedCases);
        calculateStats(sortedCases);
      } else {
        setCases([]);
        setStats({
          totalCases: 0,
          totalAmount: 0,
          thisMonthCases: 0,
          thisMonthAmount: 0,
          totalPaymentsReceived: 0,
          thisMonthPaymentsReceived: 0,
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const calculateStats = (casesData: CaseData[]) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    let totalPaymentsReceived = 0;
    let thisMonthPaymentsReceived = 0;

    const thisMonthCases = casesData.filter(caseItem => {
      const caseDate = parseDate(caseItem.date); // Use the safe parser
      return caseDate && caseDate.getMonth() === currentMonth && caseDate.getFullYear() === currentYear;
    });

    casesData.forEach(caseItem => {
      if (caseItem.payments) {
        caseItem.payments.forEach(payment => {
          totalPaymentsReceived += payment.amount;
          const paymentDate = parseDate(payment.date);
          if (paymentDate && paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
            thisMonthPaymentsReceived += payment.amount;
          }
        });
      }
    });

    setStats({
      totalCases: casesData.length,
      totalAmount: casesData.reduce((sum, caseItem) => sum + (caseItem.totalAmount || 0), 0),
      thisMonthCases: thisMonthCases.length,
      thisMonthAmount: thisMonthCases.reduce((sum, caseItem) => sum + (caseItem.totalAmount || 0), 0),
      totalPaymentsReceived: totalPaymentsReceived,
      thisMonthPaymentsReceived: thisMonthPaymentsReceived,
    });
  };

  const getChartData = () => {
    const monthlyData: { [key: string]: { month: string, amount: number, cases: number } } = {};
    
    cases.forEach(caseItem => {
      const date = parseDate(caseItem.date); // Use the safe parser
      if (!date) return; // Skip if the date is invalid

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthName, amount: 0, cases: 0 };
      }
      
      monthlyData[monthKey].amount += caseItem.totalAmount || 0;
      monthlyData[monthKey].cases += 1;
    });

    // Sort by key (YYYY-MM) and then get the last 6 months
    return Object.keys(monthlyData)
        .sort()
        .slice(-6)
        .map(key => monthlyData[key]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const chartData = getChartData();

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Adjusted grid-cols */}
        <Button
          onClick={() => router.push('/case-entry')}
          className="h-20 bg-[#CAA068] hover:bg-[#B8A799] text-white flex flex-col items-center justify-center space-y-2"
        >
          <Plus className="h-6 w-6" />
          <span className="font-medium">Add Case Entry</span>
        </Button>
        
        {/* Removed "Search Cases" button */}
        
        <Button
          onClick={() => router.push('/bill-detail')} // Assuming /bill-analytics is for detailed charts/stats
          variant="outline"
          className="h-20 border-[#CAA068] text-[#2B2F32] hover:bg-[#CAA068] hover:text-white flex flex-col items-center justify-center space-y-2"
        >
          <BarChart3 className="h-6 w-6" />
          <span className="font-medium">Bill Analytics</span>
        </Button>
        
        <Button
          onClick={() => router.push('/bill-detail')}
          variant="outline"
          className="h-20 border-[#CAA068] text-[#2B2F32] hover:bg-[#CAA068] hover:text-white flex flex-col items-center justify-center space-y-2"
        >
          <FileText className="h-6 w-6" />
          <span className="font-medium">All Cases</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-[#CAA068]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#2B2F32]/60">Total Cases</p>
                <p className="text-3xl font-bold text-[#2B2F32]">{stats.totalCases}</p>
              </div>
              <FileText className="h-8 w-8 text-[#CAA068]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-l-4 border-l-[#B8A799]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#2B2F32]/60">Total Bill Amount</p> {/* Changed title */}
                <p className="text-2xl font-bold text-[#2B2F32]">{formatCurrency(stats.totalAmount)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-[#B8A799]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-l-4 border-l-[#CAA068]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#2B2F32]/60">Total Payments Received</p> {/* New Stat */}
                <p className="text-2xl font-bold text-[#2B2F32]">{formatCurrency(stats.totalPaymentsReceived)}</p>
              </div>
              <Wallet className="h-8 w-8 text-[#CAA068]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-l-4 border-l-[#B8A799]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#2B2F32]/60">This Month Payments</p> {/* New Stat */}
                <p className="text-2xl font-bold text-[#2B2F32]">{formatCurrency(stats.thisMonthPaymentsReceived)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-[#B8A799]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-[#2B2F32]">Monthly Revenue</CardTitle>
            <CardDescription>Revenue trend over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Amount']} />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#CAA068" 
                  strokeWidth={3}
                  dot={{ fill: '#CAA068', strokeWidth: 2, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-[#2B2F32]">Monthly Cases</CardTitle>
            <CardDescription>Number of cases over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="cases" fill="#B8A799" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Cases */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-[#2B2F32] flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Cases
          </CardTitle>
          <CardDescription>Latest case entries</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-[#2B2F32]/60">Loading...</div>
          ) : cases.length === 0 ? (
            <div className="text-center py-8 text-[#2B2F32]/60">No cases found</div>
          ) : (
            <div className="space-y-4">
              {cases.slice(0, 5).map((caseItem) => {
                const displayDate = parseDate(caseItem.date);
                return (
                  <div key={caseItem.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          Bill No: {caseItem.billNumber}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Case No: {caseItem.caseNumber}
                        </Badge>
                      </div>
                      <p className="font-medium text-[#2B2F32]">{caseItem.caseDescription}</p>
                      <p className="text-sm text-[#2B2F32]/60">
                        {displayDate ? displayDate.toLocaleDateString('en-GB') : 'Invalid Date'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#CAA068]">Bill: {formatCurrency(caseItem.totalAmount || 0)}</p>
                      {caseItem.paidAmount > 0 && (
                        <p className="text-sm text-green-700 font-medium">Paid: {formatCurrency(caseItem.paidAmount)}</p>
                      )}
                      {caseItem.remainingAmount > 0 && (
                        <p className="text-sm text-red-700 font-medium">Due: {formatCurrency(caseItem.remainingAmount)}</p>
                      )}
                      <p className="text-sm text-[#2B2F32]/60">{caseItem.particulars?.length || 0} items</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
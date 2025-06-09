'use client';

import { useState, useEffect, useMemo } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import {
  Search,
  FileText,
  Calendar,
  DollarSign,
  Printer,
  Loader2,
  List,
} from 'lucide-react';

// --- INTERFACES ---
interface Particular {
  type: string;
  amount: number;
  appearanceDate?: string;
  customType?: string;
}

interface CaseData {
  id: string;
  billNumber: string;
  caseNumber: string;
  caseDescription: string;
  date: string;
  totalAmount: number;
  particulars: Particular[];
}

export function BillList() {
  const [allCases, setAllCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);

  // --- DATA FETCHING ---
  useEffect(() => {
    const casesRef = ref(database, 'cases');
    const unsubscribe = onValue(casesRef, (snapshot) => {
      const data = snapshot.val();
      const casesArray: CaseData[] = data
        ? Object.entries(data).map(([id, caseData]: [string, any]) => ({
            id,
            ...caseData,
            particulars: caseData.particulars || [],
          }))
        : [];

      // Sort cases by date, most recent first
      casesArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setAllCases(casesArray);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- FILTERING LOGIC ---
  const filteredCases = useMemo(() => {
    if (!searchTerm) return allCases;
    return allCases.filter(c =>
        c.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.caseDescription.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, allCases]);

  // --- UTILITY FUNCTIONS ---
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount || 0);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };
  
  const getParticularDisplayName = (p: Particular) => (p.type === 'Other' && p.customType) ? `Other: ${p.customType}` : p.type;
  
  // --- PRINT FUNCTIONALITY ---
  const handlePrint = () => {
    const printContent = document.getElementById('bill-details-printable');
    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = 'Print' + uniqueName;
    
    const printWindow = window.open(windowUrl, windowName, 'left=50,top=50,width=800,height=600');
    if (printWindow && printContent) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Bill</title>
              <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="p-8 font-sans">
              ${printContent.innerHTML}
              <script>
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 250);
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
    }
  };

  // --- RENDER LOGIC ---
  if (loading) {
    return <div className="text-center py-12 text-white/80 flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin"/>Loading cases...</div>;
  }

  return (
    <>
      <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl text-[#2B2F32] flex items-center gap-3"><List />All Cases</CardTitle>
              <CardDescription className="text-[#2B2F32]/60 mt-1">A complete list of all your case entries.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Bill No, Case No..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredCases.length > 0 ? (
              filteredCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  onClick={() => setSelectedCase(caseItem)}
                  className="p-4 bg-gray-50 hover:bg-[#CAA068]/10 border border-gray-200 rounded-lg cursor-pointer transition-colors duration-200"
                >
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                    <div className="flex-1 mb-3 md:mb-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <Badge variant="outline" className="text-xs">Bill No: {caseItem.billNumber}</Badge>
                        <Badge variant="secondary" className="text-xs">Case No: {caseItem.caseNumber}</Badge>
                      </div>
                      <p className="font-semibold text-base text-[#2B2F32]">{caseItem.caseDescription}</p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(caseItem.date)}</span>
                      </div>
                      <div className="font-bold text-lg text-[#CAA068]">
                        {formatCurrency(caseItem.totalAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No cases found.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- DETAILS MODAL DIALOG --- */}
      <Dialog open={!!selectedCase} onOpenChange={(isOpen) => !isOpen && setSelectedCase(null)}>
        {/* MODIFIED: Added flex, flex-col, and max-h to make the dialog scrollable */}
        <DialogContent className="max-w-3xl p-0 flex flex-col max-h-[90vh]">
          {selectedCase && (
            <>
              {/* MODIFIED: Added overflow-y-auto to make this specific area scroll */}
              <div id="bill-details-printable" className="overflow-y-auto">
                <DialogHeader className="p-6 bg-gray-50 rounded-t-lg">
                  <DialogTitle className="text-2xl text-[#2B2F32]">Case Details</DialogTitle>
                  <DialogDescription>Bill No: {selectedCase.billNumber} • Case No: {selectedCase.caseNumber}</DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-6">
                  {/* Case Info */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-semibold text-blue-800">{selectedCase.caseDescription}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-blue-600">
                      <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4"/><span>{formatDate(selectedCase.date)}</span></div>
                    </div>
                  </div>
                  
                  {/* Particulars List */}
                  <div>
                    <h3 className="text-lg font-semibold text-[#2B2F32] mb-3 flex items-center gap-2"><FileText className="h-5 w-5"/>Particulars</h3>
                    <div className="space-y-2">
                        {selectedCase.particulars.length > 0 ? selectedCase.particulars.map((p, index) => (
                           <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                               <div>
                                   <p className="font-medium">{getParticularDisplayName(p)}</p>
                                   {(p.type.toLowerCase().includes('appearance') || p.type.toLowerCase().includes('hearing')) && p.appearanceDate && (
                                       <p className="text-xs text-gray-500 mt-0.5">Appearance Date: {formatDate(p.appearanceDate)}</p>
                                   )}
                               </div>
                               <span className="font-semibold">{formatCurrency(p.amount)}</span>
                           </div>
                        )) : <p className="text-sm text-gray-500">No particulars found for this case.</p>}
                    </div>
                  </div>

                  {/* Grand Total */}
                  <div className="flex justify-between items-center p-4 bg-[#CAA068] text-white rounded-lg mt-4">
                    <span className="text-xl font-bold">Grand Total</span>
                    <span className="text-2xl font-bold">{formatCurrency(selectedCase.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* MODIFIED: Added flex-shrink-0 to keep the footer from shrinking */}
              <DialogFooter className="p-6 border-t flex-shrink-0">
                <Button onClick={handlePrint} variant="outline"><Printer className="h-4 w-4 mr-2"/>Print</Button>
                <Button onClick={() => setSelectedCase(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
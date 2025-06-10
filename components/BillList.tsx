'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import {
  Search,
  FileText,
  Calendar,
  DollarSign,
  Printer,
  Loader2,
  List,
  Edit,
  Plus,
  Trash2,
  ChevronsUpDown,
} from 'lucide-react';

// --- CONSTANTS & HELPERS ---
const PARTICULAR_TYPES = [
  "Appearance", "Arbitration Hearing", "Conference", "Conference at BEST office",
  "Drafting Charges", "Drafting Section 17 Application", "Filing",
  "Miscellaneous Expenses", "Notary Charges", "Notary Charges Affidavit in Reply",
  "Settling Reply to Claims", "Written opinion", "Xerox Charges", "Other"
].sort();

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(amount || 0);

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return 'Invalid Date'; }
};

const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    try {
        return new Date(dateString).toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
};

const getParticularDisplayName = (p: Particular) => (p.type === 'Other' && p.customType) ? `Other: ${p.customType}` : p.type;

// --- INTERFACES ---
interface Particular {
  type: string;
  amount: number | string; // Allow string for form input
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

// --- MAIN COMPONENT ---
export function BillList() {
  // --- STATE MANAGEMENT ---
  const [allCases, setAllCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<CaseData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [openParticularPopoverIndex, setOpenParticularPopoverIndex] = useState<number | null>(null);

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
  
  // --- EDIT MODE HANDLERS ---
  const handleEdit = useCallback(() => {
    if (!selectedCase) return;
    setEditFormData(JSON.parse(JSON.stringify(selectedCase))); // Deep copy
    setIsEditing(true);
  }, [selectedCase]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditFormData(null);
  }, []);

  const handleUpdateCase = useCallback(async () => {
    if (!editFormData) return;
    setIsUpdating(true);

    const sanitizedParticulars = editFormData.particulars.map(p => ({
      ...p,
      amount: Number(p.amount || 0)
    }));

    const newTotalAmount = sanitizedParticulars.reduce((sum, p) => sum + p.amount, 0);

    const dataToSave = {
      ...editFormData,
      particulars: sanitizedParticulars,
      totalAmount: newTotalAmount,
    };
    delete (dataToSave as any).id; // Don't save the id inside the case object

    try {
      await update(ref(database, `cases/${editFormData.id}`), dataToSave);
      toast.success("Case updated successfully!");
      // Update the view with the saved data
      setSelectedCase({ ...editFormData, particulars: sanitizedParticulars, totalAmount: newTotalAmount });
      handleCancelEdit();
    } catch (error) {
      console.error("Update Error:", error);
      toast.error("Failed to update case.");
    } finally {
      setIsUpdating(false);
    }
  }, [editFormData, handleCancelEdit]);

  // --- FORM INPUT HANDLERS (MEMOIZED) ---
  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editFormData) return;
    setEditFormData(prev => prev ? { ...prev, [e.target.name]: e.target.value } : null);
  }, [editFormData]);

  const handleParticularChange = useCallback((index: number, field: string, value: string) => {
    if (!editFormData) return;
    const updatedParticulars = [...editFormData.particulars];
    updatedParticulars[index] = { ...updatedParticulars[index], [field]: value };
    setEditFormData(prev => prev ? { ...prev, particulars: updatedParticulars } : null);
  }, [editFormData]);
  
  const handleParticularTypeSelect = useCallback((index: number, type: string) => {
    if (!editFormData) return;
    const updatedParticulars = [...editFormData.particulars];
    updatedParticulars[index].type = type;
    if (type !== 'Other') {
        updatedParticulars[index].customType = '';
    }
    setEditFormData(prev => prev ? { ...prev, particulars: updatedParticulars } : null);
    setOpenParticularPopoverIndex(null);
  }, [editFormData]);

  const handleAddParticular = useCallback(() => {
    if (!editFormData) return;
    const newParticular = { type: '', amount: '', customType: '', appearanceDate: '' };
    setEditFormData(prev => prev ? { ...prev, particulars: [...prev.particulars, newParticular] } : null);
  }, [editFormData]);

  const handleRemoveParticular = useCallback((index: number) => {
    if (!editFormData) return;
    setEditFormData(prev => prev ? { ...prev, particulars: prev.particulars.filter((_, i) => i !== index) } : null);
  }, [editFormData]);

  // --- LIVE TOTAL CALCULATION FOR EDIT MODE ---
  const liveTotalAmount = useMemo(() => {
      if (!editFormData) return 0;
      return editFormData.particulars.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [editFormData]);

  // --- PRINT FUNCTIONALITY ---
  const handlePrint = () => {
    const printContent = document.getElementById('bill-details-printable');
    const printWindow = window.open('', '_blank', 'left=50,top=50,width=800,height=600');
    if (printWindow && printContent) {
        printWindow.document.write(`
          <html>
            <head><title>Print Bill</title><script src="https://cdn.tailwindcss.com"></script></head>
            <body class="p-8 font-sans">${printContent.innerHTML}</body>
          </html>`);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
    }
  };

  const closeDialog = useCallback(() => {
    setSelectedCase(null);
    handleCancelEdit(); // Also exit edit mode when dialog closes
  }, [handleCancelEdit]);

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
                      <div className="flex items-center gap-2 text-gray-500"><Calendar className="h-4 w-4" /><span>{formatDate(caseItem.date)}</span></div>
                      <div className="font-bold text-lg text-[#CAA068]">{formatCurrency(caseItem.totalAmount)}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500"><p>No cases found for your search.</p></div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- DETAILS & EDITING MODAL DIALOG --- */}
      <Dialog open={!!selectedCase} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
        <DialogContent className="max-w-4xl p-0 flex flex-col max-h-[90vh]">
          {selectedCase && (
            <>
              {/* Scrollable Area */}
              <div className="overflow-y-auto" id={isEditing ? '' : 'bill-details-printable'}>
                <DialogHeader className="p-6 bg-gray-50 sticky top-0 z-10">
                  <DialogTitle className="text-2xl text-[#2B2F32]">{isEditing ? "Edit Case" : "Case Details"}</DialogTitle>
                  <DialogDescription>Bill No: {selectedCase.billNumber} • Case No: {selectedCase.caseNumber}</DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-6">
                  {isEditing && editFormData ? (
                    /* --- EDITING VIEW --- */
                    <div className="space-y-6">
                        {/* Case Info Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <Input name="billNumber" value={editFormData.billNumber} onChange={handleFormChange} placeholder="Bill Number" />
                           <Input name="caseNumber" value={editFormData.caseNumber} onChange={handleFormChange} placeholder="Case Number" />
                           <Input type="date" name="date" value={formatDateForInput(editFormData.date)} onChange={handleFormChange} />
                        </div>
                        <Input name="caseDescription" value={editFormData.caseDescription} onChange={handleFormChange} placeholder="Case Description" />

                        {/* Particulars Editing */}
                        <div>
                            <h3 className="text-lg font-semibold text-[#2B2F32] mb-3">Particulars</h3>
                            <div className="space-y-4">
                                {editFormData.particulars.map((p, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-lg border space-y-4">
                                        <div className="flex justify-between items-center"><p className="font-semibold text-gray-700">Item #{index + 1}</p><Button variant="ghost" size="icon" onClick={() => handleRemoveParticular(index)} className="text-red-500 hover:bg-red-100"><Trash2 className="h-5 w-5" /></Button></div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Popover open={openParticularPopoverIndex === index} onOpenChange={(isOpen) => setOpenParticularPopoverIndex(isOpen ? index : null)}>
                                                <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between">{p.type || "Select type..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[250px] p-0"><Command><CommandInput placeholder="Search type..." /><CommandEmpty>No type found.</CommandEmpty><CommandList><CommandGroup>{PARTICULAR_TYPES.map(type => (<CommandItem key={type} value={type} onSelect={() => handleParticularTypeSelect(index, type)}>{type}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                                            </Popover>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <Input name="amount" type="number" value={p.amount} onChange={(e) => handleParticularChange(index, 'amount', e.target.value)} placeholder="Amount" className="pl-9 w-full" />
                                            </div>
                                        </div>
                                        {p.type === 'Other' && <Input name="customType" value={p.customType || ''} onChange={(e) => handleParticularChange(index, 'customType', e.target.value)} placeholder="Enter custom type" />}
                                        {(p.type.toLowerCase().includes('appearance') || p.type.toLowerCase().includes('hearing')) && <Input type="date" name="appearanceDate" value={formatDateForInput(p.appearanceDate || '')} onChange={(e) => handleParticularChange(index, 'appearanceDate', e.target.value)} />}
                                    </div>
                                ))}
                                <Button variant="outline" onClick={handleAddParticular}><Plus className="mr-2 h-4 w-4" /> Add Particular</Button>
                            </div>
                        </div>
                        {/* Live Total */}
                        <div className="flex justify-between items-center p-4 bg-[#CAA068]/20 text-[#2B2F32] rounded-lg mt-4 border border-[#CAA068]">
                           <span className="text-xl font-bold">New Total</span>
                           <span className="text-2xl font-bold">{formatCurrency(liveTotalAmount)}</span>
                        </div>
                    </div>
                  ) : (
                    /* --- READ-ONLY VIEW --- */
                    <div className="space-y-6">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="font-semibold text-blue-800">{selectedCase.caseDescription}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-blue-600">
                          <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4"/><span>{formatDate(selectedCase.date)}</span></div>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[#2B2F32] mb-3 flex items-center gap-2"><FileText className="h-5 w-5"/>Particulars</h3>
                        <div className="space-y-2">
                          {selectedCase.particulars.length > 0 ? selectedCase.particulars.map((p, index) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                              <div>
                                <p className="font-medium">{getParticularDisplayName(p)}</p>
                                {p.appearanceDate && <p className="text-xs text-gray-500 mt-0.5">Appearance Date: {formatDate(p.appearanceDate)}</p>}
                              </div>
                              <span className="font-semibold">{formatCurrency(p.amount as number)}</span>
                            </div>
                          )) : <p className="text-sm text-gray-500">No particulars found for this case.</p>}
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-[#CAA068] text-white rounded-lg mt-4">
                        <span className="text-xl font-bold">Grand Total</span>
                        <span className="text-2xl font-bold">{formatCurrency(selectedCase.totalAmount)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Footer */}
              <DialogFooter className="p-4 border-t flex-shrink-0 bg-white">
                {isEditing ? (
                  <div className="w-full flex justify-between items-center">
                    <Button onClick={handleCancelEdit} variant="ghost">Cancel</Button>
                    <Button onClick={handleUpdateCase} disabled={isUpdating}>
                      {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                ) : (
                  <div className="w-full flex justify-between items-center">
                    <div>
                      <Button onClick={handleEdit} variant="outline"><Edit className="h-4 w-4 mr-2"/>Edit</Button>
                      <Button onClick={handlePrint} variant="outline" className="ml-2"><Printer className="h-4 w-4 mr-2"/>Print</Button>
                    </div>
                    <Button onClick={closeDialog}>Close</Button>
                  </div>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
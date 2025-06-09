'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import {
  Search,
  ArrowLeft,
  Plus,
  Edit,
  Calendar,
  DollarSign,
  FileText,
  Trash2,
  Loader2,
  ChevronsUpDown
} from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';

// --- PREDEFINED LIST OF PARTICULAR TYPES (SORTED) ---
const PARTICULAR_TYPES = [
  "Appearance",
  "Arbitration Hearing",
  "Conference",
  "Conference at BEST office",
  "Drafting Charges",
  "Drafting Section 17 Application",
  "Filing",
  "Miscellaneous Expenses",
  "Notary Charges",
  "Notary Charges Affidavit in Reply",
  "Settling Reply to Claims",
  "Written opinion",
  "Xerox Charges",
  "Other"
].sort();


// --- INTERFACES ---
interface Particular {
  type: string;
  customType?: string;
  appearanceDate?: string;
  // MODIFIED: Amount can be a string during input to allow for an empty field
  amount: number | string;
}

interface CaseData {
  id: string;
  billNumber: string;
  caseNumber:string;
  caseDescription: string;
  date: string;
  totalAmount: number;
  particulars: Particular[];
}

export function SearchCases() {
  const router = useRouter();

  // --- STATE MANAGEMENT ---
  const [allCases, setAllCases] = useState<CaseData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'SEARCH' | 'EDITING'>('SEARCH');
  const [editFormData, setEditFormData] = useState<CaseData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [openParticularIndex, setOpenParticularIndex] = useState<number | null>(null);


  // --- DATA FETCHING ---
  useEffect(() => {
    const casesRef = ref(database, 'cases');
    const unsubscribe = onValue(casesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const casesArray = Object.entries(data).map(([id, caseData]: [string, any]) => ({
          id,
          ...caseData,
          particulars: caseData.particulars || [],
        }));
        setAllCases(casesArray);
      } else {
        setAllCases([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredCases = allCases.filter(caseItem =>
    searchTerm && (
      caseItem.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.caseDescription.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // --- UTILITY & EVENT HANDLERS ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    try {
        return new Date(dateString).toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
  };
  
  const getParticularDisplayName = (p: Particular) => {
    if (p.type === 'Other' && p.customType) {
        return `Other: ${p.customType}`;
    }
    return p.type;
  };

  const handleCaseSelect = (caseItem: CaseData) => {
    setSelectedCase(caseItem);
    setSearchTerm('');
    setPopoverOpen(false);
  };

  // --- EDITING HANDLERS ---
  const handleEditClick = () => {
    if (!selectedCase) return;
    setEditFormData(JSON.parse(JSON.stringify(selectedCase)));
    setViewMode('EDITING');
  };

  const handleCancelEdit = () => {
    setViewMode('SEARCH');
    setEditFormData(null);
  };

  const handleUpdateCase = async () => {
    if (!editFormData) return;
    setIsUpdating(true);

    // MODIFICATION: Sanitize particulars data before saving
    const sanitizedParticulars = editFormData.particulars.map(p => ({
        ...p,
        // Convert amount back to a number, defaulting to 0 if empty/invalid
        amount: Number(p.amount || 0)
    }));

    const newTotalAmount = sanitizedParticulars.reduce((sum, p) => sum + p.amount, 0);

    const dataToSave = {
        ...editFormData,
        particulars: sanitizedParticulars, // Use the sanitized array for saving
        totalAmount: newTotalAmount
    };
    delete (dataToSave as any).id;

    try {
        const caseRef = ref(database, `cases/${editFormData.id}`);
        await update(caseRef, dataToSave);
        toast.success("Case updated successfully!");
        
        // MODIFICATION: Update the selected case view with the clean, sanitized data
        setSelectedCase({
            ...editFormData,
            particulars: sanitizedParticulars,
            totalAmount: newTotalAmount
        });
        handleCancelEdit();
    } catch (error) {
        console.error("Update Error:", error);
        toast.error("An error occurred while saving.");
    } finally {
        setIsUpdating(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editFormData) return;
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };
  
  const handleParticularChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editFormData) return;
    const updatedParticulars = [...editFormData.particulars];
    // MODIFICATION: Store the raw value from the input. This allows the value to be an empty string.
    updatedParticulars[index] = { ...updatedParticulars[index], [e.target.name]: e.target.value };
    setEditFormData({ ...editFormData, particulars: updatedParticulars });
  };
  
  const handleParticularTypeSelect = (index: number, value: string) => {
    if (!editFormData) return;
    const updatedParticulars = [...editFormData.particulars];
    updatedParticulars[index].type = value;
    if (value !== 'Other') {
        updatedParticulars[index].customType = '';
    }
    setEditFormData({ ...editFormData, particulars: updatedParticulars });
    setOpenParticularIndex(null);
  };

  const handleAddParticular = () => {
    if (!editFormData) return;
    setEditFormData({
        ...editFormData,
        // MODIFICATION: Default amount is an empty string '' instead of 0
        particulars: [...editFormData.particulars, { type: '', amount: '', customType: '', appearanceDate: '' }]
    });
  };

  const handleRemoveParticular = (index: number) => {
    if (!editFormData) return;
    const updatedParticulars = editFormData.particulars.filter((_, i) => i !== index);
    setEditFormData({ ...editFormData, particulars: updatedParticulars });
  };

  // --- RENDER LOGIC ---
  if (viewMode === 'EDITING' && editFormData) {
    // Live total calculation correctly handles string and number amounts
    const totalAmount = editFormData.particulars.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return (
        <div className="w-full max-w-4xl mx-auto p-4 md:p-0">
            <Card className="bg-white shadow-2xl rounded-lg overflow-hidden">
                <CardHeader className="bg-gray-50 border-b border-gray-200 p-4 sm:p-6">
                    <div className="flex justify-between items-center gap-4">
                        <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">Edit Case</CardTitle>
                        <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="flex items-center gap-1">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Cancel</span>
                        </Button>
                    </div>
                    <CardDescription className="mt-1">Update details for Bill No: {editFormData.billNumber}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-6">
                    <div className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input name="billNumber" value={editFormData.billNumber} onChange={handleFormChange} placeholder="Bill Number" />
                            <Input name="caseNumber" value={editFormData.caseNumber} onChange={handleFormChange} placeholder="Case Number" />
                            <Input type="date" name="date" value={formatDateForInput(editFormData.date)} onChange={handleFormChange} />
                        </div>
                        <Input name="caseDescription" value={editFormData.caseDescription} onChange={handleFormChange} placeholder="Case Description" />
                    </div>

                    <Card className="border">
                        <CardHeader><CardTitle className="text-lg">Particulars</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            {editFormData.particulars.map((p, index) => (
                                <div key={index} className="bg-gray-50 p-4 rounded-lg border space-y-4">
                                    <div className="flex justify-between items-center">
                                         <p className="font-semibold text-gray-700">Item #{index + 1}</p>
                                         <Button variant="ghost" size="icon" onClick={() => handleRemoveParticular(index)} className="text-red-500 hover:bg-red-100"><Trash2 className="h-5 w-5" /></Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Popover open={openParticularIndex === index} onOpenChange={(isOpen) => setOpenParticularIndex(isOpen ? index : null)}>
                                            <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between">{p.type || "Select type..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search type..." /><CommandEmpty>No type found.</CommandEmpty><CommandList><CommandGroup>
                                            {PARTICULAR_TYPES.map(type => (<CommandItem key={type} value={type} onSelect={() => handleParticularTypeSelect(index, type)}>{type}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                                        </Popover>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <Input name="amount" type="number" value={p.amount} onChange={(e) => handleParticularChange(index, e)} placeholder="Amount" className="pl-9 w-full" />
                                        </div>
                                    </div>
                                    {p.type === 'Other' && <Input name="customType" value={p.customType || ''} onChange={(e) => handleParticularChange(index, e)} placeholder="Enter custom type" />}
                                    {(p.type.toLowerCase().includes('appearance') || p.type.toLowerCase().includes('hearing')) && <Input type="date" name="appearanceDate" value={formatDateForInput(p.appearanceDate || '')} onChange={(e) => handleParticularChange(index, e)} />}
                                </div>
                            ))}
                             <Button variant="outline" onClick={handleAddParticular} className="w-full md:w-auto"><Plus className="mr-2 h-4 w-4" /> Add Particular</Button>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t">
                         <div className="text-xl sm:text-2xl font-bold text-gray-800 text-center sm:text-right w-full sm:w-auto">Total: {formatCurrency(totalAmount)}</div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                             <Button variant="outline" onClick={handleCancelEdit} className="w-full">Cancel</Button>
                             <Button onClick={handleUpdateCase} disabled={isUpdating} className="bg-[#CAA068] hover:bg-[#B8A799] text-white w-full">{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }

  // --- SEARCH & DISPLAY VIEW ---
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
        {/* Remainder of the code is unchanged */}
        <div className="flex items-center gap-4"><Button variant="ghost" onClick={() => router.back()} className="text-[#2B2F32] hover:bg-white/20"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button><h1 className="text-3xl font-bold text-white">Search Cases</h1></div>
        <Card className="bg-white shadow-xl">
            <CardHeader className="bg-[#2B2F32] text-white"><CardTitle className="text-2xl flex items-center gap-2"><Search className="h-6 w-6" /> Find Cases</CardTitle><CardDescription className="text-[#B8A799]">Search by bill number, case number, or case description</CardDescription></CardHeader>
            <CardContent className="p-6">
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between h-12">{selectedCase ? `${selectedCase.billNumber} - ${selectedCase.caseDescription}` : "Click to search cases..."}<Search className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start"><Command><CommandInput placeholder="Type to search..." value={searchTerm} onValueChange={setSearchTerm}/><CommandList><CommandEmpty>No cases found.</CommandEmpty><CommandGroup>
                    {filteredCases.map((caseItem) => (<CommandItem key={caseItem.id} value={`${caseItem.billNumber} ${caseItem.caseNumber} ${caseItem.caseDescription}`} onSelect={() => handleCaseSelect(caseItem)}>{caseItem.billNumber} - {caseItem.caseDescription}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                </Popover>
            </CardContent>
        </Card>
        {selectedCase && (
            <Card className="bg-white shadow-xl">
            <CardHeader className="bg-gradient-to-r from-[#CAA068] to-[#B8A799] text-white"><CardTitle className="text-2xl flex items-center justify-between"><div className="flex items-center gap-2"><FileText className="h-6 w-6" /> Case Details</div><Button onClick={handleEditClick} className="bg-white/20 hover:bg-white/30 text-white"><Edit className="h-4 w-4 mr-2" /> Edit Case Details</Button></CardTitle><CardDescription className="text-white/80">Complete information for the selected case</CardDescription></CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div><p className="text-sm font-medium text-[#2B2F32]/60 mb-1">Case Description</p><p className="text-[#2B2F32] font-medium text-lg">{selectedCase.caseDescription}</p></div><div className="space-y-2"><div className="flex items-center gap-2 flex-wrap"><Badge variant="outline">Bill No: {selectedCase.billNumber}</Badge><Badge variant="secondary">Case No: {selectedCase.caseNumber}</Badge></div><div className="flex items-center gap-2 text-sm text-[#2B2F32]/60"><Calendar className="h-4 w-4" /> Date: {new Date(selectedCase.date).toLocaleDateString('en-GB')}</div></div></div>
                <div className="mt-6 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#2B2F32]">Particulars ({selectedCase.particulars?.length || 0})</h3>
                        <Button variant="outline" size="sm" onClick={handleEditClick}><Plus className="h-4 w-4 mr-2" /> Add / Edit Particulars</Button>
                    </div>
                {selectedCase.particulars && selectedCase.particulars.length > 0 ? (
                    <div className="space-y-3">
                        {selectedCase.particulars.map((p, index) => (
                        <Card key={index}><CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="flex-grow">
                                <p className="font-medium">{getParticularDisplayName(p)}</p>
                                {p.type.toLowerCase().includes('appearance') && p.appearanceDate && <p className="text-sm text-muted-foreground">Appearance Date: {new Date(p.appearanceDate).toLocaleDateString('en-GB')}</p>}
                            </div>
                            <Badge variant="secondary" className="text-base mt-2 sm:mt-0">{formatCurrency(p.amount as number)}</Badge>
                        </CardContent></Card>
                        ))}
                        <Card className="border-[#CAA068] bg-[#CAA068]/5"><CardContent className="p-4 flex justify-between items-center"><span className="text-lg font-bold text-[#2B2F32]">Total Amount:</span><Badge className="text-xl px-4 py-2 bg-[#CAA068] text-white">{formatCurrency(selectedCase.totalAmount)}</Badge></CardContent></Card>
                    </div>
                ) : (<Card className="border-dashed"><CardContent className="p-8 text-center text-muted-foreground">No particulars found. Click the button above to add one.</CardContent></Card>)}
                </div>
            </CardContent>
            </Card>
      )}
    </div>
  );
}
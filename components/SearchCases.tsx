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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, ArrowLeft, Plus, Edit, Calendar, DollarSign, FileText, Trash2, Loader2, ChevronsUpDown, Save, X, ChevronRight, Building2, Hash } from 'lucide-react';
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
  amount: number | string;
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
      style: 'currency', 
      currency: 'INR', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0,
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

    const sanitizedParticulars = editFormData.particulars.map(p => ({
      ...p,
      amount: Number(p.amount || 0)
    }));

    const newTotalAmount = sanitizedParticulars.reduce((sum, p) => sum + p.amount, 0);

    const dataToSave = {
      ...editFormData,
      particulars: sanitizedParticulars,
      totalAmount: newTotalAmount
    };
    delete (dataToSave as any).id;

    try {
      const caseRef = ref(database, `cases/${editFormData.id}`);
      await update(caseRef, dataToSave);
      toast.success("Case updated successfully!");
      
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
    const totalAmount = editFormData.particulars.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Mobile Header */}
        <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCancelEdit}
                className="h-9 w-9 p-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-semibold text-slate-900">Edit Case</h1>
                <p className="text-sm text-slate-500">Bill #{editFormData.billNumber}</p>
              </div>
            </div>
            <Button 
              onClick={handleUpdateCase} 
              disabled={isUpdating}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-6">
            {/* Basic Information Card */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      name="billNumber" 
                      value={editFormData.billNumber} 
                      onChange={handleFormChange} 
                      placeholder="Bill Number"
                      className="pl-10 h-12 border-slate-200 focus:border-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      name="caseNumber" 
                      value={editFormData.caseNumber} 
                      onChange={handleFormChange} 
                      placeholder="Case Number"
                      className="pl-10 h-12 border-slate-200 focus:border-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      type="date" 
                      name="date" 
                      value={formatDateForInput(editFormData.date)} 
                      onChange={handleFormChange}
                      className="pl-10 h-12 border-slate-200 focus:border-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input 
                      name="caseDescription" 
                      value={editFormData.caseDescription} 
                      onChange={handleFormChange} 
                      placeholder="Case Description"
                      className="pl-10 h-12 border-slate-200 focus:border-blue-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Particulars Card */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Particulars ({editFormData.particulars.length})
                  </CardTitle>
                  <Button 
                    onClick={handleAddParticular}
                    size="sm"
                    variant="outline"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editFormData.particulars.map((p, index) => (
                  <Card key={index} className="border border-slate-200 bg-slate-50/50">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600">
                          Item #{index + 1}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleRemoveParticular(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        <Popover 
                          open={openParticularIndex === index} 
                          onOpenChange={(isOpen) => setOpenParticularIndex(isOpen ? index : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              role="combobox" 
                              className="w-full justify-between h-12 border-slate-200"
                            >
                              <span className="truncate">
                                {p.type || "Select type..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Search type..." />
                              <CommandEmpty>No type found.</CommandEmpty>
                              <CommandList>
                                <CommandGroup>
                                  {PARTICULAR_TYPES.map(type => (
                                    <CommandItem 
                                      key={type} 
                                      value={type} 
                                      onSelect={() => handleParticularTypeSelect(index, type)}
                                    >
                                      {type}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>

                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input 
                            name="amount" 
                            type="number" 
                            value={p.amount} 
                            onChange={(e) => handleParticularChange(index, e)} 
                            placeholder="Amount" 
                            className="pl-10 h-12 border-slate-200 focus:border-blue-500"
                          />
                        </div>

                        {p.type === 'Other' && (
                          <Input 
                            name="customType" 
                            value={p.customType || ''} 
                            onChange={(e) => handleParticularChange(index, e)} 
                            placeholder="Enter custom type"
                            className="h-12 border-slate-200 focus:border-blue-500"
                          />
                        )}

                        {(p.type.toLowerCase().includes('appearance') || p.type.toLowerCase().includes('hearing')) && (
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                              type="date" 
                              name="appearanceDate" 
                              value={formatDateForInput(p.appearanceDate || '')} 
                              onChange={(e) => handleParticularChange(index, e)}
                              className="pl-10 h-12 border-slate-200 focus:border-blue-500"
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {editFormData.particulars.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No particulars added yet</p>
                    <p className="text-sm">Tap the Add button to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Total Amount Card */}
            <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-slate-900">
                    Total Amount
                  </span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Bottom spacing for mobile */}
            <div className="h-6"></div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // --- SEARCH & DISPLAY VIEW ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="h-9 w-9 p-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-slate-900">Search Cases</h1>
            <p className="text-sm text-slate-500">Find and manage your cases</p>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-80px)]">
        <div className="p-4 space-y-6">
          {/* Search Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-600" />
                Find Cases
              </CardTitle>
              <CardDescription className="text-slate-500">
                Search by bill number, case number, or description
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    role="combobox" 
                    className="w-full justify-between h-12 border-slate-200 text-left"
                  >
                    <span className="truncate">
                      {selectedCase 
                        ? `${selectedCase.billNumber} - ${selectedCase.caseDescription}` 
                        : "Tap to search cases..."
                      }
                    </span>
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Type to search..." 
                      value={searchTerm} 
                      onValueChange={setSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>No cases found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCases.map((caseItem) => (
                          <CommandItem 
                            key={caseItem.id} 
                            value={`${caseItem.billNumber} ${caseItem.caseNumber} ${caseItem.caseDescription}`} 
                            onSelect={() => handleCaseSelect(caseItem)}
                            className="flex items-center justify-between"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {caseItem.billNumber}
                              </p>
                              <p className="text-sm text-slate-500 truncate">
                                {caseItem.caseDescription}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* Selected Case Details */}
          {selectedCase && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      Case Details
                    </CardTitle>
                    <CardDescription className="text-slate-500 mt-1">
                      Complete information for selected case
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={handleEditClick}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Case Info */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-600 mb-1">Case Description</p>
                    <p className="text-slate-900 font-medium">{selectedCase.caseDescription}</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Bill: {selectedCase.billNumber}
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Case: {selectedCase.caseNumber}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="h-4 w-4" />
                    {new Date(selectedCase.date).toLocaleDateString('en-GB')}
                  </div>
                </div>

                <Separator />

                {/* Particulars Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                      Particulars ({selectedCase.particulars?.length || 0})
                    </h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleEditClick}
                      className="border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>

                  {selectedCase.particulars && selectedCase.particulars.length > 0 ? (
                    <div className="space-y-3">
                      {selectedCase.particulars.map((p, index) => (
                        <Card key={index} className="border border-slate-200 bg-slate-50/50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 truncate">
                                  {getParticularDisplayName(p)}
                                </p>
                                {p.type.toLowerCase().includes('appearance') && p.appearanceDate && (
                                  <p className="text-sm text-slate-500 mt-1">
                                    Appearance: {new Date(p.appearanceDate).toLocaleDateString('en-GB')}
                                  </p>
                                )}
                              </div>
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                {formatCurrency(p.amount as number)}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      {/* Total Amount */}
                      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-semibold text-slate-900">
                              Total Amount
                            </span>
                            <span className="text-xl font-bold text-blue-600">
                              {formatCurrency(selectedCase.totalAmount)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <Card className="border-2 border-dashed border-slate-200">
                      <CardContent className="p-8 text-center">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                        <p className="text-slate-500 mb-2">No particulars found</p>
                        <p className="text-sm text-slate-400">Tap Edit to add particulars</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          )}


          {/* Loading State */}
          {loading && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
                <p className="text-slate-500">Loading cases...</p>
              </CardContent>
            </Card>
          )}

          {/* Bottom spacing for mobile */}
          <div className="h-6"></div>
        </div>
      </ScrollArea>
    </div>
  );
}

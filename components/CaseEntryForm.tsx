'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  CalendarIcon,
  Save,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { database } from '@/lib/firebase';
import { ref, push, set } from 'firebase/database';
import { toast } from 'sonner';

// --- DEFINITIONS & SCHEMA ---
const particularTypes = [
  'Drafting Charges',
  'Appearance',
  'Xerox Charges',
  'Conference',
  'Conference at BEST office',
  'Notary Charges',
  'Written opinion',
  'Arbitration Hearing',
  'Miscellaneous Expenses',
  'Filing',
  'Drafting Section 17 Application',
  'Notary Charges Affidavit in Reply',
  'Settling Reply to Claims'
].sort();

const particularSchema = z.object({
  type: z.string().min(1, 'Particular type is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  appearanceDate: z.date().optional().nullable(),
});

const caseSchema = z.object({
  billNumber: z.string().min(1, 'Bill number is required'),
  date: z.date({ required_error: "A case date is required." }),
  caseNumber: z.string().min(1, 'Case number is required'),
  caseDescription: z.string().min(1, 'Case description is required'),
  particulars: z.array(particularSchema).min(1, 'At least one particular is required'),
});

type CaseFormData = z.infer<typeof caseSchema>;

export function CaseEntryForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<CaseFormData>({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      billNumber: '',
      date: new Date(),
      caseNumber: '',
      caseDescription: '',
      particulars: [{ type: '', amount: 0, appearanceDate: null }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'particulars',
  });

  const onSubmit = async (data: CaseFormData) => {
    setLoading(true);
    try {
      const totalAmount = data.particulars.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Prepare the case data, converting Date objects to strings for Firebase
      const caseData = {
        ...data,
        date: data.date.toISOString(), // Convert the main case Date object to a string
        totalAmount,
        createdAt: new Date().toISOString(),
        particulars: data.particulars.map(p => ({
          ...p,
          // Also ensure optional appearanceDate is a string or null
          appearanceDate: p.appearanceDate ? p.appearanceDate.toISOString() : null,
        })),
      };

      // Save to Firebase
      const casesRef = ref(database, 'cases');
      const newCaseRef = push(casesRef);
      await set(newCaseRef, caseData);

      toast.success('Case entry saved successfully!');
      router.push('/');
    } catch (error) {
      console.error('Error saving case:', error);
      toast.error('Failed to save case entry');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const particulars = form.watch('particulars');
    return particulars.reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()} className="text-[#2B2F32] hover:bg-white/20">
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <h1 className="text-3xl font-bold text-white">New Case Entry</h1>
      </div>

      <Card className="bg-white shadow-xl">
        <CardHeader className="bg-[#2B2F32] text-white">
          <CardTitle className="text-2xl">Case Information</CardTitle>
          <CardDescription className="text-[#B8A799]">Enter the details for the new case entry</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bill Number */}
                <div className="space-y-2">
                    <Label htmlFor="billNumber">Bill Number *</Label>
                    <Input id="billNumber" {...form.register('billNumber')} placeholder="Enter bill number" />
                    {form.formState.errors.billNumber && <p className="text-red-500 text-sm">{form.formState.errors.billNumber.message}</p>}
                </div>
                {/* Case Date */}
                <div className="space-y-2">
                    <Label>Date *</Label>
                    <Controller name="date" control={form.control} render={({ field }) => (
                        <Popover><PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : "Pick a date"}
                            </Button>
                        </PopoverTrigger><PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent></Popover>
                    )} />
                    {form.formState.errors.date && <p className="text-red-500 text-sm">{form.formState.errors.date.message}</p>}
                </div>
                {/* Case Number */}
                <div className="space-y-2">
                    <Label htmlFor="caseNumber">Case Number *</Label>
                    <Input id="caseNumber" {...form.register('caseNumber')} placeholder="Enter case number" />
                    {form.formState.errors.caseNumber && <p className="text-red-500 text-sm">{form.formState.errors.caseNumber.message}</p>}
                </div>
                {/* Case Description */}
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="caseDescription">Case Description *</Label>
                    <Textarea id="caseDescription" {...form.register('caseDescription')} placeholder="Enter case description" />
                    {form.formState.errors.caseDescription && <p className="text-red-500 text-sm">{form.formState.errors.caseDescription.message}</p>}
                </div>
            </div>

            {/* Particulars Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-medium">Particulars *</Label>
                <Button type="button" onClick={() => append({ type: '', amount: 0, appearanceDate: null })} className="bg-[#CAA068] hover:bg-[#B8A799] text-white">
                  <Plus className="h-4 w-4 mr-2" />Add Particular
                </Button>
              </div>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                      {/* Particular Type */}
                      <div className="space-y-2">
                        <Label>Particular Type</Label>
                        <Controller name={`particulars.${index}.type`} control={form.control} render={({ field }) => (
                           <Select onValueChange={(value) => {
                                field.onChange(value);
                                if (value !== 'Appearance') {
                                    form.setValue(`particulars.${index}.appearanceDate`, null);
                                }
                           }} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select particular type" /></SelectTrigger>
                            <SelectContent>{particularTypes.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                          </Select>
                        )} />
                      </div>
                      {/* Amount */}
                      <div className="space-y-2">
                        <Label>Amount (₹)</Label>
                        <Input type="number" {...form.register(`particulars.${index}.amount`, { valueAsNumber: true })} placeholder="Enter amount" />
                      </div>
                    </div>
                    {/* Appearance Date (Conditional) */}
                    {form.watch(`particulars.${index}.type`) === 'Appearance' && (
                        <div className="space-y-2">
                          <Label>Appearance Date</Label>
                          <Controller name={`particulars.${index}.appearanceDate`} control={form.control} render={({ field }) => (
                            <Popover><PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : "Pick date"}
                                </Button>
                            </PopoverTrigger><PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                            </PopoverContent></Popover>
                           )} />
                        </div>
                    )}
                    {fields.length > 1 && (
                      <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)} className="w-full md:w-auto">
                        <Trash2 className="h-4 w-4 mr-2" />Remove
                      </Button>
                    )}
                  </Card>
                ))}
                {form.formState.errors.particulars && <p className="text-red-500 text-sm">{form.formState.errors.particulars.root?.message}</p>}
              </div>
            </div>

            {/* Total Amount & Submit */}
            <Card className="bg-[#CAA068]/10 border-[#CAA068]"><CardContent className="p-4 flex justify-between items-center">
              <span className="text-xl font-bold">Total Amount:</span>
              <Badge className="text-xl bg-[#CAA068] text-white">{formatCurrency(calculateTotal())}</Badge>
            </CardContent></Card>
            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1 bg-[#CAA068] hover:bg-[#B8A799] text-white">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {loading ? 'Saving...' : 'Save Case Entry'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
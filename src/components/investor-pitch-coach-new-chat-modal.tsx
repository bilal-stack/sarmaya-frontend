
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { UploadCloud, File, X, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

const NewPitchChatSchema = z.object({
    file: z.any().nullable(),
    investorName: z.string().min(1, 'Investor name is required'),
    investorWebsite: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
    otherLinks: z.array(z.object({ value: z.string().url('Please enter a valid URL') })),
});

export type NewPitchChatData = z.infer<typeof NewPitchChatSchema>;

type NewPitchChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (data: NewPitchChatData) => void;
};

export function NewPitchChatModal({ isOpen, onClose, onContinue }: NewPitchChatModalProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<NewPitchChatData>({
    resolver: zodResolver(NewPitchChatSchema),
    defaultValues: {
      file: null,
      investorName: '',
      investorWebsite: '',
      otherLinks: [],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "otherLinks",
  });

  const handleAnalysis = async (analysisFile: File) => {
    if (!user?.access_token) {
        toast({ variant: 'destructive', title: 'Authentication Error' });
        return;
    }
    
    setIsAnalyzing(true);
    
    const formData = new FormData();
    formData.append('file', analysisFile);

    try {
        const response = await fetch('http://localhost:8000/api/v1/investor-pitch-coach/analysis', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${user.access_token}` },
            body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.status) {
            throw new Error(result.response_description || 'Analysis failed.');
        }
        
        toast({ title: 'Analysis Complete', description: result.response_description });

        form.setValue('investorName', result.data.investor_name || '');
        form.setValue('investorWebsite', result.data.investor_website || '');
        
        const links = result.data.other_links.map((link: string) => ({ value: link }));
        form.setValue('otherLinks', links);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Analysis Failed', description: error.message });
        // If analysis fails, we clear the file so user can try again
        form.setValue('file', null);
    } finally {
        setIsAnalyzing(false);
    }
  }


  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile) {
      if (!['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(selectedFile.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload a PDF, PowerPoint, or Word document.',
        });
        form.setValue('file', null);
        return;
      }
      form.setValue('file', selectedFile);
      handleAnalysis(selectedFile);
    }
  };

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      handleFileChange(event.dataTransfer.files[0]);
    }
  }, []);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);
  
  const onSubmit = (data: NewPitchChatData) => {
    onContinue(data);
    form.reset();
  };

  const handleClose = () => {
    if (isAnalyzing) return;
    form.reset();
    onClose();
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => {
        if(isAnalyzing) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle>Start a New Pitch Practice</DialogTitle>
          <DialogDescription>
            Provide some context about your pitch and target investor.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="file"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Pitch Deck/Document</FormLabel>
                            <FormControl>
                                {field.value ? (
                                    <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                                        <div className="flex items-center gap-3">
                                            <File className="h-6 w-6 text-primary" />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium truncate max-w-xs">{field.value.name}</span>
                                                <span className="text-xs text-muted-foreground">{(field.value.size / (1024*1024)).toFixed(2)} MB</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => form.setValue('file', null)} disabled={isAnalyzing}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div
                                        onDrop={onDrop}
                                        onDragOver={onDragOver}
                                        onDragLeave={onDragLeave}
                                        className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragOver ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}
                                        >
                                         {isAnalyzing && (
                                            <div className="absolute inset-0 bg-black/50 z-10 flex flex-col items-center justify-center rounded-lg">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="mt-2 text-sm text-primary-foreground">Analyzing document...</p>
                                            </div>
                                        )}
                                        <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                            <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                            <p className="text-xs text-muted-foreground">PDF, PPT, DOCS</p>
                                            </div>
                                            <input id="file-upload" type="file" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} accept=".pdf,.ppt,.pptx,.doc,.docx" disabled={isAnalyzing} />
                                        </label>
                                    </div>
                                )}
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="investorName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Investor Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. Sequoia Capital" {...field} disabled={isAnalyzing} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="investorWebsite"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Investor Website</FormLabel>
                        <FormControl>
                            <Input placeholder="https://www.sequoiacap.com/" {...field} disabled={isAnalyzing} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                
                <div>
                     <FormLabel>Other Links</FormLabel>
                     <div className="space-y-2 mt-2">
                        {fields.map((field, index) => (
                           <FormField
                                key={field.id}
                                control={form.control}
                                name={`otherLinks.${index}.value`}
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2">
                                            <FormControl>
                                                <Input placeholder="https://example.com" {...field} disabled={isAnalyzing} />
                                            </FormControl>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={isAnalyzing}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => append({ value: "" })}
                            disabled={isAnalyzing}
                            >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Link
                        </Button>
                     </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleClose} disabled={isAnalyzing}>Cancel</Button>
                    <Button type="submit" disabled={isAnalyzing}>
                        {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Continue
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    
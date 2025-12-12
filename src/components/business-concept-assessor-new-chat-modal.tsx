
'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UploadCloud, File, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

const NewConceptChatSchema = z.object({
    conceptName: z.string().min(1, 'Concept name is required'),
    conceptDetails: z.string().optional(),
    file: z.any().optional(),
});

export type NewConceptChatData = z.infer<typeof NewConceptChatSchema>;

type NewConceptChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (data: NewConceptChatData) => void;
};

export function NewConceptChatModal({ isOpen, onClose, onContinue }: NewConceptChatModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<NewConceptChatData>({
    resolver: zodResolver(NewConceptChatSchema),
    defaultValues: {
      conceptName: '',
      conceptDetails: '',
      file: null,
    },
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
        const response = await fetch('http://localhost:8000/api/v1/business-concept-assessor/analysis', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${user.access_token}` },
            body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.status) {
            throw new Error(result.response_description || 'Analysis failed.');
        }
        
        toast({ title: 'Analysis Complete', description: result.response_description });

        form.setValue('conceptName', result.data.concept_name || '');
        form.setValue('conceptDetails', result.data.description || '');

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Analysis Failed', description: error.message });
        form.setValue('file', null);
    } finally {
        setIsAnalyzing(false);
    }
  };

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
  
  const onSubmit = (data: NewConceptChatData) => {
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
          <DialogTitle>New Business Concept Assessment</DialogTitle>
          <DialogDescription>
            Provide details about your business concept to start the assessment.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="conceptName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Concept Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., AI-Powered Personal Chef" {...field} disabled={isAnalyzing} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="conceptDetails"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Briefly describe your business idea, the problem it solves, and the target audience." {...field} disabled={isAnalyzing} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="file"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Attach Document (Optional)</FormLabel>
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

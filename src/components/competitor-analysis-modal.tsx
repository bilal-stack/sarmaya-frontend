
'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, File, X, Loader2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

type CompetitorAnalysisModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisStart: (files: File[]) => void;
};

export function CompetitorAnalysisModal({ isOpen, onClose, onAnalysisStart }: CompetitorAnalysisModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (selectedFiles: FileList | null) => {
    if (selectedFiles) {
      const newFiles = Array.from(selectedFiles);
      const validFiles = newFiles.filter(file => 
        ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)
      );

      if (validFiles.length !== newFiles.length) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'One or more files were not valid. Only PDF, PowerPoint, and Word documents are accepted.',
        });
      }
      
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    if (event.dataTransfer.files) {
      handleFileChange(event.dataTransfer.files);
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

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStart = () => {
    if (files.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Files Selected',
        description: 'Please upload at least one document for analysis.',
      });
      return;
    }
    // Here you would trigger the analysis with the selected files
    setIsAnalyzing(true);
    // Simulate analysis time
    setTimeout(() => {
        onAnalysisStart(files);
        setIsAnalyzing(false);
        setFiles([]); // Reset files after starting
    }, 2000);
  };
  
  const handleClose = () => {
    if(isAnalyzing) return;
    setFiles([]);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-xl" onInteractOutside={(e) => {
          if (isAnalyzing) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle>Competitor Analysis</DialogTitle>
          <DialogDescription>
            Upload your pitch deck and any competitor materials (e.g., their decks, public filings, product spec sheets).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
            <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragOver ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}
            >
                <label htmlFor="file-upload-multiple" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                        <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-muted-foreground">PDF, PPT, DOCS</p>
                    </div>
                    <input id="file-upload-multiple" type="file" multiple className="hidden" onChange={(e) => handleFileChange(e.target.files)} accept=".pdf,.ppt,.pptx,.doc,.docx" />
                </label>
            </div>
            
            {files.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium">Selected Files ({files.length})</h3>
                    <ScrollArea className="h-32">
                        <div className="space-y-2 pr-4">
                        {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between rounded-md border bg-muted/50 p-2">
                                <div className="flex items-center gap-3">
                                    <File className="h-5 w-5 text-primary" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                                        <span className="text-xs text-muted-foreground">{(file.size / (1024*1024)).toFixed(2)} MB</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(index)} disabled={isAnalyzing}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAnalyzing}>Cancel</Button>
          <Button onClick={handleStart} disabled={files.length === 0 || isAnalyzing}>
            {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

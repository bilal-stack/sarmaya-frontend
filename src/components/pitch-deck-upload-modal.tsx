
'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { UploadCloud, File, Loader2, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

type PitchDeckUploadModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onUploadSuccess: () => void;
};

export function PitchDeckUploadModal({ isOpen, onOpenChange, onUploadSuccess }: PitchDeckUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile) {
      if (!['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(selectedFile.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload a PDF or PowerPoint file.',
        });
        return;
      }
      setFile(selectedFile);
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

  const resetState = () => {
    setFile(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!file || isUploading) return;

    if (!user?.access_token) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to upload a pitch deck.',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://localhost:8000/api/v1/pitch-decks/analysis', true);
    xhr.setRequestHeader('Authorization', `Bearer ${user.access_token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          if (result.status) {
            toast({
              title: 'Upload Successful',
              description: result.response_description || 'Your pitch deck has been uploaded and is being analyzed.',
            });
            onUploadSuccess();
            onOpenChange(false);
          } else {
             throw new Error(result.response_description || 'Upload failed with an unknown error.');
          }
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: e.message || 'Could not process server response.',
            });
        }
      } else {
        let errorMessage = 'Could not upload the pitch deck.';
        try {
            const result = JSON.parse(xhr.responseText);
            errorMessage = result.response_description || errorMessage;
        } catch (e) {}
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: errorMessage,
        });
      }
    };
    
    xhr.onerror = () => {
        setIsUploading(false);
        toast({
          variant: 'destructive',
          title: 'Network Error',
          description: 'Could not connect to the server. Please check your connection.',
        });
    };

    xhr.send(formData);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if(!isUploading) {
        onOpenChange(open);
        if(!open) {
          setTimeout(resetState, 300);
        }
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload New Pitch Deck</DialogTitle>
          <DialogDescription>
            Accepted formats: PDF, PPT, PPTX.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!file ? (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragOver ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}
            >
              <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-muted-foreground">PDF, PPT, or PPTX</p>
                </div>
                <input id="file-upload" type="file" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} accept=".pdf,.ppt,.pptx" />
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                  <div className="flex items-center gap-3">
                      <File className="h-6 w-6 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                        <span className="text-xs text-muted-foreground">{(file.size / (1024*1024)).toFixed(2)} MB</span>
                      </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)} disabled={isUploading}>
                      <X className="h-4 w-4" />
                  </Button>
              </div>
              {isUploading && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{uploadProgress}% complete</p>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isUploading ? 'Uploading...' : 'Upload & Analyze'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

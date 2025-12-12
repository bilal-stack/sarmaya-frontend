
'use client';
import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ReportPanelProps = {
    reportContent: string;
};

export function ReportPanel({ reportContent }: ReportPanelProps) {
    const reportRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const handleDownloadPdf = async () => {
        const element = reportRef.current;
        if (!element) return;
        
        toast({ title: "Generating PDF...", description: "Please wait while the report is being prepared." });

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#1a1a1a', // A dark color that matches the panel
                useCORS: true, 
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = pdfWidth / imgWidth;
            const finalHeight = imgHeight * ratio;

            let heightLeft = finalHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();

            while (heightLeft > 0) {
                position = heightLeft - finalHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalHeight);
                heightLeft -= pdf.internal.pageSize.getHeight();
            }

            pdf.save('investor-report.pdf');
            toast({ title: "Download Complete", description: "The report has been saved as a PDF." });

        } catch (error) {
            console.error("PDF generation failed:", error);
            toast({ variant: "destructive", title: "PDF Generation Failed", description: "An unexpected error occurred." });
        }
    };

    return (
        <div className="flex h-full flex-col bg-card/80 rounded-lg">
            <div className="flex h-14 items-center justify-between border-b px-4">
                <h3 className="text-lg font-semibold flex items-center gap-2"><FileText /> Generated Report</h3>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                </Button>
            </div>
            <ScrollArea className="flex-1">
                <div ref={reportRef} className="prose prose-sm prose-invert max-w-none p-4 bg-[#1a1a1a] rounded-b-lg">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportContent}</ReactMarkdown>
                </div>
            </ScrollArea>
        </div>
    );
}

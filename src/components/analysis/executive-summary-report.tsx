
'use client';
import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Lightbulb, Target, Cpu, LineChart, ShieldCheck, Briefcase, DraftingCompass, Users, Goal, Banknote, Download, FileText, FileVideo, FileType } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import pptxgen from 'pptxgenjs';
import { saveAs } from 'file-saver';
import { ExecutiveSummaryExport } from './executive-summary-export';


const sectionDetails = {
    introduction_company_overview: { icon: <Lightbulb className="h-6 w-6 text-primary" />, title: "Introduction & Company Overview" },
    problem_statement: { icon: <Target className="h-6 w-6 text-primary" />, title: "Problem Statement" },
    solution_technology: { icon: <Cpu className="h-6 w-6 text-primary" />, title: "Solution & Technology" },
    market_opportunity: { icon: <LineChart className="h-6 w-6 text-primary" />, title: "Market Opportunity" },
    clinical_preclinical_data: { icon: <DraftingCompass className="h-6 w-6 text-primary" />, title: "Clinical / Preclinical Data" },
    intellectual_property: { icon: <ShieldCheck className="h-6 w-6 text-primary" />, title: "Intellectual Property" },
    business_model: { icon: <Briefcase className="h-6 w-6 text-primary" />, title: "Business Model" },
    go_to_market_strategy: { icon: <Target className="h-6 w-6 text-primary" />, title: "Go-to-Market Strategy" },
    regulatory_pathway: { icon: <DraftingCompass className="h-6 w-6 text-primary" />, title: "Regulatory Pathway" },
    competition_competitive_advantage: { icon: <Users className="h-6 w-6 text-primary" />, title: "Competition & Competitive Advantage" },
    team: { icon: <Users className="h-6 w-6 text-primary" />, title: "Team" },
    financials: { icon: <Banknote className="h-6 w-6 text-primary" />, title: "Financials" },
    milestones_roadmap: { icon: <Goal className="h-6 w-6 text-primary" />, title: "Milestones & Roadmap" },
    ask: { icon: <Banknote className="h-6 w-6 text-primary" />, title: "The Ask" }
};

type SectionDetailKeys = keyof typeof sectionDetails;

export function ExecutiveSummaryReport({ report }: { report: any }) {
    const { toast } = useToast();
    const exportRef = useRef<HTMLDivElement>(null);

    const generateContentForDoc = () => {
        const children = [
            new Paragraph({
                text: "Executive Summary",
                heading: HeadingLevel.TITLE,
                alignment: 'center',
            }),
        ];

        for (const [key, value] of Object.entries(report)) {
            const details = sectionDetails[key as SectionDetailKeys];
            if (details) {
                children.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: details.title,
                            bold: true,
                            size: 28, // 14pt
                        }),
                    ],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 200 },
                }));
                children.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: value as string,
                            size: 24, // 12pt
                        }),
                    ],
                }));
            }
        }
        return children;
    };

    const handleExport = async (format: 'PDF' | 'Word' | 'PPT') => {
        toast({
            title: `Exporting to ${format}`,
            description: `Your executive summary is being prepared.`,
        });

        try {
            if (format === 'PDF') {
                const element = exportRef.current;
                if (element) {
                    const canvas = await html2canvas(element, {
                         scale: 2,
                         backgroundColor: '#0f0f0f' 
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = pdf.internal.pageSize.getHeight();
                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
                    const imgX = (pdfWidth - imgWidth * ratio) / 2;
                    const imgY = 10;
                    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
                    pdf.save('executive-summary.pdf');
                }
            } else if (format === 'Word') {
                const doc = new Document({
                    sections: [{
                        properties: {},
                        children: generateContentForDoc(),
                    }],
                });
                const blob = await Packer.toBlob(doc);
                saveAs(blob, 'executive-summary.docx');
            } else if (format === 'PPT') {
                const pptx = new pptxgen();
                pptx.layout = 'LAYOUT_WIDE';

                const titleSlide = pptx.addSlide();
                titleSlide.addText('Executive Summary', { x: 0.5, y: 2.5, w: '90%', h: 1, align: 'center', fontSize: 36, bold: true, color: '363636' });

                for (const [key, value] of Object.entries(report)) {
                    const details = sectionDetails[key as SectionDetailKeys];
                    if (details) {
                        const slide = pptx.addSlide();
                        slide.addText(details.title, { x: 0.5, y: 0.5, w: '90%', h: 0.75, fontSize: 24, bold: true, color: '363636' });
                        slide.addText(value as string, { x: 0.5, y: 1.5, w: '90%', h: 3.5, fontSize: 16, color: '363636' });
                    }
                }
                await pptx.writeFile({ fileName: 'executive-summary.pptx' });
            }

            toast({
                title: 'Export Complete',
                description: `Your executive summary has been exported as a ${format} file.`,
            });
        } catch (error) {
            console.error("Export failed:", error);
            toast({
                variant: 'destructive',
                title: 'Export Failed',
                description: `Could not generate the ${format} file. Please try again.`,
            });
        }
    };

    return (
        <div className="space-y-6 pt-4 text-white">
            <div ref={exportRef} className="absolute -left-[9999px] top-auto p-8 bg-[#0f0f0f] w-[210mm]">
                <ExecutiveSummaryExport report={report} sectionDetails={sectionDetails} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(report).map(([key, value]) => {
                    const details = sectionDetails[key as SectionDetailKeys];
                    if (!details) return null;

                    return (
                        <Card key={key} className="bg-card/50">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    {details.icon}
                                    <CardTitle>{details.title}</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm">{value as string}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            <Card className="bg-card/50">
                <CardFooter className="justify-end p-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Export Summary
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport('PDF')}>
                                <FileText className="mr-2 h-4 w-4" />
                                Export as PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('Word')}>
                                <FileType className="mr-2 h-4 w-4" />
                                Export as Word
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('PPT')}>
                                <FileVideo className="mr-2 h-4 w-4" />
                                Export as PPT
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardFooter>
            </Card>
        </div>
    );
}


'use client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, ChevronRight, HelpCircle, BookOpen, ThumbsUp, ThumbsDown, Star } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

const ScoreBadge = ({ score }: { score: string }) => {
    if (typeof score !== 'string' || !score.includes('/')) {
        return <Badge className="bg-gray-500 text-white">-</Badge>;
    }
    const [value, max] = score.split('/').map(Number);
    let colorClass = 'bg-gray-500';
    if (max) {
        const percentage = (value / max) * 100;
        if (percentage >= 80) colorClass = 'bg-green-500';
        else if (percentage >= 60) colorClass = 'bg-yellow-500 text-black';
        else colorClass = 'bg-red-500';
    }
    return <Badge className={`text-white ${colorClass}`}>{score}</Badge>;
}

const RedesignPlan = ({ plan }: { plan: any }) => (
    <Card className="bg-card/50 mt-4 border-primary/50">
        <CardHeader>
            <CardTitle className="text-xl">Redesign Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
            <div>
                <h4 className="font-semibold text-muted-foreground">New Title & Content</h4>
                <p><span className="font-bold">{plan.title}</span> - {plan.subtitle}</p>
                <p className="text-muted-foreground mt-1">{plan.content}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h4 className="font-semibold text-muted-foreground">Font Recommendations</h4>
                    <p>Primary: {plan.font_recommendations.primary_font}</p>
                    <p>Headings: {plan.font_recommendations.heading_hierarchy}</p>
                    {plan.font_recommendations.body_text !== "Not applicable for this slide" && <p>Body: {plan.font_recommendations.body_text}</p>}
                </div>
                <div>
                    <h4 className="font-semibold text-muted-foreground">Color Palette</h4>
                    <div className="flex gap-2 mt-1">
                        <div style={{ backgroundColor: plan.color_palette.primary_color }} className="w-6 h-6 rounded-full border border-white/20" title={`Primary: ${plan.color_palette.primary_color}`}></div>
                        <div style={{ backgroundColor: plan.color_palette.secondary_color }} className="w-6 h-6 rounded-full border border-white/20" title={`Secondary: ${plan.color_palette.secondary_color}`}></div>
                        <div style={{ backgroundColor: plan.color_palette.accent_color }} className="w-6 h-6 rounded-full border border-white/20" title={`Accent: ${plan.color_palette.accent_color}`}></div>
                        <div style={{ backgroundColor: plan.color_palette.text_color }} className="w-6 h-6 rounded-full border border-white/20" title={`Text: ${plan.color_palette.text_color}`}></div>
                    </div>
                </div>
            </div>
             <Separator />
            <div>
                <h4 className="font-semibold text-muted-foreground">Layout Suggestions</h4>
                <p>{plan.layout_suggestions}</p>
            </div>
            {plan.visual_elements?.length > 0 && (
                 <div>
                    <h4 className="font-semibold text-muted-foreground">Visual Elements</h4>
                    <ul className="list-disc list-inside">
                        {plan.visual_elements.map((el: string, i: number) => <li key={i}>{el}</li>)}
                    </ul>
                </div>
            )}
        </CardContent>
    </Card>
);

const CritiqueSection = ({ title, critique }: { title: string; critique: any }) => (
     <Card className="bg-card/50 border-none">
        <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="flex flex-col items-center">
                    <p className="font-semibold text-muted-foreground">Clarity</p>
                    <ScoreBadge score={critique.clarity_score} />
                </div>
                <div className="flex flex-col items-center">
                    <p className="font-semibold text-muted-foreground">Investor Relevance</p>
                    <ScoreBadge score={critique.investor_relevance_score} />
                </div>
                <div className="flex flex-col items-center">
                    <p className="font-semibold text-muted-foreground">Storytelling</p>
                    <ScoreBadge score={critique.storytelling_strength_score} />
                </div>
            </div>
             {title === 'Design Critique' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center pt-4">
                    <div className="flex flex-col items-center"><p className="font-semibold text-muted-foreground">Format</p><ScoreBadge score={critique.format_score} /></div>
                    <div className="flex flex-col items-center"><p className="font-semibold text-muted-foreground">Typography</p><ScoreBadge score={critique.typography_score} /></div>
                    <div className="flex flex-col items-center"><p className="font-semibold text-muted-foreground">Color</p><ScoreBadge score={critique.color_score} /></div>
                    <div className="flex flex-col items-center"><p className="font-semibold text-muted-foreground">Balance</p><ScoreBadge score={critique.visual_balance_score} /></div>
                </div>
            )}
            <Separator/>
            <div>
                <h4 className="font-semibold text-primary mb-2">Issues Identified</h4>
                <ul className="space-y-2">
                    {critique[title === 'Content Critique' ? 'issues_identified' : 'design_issues'].map((issue: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0"/>
                            <span>{issue}</span>
                        </li>
                    ))}
                </ul>
            </div>
            {critique.missing_elements?.length > 0 && (
                <div>
                    <h4 className="font-semibold text-primary mb-2">Missing Elements</h4>
                    <ul className="space-y-2">
                        {critique.missing_elements.map((item: string, index: number) => (
                            <li key={index} className="flex items-start gap-2">
                                <XCircle className="h-4 w-4 mt-0.5 text-red-500 shrink-0"/>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
             <div>
                <h4 className="font-semibold text-primary mb-2">Recommendations</h4>
                <ul className="space-y-2">
                    {critique[title === 'Content Critique' ? 'recommendations' : 'design_recommendations'].map((rec: string, index: number) => (
                         <li key={index} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 shrink-0"/>
                            <span>{rec}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </CardContent>
    </Card>
);

export function DetailedAnalysisReport({ report }: { report: any }) {

  return (
    <div className="space-y-6 pt-4 text-white">
        <Card className="bg-card/50">
            <CardHeader>
                <CardTitle>Detailed Analysis Overview</CardTitle>
                <CardDescription>Total Slides: {report.overview.total_slides}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Overall Score</h3>
                    <ScoreBadge score={report.overview.overall_score} />
                </div>
                <div>
                    <h4 className="font-semibold text-muted-foreground">Summary</h4>
                    <p className="text-sm">{report.overview.analysis_summary}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="font-semibold text-green-500 mb-2">Key Strengths</h4>
                        <ul className="space-y-2 text-sm">
                            {report.overview.key_strengths.map((item: string, index: number) => (
                                <li key={index} className="flex items-start gap-2"><ThumbsUp className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /><span>{item}</span></li>
                            ))}
                        </ul>
                    </div>
                     <div>
                        <h4 className="font-semibold text-red-500 mb-2">Critical Issues</h4>
                        <ul className="space-y-2 text-sm">
                            {report.overview.critical_issues.map((item: string, index: number) => (
                                <li key={index} className="flex items-start gap-2"><ThumbsDown className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /><span>{item}</span></li>
                            ))}
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <div>
            <h2 className="text-2xl font-bold mb-4 text-center font-headline">Slide-by-Slide Analysis</h2>
            <Accordion type="single" collapsible className="w-full space-y-4">
                {report.slide_analysis.map((slide: any) => (
                    <AccordionItem value={`slide-${slide.slide_number}`} key={slide.slide_number} className="border border-border/50 rounded-lg bg-card/50">
                        <AccordionTrigger className="p-4 hover:no-underline">
                           <div className="flex items-center gap-3">
                             <Badge variant="secondary" className="text-base">{slide.slide_number}</Badge>
                             <span className="font-semibold text-lg">{slide.slide_type.charAt(0).toUpperCase() + slide.slide_type.slice(1)}</span>
                           </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-0 space-y-4">
                            <div>
                                <h4 className="font-semibold text-muted-foreground">Current Content</h4>
                                <p className="text-sm italic">"{slide.current_content}"</p>
                            </div>
                            <Separator/>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                               <CritiqueSection title="Content Critique" critique={slide.content_critique} />
                               <CritiqueSection title="Design Critique" critique={slide.design_critique} />
                            </div>
                            <RedesignPlan plan={slide.redesign_plan} />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>

        <Card className="bg-card/50">
            <CardHeader>
                <CardTitle>Next Steps</CardTitle>
                <CardDescription>Recommendations for improving your pitch deck.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h4 className="font-semibold text-primary mb-2">Priority Fixes</h4>
                    <ul className="space-y-2 text-sm">
                        {report.next_steps.priority_fixes.map((item: string, index: number) => (
                            <li key={index} className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5"/><span>{item}</span></li>
                        ))}
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold text-primary mb-2">Implementation Order</h4>
                     <ol className="space-y-2 text-sm list-decimal list-inside">
                        {report.next_steps.implementation_order.map((item: string, index: number) => (
                            <li key={index}><span>{item}</span></li>
                        ))}
                    </ol>
                </div>
                <div>
                     <h4 className="font-semibold text-primary mb-2">Estimated Redesign Time</h4>
                     <p className="text-sm">{report.next_steps.estimated_redesign_time}</p>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}



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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, ChevronRight, HelpCircle, BookOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


const readinessThresholds = {
    "Strongly investable": "bg-green-500",
    "Promising but needs work": "bg-yellow-500",
    "High risk": "bg-red-500"
}

export function BasicAnalysisReport({ report }: { report: any }) {

  return (
    <div className="space-y-6 pt-4 text-white">
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger>
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <span className="font-semibold">View Legends</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <Card className="bg-card/50 border-none">
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm pt-4">
                            {report.legends?.rating && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-muted-foreground">Rating</h4>
                                    <ul className="space-y-1">
                                        {Object.entries(report.legends.rating).map(([key, value]) => (
                                            <li key={key} className="flex items-center gap-2">
                                                <span className="text-lg">{key}</span>
                                                <span>{value as string}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {report.legends?.investor_impact && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-muted-foreground">Investor Impact</h4>
                                    <ul className="space-y-1">
                                        {Object.entries(report.legends.investor_impact).map(([key, value]) => (
                                            <li key={key} className="flex items-center gap-2">
                                                <span className="text-lg">{key}</span>
                                                <span>{value as string}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {report.legends?.priority_to_fix && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-muted-foreground">Priority to Fix</h4>
                                     <ul className="space-y-1">
                                        {Object.entries(report.legends.priority_to_fix).map(([key, value]) => (
                                            <li key={key} className="flex items-center gap-2">
                                                <span className="text-lg">{key}</span>
                                                <span>{value as string}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
        </Accordion>

        <Card className="bg-card/50">
            <CardHeader>
                <CardTitle>Context Assessment</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="font-semibold text-muted-foreground">Category:</span> {report.context_assessment.startup_category}</div>
                <div><span className="font-semibold text-muted-foreground">Stage:</span> {report.context_assessment.funding_stage}</div>
                <div><span className="font-semibold text-muted-foreground">Raise Amount:</span> {report.context_assessment.target_raise_amount}</div>
                <div><span className="font-semibold text-muted-foreground">Product Phase:</span> {report.context_assessment.product_development_phase}</div>
                <div><span className="font-semibold text-muted-foreground">Resubmission:</span> {report.context_assessment.is_resubmission ? "Yes" : "No"}</div>
            </CardContent>
        </Card>
        
        <Card className="bg-card/50">
            <CardHeader>
                <CardTitle>Investor Readiness Index</CardTitle>
                <CardDescription>{report.investor_readiness_index.stage_sensitivity_note}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl font-bold">{report.investor_readiness_index.weighted_total.toFixed(1)}<span className="text-xl font-normal text-muted-foreground">/100</span></div>
                    <Badge className={`${readinessThresholds[report.investor_readiness_index.threshold_classification as keyof typeof readinessThresholds]}`}>{report.investor_readiness_index.threshold_classification}</Badge>
                </div>
                <div className="space-y-4">
                    {report.investor_readiness_index.categories.map((item: any, index: number) => (
                        <div key={index}>
                            <div className="flex justify-between mb-1 text-sm">
                                <span className="font-medium">{item.category} <span className="text-muted-foreground">({item.weight})</span></span>
                                <span>{item.score}/100</span>
                            </div>
                            <Progress value={item.score} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <Card className="bg-card/50">
            <CardHeader>
                <CardTitle>Category Analysis</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>Investor Impact</TableHead>
                            <TableHead>Priority to Fix</TableHead>
                            <TableHead>Recommendation</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {report.category_analysis.map((item: any, index: number) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{item.category}</TableCell>
                                <TableCell><span className="text-2xl">{item.rating}</span></TableCell>
                                <TableCell><span className="text-2xl">{item.investor_impact}</span></TableCell>
                                <TableCell><span className="text-2xl">{item.priority_to_fix}</span></TableCell>
                                <TableCell className="max-w-xs">{item.comments_and_recommendations}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Card className="bg-card/50">
            <CardHeader>
                <CardTitle>Life Science Focus</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                {Object.entries(report.life_science_focus).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 mt-1 text-primary"/>
                        <div>
                            <span className="font-semibold capitalize text-muted-foreground">{key.replace(/_/g, ' ')}: </span>
                            <span>{value as string}</span>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>

        <Card className="bg-card/50">
            <CardHeader>
                <CardTitle>Key Investor Questions</CardTitle>
                <CardDescription>Be prepared to answer these questions from potential investors.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3">
                    {report.investor_pushback_questions.map((question: string, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                            <HelpCircle className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                            <span>{question}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
        
        <Card className="bg-card/50">
            <CardHeader>
                <CardTitle>Next Steps</CardTitle>
                <CardDescription>Consider these follow-up actions to improve your pitch deck.</CardDescription>
            </CardHeader>
            <CardContent>
                 <ul className="space-y-2">
                    {report.next_steps.follow_up_options.map((option: string, index: number) => (
                        <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>{option}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    </div>
  );
}

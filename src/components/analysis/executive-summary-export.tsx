
'use client';
import { Lightbulb, Target, Cpu, LineChart, ShieldCheck, Briefcase, DraftingCompass, Users, Goal, Banknote } from "lucide-react";

const sectionDetails = {
    introduction_company_overview: { icon: <Lightbulb className="h-8 w-8 text-purple-400" />, title: "Introduction & Company Overview" },
    problem_statement: { icon: <Target className="h-8 w-8 text-purple-400" />, title: "Problem Statement" },
    solution_technology: { icon: <Cpu className="h-8 w-8 text-purple-400" />, title: "Solution & Technology" },
    market_opportunity: { icon: <LineChart className="h-8 w-8 text-purple-400" />, title: "Market Opportunity" },
    clinical_preclinical_data: { icon: <DraftingCompass className="h-8 w-8 text-purple-400" />, title: "Clinical / Preclinical Data" },
    intellectual_property: { icon: <ShieldCheck className="h-8 w-8 text-purple-400" />, title: "Intellectual Property" },
    business_model: { icon: <Briefcase className="h-8 w-8 text-purple-400" />, title: "Business Model" },
    go_to_market_strategy: { icon: <Target className="h-8 w-8 text-purple-400" />, title: "Go-to-Market Strategy" },
    regulatory_pathway: { icon: <DraftingCompass className="h-8 w-8 text-purple-400" />, title: "Regulatory Pathway" },
    competition_competitive_advantage: { icon: <Users className="h-8 w-8 text-purple-400" />, title: "Competition & Competitive Advantage" },
    team: { icon: <Users className="h-8 w-8 text-purple-400" />, title: "Team" },
    financials: { icon: <Banknote className="h-8 w-8 text-purple-400" />, title: "Financials" },
    milestones_roadmap: { icon: <Goal className="h-8 w-8 text-purple-400" />, title: "Milestones & Roadmap" },
    ask: { icon: <Banknote className="h-8 w-8 text-purple-400" />, title: "The Ask" }
};

type SectionDetailKeys = keyof typeof sectionDetails;


export function ExecutiveSummaryExport({ report, sectionDetails }: { report: any, sectionDetails: any }) {

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', color: '#E5E7EB', padding: '40px', backgroundColor: '#0f0f0f' }}>
            <h1 style={{ textAlign: 'center', color: '#D8BFD8', fontSize: '32px', borderBottom: '2px solid #581c87', paddingBottom: '10px', marginBottom: '40px' }}>
                Executive Summary
            </h1>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                {Object.entries(report).map(([key, value]) => {
                    const details = sectionDetails[key as SectionDetailKeys];
                    if (!details) return null;

                    return (
                        <div key={key} style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', border: '1px solid #374151' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <span style={{color: '#C4B5FD'}}>{details.icon}</span>
                                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#F3F4F6', margin: 0 }}>{details.title}</h2>
                            </div>
                            <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0, color: '#D1D5DB' }}>{value as string}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Bot, MessageSquare, ScanSearch, ArrowRight, Loader2, Inbox, Building2, Bot as BotIcon, Scale, UserCheck, ShieldCheck, ShoppingCart, Banknote, Landmark, ClipboardList, Gavel } from 'lucide-react';
import Link from 'next/link';

const tools = [
  {
    name: 'Decision Inbox',
    description: 'Everything waiting on you, reduced to its single most blocking next step — with SLA timers and one-click escalation.',
    icon: <Inbox className="h-8 w-8 text-primary" />,
    link: '/ai-tools/inbox',
  },
  {
    name: 'Vendor Review',
    description: 'Verify vendors that are blocking invoice approvals, ordered by the value each is holding up.',
    icon: <Building2 className="h-8 w-8 text-primary" />,
    link: '/ai-tools/vendors',
  },
  {
    name: 'Requisitions',
    description: 'What was asked for and why — the record every order traces back to. Approved before anyone goes to market, and the approved estimate is the ceiling.',
    icon: <ClipboardList className="h-8 w-8 text-primary" />,
    link: '/ai-tools/requisitions',
  },
  {
    name: 'Tenders',
    description: 'Invite vendors, capture their quotes, compare them side by side and award. Quotes lock when quoting closes, and picking anything but the cheapest needs a reason.',
    icon: <Gavel className="h-8 w-8 text-primary" />,
    link: '/ai-tools/rfqs',
  },
  {
    name: 'Purchase Orders',
    description: 'What the company has committed to buy — approved before it reaches the vendor, then matched against what actually arrived and what was billed.',
    icon: <ShoppingCart className="h-8 w-8 text-primary" />,
    link: '/ai-tools/purchase-orders',
  },
  {
    name: 'Invoices',
    description: 'View and manage all your invoices. Submit, approve, reject, or mark as paid directly from invoice details.',
    icon: <FileText className="h-8 w-8 text-primary" />,
    link: '/ai-tools/invoices',
  },
  {
    name: 'Invoice Upload',
    description: 'Upload and process new invoices with AI-powered OCR extraction and duplicate detection.',
    icon: <Upload className="h-8 w-8 text-primary" />,
    link: '/ai-tools/invoice-upload',
  },
  {
    name: 'Payments',
    description: 'Runs settling approved invoices, prepared by one person and released by another, ending in a bank file you upload yourself. No money moves from here.',
    icon: <Banknote className="h-8 w-8 text-primary" />,
    link: '/ai-tools/payments',
  },
  {
    name: 'Reconciliation',
    description: 'The bank statement against your own records. Finds released runs that never cleared, and — the one that matters — money that left without any instruction behind it.',
    icon: <Landmark className="h-8 w-8 text-primary" />,
    link: '/ai-tools/reconciliation',
  },
  {
    name: 'Detect Duplicates',
    description: 'Automatically identify and flag duplicate invoices across your system to prevent errors.',
    icon: <ScanSearch className="h-8 w-8 text-primary" />,
    link: '/ai-tools/detect-duplicate',
  },
  {
    name: 'Autopilot',
    description: 'Opt-in auto-approval for low-risk invoices, with a dry run that shows exactly what would be approved and why.',
    icon: <BotIcon className="h-8 w-8 text-primary" />,
    link: '/ai-tools/autopilot',
  },
  {
    name: 'Approval Matrix',
    description: 'The rules deciding who must approve an invoice, plus a simulator to test a threshold change against past invoices before it goes live.',
    icon: <Scale className="h-8 w-8 text-primary" />,
    link: '/ai-tools/policies',
  },
  {
    name: 'Delegation',
    description: 'Lend your approval authority for a fixed window while you are away. Segregation of duties still applies, and both parties are named in the audit trail.',
    icon: <UserCheck className="h-8 w-8 text-primary" />,
    link: '/ai-tools/delegations',
  },
  {
    name: 'Audit Console',
    description: 'Every AI action with the model and prompt behind it, and sealed evidence packs bundling a whole transaction chain under one hash.',
    icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    link: '/ai-tools/audit',
  },
  {
    name: 'AI Chatbot',
    description: 'Get instant answers and assistance from our AI-powered chatbot about your invoices.',
    icon: <Bot className="h-8 w-8 text-primary" />,
    link: '/ai-tools/ai-chatbot',
  },
  {
    name: 'Query Assistant',
    description: 'Ask complex questions and get detailed insights from our advanced query assistant.',
    icon: <MessageSquare className="h-8 w-8 text-primary" />,
    link: '/ai-tools/query-chatbot',
  },
];

export default function AiToolsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render anything if not authenticated (redirect is in progress)
  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col items-center p-4 md:p-8">
      <div className="text-center mb-12">
        <h1 className="font-headline text-4xl md:text-5xl font-bold">
          Explore Our AI Incorporated Tools
        </h1>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
          Leverage cutting-edge AI to manage invoices, automate workflows, and streamline your financial operations.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-7xl">
        {tools.map((tool) => (
          <Card
            key={tool.name}
            className="flex flex-col border-border/50 shadow-xl shadow-black/20 hover:border-primary/80 transition-all duration-300 ease-in-out transform hover:-translate-y-1"
          >
            <CardHeader className="items-start">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                {tool.icon}
              </div>
              <CardTitle className="font-headline text-2xl">{tool.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <CardDescription>{tool.description}</CardDescription>
            </CardContent>
            <CardContent>
               <Button asChild variant="outline" className="w-full">
                <Link href={tool.link}>
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

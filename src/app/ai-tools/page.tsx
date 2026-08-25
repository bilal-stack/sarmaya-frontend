'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card'; import { Button } from '@/components/ui/button'; import {   FileText, Upload, Bot, MessageSquare, ScanSearch, ArrowRight, Loader2, Inbox, Building2, Bot as BotIcon, Scale, UserCheck, ShieldCheck, ShoppingCart, Banknote, Landmark, ClipboardList, Gavel, Users, Eye, Mail, Gauge, Network, Activity, Boxes, Users2, Plug,
} from 'lucide-react';
import Link from 'next/link';

const tools = [
  {
    name: 'Control Room',
    description:
      'What is stuck, why, and what it is worth — with cycle times by role, exception causes by vendor, reconciliation health, evidence gaps, policy overrides and autopilot reversals behind it.',
    icon: <Gauge className="h-8 w-8 text-primary" />,
    link: '/ai-tools/control-room',
  },
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
    name: 'People',
    description:
      'Who works here, who is joining, and what is waiting on a signature. Pay and identifiers are masked unless your role is trusted with them, and nobody signs their own rise — or their own manager’s.',
    icon: <Users2 className="h-8 w-8 text-primary" />,
    link: '/ai-tools/hr',
  },
  {
    name: 'Inventory',
    description:
      'What is on hand, and why. Every balance is the sum of its movements rather than a number somebody edited — and an adjustment, the one way stock changes with no delivery behind it, needs a second pair of eyes.',
    icon: <Boxes className="h-8 w-8 text-primary" />,
    link: '/ai-tools/inventory',
  },
  {
    name: 'Org Units & Scopes',
    description:
      'A role says what somebody may do; it has never said what they may do it to. Assign a business unit, location or cost centre and they see that unit and everything beneath it — with no scope meaning the whole tenant, as before.',
    icon: <Network className="h-8 w-8 text-primary" />,
    link: '/ai-tools/org-units',
  },
  {
    name: 'System Health',
    description:
      'Whether the scheduled work is actually running. A job that stops raises nothing anywhere, so the only signal is how long it has been since it last ran — this is where that shows.',
    icon: <Activity className="h-8 w-8 text-primary" />,
    link: '/ai-tools/system',
  },
  {
    name: 'Accounting System',
    description:
      'Connect QuickBooks and released payments post to your own books as journal entries — after the money moves, never before. When a connection dies nothing errors; entries just stop arriving, so this is where that shows.',
    icon: <Plug className="h-8 w-8 text-primary" />,
    link: '/ai-tools/system/integrations',
  },
  {
    name: 'Change Watchlist',
    description:
      'Bank changes, vendor master edits and policy changes each move money or move the rules without touching an invoice, so nothing else surfaces them. Every one gets a second pair of eyes, recorded.',
    icon: <Eye className="h-8 w-8 text-primary" />,
    link: '/ai-tools/watchlist',
  },
  {
    name: 'Vendor Bank Changes',
    description:
      'Redirecting a vendor’s payments is the most common invoice fraud there is, so bank details cannot be edited — they move through a request someone else approves, then a cooling period before any payment may use them.',
    icon: <Landmark className="h-8 w-8 text-primary" />,
    link: '/ai-tools/vendors/bank-changes',
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
    name: 'People',
    description: 'Who has access and what each of them may do. Accounts are granted here — self-registration is closed, so authority is handed out by someone accountable for it.',
    icon: <Users className="h-8 w-8 text-primary" />,
    link: '/ai-tools/users',
  },
  {
    name: 'Notification Queue',
    description:
      'Approvals and escalations are queued with the action that produced them and sent by a scheduler. This is where you see the queue is actually moving — a stalled one means nobody is being told anything.',
    icon: <Mail className="h-8 w-8 text-primary" />,
    link: '/ai-tools/notifications',
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

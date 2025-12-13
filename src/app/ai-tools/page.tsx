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
import { FileText, Upload, Send, CheckCircle, XCircle, DollarSign, Bot, MessageSquare, ScanSearch, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

const tools = [
  {
    name: 'Invoices',
    description: 'View and manage all your invoices in one place.',
    icon: <FileText className="h-8 w-8 text-primary" />,
    link: '/ai-tools/invoices',
  },
  {
    name: 'Invoice Details',
    description: 'Access detailed information and history for any invoice.',
    icon: <FileText className="h-8 w-8 text-primary" />,
    link: '/ai-tools/invoice-details',
  },
  {
    name: 'Invoice Upload',
    description: 'Upload and process new invoices with AI-powered extraction.',
    icon: <Upload className="h-8 w-8 text-primary" />,
    link: '/ai-tools/invoice-upload',
  },
  {
    name: 'Invoice Submit for Approval',
    description: 'Submit invoices for approval workflow and track their status.',
    icon: <Send className="h-8 w-8 text-primary" />,
    link: '/ai-tools/invoice-submit',
  },
   {
    name: 'Invoice Approve',
    description: 'Review and approve pending invoices with a single click.',
    icon: <CheckCircle className="h-8 w-8 text-primary" />,
    link: '/ai-tools/invoice-approve',
  },
  {
    name: 'Invoice Reject',
    description: 'Reject invoices and provide feedback for corrections.',
    icon: <XCircle className="h-8 w-8 text-primary" />,
    link: '/ai-tools/invoice-reject',
  },
  {
    name: 'Invoice Mark as paid',
    description: 'Mark invoices as paid and update payment records.',
    icon: <DollarSign className="h-8 w-8 text-primary" />,
    link: '/ai-tools/invoice-mark-paid',
  },
  {
    name: 'AI Chatbot',
    description: 'Get instant answers and assistance from our AI-powered chatbot.',
    icon: <Bot className="h-8 w-8 text-primary" />,
    link: '/ai-tools/ai-chatbot',
  },
  {
    name: 'Query Chatbot',
    description: 'Ask complex questions and get detailed insights from our query assistant.',
    icon: <MessageSquare className="h-8 w-8 text-primary" />,
    link: '/ai-tools/query-chatbot',
  },
  {
    name: 'Detect Duplicate Tool',
    description: 'Automatically identify and flag duplicate invoices to prevent errors.',
    icon: <ScanSearch className="h-8 w-8 text-primary" />,
    link: '/ai-tools/detect-duplicate',
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

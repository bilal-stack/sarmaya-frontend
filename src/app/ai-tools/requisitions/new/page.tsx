'use client';

/**
 * Raising a requisition.
 *
 * No vendor field, deliberately. A requisition states a need; choosing who
 * supplies it is the sourcing step's decision, and naming a supplier here
 * would let the requester pre-select the winner before anyone has quoted.
 *
 * The justification is given the weight it deserves rather than being a
 * trailing "notes" box: it is the thing an approver is actually deciding on,
 * and the first thing an auditor reads. The server refuses a submission
 * without a real one, so the form says so up front instead of letting someone
 * type a request and discover the rule afterwards.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, ClipboardList, Plus, Trash2, Info } from 'lucide-react';

const MIN_JUSTIFICATION = 10;

type LineDraft = {
  description: string;
  quantity: string;
  estimated_unit_price: string;
};

const emptyLine = (): LineDraft => ({
  description: '',
  quantity: '1',
  estimated_unit_price: '',
});

const money = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function NewRequisitionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [justification, setJustification] = useState('');
  const [budgetCode, setBudgetCode] = useState('');
  const [department, setDepartment] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [isSaving, setIsSaving] = useState(false);

  const setLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );

  const total = lines.reduce(
    (sum, line) =>
      sum + (Number(line.quantity) || 0) * (Number(line.estimated_unit_price) || 0),
    0
  );

  const usableLines = lines.filter(
    (line) => line.description.trim() && Number(line.estimated_unit_price) > 0
  );
  const justificationShort = justification.trim().length < MIN_JUSTIFICATION;
  const canSubmit =
    Boolean(title.trim()) && !justificationShort && usableLines.length > 0 && !isSaving;

  const save = async () => {
    if (!user?.access_token) return;
    setIsSaving(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.REQUISITIONS.CREATE,
        {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            justification: justification.trim(),
            budget_code: budgetCode.trim() || null,
            department: department.trim() || null,
            needed_by: neededBy || null,
            lines: usableLines.map((line) => ({
              description: line.description.trim(),
              quantity: Number(line.quantity),
              estimated_unit_price: Number(line.estimated_unit_price),
            })),
          }),
        },
        user.access_token
      );
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: response.status === 403 ? 'Not permitted' : 'Could not raise it',
          description:
            typeof body.detail === 'string'
              ? body.detail
              : 'The requisition was not created.',
        });
        return;
      }
      toast({
        title: `Raised ${body.requisition_number}`,
        description: 'Submit it when you are ready for an approver to see it.',
      });
      router.push(`/ai-tools/requisitions/${body.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-primary" />
          Raise a request
        </h1>
        <p className="text-muted-foreground mt-1">
          What you need and why. A supplier is chosen later, by sourcing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">The need</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">What do you need?</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Laptops for the new engineers"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">Why do you need it?</Label>
            <Textarea
              id="justification"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Four engineers start on the 1st and have no machines."
            />
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-px shrink-0" />
              This is what the approver is deciding on, and the first thing anyone
              reviewing the purchase later will read.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget code</Label>
              <Input
                id="budget"
                value={budgetCode}
                onChange={(e) => setBudgetCode(e.target.value)}
                placeholder="ENG-2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="needed">Needed by</Label>
              <Input
                id="needed"
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What you are asking for</CardTitle>
          <CardDescription>
            Estimated prices — nobody has quoted yet. Comparing these against the
            quotes later is how you find out whether the estimate was optimistic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[12rem] space-y-1.5">
                <Label className="text-xs">Item</Label>
                <Input
                  value={line.description}
                  onChange={(e) => setLine(index, { description: e.target.value })}
                  placeholder="Developer laptop"
                />
              </div>
              <div className="w-20 space-y-1.5">
                <Label className="text-xs">Qty</Label>
                <Input
                  type="number"
                  min="0"
                  value={line.quantity}
                  onChange={(e) => setLine(index, { quantity: e.target.value })}
                />
              </div>
              <div className="w-32 space-y-1.5">
                <Label className="text-xs">Est. unit price</Label>
                <Input
                  type="number"
                  min="0"
                  value={line.estimated_unit_price}
                  onChange={(e) =>
                    setLine(index, { estimated_unit_price: e.target.value })
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={lines.length === 1}
                onClick={() => setLines((c) => c.filter((_, i) => i !== index))}
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLines((c) => [...c, emptyLine()])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add an item
          </Button>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estimated total</span>
            <span className="text-lg font-semibold">{money(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            The approval is granted against this figure. An order raised later
            cannot exceed it without the request being approved again.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSubmit}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Raise it
        </Button>
      </div>
    </div>
  );
}

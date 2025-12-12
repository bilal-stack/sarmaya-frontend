import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Check } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Trial',
    price: 'Free',
    pricePeriod: '',
    description: 'Get started with our basic features, completely free.',
    features: [
      'Access to Basic AI Tools',
      'Limited Project Creation',
      'Community Support',
    ],
    buttonText: 'Start Trial',
    isFeatured: false,
  },
  {
    name: 'Galsi Pro',
    price: '$79.77',
    pricePeriod: '/ month',
    description: 'Unlock the full potential with our Pro plan.',
    features: [
      'Access to All AI Tools',
      'Unlimited Project Creation',
      'Premium Support',
      'Advanced Analytics',
      'Early access to new features',
    ],
    buttonText: 'Purchase',
    isFeatured: true,
  },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col items-center p-4 md:p-8">
      <div className="text-center mb-12">
        <h1 className="font-headline text-4xl md:text-5xl font-bold">
          Find the perfect plan
        </h1>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
          Whether you&apos;re just starting out or need advanced features, we have a plan that&apos;s right for you.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`flex flex-col border-border/50 shadow-xl shadow-black/20 ${
              plan.isFeatured ? 'border-primary ring-2 ring-primary' : ''
            }`}
          >
            <CardHeader className="items-start">
              <CardTitle className="font-headline text-3xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="mb-6">
                <span className="text-5xl font-bold">{plan.price}</span>
                {plan.pricePeriod && (
                  <span className="text-muted-foreground">{plan.pricePeriod}</span>
                )}
              </div>
              <ul className="space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={plan.isFeatured ? 'default' : 'outline'}
              >
                {plan.buttonText}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

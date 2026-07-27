import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle2, Factory, Gauge, Ship, Wallet } from 'lucide-react';
import platformApi from '../../services/platform.api';
import { formatPaisaToRupees } from '../../utils/currency';

interface ModuleRef {
  id: string;
  key: string;
  name: string;
}

interface PublicPlan {
  id: string;
  name: string;
  code: string;
  pricePaisa: string;
  billingCycleDays: number;
  trialDays: number;
  maxSubCompanies: number;
  maxUsers: number | null;
  planModules: { module: ModuleRef }[];
}

const FEATURES = [
  { icon: Factory, title: 'Shift-based production', text: 'Log output per shift and machine, with automatic raw-material consumption and FIFO batch costing.' },
  { icon: Gauge, title: 'Built-in cost control', text: 'Electricity-usage validation, per-variant cost pricing, and monthly overhead allocation out of the box.' },
  { icon: Ship, title: 'Dispatch to ledger, atomically', text: 'A gate pass deducts stock and posts to the client ledger in one transaction — never out of sync.' },
  { icon: Wallet, title: 'Real double-entry accounting', text: 'Chart of accounts, journal entries, general ledger, and trial balance — not a spreadsheet pretending to be one.' },
];

export function LandingPage() {
  const { data: plans, isLoading: plansLoading } = useQuery<PublicPlan[]>({
    queryKey: ['marketing', 'plans'],
    queryFn: async () => (await platformApi.get<{ data: PublicPlan[] }>('/plans/public')).data.data,
  });

  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);

  const openSignup = (code: string) => {
    setSelectedPlanCode(code);
    setShowSignup(true);
    requestAnimationFrame(() => document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' }));
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold">Factory Ledger</span>
          <a href="#signup" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            Start free trial
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Production-to-ledger software for factories that make physical things
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
          Track raw material, shifts, and machines on the floor; dispatch to clients with QR-verified gate passes;
          keep a real double-entry ledger — all in one system built for small and mid-size manufacturers.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a href="#signup" className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-800">
            Start your 3-day free trial
          </a>
          <a href="#plans" className="rounded-lg border px-6 py-3 font-medium hover:bg-gray-50">
            See plans
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-gray-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white">
                <Icon size={20} />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold">Simple, transparent pricing</h2>
          <p className="mt-2 text-gray-600">Every plan starts with a 3-day free trial. No card required to start.</p>
        </div>

        {plansLoading ? (
          <p className="text-center text-gray-500">Loading plans...</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(plans ?? []).map((plan) => (
              <div key={plan.id} className="flex flex-col rounded-2xl border p-6 shadow-sm">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="mt-2 text-3xl font-bold">
                  {formatPaisaToRupees(Number(plan.pricePaisa))}
                  <span className="text-base font-normal text-gray-500"> / {plan.billingCycleDays} days</span>
                </p>
                <p className="mt-1 text-sm text-gray-500">{plan.trialDays}-day free trial</p>
                <p className="mt-1 text-sm text-gray-500">
                  Up to {plan.maxSubCompanies} sub-compan{plan.maxSubCompanies === 1 ? 'y' : 'ies'}
                  {plan.maxUsers ? `, ${plan.maxUsers} users` : ''}
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.planModules.map(({ module }) => (
                    <li key={module.id} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
                      {module.name}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => openSignup(plan.code)}
                  className="mt-6 rounded-lg bg-gray-900 py-2.5 font-medium text-white hover:bg-gray-800"
                >
                  Start free trial
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Signup */}
      <section id="signup" className="border-t bg-gray-50 py-20">
        <div className="mx-auto max-w-lg px-4">
          <h2 className="mb-6 text-center text-2xl font-bold">Create your account</h2>
          {showSignup || selectedPlanCode ? (
            <SignupForm plans={plans ?? []} initialPlanCode={selectedPlanCode} />
          ) : (
            <div className="text-center">
              <p className="mb-4 text-gray-600">Pick a plan above to get started, or</p>
              <button onClick={() => setShowSignup(true)} className="rounded-lg border px-5 py-2.5 font-medium hover:bg-white">
                Continue without picking yet
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SignupForm({ plans, initialPlanCode }: { plans: PublicPlan[]; initialPlanCode: string | null }) {
  const [organizationName, setOrganizationName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [industry, setIndustry] = useState('');
  const [adminUserName, setAdminUserName] = useState('');
  const [planCode, setPlanCode] = useState(initialPlanCode ?? plans[0]?.code ?? '');
  const [result, setResult] = useState<{ organizationName: string; slug: string; trialEndsAt: string } | null>(null);

  const signupMutation = useMutation({
    mutationFn: async () => {
      const res = await platformApi.post('/organizations/signup', {
        organizationName,
        contactName,
        contactEmail,
        contactPhone: contactPhone || undefined,
        industry: industry || undefined,
        adminUserName,
        planCode,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setResult({ organizationName: data.organization.name, slug: data.organization.slug, trialEndsAt: data.subscription.trialEndsAt });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    signupMutation.mutate();
  };

  if (result) {
    const trialEnd = new Date(result.trialEndsAt);
    return (
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
        <CheckCircle2 size={40} className="mx-auto mb-3 text-green-600" />
        <h3 className="text-lg font-semibold">Welcome, {result.organizationName}!</h3>
        <p className="mt-2 text-sm text-gray-600">
          Your 3-day free trial has started and runs until{' '}
          <strong>{trialEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>.
          Log in with the admin name you just chose to get started — no password needed yet, just pick your name on
          the login screen.
        </p>
        <a
          href={`/login?org=${result.slug}`}
          className="mt-5 inline-block rounded-lg bg-gray-900 px-5 py-2.5 font-medium text-white hover:bg-gray-800"
        >
          Go to login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
      <Field label="Company / factory name">
        <input required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
      </Field>
      <Field label="Your name">
        <input required value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
      </Field>
      <Field label="Email">
        <input required type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
      </Field>
      <Field label="Phone (optional)">
        <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
      </Field>
      <Field label="Industry (optional)">
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="e.g. Plastics, Textiles, Packaging"
          className="w-full rounded-lg border px-3 py-2"
        />
      </Field>
      <Field label="Your display name for login (kiosk-style, no password)">
        <input required value={adminUserName} onChange={(e) => setAdminUserName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
      </Field>
      <Field label="Plan">
        <select required value={planCode} onChange={(e) => setPlanCode(e.target.value)} className="w-full rounded-lg border px-3 py-2">
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} — {formatPaisaToRupees(Number(p.pricePaisa))}/{p.billingCycleDays}d
            </option>
          ))}
        </select>
      </Field>

      {signupMutation.isError && (
        <p className="text-sm text-red-600">
          {(signupMutation.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
            'Something went wrong — please try again.'}
        </p>
      )}

      <button
        type="submit"
        disabled={signupMutation.isPending || !planCode}
        className="w-full rounded-lg bg-gray-900 py-2.5 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {signupMutation.isPending ? 'Creating your account...' : 'Start free trial'}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

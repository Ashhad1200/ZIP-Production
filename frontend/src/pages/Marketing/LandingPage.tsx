import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CheckCircle2,
  Factory,
  Gauge,
  Ship,
  Wallet,
  Package,
  Building2,
  ChevronDown,
} from 'lucide-react';
import platformApi from '../../services/platform.api';
import { formatPaisaToRupees } from '../../utils/currency';

// ─── Design tokens — black & white theme (section layout/rhythm still
// follows https://fitzonepro.bdmatrix.org/, but the accent color is dropped
// in favor of pure monochrome; CTAs invert bg/text depending on section) ───
const INK = '#000000'; // pure black, used for dark bookend sections
const INK_TEXT = '#000000'; // black body text on light sections
const PAPER = '#ffffff'; // pure white
const SURFACE = '#f5f5f5'; // light gray, for cards on white
const BORDER = '#e5e5e5';
const BORDER_LIGHT = '#ececec';
const BORDER_CARD = '#e0e0e0';
const MUTED = '#6b6b6b';
const MUTED_LIGHT = '#9a9a9a';
const CHIP_BG = '#f0f0f0';
const CHIP_TEXT = '#000000';
// CTAs invert per section so they stay visible on both black and white backgrounds.
const CTA_ON_DARK = { background: PAPER, color: INK }; // white button, for use on black sections
const CTA_ON_LIGHT = { background: INK, color: PAPER }; // black button, for use on white/gray sections

const sora = { fontFamily: "'Sora', -apple-system, sans-serif" };

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
  { icon: Factory, title: 'Shift-based production', text: 'Log output per shift and machine, with automatic raw-material consumption.' },
  { icon: Package, title: 'FIFO batch costing', text: 'Every purchase lot is consumed oldest-first, automatically, down to the bag.' },
  { icon: Gauge, title: 'Built-in cost control', text: 'Electricity-usage validation, per-variant cost pricing, monthly overhead allocation.' },
  { icon: Ship, title: 'Dispatch to ledger, atomically', text: 'A gate pass deducts stock and posts to the client ledger in one transaction.' },
  { icon: Wallet, title: 'Real double-entry accounting', text: 'Chart of accounts, journal entries, general ledger, and trial balance.' },
  { icon: Building2, title: 'Multi-branch ready', text: 'Run more than one plant or sub-company under a single subscription, fully isolated.' },
];

const FAQS = [
  {
    q: 'How does the free trial work?',
    a: "Every plan starts with a 3-day trial — no card required. You get full access to your plan's modules until the trial ends.",
  },
  {
    q: 'How do I pay after the trial?',
    a: "We don't run card payments yet — pay by bank transfer, upload your receipt, and our team verifies it manually, usually within a few hours.",
  },
  {
    q: 'Can I run more than one plant or branch?',
    a: "Yes — your plan's sub-company limit controls how many plants or branches you can add under one account.",
  },
  {
    q: 'Is my data isolated from other companies on the platform?',
    a: 'Yes. Every organization is scoped at the database level — no other tenant can see or touch your records.',
  },
  {
    q: 'Does it work without internet on the factory floor?',
    a: "Write actions queue locally and sync automatically once you're back online, so a spotty shop-floor connection won't block data entry.",
  },
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
    <div style={{ ...sora, background: PAPER, color: INK_TEXT }} className="min-h-screen pb-20 lg:pb-0">
      <Nav />
      <Hero />
      <FeaturesSection />
      <Founder />
      <PlansSection plans={plans} plansLoading={plansLoading} onPick={openSignup} />
      <SignupSection plans={plans ?? []} selectedPlanCode={selectedPlanCode} showSignup={showSignup} onShow={() => setShowSignup(true)} />
      <Faq />
      <CtaFooter />
      <StickyMobileCta />
    </div>
  );
}

// ─── Nav ────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <div style={{ background: INK }} className="sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
        <div style={{ background: PAPER, color: INK }} className="inline-flex items-center rounded-xl px-3 py-1.5 text-sm font-extrabold tracking-tight">
          Factory Ledger
        </div>
        <div className="hidden items-center gap-7 lg:flex">
          <a href="#features" className="text-sm font-medium" style={{ color: '#ffffffb3' }}>Features</a>
          <a href="#plans" className="text-sm font-medium" style={{ color: '#ffffffb3' }}>Pricing</a>
          <a href="#faq" className="text-sm font-medium" style={{ color: '#ffffffb3' }}>FAQ</a>
          <a href="/login" className="text-sm font-medium" style={{ color: '#ffffffb3' }}>Log in</a>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="text-xs font-semibold text-white lg:hidden"
          >
            Log in
          </a>
          <a
            href="#signup"
            style={CTA_ON_DARK}
            className="hidden rounded-full px-5 py-2.5 text-sm font-bold lg:inline-block"
          >
            Start Free Trial
          </a>
          <a
            href="#signup"
            className="inline-block rounded-full border px-3.5 py-2 text-xs font-semibold text-white lg:hidden"
            style={{ borderColor: '#ffffff40' }}
          >
            Get Started
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

const BAR_HEIGHTS = [42, 58, 50, 70, 63, 88, 100];

function Hero() {
  return (
    <div style={{ background: INK, color: PAPER }} className="overflow-hidden px-5 pt-10 lg:px-8 lg:pt-0">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:py-20">
        <div>
          <h1 className="text-[36px] font-extrabold leading-[1.12] tracking-[-0.03em] lg:text-[56px] lg:leading-[1.06] lg:tracking-[-0.035em]">
            Run Your Factory Like a Business, Not a Notebook.
          </h1>
          <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed lg:mt-5 lg:max-w-[46ch] lg:text-lg" style={{ color: '#ffffffa6' }}>
            Track raw material, shifts, and machines on the floor; dispatch to clients with QR-verified gate
            passes; keep a real double-entry ledger — all in one system built for small and mid-size manufacturers.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-xs font-semibold text-white lg:mt-6 lg:text-[13px]">
            <span>PKR billing</span>
            <span style={{ color: '#ffffff4d' }}>·</span>
            <span>Double-entry ledger</span>
            <span style={{ color: '#ffffff4d' }}>·</span>
            <span>Works on the shop floor</span>
          </div>
          <a
            href="#signup"
            style={CTA_ON_DARK}
            className="mt-6 block w-full rounded-2xl py-[17px] text-center text-base font-bold lg:mt-8 lg:inline-block lg:w-auto lg:px-9 lg:py-[18px] lg:text-[17px]"
          >
            Start your 3-day free trial
          </a>
        </div>

        {/* Stat-card mockup */}
        <div
          style={{ background: PAPER, color: INK_TEXT, boxShadow: '0 -12px 40px #0006' }}
          className="-mx-1 -mb-10 mt-8 rounded-t-[20px] p-[18px] lg:m-0 lg:rounded-[20px] lg:p-[22px] lg:shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
        >
          <div className="mb-3.5 flex items-center justify-between lg:mb-4">
            <span className="text-xs font-bold lg:text-[13px]">Your Factory — Today</span>
            <span style={{ background: CHIP_BG, color: CHIP_TEXT }} className="rounded-full px-2 py-1 text-[10px] font-semibold lg:px-2.5 lg:text-[11px]">
              FIFO costing auto-applied
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:gap-3">
            <div style={{ background: SURFACE }} className="rounded-xl p-3 lg:p-3.5">
              <div className="text-[10px] font-semibold lg:text-[11px]" style={{ color: MUTED }}>Meters produced today</div>
              <div className="text-xl font-extrabold tracking-[-0.02em] lg:text-2xl">1,240 m</div>
            </div>
            <div style={{ background: SURFACE }} className="rounded-xl p-3 lg:p-3.5">
              <div className="text-[10px] font-semibold lg:text-[11px]" style={{ color: MUTED }}>Revenue this month</div>
              <div className="text-xl font-extrabold tracking-[-0.02em] lg:text-2xl">PKR 2.4M</div>
            </div>
          </div>
          <div className="mt-3.5 flex h-[52px] items-end gap-1.5 px-1 lg:mt-4 lg:h-[72px] lg:gap-2">
            {BAR_HEIGHTS.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%`, background: i >= 5 ? INK : BORDER }}
                className="flex-1 rounded-t"
              />
            ))}
          </div>
          <div className="mt-2.5 flex justify-between border-t pt-2.5 lg:mt-3 lg:pt-3" style={{ borderColor: BORDER_LIGHT }}>
            <span className="text-[11px] lg:text-xs" style={{ color: MUTED }}>Gate passes dispatched today</span>
            <span className="text-[11px] font-bold lg:text-xs">6</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Features ───────────────────────────────────────────────────────────────

function FeaturesSection() {
  return (
    <div id="features" className="px-5 py-14 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-5 max-w-[22ch] text-[26px] font-extrabold leading-tight tracking-[-0.03em] lg:mb-10 lg:text-[38px] lg:leading-[1.15]">
          See your whole factory in one screen
        </h2>
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          {/* Illustrative mini-mockup, standing in for a product screenshot */}
          <div
            style={{
              background: INK,
              backgroundImage: 'repeating-linear-gradient(45deg, #1a1a1a 0 16px, #000000 16px 32px)',
            }}
            className="flex aspect-video items-center justify-center rounded-[20px]"
          >
            <div style={{ background: PAPER }} className="rounded-2xl px-6 py-5 text-center shadow-2xl">
              <p style={{ color: INK }} className="text-sm font-bold">Production · Inventory · Dispatch</p>
              <p style={{ color: MUTED }} className="mt-1 text-xs">One ledger, every module</p>
            </div>
          </div>

          <div className="grid gap-5 lg:gap-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3.5 lg:gap-4">
                <div style={{ background: INK }} className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
                  <Icon size={14} style={{ color: PAPER }} />
                </div>
                <div>
                  <div className="text-[15px] font-bold tracking-[-0.01em] lg:text-base">{title}</div>
                  <div className="mt-0.5 text-[13px] leading-relaxed lg:text-sm" style={{ color: MUTED }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Founder ────────────────────────────────────────────────────────────────

function Founder() {
  return (
    <div className="px-5 py-14 text-center lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="mx-auto mb-5 max-w-[32ch] text-sm leading-relaxed lg:mb-6 lg:max-w-[44ch] lg:text-base" style={{ color: MUTED }}>
          Built after replacing a real plastic zipper manufacturer's production register, WhatsApp dispatch logs,
          and Excel ledger with one system.
        </p>
        <div
          style={{ background: 'repeating-linear-gradient(45deg, #e4e6de 0 10px, #edeee8 10px 20px)' }}
          className="mx-auto flex h-[120px] w-[120px] items-center justify-center rounded-full lg:h-[140px] lg:w-[140px]"
        >
          <span className="font-mono text-[10px] lg:text-[11px]" style={{ color: MUTED_LIGHT }}>founder photo</span>
        </div>
        <div className="mt-4 text-xl font-extrabold tracking-[-0.02em] lg:mt-4.5 lg:text-2xl">Ashhad</div>
        <div className="mt-1 text-[13px]" style={{ color: MUTED_LIGHT }}>Founder, BD Matrix</div>
      </div>
    </div>
  );
}

// ─── Plans ──────────────────────────────────────────────────────────────────

function PlansSection({
  plans,
  plansLoading,
  onPick,
}: {
  plans?: PublicPlan[];
  plansLoading: boolean;
  onPick: (code: string) => void;
}) {
  return (
    <div id="plans" style={{ background: SURFACE }} className="px-5 py-14 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h2 className="text-[26px] font-extrabold tracking-[-0.03em] lg:text-[38px]">Simple, transparent pricing</h2>
          <p className="mt-2 text-sm lg:text-base" style={{ color: MUTED }}>
            Every plan starts with a 3-day free trial. No card required to start.
          </p>
        </div>

        {plansLoading ? (
          <p className="text-center text-sm" style={{ color: MUTED }}>Loading plans...</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(plans ?? []).map((plan) => (
              <div key={plan.id} style={{ background: PAPER, borderColor: BORDER_CARD }} className="flex flex-col rounded-2xl border p-6">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="mt-2 text-3xl font-extrabold tracking-[-0.02em]">
                  {formatPaisaToRupees(Number(plan.pricePaisa))}
                  <span className="text-base font-normal" style={{ color: MUTED }}> / {plan.billingCycleDays} days</span>
                </p>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>{plan.trialDays}-day free trial</p>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>
                  Up to {plan.maxSubCompanies} sub-compan{plan.maxSubCompanies === 1 ? 'y' : 'ies'}
                  {plan.maxUsers ? `, ${plan.maxUsers} users` : ''}
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.planModules.map(({ module }) => (
                    <li key={module.id} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: INK }} />
                      {module.name}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onPick(plan.code)}
                  style={CTA_ON_LIGHT}
                  className="mt-6 rounded-full py-2.5 font-bold"
                >
                  Start free trial
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Signup ─────────────────────────────────────────────────────────────────

function SignupSection({
  plans,
  selectedPlanCode,
  showSignup,
  onShow,
}: {
  plans: PublicPlan[];
  selectedPlanCode: string | null;
  showSignup: boolean;
  onShow: () => void;
}) {
  return (
    <div id="signup" className="px-5 py-14 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-lg">
        <h2 className="mb-6 text-center text-2xl font-extrabold tracking-[-0.02em]">Create your account</h2>
        {showSignup || selectedPlanCode ? (
          <SignupForm plans={plans} initialPlanCode={selectedPlanCode} />
        ) : (
          <div className="text-center">
            <p className="mb-4 text-sm" style={{ color: MUTED }}>Pick a plan above to get started, or</p>
            <button
              onClick={onShow}
              style={{ borderColor: BORDER_CARD }}
              className="rounded-full border px-5 py-2.5 font-semibold"
            >
              Continue without picking yet
            </button>
          </div>
        )}
      </div>
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [planCode, setPlanCode] = useState(initialPlanCode ?? plans[0]?.code ?? '');
  const [result, setResult] = useState<{ organizationName: string; slug: string; trialEndsAt: string } | null>(null);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const signupMutation = useMutation({
    mutationFn: async () => {
      const res = await platformApi.post('/organizations/signup', {
        organizationName,
        contactName,
        contactEmail,
        contactPhone: contactPhone || undefined,
        industry: industry || undefined,
        adminUserName,
        password,
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
    if (passwordMismatch) return;
    signupMutation.mutate();
  };

  if (result) {
    const trialEnd = new Date(result.trialEndsAt);
    return (
      <div style={{ background: PAPER, borderColor: BORDER_CARD }} className="rounded-2xl border p-6 text-center">
        <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: INK }} />
        <h3 className="text-lg font-bold">Welcome, {result.organizationName}!</h3>
        <p className="mt-2 text-sm" style={{ color: MUTED }}>
          Your 3-day free trial has started and runs until{' '}
          <strong style={{ color: INK_TEXT }}>{trialEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>.
          Log in with the email and password you just chose to get started.
        </p>
        <a
          href="/login"
          style={{ background: INK, color: PAPER }}
          className="mt-5 inline-block rounded-full px-5 py-2.5 font-bold"
        >
          Go to login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: PAPER, borderColor: BORDER_CARD }} className="space-y-4 rounded-2xl border p-6">
      <Field label="Company / factory name">
        <input required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="input-field" />
      </Field>
      <Field label="Your name">
        <input required value={contactName} onChange={(e) => setContactName(e.target.value)} className="input-field" />
      </Field>
      <Field label="Email (this is your login)">
        <input required type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="input-field" />
      </Field>
      <Field label="Phone (optional)">
        <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="input-field" />
      </Field>
      <Field label="Industry (optional)">
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="e.g. Plastics, Textiles, Packaging"
          className="input-field"
        />
      </Field>
      <Field label="Your display name">
        <input required value={adminUserName} onChange={(e) => setAdminUserName(e.target.value)} className="input-field" />
      </Field>
      <Field label="Password">
        <input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" />
      </Field>
      <Field label="Confirm password">
        <input required minLength={8} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" />
        {passwordMismatch && <p className="mt-1 text-xs text-red-600">Passwords don't match</p>}
      </Field>
      <Field label="Plan">
        <select required value={planCode} onChange={(e) => setPlanCode(e.target.value)} className="input-field">
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
        disabled={signupMutation.isPending || !planCode || passwordMismatch}
        style={CTA_ON_LIGHT}
        className="w-full rounded-full py-2.5 font-bold disabled:opacity-50"
      >
        {signupMutation.isPending ? 'Creating your account...' : 'Start free trial'}
      </button>

      <style>{`
        .input-field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid ${BORDER_CARD};
          padding: 0.5rem 0.75rem;
          background: ${PAPER};
          color: ${INK_TEXT};
        }
        .input-field:focus {
          outline: none;
          border-color: ${INK};
          box-shadow: 0 0 0 3px ${CHIP_BG};
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium" style={{ color: MUTED }}>{label}</span>
      {children}
    </label>
  );
}

// ─── FAQ ────────────────────────────────────────────────────────────────────

function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div id="faq" className="px-5 py-14 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-5 text-[26px] font-extrabold tracking-[-0.03em] lg:mb-7 lg:text-[38px]">Frequently asked questions</h2>
        <div className="flex flex-col gap-2.5 lg:gap-3">
          {FAQS.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.q} style={{ background: SURFACE }} className="overflow-hidden rounded-2xl">
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-bold lg:min-h-0 lg:px-5 lg:py-5 lg:text-base"
                >
                  {item.q}
                  <ChevronDown
                    size={18}
                    style={{ color: MUTED_LIGHT, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
                    className="shrink-0"
                  />
                </button>
                {open && (
                  <p className="px-4 pb-4 text-[13px] leading-relaxed lg:px-5 lg:pb-5 lg:text-sm" style={{ color: MUTED }}>
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── CTA + Footer ───────────────────────────────────────────────────────────

function CtaFooter() {
  return (
    <div style={{ background: INK, color: PAPER }} className="px-5 py-12 lg:px-8">
      <div className="mx-auto max-w-6xl lg:py-20">
        <div className="flex flex-wrap items-center justify-between gap-8 lg:gap-10">
          <div>
            <h2 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] lg:text-[38px] lg:leading-[1.15]">
              Ready to get your factory off the register?
            </h2>
            <p className="mt-3 text-sm lg:text-[15px]" style={{ color: '#ffffff99' }}>
              Start your free trial today — no card required.
            </p>
          </div>
          <a
            href="#signup"
            style={CTA_ON_DARK}
            className="block w-full shrink-0 rounded-2xl py-[17px] text-center text-base font-bold lg:w-auto lg:px-9 lg:py-[18px] lg:text-[17px]"
          >
            Start Free Trial
          </a>
        </div>

        <div className="mt-11 flex flex-wrap items-start justify-between gap-6 border-t pt-7 lg:mt-14 lg:pt-8" style={{ borderColor: '#ffffff1f' }}>
          <div>
            <div style={{ background: PAPER, color: INK }} className="inline-flex items-center rounded-xl px-3 py-1.5 text-sm font-extrabold tracking-tight">
              Factory Ledger
            </div>
            <p className="mt-2.5 text-xs" style={{ color: '#ffffff80' }}>
              Production-to-ledger software for Pakistani manufacturers.
            </p>
            <div className="mt-4 flex gap-6 text-xs" style={{ color: '#ffffffb3' }}>
              <a href="#features">Features</a>
              <a href="#plans">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: '#ffffff59' }}>© 2026 BD Matrix. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Sticky mobile CTA ──────────────────────────────────────────────────────

function StickyMobileCta() {
  return (
    <div
      style={{ background: 'linear-gradient(transparent, #000000eb 40%)' }}
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-5 pt-3 lg:hidden"
    >
      <a
        href="#signup"
        style={{ ...CTA_ON_DARK, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}
        className="block rounded-2xl py-4 text-center text-[15px] font-bold"
      >
        Start Free Trial
      </a>
    </div>
  );
}

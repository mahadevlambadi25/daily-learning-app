import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck, Headphones, ListChecks, ShieldCheck, Sparkles, Target, Timer } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/config";
import { getTopicCatalogue } from "@/server/topics";
import { MarketingHeader } from "@/components/marketing-header";
import { SiteFooter } from "@/components/site-footer";
import { CountUp, Parallax, Reveal } from "@/components/motion";
import { TopicIcon } from "@/components/topic-icon";
import { LinkButton } from "@/components/ui";

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) redirect(user.profile.onboardedAt ? "/today" : "/onboarding/topics");

  const topics = await getTopicCatalogue();
  const featured = topics.filter((t) => t.isFeatured);

  return (
    <>
      <MarketingHeader />
      <main id="main">
        {/* ---- Hero ---- */}
        <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
          <div className="grain pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          <Parallax speed={0.25} className="pointer-events-none absolute -top-32 right-[-10%] size-[520px] sm:size-[680px]">
            <div className="sun-glow size-full rounded-full" aria-hidden />
          </Parallax>
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-sm font-semibold text-muted backdrop-blur">
                  <Sparkles className="size-4 text-accent" aria-hidden /> 2-4 minute lessons, picked for you
                </span>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="mt-6 font-display text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
                  Learn something <span className="italic text-accent">useful</span> every day.
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
                  {APP_NAME} turns the world&apos;s most useful knowledge into short lessons you can read, listen to and apply
                  every day. Choose what matters to you, and we&apos;ll do the rest.
                </p>
              </Reveal>
              <Reveal delay={240} className="mt-9 flex flex-wrap items-center gap-4">
                <LinkButton href="/signup" size="lg" className="group">
                  Get started free
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
                </LinkButton>
                <span className="text-sm text-muted">No card needed · Change topics anytime</span>
              </Reveal>
            </div>

            {/* Floating lesson cards with layered parallax */}
            <div className="relative mx-auto h-[420px] w-full max-w-sm sm:h-[460px]" aria-hidden>
              <Parallax speed={0.08} className="absolute inset-x-6 top-10">
                <div className="rotate-[-6deg] rounded-3xl border border-line bg-surface-2 p-5 opacity-70 shadow-card">
                  <div className="h-3 w-24 rounded-full bg-line" />
                  <div className="mt-4 h-4 w-3/4 rounded-full bg-line" />
                  <div className="mt-2 h-4 w-1/2 rounded-full bg-line" />
                </div>
              </Parallax>
              <Parallax speed={-0.06} className="absolute inset-x-0 top-24">
                <div className="animate-float rounded-3xl border border-line bg-surface p-6 shadow-lift">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-accent uppercase">
                    <TopicIcon iconKey="clock" className="size-4" /> Productivity
                  </div>
                  <p className="mt-3 font-display text-2xl leading-snug font-semibold">Make your next action obvious</p>
                  <p className="mt-2 text-sm text-muted">A vague next step makes tasks harder to start. Here&apos;s the fix.</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-sm text-muted">3 min read</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink">
                      <Headphones className="size-3.5" /> Listen
                    </span>
                  </div>
                </div>
              </Parallax>
              <Parallax speed={-0.16} className="absolute right-0 bottom-6 left-14">
                <div className="rounded-3xl border border-line bg-surface p-5 shadow-lift">
                  <p className="text-xs font-bold tracking-wider text-muted uppercase">Try this today</p>
                  <p className="mt-2 text-sm">Write the smallest next action for one task on your list.</p>
                  <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-success">
                    <BookOpenCheck className="size-4" /> Completed · 4-day streak
                  </div>
                </div>
              </Parallax>
            </div>
          </div>
        </section>

        {/* ---- Topic marquee ---- */}
        <section aria-label="Topics" className="relative border-y border-line bg-surface/60 py-5">
          <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
            <div className="animate-marquee flex w-max gap-3">
              {[...topics, ...topics].map((t, i) => (
                <span
                  key={`${t.id}-${i}`}
                  aria-hidden={i >= topics.length}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium whitespace-nowrap"
                >
                  <TopicIcon iconKey={t.iconKey} className="size-4 text-accent" />
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---- How it works ---- */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <Reveal>
            <p className="font-semibold text-accent">How it works</p>
            <h2 className="mt-2 max-w-2xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              A small daily habit that adds up.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { icon: Target, title: "Choose 1-5 topics", text: "Pick from 50 learning areas, from money and leadership to sleep and AI. Change them anytime." },
              { icon: Timer, title: "Get today's lessons", text: "Each day brings one short, fresh lesson per topic, in the app and by email if you'd like." },
              { icon: ListChecks, title: "Read, listen, apply", text: "Three key takeaways and one practical action you can try today. Save the ones you love." },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 120}>
                <div className="group h-full rounded-3xl border border-line bg-surface p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <div className="flex items-center justify-between">
                    <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]">
                      <s.icon className="size-6" aria-hidden />
                    </div>
                    <span className="font-display text-5xl font-semibold text-line">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- Anatomy of a lesson: sticky copy + scrolling parts ---- */}
        <section className="overflow-x-clip bg-surface-2/60 py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Reveal>
                <p className="font-semibold text-accent">Inside every lesson</p>
                <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  Useful, not just interesting.
                </h2>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
                  Every lesson solves one small learning problem. It&apos;s written in plain language, backed by credible
                  sources, and ends with something you can actually do.
                </p>
              </Reveal>
            </div>
            <ol className="space-y-5">
              {[
                { label: "The hook", text: "One or two sentences on why this matters to you today." },
                { label: "The idea", text: "A clear 150-250 word explanation. One idea at a time, short paragraphs." },
                { label: "3 key takeaways", text: "The points worth remembering, distilled so they stick." },
                { label: "One practical action", text: "A small, safe exercise or question to try before the day ends." },
                { label: "Quick check", text: "An optional 1-3 question check to lock it in, with instant feedback." },
                { label: "Sources", text: "Further reading from credible references, so you can go deeper." },
              ].map((p, i) => (
                <Reveal as="li" key={p.label} variant="right" delay={60}>
                  <div className="flex gap-5 rounded-3xl border border-line bg-surface p-6 shadow-card">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-semibold text-bg">{i + 1}</span>
                    <div>
                      <h3 className="text-lg font-semibold">{p.label}</h3>
                      <p className="mt-1 text-muted">{p.text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- Stats ---- */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { value: 50, suffix: "", label: "learning topics" },
              { value: 4, suffix: " min", label: "or less per lesson" },
              { value: 3, suffix: "", label: "takeaways each" },
              { value: 1, suffix: "", label: "action to try today" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 90} variant="scale" className="rounded-3xl border border-line bg-surface p-6 text-center shadow-card">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-4xl font-semibold text-accent sm:text-5xl">
                  <CountUp value={s.value} suffix={s.suffix} />
                </dd>
                <dd className="mt-1 text-sm text-muted">{s.label}</dd>
              </Reveal>
            ))}
          </dl>
        </section>

        {/* ---- Featured topics ---- */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-semibold text-accent">Popular starting points</p>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">What will you learn first?</h2>
            </div>
            <LinkButton href="/signup" variant="secondary">
              Explore all 50 topics <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {featured.map((t, i) => (
              <Reveal key={t.id} delay={(i % 5) * 70}>
                <div className="group h-full rounded-3xl border border-line bg-surface p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lift">
                  <div className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110">
                    <TopicIcon iconKey={t.iconKey} />
                  </div>
                  <h3 className="mt-4 font-semibold leading-snug">{t.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- Read or listen + trust ---- */}
        <section className="mx-auto grid max-w-6xl gap-6 overflow-x-clip px-4 pb-24 sm:px-6 md:grid-cols-2">
          <Reveal variant="left" className="rounded-[2rem] bg-ink p-8 text-bg sm:p-10">
            <Headphones className="size-9 text-accent" aria-hidden />
            <h2 className="mt-6 font-display text-3xl font-semibold">Read it, or listen on the go.</h2>
            <p className="mt-3 leading-relaxed opacity-80">
              Tap Listen to hear any lesson read aloud with play, pause, restart and speed controls. Perfect for commutes and
              chores. It never autoplays.
            </p>
          </Reveal>
          <Reveal variant="right" className="rounded-[2rem] border border-line bg-surface p-8 shadow-card sm:p-10">
            <ShieldCheck className="size-9 text-accent" aria-hidden />
            <h2 className="mt-6 font-display text-3xl font-semibold">Original, sourced, reviewed.</h2>
            <p className="mt-3 leading-relaxed text-muted">
              Lessons are written in our own words from multiple credible sources and checked by an editor before they
              reach you. No copied book chapters, ever.
            </p>
          </Reveal>
        </section>

        {/* ---- Final CTA ---- */}
        <section className="px-4 pb-24 sm:px-6">
          <Reveal variant="scale" className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-accent px-6 py-16 text-center text-accent-ink sm:px-12">
            <div className="grain pointer-events-none absolute inset-0 opacity-20" aria-hidden />
            <h2 className="relative font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Your first lesson is two minutes away.
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-lg opacity-90">Pick your topics and start learning today.</p>
            <LinkButton href="/signup" size="lg" variant="secondary" className="relative mt-8 border-transparent">
              Get started <ArrowRight className="size-5" aria-hidden />
            </LinkButton>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

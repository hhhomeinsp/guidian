import type { ReactNode } from "react";
import Link from "next/link";
import { Award, BookOpen, Shield } from "lucide-react";
import { GuidianLogo } from "@/components/ui/GuidianLogo";

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-navy py-24 px-4">
        <div className="container mx-auto text-center">
          <div className="flex justify-center mb-6">
            <GuidianLogo size={52} strokeColor="white" accentColor="#C98A2A" />
          </div>
          <p className="font-body text-xs uppercase tracking-[0.15em] text-amber mb-5">
            AI-Native Learning Platform
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-white italic leading-tight max-w-3xl mx-auto">
            From first lesson to final credential.
          </h1>
          <p className="mt-6 text-mist text-lg max-w-2xl mx-auto font-body leading-relaxed">
            Guidian generates, delivers, and tracks continuing education for every stage of a professional&apos;s career — from vocational training to license renewal.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/courses"
              className="inline-flex items-center justify-center rounded-md bg-amber px-7 py-3 text-sm font-medium text-white shadow-amber hover:bg-amber-light transition-colors"
            >
              Browse courses →
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md border border-mist px-7 py-3 text-sm font-medium text-white hover:bg-navy-mid transition-colors"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-cream py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-display text-navy font-semibold mb-3">
            Built for professional compliance
          </h2>
          <p className="text-center text-steel mb-12 max-w-xl mx-auto font-body">
            One platform for every credential stage — from vocational certification to post-graduate CE.
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            <FeatureCard
              icon={<BookOpen className="h-6 w-6 text-teal" />}
              title="AI-generated courses"
              description="Claude produces complete course structures with modules, lessons, objectives, and scenario-based quizzes — tailored to your compliance requirement."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6 text-teal" />}
              title="Compliance tracking"
              description="Built-in CEU rules engine tracks seat time, quiz scores, and accreditation requirements. Every action is recorded in an append-only audit log."
            />
            <FeatureCard
              icon={<Award className="h-6 w-6 text-teal" />}
              title="Verifiable certificates"
              description="Issue tamper-evident certificates with unique verification codes. Download print-ready PDFs or share digital credential links."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-display text-white italic mb-4">
            Ready to begin?
          </h2>
          <p className="text-mist mb-8 max-w-lg mx-auto font-body">
            Start earning your continuing education credits today. Your first course is waiting.
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center justify-center rounded-md bg-amber px-8 py-3 text-base font-medium text-white shadow-amber hover:bg-amber-light transition-colors"
          >
            Browse courses →
          </Link>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-cloud p-6 shadow-card">
      <div className="mb-4">{icon}</div>
      <h3 className="font-display text-navy text-lg font-semibold mb-2">{title}</h3>
      <p className="text-steel text-sm font-body leading-relaxed">{description}</p>
    </div>
  );
}

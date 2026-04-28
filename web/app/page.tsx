import type { ReactNode } from "react";
import Link from "next/link";
import { Award, BookOpen, Shield } from "lucide-react";
import { GuidianLogo } from "@/components/ui/GuidianLogo";

const STAGES = [
  { label: "Pre-College", color: "#5E5CE6" },
  { label: "Vocational", color: "#30B0C7" },
  { label: "College", color: "#0071E3" },
  { label: "Certification", color: "#34C759" },
  { label: "Licensure", color: "#1D1D1F" },
  { label: "Continuing Ed", color: "#FF9F0A" },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-white py-28 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="flex justify-center mb-8">
            <GuidianLogo size={52} strokeColor="#162D4A" accentColor="#C98A2A" />
          </div>
          <h1
            className="text-[40px] md:text-[56px] lg:text-[64px] font-semibold leading-[1.07] text-[#1D1D1F] max-w-3xl mx-auto"
            style={{ letterSpacing: "-0.5px" }}
          >
            From first lesson to final credential.
          </h1>
          <p className="mt-6 text-xl text-[#6E6E73] max-w-2xl mx-auto leading-relaxed">
            Guidian generates, delivers, and tracks continuing education for every stage of a professional&apos;s career — from vocational training to license renewal.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/courses"
              className="inline-flex items-center justify-center rounded-full bg-[#0071E3] px-7 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#0077ED]"
            >
              Get started
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full border border-[#D2D2D7] px-7 py-3 text-[15px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
            >
              Learn more
            </Link>
          </div>
        </div>
      </section>

      {/* Journey stages strip */}
      <section className="border-y border-[#D2D2D7] bg-white py-5 px-4">
        <div className="container mx-auto">
          <div className="flex flex-wrap gap-2.5 justify-center">
            {STAGES.map((stage) => (
              <span
                key={stage.label}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: stage.color }}
              >
                {stage.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#F5F5F7] py-20 px-4">
        <div className="container mx-auto">
          <h2
            className="text-center text-3xl font-semibold text-[#1D1D1F] mb-3"
            style={{ letterSpacing: "-0.3px" }}
          >
            Built for professional compliance
          </h2>
          <p className="text-center text-[#6E6E73] mb-12 max-w-xl mx-auto text-lg">
            One platform for every credential stage — from vocational certification to post-graduate CE.
          </p>
          <div className="grid gap-5 sm:grid-cols-3">
            <FeatureCard
              icon={<BookOpen className="h-6 w-6 text-[#0071E3]" />}
              title="AI-generated courses"
              description="Claude produces complete course structures with modules, lessons, objectives, and scenario-based quizzes — tailored to your compliance requirement."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6 text-[#0071E3]" />}
              title="Compliance tracking"
              description="Built-in CEU rules engine tracks seat time, quiz scores, and accreditation requirements. Every action is recorded in an append-only audit log."
            />
            <FeatureCard
              icon={<Award className="h-6 w-6 text-[#0071E3]" />}
              title="Verifiable certificates"
              description="Issue tamper-evident certificates with unique verification codes. Download print-ready PDFs or share digital credential links."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20 px-4">
        <div className="container mx-auto text-center">
          <h2
            className="text-3xl font-semibold text-[#1D1D1F] mb-4"
            style={{ letterSpacing: "-0.3px" }}
          >
            Ready to begin?
          </h2>
          <p className="text-[#6E6E73] mb-8 max-w-lg mx-auto text-lg">
            Start earning your continuing education credits today. Your first course is waiting.
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center justify-center rounded-full bg-[#0071E3] px-8 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#0077ED]"
          >
            Browse courses
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
    <div className="bg-white rounded-[18px] p-6 shadow-card">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F0FE]">
        {icon}
      </div>
      <h3 className="text-[#1D1D1F] text-lg font-semibold mb-2">{title}</h3>
      <p className="text-[#6E6E73] text-sm leading-relaxed">{description}</p>
    </div>
  );
}

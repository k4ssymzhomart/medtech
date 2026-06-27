import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { WhyUs } from "@/components/marketing/WhyUs";
import { FooterCTA } from "@/components/marketing/FooterCTA";
import { getCoverageStats } from "@/lib/queries/stats";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const stats = await getCoverageStats();
  return (
    <>
      <Hero />
      <HowItWorks />
      <WhyUs stats={stats} />
      <FooterCTA />
    </>
  );
}

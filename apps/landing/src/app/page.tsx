import React from "react";
import { Navbar } from "@/components/Navbar";
import { ImmersiveHero } from "@/components/ImmersiveHero";
import { HeroOrbitalTransition } from "@/components/HeroOrbitalTransition";
import { EssenceSection } from "@/components/EssenceSection";
import { ServicesSection } from "@/components/ServicesSection";
import { Solutions } from "@/components/Solutions";
import { Portfolio } from "@/components/Portfolio";
import { Process } from "@/components/Process";
import { About } from "@/components/About";
import { InviteSection } from "@/components/InviteSection";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <ImmersiveHero />
        <HeroOrbitalTransition />
        <EssenceSection />
        <ServicesSection />
        <Solutions />
        <Portfolio />
        <Process />
        <About />
        <InviteSection />
      </main>
      <Footer />
    </>
  );
}

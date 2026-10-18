import * as React from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer, { type FooterCredit } from '@/components/Footer';
import Hero from '@/components/landing/Hero';
import PortalShowcase from '@/components/landing/PortalShowcase';
import SessionTimeline from '@/components/landing/SessionTimeline';
import EditorialBand from '@/components/landing/EditorialBand';
import CapabilityRows from '@/components/landing/CapabilityRows';
import Principles from '@/components/landing/Principles';
import ClosingCta from '@/components/landing/ClosingCta';
import { heroClassroom, lectureHall, studentDevice, teacherFront } from '@/components/landing/photos';

const credits: FooterCredit[] = [heroClassroom, teacherFront, lectureHall, studentDevice]
  .map((photo) => photo.credit)
  .filter((credit, i, all): credit is FooterCredit => !!credit && all.findIndex((c) => c?.url === credit.url) === i);

/** Scrolls to `location.hash` (react-router doesn't), smoothly unless reduced motion is preferred. */
function useHashScroll() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Wait two frames so pending layout (e.g. the mobile menu closing) has settled.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [hash]);
}

const HomePage: React.FC = () => {
  useHashScroll();

  useEffect(() => {
    // In-page anchor links (#how-it-works) glide unless reduced motion is preferred.
    const root = document.documentElement;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) root.style.scrollBehavior = 'smooth';
    return () => {
      root.style.scrollBehavior = '';
    };
  }, []);

  return (
    <div className="lp flex min-h-screen flex-col bg-surface-default text-text-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-body-strong focus:text-text-primary focus:shadow-lg"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        <Hero />
        <PortalShowcase />
        <SessionTimeline />
        <EditorialBand />
        <CapabilityRows />
        <Principles />
        <ClosingCta />
      </main>
      <Footer credits={credits} />
    </div>
  );
};

export default HomePage;

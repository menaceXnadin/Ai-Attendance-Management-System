import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const AboutPage = () => {
  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950">
        {/* Hero Section */}
        <section className="relative px-6 lg:px-8 pt-20 pb-16">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-6">
              About AttendAI
            </h1>
            <p className="text-lg sm:text-xl leading-relaxed text-blue-200/80 max-w-2xl mx-auto">
              We're on a mission to modernize classroom attendance tracking with
              AI-powered facial recognition technology. Our platform saves
              educators time while providing accurate attendance data.
            </p>
            <div className="mt-10 flex items-center justify-center gap-6">
              <Link to="/login">
                <Button className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 rounded-xl px-8 py-6 text-base font-semibold transition-all duration-300">
                  Get Started
                </Button>
              </Link>
              <a
                href="#learn-more"
                className="text-base font-semibold text-blue-200/80 hover:text-white transition-colors flex items-center gap-2"
              >
                Learn more{" "}
                <span aria-hidden="true" className="text-lg">
                  ↓
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* Our Story Section */}
        <section id="learn-more" className="py-16 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center mb-12">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-6">
                Our Story
              </h2>
              <p className="text-lg text-blue-200/70">
                From a classroom challenge to an innovative solution.
              </p>
            </div>
            <div className="mx-auto max-w-4xl bg-slate-900/60 backdrop-blur-lg p-10 sm:p-12 rounded-2xl border border-slate-700/50 hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(56,189,248,0.15)]">
              <p className="text-blue-200/70 leading-relaxed mb-6 text-base">
                AttendAI began with a simple observation: educators were
                spending too much valuable teaching time on manual attendance.
                Founded in 2023 by a team of educators and technologists, we set
                out to solve this universal problem.
              </p>
              <p className="text-blue-200/70 leading-relaxed mb-6 text-base">
                This challenge hit home for our founder, Nadin Tamang, during their time as a student at a large university. Watching 10 minutes of valuable instruction time disappear every single class due to slow, traditional roll call was inefficient and frustrating. This firsthand experience sparked the idea of using facial recognition technology to streamline attendance and give that time back to teaching.
              </p>
              <p className="text-blue-200/70 leading-relaxed text-base">
                Today, AttendAI is used in hundreds of educational institutions
                worldwide, saving educators thousands of hours and providing
                valuable attendance insights that help identify at-risk students
                earlier.
              </p>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-16 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center mb-12">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-6">
                Our Team
              </h2>
              <p className="text-lg text-blue-200/70">
                Meet the people behind AttendAI.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { name: "Diwash Ghimire", role: "CTO", image: "/team/cto.png" },
                {
                  name: "Nadin Tamang",
                  role: "Founder & CEO",
                  image: "/team/ceo.jpg",
                },
                {
                  name: "Abhishek Subedi",
                  role: "CMO",
                  image: "/team/cmo.png",
                },
              ].map((person) => (
                <div
                  key={person.name}
                  className="group text-center bg-slate-900/60 backdrop-blur-lg p-8 rounded-2xl border border-slate-700/50 hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(56,189,248,0.15)] hover:-translate-y-2"
                >
                  <div className="relative inline-block">
                    <img
                      className="mx-auto h-40 w-40 object-cover rounded-full border-4 border-slate-700/50 group-hover:border-blue-500/30 transition-all duration-300"
                      src={person.image}
                      alt={person.name}
                    />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-white">
                    {person.name}
                  </h3>
                  <p className="mt-2 text-base text-blue-200/70">
                    {person.role}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-16 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center mb-12">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-6">
                Our Values
              </h2>
              <p className="text-lg text-blue-200/70">
                The principles that guide our work.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="group bg-slate-900/60 backdrop-blur-lg p-10 rounded-2xl border border-slate-700/50 hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(56,189,248,0.15)] hover:-translate-y-2">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Privacy First
                </h3>
                <p className="text-blue-200/70 leading-relaxed">
                  We design our technology with privacy and security as the top
                  priority, ensuring student data is protected at all times.
                </p>
              </div>
              <div className="group bg-slate-900/60 backdrop-blur-lg p-10 rounded-2xl border border-slate-700/50 hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(56,189,248,0.15)] hover:-translate-y-2">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Education Impact
                </h3>
                <p className="text-blue-200/70 leading-relaxed">
                  Every feature we build must have a positive impact on the
                  educational experience for both students and educators.
                </p>
              </div>
              <div className="group bg-slate-900/60 backdrop-blur-lg p-10 rounded-2xl border border-slate-700/50 hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(56,189,248,0.15)] hover:-translate-y-2">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Continuous Improvement
                </h3>
                <p className="text-blue-200/70 leading-relaxed">
                  We're committed to constantly improving our technology through
                  research and user feedback.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-blue-600 to-teal-400 py-20 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-6">
                Ready to transform your classroom?
              </h2>
              <p className="text-lg sm:text-xl leading-relaxed text-white/90">
                Join thousands of educators who are saving time and improving
                attendance tracking with AttendAI.
              </p>
              <div className="mt-10 flex items-center justify-center gap-6">
                <Link to="/login">
                  <Button className="bg-white text-blue-600 hover:bg-gray-100 rounded-xl px-8 py-6 text-base font-semibold transition-all duration-300">
                    Get Started
                  </Button>
                </Link>
                <Link
                  to="/contact"
                  className="text-base font-semibold text-white hover:text-white/80 transition-colors flex items-center gap-2"
                >
                  Contact us{" "}
                  <span aria-hidden="true" className="text-lg">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
};

export default AboutPage;

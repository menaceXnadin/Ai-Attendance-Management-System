
import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const AboutPage = () => {
  return (
    <>
      <Navbar />

      <div className="bg-white">
        {/* Hero section */}
        <div className="relative isolate px-6 lg:px-8">
          <div className="mx-auto max-w-3xl py-16 sm:py-24 lg:py-28">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                About AttendAI
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                We're on a mission to modernize classroom attendance tracking with AI-powered facial recognition technology. Our platform saves educators time while providing accurate attendance data.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link to="/login">
                  <Button className="bg-brand-500 hover:bg-brand-600">Get started</Button>
                </Link>
                <a href="#learn-more" className="text-sm font-semibold leading-6 text-gray-900">
                  Learn more <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Our story section */}
        <div id="learn-more" className="py-12 bg-gray-50 sm:py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Our Story</h2>
              <p className="mt-4 text-lg text-gray-600">
                From a classroom challenge to an innovative solution.
              </p>
            </div>
            <div className="mx-auto mt-12 max-w-3xl">
              <p className="text-gray-600 mb-6">
                AttendAI began with a simple observation: educators were spending too much valuable teaching time on manual attendance. Founded in 2023 by a team of educators and technologists, we set out to solve this universal problem.
              </p>
              <p className="text-gray-600 mb-6">
                Our founder, Dr. Sarah Chen, experienced this challenge firsthand as a professor at a large university. The traditional roll call took up to 10 minutes of each class—time that could be better spent teaching. This led to the idea of using facial recognition technology to automate the process.
              </p>
              <p className="text-gray-600">
                Today, AttendAI is used in hundreds of educational institutions worldwide, saving educators thousands of hours and providing valuable attendance insights that help identify at-risk students earlier.
              </p>
            </div>
          </div>
        </div>

        {/* Team section */}
        <div className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Our Team</h2>
              <p className="mt-4 text-lg text-gray-600">
                Meet the people behind AttendAI.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-lg gap-x-8 gap-y-12 sm:max-w-xl lg:mx-0 lg:max-w-none lg:grid-cols-3">
              {[
                { name: 'Dr. Sarah Chen', role: 'Founder & CEO', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&auto=format&fit=crop' },
                { name: 'Michael Rodriguez', role: 'CTO', image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&auto=format&fit=crop' },
                { name: 'Aisha Patel', role: 'Head of AI Research', image: 'https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=300&h=300&auto=format&fit=crop' },
              ].map((person) => (
                <div key={person.name} className="text-center">
                  <img
                    className="mx-auto h-48 w-48 rounded-full object-cover"
                    src={person.image}
                    alt={person.name}
                  />
                  <h3 className="mt-6 text-xl font-semibold leading-7 tracking-tight text-gray-900">{person.name}</h3>
                  <p className="text-base leading-6 text-gray-600">{person.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Values section */}
        <div className="py-12 bg-gray-50 sm:py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Our Values</h2>
              <p className="mt-4 text-lg text-gray-600">
                The principles that guide our work.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-lg grid-cols-1 gap-8 sm:max-w-xl lg:mx-0 lg:max-w-none lg:grid-cols-3">
              <div className="bg-white p-8 rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Privacy First</h3>
                <p className="text-gray-600">
                  We design our technology with privacy and security as the top priority, ensuring student data is protected at all times.
                </p>
              </div>
              <div className="bg-white p-8 rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Education Impact</h3>
                <p className="text-gray-600">
                  Every feature we build must have a positive impact on the educational experience for both students and educators.
                </p>
              </div>
              <div className="bg-white p-8 rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Continuous Improvement</h3>
                <p className="text-gray-600">
                  We're committed to constantly improving our technology through research and user feedback.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA section */}
        <div className="bg-brand-500 py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to transform your classroom?
              </h2>
              <p className="mt-6 text-lg leading-8 text-brand-50">
                Join thousands of educators who are saving time and improving attendance tracking with AttendAI.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link to="/login">
                  <Button className="bg-white text-brand-600 hover:bg-gray-100">
                    Get started
                  </Button>
                </Link>
                <Link to="/contact" className="text-sm font-semibold leading-6 text-white">
                  Contact us <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
};

export default AboutPage;

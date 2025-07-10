import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FeatureCard from '@/components/FeatureCard';
import { Camera, BarChart, UserPlus, Book } from 'lucide-react';

const HomePage = () => {
  return (
    <>
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 py-24 md:py-36 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-700/30 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-6 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-8 drop-shadow-lg">
            AI-Powered Class Attendance<br />
            <span className="text-blue-400">Made Simple</span>
          </h1>
          <p className="text-2xl max-w-2xl mx-auto mb-12 text-blue-100 font-medium">
            Revolutionize your classroom attendance system with our facial recognition technology. Fast, accurate, and effortless tracking.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-5">
            <Link to="/login">
              <Button size="lg" className="bg-blue-400 hover:bg-blue-500 text-blue-950 font-bold px-8 py-4 text-lg rounded-xl shadow-xl transition-all duration-200">
                Get Started
              </Button>
            </Link>
            <Link to="/about">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-800 text-white font-bold px-8 py-4 text-lg rounded-xl shadow-xl transition-all duration-200 border-none">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-blue-400 mb-5">Why Choose AttendAI?</h2>
            <p className="text-xl text-blue-200 max-w-2xl mx-auto font-medium">
              Our platform combines cutting-edge facial recognition with intuitive attendance management.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
            <FeatureCard
              icon={<Camera size={32} className="text-blue-400" />}
              title="Fast Recognition"
              description="Identify students in seconds with our advanced facial recognition algorithm."
              className="bg-blue-950/80 backdrop-blur-md rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all border border-blue-800 text-blue-100"
            />
            <FeatureCard
              icon={<BarChart size={32} className="text-blue-400" />}
              title="Detailed Analytics"
              description="Track attendance patterns with comprehensive charts and reports."
              className="bg-blue-950/80 backdrop-blur-md rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all border border-blue-800 text-blue-100"
            />
            <FeatureCard
              icon={<UserPlus size={32} className="text-blue-400" />}
              title="Easy Management"
              description="Add students quickly and manage their profiles with a few clicks."
              className="bg-blue-950/80 backdrop-blur-md rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all border border-blue-800 text-blue-100"
            />
            <FeatureCard
              icon={<Book size={32} className="text-blue-400" />}
              title="Class Integration"
              description="Organize students by classes and courses for better management."
              className="bg-blue-950/80 backdrop-blur-md rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all border border-blue-800 text-blue-100"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-blue-900 via-blue-950 to-blue-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-blue-400 mb-5">How It Works</h2>
            <p className="text-xl text-blue-200 max-w-2xl mx-auto font-medium">
              From setup to daily use, our platform makes attendance tracking effortless.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center bg-blue-950/80 backdrop-blur-md rounded-2xl shadow-lg p-10 hover:shadow-2xl transition-all border border-blue-800 text-blue-100">
              <div className="h-16 w-16 rounded-full bg-blue-800 text-blue-400 flex items-center justify-center mx-auto mb-6 text-2xl font-extrabold shadow-md">
                1
              </div>
              <h3 className="text-2xl font-bold mb-4 text-blue-300">Register Students</h3>
              <p className="text-blue-100 text-lg">Add student profiles with photos for facial recognition training.</p>
            </div>
            <div className="text-center bg-blue-950/80 backdrop-blur-md rounded-2xl shadow-lg p-10 hover:shadow-2xl transition-all border border-blue-800 text-blue-100">
              <div className="h-16 w-16 rounded-full bg-blue-800 text-blue-400 flex items-center justify-center mx-auto mb-6 text-2xl font-extrabold shadow-md">
                2
              </div>
              <h3 className="text-2xl font-bold mb-4 text-blue-300">Take Attendance</h3>
              <p className="text-blue-100 text-lg">Students scan their faces on a camera or device at class start.</p>
            </div>
            <div className="text-center bg-blue-950/80 backdrop-blur-md rounded-2xl shadow-lg p-10 hover:shadow-2xl transition-all border border-blue-800 text-blue-100">
              <div className="h-16 w-16 rounded-full bg-blue-800 text-blue-400 flex items-center justify-center mx-auto mb-6 text-2xl font-extrabold shadow-md">
                3
              </div>
              <h3 className="text-2xl font-bold mb-4 text-blue-300">View Reports</h3>
              <p className="text-blue-100 text-lg">Access detailed attendance reports and insights on the dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-400 py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-700/20 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-blue-400 mb-8 drop-shadow-lg">Ready to Transform Your Classroom?</h2>
          <p className="text-2xl text-blue-100 max-w-2xl mx-auto mb-12 font-medium">
            Join educators worldwide who are saving time and improving accuracy with AttendAI.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-5">
            <Link to="/login">
              <Button size="lg" variant="default" className="bg-blue-400 hover:bg-blue-500 text-blue-950 font-bold px-8 py-4 text-lg rounded-xl shadow-xl transition-all duration-200">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/about">
              <Button size="lg" variant="outline" className="bg-blue-800/40 border-blue-300 text-blue-300 hover:bg-blue-900/60 font-bold px-8 py-4 text-lg rounded-xl shadow-xl transition-all duration-200">
                Request Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default HomePage;

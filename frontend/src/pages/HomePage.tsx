import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FeatureCard from '@/components/FeatureCard';
import { Camera, BarChart, UserPlus, Book, ArrowRight, Zap, Shield, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 md:pt-28 pb-32 md:pb-44">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-10 blur-3xl animate-pulse"></div>
          <div className="absolute top-60 -left-20 w-60 h-60 bg-teal-400 rounded-full opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-indigo-500 rounded-full opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="lg:w-1/2 text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
              <div className="inline-block bg-gradient-to-r from-blue-600 to-teal-400 bg-clip-text text-transparent font-medium rounded-full px-4 py-1 border border-blue-400/20 mb-6 animate-fade-in-up">
                Welcome to the Future of Attendance
              </div>
              
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-blue-200 leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                AttendAI: <br />
                <span className="bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">Smart Attendance</span>
              </h1>
              
              <p className="text-lg md:text-xl text-blue-100/80 mb-10 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                Revolutionize classroom attendance with our cutting-edge facial recognition technology. 
                Effortless tracking that saves time and improves accuracy.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                <Link to="/login">
                  <Button size="lg" className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white font-medium px-8 py-6 text-lg rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:shadow-[0_0_25px_rgba(56,189,248,0.5)] transition-all duration-300 w-full sm:w-auto">
                    Get Started <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/about">
                  <Button variant="outline" size="lg" className="bg-blue-950/50 text-blue-100 border-blue-400/30 hover:bg-blue-900/50 hover:border-blue-400/50 font-medium px-8 py-6 text-lg rounded-xl transition-all duration-300 w-full sm:w-auto">
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="lg:w-1/2 relative animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
              <div className="relative w-full aspect-video max-w-lg mx-auto">
                {/* 3D Mockup container */}
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-teal-400/20 rounded-2xl backdrop-blur-sm border border-white/10 shadow-[0_0_50px_rgba(56,189,248,0.3)] transform perspective-1000 rotateY-3 hover:rotateY-0 transition-transform duration-700"></div>
                
                {/* Dashboard mockup */}
                <div className="absolute inset-5 rounded-lg overflow-hidden border border-white/10 shadow-lg">
                  <div className="absolute inset-0 bg-slate-900 bg-opacity-95">
                    {/* Browser header */}
                    <div className="h-6 bg-slate-800 flex items-center px-3">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      </div>
                      <div className="ml-4 text-xs text-slate-400">AttendAI Dashboard</div>
                    </div>
                    
                    {/* Dashboard content */}
                    <div className="p-3 text-xs">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="h-4 w-24 bg-gradient-to-r from-blue-500 to-teal-400 rounded text-white flex items-center justify-center text-[8px] font-bold">
                          AttendAI
                        </div>
                        <div className="h-6 w-16 bg-slate-700 rounded-full"></div>
                      </div>
                      
                      {/* Stats cards */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-blue-900/40 border border-blue-700/30 rounded p-2">
                          <div className="text-[8px] text-blue-300 mb-1">Present Today</div>
                          <div className="text-white font-bold text-xs">84%</div>
                        </div>
                        <div className="bg-teal-900/40 border border-teal-700/30 rounded p-2">
                          <div className="text-[8px] text-teal-300 mb-1">Total Students</div>
                          <div className="text-white font-bold text-xs">125</div>
                        </div>
                        <div className="bg-indigo-900/40 border border-indigo-700/30 rounded p-2">
                          <div className="text-[8px] text-indigo-300 mb-1">Classes</div>
                          <div className="text-white font-bold text-xs">8</div>
                        </div>
                      </div>
                      
                      {/* Attendance chart area */}
                      <div className="bg-slate-800/80 border border-slate-700 rounded p-2 mb-3">
                        <div className="text-[8px] text-slate-300 mb-2">Weekly Attendance</div>
                        <div className="flex items-end space-x-1 h-12">
                          <div className="w-2 bg-blue-500 rounded-t" style={{ height: '60%' }}></div>
                          <div className="w-2 bg-blue-500 rounded-t" style={{ height: '80%' }}></div>
                          <div className="w-2 bg-blue-500 rounded-t" style={{ height: '70%' }}></div>
                          <div className="w-2 bg-blue-500 rounded-t" style={{ height: '90%' }}></div>
                          <div className="w-2 bg-blue-500 rounded-t" style={{ height: '85%' }}></div>
                          <div className="w-2 bg-teal-400 rounded-t" style={{ height: '75%' }}></div>
                          <div className="w-2 bg-teal-400 rounded-t" style={{ height: '88%' }}></div>
                        </div>
                      </div>
                      
                      {/* Recent activity */}
                      <div className="space-y-1">
                        <div className="text-[8px] text-slate-300 mb-1">Recent Activity</div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                          <div className="flex-1 h-2 bg-slate-700 rounded"></div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                          <div className="flex-1 h-2 bg-slate-700 rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 py-6 -mt-16">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-slate-900/60 backdrop-blur-lg border-slate-700/50 p-6 rounded-xl flex items-center gap-4 hover:bg-slate-800/60 transition-all transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,0,0,0.2)]">
              <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 text-white shadow-lg">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-200/70">Processing Speed</p>
                <p className="text-3xl font-bold text-white">0.5<span className="text-lg text-blue-300 ml-1">sec</span></p>
              </div>
            </Card>
            
            <Card className="bg-slate-900/60 backdrop-blur-lg border-slate-700/50 p-6 rounded-xl flex items-center gap-4 hover:bg-slate-800/60 transition-all transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,0,0,0.2)]">
              <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-200/70">Accuracy Rate</p>
                <p className="text-3xl font-bold text-white">99.8<span className="text-lg text-blue-300 ml-1">%</span></p>
              </div>
            </Card>
            
            <Card className="bg-slate-900/60 backdrop-blur-lg border-slate-700/50 p-6 rounded-xl flex items-center gap-4 hover:bg-slate-800/60 transition-all transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,0,0,0.2)]">
              <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-lg">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-200/70">Time Saved</p>
                <p className="text-3xl font-bold text-white">85<span className="text-lg text-blue-300 ml-1">%</span></p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-transparent to-transparent opacity-40 pointer-events-none"></div>
        
        <div className="container mx-auto px-6 relative">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
              Why Choose AttendAI?
            </h2>
            <p className="text-lg md:text-xl text-blue-200/80">
              Our platform combines cutting-edge facial recognition with intuitive attendance management tools that will transform your classroom experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            <FeatureCard
              icon={<Camera size={24} className="text-teal-400" />}
              title="Smart Recognition"
              description="Identify students in seconds with our AI-powered facial recognition system that works even with masks."
              className="transform transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_30px_-10px_rgba(0,0,0,0.3)]"
            />
            <FeatureCard
              icon={<BarChart size={24} className="text-teal-400" />}
              title="Advanced Analytics"
              description="Track attendance patterns with comprehensive charts, reports, and predictive insights to improve engagement."
              className="transform transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_30px_-10px_rgba(0,0,0,0.3)]"
            />
            <FeatureCard
              icon={<UserPlus size={24} className="text-teal-400" />}
              title="Seamless Management"
              description="Add and manage students quickly with our intuitive interface. Import from existing systems with one click."
              className="transform transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_30px_-10px_rgba(0,0,0,0.3)]"
            />
            <FeatureCard
              icon={<Book size={24} className="text-teal-400" />}
              title="Class Integration"
              description="Organize students by classes, courses, and semesters with smart grouping and automatic updates."
              className="transform transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_30px_-10px_rgba(0,0,0,0.3)]"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-b from-slate-950 to-blue-950">
        <div className="container mx-auto px-6 relative">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
              How It Works
            </h2>
            <p className="text-lg md:text-xl text-blue-200/80">
              From setup to daily use, our platform makes attendance tracking effortless and engaging.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-16">
            <div className="relative">
              <div className="absolute left-12 top-0 h-full w-0.5 bg-gradient-to-b from-blue-500 to-teal-400 hidden md:block"></div>
              <div className="relative z-10">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 text-white flex items-center justify-center mx-auto mb-8 text-3xl font-bold shadow-[0_0_20px_rgba(56,189,248,0.4)]">
                  1
                </div>
                <div className="text-center bg-slate-900/60 backdrop-blur-md rounded-2xl p-8 border border-slate-700/50 hover:border-blue-500/30 transition-all hover:shadow-[0_0_30px_rgba(56,189,248,0.15)]">
                  <h3 className="text-2xl font-bold mb-4 text-blue-100">Register Students</h3>
                  <p className="text-blue-200/80 text-lg">
                    Add student profiles with photos for facial recognition training. Import from CSV or existing systems.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute left-12 top-0 h-full w-0.5 bg-gradient-to-b from-blue-500 to-teal-400 hidden md:block"></div>
              <div className="relative z-10">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 text-white flex items-center justify-center mx-auto mb-8 text-3xl font-bold shadow-[0_0_20px_rgba(56,189,248,0.4)]">
                  2
                </div>
                <div className="text-center bg-slate-900/60 backdrop-blur-md rounded-2xl p-8 border border-slate-700/50 hover:border-blue-500/30 transition-all hover:shadow-[0_0_30px_rgba(56,189,248,0.15)]">
                  <h3 className="text-2xl font-bold mb-4 text-blue-100">Take Attendance</h3>
                  <p className="text-blue-200/80 text-lg">
                    Students scan their faces on a camera or device. The system automatically identifies and records attendance.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="relative z-10">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 text-white flex items-center justify-center mx-auto mb-8 text-3xl font-bold shadow-[0_0_20px_rgba(56,189,248,0.4)]">
                  3
                </div>
                <div className="text-center bg-slate-900/60 backdrop-blur-md rounded-2xl p-8 border border-slate-700/50 hover:border-blue-500/30 transition-all hover:shadow-[0_0_30px_rgba(56,189,248,0.15)]">
                  <h3 className="text-2xl font-bold mb-4 text-blue-100">Access Insights</h3>
                  <p className="text-blue-200/80 text-lg">
                    View detailed attendance reports, analytics, and insights on the dashboard. Export data with one click.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-transparent to-transparent opacity-30 pointer-events-none"></div>
        
        <div className="container mx-auto px-6 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
              What Educators Say
            </h2>
            <p className="text-lg md:text-xl text-blue-200/80 max-w-3xl mx-auto">
              Hear from educators who have transformed their attendance management with AttendAI.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-slate-900/40 backdrop-blur-md border-slate-700/50 p-8 rounded-2xl hover:border-blue-500/30 transition-all hover:shadow-[0_0_30px_rgba(56,189,248,0.15)]">
              <div className="flex items-center mb-6">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-xl">
                  RB
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-white">Ram Bahadur Lama</h4>
                  <p className="text-blue-300/70">University Professor</p>
                </div>
              </div>
              <p className="text-blue-100 mb-4">
                "AttendAI has completely transformed how we take attendance in large lecture halls. What used to take 10 minutes now happens automatically as students enter the room."
              </p>
              <div className="flex text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            </Card>
            
            <Card className="bg-slate-900/40 backdrop-blur-md border-slate-700/50 p-8 rounded-2xl hover:border-blue-500/30 transition-all hover:shadow-[0_0_30px_rgba(56,189,248,0.15)]">
              <div className="flex items-center mb-6">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-xl">
                  AP
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-white">Arjun Prasad KC</h4>
                  <p className="text-blue-300/70">High School Principal</p>
                </div>
              </div>
              <p className="text-blue-100 mb-4">
                "The analytics have given us unprecedented insights into attendance patterns. We've been able to identify at-risk students and intervene much earlier."
              </p>
              <div className="flex text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            </Card>
            
            <Card className="bg-slate-900/40 backdrop-blur-md border-slate-700/50 p-8 rounded-2xl hover:border-blue-500/30 transition-all hover:shadow-[0_0_30px_rgba(56,189,248,0.15)]">
              <div className="flex items-center mb-6">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-xl">
                  SP
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-white">Sita Poudel</h4>
                  <p className="text-blue-300/70">College Administrator</p>
                </div>
              </div>
              <p className="text-blue-100 mb-4">
                "The implementation was seamless, and the support team was exceptional. We've saved hundreds of administrative hours in just one semester."
              </p>
              <div className="flex text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-teal-400/10 pointer-events-none"></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto bg-slate-900/70 backdrop-blur-xl p-10 md:p-16 rounded-3xl border border-slate-700/50 shadow-[0_0_50px_rgba(0,0,0,0.3)]">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
                Ready to Transform Your Classroom?
              </h2>
              <p className="text-lg md:text-xl text-blue-200/80 max-w-2xl mx-auto">
                Join educators worldwide who are saving time and improving accuracy with AttendAI.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white font-medium px-8 py-6 text-lg rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:shadow-[0_0_25px_rgba(56,189,248,0.5)] transition-all duration-300 w-full">
                  Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/about" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="bg-blue-950/30 text-blue-100 border-blue-400/30 hover:bg-blue-900/40 hover:border-blue-400/50 font-medium px-8 py-6 text-lg rounded-xl transition-all duration-300 w-full">
                  Request Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;

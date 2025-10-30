
import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const blogPosts = [
  {
    id: 1,
    title: 'The Future of Classroom Attendance',
    excerpt: 'How AI and facial recognition are transforming the way educators track student attendance.',
    date: 'May 12, 2023',
    author: 'Nadin Tamang',
    category: 'Technology',
    readTime: '5 min read',
    image: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=600&auto=format'
  },
  {
    id: 2,
    title: 'Privacy Considerations in Educational AI',
    excerpt: 'Balancing innovation with student privacy in the age of AI-powered education tools.',
    date: 'June 3, 2023',
    author: 'Michael Rodriguez',
    category: 'Privacy',
    readTime: '8 min read',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format'
  },
  {
    id: 3,
    title: 'Improving Student Engagement Through Data',
    excerpt: 'Using attendance patterns and analytics to identify at-risk students and improve outcomes.',
    date: 'July 18, 2023',
    author: 'Aisha Patel',
    category: 'Education',
    readTime: '6 min read',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format'
  },
  {
    id: 4,
    title: 'Case Study: University of Innovation',
    excerpt: 'How one university reduced administrative work by 75% with automated attendance.',
    date: 'August 5, 2023',
    author: 'James Wilson',
    category: 'Case Study',
    readTime: '10 min read',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format'
  },
  {
    id: 5,
    title: 'Facial Recognition Technology: What Educators Need to Know',
    excerpt: 'A primer on how facial recognition works and what to consider before implementation.',
    date: 'September 12, 2023',
    author: 'Nadin Tamang',
    category: 'Technology',
    readTime: '7 min read',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format'
  },
  {
    id: 6,
    title: 'The ROI of Automated Attendance Systems',
    excerpt: 'Calculating the return on investment for educational institutions adopting AI attendance.',
    date: 'October 29, 2023',
    author: 'Michael Rodriguez',
    category: 'Business',
    readTime: '9 min read',
    image: 'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=600&auto=format'
  }
];

const BlogPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950">
      <Navbar />

      {/* Hero Section */}
      <section className="relative px-6 lg:px-8 pt-20 pb-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-6">
            AttendAI Blog
          </h1>
          <p className="text-lg sm:text-xl leading-relaxed text-blue-200/80 max-w-2xl mx-auto">
            Insights, updates, and resources about AI in education and attendance tracking.
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-16 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map(post => (
              <Card 
                key={post.id} 
                className="group overflow-hidden bg-slate-900/60 backdrop-blur-lg border border-slate-700/50 rounded-2xl hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(56,189,248,0.15)] hover:-translate-y-2"
              >
                <div className="relative overflow-hidden">
                  <img 
                    src={post.image} 
                    alt={post.title} 
                    className="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="inline-block px-3 py-1 text-xs font-semibold text-white bg-blue-600/80 backdrop-blur-sm rounded-full">
                      {post.category}
                    </span>
                  </div>
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-xs text-blue-200/60 mb-3">
                    <span>{post.readTime}</span>
                  </div>
                  <CardTitle className="text-xl font-semibold text-white leading-tight hover:text-blue-300 transition-colors">
                    {post.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-blue-200/70 leading-relaxed">
                    {post.excerpt}
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between items-center border-t border-slate-700/30 pt-4">
                  <div className="flex flex-col text-sm">
                    <span className="text-blue-200/80 font-medium">{post.author}</span>
                    <span className="text-blue-200/50 text-xs">{post.date}</span>
                  </div>
                  <Link to={`/blog/${post.id}`}>
                    <Button 
                      size="sm" 
                      className="bg-blue-600/80 hover:bg-blue-600 text-white border-0 rounded-lg px-4 transition-all duration-300"
                    >
                      Read More
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
          
          {/* Load More Button */}
          <div className="mt-16 text-center">
            <Button 
              className="bg-slate-900/60 backdrop-blur-lg text-white border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-900/80 rounded-xl px-8 py-6 text-base transition-all duration-300"
            >
              Load More Articles
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default BlogPage;

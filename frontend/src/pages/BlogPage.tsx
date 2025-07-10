
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
    author: 'Dr. Sarah Chen',
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
    author: 'Dr. Sarah Chen',
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
    <>
      <Navbar />
      
      <div className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">AttendAI Blog</h1>
            <p className="text-lg text-gray-600">
              Insights, updates, and resources about AI in education and attendance tracking.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map(post => (
              <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow duration-300">
                <img 
                  src={post.image} 
                  alt={post.title} 
                  className="w-full h-48 object-cover"
                />
                <CardHeader>
                  <div className="flex justify-between items-center mb-2 text-sm text-gray-500">
                    <span>{post.category}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <CardTitle className="text-xl">{post.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{post.excerpt}</p>
                </CardContent>
                <CardFooter className="flex justify-between items-center pt-0">
                  <div className="text-sm text-gray-500">
                    <span>By {post.author}</span>
                    <span className="mx-2">•</span>
                    <span>{post.date}</span>
                  </div>
                  <Link to={`/blog/${post.id}`}>
                    <Button variant="outline" size="sm">Read more</Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <Button variant="outline">Load More Articles</Button>
          </div>
        </div>
      </div>
      
      <Footer />
    </>
  );
};

export default BlogPage;

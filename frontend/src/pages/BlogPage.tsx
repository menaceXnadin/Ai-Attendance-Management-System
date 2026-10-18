
import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { ArrowRight16Regular, Clock16Regular } from '@fluentui/react-icons';

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
    <div className="flex min-h-screen flex-col bg-surface-canvas text-text-primary">
      <Navbar />

      {/* Hero Section */}
      <section className="border-b border-border-subtle bg-surface-default px-4 pb-12 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-caption-strong text-brand-foreground">Blog</p>
          <h1 className="mt-2 text-display text-text-primary lg:text-[40px] lg:leading-[52px]">
            AttendAI Blog
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-6 text-text-secondary">
            Insights, updates, and resources about AI in education and attendance tracking.
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="flex-1 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map(post => (
              <Card
                key={post.id}
                className="group flex flex-col overflow-hidden rounded-lg border-transparent bg-surface-default shadow transition-shadow duration-150 ease-fluent-standard hover:shadow-md"
              >
                <div className="relative overflow-hidden bg-surface-subtle">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-48 w-full object-cover"
                  />
                </div>
                <CardHeader className="space-y-0 p-5 pb-2">
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="secondary" shape="pill">
                      {post.category}
                    </Badge>
                    <span className="flex items-center gap-1 text-caption text-text-muted">
                      <Clock16Regular aria-hidden />
                      {post.readTime}
                    </span>
                  </div>
                  <CardTitle className="text-subheading text-text-primary transition-colors duration-150 group-hover:text-brand-foreground">
                    {post.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-5 pt-0">
                  <p className="text-body text-text-secondary">
                    {post.excerpt}
                  </p>
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-3 border-t border-border-subtle p-5 py-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-body-strong text-text-primary">{post.author}</span>
                    <span className="text-caption text-text-muted">{post.date}</span>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
                    <Link to={`/blog/${post.id}`}>
                      Read More
                      <ArrowRight16Regular aria-hidden />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Load More Button */}
          <div className="mt-12 text-center">
            <Button variant="outline" size="lg" className="px-6">
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

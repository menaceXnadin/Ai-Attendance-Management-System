import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight20Regular } from '@fluentui/react-icons';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import { ArrowLink, Container, Photo } from './primitives';
import { studentDevice } from './photos';

/**
 * Final call to action: a single brand-coloured band (the only full brand
 * surface on the page) with a photograph that rises above the band's top edge.
 */
const ClosingCta: React.FC = () => {
  const { user } = useAuth();

  return (
    <section aria-labelledby="closing-title" className="bg-surface-default pt-20 sm:pt-24 lg:pt-28">
      <div className="bg-brand text-brand-on">
        <Container className="grid gap-10 pb-14 lg:grid-cols-12 lg:gap-12 lg:pb-0">
          <div className="order-2 pt-0 lg:order-1 lg:col-span-6 lg:py-20 xl:col-span-6">
            <h2 id="closing-title" className="lp-h2 max-w-[32rem]">
              Ready when the next class starts.
            </h2>
            <p className="lp-lede mt-5 max-w-[30rem] opacity-90">
              Sign in with the account your institution gave you. You’ll land in the portal for your role.
            </p>
            <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
              <Button
                asChild
                size="lg"
                className="h-11 bg-surface-default px-5 text-[15px] text-brand-foreground hover:bg-surface-hover active:bg-surface-pressed"
              >
                <Link to={user ? '/dashboard' : '/login'}>
                  <span>{user ? 'Open your dashboard' : 'Sign in to AttendAI'}</span>
                  <ArrowRight20Regular aria-hidden />
                </Link>
              </Button>
              {!user && (
                <ArrowLink to="/forgot-password" className="text-brand-on hover:text-brand-on">
                  Forgot your password?
                </ArrowLink>
              )}
            </div>
          </div>

          <div className="order-1 -mt-10 sm:-mt-16 lg:order-2 lg:col-span-5 lg:col-start-8 lg:-mt-20 lg:mb-20">
            <div className="aspect-[4/3] overflow-hidden rounded-lg bg-surface-subtle shadow-lg">
              <Photo photo={studentDevice} sizes="(min-width: 1024px) 480px, 100vw" />
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
};

export default ClosingCta;

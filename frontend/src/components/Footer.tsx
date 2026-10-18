import * as React from 'react';
import { Link } from 'react-router-dom';
import logo from '@/assets/main.png';
import '@/components/landing/landing.css';

export interface FooterCredit {
  author: string;
  source: string;
  url: string;
  license: string;
}

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'The three portals', to: '/#product' },
      { label: 'How a class is recorded', to: '/#how-it-works' },
      { label: 'Trust and integrity', to: '/#trust' },
    ],
  },
  {
    title: 'Portals',
    links: [
      { label: 'Student portal', to: '/student' },
      { label: 'Teacher portal', to: '/teacher' },
      { label: 'Admin portal', to: '/app' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: 'Reset your password', to: '/forgot-password' },
      { label: 'About AttendAI', to: '/about' },
    ],
  },
];

/** Groups credits by source and licence, one entry per author. */
function groupCredits(credits: FooterCredit[]) {
  const groups = new Map<string, { key: string; source: string; license: string; authors: FooterCredit[] }>();
  for (const c of credits) {
    const key = `${c.source}|${c.license}`;
    const group = groups.get(key) ?? { key, source: c.source, license: c.license, authors: [] };
    if (!group.authors.some((a) => a.author === c.author)) group.authors.push(c);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const linkClass =
  'rounded-sm text-body text-text-secondary underline-offset-4 transition-colors duration-150 hover:text-text-primary hover:underline';

/** Site footer for the public pages. `credits` lists photography used on the page. */
const Footer: React.FC<{ credits?: FooterCredit[] }> = ({ credits }) => (
  <footer className="border-t border-border-subtle bg-surface-canvas">
    <div className="lp-container pb-8 pt-14">
      <div className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5 lg:col-span-4">
          <Link to="/" className="inline-flex items-center gap-2 rounded-sm" aria-label="AttendAI home">
            <img src={logo} alt="" className="h-6 w-6 object-contain" />
            <span className="text-subheading text-text-primary">AttendAI</span>
          </Link>
          <p className="mt-3 max-w-xs text-body text-text-muted">
            Class-session attendance with face check-in, teacher registers and an audit trail for every change.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7 lg:col-span-7 lg:col-start-6">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-caption-strong text-text-primary">{col.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-3 border-t border-border-subtle pt-6 text-caption text-text-muted md:flex-row md:items-start md:justify-between md:gap-10">
        <p className="shrink-0">&copy; {new Date().getFullYear()} AttendAI</p>
        {credits && credits.length > 0 && (
          <p className="md:text-right">
            {groupCredits(credits).map((group, gi) => (
              <React.Fragment key={group.key}>
                {gi > 0 && ' '}
                Photography from {group.source} ({group.license}):{' '}
                {group.authors.map((c, i) => (
                  <React.Fragment key={c.url}>
                    {i > 0 && ', '}
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline-offset-2 hover:text-text-primary hover:underline"
                    >
                      {c.author}
                    </a>
                  </React.Fragment>
                ))}
                .
              </React.Fragment>
            ))}
          </p>
        )}
      </div>
    </div>
  </footer>
);

export default Footer;

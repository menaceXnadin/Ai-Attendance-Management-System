import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight16Regular } from '@fluentui/react-icons';
import { cn } from '@/lib/utils';
import type { LandingPhoto } from './photos';
import type { ProductScreen } from './screens';
import './landing.css';

/**
 * Building blocks shared by every landing-page section.
 *
 * Rhythm: sections alternate `tone="default"` (surface-default) and
 * `tone="tint"` (surface-canvas). Content sits in a 1280px container with
 * fluid gutters. Headlines use the `lp-*` type scale from landing.css.
 */

type Tone = 'default' | 'tint';

export const Container: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('lp-container', className)} {...props} />
);

export const Section: React.FC<
  React.HTMLAttributes<HTMLElement> & { tone?: Tone; bleed?: boolean; divider?: boolean }
> = ({ tone = 'default', bleed = false, divider = false, className, children, ...props }) => (
  <section
    className={cn(
      tone === 'tint' ? 'bg-surface-canvas' : 'bg-surface-default',
      divider && 'border-t border-border-subtle',
      !bleed && 'lp-section',
      className
    )}
    {...props}
  >
    {bleed ? children : <Container>{children}</Container>}
  </section>
);

export const Eyebrow: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p className={cn('lp-eyebrow text-brand-foreground', className)} {...props} />
);

/**
 * Eyebrow + headline + optional lede, left aligned (the landing page never
 * centres section headers). `action` renders on the right on wide screens,
 * aligned to the headline's last line.
 */
export const SectionHeader: React.FC<{
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
  className?: string;
}> = ({ eyebrow, title, lede, action, id, className }) => (
  <div className={cn('flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16', className)}>
    <div className="max-w-[46rem]">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={id} className={cn('lp-h2 text-text-primary', eyebrow && 'mt-3')}>
        {title}
      </h2>
      {lede && <p className="lp-lede mt-5 max-w-[40rem] text-text-secondary">{lede}</p>}
    </div>
    {action && <div className="shrink-0 lg:pb-1.5">{action}</div>}
  </div>
);

/**
 * Text link with a trailing chevron ("Learn more ›" pattern). Internal paths
 * use react-router; `#anchor` and external hrefs render a plain <a>.
 */
export const ArrowLink: React.FC<{
  to: string;
  children: React.ReactNode;
  className?: string;
  tone?: 'brand' | 'neutral';
}> = ({ to, children, className, tone = 'brand' }) => {
  const classes = cn(
    'group inline-flex min-h-10 items-center gap-1 rounded-sm text-[15px] font-semibold leading-6 underline-offset-4',
    'transition-colors duration-150 ease-fluent-standard hover:underline',
    tone === 'brand'
      ? 'text-brand-foreground hover:text-brand-foreground-hover'
      : 'text-text-primary hover:text-text-secondary',
    className
  );
  const inner = (
    <>
      <span>{children}</span>
      <ChevronRight16Regular
        aria-hidden
        className="transition-transform duration-150 ease-fluent-standard group-hover:translate-x-0.5 motion-reduce:transform-none"
      />
    </>
  );
  if (to.startsWith('#') || /^https?:/.test(to)) {
    return (
      <a href={to} className={classes}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={to} className={classes}>
      {inner}
    </Link>
  );
};

/** Responsive photograph that fills its (sized) parent with an art-directed crop. */
export const Photo: React.FC<{
  photo: LandingPhoto;
  sizes?: string;
  eager?: boolean;
  className?: string;
  /**
   * Overrides the photo's default object-position. Pass `null` to leave it to
   * `className` (e.g. responsive `object-[50%_50%] lg:object-[50%_100%]`).
   */
  position?: string | null;
}> = ({ photo, sizes = '100vw', eager = false, className, position }) => (
  <img
    src={photo.src}
    srcSet={photo.srcSet}
    sizes={photo.srcSet ? sizes : undefined}
    width={photo.width}
    height={photo.height}
    alt={photo.alt}
    loading={eager ? 'eager' : 'lazy'}
    decoding={eager ? 'sync' : 'async'}
    {...(eager ? { fetchpriority: 'high' } : {})}
    className={cn('h-full w-full object-cover', className)}
    style={position === null ? undefined : { objectPosition: position ?? photo.position ?? '50% 50%' }}
  />
);

/**
 * A real product screenshot in a quiet frame (the capture already carries the
 * app's own title bar, so no fake window chrome is added). Shows the light or
 * dark capture to match the site theme; the hidden one is never downloaded
 * because lazy images with display:none are skipped.
 *
 * `crop` zooms into part of the screenshot: `aspect` sets the visible box
 * (CSS aspect-ratio), `position` is both the object-position and the zoom
 * origin, and `scale` the zoom (1 = cover the box).
 */
export const ScreenFrame: React.FC<{
  screen: ProductScreen;
  className?: string;
  eager?: boolean;
  crop?: { aspect: string; position?: string; scale?: number };
  /** Rendered width hint for the responsive candidates. Zoomed crops should ask for the full-size file. */
  sizes?: string;
}> = ({ screen, className, eager = false, crop, sizes = '(min-width: 1024px) 60vw, 100vw' }) => {
  // The box always reserves the screenshot's (or crop's) aspect ratio, so lazy loading never shifts the page.
  const imgClass = crop ? 'absolute inset-0 h-full w-full object-cover' : 'absolute inset-0 h-full w-full object-cover object-top';
  const imgStyle: React.CSSProperties | undefined = crop
    ? {
        objectPosition: crop.position ?? '0% 0%',
        transform: crop.scale && crop.scale !== 1 ? `scale(${crop.scale})` : undefined,
        transformOrigin: crop.position ?? '0% 0%',
      }
    : undefined;
  const common = {
    width: screen.width,
    height: screen.height,
    loading: eager ? ('eager' as const) : ('lazy' as const),
    decoding: 'async' as const,
    style: imgStyle,
  };
  return (
    <figure
      className={cn(
        'overflow-hidden rounded-lg border border-border-subtle bg-surface-default',
        'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(0,0,0,0.22)]',
        className
      )}
    >
      <div
        className="relative overflow-hidden bg-surface-subtle"
        style={{ aspectRatio: crop ? crop.aspect : `${screen.width} / ${screen.height}` }}
      >
        <img
          src={screen.light}
          srcSet={screen.lightSrcSet}
          sizes={screen.lightSrcSet ? sizes : undefined}
          alt={screen.alt}
          className={cn(imgClass, 'dark:hidden')}
          {...common}
        />
        <img
          src={screen.dark}
          srcSet={screen.darkSrcSet}
          sizes={screen.darkSrcSet ? sizes : undefined}
          alt={screen.alt}
          className={cn(imgClass, 'hidden dark:block')}
          {...common}
        />
      </div>
    </figure>
  );
};

/** A list item with a short brand rule on the left; used instead of checkmark bullets. */
export const RuleList: React.FC<{ items: React.ReactNode[]; className?: string }> = ({ items, className }) => (
  <ul className={cn('divide-y divide-border-subtle border-y border-border-subtle', className)}>
    {items.map((item, i) => (
      <li key={i} className="lp-body py-3.5 text-text-secondary">
        {item}
      </li>
    ))}
  </ul>
);

/**
 * Editorial photography for the public landing page.
 * Files live in `src/assets/landing/photos/` (WebP, optimised). Owned by the imagery pass.
 * All four photographs are from Unsplash (Unsplash License: free to use, attribution appreciated).
 */
import heroLg from '@/assets/landing/photos/hero-classroom-1400.webp';
import heroSm from '@/assets/landing/photos/hero-classroom-800.webp';
import teacherLg from '@/assets/landing/photos/teacher-front-1440.webp';
import teacherSm from '@/assets/landing/photos/teacher-front-720.webp';
import studentLg from '@/assets/landing/photos/student-device-1440.webp';
import studentSm from '@/assets/landing/photos/student-device-720.webp';
import hallLg from '@/assets/landing/photos/lecture-hall-2400.webp';
import hallSm from '@/assets/landing/photos/lecture-hall-1200.webp';

export interface LandingPhoto {
  /** Default (largest) source. */
  src: string;
  /** Responsive candidates, e.g. "a.webp 960w, b.webp 1600w". */
  srcSet?: string;
  width: number;
  height: number;
  /** Meaningful alt text describing the scene. */
  alt: string;
  /** CSS object-position used for art-directed crops (default "50% 50%"). */
  position?: string;
  credit?: { author: string; source: string; url: string; license: string };
}

export type PhotoCredit = NonNullable<LandingPhoto['credit']>;

/**
 * Students in a university lecture or classroom, natural light. Hero photograph.
 * 7:8 portrait crop. Faces sit in a band from ~35% to ~57% of the height across the full width;
 * the top ~30% is a plain warm wall (calm space), the bottom ~25% is a wooden desk front.
 */
export const heroClassroom: LandingPhoto = {
  src: heroLg,
  srcSet: `${heroSm} 800w, ${heroLg} 1400w`,
  width: 1400,
  height: 1600,
  alt: 'University students at wooden desks in a lecture hall, listening and taking notes while one raises his hand to ask a question',
  position: '50% 45%',
  credit: {
    author: 'Vitaly Gariev',
    source: 'Unsplash',
    url: 'https://unsplash.com/photos/students-raising-hands-in-a-lecture-hall-Z_Z_2-GMD9E',
    license: 'Unsplash License',
  },
};

/**
 * A lecturer teaching in front of a class. Teacher story.
 * 4:3. The lecturer stands left of centre (face at ~40% x, ~17% y); students are seen from behind
 * in the lower half. The upper-right wall (x 50-95%, y 0-40%) is plain and calm.
 */
export const teacherFront: LandingPhoto = {
  src: teacherLg,
  srcSet: `${teacherSm} 720w, ${teacherLg} 1440w`,
  width: 1440,
  height: 1080,
  alt: 'A smiling lecturer in a grey sweater stands at the front of a classroom, seen past the backs of students seated at their desks',
  position: '40% 25%',
  credit: {
    author: 'Vitaly Gariev',
    source: 'Unsplash',
    url: 'https://unsplash.com/photos/teacher-lecturing-students-in-a-classroom-setting-14jNrPntbgk',
    license: 'Unsplash License',
  },
};

/**
 * A student using a phone or laptop on campus. Student story.
 * 4:3. The student sits on the left third (face at ~33% x, ~28% y) looking down at a laptop that
 * points into the frame; the right ~40% is softly blurred trees and sky (calm space).
 */
export const studentDevice: LandingPhoto = {
  src: studentLg,
  srcSet: `${studentSm} 720w, ${studentLg} 1440w`,
  width: 1440,
  height: 1080,
  alt: 'A student in a plaid shirt sits on a campus bench under the trees, typing on a laptop resting on her knees',
  position: '30% 40%',
  credit: {
    author: 'Sanket Mishra',
    source: 'Unsplash',
    url: 'https://unsplash.com/photos/a-woman-sitting-on-a-bench-using-a-laptop-computer-uA8_uSOxFt4',
    license: 'Unsplash License',
  },
};

/**
 * Wide lecture hall / campus scene for a full-bleed editorial band.
 * 12:5, low-key. The upper ~55% is a block wall with six window-shaped patches of golden light;
 * the lower ~45% is rows of dark empty desk chairs. Calmest areas: the wall above the right-hand
 * patches (x 60-100%, y 0-25%) and the gap between the 3rd and 4th patches (x 42-55%).
 */
export const lectureHall: LandingPhoto = {
  src: hallLg,
  srcSet: `${hallSm} 1200w, ${hallLg} 2400w`,
  width: 2400,
  height: 1000,
  alt: 'Late-afternoon sunlight falls in window-shaped patches on a classroom wall above rows of empty desk chairs',
  position: '50% 35%',
  credit: {
    author: 'Allen Y',
    source: 'Unsplash',
    url: 'https://unsplash.com/photos/empty-classroom-with-sunlight-shining-through-windows-6Bae9-46yeU',
    license: 'Unsplash License',
  },
};

/** Attribution list for the footer / credits line. */
export const photoCredits: PhotoCredit[] = [heroClassroom, teacherFront, studentDevice, lectureHall]
  .map((p) => p.credit)
  .filter((c): c is PhotoCredit => Boolean(c));

import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

function withOpacity(varName: string) {
	return ({ opacityValue }: { opacityValue?: string }) => {
		if (opacityValue && !opacityValue.startsWith("var(")) {
			return `color-mix(in srgb, var(${varName}) calc(${opacityValue} * 100%), transparent)`;
		}
		return `var(${varName})`;
	};
}

export default {
	darkMode: ["class"],
	content: [
		"./src/**/*.{html,js,ts,jsx,tsx}",
		"./components/**/*.{html,js,ts,jsx,tsx}",
		"./pages/**/*.{html,js,ts,jsx,tsx}"
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['"Segoe UI"', '"Segoe UI Web (West European)"', '-apple-system', 'BlinkMacSystemFont', 'Roboto', '"Helvetica Neue"', 'sans-serif'],
				mono: ['"Cascadia Code"', 'Consolas', '"Courier New"', 'monospace']
			},
			fontSize: {
				// Fluent 2 type ramp
				'display': ['2rem', { lineHeight: '2.5rem', fontWeight: '600' }],        // Title 1 · 32/40
				'title-2': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '600' }],    // Title 2 · 28/36
				'page-title': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],     // Title 3 · 24/32
				'section-title': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }], // Subtitle 1 · 20/28
				'subheading': ['1rem', { lineHeight: '1.375rem', fontWeight: '600' }],   // Subtitle 2 · 16/22
				'body': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],      // Body 1 · 14/20
				'body-strong': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '600' }],
				'label': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '600' }],
				'caption': ['0.75rem', { lineHeight: '1rem', fontWeight: '400' }],       // Caption 1 · 12/16
				'caption-strong': ['0.75rem', { lineHeight: '1rem', fontWeight: '600' }],
				'overline': ['0.625rem', { lineHeight: '0.875rem', fontWeight: '600', letterSpacing: '0.04em' }] // Caption 2 · 10/14
			},
			colors: {
				border: {
					DEFAULT: 'hsl(var(--border))',
					subtle: withOpacity('--border-subtle'),
					default: withOpacity('--border-default'),
					strong: withOpacity('--border-strong'),
				},
				'border-subtle': withOpacity('--border-subtle'),
				'border-default': withOpacity('--border-default'),
				'border-strong': withOpacity('--border-strong'),
				text: {
					primary: withOpacity('--text-primary'),
					secondary: withOpacity('--text-secondary'),
					muted: withOpacity('--text-muted'),
					inverse: withOpacity('--text-inverse'),
					disabled: withOpacity('--text-disabled'),
				},
				'text-primary': withOpacity('--text-primary'),
				'text-secondary': withOpacity('--text-secondary'),
				'text-muted': withOpacity('--text-muted'),
				'text-inverse': withOpacity('--text-inverse'),
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				surface: {
					canvas: withOpacity('--surface-canvas'),
					DEFAULT: withOpacity('--surface-default'),
					default: withOpacity('--surface-default'),
					subtle: withOpacity('--surface-subtle'),
					raised: withOpacity('--surface-raised'),
					hover: withOpacity('--surface-hover'),
					pressed: withOpacity('--surface-pressed'),
					selected: withOpacity('--surface-selected'),
				},
				'surface-canvas': withOpacity('--surface-canvas'),
				'surface-default': withOpacity('--surface-default'),
				'surface-subtle': withOpacity('--surface-subtle'),
				'surface-raised': withOpacity('--surface-raised'),
				action: {
					DEFAULT: withOpacity('--action-primary'),
					default: withOpacity('--action-primary'),
					primary: withOpacity('--action-primary'),
					'primary-hover': withOpacity('--action-primary-hover'),
					'primary-subtle': withOpacity('--action-primary-subtle'),
					secondary: withOpacity('--action-secondary'),
				},
				'action-primary': withOpacity('--action-primary'),
				'action-primary-hover': withOpacity('--action-primary-hover'),
				'action-primary-subtle': withOpacity('--action-primary-subtle'),
				'action-secondary': withOpacity('--action-secondary'),
				'border-token': {
					subtle: withOpacity('--border-subtle'),
					DEFAULT: withOpacity('--border-default'),
					strong: withOpacity('--border-strong'),
				},
				nav: {
					surface: withOpacity('--nav-surface'),
					hover: withOpacity('--nav-hover'),
					active: withOpacity('--nav-active'),
					text: withOpacity('--nav-text'),
				},
				status: {
					success: withOpacity('--status-success'),
					'success-subtle': withOpacity('--status-success-subtle'),
					'success-border': withOpacity('--status-success-border'),
					warning: withOpacity('--status-warning'),
					'warning-subtle': withOpacity('--status-warning-subtle'),
					'warning-border': withOpacity('--status-warning-border'),
					error: withOpacity('--status-error'),
					'error-subtle': withOpacity('--status-error-subtle'),
					'error-border': withOpacity('--status-error-border'),
					info: withOpacity('--status-info'),
					'info-subtle': withOpacity('--status-info-subtle'),
					'info-border': withOpacity('--status-info-border'),
				},
				brand: {
					DEFAULT: withOpacity('--brand'),
					hover: withOpacity('--brand-hover'),
					pressed: withOpacity('--brand-pressed'),
					foreground: withOpacity('--brand-foreground'),
					'foreground-hover': withOpacity('--brand-foreground-hover'),
					subtle: withOpacity('--brand-subtle'),
					'subtle-hover': withOpacity('--brand-subtle-hover'),
					stroke: withOpacity('--brand-stroke'),
					on: withOpacity('--on-brand'),
					// Teams brand ramp (static)
					50: '#E8EBFA',
					100: '#DCE0FA',
					200: '#C5CBFA',
					300: '#AAB1FA',
					400: '#7F85F5',
					500: '#5B5FC7',
					600: '#4F52B2',
					700: '#444791',
					800: '#383966',
					900: '#2F2F4A',
				},
				'surface-hover': withOpacity('--surface-hover'),
				'surface-pressed': withOpacity('--surface-pressed'),
				'surface-selected': withOpacity('--surface-selected'),
				'text-disabled': withOpacity('--text-disabled'),
				titlebar: withOpacity('--titlebar'),
				presence: {
					available: withOpacity('--presence-available'),
					away: withOpacity('--presence-away'),
					busy: withOpacity('--presence-busy'),
					offline: withOpacity('--presence-offline'),
				},
				chart: {
					1: withOpacity('--chart-1'),
					2: withOpacity('--chart-2'),
					3: withOpacity('--chart-3'),
					4: withOpacity('--chart-4'),
					5: withOpacity('--chart-5'),
					6: withOpacity('--chart-6'),
					7: withOpacity('--chart-7'),
					8: withOpacity('--chart-8'),
				}
			},
			borderRadius: {
				// Fluent 2 corner radii
				none: '0px',
				sm: '2px',
				DEFAULT: '4px',
				md: '4px',
				lg: '8px',
				xl: '12px',
				'2xl': '16px',
				full: '9999px',
			},
			boxShadow: {
				// Fluent 2 elevation ramp (theme-aware via CSS variables)
				none: 'none',
				xs: 'var(--shadow-2)',
				sm: 'var(--shadow-2)',
				DEFAULT: 'var(--shadow-4)',
				md: 'var(--shadow-8)',
				lg: 'var(--shadow-16)',
				xl: 'var(--shadow-28)',
				'2xl': 'var(--shadow-64)',
				'fluent-2': 'var(--shadow-2)',
				'fluent-4': 'var(--shadow-4)',
				'fluent-8': 'var(--shadow-8)',
				'fluent-16': 'var(--shadow-16)',
				'fluent-28': 'var(--shadow-28)',
				'fluent-64': 'var(--shadow-64)',
			},
			// `text-primary` / `text-action-primary` render the accessible brand
			// foreground (lighter in dark mode) while `bg-primary` stays the filled brand.
			textColor: {
				primary: {
					DEFAULT: withOpacity('--brand-foreground'),
					foreground: 'hsl(var(--primary-foreground))',
				},
				'action-primary': withOpacity('--brand-foreground'),
				action: {
					DEFAULT: withOpacity('--brand-foreground'),
					default: withOpacity('--brand-foreground'),
					primary: withOpacity('--brand-foreground'),
				},
			},
			transitionTimingFunction: {
				'fluent-decelerate': 'cubic-bezier(0.1, 0.9, 0.2, 1)',
				'fluent-accelerate': 'cubic-bezier(0.9, 0.1, 1, 0.2)',
				'fluent-standard': 'cubic-bezier(0.33, 0, 0.67, 1)',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in-up': {
					'0%': {
						opacity: '0',
						transform: 'translateY(8px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in-up': 'fade-in-up 0.3s cubic-bezier(0.1, 0.9, 0.2, 1) forwards'
			}
		}
	},
	plugins: [
		tailwindcssAnimate
	],
} satisfies Config;

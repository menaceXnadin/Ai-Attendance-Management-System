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
				sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
				mono: ['"IBM Plex Mono"', 'monospace']
			},
			fontSize: {
				'display': ['2rem', { lineHeight: '2.5rem', fontWeight: '600' }],
				'page-title': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
				'section-title': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
				'subheading': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
				'body': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
				'body-strong': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
				'label': ['0.8125rem', { lineHeight: '1rem', fontWeight: '500' }],
				'caption': ['0.75rem', { lineHeight: '1rem', fontWeight: '400' }],
				'overline': ['0.6875rem', { lineHeight: '1rem', fontWeight: '600', letterSpacing: '0.05em' }]
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
					50: "#e6f5f7",
					100: "#ccebef",
					200: "#99d7df",
					300: "#66c3cf",
					400: "#33afbf",
					500: "#009baf",
					600: "#007c8c",
					700: "#005d69",
					800: "#003e46",
					900: "#001f23",
				}
			},
			borderRadius: {
				none: '0px',
				sm: '4px',
				md: '6px',
				lg: '8px',
				full: '9999px',
			},
			boxShadow: {
				none: 'none',
				sm: '0 1px 2px 0 rgba(16, 24, 40, 0.06)',
				md: '0 4px 12px 0 rgba(16, 24, 40, 0.10)',
				lg: '0 12px 32px 0 rgba(16, 24, 40, 0.14)',
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
				'fade-in-up': 'fade-in-up 0.3s ease-out forwards'
			}
		}
	},
	plugins: [
		tailwindcssAnimate
	],
} satisfies Config;

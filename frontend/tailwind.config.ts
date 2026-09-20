import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

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
					subtle: 'var(--border-subtle)',
					default: 'var(--border-default)',
					strong: 'var(--border-strong)',
				},
				'border-subtle': 'var(--border-subtle)',
				'border-default': 'var(--border-default)',
				'border-strong': 'var(--border-strong)',
				text: {
					primary: 'var(--text-primary)',
					secondary: 'var(--text-secondary)',
					muted: 'var(--text-muted)',
					inverse: 'var(--text-inverse)',
				},
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
					canvas: 'var(--surface-canvas)',
					DEFAULT: 'var(--surface-default)',
					subtle: 'var(--surface-subtle)',
					raised: 'var(--surface-raised)',
				},
				action: {
					primary: 'var(--action-primary)',
					'primary-hover': 'var(--action-primary-hover)',
					'primary-subtle': 'var(--action-primary-subtle)',
					secondary: 'var(--action-secondary)',
				},
				'border-token': {
					subtle: 'var(--border-subtle)',
					DEFAULT: 'var(--border-default)',
					strong: 'var(--border-strong)',
				},
				nav: {
					surface: 'var(--nav-surface)',
					hover: 'var(--nav-hover)',
					active: 'var(--nav-active)',
					text: 'var(--nav-text)',
				},
				status: {
					success: 'var(--status-success)',
					'success-subtle': 'var(--status-success-subtle)',
					'success-border': 'var(--status-success-border)',
					warning: 'var(--status-warning)',
					'warning-subtle': 'var(--status-warning-subtle)',
					'warning-border': 'var(--status-warning-border)',
					error: 'var(--status-error)',
					'error-subtle': 'var(--status-error-subtle)',
					'error-border': 'var(--status-error-border)',
					info: 'var(--status-info)',
					'info-subtle': 'var(--status-info-subtle)',
					'info-border': 'var(--status-info-border)',
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

/** @type {import('tailwindcss').Config} */
module.exports = {
  safelist: [],
  content: [
    './layout/**/*.liquid',
    './templates/**/*.liquid',
    './sections/**/*.liquid',
    './snippets/**/*.liquid',
    './blocks/**/*.liquid',
  ],
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        primary: 'var(--font-primary--family)',
        secondary: 'var(--font-secondary--family)',
      },
      colors: {
        /* Primary brand */
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--color-primary-foreground) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'primary-light': 'rgb(var(--color-primary-light) / <alpha-value>)',
        'primary-wash': 'rgb(var(--color-primary-wash) / <alpha-value>)',
        /* Neutrals */
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        body: 'rgb(var(--color-body) / <alpha-value>)',
        mid: 'rgb(var(--color-mid) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'background-alt': 'rgb(var(--color-background-alt) / <alpha-value>)',
        background: 'rgb(var(--color-background) / <alpha-value>)',
        /* Status */
        error: 'rgb(var(--color-error) / <alpha-value>)',
        'error-wash': 'rgb(var(--color-error-wash) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};

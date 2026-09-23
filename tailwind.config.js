/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // Los colores se declaran como variables CSS y no como valores fijos: es
        // lo que permite el tema claro/oscuro y, más adelante, que cada empresa
        // aplique su propio color de marca (white-label) sin recompilar.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Los importes y los códigos se muestran en tipografía tabular para que
        // las columnas de cifras queden alineadas y sean fáciles de comparar.
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        // El diálogo no se desliza desde ningún borde: nace y muere en su sitio,
        // así que lo único que lo hace sentir un objeto y no un recorte de CSS es
        // una leve escala. La salida es más rápida que la entrada — a nadie le
        // gusta esperar a que algo termine de irse.
        'dialog-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'dialog-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.97)' },
        },
        'overlay-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'overlay-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        // Entrada de una tarjeta al aparecer en pantalla (carga de página,
        // llegada de datos): un asomo leve desde abajo, nunca desde la nada
        // (por eso escala 0.97 y no 0, y solo 6px de recorrido, no un
        // deslizamiento). Sirve para no partir la aparición de golpe cuando
        // varias tarjetas llegan a la vez — no para repetirse en cada
        // interacción, así que no lleva rebote.
        'card-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-in-right': 'slide-in-right 0.2s ease-out',
        // `cubic-bezier(0.16, 1, 0.3, 1)` es la aproximación estándar en CSS de un
        // resorte críticamente amortiguado (damping 1.0): llega rápido y se posa
        // sin rebote, en vez de desacelerar parejo como un `ease-out` corriente.
        'dialog-in': 'dialog-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'dialog-out': 'dialog-out 150ms cubic-bezier(0.4, 0, 1, 1)',
        'overlay-in': 'overlay-in 200ms ease-out',
        'overlay-out': 'overlay-out 150ms ease-in',
        'card-in': 'card-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
      },
      boxShadow: {
        // Dos capas, no una: un borde de contacto ajustado (la superficie
        // "toca" la página) más una difusa amplia (la profundidad debajo).
        // Es lo que separa una tarjeta elegante de un `shadow-sm` plano — una
        // sola sombra ancha se ve borrosa; una sola sombra corta se ve pegada.
        card: '0 1px 2px -1px rgb(0 0 0 / 0.07), 0 6px 16px -4px rgb(0 0 0 / 0.08)',
        'card-hover': '0 2px 4px -1px rgb(0 0 0 / 0.08), 0 12px 28px -6px rgb(0 0 0 / 0.14)',
      },
    },
  },
  plugins: [],
};

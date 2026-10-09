import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { blue: '#4A90D9', sky: '#50A8EB', crimson: '#D6365B', buy: '#57C25E' },
      },
      borderRadius: { card: '14px' },
    },
  },
  plugins: [],
};
export default config;

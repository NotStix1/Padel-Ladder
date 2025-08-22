/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
	theme: {
		extend: {
			colors: {
				brand: {
					DEFAULT: '#22c55e',
					dark: '#16a34a'
				}
			}
		}
	},
	darkMode: 'class',
	plugins: []
}



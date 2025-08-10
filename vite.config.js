import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set base to '/<your-repo-name>/' for GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: '-on-patrol-live-bingo',
})

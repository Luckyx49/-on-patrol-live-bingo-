import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/on-patrol-live-bingo-/', // must match repo name EXACTLY (case + dashes)
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // If your repo is e.g. on-patrol-live-bingo-plus:
  base: '/on-patrol-live-bingo-plus/',   // <-- must match repo name exactly
})

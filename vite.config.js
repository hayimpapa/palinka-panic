import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base set to './' for Vercel / static-host compatibility (relative asset paths)
export default defineConfig({
  base: './',
  plugins: [react()],
})

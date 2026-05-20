import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const version = fs.readFileSync(path.resolve(__dirname, '../VERSION'), 'utf-8').trim()

// https://vite.dev/config/
export default defineConfig({
  base: '/aichat/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})

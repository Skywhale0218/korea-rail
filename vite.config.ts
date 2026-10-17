import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages는 https://<user>.github.io/<repo>/ 경로로 서비스되므로
// 배포 시 VITE_BASE=/<repo>/ 를 넘겨줍니다. (deploy.yml이 자동 처리)
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
})

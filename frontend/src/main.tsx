import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Self-hosted fonts for the «Афиша» design system (variant 4a):
// Oswald — display, Onest — UI, Ubuntu Mono — meta, Caveat — stickers.
import '@fontsource-variable/oswald/index.css'
import '@fontsource-variable/onest/index.css'
import '@fontsource/ubuntu-mono/400.css'
import '@fontsource/ubuntu-mono/700.css'
import '@fontsource-variable/caveat/index.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

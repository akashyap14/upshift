import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { SessionProvider } from './api/session'
import { Landing } from './Landing'
import './styles/tokens.css'

// /app = mobile player app, /admin = company web app (LMS)
// oxlint-disable-next-line react/only-export-components
const AppRoot = lazy(() => import('./app/AppRoot'))
// oxlint-disable-next-line react/only-export-components
const AdminRoot = lazy(() => import('./admin/AdminRoot'))

async function start() {
  // VITE_MOCK=1: everything mocked. VITE_MOCK=hybrid: PDF questions and news rounds use the real backend.
  if (import.meta.env.VITE_MOCK === '1' || import.meta.env.VITE_MOCK === 'hybrid') {
    const { installMock } = await import('./api/mock/server')
    installMock({ hybrid: import.meta.env.VITE_MOCK === 'hybrid' })
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  })

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <BrowserRouter>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/app/*" element={<AppRoot />} />
                <Route path="/admin/*" element={<AdminRoot />} />
                <Route path="*" element={<Landing />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </SessionProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

start()

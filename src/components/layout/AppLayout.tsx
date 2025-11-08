import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Dialog, DialogContent } from '@/components/ui/dialog'

export function AppLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50/60">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <Dialog open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <DialogContent className="h-full max-h-full w-72 max-w-[85vw] rounded-none border-none bg-white p-0 shadow-xl dark:bg-slate-900 md:hidden">
          <Sidebar />
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 flex-col">
        <Header onMenuClick={() => setIsMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-slate-100">
          <div className="mx-auto w-full max-w-[1400px] p-6 pb-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}



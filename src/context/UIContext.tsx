import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

type UIContextValue = {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (value: boolean) => void
  pageTitle: string
  setPageTitle: (title: string) => void
  notifySuccess: (message: string, description?: string) => void
  notifyError: (message: string, description?: string) => void
  confirmAction: (options: { title: string; description: string; confirmLabel?: string }) => Promise<boolean>
}

const UIContext = createContext<UIContextValue | undefined>(undefined)

export function UIProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [pageTitle, setPageTitle] = useState('Dashboard')

  const toggleSidebar = useCallback(() => setSidebarCollapsed((prev) => !prev), [])

  const notifySuccess = useCallback((message: string, description?: string) => {
    toast.success(message, {
      description,
      position: 'top-center',
    })
  }, [])

  const notifyError = useCallback((message: string, description?: string) => {
    toast.error(message, {
      description,
      position: 'top-center',
    })
  }, [])

  const confirmAction = useCallback(
    ({ title, description, confirmLabel = 'Confirm' }: { title: string; description: string; confirmLabel?: string }) =>
      new Promise<boolean>((resolve) => {
        const id = toast.custom(
          () => (
            <div className="space-y-3 rounded-xl border border-border bg-background p-4 shadow-lg">
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-input bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
                  onClick={() => {
                    toast.dismiss(id)
                    resolve(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    toast.dismiss(id)
                    resolve(true)
                  }}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          ),
          { duration: 60_000, position: 'top-center' },
        )
      }),
    [],
  )

  const value = useMemo<UIContextValue>(
    () => ({
      sidebarCollapsed,
      toggleSidebar,
      setSidebarCollapsed,
      pageTitle,
      setPageTitle,
      notifySuccess,
      notifyError,
      confirmAction,
    }),
    [sidebarCollapsed, toggleSidebar, pageTitle, notifySuccess, notifyError, confirmAction],
  )

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const context = useContext(UIContext)
  if (!context) {
    throw new Error('useUI must be used within a UIProvider')
  }
  return context
}



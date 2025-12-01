import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react'
import { navigationLinks } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { useUI } from '@/context/UIContext'
import { Button } from '@/components/ui/button'

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUI()

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-border bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 transition-all duration-300',
        sidebarCollapsed ? 'w-20' : 'w-72',
      )}
    >
      <div className="flex items-center justify-between px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          {!sidebarCollapsed && (
            <div>
              <p className="text-base font-semibold text-foreground">EduEnglish</p>
              <p className="text-xs text-muted-foreground">Teacher Panel</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navigationLinks.map((item) => {
          const Icon = item.icon
          const hasChildren = Array.isArray(item.children)
          const content = (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90' : 'text-muted-foreground',
                  ('disabled' in item && (item as { disabled?: boolean }).disabled) && 'pointer-events-none opacity-50',
                )
              }
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          )

          if (!hasChildren || sidebarCollapsed) {
            return <Fragment key={item.to}>{content}</Fragment>
          }

          return (
            <div key={item.to} className="space-y-1">
              {content}
              {!sidebarCollapsed && (
                <div className="ml-10 space-y-1">
                  {item.children?.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-secondary-foreground',
                          isActive && 'bg-secondary text-secondary-foreground',
                        )
                      }
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className={cn('px-4 py-6', sidebarCollapsed && 'px-2')}>
        <div className="rounded-xl bg-primary/10 p-4 text-xs text-muted-foreground">
          {!sidebarCollapsed ? (
            <p>
              Managing <span className="font-semibold text-primary">English mastery</span> for every learner. Keep the
              curriculum fresh and data-driven.
            </p>
          ) : (
            <p className="text-center text-primary">Lead</p>
          )}
        </div>
      </div>
    </aside>
  )
}



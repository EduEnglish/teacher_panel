import { Link } from 'react-router-dom'
import { Bell, LogOut, Menu, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { getInitials } from '@/utils/formatters'

type HeaderProps = {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth()
  const { pageTitle, notifySuccess, notifyError } = useUI()

  const handleLogout = async () => {
    try {
      await logout()
      notifySuccess('Signed out successfully')
    } catch (error) {
      notifyError('Failed to sign out', error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-border bg-white/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={onMenuClick} aria-label="Toggle navigation">
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary/80">EduEnglish</p>
          <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="hidden gap-2 rounded-full sm:flex" asChild>
          <Link to="/curriculum/grades">
            <ShieldCheck className="h-4 w-4" />
            Manage Curriculum
          </Link>
        </Button>
        <Button variant="default" size="sm" className="gap-2 rounded-full shadow" asChild>
          <Link to="/curriculum/quizzes/new">
            <Plus className="h-4 w-4" />
            New Quiz
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full border border-border bg-background/60">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="focus-visible:outline-none">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.photoURL ?? undefined} alt={user?.displayName ?? 'Admin'} />
              <AvatarFallback>{getInitials(user?.displayName ?? user?.email ?? 'Admin')}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{user?.displayName ?? 'EduEnglish Admin'}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">Profile & Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}



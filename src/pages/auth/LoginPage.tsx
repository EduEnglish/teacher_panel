import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login, resetPassword, isAuthenticated } = useAuth()
  const { notifyError, notifySuccess } = useUI()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'
      navigate(redirectTo, { replace: true })
    }
  }, [isAuthenticated, navigate, location.state])

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsLoggingIn(true)
    try {
      // Trim email and password to remove leading/trailing whitespace
      const trimmedEmail = values.email.trim()
      const trimmedPassword = values.password.trim()
      
      await login(trimmedEmail, trimmedPassword)
      notifySuccess('Welcome back to EduEnglish!')
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'
      navigate(redirectTo, { replace: true })
    } catch (error) {
      notifyError('Login failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setIsLoggingIn(false)
    }
  })

  const handleForgotPassword = async () => {
    const email = form.getValues('email')
    const trimmedEmail = email.trim()
    
    if (!trimmedEmail) {
      form.setError('email', { message: 'Enter your email to reset password' })
      return
    }

    try {
      await resetPassword(trimmedEmail)
      notifySuccess('Password reset sent', 'Check your inbox for reset instructions.')
    } catch (error) {
      notifyError('Unable to send reset link', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#E8F1FF] via-white to-[#F4F9FF] px-4 py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#93C5FD_0,_transparent_45%),_radial-gradient(circle_at_bottom,_#BFDBFE_0,_transparent_45%)]" />
      <Card className="w-full max-w-lg border-none shadow-xl shadow-primary/10">
        <CardHeader className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary">
            <span className="text-2xl font-bold">EE</span>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold text-foreground">EduEnglish Teacher Panel</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Sign in to manage curriculum, monitor progress, and empower every learner.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="admin@eduenglish.com"
                        autoComplete="email"
                        {...field}
                        onChange={(e) => {
                          // Remove all spaces from email input
                          const valueWithoutSpaces = e.target.value.replace(/\s/g, '')
                          field.onChange(valueWithoutSpaces)
                        }}
                        onBlur={(e) => {
                          // Trim any remaining whitespace (shouldn't be any, but just in case)
                          const trimmedValue = e.target.value.trim()
                          field.onChange(trimmedValue)
                          field.onBlur()
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="pr-10"
                          {...field}
                          onChange={(e) => {
                            const trimmedValue = e.target.value.trimStart()
                            field.onChange(trimmedValue)
                          }}
                          onBlur={(e) => {
                            const trimmedValue = e.target.value.trim()
                            field.onChange(trimmedValue)
                            field.onBlur()
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <div className="flex justify-end">
                      <button
                        className="text-xs font-medium text-primary hover:underline focus:outline-none"
                        type="button"
                        onClick={handleForgotPassword}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                className="w-full rounded-full py-2.5 font-semibold shadow-md shadow-primary/20"
                type="submit"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </Form>
          <div className="rounded-2xl bg-primary/5 p-4 text-center text-xs text-muted-foreground">
            Secured access for the EduEnglish curriculum lead. All activity is audited and encrypted.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}



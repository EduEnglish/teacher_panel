import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
    try {
      await login(values.email, values.password)
      notifySuccess('Welcome back to EduEnglish!')
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'
      navigate(redirectTo, { replace: true })
    } catch (error) {
      notifyError('Login failed', error instanceof Error ? error.message : 'Please try again.')
    }
  })

  const handleForgotPassword = async () => {
    const email = form.getValues('email')
    if (!email) {
      form.setError('email', { message: 'Enter your email to reset password' })
      return
    }

    try {
      await resetPassword(email)
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
                      <Input placeholder="admin@eduenglish.com" autoComplete="email" {...field} />
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
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <button
                        className="text-xs font-medium text-primary hover:underline focus:outline-none"
                        type="button"
                        onClick={handleForgotPassword}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button className="w-full rounded-full py-2.5 font-semibold shadow-md shadow-primary/20" type="submit">
                Sign in
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



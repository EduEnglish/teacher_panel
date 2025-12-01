import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { adminSettingsSchema, type AdminSettingsFormValues } from '@/utils/schemas'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { fetchLatestAdminProfile, saveAdminProfile } from '@/services/firebase'

export function SettingsPage() {
  const { user, resetPassword } = useAuth()
  const { setPageTitle, notifyError, notifySuccess } = useUI()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<AdminSettingsFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(adminSettingsSchema) as any,
    defaultValues: {
      name: user?.displayName ?? 'EduEnglish Admin',
      email: user?.email ?? '',
      status: 'active',
    },
  })

  useEffect(() => {
    setPageTitle('Profile & Settings')
  }, [setPageTitle])

  useEffect(() => {
    async function loadProfile() {
      try {
        setIsLoading(true)
        const profile = await fetchLatestAdminProfile()
        if (profile) {
          form.reset({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            status: profile.status,
          })
        } else if (user) {
          form.reset({
            name: user.displayName ?? 'EduEnglish Admin',
            email: user.email ?? '',
            status: 'active',
          })
        }
      } catch (error) {
        notifyError('Unable to load profile', error instanceof Error ? error.message : undefined)
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [form, notifyError, user])

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      setIsLoading(true)
      const profileId = await saveAdminProfile({
        id: values.id,
        name: values.name,
        email: values.email,
        status: values.status,
      })
      notifySuccess('Profile updated')
      form.setValue('id', profileId)
    } catch (error) {
      notifyError('Unable to save profile', error instanceof Error ? error.message : undefined)
    } finally {
      setIsLoading(false)
    }
  })

  const handlePasswordReset = async () => {
    if (!form.getValues('email')) {
      notifyError('Please save an email before requesting a reset link.')
      return
    }
    try {
      await resetPassword(form.getValues('email'))
      notifySuccess('Password reset link sent to your email.')
    } catch (error) {
      notifyError('Unable to send reset link', error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Admin Profile</CardTitle>
          <CardDescription>Update your contact details and preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@eduenglish.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>


              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" onClick={handlePasswordReset}>
                  Send Password Reset
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}



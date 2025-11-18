import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { adminSettingsSchema, type AdminSettingsFormValues } from '@/utils/schemas'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { deleteFile, fetchLatestAdminProfile, saveAdminProfile, uploadFile } from '@/services/firebase'
import { getInitials } from '@/utils/formatters'

export function SettingsPage() {
  const { user, resetPassword } = useAuth()
  const { setPageTitle, notifyError, notifySuccess } = useUI()
  const [isLoading, setIsLoading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  const form = useForm<AdminSettingsFormValues>({
    resolver: zodResolver(adminSettingsSchema) as any,
    defaultValues: {
      name: user?.displayName ?? 'EduEnglish Admin',
      email: user?.email ?? '',
      weaknessThreshold: 60,
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
            logoUrl: profile.logoUrl,
            logoStoragePath: profile.logoStoragePath,
            weaknessThreshold: profile.weaknessThreshold,
            status: profile.status,
          })
        } else if (user) {
          form.reset({
            name: user.displayName ?? 'EduEnglish Admin',
            email: user.email ?? '',
            weaknessThreshold: 60,
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
        logoUrl: values.logoUrl,
        logoStoragePath: values.logoStoragePath,
        weaknessThreshold: values.weaknessThreshold,
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

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setLogoUploading(true)
      if (form.getValues('logoStoragePath')) {
        await deleteFile(form.getValues('logoStoragePath')!)
      }
      const storagePath = `branding/${Date.now()}-${file.name}`
      const { url, path } = await uploadFile(storagePath, file)
      form.setValue('logoUrl', url, { shouldValidate: true })
      form.setValue('logoStoragePath', path, { shouldValidate: true })
      notifySuccess('Logo uploaded successfully')
    } catch (error) {
      notifyError('Unable to upload logo', error instanceof Error ? error.message : undefined)
    } finally {
      setLogoUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!form.getValues('logoStoragePath')) {
      form.setValue('logoUrl', undefined)
      return
    }
    try {
      setLogoUploading(true)
      await deleteFile(form.getValues('logoStoragePath')!)
      form.setValue('logoUrl', undefined)
      form.setValue('logoStoragePath', undefined)
      notifySuccess('Logo removed')
    } catch (error) {
      notifyError('Unable to remove logo', error instanceof Error ? error.message : undefined)
    } finally {
      setLogoUploading(false)
    }
  }

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

  const logoUrl = form.watch('logoUrl')

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Brand Identity</CardTitle>
          <CardDescription>Customize the panel visuals for a branded experience.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={logoUrl} alt={form.watch('name')} />
              <AvatarFallback>{getInitials(form.watch('name'))}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload a square logo (PNG or SVG recommended) to personalize the portal.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" asChild disabled={logoUploading}>
                  <label className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    {logoUploading ? 'Uploading…' : 'Upload Logo'}
                    <input type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} />
                  </label>
                </Button>
                {logoUrl && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemoveLogo} disabled={logoUploading}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

              <FormField
                name="weaknessThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weakness Threshold (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={field.value}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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



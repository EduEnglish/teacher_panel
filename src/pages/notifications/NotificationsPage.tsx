import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { BellRing, CalendarClock, Inbox, SendHorizonal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { StatsCard } from '@/components/feedback/StatsCard'
import { useCollection } from '@/hooks/useCollection'
import { useUI } from '@/context/UIContext'
import { useAuth } from '@/context/AuthContext'
import {
  cancelNotification,
  notificationService,
  scheduleNotification,
  sendNotification,
} from '@/services/firebase'
import { Timestamp } from 'firebase/firestore'
import type { Notification } from '@/types/models'
import {
  notificationAudienceOptions,
  notificationChannelOptions,
  notificationStatusBadges,
  statusOptions,
} from '@/utils/constants'
import { notificationSchema, type NotificationFormValues } from '@/utils/schemas'
import { formatDate } from '@/utils/formatters'

type NotificationTableRow = Notification & {
  audienceLabel: string
  channelLabels: string[]
}

const DEFAULT_VALUES: NotificationFormValues = {
  title: '',
  message: '',
  audienceType: 'all',
  audienceValue: '',
  channels: ['in-app'],
  deliveryStatus: 'draft',
  scheduledAt: undefined,
  status: 'active',
}

function toDate(value: unknown) {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return undefined
}

function formatDateTime(value: unknown) {
  const date = toDate(value)
  if (!date) return '—'
  try {
    return date.toLocaleString()
  } catch {
    return '—'
  }
}

export function NotificationsPage() {
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const { user } = useAuth()
  const { data: notifications, isLoading } = useCollection<Notification>(notificationService.listen)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const form = useForm<NotificationFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(notificationSchema) as any,
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  })

  useEffect(() => {
    setPageTitle('Notifications Center')
  }, [setPageTitle])

  useEffect(() => {
    if (!editingNotification) {
      form.reset(DEFAULT_VALUES)
      return
    }

    form.reset({
      id: editingNotification.id,
      title: editingNotification.title,
      message: editingNotification.message,
      audienceType: editingNotification.audienceType,
      audienceValue: editingNotification.audienceValue ?? '',
      channels: editingNotification.channels ?? ['in-app'],
      deliveryStatus: editingNotification.deliveryStatus ?? 'draft',
      scheduledAt: toDate(editingNotification.scheduledAt),
      status: editingNotification.status ?? 'active',
    })
  }, [editingNotification, form])

  const activeNotifications = useMemo(
    () => notifications.filter((notification) => notification.status !== 'inactive'),
    [notifications],
  )

  const rows = useMemo<NotificationTableRow[]>(
    () =>
      activeNotifications
        .slice()
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
        .map((notification) => ({
          ...notification,
          audienceLabel:
            notificationAudienceOptions.find((option) => option.value === notification.audienceType)?.label ??
            notification.audienceType,
          channelLabels: notification.channels?.map(
            (channel) => notificationChannelOptions.find((option) => option.value === channel)?.label ?? channel,
          ) ?? [],
        })),
    [activeNotifications],
  )

  const summary = useMemo(() => {
    const total = activeNotifications.length
    const scheduled = activeNotifications.filter((notification) => notification.deliveryStatus === 'scheduled').length
    const sent = activeNotifications.filter((notification) => notification.deliveryStatus === 'sent').length
    return { total, scheduled, sent }
  }, [activeNotifications])

  const openNewModal = () => {
    setEditingNotification(null)
    setIsModalOpen(true)
  }

  const handleEdit = (notification: Notification) => {
    setEditingNotification(notification)
    setIsModalOpen(true)
  }

  const handleArchive = async (notification: Notification) => {
    const confirmed = await confirmAction({
      title: 'Archive notification?',
      description:
        'Archiving will remove it from the feed and prevent further sends. Historical analytics remain untouched.',
      confirmLabel: 'Archive',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      await notificationService.update(
        notification.id,
        { status: 'inactive', deliveryStatus: 'cancelled', scheduledAt: null, sentAt: null },
        user.uid,
        { title: notification.title },
      )
      notifySuccess('Notification archived')
    } catch (error) {
      notifyError('Unable to archive notification', error instanceof Error ? error.message : undefined)
    }
  }

  const handleSendNow = async (notification: Notification) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    const confirmed = await confirmAction({
      title: 'Send notification now?',
      description: `This will immediately deliver “${notification.title}” to the selected audience.`,
      confirmLabel: 'Send now',
    })
    if (!confirmed) return

    try {
      setIsSending(true)
      await sendNotification(notification.id, user.uid, { title: notification.title })
      notifySuccess('Notification sent')
    } catch (error) {
      notifyError('Unable to send notification', error instanceof Error ? error.message : undefined)
    } finally {
      setIsSending(false)
    }
  }

  const handleCancelDelivery = async (notification: Notification) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    const confirmed = await confirmAction({
      title: 'Cancel delivery?',
      description: `Any scheduled sends for “${notification.title}” will be cancelled.`,
      confirmLabel: 'Cancel delivery',
    })
    if (!confirmed) return

    try {
      await cancelNotification(notification.id, user.uid, { title: notification.title })
      notifySuccess('Delivery cancelled')
    } catch (error) {
      notifyError('Unable to cancel delivery', error instanceof Error ? error.message : undefined)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }

    try {
      setIsSaving(true)

      const basePayload = {
        title: values.title,
        message: values.message,
        audienceType: values.audienceType,
        audienceValue: values.audienceType === 'all' ? '' : values.audienceValue?.trim() ?? '',
        channels: values.channels,
        deliveryStatus: values.deliveryStatus,
        scheduledAt: values.scheduledAt ? Timestamp.fromDate(values.scheduledAt) : null,
        status: values.status ?? 'active',
      }

      let targetId: string

      if (editingNotification) {
        await notificationService.update(editingNotification.id, basePayload, user.uid, {
          title: values.title,
          deliveryStatus: values.deliveryStatus,
        })
        targetId = editingNotification.id
      } else {
        const created = await notificationService.create(
          {
            ...basePayload,
            createdBy: user.uid,
            metadata: {
              audienceType: values.audienceType,
            },
          } as Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>,
          user.uid,
          { title: values.title },
        )
        targetId = created.id
      }

      if (values.deliveryStatus === 'sent') {
        await sendNotification(targetId, user.uid, { title: values.title })
      } else if (values.deliveryStatus === 'scheduled' && values.scheduledAt) {
        await scheduleNotification(targetId, values.scheduledAt, user.uid, {
          title: values.title,
          scheduledAt: values.scheduledAt.toISOString(),
        })
      } else if (values.deliveryStatus === 'cancelled') {
        await cancelNotification(targetId, user.uid, { title: values.title })
      }

      notifySuccess(editingNotification ? 'Notification updated' : 'Notification created')
      setIsModalOpen(false)
      setEditingNotification(null)
    } catch (error) {
      notifyError('Unable to save notification', error instanceof Error ? error.message : undefined)
    } finally {
      setIsSaving(false)
    }
  })

  const columns: Array<DataTableColumn<NotificationTableRow>> = [
    {
      key: 'title',
      header: 'Notification',
      render: (row) => (
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{row.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{row.message}</p>
        </div>
      ),
    },
    {
      key: 'audienceType',
      header: 'Audience',
      render: (row) => <Badge variant="outline">{row.audienceLabel}</Badge>,
    },
    {
      key: 'channels',
      header: 'Channels',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.channelLabels.map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'scheduledAt',
      header: 'Schedule',
      render: (row) => <span className="text-sm text-muted-foreground">{formatDateTime(row.scheduledAt)}</span>,
    },
    {
      key: 'deliveryStatus',
      header: 'Status',
      render: (row) => {
        const badge = notificationStatusBadges[row.deliveryStatus] ?? { label: row.deliveryStatus, variant: 'outline' }
        return (
          <Badge variant={badge.variant}>
            {badge.label}
            {row.sentAt ? <span className="ml-2 text-[10px] opacity-70">{formatDate(row.sentAt)}</span> : null}
          </Badge>
        )
      },
    },
    {
      key: 'deliveryActions',
      header: 'Delivery',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            disabled={row.deliveryStatus === 'sent' || isSending}
            onClick={() => handleSendNow(row)}
          >
            <SendHorizonal className="mr-1 h-3 w-3" />
            Send
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            disabled={row.deliveryStatus !== 'scheduled'}
            onClick={() => handleCancelDelivery(row)}
          >
            Cancel
          </Button>
        </div>
      ),
    },
  ]

  const renderChannelSelection = (
    <FormField
      control={form.control}
      name="channels"
      render={({ field }) => (
        <FormItem className="space-y-3 rounded-xl border border-border/60 p-4">
          <FormLabel>Delivery channels</FormLabel>
          <p className="text-xs text-muted-foreground">
            Pick how students receive the notification. Combine channels for maximum reach.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {notificationChannelOptions.map((option) => {
              const checked = field.value?.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => {
                      if (value) {
                        field.onChange([...(field.value ?? []), option.value])
                      } else {
                        field.onChange((field.value ?? []).filter((item: string) => item !== option.value))
                      }
                    }}
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    <p className="text-xs text-muted-foreground">
                      {option.value === 'in-app'
                        ? 'Appears inside the student portal.'
                        : option.value === 'email'
                          ? 'Sends branded email updates.'
                          : 'Pushes mobile notifications (requires app).'}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Total notifications"
          value={summary.total.toString()}
          description="Drafted, scheduled, and sent"
          icon={<Inbox className="h-10 w-10" />}
        />
        <StatsCard
          title="Scheduled"
          value={summary.scheduled.toString()}
          description="Awaiting delivery window"
          icon={<CalendarClock className="h-10 w-10" />}
        />
        <StatsCard
          title="Delivered"
          value={summary.sent.toString()}
          description="Successfully sent messages"
          icon={<BellRing className="h-10 w-10" />}
        />
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold">Notification campaigns</CardTitle>
            <CardDescription>Craft announcements, reminders, and updates tailored to your learners.</CardDescription>
          </div>
          <Button className="rounded-full px-6" onClick={openNewModal}>
            <SendHorizonal className="mr-2 h-4 w-4" />
            New notification
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No notifications yet. Launch your first campaign to get started."
            onEdit={handleEdit}
            onDelete={handleArchive}
          />
        </CardContent>
      </Card>

      <FormModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingNotification(null)
        }}
        title={editingNotification ? 'Edit notification' : 'Create notification'}
        description="Define the message, audience, and delivery settings for your notification."
        onSubmit={onSubmit}
        submitLabel={editingNotification ? 'Update notification' : 'Create notification'}
        isSubmitting={isSaving}
      >
        <Form {...form}>
          <form className="space-y-5">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notification title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Reading Week Challenge" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message content</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Share the key details your students need to know." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="audienceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audience</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                        if (value === 'all') {
                          form.setValue('audienceValue', '')
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select audience" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {notificationAudienceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('audienceType') !== 'all' && (
                <FormField
                  control={form.control}
                  name="audienceValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Audience filter</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Grade 5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {renderChannelSelection}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="deliveryStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                        if (value !== 'scheduled') {
                          form.setValue('scheduledAt', undefined)
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="sent">Send immediately</SelectItem>
                        <SelectItem value="cancelled">Cancel delivery</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('deliveryStatus') === 'scheduled' && (
                <FormField
                  control={form.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule date &amp; time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={
                            field.value
                              ? new Date(field.value).toISOString().slice(0, 16)
                              : ''
                          }
                          onChange={(event) => {
                            const value = event.target.value
                            form.setValue('scheduledAt', value ? new Date(value) : undefined)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormModal>
    </div>
  )
}


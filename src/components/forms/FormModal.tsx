import { type ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type FormModalProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  onSubmit: () => void
  submitLabel?: string
  children: ReactNode
  isSubmitting?: boolean
  secondaryAction?: ReactNode
  hideSubmitButton?: boolean
}

export function FormModal({
  open,
  title,
  description,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  children,
  isSubmitting,
  secondaryAction,
  hideSubmitButton = false,
}: FormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description || ' '}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">{children}</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          {secondaryAction}
          {!hideSubmitButton && (
            <Button onClick={onSubmit} disabled={isSubmitting} type="button">
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}



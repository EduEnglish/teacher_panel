import { type ReactNode } from 'react'
import { MoreHorizontal, Pencil, Trash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/utils/cn'

export type DataTableColumn<T> = {
  key: keyof T | string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (item: T) => ReactNode
}

type DataTableProps<T> = {
  data: T[]
  columns: Array<DataTableColumn<T>>
  emptyMessage?: string
  caption?: string
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  onRowClick?: (item: T) => void
  isLoading?: boolean
}

export function DataTable<T>({ data, columns, emptyMessage = 'No records found', caption, onEdit, onDelete, onRowClick, isLoading }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader className="bg-muted/30">
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={String(column.key)}
                style={{ width: column.width }}
                className={cn(column.align === 'center' && 'text-center', column.align === 'right' && 'text-right')}
              >
                {column.header}
              </TableHead>
            ))}
            {(onEdit || onDelete) && <TableHead className="w-16 text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}>
                <div className="flex h-24 items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-3 w-3 rounded-full bg-primary/40" />
                    Loading records…
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}>
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">{emptyMessage}</div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((item, index) => (
              <TableRow 
                key={index}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
              >
                {columns.map((column) => {
                  const value = column.render
                    ? column.render(item)
                    : (item as Record<string, unknown>)[column.key as keyof Record<string, unknown>]
                  return (
                    <TableCell
                      key={String(column.key)}
                      className={cn(
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        'whitespace-normal',
                      )}
                    >
                      {value as ReactNode}
                    </TableCell>
                  )
                })}
                {(onEdit || onDelete) && (
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {onEdit && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="gap-2">
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="gap-2 text-destructive">
                            <Trash className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}



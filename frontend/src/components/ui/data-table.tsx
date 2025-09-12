import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  accessor: (item: T) => ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  className?: string
  emptyMessage?: string
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  className,
  emptyMessage = 'No data available'
}: DataTableProps<T>) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'p-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase break-words',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                  column.align === 'left' && 'text-left',
                  !column.align && 'text-left'
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.length > 0 ? (
            data.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {columns.map((column) => (
                  <td
                    key={`${item.id}-${column.key}`}
                    className={cn(
                      'p-4 break-words',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.align === 'left' && 'text-left',
                      !column.align && 'text-left',
                      column.className
                    )}
                  >
                    {column.accessor(item)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="p-8 text-center text-gray-500 dark:text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TableTopbar } from '@/components/table-topbar'
import { TableControls } from '@/components/table-controls'
import { DataTableView } from '@/components/data-table-view'
import { TablePagination } from '@/components/table-pagination'
import { TableTabs } from '@/components/table-tabs'

interface QueryResult {
  data: Record<string, any>[]
  meta: Array<{ name: string; type: string }>
  rows: number
  statistics?: {
    elapsed: number
    rows_read: number
    bytes_read: number
  }
}

interface TableStats {
  total_rows: number
  total_bytes: number
  compressed_size: string
  uncompressed_size: string
}

export default function TableDetail({
  params
}: {
  params: { database: string; table: string }
}) {
  const { database, table } = params
  const [data, setData] = useState<QueryResult | null>(null)
  const [stats, setStats] = useState<TableStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const tableName = `${database}.${table}`

  useEffect(() => {
    loadTableData()
    loadTableStats()
  }, [database, table])

  const loadTableData = async (limit = 1000) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `SELECT * FROM ${tableName} LIMIT ${limit}`
        })
      })
      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table data')
    } finally {
      setLoading(false)
    }
  }

  const loadTableStats = async () => {
    try {
      const response = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            SELECT 
              count() as total_rows,
              sum(data_compressed_bytes) as total_bytes,
              formatReadableSize(sum(data_compressed_bytes)) as compressed_size,
              formatReadableSize(sum(data_uncompressed_bytes)) as uncompressed_size
            FROM system.parts 
            WHERE database = '${database}' 
              AND table = '${table}'
          `
        })
      })
      const result = await response.json()
      if (result.success && result.data.length > 0) {
        setStats(result.data[0])
      }
    } catch (err) {
      console.error('Failed to load table stats:', err)
    }
  }

  const exportTable = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/database/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName, limit: 50000 })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${tableName.replace('.', '_')}_export_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        const result = await response.json()
        setError(result.error || 'Failed to export data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data')
    } finally {
      setLoading(false)
    }
  }

  const dropTable = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `DROP TABLE ${tableName}` })
      })
      const result = await response.json()
      if (result.success) {
        router.push('/')
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to drop table')
    } finally {
      setLoading(false)
    }
  }

  const deleteRow = async (rowData: Record<string, any>) => {
    setLoading(true)
    try {
      const whereClause = Object.entries(rowData)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(' AND ')

      const response = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `ALTER TABLE ${tableName} DELETE WHERE ${whereClause}`
        })
      })

      const result = await response.json()
      if (result.success) {
        loadTableData()
        loadTableStats()
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete row')
    } finally {
      setLoading(false)
    }
  }

  const editRow = async (originalRow: Record<string, any>, updatedRow: Record<string, any>) => {
    setLoading(true)
    try {
      // Build WHERE clause from original row data
      const whereClause = Object.entries(originalRow)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(' AND ')

      // Build SET clause from updated row data
      const setClause = Object.entries(updatedRow)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(', ')

      const response = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `ALTER TABLE ${tableName} UPDATE ${setClause} WHERE ${whereClause}`
        })
      })

      const result = await response.json()
      if (result.success) {
        loadTableData()
        loadTableStats()
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit row')
    } finally {
      setLoading(false)
    }
  }

  const hideRow = (rowData: Record<string, any>) => {
    // This is handled locally in the DataTableView component
    // Could be extended to persist hidden rows to localStorage or backend
    console.log('Row hidden:', rowData)
  }

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden">
      <TableTopbar
        database={database}
        table={table}
        stats={stats}
        columnsCount={data?.meta?.length || 0}
        loading={loading}
        onRefresh={() => loadTableData()}
        onExport={exportTable}
        onDropTable={dropTable}
      />

      {/* Tabs */}
      <TableTabs database={database} table={table} />

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex-shrink-0">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      <div className="w-full relative h-full overflow-auto [&>div]:h-full">
        <DataTableView
          data={data?.data || []}
          columns={data?.meta || []}
          loading={loading}
          onDeleteRow={deleteRow}
          onEditRow={editRow}
          onHideRow={hideRow}
        />
      </div>
    </div>
  )
} 
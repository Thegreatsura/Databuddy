'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Database, Search, Play, Download, BarChart3, Trash2, Plus } from 'lucide-react'
import Link from 'next/link'

interface TableInfo {
  name: string
  database: string
  engine: string
  total_rows: number
  total_bytes: number
}

interface DatabaseStatsData {
  overview: {
    total_tables: number
    total_rows: number
    total_bytes: number
  }
  databases: Array<{
    database: string
    table_count: number
    total_rows: number
    total_bytes: number
  }>
}

export default function DatabaseManager() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [filteredTables, setFilteredTables] = useState<TableInfo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState<DatabaseStatsData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      setFilteredTables(tables.filter(table =>
        table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        table.database.toLowerCase().includes(searchTerm.toLowerCase())
      ))
    } else {
      setFilteredTables(tables)
    }
  }, [tables, searchTerm])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tablesRes, statsRes] = await Promise.all([
        fetch('/api/database/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ includeSystem: false })
        }),
        fetch('/api/database/stats')
      ])

      const tablesData = await tablesRes.json()
      const statsData = await statsRes.json()

      if (tablesData.success) setTables(tablesData.data)
      if (statsData.success) setStats(statsData.data)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Database Manager</h1>
              <p className="text-muted-foreground">ClickHouse Administration</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sql">
              <Button>
                <Play className="h-4 w-4" />
                SQL Console
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tables</p>
                    <p className="text-2xl font-bold">{stats.overview.total_tables}</p>
                  </div>
                  <Database className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Rows</p>
                    <p className="text-2xl font-bold">{formatNumber(stats.overview.total_rows)}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Size</p>
                    <p className="text-2xl font-bold">{formatBytes(stats.overview.total_bytes)}</p>
                  </div>
                  <Download className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tables List */}
        <Card>
          <CardHeader>
            <CardTitle>Tables ({filteredTables.length})</CardTitle>
            <CardDescription>Click on a table to view and manage its data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredTables.map((table) => (
                <Link 
                  key={`${table.database}.${table.name}`}
                  href={`/table/${table.database}/${table.name}`}
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{table.name}</span>
                          <Badge variant="outline" className="text-xs">{table.database}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatNumber(table.total_rows)} rows • {formatBytes(table.total_bytes)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{table.engine}</Badge>
                      <div className={`h-2 w-2 rounded-full ${table.total_rows > 0 ? 'bg-green-500' : 'bg-gray-400'}`} />
                    </div>
                  </div>
                </Link>
              ))}
              
              {filteredTables.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4" />
                  <p>No tables found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

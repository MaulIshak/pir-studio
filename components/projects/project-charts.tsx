'use client'

import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartBar, TrendUp, CheckCircle, Clock } from '@phosphor-icons/react'

export interface TaskSummary {
  id: string
  title?: string
  status: string
  created_at?: string
  due_date?: string | null
}

interface ProjectChartsProps {
  tasks: TaskSummary[]
}

const statusChartConfig = {
  count: {
    label: 'Tasks',
  },
  todo: {
    label: 'To Do',
    color: '#94a3b8',
  },
  in_progress: {
    label: 'In Progress',
    color: '#0284c7',
  },
  review: {
    label: 'Review',
    color: '#d97706',
  },
  done: {
    label: 'Done',
    color: '#16a34a',
  },
} satisfies ChartConfig

const timelineChartConfig = {
  completed: {
    label: 'Completed Tasks',
    color: '#16a34a',
  },
  created: {
    label: 'Created Tasks',
    color: 'var(--color-primary)',
  },
} satisfies ChartConfig

export function ProjectCharts({ tasks }: ProjectChartsProps) {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly'>('daily')

  // 1. Task Status Distribution Data
  const statusData = useMemo(() => {
    const counts = {
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    }

    tasks.forEach((t) => {
      if (t.status in counts) {
        counts[t.status as keyof typeof counts]++
      }
    })

    return [
      { status: 'To Do', count: counts.todo, fill: '#94a3b8', key: 'todo' },
      { status: 'In Progress', count: counts.in_progress, fill: '#0284c7', key: 'in_progress' },
      { status: 'Review', count: counts.review, fill: '#d97706', key: 'review' },
      { status: 'Done', count: counts.done, fill: '#16a34a', key: 'done' },
    ]
  }, [tasks])

  // 2. Timeline Activity Data (Daily / Weekly)
  const timelineData = useMemo(() => {
    const today = new Date()

    if (timeframe === 'daily') {
      // Last 7 days
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(today.getDate() - i)
        d.setHours(0, 0, 0, 0)
        const dateStr = d.toISOString().split('T')[0]
        const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

        // Count tasks created on this day
        const createdCount = tasks.filter((t) => {
          if (!t.created_at) return false
          const taskDate = new Date(t.created_at).toISOString().split('T')[0]
          return taskDate === dateStr
        }).length

        // Count tasks completed on this day (approx based on created or due)
        const completedCount = tasks.filter((t) => {
          if (t.status !== 'done') return false
          if (!t.created_at) return false
          const taskDate = new Date(t.created_at).toISOString().split('T')[0]
          return taskDate === dateStr
        }).length

        days.push({
          label: d.toLocaleDateString('en-US', { weekday: 'short' }),
          fullDate: label,
          created: createdCount,
          completed: completedCount,
        })
      }
      return days
    } else {
      // Last 4 weeks
      const weeks = []
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date()
        weekStart.setDate(today.getDate() - (i + 1) * 7)
        weekStart.setHours(0, 0, 0, 0)

        const weekEnd = new Date()
        weekEnd.setDate(today.getDate() - i * 7)
        weekEnd.setHours(23, 59, 59, 999)

        const createdCount = tasks.filter((t) => {
          if (!t.created_at) return false
          const taskTime = new Date(t.created_at).getTime()
          return taskTime >= weekStart.getTime() && taskTime <= weekEnd.getTime()
        }).length

        const completedCount = tasks.filter((t) => {
          if (t.status !== 'done') return false
          if (!t.created_at) return false
          const taskTime = new Date(t.created_at).getTime()
          return taskTime >= weekStart.getTime() && taskTime <= weekEnd.getTime()
        }).length

        weeks.push({
          label: `W-${i === 0 ? 'Current' : 4 - i}`,
          fullDate: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          created: createdCount,
          completed: completedCount,
        })
      }
      return weeks
    }
  }, [tasks, timeframe])

  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => t.status === 'done').length

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Chart 1: Task Status Comparison */}
      <Card className="flex flex-col justify-between">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ChartBar className="size-4" />
              </div>
              <CardTitle className="text-base font-semibold">Tasks by Status</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Comparison across To Do, In Progress, Review, and Done
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/30 px-2.5 py-1 text-xs font-mono text-muted-foreground">
            <span className="font-semibold text-foreground">{totalTasks}</span> total
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <ChartContainer config={statusChartConfig} className="h-[220px] w-full">
            <BarChart data={statusData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                dataKey="status"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs font-medium text-muted-foreground"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                className="text-xs text-muted-foreground"
              />
              <ChartTooltip
                cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>

          <div className="mt-4 grid grid-cols-2 sm:flex sm:flex-wrap items-center sm:justify-between gap-2 border-t pt-3 text-xs">
            {statusData.map((item) => (
              <div key={item.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs" style={{ backgroundColor: item.fill }} />
                <span className="text-muted-foreground">{item.status}:</span>
                <span className="font-mono font-medium text-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart 2: Task Completion Activity with Daily / Weekly filter */}
      <Card className="flex flex-col justify-between">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendUp className="size-4" />
              </div>
              <CardTitle className="text-base font-semibold">Completion Activity</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Daily and weekly velocity of shipped tasks
            </CardDescription>
          </div>

          {/* Daily / Weekly Toggle */}
          <div className="flex items-center rounded-lg border border-border/80 bg-secondary/30 p-0.5">
            <Button
              variant={timeframe === 'daily' ? 'default' : 'ghost'}
              size="xs"
              onClick={() => setTimeframe('daily')}
              className="h-6 rounded-md px-2 text-[11px] font-medium"
            >
              Daily
            </Button>
            <Button
              variant={timeframe === 'weekly' ? 'default' : 'ghost'}
              size="xs"
              onClick={() => setTimeframe('weekly')}
              className="h-6 rounded-md px-2 text-[11px] font-medium"
            >
              Weekly
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <ChartContainer config={timelineChartConfig} className="h-[220px] w-full">
            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs font-medium text-muted-foreground"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                className="text-xs text-muted-foreground"
              />
              <ChartTooltip
                cursor={{ stroke: 'rgba(0, 0, 0, 0.1)', strokeDasharray: '3 3' }}
                content={<ChartTooltipContent />}
              />
              <Area
                dataKey="completed"
                name="Completed"
                type="monotone"
                fill="url(#fillCompleted)"
                stroke="#16a34a"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>

          <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{doneTasks} completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              <span>Viewing {timeframe === 'daily' ? 'last 7 days' : 'last 4 weeks'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

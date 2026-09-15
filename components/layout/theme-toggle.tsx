'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Desktop, Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground opacity-60"
        aria-label="Toggle theme"
      >
        <Sun className="size-3.5" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Change theme"
            title={`Current theme: ${theme || 'system'}`}
          >
            {resolvedTheme === 'dark' ? (
              <Moon className="size-3.5 text-foreground transition-transform" />
            ) : (
              <Sun className="size-3.5 text-foreground transition-transform" />
            )}
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="flex items-center justify-between text-xs cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sun className="size-3.5" />
            <span>Light</span>
          </div>
          {theme === 'light' && <Check className="size-3 text-primary font-bold" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="flex items-center justify-between text-xs cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Moon className="size-3.5" />
            <span>Dark</span>
          </div>
          {theme === 'dark' && <Check className="size-3 text-primary font-bold" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="flex items-center justify-between text-xs cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Desktop className="size-3.5" />
            <span>System</span>
          </div>
          {theme === 'system' && <Check className="size-3 text-primary font-bold" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

export default function SidebarThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"
  const actionLabel = isDark ? "Switch to light mode" : "Switch to dark mode"

  return (
    <SidebarMenuItem className="w-full">
      <SidebarMenuButton
        type="button"
        tooltip={mounted ? actionLabel : "Toggle color theme"}
        aria-label="Toggle color theme"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        disabled={!mounted}
        className="w-full cursor-pointer"
      >
        {isDark ? <Sun /> : <Moon />}
        <span className="font-medium text-sm">
          {!mounted ? "Theme" : isDark ? "Light mode" : "Dark mode"}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

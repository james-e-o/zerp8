"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export default function ThemeMenuItem() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <DropdownMenuItem onSelect={() => setTheme(isDark ? "light" : "dark")}>
      {isDark ? <Sun /> : <Moon />}
      {isDark ? "Light mode" : "Dark mode"}
    </DropdownMenuItem>
  )
}

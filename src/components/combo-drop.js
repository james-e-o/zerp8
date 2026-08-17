'use client'
import { useEffect, useState,useContext } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,} from "@/components/ui/command"
import {Popover,PopoverContent,PopoverTrigger,} from "@/components/ui/popover"
import { X ,Check, ChevronsUpDown, GripIcon, GripHorizontalIcon, ArrowRight} from "lucide-react"

export default function ComboDropTemplate ({value,setValue,list,data,b_placeholder,s_placeholder,comboSearch,comboWidth,buttonWidth,buttonHeight}) {
    const [open, setOpen] = useState(false)
    return (
        <Popover className='' open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={` ${buttonWidth || comboWidth || 'w-[150px]'} ${buttonHeight|| 'h-8'} mt-2 justify-between`}
                >
                {value
                    ? data.find((item) => item === value)
                    // :defaultVal?defaultVal
                    : `${b_placeholder?b_placeholder:'Select...'}`}
                <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className={`${comboWidth?comboWidth:'w-[200px]'} p-0`}>
                <Command>
                {comboSearch&&<CommandInput placeholder={s_placeholder?s_placeholder:`Search...`} className="h-7" />}
                {list&&<CommandList>
                    <CommandEmpty>No item found.</CommandEmpty>
                    <CommandGroup>
                    {data.map((item) => (
                        <CommandItem
                        key={item}
                        value={item}
                        onSelect={(currentValue) => {
                            setValue(currentValue === value ? "" : currentValue)
                            setOpen(false)
                        }}
                        >
                        {item}
                        <Check
                            className={cn(
                            "ml-auto",
                            value === item? "opacity-100" : "opacity-0"
                            )}
                        />
                        </CommandItem>
                    ))}
                    </CommandGroup>
                </CommandList>}
                </Command>
            </PopoverContent>
        </Popover>
    )
}


'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Searchable customer chooser with a "New customer" shortcut, so a quotation or order
// never has to be abandoned to add someone. Only active customers of this branch appear.
export default function CustomerPicker({ branchId, value, onChange, placeholder = 'Select customer', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('id, customer_number, name, email, phone, status')
      .eq('branch', branchId)
      .eq('status', 'active')
      .order('name')
    if (error) {
      console.error('Failed to load customers:', error)
      toast.error(error.message || 'Could not load customers.')
    } else {
      setCustomers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (branchId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  const selected = customers.find((customer) => customer.id === value)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="mt-1 h-auto min-h-9 w-full justify-between px-3 py-2 text-left text-sm font-normal"
          >
            <span className={`truncate ${selected ? '' : 'text-muted-foreground'}`}>
              {selected ? `${selected.name} · ${selected.customer_number}` : loading ? 'Loading customers...' : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] p-0">
          <Command>
            <CommandInput placeholder="Search name, ID, phone or email..." className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty>No matching customer.</CommandEmpty>
              <CommandGroup>
                {value && (
                  <CommandItem value="__clear" onSelect={() => { onChange(''); setOpen(false) }} className="text-xs text-muted-foreground">
                    No customer
                  </CommandItem>
                )}
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={`${customer.name} ${customer.customer_number} ${customer.phone || ''} ${customer.email || ''}`}
                    onSelect={() => { onChange(customer.id); setOpen(false) }}
                    className="text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{customer.name}</p>
                      <p className="text-[10px] text-muted-foreground">{customer.customer_number}{customer.phone ? ` · ${customer.phone}` : ''}</p>
                    </div>
                    {customer.id === value && <Check className="size-3.5" />}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem value="__new" onSelect={() => { setOpen(false); setCreateOpen(true) }} className="text-xs font-medium text-core">
                  <Plus className="mr-1.5 size-3.5" /> New customer
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <QuickCustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={branchId}
        onCreated={async (customerId) => {
          await load()
          onChange(customerId)
        }}
      />
    </>
  )
}

function QuickCustomerDialog({ open, onOpenChange, branchId, onCreated }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setError('')
  }

  const save = async (event) => {
    event.preventDefault()
    setError('')
    if (!name.trim()) {
      setError("Enter the customer's name.")
      toast.error("Enter the customer's name.")
      return
    }
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc('save_customer', {
      p_branch: branchId,
      p_customer: null,
      p_values: { name, phone, email, address, customer_type: 'individual' },
    })
    setSaving(false)
    if (rpcError || !data?.success) {
      const message = rpcError?.message || data?.error || 'Could not save the customer.'
      console.error('save_customer failed:', rpcError || data)
      setError(message)
      toast.error(message)
      return
    }
    toast.success(`Customer ${data.customer_number} added.`)
    reset()
    onOpenChange(false)
    await onCreated(data.customer_id)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="max-w-md">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
            <DialogDescription>Quick add. You can complete the rest from Customers later.</DialogDescription>
          </DialogHeader>
          <label className="block text-xs font-medium text-gray-800">
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gray-800">
              Phone
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-gray-800">
              Email
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
            </label>
          </div>
          <label className="block text-xs font-medium text-gray-800">
            Address
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 min-h-16" />
          </label>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" className="bg-core text-white" disabled={saving}>{saving ? 'Saving...' : 'Add customer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

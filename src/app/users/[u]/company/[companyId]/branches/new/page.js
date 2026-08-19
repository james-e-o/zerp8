'use client'

import { useState, useContext } from 'react'
import supabase from '@/config/supabaseClient'
import { ArrowLeft, Check, X } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CompanyInfoContext } from '../../companyInfoProvider'

export default function NewBranchPage() {
  const router = useRouter()
  const params = useParams()
  const { info, currencies } = useContext(CompanyInfoContext)

  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    base_currency: currencies?.[0]?.code || 'USD',
    isheadoffice: false,
  })

  const requiredFields = ['name', 'base_currency']

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    setFormData({ ...formData, [name]: newValue })
  }

  const handleCurrencyChange = (value) => {
    setFormData({ ...formData, base_currency: value })
  }

  const isFormValid =
    requiredFields.every((field) => {
      if (field === 'base_currency') return formData.base_currency?.trim() !== ''
      return formData[field].trim() !== ''
    })

  const handleSubmit = async () => {
    if (!isFormValid) {
      toast.error('Please fill in all required fields with valid values.')
      return
    }

    setIsLoading(true)

    try {
      // Prepare currencies object with base currency
      const currenciesObj = {
        [formData.base_currency]: {
          base: true,
          rate: 1,
        },
      }

      // Create the branch
     const { data: newBranch, error: branchError } = await supabase.rpc('create_branch_with_info', {
        p_company: info?.id,
        p_name: formData.name,
        p_base_currency: formData.base_currency,
        p_currencies: currenciesObj,
        p_isheadoffice: formData.isheadoffice,
        p_address: formData.address || null,
        p_city: formData.city || null,
        p_country: formData.country || null,
        p_phone: formData.phone || null,
        p_email: formData.email || null,
      });

      if (branchError) {
        toast.error('Failed to create branch');
        console.error('Error creating branch:', branchError);
        setIsLoading(false);
        return;
      }

      toast.success('✨ Branch created successfully!');
      router.push(`/users/${params.u}/company/${params.companyId}/branches`);
    } catch (err) {
      toast.error('An error occurred while creating the branch')
      console.error('Error:', err)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex font-WixMade inset-0 bg-neutral-500 shadow-md shadow- absolute z-40">
      <div className="bg-armylight flex border-zinc-400 border absolute inset-2 shadow-0 justify-center p-12 overflow-auto rounded-lg">
        <div className="w-full max-w-2xl h-fit">
          <div className="p-8 rounded-2xl bg-white shadow-lg">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold text-core mb-2">Create a new branch</h1>
                <p className="text-sm text-slate-600">Set up your branch profile and initial settings</p>
              </div>
              <Link href={`/users/${params.u}/company/${params.companyId}/branches`}>
                <Button variant={'outline'} className="text-neutral-500 h-7 hover:text-black text-xs">
                  ✕
                </Button>
              </Link>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Name */}
              <Field>
                <FieldLabel>Branch Name *</FieldLabel>
                <Input
                  name="name"
                  placeholder="e.g., Downtown Branch"
                  value={formData.name}
                  onChange={handleChange}
                  className="text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">A unique name for your branch</p>
              </Field>

              {/* Base Currency */}
              <Field>
                <FieldLabel>Base Currency *</FieldLabel>
                <Select value={formData.base_currency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies?.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">Primary currency for this branch</p>
              </Field>

              {/* Address */}
              <Field>
                <FieldLabel>Address</FieldLabel>
                <Input
                  name="address"
                  placeholder="Street address"
                  value={formData.address}
                  onChange={handleChange}
                  className="text-sm"
                />
              </Field>

              {/* City */}
              <Field>
                <FieldLabel>City</FieldLabel>
                <Input
                  name="city"
                  placeholder="City"
                  value={formData.city}
                  onChange={handleChange}
                  className="text-sm"
                />
              </Field>

              {/* Country */}
              <Field>
                <FieldLabel>Country</FieldLabel>
                <Input
                  name="country"
                  placeholder="Country"
                  value={formData.country}
                  onChange={handleChange}
                  className="text-sm"
                />
              </Field>

              {/* Email */}
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  name="email"
                  type="email"
                  placeholder="branch@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="text-sm"
                />
              </Field>

              {/* Phone */}
              <Field>
                <FieldLabel>Phone</FieldLabel>
                <Input
                  name="phone"
                  placeholder="(555) 000-0000"
                  value={formData.phone}
                  onChange={handleChange}
                  className="text-sm"
                />
              </Field>

            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-8">
              <Link href={`/users/${params.u}/company/${params.companyId}/branches`}>
                <Button variant="outline" className="text-sm">
                  Cancel
                </Button>
              </Link>
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid || isLoading}
                className="bg-army hover:bg-army/85 text-white text-sm"
              >
                {isLoading ? 'Creating...' : 'Create Branch'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useContext } from 'react'
import supabase from '@/config/supabaseClient'
import { Spinner } from '@/components/ui/spinner'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import Link from 'next/link'
import { DataContext } from '@/app/users/[u]/pageLayoutProvider'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import ComboDropTemplate from '@/components/combo-drop'
import { cn } from '@/lib/utils'
import { Tabs, TabsTrigger, TabsList, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function NewCompanyPage() {

        const router = useRouter()
        const params = useParams()
        const {data,setData} = useContext(DataContext)
        const [step, setStep] = useState(1)
        const [isLoading,setIsLoading] = useState(false);
        const [checkingName, setCheckingName] = useState(false);
        const [nameExists, setNameExists] = useState(null);
        const [currencies, setCurrencies] = useState([]);
        const [formData, setFormData] = useState({
            name: "",
            type: "",
            email: "",
            phone: "",
            country: "",
            industry: "",
            currencies: ["USD"],
            taxId: "",
            branchAddress: "",
            branchCity: "",
        });
        const requiredFields = ["name", "email", "currencies","phone"];

        const handleChange = (e) => {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        };

        const nextStep = () => setStep((prev) => Math.min(prev + 1, 3));
        const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));
        const goToStep = (num) => setStep(num);

        const isFormValid = requiredFields.every((field) => {
            if (field === "currencies") return formData.currencies.length > 0;
            return formData[field].trim() !== "";
        }) && !nameExists // ✅ also require unique name

            const handleSubmit = async () => {
            if (!isFormValid) {
                toast.error("Please fill in all required fields before submitting.");
                return;
            }

            setIsLoading(true);

            // 1️⃣ Create the company
           const { data: newCompany, error: companyError } = await supabase.rpc('create_company_with_info', {
                p_name: formData.name,
                p_type: formData.type,
                p_email: formData.email,
                p_phone: formData.phone,
                p_country: formData.country,
                p_industry: formData.industry,
                p_currencies: formData.currencies,
                p_tax_id: formData.taxId || null,
                p_head_office_address: formData.branchAddress || null,
                p_head_office_city: formData.branchCity || null,
                });

                if (companyError) {
                toast.error("Failed to create company");
                console.log("Error creating company:", companyError);
                setIsLoading(false);
                return;
                }

                toast.success("✨ Company created successfully!");

                // 2️⃣ Refresh owned companies and re-attach badges,
                //    preserving any staff-badged companies already in context
                const { data: owned, error: reloadError } = await supabase
                .from("companies")
                .select("id, name, slug")
                .eq("owner", data.profile.id);

                if (reloadError) {
                toast.error("Unable to refresh data");
                } else {
                const ownedWithBadge = (owned || []).map(c => ({ ...c, badge: 'owner' }))
                const existingStaffCompanies = (data.companies || []).filter(c => c.badge === 'staff')
                setData((prev) => ({ ...prev, companies: [...ownedWithBadge, ...existingStaffCompanies] }));
                }

                router.push(`/users/${params.u}`);
            };

            useEffect(() => {
                if (!formData.name.trim()) {
                    setNameExists(null)
                    return
                }

                const timer = setTimeout(async () => {
                    setCheckingName(true)
                    const { data: existingCompany, error } = await supabase
                        .from("companies")
                        .select("id")
                        .ilike("name", formData.name.trim()) // case-insensitive match
                        .maybeSingle()

                    if (error) {
                        console.error("Error checking company name:", error)
                        setNameExists(null)
                    } else {
                        setNameExists(!!existingCompany)
                    }
                    setCheckingName(false)
                }, 800)

                return () => clearTimeout(timer)
            }, [formData.name])

            useEffect(() => {
                const fetchCompanies = async () => {
                    const { data: owned, error } = await supabase
                        .from("companies")
                        .select("id, name, slug")
                        .eq("owner", data.profile.id);

                    if (error) {
                        console.error("Error fetching companies:", error);
                        setData(prev => ({ ...prev, companies: [] }));
                    } else {
                        const ownedWithBadge = (owned || []).map(c => ({ ...c, badge: 'owner' }))
                        setData(prev => {
                            const existingStaffCompanies = (prev.companies || []).filter(c => c.badge === 'staff')
                            return { ...prev, companies: [...ownedWithBadge, ...existingStaffCompanies] }
                        });
                    }
                };

                if (data.profile) {
                    fetchCompanies();
                }
            }, [data.profile, setData]);

            // Fetch available currencies from database
            useEffect(() => {
                const fetchCurrencies = async () => {
                    const { data: currenciesData, error } = await supabase
                        .from("currencies")
                        .select("code, name, flag")
                        .order("code");

                    if (error) {
                        console.error("Error fetching currencies:", error);
                        setCurrencies([]);
                    } else {
                        setCurrencies(currenciesData || []);
                    }
                };

                fetchCurrencies();
            }, []);




  return (
    <div className="flex font-WixMade inset-0 bg-neutral-500 shadow-md shadow- absolute z-40">
      <div className="bg-armylight flex border-zinc-400 border absolute inset-2 shadow-0 justify-center p-12 overflow-auto rounded-lg">
        <div className="w-full max-w-2xl h-fit">
          <div className="p-8 rounded-2xl bg-white shadow-lg">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Create a new company</h1>
                <p className="text-sm text-slate-600">Set up your company profile and initial settings</p>
              </div>
              <Link href={`/users/${params.u}`}>
                <Button variant={'outline'} className="text-neutral-500 relative -top-10 h-7 hover:text-black text-xs">
                  ✕
                </Button>
              </Link>
            </div>

                            {/* Step indicators */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between">
                                    {["Basics", "Details", "Review"].map((label, index) => (
                                    <div key={index} className="flex flex-col items-center flex-1">
                                        <button
                                            onClick={() => goToStep(index + 1)}
                                            className={`flex items-center justify-center w-10 h-10 rounded-full font-medium text-sm transition-all mb-2
                                            ${
                                                step === index + 1
                                                ? "bg-core text-white shadow-md"
                                                : step > index + 1
                                                ? "bg-army text-white shadow-sm"
                                                : "bg-slate-200 text-slate-600"
                                            }`}
                                        >
                                            {step > index + 1 ? <Check className="w-5 h-5" /> : index + 1}
                                        </button>
                                        <p className={`text-xs font-medium ${step === index + 1 ? 'text-core' : step > index + 1 ? 'text-green-600' : 'text-slate-500'}`}>{label}</p>
                                    </div>
                                    ))}
                                </div>
                                <div className="flex mt-6 gap-1">
                                    {[1, 2, 3].map((i) => (
                                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-core' : 'bg-slate-200'}`} />
                                    ))}
                                </div>
                            </div>

                            {/* Step 1: Basics */}
                            {step === 1 && (
                                <div className="space-y-6">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>

                                <Field>
                                    <FieldLabel className="text-sm font-semibold text-slate-900 mb-2" htmlFor="name">
                                    Company Name{requiredFields.includes("name") ? (
                                            <span className="text-red-500 ml-1">*</span>
                                        ) : null}
                                        {checkingName && (
                                            <div className="ml-2 inline-flex items-center">
                                                <Spinner className="mr-1 size-3" /> 
                                                <span className="text-xs text-slate-500">Checking name...</span>
                                            </div>
                                        )}
                                        {nameExists === true && (
                                            <p className="text-xs text-red-600 mt-1 font-normal">Name already in use</p>
                                        )}
                                        {nameExists === false && (
                                            <p className="text-xs text-green-600 mt-1 font-normal">Name is available</p>
                                        )}
                                    </FieldLabel>
                                    <Input type="text" name="name" placeholder="e.g., Acme Corp" value={formData.name} onChange={handleChange} className={cn(
                                        "w-full text-sm border-2 p-3 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                                        nameExists === true
                                            ? "border-red-300 focus-visible:ring-red-500 focus-visible:ring-offset-red-50 bg-red-50"
                                            : nameExists === false
                                            ? "border-green-300 focus-visible:ring-green-500 focus-visible:ring-offset-green-50 bg-green-50"
                                            : "border-slate-300 focus-visible:ring-blue-500 bg-white hover:border-slate-400"
                                    )} />
                                </Field>

                                <Field>
                                    <FieldLabel className="text-sm font-semibold text-slate-900 mb-2" htmlFor="type">
                                    Company Type{requiredFields.includes("type") ? (
                                            <span className="text-red-500 ml-1">*</span>
                                        ) : null}
                                    </FieldLabel>
                                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                                      <SelectTrigger className="w-full text-sm border-2 border-slate-300 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all hover:border-slate-400 bg-white">
                                        <SelectValue placeholder="Select Company Type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="product">Product-based</SelectItem>
                                        <SelectItem value="service">Service-based</SelectItem>
                                        <SelectItem value="project">Project-based</SelectItem>
                                      </SelectContent>
                                    </Select>
                                </Field>

                                <Field>
                                    <FieldLabel className="text-sm font-semibold text-slate-900 mb-2" htmlFor="email">
                                    Company Email{requiredFields.includes("email") ? (
                                            <span className="text-red-500 ml-1">*</span>
                                        ) : null}
                                    </FieldLabel>
                                    <Input type="email" name="email" placeholder="hello@example.com" value={formData.email} onChange={handleChange} className="w-full text-sm border-2 border-slate-300 p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all hover:border-slate-400 bg-white" />
                                </Field>

                                <Field>
                                    <FieldLabel className="text-sm font-semibold text-slate-900 mb-2" htmlFor="phone">
                                    Phone Number{requiredFields.includes("phone") ? (
                                            <span className="text-red-500 ml-1">*</span>
                                        ) : null}
                                    </FieldLabel>
                                    <Input type="text" name="phone" placeholder="+1 (555) 000-0000" value={formData.phone} onChange={handleChange} className="w-full text-sm border-2 border-slate-300 p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all hover:border-slate-400 bg-white" />
                                </Field>

                                <Field>
                                    <FieldLabel className="text-sm font-semibold text-slate-900 mb-2" htmlFor="country">
                                    Country / Location{requiredFields.includes("country") ? (
                                            <span className="text-red-500 ml-1">*</span>
                                        ) : null}
                                    </FieldLabel>
                                    <Input type="text" name="country" placeholder="e.g., United States" value={formData.country} onChange={handleChange} className="w-full text-sm border-2 border-slate-300 p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all hover:border-slate-400 bg-white" />
                                </Field>
                                </div>
                            )}

                            {/* Step 2: Details */}
                            {step === 2 && (
                                <div className="space-y-6">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Company Details</h2>

                                <Field>
                                    <FieldLabel className="text-sm font-semibold text-slate-900 mb-2" htmlFor="industry">
                                    Industry{requiredFields.includes("industry") ? (
                                        <span className="text-red-500 ml-1">*</span>
                                    ) : null}
                                    </FieldLabel>
                                    <Input type="text" name="industry" placeholder="e.g., Retail, IT, Construction" value={formData.industry} onChange={handleChange} className="w-full border-2 border-slate-300 text-sm p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all hover:border-slate-400 bg-white" />
                                </Field>

                                <Field>
                                    <FieldLabel className="text-sm font-semibold text-slate-900 mb-2" htmlFor="branchAddress">
                                    Head Office Address
                                    </FieldLabel>
                                    <Input type="text" name="branchAddress" placeholder="Street address" value={formData.branchAddress} onChange={handleChange} className="w-full border-2 border-slate-300 text-sm p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all hover:border-slate-400 bg-white" />
                                    <p className="text-xs text-slate-500 mt-1">This will be stored on the branch record</p>
                                </Field>

                                <Field>
                                    <FieldLabel className="text-sm font-semibold text-slate-900 mb-2" htmlFor="branchCity">
                                    Head Office City
                                    </FieldLabel>
                                    <Input type="text" name="branchCity" placeholder="City" value={formData.branchCity} onChange={handleChange} className="w-full border-2 border-slate-300 text-sm p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all hover:border-slate-400 bg-white" />
                                </Field>

                                <Field>
                                    <FieldLabel className="text-sm font-semibold text-slate-900 mb-3" htmlFor="currencies">
                                    Supported Currencies{requiredFields.includes("currencies") ? (
                                        <span className="text-red-500 ml-1">*</span>
                                    ) : null}
                                    </FieldLabel>
                                    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-lg border-2 border-slate-200 max-h-64 overflow-y-auto">
                                        {currencies && currencies.length > 0 ? (
                                            currencies.map((curr) => (
                                                <div key={curr.code} className="flex items-center space-x-3 p-2 hover:bg-white rounded-md transition-colors cursor-pointer">
                                                    <Checkbox
                                                        id={curr.code}
                                                        checked={formData.currencies.includes(curr.code)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setFormData({ ...formData, currencies: [...formData.currencies, curr.code] });
                                                            } else {
                                                                setFormData({ ...formData, currencies: formData.currencies.filter(c => c !== curr.code) });
                                                            }
                                                        }}
                                                        className="w-4 h-4"
                                                    />
                                                    <label htmlFor={curr.code} className="text-sm cursor-pointer flex items-center space-x-2 flex-1">
                                                        <img src={curr.flag} alt={curr.code} className="w-5 h-4 rounded-sm" />
                                                        <span className="font-medium text-slate-700">{curr.code}</span>
                                                        <span className="text-slate-500 text-xs">{curr.name}</span>
                                                    </label>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-2 text-sm text-slate-500 p-4 text-center">
                                                Loading currencies...
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">{formData.currencies.length} currency/currencies selected</p>
                                </Field>

                                <Field>
                                    <FieldLabel className="text-sm font-semibold text-slate-900 mb-2" htmlFor="taxId">
                                    Tax ID / Registration Number
                                    </FieldLabel>
                                    <Input type="text" name="taxId" placeholder="e.g., 12-3456789" value={formData.taxId} onChange={handleChange} className="w-full text-sm border-2 border-slate-300 p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all hover:border-slate-400 bg-white" />
                                    <p className="text-xs text-slate-500 mt-1">Optional for now</p>
                                </Field>
                                </div>
                            )}

                            {/* Step 3: Review */}
                            {step === 3 && (
                                <div>
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Review Company Information</h2>
                                <div className="space-y-3 bg-slate-50 p-6 rounded-lg border-2 border-slate-200">
                                    {Object.entries(formData).map(([key, value]) => {
                                    const label = key
                                        .replace(/([A-Z])/g, " $1")
                                        .replace(/^./, (str) => str.toUpperCase());
                                    const isRequired = requiredFields.includes(key);
                                    return (
                                        <div key={key} className="flex justify-between items-start py-2 border-b border-slate-300 last:border-0">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900 capitalize">
                                                    {label}
                                                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-slate-700 font-medium">
                                                {Array.isArray(value) ? (value.length > 0 ? value.join(", ") : <span className="text-slate-400 italic">None selected</span>) : (value || <span className="text-slate-400 italic">Not provided</span>)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                    })}
                                </div>
                                <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                                    <p className="text-sm text-core">✓ All required fields are complete. Ready to create your company!</p>
                                </div>
                                </div>
                            )}

                            {/* Navigation Buttons */}
                            <div className="flex justify-between gap-4 mt-8 pt-8 border-t-2 border-slate-200">
                                <Button
                                variant="outline"
                                onClick={prevStep}
                                disabled={step === 1}
                                className={`px-6 py-2 rounded-lg border-2 font-medium transition-all flex items-center gap-2 ${
                                    step === 1 
                                    ? "opacity-50 cursor-not-allowed border-slate-300 text-slate-400" 
                                    : "border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400"
                                }`}
                                >
                                <ArrowLeft className="w-4 h-4" /> Back
                                </Button>

                                {step < 3 ? (
                                <Button
                                    onClick={nextStep}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                                >
                                    Next <ArrowRight className="w-4 h-4" />
                                </Button>
                                ) : (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isLoading || !isFormValid}
                                    className={`px-8 py-2 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-md ${
                                    isFormValid && !isLoading
                                        ? "bg-green-600 hover:bg-green-700 hover:shadow-lg cursor-pointer"
                                        : "bg-slate-400 cursor-not-allowed"
                                    }`}
                                >
                                    {isLoading && <Spinner className="mr-1" spinning={isLoading} />}
                                    <Check className="w-4 h-4" /> Create Company
                                </Button>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
  )
}
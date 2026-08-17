"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Check, X, Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuCheckboxItem,DropdownMenuTrigger,DropdownMenuLabel,DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

export default function FiscalTaxSettings() {
  // State for edit modes
  const [editField, setEditField] = useState(null);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [acceptedCurrencies, setAcceptedCurrencies] = useState(["USD", "EUR"]);
  const [newCurrency, setNewCurrency] = useState("");
  const [taxId, setTaxId] = useState("123-45-6789");
  const [taxRate, setTaxRate] = useState(7.5);
  const [isTaxInclusive, setIsTaxInclusive] = useState(false);
  const [filingFrequency, setFilingFrequency] = useState("Quarterly");
  const [fiscalYear, setFiscalYear] = useState({ start: "2025-01-01", end: "2025-12-31" });
  const [accountingMethod, setAccountingMethod] = useState("Accrual");
  const [reportCurrency, setReportCurrency] = useState("USD");


  
  // Add a new acceptable currency
  const addCurrency = () => {
    if (newCurrency && !acceptedCurrencies.includes(newCurrency)) {
      setAcceptedCurrencies([...acceptedCurrencies, newCurrency]);
      setNewCurrency("");
    }
  };

  return (
    <div className="p-6 font-WixMade bg-white rounded-sm shadow-xs">
      <h1 className="text-base font-semibold mb-6">Fiscal & Tax Settings</h1>

      <Tabs defaultValue="currency">

        {/* <TabsList className="flex border-b mb-6">
          <TabsTrigger value="currency" className="px-4 py-2 text-xs cursor-pointer">Currency Settings</TabsTrigger>
          <TabsTrigger value="tax" className="px-4 py-2 text-xs cursor-pointer">Tax Settings</TabsTrigger>
          <TabsTrigger value="fiscal" className="px-4 py-2 text-xs cursor-pointer">Fiscal Year</TabsTrigger>
          <TabsTrigger value="financial" className="px-4 py-2 text-xs cursor-pointer">Financial Settings</TabsTrigger>
          </TabsList> */}
           <>
      {/* Mobile version — dropdown style */}
        <div className="block md:hidden mb-4">
      <DropdownMenu className=''>
            <DropdownMenuTrigger><Button variant={'outline'} className={`h-7 text-xs`} >Select Fiscal settings</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
                <TabsList className="flex flex-col border h-fit rounded-md overflow-hidden w-fit">
                    <DropdownMenuItem>
                        <TabsTrigger value="currency" className="w-full text-left text-xs px-3 py-1.5">Currency Settings</TabsTrigger>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <TabsTrigger value="tax" className="w-full text-left text-xs px-3 py-1.5">Tax Settings</TabsTrigger>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <TabsTrigger value="fiscal" className="w-full text-left text-xs px-3 py-1.5">Fiscal Year</TabsTrigger>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <TabsTrigger value="financial" className="w-full text-left text-xs px-3 py-1.5">Financial Settings</TabsTrigger>
                    </DropdownMenuItem>
                </TabsList>
                
                <DropdownMenuSeparator />
            </DropdownMenuContent>
        </DropdownMenu>
        
      </div>

      {/* Desktop version — horizontal tab bar */}
      <div className="hidden md:flex border-b mb-6">
        <TabsList className="flex gap-1">
          <TabsTrigger
            value="currency"
            className="px-4 py-2 text-xs cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-core"
          >
            Currency Settings
          </TabsTrigger>
          <TabsTrigger
            value="tax"
            className="px-4 py-2 text-xs cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-core"
          >
            Tax Settings
          </TabsTrigger>
          <TabsTrigger
            value="fiscal"
            className="px-4 py-2 text-xs cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-core"
          >
            Fiscal Year
          </TabsTrigger>
          <TabsTrigger
            value="financial"
            className="px-4 py-2 text-xs cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-core"
          >
            Financial Settings
          </TabsTrigger>
        </TabsList>
      </div>
    </>

        {/* ------------------ CURRENCY SETTINGS ------------------ */}
        <TabsContent value="currency">
          <motion.div layout className="space-y-6">
            {/* Base Currency */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Base Currency</h3>
                {editField === "baseCurrency" ? (
                  <div className="flex items-center gap-2">
                    <Select onValueChange={setBaseCurrency} value={baseCurrency}>
                      <SelectTrigger className="w-28 text-xs">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="NGN">NGN</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => setEditField(null)}><Check size={14}/></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditField(null)}><X size={14}/></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{baseCurrency}</span>
                    <Button size="icon" variant="ghost" onClick={() => setEditField("baseCurrency")}><Pencil size={14}/></Button>
                  </div>
                )}
              </div>
            </div>

            {/* Acceptable Currencies */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Accepted Currencies</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {acceptedCurrencies.map((c, i) => (
                  <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">{c}</span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add new currency (e.g. GBP)"
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                  className="w-40 text-xs"
                />
                <Button onClick={addCurrency} size="sm"><Plus size={12} className="mr-1" /> Add</Button>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ------------------ TAX SETTINGS ------------------ */}
        <TabsContent value="tax">
          <motion.div layout className="space-y-6">
            {/* Tax ID */}
            <div className="border rounded-lg p-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium">Tax ID</h3>
                <p className="text-xs text-gray-600">{taxId}</p>
              </div>
              {editField === "taxId" ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="w-32 text-xs"
                  />
                  <Button size="icon" variant="ghost" onClick={() => setEditField(null)}><Check size={14}/></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditField(null)}><X size={14}/></Button>
                </div>
              ) : (
                <Button size="icon" variant="ghost" onClick={() => setEditField("taxId")}><Pencil size={14}/></Button>
              )}
            </div>

            {/* Default Tax Rate */}
            <div className="border rounded-lg p-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium">Default Tax Rate (%)</h3>
                <p className="text-xs text-gray-600">{taxRate}%</p>
              </div>
              {editField === "taxRate" ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-20 text-xs"
                  />
                  <Button size="icon" variant="ghost" onClick={() => setEditField(null)}><Check size={14}/></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditField(null)}><X size={14}/></Button>
                </div>
              ) : (
                <Button size="icon" variant="ghost" onClick={() => setEditField("taxRate")}><Pencil size={14}/></Button>
              )}
            </div>

            {/* Inclusive or Exclusive */}
            <div className="border rounded-lg p-4 flex justify-between items-center">
              <h3 className="text-sm font-medium">Tax Inclusive</h3>
              <Switch checked={isTaxInclusive} onCheckedChange={setIsTaxInclusive} />
            </div>

            {/* Filing Frequency */}
            <div className="border rounded-lg p-4 flex justify-between items-center">
              <h3 className="text-sm font-medium">Filing Frequency</h3>
              <Select value={filingFrequency} onValueChange={setFilingFrequency}>
                <SelectTrigger className="w-28 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="Yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        </TabsContent>

        {/* ------------------ FISCAL YEAR ------------------ */}
        <TabsContent value="fiscal">
          <motion.div layout className="space-y-6">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium">Fiscal Year Period</h3>
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={fiscalYear.start}
                    onChange={(e) => setFiscalYear({ ...fiscalYear, start: e.target.value })}
                    className="w-40 text-xs"
                  />
                </div>
                <div className="flex flex-col">
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={fiscalYear.end}
                    onChange={(e) => setFiscalYear({ ...fiscalYear, end: e.target.value })}
                    className="w-40 text-xs"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ------------------ FINANCIAL SETTINGS ------------------ */}
        <TabsContent value="financial">
          <motion.div layout className="space-y-6">
            <div className="border rounded-lg p-4 flex justify-between items-center">
              <h3 className="text-sm font-medium">Accounting Method</h3>
              <Select value={accountingMethod} onValueChange={setAccountingMethod}>
                <SelectTrigger className="w-28 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Accrual">Accrual</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg p-4 flex justify-between items-center">
              <h3 className="text-sm font-medium">Default Reporting Currency</h3>
              <Select value={reportCurrency} onValueChange={setReportCurrency}>
                <SelectTrigger className="w-28 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {acceptedCurrencies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

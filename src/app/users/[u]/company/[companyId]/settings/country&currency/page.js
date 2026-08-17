"use client";

import { useContext,useState,useEffect } from "react";
import { Pencil, Save, X } from "lucide-react";
import { CompanyInfoContext } from "../../companyInfoProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import supabase from "@/config/supabaseClient";
import { toast } from "sonner";




export default function CurrencyManagement() {
        const [editMode, setEditMode] = useState(false);
        const {info, currencies} = useContext(CompanyInfoContext);

        const [companyCurrencies, setCompanyCurrencies] = useState([]);
        const [selectedCurrencies, setSelectedCurrencies] = useState([]);
        const [isSaving, setIsSaving] = useState(false);

        const toggleCurrency = (currency) => {
          setSelectedCurrencies((prev) =>
            prev.includes(currency)
              ? prev.filter((c) => c !== currency)
              : [...prev, currency]
          );
        };

        const handleSave = async () => {
          console.log("Saving currencies:", selectedCurrencies, info.id);
          setIsSaving(true);
          try {
            const { error } = await supabase
              .from("companies")
              .update({ currencies: selectedCurrencies })
              .eq("id", info.id);

            if (error) {
              console.error("Failed to update currencies:", error);
              toast.error("Failed to save currencies");
              return;
            }

            toast.success("Currencies updated successfully");
            setCompanyCurrencies(selectedCurrencies);
            setEditMode(false);
          } catch (err) {
            console.error("Unexpected error:", err);
            toast.error("Unexpected error occurred");
          } finally {
            setIsSaving(false);
          }
        };

        const handleCancel = () => {
          setSelectedCurrencies(companyCurrencies);
          setEditMode(false);
        };

        useEffect(() => {
              if (!info?.id) return;

              const fetchCompanyCurrencies = async () => {
                const { data, error } = await supabase
                  .from("companies")
                  .select("currencies")
                  .eq("id", info.id)
                  .single();

                if (error) {
                  console.error("Failed to fetch company currencies:", error);
                  return;
                }

               if (data?.currencies?.length) {
                  setCompanyCurrencies(data.currencies);
                  setSelectedCurrencies(data.currencies);
                } else {
                  setCompanyCurrencies([]);
                  setSelectedCurrencies([]);
                }

              };

              fetchCompanyCurrencies();
      }, [info?.id]);

  return (
    <div className="pt-2 font-WixMade text-xs w-full">
   
      {/* HEADER */}
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-sm ml-1 font-medium">Currency Management</h1>

        {!editMode ? (
          <button
            onClick={() => {
              setSelectedCurrencies(companyCurrencies);
              setEditMode(true);
            }}
            className="h-7 px-3 bg-core hover:bg-core/90 text-white rounded-sm flex items-center gap-1"
          >
            <Pencil size={14} /> Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="h-7 px-3 bg-core hover:bg-core/90 text-white rounded-sm flex items-center gap-1"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>

            <button
              onClick={handleCancel}
              className="h-7 px-3 bg-gray-200 hover:bg-gray-300 rounded-sm flex items-center gap-1"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* COMPANY CURRENCIES */}
      <div className="bg-white border rounded-sm p-4 space-y-4 mb-5">
        <h2 className="text-xs font-medium">Company Currencies</h2>
        <div className="flex flex-wrap gap-3">
          {currencies&&currencies.map((currency) => (
            <Tooltip key={currency.code}>
              <TooltipTrigger asChild>
                <label
                  className={`flex items-center gap-2 p-1 rounded cursor-pointer ${selectedCurrencies.includes(currency.code) ? 'bg-blue-100 border-2 border-blue-500' : 'border border-transparent'}`}
                >
                  <input
                    type="checkbox"
                    disabled={!editMode}
                    checked={selectedCurrencies.includes(currency.code)}
                    onChange={() => editMode && toggleCurrency(currency.code)}
                    className="w-4 h-4"
                  />
                  {/* <span className="text-sm">{currency.flag}</span> */}
                   <img
      src={currency.flag}
      alt={currency.code}
      className="w-4 h-4 rounded-sm"
    />
                  <span>{currency.code}</span>
                </label>
              </TooltipTrigger>
              <TooltipContent >
                <p>{currency.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          </div>
    

      </div>
    </div>
  );
}

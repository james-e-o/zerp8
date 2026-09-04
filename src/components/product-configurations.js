'use client'

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from 'lucide-react'
import supabase from '../config/supabaseClient';

/**
 * ProductConfigurations
 * ----------------------------------------------------------------------
 * Second tab of the product creation flow (rendered by CreateProductPage).
 *
 * Relationship to the parent (CreateProductPage):
 * - The parent owns all form state (it's the thing that gets submitted).
 * - This component is a "dumb" renderer over that state. To keep the
 *   handoff between the two files sane, related fields are grouped into
 *   a small number of objects instead of being passed as 20+ individual
 *   useState/setState pairs:
 *     - categorization   { category, tags }  (+ open/close + sheets)
 *     - costPrice / setCostPrice        -> base cost, still product-level
 *     - standardPricing / setStandardPricing
 *          { marginPercentage, marginValue, sellingPrice }
 *          This is the ONLY pricing context handled at product-creation
 *          time. Wholesale / custom pricing contexts are configured in
 *          their own Pricing module (pricing_contexts + pricing_rules)
 *          and are resolved per invoice line at sale time - a product
 *          only ever needs a Standard price to be saveable.
 *     - quantities / setQuantities
 *          { totalProductUnits, totalProductUnitsType, minSaleQuantity,
 *            quantityIncrement, bulkThreshold, reorderLevel }
 *          Mirrors the new columns on product_variants.
 *
 * Removed entirely (per Sept 2026 schema discussion):
 *   - Shipping Profile picker/CRUD -> lives in the Shipping module now;
 *     Products only supplies weight/dimensions as raw facts.
 *   - Return Policy picker/CRUD -> lives in Settings; not a product-owned
 *     relationship.
 *   - "Minimum Margin Rules" sheet -> was unused dead code (nothing in
 *     handleSubmit ever read selectedMarginRule), and margin floors are a
 *     pricing_rules concern now anyway.
 *   - Per-context Bulk Pricing Reduction fields -> bulk pricing is a
 *     Wholesale/custom pricing_rules concern (condition_type =
 *     'bulk_threshold'), not something Standard needs. The *quantity*
 *     that triggers it (bulk_threshold) still lives on the variant, so
 *     it moved to the Quantities section in the parent.
 */
export const ProductConfigurations = forwardRef(({
  // Categorization
  selectedCategoryId,
  selectedCategoryName,
  setSelectedCategoryId,
  setSelectedCategoryName,
  categorySheetOpen,
  setCategorySheetOpen,
  CategorySheet,
  selectedTags,
  selectedTagNames,
  setSelectedTags,
  setSelectedTagNames,
  tagSheetOpen,
  setTagSheetOpen,
  TagSheet,

  // Pricing (Standard only - see note above)
  costPrice,
  setCostPrice,
  standardPricing,
  setStandardPricing,

  // Quantities (maps to product_variants: min_sale_quantity, quantity_increment, bulk_threshold, reorder_level)
  quantities,
  setQuantities,

  errors = {},
  variants = [],
  branch,
  productType = 'physical',
}, ref) => {
  const [measurementTypes, setMeasurementTypes] = useState([]);
  const [measurementUnits, setMeasurementUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  // Editing buffer for the Standard pricing block - lets margin %/value/selling
  // price be edited without committing to parent state on every keystroke.
  const [isEditingStandard, setIsEditingStandard] = useState(false);
  const [standardDraft, setStandardDraft] = useState({});

  // Fetch measurement types and units
  useEffect(() => {
    const fetchMeasurementData = async () => {
      try {
        setLoading(true);
        const { data: typesData, error: typesError } = await supabase.from('measurement_types').select('*');
        if (typesError) console.error('Error fetching measurement types:', typesError);
        else setMeasurementTypes(typesData || []);

        const { data: unitsData, error: unitsError } = await supabase.from('measurement_units').select('*');
        if (unitsError) console.error('Error fetching measurement units:', unitsError);
        else setMeasurementUnits(unitsData || []);
      } catch (error) {
        console.error('Error fetching measurement data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMeasurementData();
  }, []);

  const calculateValueFromPercentage = (percentage, basePrice) => {
    if (!basePrice || !percentage) return '';
    return (parseFloat(basePrice) * parseFloat(percentage) / 100).toFixed(2);
  };

  const calculatePercentageFromValue = (value, basePrice) => {
    if (!basePrice || !value) return '';
    return (parseFloat(value) / parseFloat(basePrice) * 100).toFixed(2);
  };

  const calculateSellingPrice = (marginValue) => {
    if (!costPrice || !marginValue) return '';
    return (parseFloat(costPrice) + parseFloat(marginValue)).toFixed(2);
  };

  const getUnitsForType = (typeCode) => {
    if (!typeCode) return [];
    return measurementUnits.filter(unit => unit.type === typeCode);
  };
  const availableUnits = getUnitsForType(quantities.measurementType);

  const handleMeasurementTypeChange = (newType) => {
    const baseUnit = measurementUnits.find(unit => unit.type === newType && unit.is_base);
    setQuantities(prev => ({
      ...prev,
      measurementType: newType,
      totalProductUnitsType: baseUnit?.symbol || '',
      totalProductUnits: '',
    }));
  };

  const updateQuantity = (key, value) => setQuantities(prev => ({ ...prev, [key]: value }));

  const getStandardField = (key) => (isEditingStandard ? standardDraft[key] : standardPricing[key]) || '';

  const beginEditIfNeeded = () => {
    if (!isEditingStandard) {
      setIsEditingStandard(true);
      setStandardDraft({ ...standardPricing });
    }
  };

  // Commit the standard pricing draft (and quantities are already committed live)
  useImperativeHandle(ref, () => ({
    commitEditingState: () => {
      if (isEditingStandard) {
        const updated = { ...standardPricing, ...standardDraft };
        setStandardPricing(updated);
        setIsEditingStandard(false);
        setStandardDraft({});
        return updated;
      }
      return standardPricing;
    }
  }));

  return (
    <div className="text-neutral-700 font-WixMade tracking-tight max-w-5xl mx-auto text-xs">
      <h2 className="font-semibold mb-4">Configurations</h2>

      <div className="space-y-4 text-xs text-gray-700">

        {/* Categories + Tags */}
        <div className="rounded-sm bg-white p-4 space-y-4" data-field="category">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-gray-600 text-xs">Categories </label>
              <div className="flex gap-2 mt-1 items-center">
                <input className={`flex-1 border border-neutral-500 rounded-sm p-2 text-xs ${errors.category ? 'border-red-500 border-2 bg-red-50' : ''}`} value={selectedCategoryName || ''} readOnly placeholder="Select category" />
                <Button variant="outline" className="h-8 px-2 text-xs" onClick={() => setCategorySheetOpen(true)}>Select</Button>
                <CategorySheet branch={branch} open={categorySheetOpen} onOpenChange={setCategorySheetOpen} onConfirm={(id, name) => { setSelectedCategoryId(id); setSelectedCategoryName(name || ''); setCategorySheetOpen(false) }} initialSelected={selectedCategoryId} />
              </div>
            </div>

            <div className="flex-1">
              <label className="text-gray-600 text-xs">Tags (Optional)</label>
              <div className="flex gap-2 mt-1 items-center">
                <input className="flex-1 border border-neutral-500 rounded-sm p-2 text-xs" value={(selectedTagNames && selectedTagNames.length) ? selectedTagNames.join(', ') : ''} readOnly placeholder="Select tags" />
                <Button variant="outline" className="h-8 px-2 text-xs" onClick={() => setTagSheetOpen(true)}>Choose</Button>
                <TagSheet open={tagSheetOpen} onOpenChange={setTagSheetOpen} onConfirm={(ids, names) => { setSelectedTags(ids || []); setSelectedTagNames(names || []); setTagSheetOpen(false) }} initialSelected={selectedTags} />
              </div>
            </div>
          </div>
        </div>

        {/* MEASUREMENTS + QUANTITY RULES - ONLY FOR PHYSICAL PRODUCTS */}
        {productType === 'physical' && (
          <div className="space-y-3 p-4">
            <h3 className="text-xs font-semibold mb-2">Unit of Measurement &amp; Quantity Rules</h3>
            <div className="rounded-sm bg-white border border-neutral-500 p-4">
              <div className="space-y-4">
                <div>
                  <label className="text-gray-600 text-xs font-medium block mb-2">Measurement Type</label>
                  <Select value={quantities.measurementType} onValueChange={handleMeasurementTypeChange} disabled={loading}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select measurement type" />
                    </SelectTrigger>
                    <SelectContent>
                      {measurementTypes && measurementTypes.map(type => (
                        <SelectItem key={type.id} value={type.code}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {quantities.measurementType && (
                  <div className="grid grid-cols-3 gap-4">
                    {/* Base Quantity */}
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <label className="text-gray-600 text-xs font-medium block">Base Quantity of Measurement</label>
                        <Tooltip>
                          <TooltipTrigger asChild><Info className="h-4 w-4 text-cyan-600 cursor-help" /></TooltipTrigger>
                          <TooltipContent>The base unit quantity for this product. All calculations are based on this quantity.</TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-end gap-2">
                        <Input type="number" placeholder="0" value={quantities.totalProductUnits} onChange={(e) => updateQuantity('totalProductUnits', e.target.value)} className="h-8 border border-neutral-500 flex-1" />
                        <Select value={quantities.totalProductUnitsType} onValueChange={(v) => updateQuantity('totalProductUnitsType', v)}>
                          <SelectTrigger className="h-8 text-xs w-fit">
                            <SelectValue placeholder="unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableUnits && availableUnits.map(unit => (
                              <SelectItem key={unit.id} value={unit.symbol}>{unit.symbol}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Minimum Sale Quantity -> product_variants.min_sale_quantity */}
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <label className="text-gray-600 text-xs font-medium block">Minimum Sale Quantity</label>
                        <Tooltip>
                          <TooltipTrigger asChild><Info className="h-4 w-4 text-cyan-600 cursor-help" /></TooltipTrigger>
                          <TooltipContent>The smallest quantity that can be sold in a single sale.</TooltipContent>
                        </Tooltip>
                      </div>
                      <Input type="number" placeholder="1" value={quantities.minSaleQuantity} onChange={(e) => updateQuantity('minSaleQuantity', e.target.value)} className="h-8 border border-neutral-500" />
                    </div>

                    {/* Quantity Increment -> product_variants.quantity_increment */}
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <label className="text-gray-600 text-xs font-medium block">Quantity Increment</label>
                        <Tooltip>
                          <TooltipTrigger asChild><Info className="h-4 w-4 text-cyan-600 cursor-help" /></TooltipTrigger>
                          <TooltipContent>Sales must move in multiples of this quantity (e.g. sold in packs of 6).</TooltipContent>
                        </Tooltip>
                      </div>
                      <Input type="number" placeholder="1" value={quantities.quantityIncrement} onChange={(e) => updateQuantity('quantityIncrement', e.target.value)} className="h-8 border border-neutral-500" />
                    </div>

                    {/* Bulk Threshold -> product_variants.bulk_threshold */}
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <label className="text-gray-600 text-xs font-medium block">Bulk Threshold <span className="text-neutral-400">(Optional)</span></label>
                        <Tooltip>
                          <TooltipTrigger asChild><Info className="h-4 w-4 text-cyan-600 cursor-help" /></TooltipTrigger>
                          <TooltipContent>Quantity at which the Wholesale pricing context's bulk rule kicks in. Leave blank if this item has no bulk tier.</TooltipContent>
                        </Tooltip>
                      </div>
                      <Input type="number" placeholder="e.g. 12" value={quantities.bulkThreshold} onChange={(e) => updateQuantity('bulkThreshold', e.target.value)} className="h-8 border border-neutral-500" />
                    </div>

                    {/* Reorder Level */}
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <label className="text-gray-600 text-xs font-medium block">Reorder Level</label>
                        <Tooltip>
                          <TooltipTrigger asChild><Info className="h-4 w-4 text-cyan-600 cursor-help" /></TooltipTrigger>
                          <TooltipContent>The minimum stock level at which you should reorder this product.</TooltipContent>
                        </Tooltip>
                      </div>
                      <Input type="number" placeholder="0" value={quantities.reorderLevel} onChange={(e) => updateQuantity('reorderLevel', e.target.value)} className="h-8 border border-neutral-500" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COST PRICE */}
        <div className="space-y-3 p-4" data-field="costPrice">
          <div className={`rounded-sm bg-white border border-neutral-500 p-4 ${errors.costPrice ? 'border-red-500 border-2 bg-red-50' : ''}`}>
            <h3 className="text-xs font-semibold mb-4">Pricing</h3>
            <div>
              <Label className={`text-xs font-medium mb-1 block ${errors.costPrice ? 'text-red-600' : ''}`}>
                {productType === 'service' ? 'Cost of Service' : 'Cost Price'}
                {productType === 'service' ? <span className="text-neutral-400 ml-1">(Optional)</span> : null}
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className={`h-8 border border-neutral-500 ${errors.costPrice ? 'border-red-500 border-2' : ''}`}
              />
              <p className={`text-[11px] mt-1 ${errors.costPrice ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {productType === 'service'
                  ? 'Optional: Cost to deliver this service (helps calculate margins)'
                  : 'Base cost price for this product (used for every variant unless a variant overrides it)'}
              </p>
            </div>
          </div>
        </div>

        {/* STANDARD PRICING
            This is the only pricing context configured at product-creation
            time. Every variant is required to have a Standard price -
            that's enforced in the create_product_with_variants function via
            p_standard_prices, not just here. Wholesale / custom contexts
            (with their own scope + condition + action pricing_rules) are
            configured separately in the Pricing module and apply at
            invoice time - they don't need anything from this screen beyond
            the Bulk Threshold quantity above. */}
        <div className="space-y-3 p-4" data-field="standardPricing">
          <h3 className="text-xs font-semibold">
            Standard Pricing <span className="text-red-500 ml-1">*</span>
          </h3>
          <p className="text-gray-500 text-[11px]">
            Every product needs a Standard selling price. Other pricing contexts (Wholesale, Distributor, etc.)
            are managed in Pricing settings and apply automatically at the point of sale.
          </p>

          <div className="border border-neutral-500 rounded-sm bg-white p-4 space-y-3">
            {/* Margin - Dual Inputs (Percentage & Value) */}
            <div data-field="margin">
              <Label className={`text-xs font-medium mb-2 block ${productType === 'physical' && errors.margin ? 'text-red-600' : ''}`}>
                Margin
                {productType === 'physical' ? <span className="text-red-500 ml-1">*</span> : null}
              </Label>
              <div className="flex mt-3 gap-3 items-center">
                <div className={`grow ${productType === 'physical' && errors.margin ? 'border border-red-500 rounded-sm p-2' : ''}`}>
                  <Label className='ml-0.5 text-[10px]'>Margin %</Label>
                  <Input
                    type='number'
                    step="0.01"
                    value={getStandardField('marginPercentage')}
                    onChange={(e) => {
                      beginEditIfNeeded();
                      const percentage = e.target.value;
                      setStandardDraft(prev => ({
                        ...prev,
                        marginPercentage: percentage,
                        marginValue: calculateValueFromPercentage(percentage, costPrice),
                      }));
                    }}
                    className={`mt-1 bg-[#fcfcfc] border border-neutral-500 h-8 ${productType === 'physical' && errors.margin && !getStandardField('marginPercentage') ? 'border-red-500 border-2' : ''}`}
                  />
                </div>
                <div className={`grow ${productType === 'physical' && errors.margin ? 'border border-red-500 rounded-sm p-2' : ''}`}>
                  <Label className='ml-0.5 text-[10px]'>Margin Value</Label>
                  <Input
                    type='number'
                    step="0.01"
                    value={getStandardField('marginValue')}
                    onChange={(e) => {
                      beginEditIfNeeded();
                      const value = e.target.value;
                      setStandardDraft(prev => ({
                        ...prev,
                        marginValue: value,
                        marginPercentage: calculatePercentageFromValue(value, costPrice),
                      }));
                    }}
                    className="mt-0 bg-[#fcfcfc] border border-neutral-500 h-8"
                  />
                </div>
              </div>
              <p className="text-gray-500 text-[10px] mt-2">Margin amount (both % and value sync based on cost price)</p>
            </div>

            {/* Selling Price - Auto-calculated for physical, Editable for service */}
            <div data-field="sellingPrice">
              <Label className={`text-xs font-medium mb-2 block ${productType === 'service' && errors.sellingPrice ? 'text-red-600' : ''}`}>
                Selling Price
                {productType === 'service' ? <span className="text-red-500 ml-1">*</span> : null}
              </Label>
              <div className={`grow ${productType === 'service' && errors.sellingPrice && !getStandardField('sellingPrice') ? 'border-red-500 border-2 rounded-sm' : ''}`}>
                {productType === 'service' ? (
                  <Input
                    type='number'
                    step="0.01"
                    value={getStandardField('sellingPrice')}
                    onChange={(e) => { beginEditIfNeeded(); setStandardDraft(prev => ({ ...prev, sellingPrice: e.target.value })); }}
                    placeholder="Enter selling price"
                    className={`mt-0 h-8 border border-neutral-500 ${errors.sellingPrice ? 'border-red-500 border-2' : ''}`}
                  />
                ) : (
                  <Input
                    type='text'
                    value={calculateSellingPrice(getStandardField('marginValue') || 0)}
                    readOnly
                    className={`mt-0 h-8 border border-neutral-500 cursor-not-allowed ${!calculateSellingPrice(getStandardField('marginValue') || 0) && errors.sellingPrice ? 'border-red-500 border-2 bg-red-50' : 'bg-[#f0f0f0]'}`}
                    placeholder="Auto-calculated"
                  />
                )}
              </div>
              <p className={`text-[10px] mt-2 ${!calculateSellingPrice(getStandardField('marginValue') || 0) && errors.sellingPrice && productType === 'physical' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {productType === 'service'
                  ? 'Required: Enter the price to charge customers for this service'
                  : (!calculateSellingPrice(getStandardField('marginValue') || 0) && errors.sellingPrice ? 'Set a margin value to calculate selling price' : 'Auto-calculated: Cost Price + Margin Value')}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});

ProductConfigurations.displayName = 'ProductConfigurations';
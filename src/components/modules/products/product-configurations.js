'use client'

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from 'lucide-react'
import supabase from '@/config/supabaseClient';

/**
 * ProductConfigurations
 * ----------------------------------------------------------------------
 * Second tab of the product creation flow (rendered by CreateProductPage).
 *
 * Pricing Contexts section (per resolution reached in this conversation):
 * - Standard's box is unchanged: direct margin %/value input, selling
 *   price auto-calculated from cost. Nothing about it changes.
 * - Every other active pricing context for the branch (Wholesale, any
 *   custom ones) gets its own box below Standard's. The input there is
 *   NOT a price - it's an adjustment relative to Standard's selling
 *   price: a mode (Reduction / Markup, Reduction is default), an
 *   adjustment type (Percentage / Fixed Amount), and a plain positive
 *   number (no minus sign shown to the user). The box shows a
 *   live-computed read-only preview price.
 * - Formula: Reduction+Percentage -> Standard x (1 - value/100);
 *   Markup+Percentage -> Standard x (1 + value/100);
 *   Reduction+Fixed -> Standard - value; Markup+Fixed -> Standard + value.
 * - Nothing is written to standard_prices or pricing_rules from this
 *   component directly - contextAdjustments is lifted to
 *   CreateProductPage, which performs the actual pricing_rules insert
 *   after the product (and its id) exists.
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

  // Pricing (Standard - unchanged)
  costPrice,
  setCostPrice,
  standardPricing,
  setStandardPricing,

  // Pricing contexts other than Standard (Reduction/Markup adjustments)
  contextAdjustments,
  setContextAdjustments,

  // Quantities (maps to product_variants: min_sale_quantity, quantity_increment, bulk_threshold, reorder_level)
  quantities,
  setQuantities,

  errors = {},
  variants = [],
  branch,
  company,
  branchCurrency,
  productType = 'physical',
}, ref) => {
  const [measurementTypes, setMeasurementTypes] = useState([]);
  const [measurementUnits, setMeasurementUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeContexts, setActiveContexts] = useState([]);

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

  // Fetch active pricing contexts for the branch (Standard + Wholesale + any custom ones)
  useEffect(() => {
    if (!branch) return;
    const fetchContexts = async () => {
      const { data, error } = await supabase
        .from('pricing_contexts')
        .select('*')
        .eq('branch', branch)
        .eq('is_active', true);
      if (error) console.error('Error fetching pricing contexts:', error);
      else setActiveContexts(data || []);
    };
    fetchContexts();
  }, [branch]);

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
  //
  // IMPORTANT: for physical products, the Selling Price field is a
  // *read-only, derived* display (cost + margin) - it has no onChange of
  // its own, so `sellingPrice` never lands in standardDraft the way
  // marginPercentage/marginValue do. If we just merge the draft in here,
  // standardPricing.sellingPrice stays at its default ('') forever, and
  // handleSubmit ends up sending selling_price: 0 to the DB even though
  // margin_percentage saved correctly. So we explicitly (re)compute and
  // write sellingPrice into what gets committed, for physical products.
  useImperativeHandle(ref, () => ({
    commitEditingState: () => {
      if (isEditingStandard) {
        const merged = { ...standardPricing, ...standardDraft };
        const updated = productType === 'physical'
          ? { ...merged, sellingPrice: calculateSellingPrice(merged.marginValue || 0) }
          : merged;
        setStandardPricing(updated);
        setIsEditingStandard(false);
        setStandardDraft({});
        return updated;
      }
      // Not mid-edit, but for physical products sellingPrice is derived
      // from costPrice (owned by the parent, can change independently of
      // this component's own edit state) + the already-committed margin -
      // so keep it in sync even when nothing here was just edited.
      if (productType === 'physical') {
        const updated = { ...standardPricing, sellingPrice: calculateSellingPrice(standardPricing.marginValue || 0) };
        setStandardPricing(updated);
        return updated;
      }
      return standardPricing;
    }
  }));

  // Standard's current selling price - the base every other context's
  // adjustment is computed against.
  const standardSellingPrice = productType === 'service'
    ? getStandardField('sellingPrice')
    : calculateSellingPrice(getStandardField('marginValue') || 0);

  const DEFAULT_ADJUSTMENT = { mode: 'reduction', adjustmentType: 'percentage', value: '' };

  const getAdjustment = (contextId) => contextAdjustments?.[contextId] || DEFAULT_ADJUSTMENT;

  const updateAdjustment = (contextId, field, value) => {
    setContextAdjustments(prev => ({
      ...prev,
      [contextId]: { ...getAdjustment(contextId), [field]: value },
    }));
  };

  const calculateContextPreview = (adjustment) => {
    const base = parseFloat(standardSellingPrice);
    const value = parseFloat(adjustment.value);
    if (!base || isNaN(value)) return '';

    if (adjustment.adjustmentType === 'percentage') {
      return adjustment.mode === 'reduction'
        ? (base * (1 - value / 100)).toFixed(2)
        : (base * (1 + value / 100)).toFixed(2);
    }
    // fixed amount
    return adjustment.mode === 'reduction'
      ? (base - value).toFixed(2)
      : (base + value).toFixed(2);
  };

  const otherContexts = activeContexts.filter(context => !context.is_default);

  return (
    <div className="text-neutral-700 font-WixMade tracking-tight max-w-5xl mx-auto text-xs">
      <h2 className="font-semibold mb-4">Configurations</h2>

      <div className="space-y-4 text-xs text-gray-700">

        {/* Categories */}
        <div className="rounded-sm bg-white p-4 space-y-4" data-field="category">
          <div className="flex gap-4">
            <div className="flex-1 max-w-xl">
              <label className="text-gray-600 text-xs">Categories </label>
              <div className="flex gap-2 mt-1 items-center">
                <input className={`flex-1 border border-neutral-500 rounded-sm p-2 text-xs ${errors.category ? 'border-red-500 border-2 bg-red-50' : ''}`} value={selectedCategoryName || ''} readOnly placeholder="Select category" />
                <Button variant="outline" className="h-8 px-2 text-xs" onClick={() => setCategorySheetOpen(true)}>Select</Button>
                <CategorySheet branch={branch} company={company} open={categorySheetOpen} onOpenChange={setCategorySheetOpen} onConfirm={(id, name) => { setSelectedCategoryId(id); setSelectedCategoryName(name || ''); setCategorySheetOpen(false) }} initialSelected={selectedCategoryId} />
              </div>
              <label className="text-gray-600 text-xs block mt-3">Currency</label>
              <Input
                value={branchCurrency || ''}
                readOnly
                aria-readonly="true"
                placeholder="Branch currency"
                className="mt-1 h-8 border border-neutral-500 bg-neutral-100 cursor-not-allowed"
              />
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

        {/* STANDARD PRICING - unchanged */}
        <div className="space-y-3 p-4" data-field="standardPricing">
          <h3 className="text-xs font-semibold">
            Standard Pricing <span className="text-red-500 ml-1">*</span>
          </h3>
          <p className="text-gray-500 text-[11px]">
            Every product needs a Standard selling price. Other pricing contexts (Wholesale, custom ones)
            are shown below as a live preview relative to Standard.
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

        {/* OTHER PRICING CONTEXTS - Reduction/Markup adjustments relative to Standard */}
        {otherContexts.length > 0 && (
          <div className="space-y-3 p-4" data-field="contextAdjustments">
            <h3 className="text-xs font-semibold">Other Pricing Contexts</h3>
            <p className="text-gray-500 text-[11px]">
              Each context's price is computed live from Standard at invoice time. Set a Reduction or Markup
              here to adjust that computation for this product - nothing is stored unless you set a value.
            </p>

            <div className="space-y-3">
              {otherContexts.map(context => {
                const adjustment = getAdjustment(context.id);
                const preview = calculateContextPreview(adjustment);
                return (
                  <div key={context.id} className="border border-neutral-500 rounded-sm bg-white p-4 space-y-3">
                    <h4 className="text-xs font-semibold">{context.name}</h4>
                    <div className="grid grid-cols-4 gap-3 items-end">
                      <div>
                        <Label className="text-[10px] mb-1 block">Mode</Label>
                        <Select value={adjustment.mode} onValueChange={(v) => updateAdjustment(context.id, 'mode', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reduction">Reduction</SelectItem>
                            <SelectItem value="markup">Markup</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] mb-1 block">Type</Label>
                        <Select value={adjustment.adjustmentType} onValueChange={(v) => updateAdjustment(context.id, 'adjustmentType', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] mb-1 block">Value</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={adjustment.value}
                          onChange={(e) => updateAdjustment(context.id, 'value', e.target.value)}
                          className="h-8 border border-neutral-500"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] mb-1 block">Preview</Label>
                        <Input
                          type="text"
                          readOnly
                          value={preview}
                          placeholder="-"
                          className="h-8 border border-neutral-500 bg-[#f0f0f0] cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
});

ProductConfigurations.displayName = 'ProductConfigurations';
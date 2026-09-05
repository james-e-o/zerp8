'use client'

import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { DndProvider, useDrag, useDrop, useDragLayer } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Link from "next/link"
import { motion, AnimatePresence } from 'framer-motion';

import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { X, Plus, GripVertical, Upload } from "lucide-react"
import { toast } from 'sonner'
import { useRouter, useParams } from 'next/navigation'

import AddImage from "@/components/add-image";
import { VariantTable } from '@/components/variants';
import { ProductConfigurations } from "@/components/product-configurations";
import supabase from "@/config/supabaseClient";

import { BranchContext } from "@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext";

// ----------------------------------------------------------------------
// Relationship between this file and ProductConfigurations:
// This page owns ALL form state - ProductConfigurations (the
// "Configurations" tab) is a controlled child that renders a slice of it.
// To keep that handoff manageable, related fields are grouped into a
// small number of objects rather than passed as dozens of individual
// props:
//   - standardPricing / setStandardPricing  { marginPercentage, marginValue, sellingPrice }
//   - quantities / setQuantities             { measurementType, totalProductUnits,
//                                               totalProductUnitsType, minSaleQuantity,
//                                               quantityIncrement, bulkThreshold, reorderLevel }
// The Category sheet and Variants tab are unaffected and
// keep their existing shape.
//
// Removed entirely (per the Sept 2026 schema discussion):
//   - Shipping Profile (state, fetch, sheet) - now owned by the Shipping module.
//   - Return Policy (state, fetch, sheet) - now owned by Settings.
//   - Multi pricing-context selection/creation UI - a product only ever
//     needs a Standard price at creation time; Wholesale/custom contexts
//     are configured separately and resolved per invoice line.
// ----------------------------------------------------------------------

function buildCategoryTree(categories) {
  const map = {};
  const roots = [];
  categories.forEach(c => map[c.id] = { ...c, children: [] });
  categories.forEach(c => {
    if (c.parent && map[c.parent]) map[c.parent].children.push(map[c.id]);
    else roots.push(map[c.id]);
  });
  return roots;
}

function convertToSlug(input) {
  return input.toString().toLowerCase().replace(/['"]/g, '').trim().replace(/\band\b/g, '&').replace(/[^a-z0-9\&-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').replace(/&/g, 'and')
}
function capitalize(input) {
  return input.toString().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ').replace(/\bAnd\b/g, '&')
}

const DEFAULT_QUANTITIES = {
  measurementType: 'count',
  totalProductUnits: '1',
  totalProductUnitsType: 'count',
  minSaleQuantity: '1',
  quantityIncrement: '1',
  bulkThreshold: '',
  reorderLevel: '',
};

const DEFAULT_STANDARD_PRICING = {
  marginPercentage: '',
  marginValue: '',
  sellingPrice: '',
};

const CreateProductPage = () => {
  const [activeTab, setActiveTab] = useState("details");
  const params = useParams();
  const router = useRouter();
  const { u, companyId, branchId } = params;
  const { currentBranch } = useContext(BranchContext);

  // Product state
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [hasVariants, setHasVariants] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [variantCombinations, setVariantCombinations] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedCategoryName, setSelectedCategoryName] = useState('')
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [productType, setProductType] = useState('physical');

  // Specifications state
  const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' });
  const [dimensionUnit, setDimensionUnit] = useState('cm');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [brand, setBrand] = useState('');
  const [upc, setUpc] = useState('');
  const [mpn, setMpn] = useState('');
  const [ean, setEan] = useState('');
  const [isbn, setIsbn] = useState('');

  // Pricing state - base cost + the single required Standard pricing context
  const [costPrice, setCostPrice] = useState('');
  const [standardPricing, setStandardPricing] = useState(DEFAULT_STANDARD_PRICING);

  // Quantity rules - maps to product_variants columns
  const [quantities, setQuantities] = useState(DEFAULT_QUANTITIES);

  // Options state
  const [options, setOptions] = useState([]);
  const [justAdded, setJustAdded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const lastOptionRef = useRef(null);
  const InputRefs = useRef([]);
  const productConfigRef = useRef(null);

  // Service-specific state
  const [serviceDuration, setServiceDuration] = useState('');
  const [requiresStaff, setRequiresStaff] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState('');

  // Validation state
  const [errors, setErrors] = useState({});

  //Inputs Values State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');

  const requiredFields = {
    title: true,
    subtitle: false,
    handle: true,
    description: false,
    images: productType === 'physical',
    serviceDuration: productType === 'service',
    brand: false,
    costPrice: false,
  };

  const renderFieldLabel = (labelText, fieldKey) => (
    <label className="text-xs font-medium">
      {labelText}
      {requiredFields[fieldKey] ? (
        <span className="text-red-500 ml-1">*</span>
      ) : (
        <span className="text-neutral-400 ml-1">(Optional)</span>
      )}
    </label>
  );

  const generateCombinations = (optionsets) => {
    const validOptions = optionsets.filter(opt => opt.name && opt.values.length > 0);
    if (validOptions.length === 0) return [];
    let combinations = [[]];
    for (let option of validOptions) {
      let newCombinations = [];
      for (let combo of combinations) {
        for (let value of option.values) {
          newCombinations.push([...combo, { optionName: option.name, value }]);
        }
      }
      combinations = newCombinations;
    }
    return combinations.map((combo) => ({ combination: combo, id: combo.map(item => `${item.optionName}-${item.value}`).join('-') }));
  };

  const updateVariantValue = useCallback((rowIndex, columnId, value) => {
    setVariantCombinations(prev => {
      const newCombos = [...prev];
      if (!newCombos[rowIndex]) return prev;
      newCombos[rowIndex] = { ...newCombos[rowIndex], [columnId]: value };
      return newCombos;
    });
  }, []);

  useEffect(() => {
    let combos;
    if (hasVariants) combos = generateCombinations(options);
    else combos = [{ combination: [], id: 'default' }];
    setVariantCombinations(prev => combos.map(combo => {
      const existing = prev.find(p => p.id === combo.id);
      return existing ? existing : combo;
    }));
  }, [options, hasVariants]);

  useEffect(() => { setErrors({}); }, [productType]);

  const resetAllInputs = () => {
    setTitle('');
    setSubtitle('');
    setHandle('');
    setDescription('');
    setSelectedImages([]);
    setDimensions({ length: '', width: '', height: '' });
    setWeight('');
    setBrand('');
    setUpc('');
    setMpn('');
    setEan('');
    setIsbn('');
    setServiceDuration('');
    setRequiresStaff(false);
    setSelectedStaff('');
    setCostPrice('');
    setOptions([]);
    setVariantCombinations([]);
    setSelectedCategoryId('');
    setSelectedCategoryName('');
    setHasVariants(false);
    setQuantities(DEFAULT_QUANTITIES);
    setStandardPricing(DEFAULT_STANDARD_PRICING);
    setErrors({});
  };

  useEffect(() => { resetAllInputs(); }, [productType]);

  useEffect(() => {
    const handler = (e) => {
      if (e?.detail && Array.isArray(e.detail)) {
        const incoming = e.detail || [];
        const merged = [...selectedImages];
        incoming.forEach(img => { if (!merged.find(m => m.id === img.id)) merged.push(img); });
        setSelectedImages(merged);
      }
    };
    window.addEventListener('nexshelf:selectedImages', handler);
    return () => window.removeEventListener('nexshelf:selectedImages', handler);
  }, []);

  useEffect(() => {
    if (justAdded && lastOptionRef.current) {
      lastOptionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setJustAdded(false);
    }
  }, [justAdded]);

  const moveCombination = (fromIndex, toIndex) => {
    const newCombos = [...variantCombinations];
    const [moved] = newCombos.splice(fromIndex, 1);
    newCombos.splice(toIndex, 0, moved);
    setVariantCombinations(newCombos);
    setDraggedIndex(toIndex);
  };

  const moveImage = (fromIndex, toIndex) => {
    const newImages = [...selectedImages];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    setSelectedImages(newImages);
  };

  const addOption = () => {
    setOptions([...options, { id: Date.now(), name: '', values: [], Input: '' }]);
    setJustAdded(true);
  };
  const removeOption = (index) => setOptions(options.filter((_, i) => i !== index));
  const updateOptionName = (index, name) => setOptions(options.map((opt, i) => i === index ? { ...opt, name } : opt));
  const updateOptionInput = (index, Input) => setOptions(options.map((opt, i) => i === index ? { ...opt, Input } : opt));
  const addValue = (index) => {
    const opt = options[index];
    if (opt.Input.trim() && opt.name.trim()) {
      setOptions(options.map((o, i) => i === index ? { ...o, values: [...o.values, o.Input.trim()], Input: '' } : o));
    }
  };
  const removeValue = (index, valIndex) => setOptions(options.map((o, i) => i === index ? { ...o, values: o.values.filter((_, vi) => vi !== valIndex) } : o));
  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addValue(index);
      InputRefs.current[index]?.focus();
    }
  };

  // Validation for current tab before moving to next.
  // standardOverride lets goToNextTab pass a freshly-committed standardPricing
  // object (from ProductConfigurations.commitEditingState) instead of stale state.
  const validateCurrentTab = (tabName, standardOverride = null) => {
    const newErrors = {};
    const standard = standardOverride || standardPricing;

    if (tabName === 'details') {
      if (requiredFields.title && !title.trim()) newErrors.title = true;
      if (requiredFields.handle && !handle.trim()) newErrors.handle = true;
      if (requiredFields.description && !description.trim()) newErrors.description = true;
      if (requiredFields.serviceDuration && !serviceDuration.trim()) newErrors.serviceDuration = true;
      if (requiredFields.images && selectedImages.length === 0) newErrors.images = true;
      if (requiredFields.brand && !brand.trim()) newErrors.brand = true;
    }
    else if (tabName === 'configure') {
      if (!selectedCategoryId || !selectedCategoryId.trim()) newErrors.category = true;
      if (productType === 'physical' && !costPrice.trim()) newErrors.costPrice = true;

      if (productType === 'physical') {
        const hasMargin = (standard.marginValue && standard.marginValue.toString().trim() !== '') ||
          (standard.marginPercentage && standard.marginPercentage.toString().trim() !== '');
        if (!hasMargin) newErrors.margin = true;
      } else if (productType === 'service') {
        const hasServiceSellingPrice = standard.sellingPrice && standard.sellingPrice.toString().trim() !== '';
        if (!hasServiceSellingPrice) newErrors.sellingPrice = true;
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const errorKeys = Object.keys(newErrors);
      const firstError = errorKeys[0];
      const errorMessages = {
        category: 'Please select a category',
        costPrice: 'Please enter a cost price',
        margin: 'Please set a margin value for the standard price',
        sellingPrice: 'Please set a selling price',
        default: `Please fill in: ${firstError}`
      };
      toast.error(errorMessages[firstError] || errorMessages.default);
      setTimeout(() => {
        const element = document.querySelector(`[data-field="${firstError}"]`);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return false;
    }
    return true;
  };

  const validateForm = () => {
    const newErrors = {};
    if (requiredFields.title && !title.trim()) newErrors.title = true;
    if (requiredFields.handle && !handle.trim()) newErrors.handle = true;
    if (requiredFields.description && !description.trim()) newErrors.description = true;
    if (requiredFields.serviceDuration && !serviceDuration.trim()) newErrors.serviceDuration = true;
    if (requiredFields.images && selectedImages.length === 0) newErrors.images = true;
    if (requiredFields.brand && !brand.trim()) newErrors.brand = true;
    if (requiredFields.costPrice && !costPrice.trim()) newErrors.costPrice = true;

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const errorKeys = Object.keys(newErrors);
      const firstError = errorKeys[0];
      setActiveTab('details');
      setTimeout(() => {
        const element = document.querySelector(`[data-field="${firstError}"]`);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return false;
    }
    return true;
  };

  const goToPreviousTab = () => {
    if (productConfigRef.current?.commitEditingState) productConfigRef.current.commitEditingState();
    if (activeTab === 'configure') setActiveTab('details');
    else if (activeTab === 'variants') setActiveTab('configure');
  };

  const goToNextTab = () => {
    if (activeTab === 'details') setActiveTab('configure');
    else if (activeTab === 'configure') setActiveTab('variants');
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      const baseImages = selectedImages?.map((img, index) => ({
        url: img.url || img.src,
        alt: img.alt || title,
        display_order: index,
        is_primary: index === 0,
      })) || [];

      // Build variant SKUs + quantity rules first so p_standard_prices can key off the same SKUs
      const variantsPayload = variantCombinations.map((variant, index) => {
        const sku = variant.sku || `${convertToSlug(handle)}-${Date.now()}-${index}`;
        return {
          sku,
          cost: parseFloat(variant.costPrice || costPrice) || 0,
          cost_currency: 'NGN',
          is_variant: variant.combination?.length > 0,
          is_active: true,
          reserve: 0,
          reorder_level: parseFloat(quantities.reorderLevel) || 0,
          min_sale_quantity: parseInt(quantities.minSaleQuantity, 10) || 1,
          quantity_increment: parseInt(quantities.quantityIncrement, 10) || 1,
          bulk_threshold: quantities.bulkThreshold ? parseInt(quantities.bulkThreshold, 10) : null,
          mpn: variant.mpn || null,
          upc: variant.upc || null,
          ean: variant.ean || null,
          isbn: variant.isbn || null,
        };
      });

      // Standard price is required for every variant - built from the single
      // Standard pricing block, with a per-variant override if the Variants
      // tab set one directly on the combination.
      const standardPrices = {};
      variantCombinations.forEach((variant, index) => {
        const sku = variantsPayload[index].sku;
        standardPrices[sku] = {
          selling_price: parseFloat(variant.sellingPrice || standardPricing.sellingPrice) || 0,
          margin_percentage: parseFloat(standardPricing.marginPercentage) || null,
        };
      });

      const variantImagesMap = {};
      variantCombinations.forEach((variant, index) => {
        const sku = variantsPayload[index].sku;
        if (variant.images && variant.images.length > 0) {
          variantImagesMap[sku] = variant.images.map((url, i) => ({
            url, alt: title, display_order: i, is_primary: i === 0,
          }));
        }
      });

      const { data, error } = await supabase.rpc('create_product_with_variants', {
        p_branch: currentBranch?.id,
        p_title: title,
        p_handle: convertToSlug(handle),
        p_variants: variantsPayload,
        p_standard_prices: standardPrices,

        p_sub_title: subtitle || null,
        p_description: description || null,
        p_brand: brand || null,
        p_category: selectedCategoryId || null,
        p_length: dimensions?.length ? parseFloat(dimensions.length) : null,
        p_width: dimensions?.width ? parseFloat(dimensions.width) : null,
        p_height: dimensions?.height ? parseFloat(dimensions.height) : null,
        p_weight: weight ? parseFloat(weight) : null,
        p_weight_unit: weightUnit || null,
        p_dimension_unit: dimensionUnit || 'cm',
        p_type: productType,
        p_created_by: currentUserId,

        p_base_images: baseImages.length > 0 ? baseImages : null,
        p_variant_images: Object.keys(variantImagesMap).length > 0 ? variantImagesMap : null,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create product');

      toast.success('🎉 Product created successfully!');
      router.push(`/users/${u}/company/${companyId}/branches/${branchId}/modules/products`);

    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to create product');
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <>
        <AlertDialog>
          <div className='flex font-WixMade inset-0 bg-neutral-500 shadow-md absolute z-40'>
            <div className='bg-white flex flex-col border border-neutral-300 absolute inset-2 shadow-0 overflow-clip rounded-lg'>
              <div className="relative w-full h-full flex flex-col">
                <div className="flex items-center justify-between border-b border-neutral-300 px-6 py-3 bg-white z-10">
                  <div className="flex items-center gap-2">
                    <Link href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/products`}><Button variant={'ghost'} className="text-white bg-red-500 h-7 hover:text-black text-xs">✕</Button></Link>
                    <Button onClick={resetAllInputs} variant={'outline'} className="px-2 py-1 h-7 text-[10px] rounded-sm text-neutral-600 border border-neutral-300">Reset</Button>

                    <div className="flex items-center gap-3 ml-16 text-xs font-medium">
                      <Button variant={'outline'} onClick={() => setActiveTab("details")} className={`px-2 py-1 h-6 text-[11px] rounded-sm ${activeTab === "details" ? "bg-neutral-800 text-neutral-50" : "text-neutral-600"}`}>
                        <span className="top-px relative">Details</span>
                      </Button>
                      <span className="text-neutral-300">|</span>
                      <Button variant={'outline'} onClick={() => setActiveTab("configure")} className={`px-2 py-1 h-6 text-[11px] rounded-sm ${activeTab === "configure" ? "bg-neutral-800 text-neutral-50" : "text-neutral-600"}`}>
                        <span className="top-px relative">Configurations</span>
                      </Button>
                      <span className="text-neutral-300">|</span>
                      <Button variant={'outline'} onClick={() => setActiveTab("variants")} className={`px-2 py-1 h-6 text-[11px] rounded-sm ${activeTab === "variants" ? "bg-neutral-800 text-neutral-50" : "text-neutral-600"}`}>
                        <span className="top-px relative">{productType === 'service' ? 'Quality Tiers' : 'Variants'}</span>
                      </Button>
                    </div>
                  </div>
                  <Button variant={''} className="px-3 h-7 py-2 bg-core rounded-sm border hover:bg-core/90 text-xs text-white">Save as draft</Button>
                </div>

                <div className="flex-1 overflow-y-auto pt-4">
                  <div className="space-y-10 text-xs text-neutral-900 pb-10">

                    {activeTab === "details" && (
                      <div className="space-y-10 max-w-5xl mx-auto py-9">
                        <div className="space-y-5 mx-8">
                          <h2 className="font-semibold text-sm">General</h2>

                          <div className="border border-neutral-500 rounded-sm p-4 bg-white">
                            <label className="text-xs font-medium block mb-3">Product Type</label>
                            <RadioGroup value={productType} onValueChange={setProductType} className="flex gap-6">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem className='border-neutral-500' value="physical" id="type-physical" />
                                <Label htmlFor="type-physical" className="font-normal text-xs cursor-pointer">Physical</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem className='border-neutral-500' value="service" id="type-service" />
                                <Label htmlFor="type-service" className="font-normal text-xs cursor-pointer">Service</Label>
                              </div>
                            </RadioGroup>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col space-y-1" data-field="title">
                              {renderFieldLabel(productType === 'service' ? "Service Name" : "Title", "title")}
                              <Input
                                required={requiredFields.title}
                                className={`border border-neutral-500 rounded-sm px-2 py-2 text-xs ${errors.title ? 'border-red-500 border-2' : ''}`}
                                placeholder={productType === 'service' ? "e.g., Haircut - Fade, Manicure, Facial" : "Winter jacket"}
                                value={title}
                                onChange={({ target }) => { const v = capitalize(target.value); setTitle(v); setHandle(convertToSlug(target.value)); setErrors(prev => ({ ...prev, title: false })); }}
                              />
                            </div>
                            <div className="flex flex-col space-y-1" data-field="subtitle">
                              {renderFieldLabel("Subtitle", "subtitle")}
                              <Input required={requiredFields.subtitle} className="border border-neutral-500 rounded-sm px-2 py-2 text-xs" placeholder={productType === 'service' ? "e.g., Premium fade with razor finish" : "Warm and cozy"} value={subtitle} onChange={({ target }) => { setSubtitle(target.value); setErrors(prev => ({ ...prev, subtitle: false })); }} />
                            </div>
                            <div className="flex flex-col space-y-1" data-field="handle">
                              {renderFieldLabel("Handle", "handle")}
                              <div className="flex">
                                <span className="border border-r-0 rounded-sm rounded-r-none px-2 py-2 text-xs bg-neutral-100 text-neutral-500">/</span>
                                <Input required={requiredFields.handle} className={`border border-neutral-500 rounded-sm rounded-l-none px-2 py-2 text-xs w-full ${errors.handle ? 'border-red-500 border-2' : ''}`} value={handle} onChange={({ target }) => { setHandle(convertToSlug(target.value)); setErrors(prev => ({ ...prev, handle: false })); }} placeholder="winter-jacket" />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col space-y-1" data-field="description">
                            {renderFieldLabel("Description", "description")}
                            <Textarea required={requiredFields.description} rows={5} value={description} onChange={(e) => { setDescription(e.target.value); setErrors(prev => ({ ...prev, description: false })); }} className={`border border-neutral-500 rounded-sm px-2 py-2 text-xs ${errors.description ? 'border-red-500 border-2' : ''}`} placeholder={productType === 'service' ? "Describe the service details..." : "A warm and cozy jacket"} />
                          </div>

                          {productType === 'physical' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col space-y-1" data-field="brand">
                                {renderFieldLabel("Brand/Manufacturer", "brand")}
                                <Input required={requiredFields.brand} placeholder="Select or Add Brand" value={brand} onChange={(e) => { setBrand(e.target.value); setErrors(prev => ({ ...prev, brand: false })); }} className={`border border-neutral-500 rounded-sm px-2 py-2 text-xs ${errors.brand ? 'border-red-500 border-2' : ''}`} />
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col space-y-1" data-field="serviceDuration">
                                {renderFieldLabel("Duration (minutes)", "serviceDuration")}
                                <Input type="number" required={requiredFields.serviceDuration} placeholder="e.g., 30, 45, 60" value={serviceDuration} onChange={(e) => { setServiceDuration(e.target.value); setErrors(prev => ({ ...prev, serviceDuration: false })); }} className={`border border-neutral-500 rounded-sm px-2 py-2 text-xs ${errors.serviceDuration ? 'border-red-500 border-2' : ''}`} />
                              </div>
                              <div className="flex flex-col space-y-3">
                                <label className="text-xs font-medium flex items-center gap-2">
                                  <Checkbox checked={requiresStaff} onCheckedChange={setRequiresStaff} />
                                  <span>Requires Staff Assignment</span>
                                </label>
                              </div>
                              {requiresStaff && (
                                <div className="flex flex-col space-y-1">
                                  <label className="text-xs font-medium">Select Staff <span className="text-neutral-400">(Optional)</span></label>
                                  <Input placeholder="Search or select staff member" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="border border-neutral-500 rounded-sm px-2 py-2 text-xs" />
                                </div>
                              )}
                            </>
                          )}

                          <div data-field="images">
                            {renderFieldLabel("Media", "images")}
                            {requiredFields.images && <span className="text-neutral-400 text-xs ml-1">(Required if product will appear on e-commerce)</span>}
                            {!requiredFields.images && <span className="text-neutral-400 text-xs ml-1">(Optional - images help showcase your service)</span>}
                            {hasVariants && selectedImages.length > 0 && variantCombinations.length > 0 && (
                              <p className="text-[10px] text-neutral-500 mt-1">Images are mapped to variants in order: the first image corresponds to the first variant, the second to the second, and so on.</p>
                            )}
                            <div className={`mt-2 border border-neutral-500 border-dashed rounded-sm min-h-32 flex text-neutral-500 p-2 ${errors.images ? 'border-red-500 border-2 bg-red-50' : ''}`}>
                              {selectedImages && selectedImages.length > 0 ? (
                                <div className="w-full flex items-center gap-3">
                                  <div className="flex-1">
                                    <div className="flex gap-2 overflow-x-auto py-1">
                                      {selectedImages.map((img, idx) => (
                                        <DraggableImage key={img.id || idx} img={img} index={idx} moveImage={moveImage} isFirst={idx === 0} onClick={() => { setSelectedImage(img); setImageDialogOpen(true); }} />
                                      ))}
                                    </div>
                                  </div>
                                  <div className="w-fit">
                                    <AlertDialogTrigger asChild>
                                      <Button variant={'ghost'} className="flex flex-col h-fit items-center justify-center gap-0.5 px-3 py-2">
                                        <span className="text-[11px] text-army">Add / Edit Images</span>
                                      </Button>
                                    </AlertDialogTrigger>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-24 flex flex-col items-center justify-center text-neutral-500">
                                  <AlertDialogTrigger asChild>
                                    <Button variant={'ghost'} className="flex flex-col h-fit items-center justify-center gap-0.5">
                                      <span className="text-lg mb-1"><Upload className="text-core size-4" /></span>
                                      <span className="text-[11px] text-army">Click to Upload images</span>
                                    </Button>
                                  </AlertDialogTrigger>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {productType === 'physical' && (
                          <div className="space-y-5 mx-8">
                            <h2 className="text-xs font-semibold">Specifications</h2>
                            <div className="border border-neutral-500 rounded-sm px-4 py-3">
                              <div className="mb-4">
                                <Label className="text-xs font-medium mb-2 block">Dimensions (Length X Width X Height)</Label>
                                <div className="flex gap-2 items-end">
                                  <div className="flex-1"><Input placeholder="Length" type="number" step="0.01" value={dimensions.length} onChange={(e) => setDimensions({ ...dimensions, length: e.target.value })} className="h-8 border-neutral-500 border" /></div>
                                  <span className="text-xs text-neutral-500">x</span>
                                  <div className="flex-1"><Input placeholder="Width" type="number" step="0.01" value={dimensions.width} onChange={(e) => setDimensions({ ...dimensions, width: e.target.value })} className="h-8 border-neutral-500 border" /></div>
                                  <span className="text-xs text-neutral-500">x</span>
                                  <div className="flex-1"><Input placeholder="Height" type="number" step="0.01" value={dimensions.height} onChange={(e) => setDimensions({ ...dimensions, height: e.target.value })} className="h-8 border-neutral-500 border" /></div>
                                  <div className="w-20">
                                    <select value={dimensionUnit} onChange={(e) => setDimensionUnit(e.target.value)} className="h-8 px-2 border border-neutral-500 rounded-sm text-xs bg-white">
                                      <option value="cm">cm</option><option value="m">m</option><option value="in">in</option><option value="ft">ft</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs font-medium mb-2 block">Weight</Label>
                                <div className="flex gap-2">
                                  <div className="flex-1"><Input placeholder="0.4" value={weight} onChange={(e) => setWeight(e.target.value)} type="number" step="0.01" className="h-8" /></div>
                                  <div className="w-20">
                                    <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)} className="h-8 px-2 border border-neutral-500 rounded-sm text-xs bg-white">
                                      <option value="kg">kg</option><option value="g">g</option><option value="lb">lb</option><option value="oz">oz</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="border border-neutral-500 rounded-sm px-4 mt-9 py-3">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs font-medium mb-2 flex items-center gap-1">UPC <span className="text-neutral-400 text-[10px]">Optional</span></Label>
                                  <Input placeholder="Universal Product Code" value={upc} onChange={(e) => setUpc(e.target.value)} className="h-8 border-neutral-500 border" />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium mb-2 flex items-center gap-1">MPN <span className="text-neutral-400 text-[10px]">Optional</span></Label>
                                  <Input placeholder="Manufacturer Part Number" value={mpn} onChange={(e) => setMpn(e.target.value)} className="h-8 border-neutral-500 border" />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium mb-2 flex items-center gap-1">EAN <span className="text-neutral-400 text-[10px]">Optional</span></Label>
                                  <Input placeholder="European Article Number" value={ean} onChange={(e) => setEan(e.target.value)} className="h-8 border-neutral-500 border" />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium mb-2 flex items-center gap-1">ISBN <span className="text-neutral-400 text-[10px]">Optional</span></Label>
                                  <Input placeholder="International Standard Book Number" value={isbn} onChange={(e) => setIsbn(e.target.value)} className="h-8 border-neutral-500 border" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-5 mx-8">
                          <h2 className="text-xs font-semibold">{productType === 'service' ? 'Service Options' : 'Variants'}</h2>
                          <div className="border border-neutral-500 rounded-sm px-4 py-3 space-y-1">
                            <div className="flex items-center gap-2">
                              <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
                              <span className="font-medium text-xs">{productType === 'service' ? 'Toggle if this service has different options (e.g., styles, durations)' : 'Toggle if this is a product with variants'}</span>
                            </div>
                            <p className="text-[10px] text-neutral-500">{productType === 'service' ? 'Define service variations such as style, duration, or quality' : 'When unchecked, we will create a default variant for you'}</p>
                          </div>

                          <div className={hasVariants ? "grid grid-rows-[1fr] transition-all duration-300" : "grid grid-rows-[0fr] transition-all duration-300"}>
                            <div className="overflow-hidden">
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <h3 className="text-xs font-medium">{productType === 'service' ? 'Service Options' : 'Product'} options</h3>
                                  <p className="text-[10px] text-neutral-500">{productType === 'service' ? 'Define service variations such as style, duration, or quality level' : 'Define the options and values for the product, e.g. color, size, etc.'}</p>

                                  {options.map((option, index) => (
                                    <div key={option.id} ref={index === options.length - 1 ? lastOptionRef : null} className="border border-neutral-300 rounded-sm">
                                      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-500">
                                        <Input type="text" autoFocus={justAdded} defaultValue={option.name} onInput={(e) => { e.target.value = e.target.value.toUpperCase(); updateOptionName(index, e.target.value); }} className="font-medium text-xs border-0 outline-0 flex-1" placeholder="Option name" />
                                        <Button variant="ghost" size="sm" onClick={() => removeOption(index)} className="h-6 w-6 p-0"><X className="h-4 w-4" /></Button>
                                      </div>
                                      <div className="px-4 py-3 space-y-2">
                                        <label className="text-[10px] italic ml-1 font-medium">Values</label>
                                        <Input ref={(el) => InputRefs.current[index] = el} type="text" value={option.Input} onChange={(e) => updateOptionInput(index, e.target.value.toLowerCase())} onKeyDown={(e) => handleKeyDown(e, index)} className="w-full border-0 outline-0 mt-1 text-xs placeholder-neutral-400" placeholder={productType === 'service' ? 'e.g., fade, crew cut, taper or standard, deluxe, premium' : 'Add values...'} />
                                        <div className="flex flex-wrap gap-2">
                                          {option.values.map((value, valIndex) => (
                                            <span key={valIndex} className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded-sm text-xs">
                                              {value}
                                              <button onClick={() => removeValue(index, valIndex)} className="text-neutral-500 hover:text-neutral-700"><X className="h-3 w-3" /></button>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  <div className="flex justify-end">
                                    <Button className="border border-neutral-500 rounded-sm px-4 text-white h-7 bg-army text-xs hover:bg-army/85 w-fit" onClick={addOption}>Add Option</Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {hasVariants && options.length > 0 && (
                            <div className="mt-4">
                              <h3 className="text-xs mb-2 font-medium">{productType === 'service' ? 'Quality Tier Combinations' : 'Variant Combinations'} <span className="text-[10px] ml-1 text-core italic">{`(drag and drop to modify hierarchy)`}</span></h3>
                              <CombinationDragPreview />
                              <AnimatePresence mode="popLayout">
                                <div className="space-y-2">
                                  {variantCombinations.map((combo, index) => (
                                    <DraggableCombination
                                      key={combo.id}
                                      combo={combo}
                                      index={index}
                                      moveCombination={moveCombination}
                                      draggedIndex={draggedIndex}
                                      onDragStart={() => setDraggedIndex(index)}
                                      onDragEnd={() => setDraggedIndex(null)}
                                      selectedImages={selectedImages}
                                      updateCombinationImages={(idx, images) => {
                                        setVariantCombinations(prev => { const updated = [...prev]; updated[idx] = { ...updated[idx], images }; return updated; });
                                      }}
                                      onRemoveImage={(idx, imgIdx) => {
                                        setVariantCombinations(prev => { const updated = [...prev]; updated[idx].images = updated[idx].images?.filter((_, i) => i !== imgIdx) || []; return updated; });
                                      }}
                                      onMoveImage={(idx, fromIdx, toIdx) => {
                                        setVariantCombinations(prev => {
                                          const updated = [...prev];
                                          const images = [...(updated[idx].images || [])];
                                          const [moved] = images.splice(fromIdx, 1);
                                          images.splice(toIdx, 0, moved);
                                          updated[idx] = { ...updated[idx], images };
                                          return updated;
                                        });
                                      }}
                                    />
                                  ))}
                                </div>
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === "configure" && (
                      <ProductConfigurations
                        ref={productConfigRef}
                        selectedCategoryId={selectedCategoryId}
                        selectedCategoryName={selectedCategoryName}
                        setSelectedCategoryId={setSelectedCategoryId}
                        setSelectedCategoryName={setSelectedCategoryName}
                        categorySheetOpen={categorySheetOpen}
                        setCategorySheetOpen={setCategorySheetOpen}
                        CategorySheet={CategorySheet}
                        costPrice={costPrice}
                        setCostPrice={setCostPrice}
                        standardPricing={standardPricing}
                        setStandardPricing={setStandardPricing}
                        quantities={quantities}
                        setQuantities={setQuantities}
                        errors={errors}
                        variants={variantCombinations}
                        branch={currentBranch.id}
                        productType={productType}
                      />
                    )}

                    {activeTab === "variants" && (
                      <div className="text-neutral-700 w-full p-6 mx-auto text-xs">
                        <h2 className="font-semibold mb-4">{productType === 'service' ? 'Quality Tiers (Variants)' : 'Variants'}</h2>
                        <VariantTable
                          combinations={variantCombinations}
                          costPrice={costPrice}
                          standardPricing={standardPricing}
                          updateValue={updateVariantValue}
                          productType={productType}
                          bulkThreshold={quantities.bulkThreshold}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end mr-14 gap-2 border-t border-neutral-500 px-7 py-3 bg-white">
                  <div className="flex gap-2">
                    <Button onClick={goToPreviousTab} disabled={activeTab === 'details'} variant={'outline'} className="px-3 h-7 py-2 rounded-sm border border-neutral-500 text-xs disabled:opacity-50 disabled:cursor-not-allowed">Back</Button>
                    {activeTab !== 'variants' ? (
                      <Button onClick={goToNextTab} variant={''} className="px-3 h-7 py-2 bg-army rounded-sm hover:bg-army/90 text-white text-xs">Next</Button>
                    ) : (
                      <Button onClick={handleSubmit} variant={''} className="px-3 h-7 py-2 bg-army rounded-sm hover:bg-army/90 text-white text-xs">Submit</Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <AlertDialogContent className="flex duration-100 bg-white flex-col gap-0 p-0 overflow-hidden justify-between w-11/12 md:w-[83%] max-w-[90%] md:max-w-[80%] h-5/6 md:h-[87%] rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle></AlertDialogTitle>
              <AlertDialogDescription>
                <span className='md:mx-5 py-1 font-semibold text-xs text-start'>Media files</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AddImage />
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Image Details</DialogTitle></DialogHeader>
            {selectedImage && (
              <div className="space-y-4">
                <img src={selectedImage.url} alt={selectedImage.name} className="w-full h-64 object-contain rounded" />
                <div><p className="text-sm font-medium">Name: {selectedImage.name}</p></div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    </DndProvider>
  )
}

export default CreateProductPage

// Custom Drag Layer for Preview Styling
function CombinationDragPreview() {
  const { item, isDragging, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getSourceClientOffset(),
  }));
  if (!isDragging || !currentOffset || !item) return null;
  return (
    <div style={{ position: 'fixed', pointerEvents: 'none', left: `${currentOffset.x}px`, top: `${currentOffset.y}px`, zIndex: 1000, transform: 'translate(-50%, -50%)' }}>
      <div className="border-2 border-green-500 bg-green-50 rounded p-2 shadow-lg">
        <div className="text-sm font-medium text-green-700">Dragging combination...</div>
      </div>
    </div>
  );
}

// Draggable Combination Component
function DraggableCombination({ combo, index, moveCombination, draggedIndex, onDragStart, onDragEnd, selectedImages, updateCombinationImages, onRemoveImage, onMoveImage }) {
  const ref = useRef(null);
  const [imageSheetOpen, setImageSheetOpen] = useState(false);
  const [comboImages, setComboImages] = useState(combo.images || []);

  const [{ isDragging }, drag] = useDrag({
    type: 'COMBINATION',
    item: () => { if (onDragEnd) onDragEnd(); return { index }; },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    end: () => { if (onDragEnd) setTimeout(() => onDragEnd(), 100); },
  });
  const [{ isOver }, drop] = useDrop({
    accept: 'COMBINATION',
    hover(item, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
      moveCombination(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });
  drag(drop(ref));
  let isCurrentlyDragged = draggedIndex === index || isDragging;

  const handleAddImage = (imageId) => {
    const image = selectedImages.find(img => img.id === imageId);
    if (image) {
      const newImageUrls = [...comboImages, image.url];
      setComboImages(newImageUrls);
      updateCombinationImages(index, newImageUrls);
    }
  };
  const handleRemoveComboImage = (imgIndex) => {
    const newImageUrls = comboImages.filter((_, i) => i !== imgIndex);
    setComboImages(newImageUrls);
    updateCombinationImages(index, newImageUrls);
  };

  return (
    <motion.div ref={ref} layout initial={{ opacity: 1 }} animate={{ opacity: isCurrentlyDragged ? 0.7 : 1 }} onPointerUp={() => { isCurrentlyDragged = ''; }} transition={{ duration: 0.2 }}
      className={`border border-neutral-500 rounded p-2 h-30 cursor-move bg-white transition-all duration-200 ${isCurrentlyDragged ? 'bg-core/20 shadow-lg ring-2 ring-core/40 scale-105' : ''} ${isOver ? 'border-core border-2 bg-core/5' : 'border border-neutral-500'}`}>
      <div className="flex items-center justify-between h-full gap-4">
        <div className="flex h-full items-center gap-2">
          <GripVertical className={`h-4 w-4 ${isCurrentlyDragged ? 'text-core' : 'text-muted-foreground'}`} />
          <div className="text-sm">{combo.combination.map((item, i) => (<div key={i}>{item.optionName}: {item.value}</div>))}</div>
        </div>
        <div className="flex grow justify-end gap-2 h-full items-center">
          {comboImages && comboImages.length > 0 ? (
            <div className="flex gap-1 h-full w-full justify-center items-center">
              {comboImages.slice(0, 3).map((imgUrl, idx) => (
                <div key={idx} className="relative h-full aspect-square group">
                  <img src={imgUrl} alt="variant" className="size-full rounded border border-neutral-500 object-cover" />
                  <button onClick={() => handleRemoveComboImage(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">×</button>
                </div>
              ))}
              {comboImages.length > 3 && <span className="text-xs text-gray-500">+{comboImages.length - 3}</span>}
            </div>
          ) : (
            <p className="text-center text-xs bg-amber-300 aspect-square rounded text-gray-500 italic px-2 py-1">---</p>
          )}
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setImageSheetOpen(true)}><Plus className="h-2.5 w-2.5 mr-1" /> Map image to variant</Button>
        </div>

        <Sheet open={imageSheetOpen} onOpenChange={setImageSheetOpen}>
          <SheetContent side="right" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-sm">Select Images for Variant</SheetTitle>
              <SheetDescription className="text-xs">{combo.combination.map((item, i) => (<span key={i} className="block">{item.optionName}: {item.value}</span>))}</SheetDescription>
            </SheetHeader>
            <div className="space-y-2 mt-4">
              {selectedImages && selectedImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {selectedImages.map((img) => (
                    <div key={img.id} className="relative cursor-pointer group border border-neutral-500 rounded hover:border-core transition-colors" onClick={() => { handleAddImage(img.id); setImageSheetOpen(false); }}>
                      <img src={img.url} alt="product" className="w-full h-24 object-cover rounded" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded flex items-center justify-center">
                        <Plus className="text-white h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (<p className="text-xs text-gray-500 text-center py-8">No images uploaded yet</p>)}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </motion.div>
  );
}

function CategorySheet({ branch, open, onOpenChange, onConfirm, initialSelected }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState(initialSelected || '')
  const [addingFor, setAddingFor] = useState(null)
  const [inlineName, setInlineName] = useState('')
  const [inlineSlug, setInlineSlug] = useState('')
  const [inlineDescription, setInlineDescription] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')

  const fetchCategories = async () => {
    if (!open) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('categories').select('*').eq('branch', branch)
      if (error || !data || data.length === 0) { toast.error('No categories found'); return }
      else setList(data)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function refreshCategories() {
    const r = toast.loading('Refreshing categories...')
    await fetchCategories()
    toast.dismiss(r)
    toast.success('Categories refreshed', { id: r })
  }

  useEffect(() => { fetchCategories() }, [open])

  const tree = buildCategoryTree(list)

  const render = (nodes, level = 0) => nodes.map(n => (
    <div key={n.id} style={{ marginLeft: `${level * 16}px` }} className="py-1">
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2 flex-1">
          <Checkbox checked={selected === n.id} onCheckedChange={(v) => { if (v) setSelected(n.id); else setSelected('') }} className="w-4 h-4" />
          <span className="text-sm">{n.name}</span>
        </label>
        <Button size="icon" variant="ghost" className="h-6 w-6 p-0" title="Add subcategory" onClick={() => { setAddingFor(addingFor === n.id ? null : n.id); setInlineName(''); setInlineSlug('') }}>
          <Plus className="size-3.5" />
        </Button>
      </div>
      {addingFor === n.id && (
        <div className="mt-2 ml-6 flex items-center gap-2">
          <Input autoFocus value={inlineName} onChange={(e) => { setInlineName(capitalize(e.target.value)); setInlineSlug(convertToSlug(e.target.value)) }} placeholder="name" className="h-7 px-2 w-44 text-sm rounded-sm border" />
          <Button size="icon" onClick={async () => {
            if (!inlineName) return
            try {
              const r = toast.loading(`Creating category under ${n.name}...`)
              const { error } = await supabase.from('categories').insert({ name: inlineName, parent: n.id, slug: inlineSlug || convertToSlug(inlineName), description: inlineDescription || '', branch }).select().single()
              if (error) throw error
              refreshCategories()
              setInlineName(''); setInlineSlug(''); setInlineDescription(''); setAddingFor(null)
              toast.dismiss(r); toast.success('Category created')
            } catch (err) { console.error(err); toast.error('Failed to create category') }
          }} disabled={!inlineName} className="h-7 w-7 p-0 bg-army"><Plus size={14} /></Button>
        </div>
      )}
      {n.children && render(n.children, level + 1)}
    </div>
  ))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Select Category</SheetTitle>
          <SheetDescription className={'text-xs text-core font-medium leading-tight'}>Categories define what the product is and where it belongs in the store. Create the single category that best describes this product.<br /><em>Example: Electronics → Phones → Smartphones</em><br /></SheetDescription>
        </SheetHeader>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="border-b py-3">
            <p className="text-sm font-medium mb-2">Add top-level category</p>
            <div className="flex items-center gap-2">
              <Input value={categoryName} onChange={(e) => { setCategoryName(capitalize(e.target.value)); setCategorySlug(convertToSlug(e.target.value)) }} placeholder="Category name" className="h-7 px-2 w-44 text-sm rounded-sm border" />
              <Button onClick={async () => {
                if (!categoryName) return
                setUploading(true)
                try {
                  const { error } = await supabase.from('categories').insert({ name: categoryName, parent: null, slug: categorySlug || convertToSlug(categoryName), description: categoryDescription || '', branch: branch }).select().single()
                  if (error) throw error
                  refreshCategories(); setCategoryName(''); setCategorySlug('')
                  toast.success('Category created')
                } catch (err) { console.error(err); toast.error('Failed to create category') } finally { setUploading(false) }
              }} disabled={!categoryName || uploading} className="h-7 text-xs bg-army">{uploading ? <><Spinner spinning={uploading} className="h-4 w-4" /> Creating</> : 'Create'}</Button>
            </div>
          </div>
          {loading ? <div className="text-sm">Loading...</div> : render(tree)}
        </div>
        <SheetFooter>
          <div className="flex w-full mb-4 justify-start gap-2">
            <Button className="h-7 bg-core hover:bg-core/80 text-xs" onClick={() => { const selNode = list.find(x => String(x.id) === String(selected)); onConfirm(selected, selNode?.name || ''); onOpenChange(false) }}>Confirm</Button>
            <SheetClose asChild><Button variant="outline" className="h-7 text-xs">Cancel</Button></SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

const DraggableImage = ({ img, index, moveImage, isFirst, onClick }) => {
  const ref = useRef(null);
  const [{ isDragging }, drag] = useDrag({
    type: 'image',
    item: { index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  const [, drop] = useDrop({
    accept: 'image',
    hover: (item) => { if (item.index !== index) { moveImage(item.index, index); item.index = index; } },
  });
  drag(drop(ref));
  return (
    <div ref={ref} className={`relative flex-none bg-gray-50 rounded-sm overflow-hidden border cursor-pointer ${isDragging ? 'opacity-50' : ''} ${isFirst ? 'w-32 h-32' : 'w-32 h-16'}`} onClick={onClick}>
      <img src={img.url} alt={img.name} className="w-full h-full object-contain" />
      <div className="absolute top-1 right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center text-white text-xs font-medium">{index + 1}</div>
    </div>
  );
};
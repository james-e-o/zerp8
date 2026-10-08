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
import { X, Plus, GripVertical, Upload, Pencil, FileText, Settings2, Layers3, ChevronDown } from "lucide-react"
import { toast } from 'sonner'
import { useRouter, useParams } from 'next/navigation'

import AddImage from "@/components/add-image";
import { VariantTable } from '@/components/variants';
import { ProductConfigurations } from "@/components/modules/products/product-configurations";
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
//                                               quantityIncrement, bulkThreshold }
//        (reorderLevel removed - inventory module owns reorder thresholds now)
//   - contextAdjustments / setContextAdjustments
//        { [contextId]: { mode: 'reduction'|'markup', adjustmentType: 'percentage'|'fixed', value } }
//        One entry per non-Standard active pricing context (Wholesale,
//        custom ones). Nothing is stored per-context unless a value is
//        set - this is resolved into a per-product pricing_rules
//        override row in handleSubmit, after the product's id exists.
// The Category sheet and Variants tab are unaffected and
// keep their existing shape.
//
// Removed entirely (per the Sept 2026 schema discussion):
//   - Shipping Profile (state, fetch, sheet) - now owned by the Shipping module.
//   - Return Policy (state, fetch, sheet) - now owned by Settings.
//   - Multi pricing-context selection/creation UI - a product only ever
//     needs a Standard price at creation time; Wholesale/custom contexts
//     are configured separately and resolved per invoice line.
//
// Oct 2026 update - products are now company-wide, not branch-owned:
//   - Currency is no longer collected from this form or sent to the RPC.
//     create_product_with_variants now derives cost currency from the
//     company's default_currency and selling currency from the branch's
//     base_currency itself. The `p_currency` argument is gone.
//   - companyCurrency (fetched below, read-only, for display only) is
//     passed down to ProductConfigurations so the Cost Price field can
//     show which currency that number is actually in.
//   - New optional `branchAlias` field: lets the creating branch set its
//     own display name for this product immediately (product_branch_aliases),
//     without affecting the canonical, company-wide title.
//
// Oct 2026 update #2 - Save to Draft / Select Draft, wired to the new
// product_drafts table (one JSONB `payload` column per draft, scoped to
// this branch). The payload is a direct snapshot of this page's OWN
// state variables - not a reshaped/RPC-shaped version of them - so
// saving is "gather these state values into an object" and loading is
// the same thing backwards ("call each setter with this object's
// values"). Nothing is transformed in either direction, which is also
// how the variant<->image mapping survives a save/load round trip for
// free: it already lives inside variantCombinations[].images (per
// combination), and that whole array is stored as-is.
//
// One real trap this ran into: there's a pre-existing effect below that
// calls resetAllInputs() whenever productType changes (so toggling
// Physical/Service clears stale fields for a NEW product). Loading a
// draft also sets productType, which would trigger that same reset and
// wipe out every other field this load just restored, in the same
// render pass. isLoadingDraftRef below is a one-shot flag that effect
// checks so it skips itself exactly once, only during a draft load.
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
  bulkThreshold: '', // default; each variant can override its own in the Variants tab
};

const DEFAULT_STANDARD_PRICING = {
  marginPercentage: '',
  marginValue: '',
  sellingPrice: '',
};

const ATTRIBUTE_PRESETS = [
  {
    name: 'Color',
    values: [
      'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple',
      'Pink', 'Brown', 'Gray', 'Navy', 'Teal', 'Turquoise', 'Gold', 'Silver',
      'Beige', 'Cream', 'Maroon', 'Olive', 'Lime', 'Coral', 'Violet', 'Indigo',
      'Magenta', 'Cyan', 'Burgundy', 'Mint', 'Lavender', 'Charcoal',
    ],
    swatches: [
      '#111827', '#FFFFFF', '#EF4444', '#3B82F6', '#22C55E', '#FACC15', '#F97316', '#A855F7',
      '#EC4899', '#92400E', '#9CA3AF', '#1E3A8A', '#0F766E', '#14B8A6', '#D4AF37', '#C0C0C0',
      '#D6C2A1', '#FFF7D6', '#800000', '#64743B', '#84CC16', '#FB7185', '#8B5CF6', '#4F46E5',
      '#D946EF', '#06B6D4', '#7F1D1D', '#6EE7B7', '#C4B5FD', '#374151',
    ],
  },
  { name: 'Size', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'One Size'] },
  { name: 'Country', values: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'China', 'India'] },
];

function getOptionValueLabel(value) {
  return typeof value === 'object' ? value.label : value;
}

function getColorSwatch(value) {
  const colorAttribute = ATTRIBUTE_PRESETS.find(attribute => attribute.name === 'Color');
  const colorIndex = colorAttribute.values.indexOf(getOptionValueLabel(value));
  return colorIndex >= 0 ? colorAttribute.swatches[colorIndex] : null;
}

function OptionValueDisplay({ attributeName, value, visualOnly = false }) {
  const label = getOptionValueLabel(value);
  const colorSwatch = attributeName.toLowerCase() === 'color' ? getColorSwatch(value) : null;
  const flag = attributeName.toLowerCase() === 'country' && typeof value === 'object' ? value.flag : null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {colorSwatch && (
        <span className="size-4 shrink-0 rounded-full border border-black/20" style={{ backgroundColor: colorSwatch }} />
      )}
      {flag && <img src={flag} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover" />}
      {!visualOnly && <span>{label}</span>}
    </span>
  );
}

// Label shown in the "Select draft" dropdown for one draft row.
function formatDraftLabel(draft) {
  const title = (draft?.title || '').trim();
  if (title) return title;
  const when = draft?.updated_at ? new Date(draft.updated_at) : null;
  return when ? `Untitled - ${when.toLocaleDateString()}` : 'Untitled draft';
}

const CreateProductPage = () => {
  const [activeTab, setActiveTab] = useState("details");
  const params = useParams();
  const router = useRouter();
  const { u, companyId, branchId } = params;
  const { currentBranch } = useContext(BranchContext);

  // Product state
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [attributeSheetOpen, setAttributeSheetOpen] = useState(false)
  const [attributeToEdit, setAttributeToEdit] = useState(null)
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

  // Pricing state - base cost + the single required Standard pricing context.
  // "costPrice" here is a cost ESTIMATE, not the final cost - it bootstraps
  // margin math at creation time. The RPC now routes it into
  // product_cost_estimates server-side (one company-wide row per variant)
  // instead of storing it on the variant itself; nothing about this state
  // variable, the payload key ("cost"), or this form's shape changes because
  // of that - this is reflected only in the UI copy (see ProductConfigurations
  // and VariantTable), so the real cost confirmed later via Purchases is
  // understood as updating this estimate, not contradicting a "final" number.
  const [costPrice, setCostPrice] = useState('');
  const [standardPricing, setStandardPricing] = useState(DEFAULT_STANDARD_PRICING);

  // Pricing contexts other than Standard (Reduction/Markup adjustments,
  // resolved into per-product pricing_rules override rows at submit time)
  const [contextAdjustments, setContextAdjustments] = useState({});

  // Quantity rules - maps to product_variants columns
  const [quantities, setQuantities] = useState(DEFAULT_QUANTITIES);

  // Company's default currency - read-only, display only. Products are
  // company-wide now, so cost price is always in this currency regardless
  // of which branch is creating the product. Fetched below; never sent
  // back to the RPC (it derives this itself, server-side).
  const [companyCurrency, setCompanyCurrency] = useState('');

  // Optional: this branch's own display name for the product, separate
  // from the canonical (company-wide) title. Written to
  // product_branch_aliases after the product is created.
  const [branchAlias, setBranchAlias] = useState('');

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

  // --- Save to Draft / Select Draft -------------------------------------
  // draftId: the product_drafts row currently being edited, if any - once
  // set, "Save as draft" updates that row instead of inserting a new one
  // each time. drafts: the list for the "Select draft" dropdown, fetched
  // on load and refreshed after every save. isLoadingDraftRef: see the
  // file-level comment above - prevents the productType-change effect
  // from wiping out a draft the moment it's loaded.
  const [draftId, setDraftId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const isLoadingDraftRef = useRef(false);

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
    return combinations.map((combo) => ({ combination: combo, id: combo.map(item => `${item.optionName}-${getOptionValueLabel(item.value)}`).join('-') }));
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
    setContextAdjustments({});
    setBranchAlias('');
    setErrors({});
    // A manual reset (the Reset button, or a real productType toggle) means
    // "start over" - any draft that was loaded is no longer what's on screen,
    // so stop treating further saves as updates to it.
    setDraftId(null);
  };

  // Skips the reset exactly once when a draft load is what changed
  // productType - see the file-level comment above.
  useEffect(() => {
    if (isLoadingDraftRef.current) {
      isLoadingDraftRef.current = false;
      return;
    }
    resetAllInputs();
  }, [productType]);

  useEffect(() => {
      const handler = (e) => {
        if (e?.detail && Array.isArray(e.detail)) {
          const incoming = e.detail || [];
          setSelectedImages(prev => {
            const merged = [...prev];
            incoming.forEach(img => {
              if (!merged.find(m => m.id === img.id)) {
                merged.push(img);
              }
            });
            return merged;
          });
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

  // Company's default currency - products are company-wide, so this is
  // looked up once via the branch's company and never changes per-branch.
  useEffect(() => {
    const fetchCompanyCurrency = async () => {
      if (!currentBranch?.company) return;
      const { data, error } = await supabase
        .from('companies')
        .select('default_currency')
        .eq('id', currentBranch.company)
        .maybeSingle();

      if (error) {
        console.error('Error fetching company currency:', error);
        return;
      }
      setCompanyCurrency(data?.default_currency || '');
    };

    fetchCompanyCurrency();
  }, [currentBranch?.company]);

  // Drafts list for the "Select draft" dropdown - all drafts belonging to
  // this branch, newest first. Re-fetched after every save so a freshly
  // saved draft shows up immediately, and after a successful product
  // submit (whose draft row gets deleted) so it drops out of the list.
  const fetchDrafts = useCallback(async () => {
    if (!currentBranch?.id) return;
    const { data, error } = await supabase
      .from('product_drafts')
      .select('id, title, updated_at')
      .eq('branch', currentBranch.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching drafts:', error);
      return;
    }
    setDrafts(data || []);
  }, [currentBranch?.id]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

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
    setOptions([...options, { id: Date.now(), name: '', values: [], Input: '', source: 'manual' }]);
    setJustAdded(true);
  };
  const importAttributes = (attributes) => {
    setOptions(prev => {
      const next = [...prev];
      attributes.forEach(attribute => {
        const existingIndex = next.findIndex(option => option.name.trim().toLowerCase() === attribute.name.toLowerCase());
        if (existingIndex === -1) {
          next.push({ id: `${Date.now()}-${attribute.name}`, name: attribute.name, values: attribute.values, Input: '', source: 'built-in' });
          return;
        }

        next[existingIndex] = {
          ...next[existingIndex],
          source: 'built-in',
          values: [...next[existingIndex].values, ...attribute.values].filter((value, index, values) =>
            values.findIndex(candidate => getOptionValueLabel(candidate) === getOptionValueLabel(value)) === index
          ),
        };
      });
      return next;
    });
    setHasVariants(true);
    setAttributeToEdit(null);
    setAttributeSheetOpen(false);
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
    else if (activeTab === 'configure') {
      productConfigRef.current?.commitEditingState?.();
      setActiveTab('variants');
    }
  };

  // Direct snapshot of this page's own state - see the file-level comment
  // above for why nothing here is reshaped before saving.
  const buildDraftPayload = () => ({
    title, subtitle, handle, description, brand, upc, mpn, ean, isbn,
    productType,
    dimensions, dimensionUnit, weight, weightUnit,
    branchAlias,
    selectedCategoryId, selectedCategoryName,
    hasVariants, options, variantCombinations, selectedImages,
    costPrice, standardPricing, contextAdjustments, quantities,
    serviceDuration, requiresStaff, selectedStaff,
  });

  const handleSaveDraft = async () => {
    if (!currentBranch?.id || !currentBranch?.company) {
      toast.error('Branch not ready yet - try again in a moment');
      return;
    }

    setSavingDraft(true);
    try {
      productConfigRef.current?.commitEditingState?.();
      const { data: { user } } = await supabase.auth.getUser();
      const payload = buildDraftPayload();
      const row = {
        company: currentBranch.company,
        branch: currentBranch.id,
        title: title.trim() || null,
        payload,
        updated_by: user?.id || null,
      };

      if (draftId) {
        const { error } = await supabase.from('product_drafts').update(row).eq('id', draftId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('product_drafts')
          .insert({ ...row, created_by: user?.id || null })
          .select('id')
          .single();
        if (error) throw error;
        setDraftId(data.id);
      }

      toast.success('Draft saved');
      fetchDrafts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSelectDraft = async (id) => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('product_drafts')
        .select('id, payload')
        .eq('id', id)
        .single();
      if (error) throw error;

      const p = data?.payload || {};

      // See the file-level comment above - this flag stops the
      // productType-change effect from firing resetAllInputs() right
      // after we restore everything below.
      isLoadingDraftRef.current = true;

      setDraftId(data.id);
      setTitle(p.title || '');
      setSubtitle(p.subtitle || '');
      setHandle(p.handle || '');
      setDescription(p.description || '');
      setBrand(p.brand || '');
      setUpc(p.upc || '');
      setMpn(p.mpn || '');
      setEan(p.ean || '');
      setIsbn(p.isbn || '');
      setProductType(p.productType || 'physical');
      setDimensions(p.dimensions || { length: '', width: '', height: '' });
      setDimensionUnit(p.dimensionUnit || 'cm');
      setWeight(p.weight || '');
      setWeightUnit(p.weightUnit || 'kg');
      setBranchAlias(p.branchAlias || '');
      setSelectedCategoryId(p.selectedCategoryId || '');
      setSelectedCategoryName(p.selectedCategoryName || '');
      setHasVariants(!!p.hasVariants);
      setOptions(p.options || []);
      setVariantCombinations(p.variantCombinations || []);
      setSelectedImages(p.selectedImages || []);
      setCostPrice(p.costPrice || '');
      setStandardPricing(p.standardPricing || DEFAULT_STANDARD_PRICING);
      setContextAdjustments(p.contextAdjustments || {});
      setQuantities(p.quantities || DEFAULT_QUANTITIES);
      setServiceDuration(p.serviceDuration || '');
      setRequiresStaff(p.requiresStaff ?? true);
      setSelectedStaff(p.selectedStaff || '');
      setErrors({});
      setActiveTab('details');

      // Belt-and-suspenders: if productType didn't actually change, the
      // effect above never fires at all, so the flag would otherwise sit
      // "true" until the next unrelated toggle and swallow that reset by
      // mistake. Clearing it on a microtask covers that case too.
      setTimeout(() => { isLoadingDraftRef.current = false; }, 0);

      toast.success('Draft loaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to load draft');
    }
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
        // variant_label is nullable but nothing else populates it - build it
        // here from the combination itself so it isn't silently lost.
        const variantLabel = variant.combination?.length > 0
          ? variant.combination.map(item => `${typeof item.value === 'object' ? item.value.label : item.value}`).join(' / ')
          : null;
        return {
          sku,
          variant_label: variantLabel,
          cost: parseFloat(variant.costPrice || costPrice) || 0,
          is_variant: variant.combination?.length > 0,
          is_active: true,
          // Default true unless a row was explicitly unchecked - mirrors
          // the read used for the checkboxes themselves in variants.jsx.
          is_tracked_inventory: variant.managed !== false,
          is_tracked_shop: variant.trackedInShop !== false,
          reserve: 0,
          // reorder_level removed - no longer collected on this form
          min_sale_quantity: parseInt(quantities.minSaleQuantity, 10) || 1,
          quantity_increment: parseInt(quantities.quantityIncrement, 10) || 1,
          // Per-variant override wins (set via the Variants tab); otherwise
          // fall back to the product-level default from Configurations.
          bulk_threshold: variant.bulkThreshold
            ? parseInt(variant.bulkThreshold, 10)
            : (quantities.bulkThreshold ? parseInt(quantities.bulkThreshold, 10) : null),
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
        // Currency is no longer sent from here - the RPC derives cost
        // currency from the company's default_currency and selling
        // currency from this branch's base_currency on its own.
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

        // Optional - this branch's own name for the product, separate from
        // the company-wide canonical title.
        p_branch_alias: branchAlias.trim() || null,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create product');

      const productId = data.product_id;

      // Step 2 - resolve contextAdjustments into per-product pricing_rules
      // override rows now that the product id exists. This is intentionally
      // a separate step from product creation: the product already exists
      // by the time this runs, so a failure here must never be reported as
      // "product creation failed" (that would risk the user re-submitting
      // and creating a duplicate product).
      const adjustmentEntries = Object.entries(contextAdjustments).filter(
        ([, adjustment]) => adjustment?.value !== undefined && adjustment?.value !== ''
      );

      if (adjustmentEntries.length > 0 && productId) {
        try {
          const overrideRows = adjustmentEntries.map(([contextId, adjustment]) => {
            const numericValue = parseFloat(adjustment.value) || 0;
            // Reduction stores the positive value as-is; Markup stores it negated.
            const actionValue = adjustment.mode === 'markup' ? -numericValue : numericValue;
            return {
              pricing_context: contextId,
              scope_type: 'product',
              scope_id: productId,
              condition_type: 'always',
              action_type: adjustment.adjustmentType,
              action_value: actionValue,
              // Product-scoped overrides must outrank the context's branch-wide
              // catch-all rule (created at priority 0) so the invoice engine
              // resolves to this row instead of the generic context rule.
              priority: 100,
            };
          });

          const { error: rulesError } = await supabase.from('pricing_rules').insert(overrideRows);
          if (rulesError) throw rulesError;
        } catch (rulesErr) {
          console.error(rulesErr);
          toast.warning('Product created, but one or more pricing overrides failed to save.');
        }
      }

      // Best-effort: the draft this product came from (if any) is now
      // redundant - clean it up so it doesn't linger in the drafts list
      // as a duplicate of a product that now actually exists. Never lets
      // a failure here look like the product creation itself failed.
      if (draftId) {
        supabase.from('product_drafts').delete().eq('id', draftId).then(({ error: deleteError }) => {
          if (deleteError) console.error('Failed to clean up draft after submit:', deleteError);
        });
      }

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
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-neutral-300 px-3 py-2 bg-white z-10 sm:px-6 sm:py-3">
                  <div className="flex min-w-0 items-center justify-self-start gap-1.5 sm:gap-2">
                    <Link href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/products`}><Button variant={'ghost'} className="text-white bg-red-500 h-7 hover:text-black text-xs">✕</Button></Link>
                    <Button onClick={resetAllInputs} variant={'outline'} className="px-2 py-1 h-7 text-[10px] rounded-sm text-neutral-600 border border-neutral-300">Reset</Button>
                  </div>

                    <div className="flex shrink-0 items-center justify-self-center gap-0.5 text-xs font-medium sm:gap-3">
                      <Button type="button" variant={'outline'} title="Details" aria-label="Details" onClick={() => setActiveTab("details")} className={`h-7 w-7 rounded-sm p-0 text-[11px] sm:h-6 sm:w-auto sm:px-2 sm:py-1 ${activeTab === "details" ? "bg-neutral-800 text-neutral-50" : "text-neutral-600"}`}>
                        <FileText className="size-4 sm:hidden" />
                        <span className="relative top-px hidden sm:inline">Details</span>
                      </Button>
                      <span aria-hidden="true" className="px-1 text-neutral-300 sm:px-0">|</span>
                      <Button type="button" variant={'outline'} title="Configurations" aria-label="Configurations" onClick={() => setActiveTab("configure")} className={`h-7 w-7 rounded-sm p-0 text-[11px] sm:h-6 sm:w-auto sm:px-2 sm:py-1 ${activeTab === "configure" ? "bg-neutral-800 text-neutral-50" : "text-neutral-600"}`}>
                        <Settings2 className="size-4 sm:hidden" />
                        <span className="relative top-px hidden sm:inline">Configurations</span>
                      </Button>
                      <span aria-hidden="true" className="px-1 text-neutral-300 sm:px-0">|</span>
                      <Button type="button" variant={'outline'} title={productType === 'service' ? 'Quality Tiers' : 'Variants'} aria-label={productType === 'service' ? 'Quality Tiers' : 'Variants'} onClick={() => setActiveTab("variants")} className={`h-7 w-7 rounded-sm p-0 text-[11px] sm:h-6 sm:w-auto sm:px-2 sm:py-1 ${activeTab === "variants" ? "bg-neutral-800 text-neutral-50" : "text-neutral-600"}`}>
                        <Layers3 className="size-4 sm:hidden" />
                        <span className="relative top-px hidden sm:inline">{productType === 'service' ? 'Quality Tiers' : 'Variants'}</span>
                      </Button>
                    </div>
                  <div className="relative shrink-0 justify-self-end">
                    <select
                      aria-label="Select draft"
                      value={draftId || ''}
                      onChange={(e) => handleSelectDraft(e.target.value)}
                      className="h-7 w-[104px] appearance-none rounded-sm border border-neutral-300 bg-white py-1 pl-2 pr-7 text-[10px] text-neutral-600 sm:w-32 sm:text-[11px]"
                    >
                      <option value="" disabled>Select draft</option>
                      {drafts.length === 0 && (
                        <option value="" disabled>No drafts yet</option>
                      )}
                      {drafts.map((d) => (
                        <option key={d.id} value={d.id}>{formatDraftLabel(d)}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-neutral-500" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pt-4">
                  <div className="space-y-10 text-xs text-neutral-900 pb-10">

                    {activeTab === "details" && (
                      <div className="space-y-10 max-w-5xl text-xs mx-auto p-3">
                        <div className="space-y-5">
                          <h2 className="font-semibold mx-1 mb-3">General</h2>

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

                          {/* Products are company-wide now - this handle must be unique
                              per company, not per branch. The alias below is this
                              branch's own optional display name for the product,
                              independent of the canonical title/handle above. */}
                          <div className="flex flex-col space-y-1" data-field="branchAlias">
                            <label className="text-xs font-medium">
                              Alias for this branch
                              <span className="text-neutral-400 ml-1">(Optional)</span>
                            </label>
                            <Input
                              className="border border-neutral-500 rounded-sm px-2 py-2 text-xs"
                              placeholder="How this branch should see this product's name (defaults to the title above)"
                              value={branchAlias}
                              onChange={({ target }) => setBranchAlias(target.value)}
                            />
                            <p className="text-[10px] text-neutral-500">
                              This product is shared across the whole company. Other branches can set
                              their own alias for it later without affecting the title above.
                            </p>
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
                                      <Button variant={'ghost'} className="flex flex-col h-fit items-center justify-center gap-0.5 rounded-sm bg-neutral-100 px-3 py-2 hover:bg-neutral-200">
                                        <span className="text-[11px] text-core_light">Add / Edit Images</span>
                                      </Button>
                                    </AlertDialogTrigger>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-24 flex flex-col items-center justify-center text-neutral-500">
                                  <AlertDialogTrigger asChild>
                                    <Button variant={'ghost'} className="flex flex-col h-fit items-center justify-center gap-0.5 rounded-sm bg-neutral-100 hover:bg-neutral-200">
                                      <span className="text-lg mb-1"><Upload className="text-core size-4" /></span>
                                      <span className="text-[11px] text-core">Click to Upload images</span>
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
                                        <Input type="text" autoFocus={justAdded} defaultValue={option.name} onInput={(e) => { e.target.value = e.target.value.toUpperCase(); updateOptionName(index, e.target.value); }} className="font-medium text-xs uppercase border-0 outline-0 flex-1" placeholder="Option name" />
                                        <div className="flex items-center gap-1">
                                          {option.source === 'built-in' && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              title={`Edit ${option.name}`}
                                              onClick={() => { setAttributeToEdit(option.name); setAttributeSheetOpen(true); }}
                                              className="h-6 w-6 p-0"
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                          )}
                                          <Button variant="ghost" size="sm" onClick={() => removeOption(index)} className="h-6 w-6 p-0"><X className="h-4 w-4" /></Button>
                                        </div>
                                      </div>
                                      <div className="px-4 py-3 space-y-2">
                                        <label className="text-[10px] italic ml-1 font-medium">Values</label>
                                        {option.source !== 'built-in' && !ATTRIBUTE_PRESETS.some(attribute => attribute.name.toLowerCase() === option.name.trim().toLowerCase()) && (
                                          <Input ref={(el) => InputRefs.current[index] = el} type="text" value={option.Input} onChange={(e) => updateOptionInput(index, e.target.value.toLowerCase())} onKeyDown={(e) => handleKeyDown(e, index)} className="w-full border-0 outline-0 mt-1 text-xs placeholder-neutral-400" placeholder={productType === 'service' ? 'e.g., fade, crew cut, taper or standard, deluxe, premium' : 'Add values...'} />
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                          {option.values.map((value, valIndex) => (
                                            <span key={valIndex} className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded-sm text-xs">
                                              <OptionValueDisplay attributeName={option.name} value={value} />
                                              <button onClick={() => removeValue(index, valIndex)} className="text-neutral-500 hover:text-neutral-700"><X className="h-3 w-3" /></button>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" className="border border-neutral-500 rounded-sm px-4 h-7 text-xs w-fit" onClick={() => { setAttributeToEdit(null); setAttributeSheetOpen(true); }}>Import Attribute</Button>
                                    <Button className="border border-neutral-500 rounded-sm px-4 text-neutral-800 h-7 bg-core_light text-xs hover:bg-core_light/85 w-fit" onClick={addOption}>Add Option</Button>
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
                        contextAdjustments={contextAdjustments}
                        setContextAdjustments={setContextAdjustments}
                        quantities={quantities}
                        setQuantities={setQuantities}
                        errors={errors}
                        variants={variantCombinations}
                        branch={currentBranch.id}
                        company={currentBranch.company}
                        branchCurrency={currentBranch.base_currency}
                        companyCurrency={companyCurrency}
                        productType={productType}
                      />
                    )}

                   {activeTab === "variants" && (
                      <div className="text-neutral-700 w-full p-3 mx-auto text-xs">
                        <h2 className="font-semibold mx-1 mb-3">{productType === 'service' ? 'Quality Tiers (Variants)' : 'Variants'}</h2>
                        <VariantTable
                          combinations={variantCombinations}
                          costPrice={costPrice}
                          standardPricing={standardPricing}
                          bulkThreshold={quantities.bulkThreshold}
                          updateValue={updateVariantValue}
                          productType={productType}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-neutral-500 bg-white px-3 py-3 sm:px-7">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={''}
                      onClick={handleSaveDraft}
                      disabled={savingDraft}
                      className="px-3 h-7 py-2 rounded-sm border border-blue-500 bg-blue-500 text-xs text-white hover:bg-blue-600 disabled:opacity-60"
                    >
                      {savingDraft ? 'Saving...' : 'Save as draft'}
                    </Button>
                    <Button onClick={goToPreviousTab} disabled={activeTab === 'details'} variant={'outline'} className="px-3 h-7 py-2 rounded-sm border border-neutral-500 text-xs disabled:opacity-50 disabled:cursor-not-allowed">Back</Button>
                    {activeTab !== 'variants' ? (
                      <Button onClick={goToNextTab} variant={''} className="px-3 h-7 py-2 bg-core rounded-sm hover:bg-core/90 text-white text-xs">Next</Button>
                    ) : (
                      <Button onClick={handleSubmit} variant={''} className="px-3 h-7 py-2 bg-core_light rounded-sm hover:bg-core_light/90 text-neutral-800 text-xs">Submit</Button>
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

        <AttributeImportSheet
          open={attributeSheetOpen}
          onOpenChange={setAttributeSheetOpen}
          existingOptions={options}
          initialAttributeName={attributeToEdit}
          onImport={importAttributes}
        />
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

function AttributeImportSheet({ open, onOpenChange, existingOptions, initialAttributeName, onImport }) {
  const [activeAttribute, setActiveAttribute] = useState(null);
  const [selectedValues, setSelectedValues] = useState({});
  const [countryOptions, setCountryOptions] = useState(
    ATTRIBUTE_PRESETS.find(attribute => attribute.name === 'Country').values.map(name => ({ name }))
  );

  useEffect(() => {
    if (!open) return;

    setActiveAttribute(
      initialAttributeName
        ? ATTRIBUTE_PRESETS.find(attribute => attribute.name.toLowerCase() === initialAttributeName.trim().toLowerCase()) || null
        : null
    );
    setSelectedValues(Object.fromEntries(
      ATTRIBUTE_PRESETS.map(attribute => {
        const existing = existingOptions.find(option => option.name.trim().toLowerCase() === attribute.name.toLowerCase());
        return [attribute.name, (existing?.values || []).map(value => getOptionValueLabel(value))];
      })
    ));

    const loadCountries = async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('name, code, flag')
        .order('name', { ascending: true });

      if (!error && data?.length) {
        setCountryOptions(data.map(country => ({
          name: country.name,
          code: country.code,
          flag: country.flag,
        })));
      }
    };

    loadCountries();
  }, [open, existingOptions, initialAttributeName]);

  const toggleValue = (attributeName, value) => {
    setSelectedValues(prev => {
      const values = prev[attributeName] || [];
      return {
        ...prev,
        [attributeName]: values.includes(value)
          ? values.filter(selectedValue => selectedValue !== value)
          : [...values, value],
      };
    });
  };

  const handleImport = () => {
    const attributes = ATTRIBUTE_PRESETS
      .map(attribute => ({
        ...attribute,
        values: attribute.name === 'Country'
          ? (selectedValues.Country || []).map(value => {
            const country = countryOptions.find(option => option.name === value);
            return country?.flag ? { label: value, flag: country.flag } : value;
          })
          : (selectedValues[attribute.name] || []),
      }))
      .filter(attribute => attribute.values.length > 0)
      .map(({ swatches, ...attribute }) => attribute);

    if (attributes.length === 0) {
      toast.error('Select at least one attribute value');
      return;
    }

    onImport(attributes);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{activeAttribute ? `Select ${activeAttribute.name} values` : 'Import Attributes'}</SheetTitle>
          <SheetDescription className="text-xs">
            {activeAttribute
              ? 'Choose the values you want to use for this product variant.'
              : 'Choose an attribute to select its values.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {!activeAttribute ? (
            <div className="space-y-2">
              <p className="text-xs font-medium">Built-in attributes</p>
              {ATTRIBUTE_PRESETS.map(attribute => {
                const count = selectedValues[attribute.name]?.length || 0;
                return (
                  <button
                    key={attribute.name}
                    type="button"
                    onClick={() => setActiveAttribute(attribute)}
                    className="flex w-full items-center justify-between rounded-sm border border-neutral-300 p-3 text-left text-xs font-medium hover:border-core hover:bg-muted/40"
                  >
                    <span>{attribute.name}</span>
                    {count > 0 && <span className="text-[10px] text-core">{count} selected</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <Button type="button" variant="ghost" className="h-7 px-0 text-xs" onClick={() => setActiveAttribute(null)}>
                Back to attributes
              </Button>
              <div className="grid grid-cols-2 gap-2">
                {(activeAttribute.name === 'Country' ? countryOptions : activeAttribute.values).map((item, index) => {
                  const value = typeof item === 'string' ? item : item.name;
                  const selected = selectedValues[activeAttribute.name]?.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleValue(activeAttribute.name, value)}
                      className={`flex items-center gap-2 rounded-sm border p-2 text-left text-xs transition-colors ${selected ? 'border-core bg-core/10 ring-1 ring-core' : 'border-neutral-300 hover:border-core'}`}
                    >
                      {activeAttribute.name === 'Color' && (
                        <span
                          className="size-5 shrink-0 rounded-full border border-black/20"
                          style={{ backgroundColor: activeAttribute.swatches[index] }}
                        />
                      )}
                      {activeAttribute.name === 'Country' && item.flag && (
                        <img
                          src={item.flag}
                          alt=""
                          className="h-4 w-6 shrink-0 rounded-sm object-cover"
                        />
                      )}
                      <span>{value}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <SheetFooter>
          <div className="flex w-full justify-start gap-2 px-4 pb-4">
            {activeAttribute ? (
              <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setActiveAttribute(null)}>Done</Button>
            ) : (
              <Button className="h-8 bg-core text-xs hover:bg-core/85" onClick={handleImport}>Import Attributes</Button>
            )}
            <SheetClose asChild>
              <Button variant="outline" className="h-8 text-xs">Cancel</Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
          <div className="text-sm">
            {combo.combination.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span>{item.optionName.toUpperCase()}:</span>
                <OptionValueDisplay
                  attributeName={item.optionName}
                  value={item.value}
                  visualOnly={['color', 'country'].includes(item.optionName.toLowerCase())}
                />
              </div>
            ))}
          </div>
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
              <SheetDescription className="text-xs">{combo.combination.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span>{item.optionName.toUpperCase()}:</span>
                  <OptionValueDisplay attributeName={item.optionName} value={item.value} />
                </span>
              ))}</SheetDescription>
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

function CategorySheet({ branch, company, open, onOpenChange, onConfirm, initialSelected }) {
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
              const { error } = await supabase.from('categories').insert({ name: inlineName, parent: n.id, slug: inlineSlug || convertToSlug(inlineName), description: inlineDescription || '', branch, company }).select().single()
              if (error) throw error
              refreshCategories()
              setInlineName(''); setInlineSlug(''); setInlineDescription(''); setAddingFor(null)
              toast.dismiss(r); toast.success('Category created')
            } catch (err) { console.error(err); toast.error('Failed to create category') }
          }} disabled={!inlineName} className="h-7 w-7 p-0 bg-core_light text-neutral-800"><Plus size={14} /></Button>
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
                  const { error } = await supabase.from('categories').insert({ name: categoryName, parent: null, slug: categorySlug || convertToSlug(categoryName), description: categoryDescription || '', branch, company }).select().single()
                  if (error) throw error
                  refreshCategories(); setCategoryName(''); setCategorySlug('')
                  toast.success('Category created')
                } catch (err) { console.error(err); toast.error('Failed to create category') } finally { setUploading(false) }
              }} disabled={!categoryName || uploading} className="h-7 text-xs bg-core_light text-neutral-800">{uploading ? <><Spinner spinning={uploading} className="h-4 w-4" /> Creating</> : 'Create'}</Button>
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
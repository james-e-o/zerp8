"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { Plus, Trash2, Loader2, Check, Pencil, Rocket } from "lucide-react"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { motion, AnimatePresence } from "framer-motion"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu"
import supabase from "@/config/supabaseClient"
import { uploadImagesToSupabase } from '@/lib/supabaseUpload'
import { Switch } from "@/components/ui/switch";
import { ca, se, sl } from "date-fns/locale"

// ======================================================================
//  Category Table Component (JSX)
// ======================================================================

    function buildCategoryTree(categories) {
      const categoryMap = {};
      const idMap = {};
      const nameMap = {};
      const roots = [];
      categories.forEach(cat => {
        categoryMap[cat.id] = { ...cat, children: [] };
        idMap[String(cat.id)] = cat;
        if (cat.name) nameMap[String(cat.name)] = cat;
      });
      categories.forEach(cat => {
        const parentRaw = cat.parent;
        if (parentRaw) {
          // parent may be an id or a name; resolve
          const parentCat = idMap[String(parentRaw)] || nameMap[String(parentRaw)];
          if (parentCat && categoryMap[parentCat.id]) {
            categoryMap[parentCat.id].children.push(categoryMap[cat.id]);
            return;
          }
        }
        roots.push(categoryMap[cat.id]);
      });
      return roots;
    }

    
    

export default function CategoryTable() {
      const router = useRouter();
      const searchParams = useSearchParams();
      const params = useParams();
      const toastShownRef = useRef(false);
      const { branchId } = params;

      // Form states
      // compact top inline form visibility
      const [showTopInline, setShowTopInline] = useState(false)
   
      const [collectionList, setCollectionList] = useState([])
      const [selectedCollectionId, setSelectedCollectionId] = useState(null)
      const [showCollectionInline, setShowCollectionInline] = useState(false)
      const [newCollectionName, setNewCollectionName] = useState('')
      const [newCollectionSlug, setNewCollectionSlug] = useState('')
      const [newCollectionDescription, setNewCollectionDescription] = useState('')
      const [deleteCollectionDialogOpen, setDeleteCollectionDialogOpen] = useState(false)
      const [deleteCollectionTarget, setDeleteCollectionTarget] = useState(null)
      const [collectionDeleting, setCollectionDeleting] = useState(false)

      // header add-category form state
      const [categoryName, setCategoryName] = useState('')
      const [categorySlug, setCategorySlug] = useState('')
      const [categoryParent, setCategoryParent] = useState('')
      const [categoryDescription, setCategoryDescription] = useState('')
      const [categoryUploading, setCategoryUploading] = useState(false)
      const [flatCategories, setFlatCategories] = useState([])
      const [isLoading, setIsLoading] = useState(false)

      function slugify(input){
        return input.toString().toLowerCase().replace(/['"]/g, '').trim().replace(/\band\b/g, '&').replace(/[^a-z0-9\&-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').replace(/&/g, 'and')
      }
      function capitalize(input) {
        let newValue = input.toString().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ').replace(/\bAnd\b/g, '&')
        return newValue
      }


      const fetchData = async () => {
            setIsLoading(true)

            try {
              const [
                 {data: categoriesRes, error: categoriesError},
                 {data: collectionsRes, error: collectionsError},
              ] = await Promise.all([
                supabase.from('categories').select('*').eq('branch', branchId),
                supabase.from('collections').select('*').eq('branch', branchId),
              ])

              // 🔹 Categories
              if (categoriesError) {
                console.error(categoriesError)
                toast.error('Failed to load categories')
              } else {
                console.log('Fetched categories:', categoriesRes)
                setFlatCategories(categoriesRes || [])
              }

              // 🔹 Collections → collectionList
              if (collectionsError) {
                console.error(collectionsError)
                toast.error('Failed to load collections')
              } else {
                setCollectionList(collectionsRes || [])
              }

            } catch (e) {
              console.error(e)
              toast.error('Unexpected error occurred')
            } finally {
              setIsLoading(false)
            }
      }

      async function refreshCategories(){
        const r = toast.loading('Refreshing categories...')
        await fetchData()
        toast.dismiss(r)
        toast.success('Categories refreshed', { id: r })
        // return refreshdata
      }

      async function createCollection(){
        if(!newCollectionName || !newCollectionSlug) return
        setIsLoading(true)
         const t = toast.loading('Checking for existing collection...')
        try{
          // check existing slug

          const { data: existing, error: existingErr } = await supabase.from('collections').select('id').eq('slug', newCollectionSlug).limit(1)
          if (existingErr) {
            toast.dismiss(t); toast.error('Failed to check existing collection'); setIsLoading(false);throw existingErr
          }
          if (existing && existing.length>0){toast.dismiss(t); toast.error('Collection slug already exists'); setIsLoading(false); return }

          toast.dismiss(t)
          const l = toast.loading('Creating collection...')
          const insertObj = { name: newCollectionName, slug: newCollectionSlug, description: newCollectionDescription || '',  branch: branch, active: true }
          const { data, error } = await supabase.from('collections').insert(insertObj).select().single()
          if (error) throw error
          fetchData()
          setNewCollectionName('')
          setNewCollectionSlug('')
          setNewCollectionDescription('')
          setShowCollectionInline(false)
          toast.dismiss(l)
          toast.success('Collection created')
        }catch(err){ console.error(err);toast.dismiss(l); toast.error('Failed to create collection') }
        finally{ setIsLoading(false) }
      }

      async function deleteCollection(id){
        if(!id) return
        setCollectionDeleting(true)
        try{
          const { error } = await supabase.from('collections').delete().eq('id', id)
          if (error) throw error
          await fetchData()
          toast.success('Collection deleted')
        }catch(err){ console.error(err); toast.error('Failed to delete collection') }
        finally{ setCollectionDeleting(false); setDeleteCollectionDialogOpen(false); setDeleteCollectionTarget(null) }
      }
      
      async function createTopCategory(){
        if(!categoryName || !categorySlug) return
        setCategoryUploading(true)
        setIsLoading(true)
          const slug = categorySlug || slugify(categoryName)
          // show checking toast
          const t = toast.loading('Checking for existing category...')
        try{

          // check existing slug
          const { data: existing, error: existingErr } = await supabase.from('categories').select('id').eq('slug', slug).limit(1)
            if (existingErr) {
              console.error(existingErr)
              toast.error('Failed to check existing category', { id: t })
              setIsLoading(false)
              return
            }
            if (existing && existing.length > 0) {
              toast.error('Category already exists', { id: t })
              setIsLoading(false)
              return
            }
            // slug available
            toast.dismiss(t)
            const l = toast.loading('Creating category...')

          const { data, error } = await supabase.from('categories').insert({ name: categoryName, parent: null , slug: categorySlug, description: categoryDescription ,branch: branch}).select().single()
          if (error) {
            toast(error)
            throw error
          }
          // notify Categories to refresh
          refreshCategories()
          window.dispatchEvent(new CustomEvent('categories:refresh'))
          setCategoryName('')
          setCategorySlug('')
          setCategoryParent('')
          setCategoryDescription('')
          // close compact top inline if open
          setShowTopInline(false)
          toast.dismiss(l)
          toast.success('Category created')
        }catch(err){
          console.error(err)
          toast.dismiss(l)
          toast.error('Failed to create category')
        }finally{ setCategoryUploading(false) }
      }

      

      
      useEffect(()=>{
        fetchData()
      },[])

      return (
        <Tabs defaultValue="categories" className="w-full flex-col font-WixMade flex  h-full overflow-hidden">
          <div className="h-fit">
            <TabsList className="grid w-fit gap-5 grid-cols-2">
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="collections">Collections</TabsTrigger>
              {/* <TabsTrigger value="tags">Tags</TabsTrigger> */}
            </TabsList>
          </div>
          <div className="mt-2 grow overflow-hidden ">
              <TabsContent value="categories" className="space-y-4 overflow-hidden h-full">
                {/* Categories Section */}
                <div className="border rounded-md bg-white flex flex-col h-full overflow-hidden dark:bg-neutral-900">
                  <div>
                      <div className="p-4 border-b">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold">Categories</h3>
                          <Button size="sm" className="h-7 inline-flex items-center bg-core hover:bg-core/85 gap-2" onClick={() => { setShowTopInline(v => !v); setCategoryName(''); setCategorySlug('') }}>
                            <Plus size={14} />
                            <span className="text-xs">Add Category</span>
                          </Button>

                        </div>
                        {/* Add Category control moved below the category tree */}
                      
                      </div>

                      <div className="p-4 border-b">
                        <div className="flex items-center gap-2">
                        
                          {showTopInline && (
                            <div className="flex items-center gap-2">
                              <Label>Top level category:</Label>
                              <Input autoFocus value={categoryName} onChange={(e)=>{ setCategoryName(capitalize(e.target.value)); setCategorySlug(slugify(e.target.value)) }} placeholder="Category name" className="h-7 px-2 w-44 text-sm rounded-sm border" />
                              <Button size="icon" onClick={createTopCategory} className="h-7 w-7 p-0 bg-army" disabled={categoryUploading || !categoryName}>
                                <Rocket size={14} />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                  </div>
                  <Categories refresh={refreshCategories} isLoading={isLoading} categoryList={flatCategories}/>
                </div>
              </TabsContent>

              {/* COLLECTIONS */}
              <TabsContent value="collections" className="space-y-4 overflow-hidden h-full">
                <div className="border rounded-md flex flex-col h-full overflow-hidden bg-white dark:bg-neutral-900">
                  <div>
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Collections</h3>
                    <Button onClick={() => { setShowCollectionInline(v=>!v); setNewCollectionName(''); setNewCollectionSlug('') }} className="h-7 inline-flex items-center bg-core hover:bg-core/85 gap-2">
                      <Plus size={14} />
                      <span className="text-xs">Add Collection</span>
                    </Button>
                  </div>
                  <div className="p-4 border-b">
                        <div className="flex items-center gap-2">
                          {showCollectionInline && (
                            <div className=" flex items-center gap-2">
                              <Input autoFocus value={newCollectionName} onChange={(e)=>{ setNewCollectionName(capitalize(e.target.value)); setNewCollectionSlug(slugify(e.target.value)) }} placeholder="Collection name" className="h-7 px-2 w-44 text-sm rounded-sm border" />
                              <Button size="icon" onClick={createCollection} disabled={!newCollectionName} className="h-7 w-7 p-0 bg-army">
                                <Rocket size={14} />
                              </Button>
                            </div>
                          )}
                        </div>
                  </div>
                  </div>

                  <div className="flex grow overflow-hidden ">
                    <div className="flex-1 h-full overflow-y-scroll p-6">
                      <div className="space-y-2">
                        {collectionList.length ? collectionList.map(col => (
                          <div key={col.id} className={`py-2 flex items-center justify-between ${String(selectedCollectionId) === String(col.id) ? 'font-semibold text-core' : 'text-sm text-zinc-700'}`}>
                            <div className="cursor-pointer" onClick={() => setSelectedCollectionId(col.id)}>{col.name}</div>
                            <div className="inline-flex items-center gap-2 bg-armylight p-[3px] rounded-sm h-5 border border-core/20">
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Delete collection"
                                aria-label="Delete collection"
                                onClick={(e) => { e.stopPropagation(); setDeleteCollectionTarget({ id: col.id, name: col.name }); setDeleteCollectionDialogOpen(true) }}
                                className="h-5 w-5 p-0"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        )) : (<div className="text-sm text-gray-500">No collections available</div>)}
                      </div>

                    </div>
                    
                    <div className="w-72 border-l p-4">
                      <p className="text-xs font-semibold text-army">
                         Collections group products together for display, promotions, or campaigns (for example: New Arrivals, Best Sellers, Back to School).
                      </p>
                        
                      {selectedCollectionId ? (
                        (() => {
                          const col = (collectionList.find(c => String(c.id) === String(selectedCollectionId)) || { name: '', description: '' })
                          return (
                            <CollectionDetails selected={col} refresh={fetchData} />
                          )
                        })()
                      ) : (
                        <div className="text-sm text-gray-500">Select a collection to see details</div>
                      )}
                    </div>
                    
                    {/* Collections delete confirmation dialog */}
                    <AlertDialog open={deleteCollectionDialogOpen} onOpenChange={setDeleteCollectionDialogOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete collection</AlertDialogTitle>
                          <AlertDialogDescription>Are you sure you want to delete "{deleteCollectionTarget?.name}"? This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="h-7">Cancel</AlertDialogCancel>
                          <AlertDialogAction className="h-7 bg-red-600 text-white" onClick={async ()=>{ if(!deleteCollectionTarget) return; await deleteCollection(deleteCollectionTarget.id); }}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </TabsContent>

          </div>

        </Tabs>
      )
    }

    const Categories = ({refresh,isLoading,categoryList}) => {
          const [ setCategoryList] = useState([])
          const [category, setCategory] = useState('')
          const [selectedCategory, setSelectedCategory] = useState('')

          const categoryTree = buildCategoryTree(categoryList);

          const selected = categoryList.find(c => String(c.id) === String(selectedCategory))
          const parentCategory = selected?.parent
            ? categoryList.find(c => String(c.id) === String(selected.parent))
            : null

          const parentName = parentCategory?.name || ''

          return (
            <div className="grow overflow-hidden">
              {categoryList.length ? (
                <div className="flex justify-between gap-6 h-full pb-8 overflow-hidden">
                  <div className="flex-1 h-full overflow-y-scroll px-6 ml-6">
                    <CheckboxTree
                      categoryList={categoryList}
                      setCategoryList={setCategoryList}
                      handleCheckboxChange={(id) => { setSelectedCategory(id) }}
                      checked={selectedCategory}
                      categories={categoryTree}
                      refresh={refresh}
                    />
                  </div>
                  <div className="w-72 border-l p-4">
                    <p className="text-xs font-semibold text-army">
                          Categories define what the product is and where it belongs in the store. Create categories that best describes your products.<br />
                          <em>Example: Electronics → Phones → Smartphones</em><br />
                        </p>
                    {selected ? (
                      <CategoryDetails  selected={selected} refresh={refresh}  parentName={parentName}/>
                    ) : (
                      <div className="text-sm text-gray-500">Select a category to see details</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="h-12 flex justify-center items-center text-center">{isLoading ? "Loading..." : "No results."}</p>
              )}
            </div>
          )
    }

  const CheckboxTree = ({ categories, handleCheckboxChange, checked,refresh }) => {
      const params = useParams()
      const [subCategoryName, setSubCategoryName] = useState('')
        const [subCategorySlug, setSubCategorySlug] = useState('')
        const [subCategoryDescription, setSubCategoryDescription] = useState('')
        const [subCategoryParent, setSubCategoryParent] = useState('')
        const [uploading, setUploading] = useState(false)
        const [deleting, setDeleting] = useState(false)
        const [addingFor, setAddingFor] = useState(null)
        const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
        const [deleteTarget, setDeleteTarget] = useState(null)

        function convertToSlug(input) {
          let newValue = input.toString().toLowerCase().replace(/['"]/g, '').trim().replace(/\band\b/g, '&').replace(/[^a-z0-9\&-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').replace(/&/g, 'and')
          return newValue
        }
        function capitalize(input) {
          let newValue = input.toString().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ').replace(/\bAnd\b/g, '&')
          return newValue
        }

        async function createCategory(parentId) {
          if (!subCategoryName) return
          setUploading(true)
          const slug = subCategorySlug || convertToSlug(subCategoryName)
          // show checking toast
          const t = toast.loading('Checking for existing category...')
          try{
            const { data: existing, error: existingErr } = await supabase.from('categories').select('id').eq('slug', slug).limit(1)
            if (existingErr) {
              console.error(existingErr)
              toast.error('Failed to check existing category', { id: t })
              setUploading(false)
              return
            }
            if (existing && existing.length > 0) {
              toast.error('Category already exists', { id: t })
              setUploading(false)
              return
            }
            // slug available
            toast.dismiss(t)
            const branchId = params?.branch || null
            const insertObj = { name: subCategoryName, slug, parent: parentId ? parentId : null, description: '', branch: branchId }
            const { data, error } = await supabase.from('categories').insert(insertObj).select().single()
            if (error) {
              console.error(error)
              toast.error('Failed to create category')
              setUploading(false)
              return
            }
            // notify Categories to refresh
            refresh()
            window.dispatchEvent(new CustomEvent('categories:refresh'))
            setSubCategoryName('')
            setSubCategorySlug('')
            setAddingFor(null)
            toast.success('Category created')
          }catch(err){ console.error(err); toast.error('Failed to create category') }
          finally{ setUploading(false) }
        }

        function blurOut() {
          console.log(subCategoryName, slug)
          // setsubCategoryName('')
          // setSlug('')
        }
        
        const renderCategories = (categories, level = 0) => {
          return categories.map((category) => (
            <div key={category.id} style={{ marginLeft: `${level * 28}px`, marginTop: '13px', marginBottom: '13px' }}>
                <div className="inline-flex items-center gap-3 text-sm">
                  <span onClick={() => handleCheckboxChange(category.id)} className={`mx-2 cursor-pointer ${String(checked) === String(category.id) ? 'font-semibold text-core' : ''}`}>{category.name}</span>
                  <div className="relative inline-flex items-center gap-2 bg-armylight dark:bg-red-800/10 p-[3px] rounded-sm h-5 border border-core/20">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Add subcategory"
                      aria-label="Add subcategory"
                      onClick={() => { setAddingFor(addingFor === category.id ? null : category.id); setSubCategoryName(''),setSubCategorySlug('') }}
                      className="h-5 w-5 p-0"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Delete category"
                      aria-label="Delete category"
                      onClick={() => { setDeleteTarget({ id: category.id, name: category.name }); setDeleteDialogOpen(true) }}
                      className="h-5 w-5 p-0"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>

                    {addingFor === category.id && (
                      <div className="absolute left-full ml-2 flex items-center gap-1">
                        <Input autoFocus value={subCategoryName} onChange={({target})=>{setSubCategoryName(capitalize(target.value)),setSubCategorySlug(convertToSlug(target.value))}} onBlur={()=>{ if(subCategoryName==='') setAddingFor(null)}} placeholder="name" className="h-6 px-2 w-36 text-sm rounded-sm border" />
                        <Button size="icon" onClick={() => {createCategory(category.id) }} disabled={!subCategoryName||uploading} className="h-6 w-7 bg-army p-0">
                          <Rocket size={12} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              {category.children && renderCategories(category.children, level + 1)}
            </div>
          ));
    };

          // remove a category and its descendants from the flat list


          async function deleteCategory(id){
          (async ()=>{
            try{
              setDeleting(true)
              // collect all descendant ids (including the root id)
              const toDelete = new Set()
              const queue = [id]
              while(queue.length){
                const current = queue.shift()
                toDelete.add(current)
                const { data: children, error: childErr } = await supabase.from('categories').select('id').eq('parent', current)
                if (childErr) throw childErr
                if (children && children.length){
                  children.forEach(c => { if (c && c.id) queue.push(c.id) })
                }
              }
              const ids = Array.from(toDelete)
              const { error } = await supabase.from('categories').delete().in('id', ids)
              if (error) throw error
              window.dispatchEvent(new CustomEvent('categories:refresh'))
              toast.success(`Deleted ${ids.length} category(ies)`)
              refresh()
            }catch(err){ console.error(err); toast.error('Failed to delete category') }
            finally{ setDeleting(false) }
          })()
          }
          
        return (
          <>
            <div className="-ml-4 pb-20 pt4">{renderCategories(categories)}</div>

            {/* Delete confirmation dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete category</AlertDialogTitle>
                  <AlertDialogDescription>Are you sure you want to delete "{deleteTarget?.name}"? This will also delete any subcategories that have this category as their parent. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-7">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="h-7 bg-red-600 text-white" onClick={async ()=>{ if(!deleteTarget) return; await deleteCategory(deleteTarget.id); setDeleteDialogOpen(false); setDeleteTarget(null)}}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        );
}

function CategoryDetails({ selected,parentName, refresh,children }) {
      const [editing, setEditing] = useState(false)
      const [name, setName] = useState(selected.name)
      const [slug, setSlug] = useState(selected.slug || '')
      const [description, setDescription] = useState(selected.description || '')
      const [parentDisplayName, setParentDisplayName] = useState(parentName)
      const [saving, setSaving] = useState(false)
      const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
      const [pendingUpdates, setPendingUpdates] = useState(null)

      function slugify(input){
        return input.toString().toLowerCase().replace(/['"]/g, '').trim().replace(/\band\b/g, '&').replace(/[^a-z0-9\&-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').replace(/&/g, 'and')
      }
      function capitalize(input) {
        let newValue = input.toString().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ').replace(/\bAnd\b/g, '&')
        return newValue
      }

      useEffect(()=>{
        setName(selected.name)
        setSlug(selected.slug || '')
        setDescription(selected.description || '')
        setParentDisplayName(parentName)
      },[selected,parentName])

      return (
        <div>
          <div>{children}</div>
          <div className="flex my-1.5 items-center justify-between">
            <h4 className="text-sm font-semibold">Details</h4>
            <Button size="icon" variant="ghost" onClick={() => setEditing(v=>!v)} className="h-6 w-6 p-0"><Pencil size={14} /></Button>
          </div>
          {!editing ? (
            <div className="space-y-2 mt-3">
              <div className="text-sm font-medium">{selected.name}</div>
              <div className="text-[13px] text-muted-foreground">Slug: {selected.slug || '-'}</div>
              <div className="text-[13px] text-muted-foreground">Parent: {parentName || 'None'}</div>
              
              <div className="pt-2 italic text-xs">description: {selected.description || 'No description provided.'}</div>
            </div>
          ) : (
            <div className="space-y-2 mt-3">
              <div className="flex gap-2">
                <Label>Name:</Label>
                <Input placeholder="Name" value={name} onChange={e=>{setName(capitalize(e.target.value)),setSlug(slugify(e.target.value))}} className="w-full mt-1 px-2 py-1 border h-7 rounded-sm text-sm" />
              </div>
              <div className="flex gap-2">
                <Label>Slug:</Label>
                <Input readOnly placeholder="Slug" value={slug} onChange={e=>setSlug(slugify(e.target.value))} className="w-full mt-1 px-2 py-1 border h-7 rounded-sm text-sm" />
              </div>              
              <div className="flex gap-2">
                <Label>Description:</Label>
                <Textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} className="w-full mt-1 px-2 py-1 border rounded-sm text-sm" rows={3} />
              </div>
              <div className="flex mt-3 gap-2">
                <Button className="bg-army h-6 text-xs font-medium  hover:bg-army/85" onClick={async () => {
                  // detect changes
                  const updates = {}
                  if (name !== selected.name) updates.name = name
                  if (slug !== (selected.slug || '')) updates.slug = slug
                  if (description !== (selected.description || '')) updates.description = description
                  if (Object.keys(updates).length === 0) { setEditing(false); toast('No changes'); return }
                  // open confirmation dialog
                  setPendingUpdates(updates)
                  setUpdateDialogOpen(true)
                }}>Save</Button>
                <Button variant="secondary" className={'h-6 font-medium text-xs'} onClick={() => { setName(selected.name); setSlug(selected.slug||''); setDescription(selected.description||''); setEditing(false) }}>Cancel</Button>
              {/** Update confirmation dialog */}
              <AlertDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm update</AlertDialogTitle>
                    <AlertDialogDescription>
                      You're about to update the category. The following changes will be applied:
                      <p className="mt-2 text-xs">
                        {pendingUpdates && Object.keys(pendingUpdates).map(k => (
                          <span key={k}><strong>{k}</strong>: {String(selected[k]||'')} → {String(pendingUpdates[k]||'')}</span>
                        ))}
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-7">Cancel</AlertDialogCancel>
                    <AlertDialogAction className="h-7 bg-army hover:bg-army/80 text-white" onClick={async ()=>{
                      if (!pendingUpdates) return
                      try{
                        setSaving(true)
                        const { data, error } = await supabase.from('categories').update(pendingUpdates).eq('id', selected.id).select().single()
                        if (error) throw error
                        window.dispatchEvent(new CustomEvent('categories:refresh'))
                        refresh()
                        setEditing(false)
                        setUpdateDialogOpen(false)
                        setPendingUpdates(null)
                        toast.success('Saved')
                      }catch(err){ console.error(err); toast.error('Failed to save') }
                      finally{ setSaving(false) }
                    }}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              </div>
            </div>
          )}
        </div>
      )
}

function CollectionDetails({ selected, refresh }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(selected?.name || '')
  const [slug, setSlug] = useState(selected?.slug || '')
  const [description, setDescription] = useState(selected?.description || '')
  const [domain, setDomain] = useState(selected?.domain || '')
  const [active, setActive] = useState(selected?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState(null)

    function slugify(input){
      return input.toString().toLowerCase().replace(/['"]/g, '').trim().replace(/\band\b/g, '&').replace(/[^a-z0-9\&-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').replace(/&/g, 'and')
    }
    function capitalize(input) {
      let newValue = input.toString().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ').replace(/\bAnd\b/g, '&')
      return newValue
    }

  useEffect(()=>{
    setName(selected?.name || '')
    setSlug(selected?.slug || '')
    setDescription(selected?.description || '')
    setActive(selected?.active ?? true)
  },[selected])

  async function handleSaveUpdates(){
    const updates = {}
    if (name !== selected.name) updates.name = name
    if (slug !== (selected.slug||'')) updates.slug = slug
    if (description !== (selected.description||'')) updates.description = description
    if (active !== (selected.active ?? true)) updates.active = active
    if (Object.keys(updates).length === 0) { setEditing(false); toast('No changes'); return }
    setPendingUpdates(updates)
    setUpdateDialogOpen(true)
  }

  async function confirmUpdate(){
    if (!pendingUpdates) return
    try{
      setSaving(true)
      const { data, error } = await supabase.from('collections').update(pendingUpdates).eq('id', selected.id).select().single()
      if (error) throw error
      refresh()
      setEditing(false)
      setUpdateDialogOpen(false)
      setPendingUpdates(null)
      toast.success('Saved')
    }catch(err){ console.error(err); toast.error('Failed to save') }
    finally{ setSaving(false) }
  }

  return (
    <div>
      <div className="flex my-1.5 items-center justify-between">
        <h4 className="text-sm font-semibold">Collection Details</h4>
        <Button size="icon" variant="ghost" onClick={() => setEditing(v=>!v)} className="h-6 w-6 p-0"><Pencil size={14} /></Button>
      </div>
      {!editing ? (
        <div className="space-y-2 mt-3 text-sm">
          <div className="font-medium">{selected.name}</div>
          <div className="text-[13px] text-muted-foreground">Slug: {selected.slug || '-'}</div>
          <div className="text-[13px] text-muted-foreground">Active: {selected.active ? 'Yes' : 'No'}</div>
          <div className="pt-2 italic text-xs"><span className="font-bold underline text-amber-400">description: </span> {selected.description || 'No description provided.'}</div>
        </div>
      ) : (
        <div className="space-y-2 mt-3">
          <div className="flex gap-2">
            <Label>Name:</Label>
            <Input placeholder="Name" value={name} onChange={e=>setName(capitalize(e.target.value),setSlug(slugify(e.target.value)))} className="w-full mt-1 px-2 py-1 border h-7 rounded-sm text-sm" />
          </div>
          <div className="flex gap-2">
            <Label>Slug:</Label>
            <Input readOnly placeholder="Slug" value={slug} onChange={e=>setSlug(slugify(e.target.value))} className="w-full mt-1 px-2 py-1 border h-7 rounded-sm text-sm" />
          </div>
          <div className="flex gap-2 items-center">
            <Label>Active:</Label>
            <Switch checked={active} onCheckedChange={(v)=>setActive(Boolean(v))} />
          </div>
          <div className="flex gap-2">
            <Label>Description:</Label>
            <Textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} className="w-full mt-1 px-2 py-1 border rounded-sm text-sm" rows={3} />
          </div>
          <div className="flex mt-3 gap-2">
            <Button className="bg-army h-6 text-xs font-medium  hover:bg-army/85" onClick={async ()=>{ await handleSaveUpdates() }}>Save</Button>
            <Button variant="secondary" className={'h-6 font-medium text-xs'} onClick={() => { setName(selected.name); setSlug(selected.slug||''); setDescription(selected.description||''); setActive(selected.active ?? true); setEditing(false) }}>Cancel</Button>
          </div>

          <AlertDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm update</AlertDialogTitle>
                <AlertDialogDescription>
                  You're about to update the collection. The following changes will be applied:
                  <p className="mt-2 text-xs">
                    {pendingUpdates && Object.keys(pendingUpdates).map(k => (
                      <span key={k}><strong>{k}</strong>: {String(selected[k]||'')} → {String(pendingUpdates[k]||'')}</span>
                    ))}
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-7">Cancel</AlertDialogCancel>
                <AlertDialogAction className="h-7 bg-army text-white" onClick={confirmUpdate}>Confirm</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
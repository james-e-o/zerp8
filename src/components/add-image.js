import React, { useEffect, useRef, useState,useContext } from 'react'
import ImageUploading from 'react-images-uploading';
import { Plus,XIcon,BriefcaseBusiness,Users, Trash2, File,Pen, ImageIcon, X, LucideRollerCoaster, RotateCcw, FolderPlusIcon, LayoutGridIcon, FolderCheck, FolderPlus, Check, FolderOpen, Ellipsis, Upload, Move, SquareSplitHorizontal } from 'lucide-react'
import { toast } from 'sonner';

import { uploadImagesToSupabase } from '@/lib/supabaseUpload'
import { replaceImageInSupabase } from '@/lib/supabaseReplaceImage'
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel,AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,} from "@/components/ui/alert-dialog"
import {Breadcrumb,BreadcrumbEllipsis,BreadcrumbItem,BreadcrumbLink,BreadcrumbList,BreadcrumbPage,BreadcrumbSeparator} from "@/components/ui/breadcrumb"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { CompanyInfoContext } from '@/app/users/[u]/company/[companyId]/companyInfoProvider';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input"
import supabase from '../config/supabaseClient';
import Image from 'next/image';
import Link from "next/link"
import AvatarEditor from "react-avatar-editor";
import { set } from 'date-fns';
import { Spinner } from './ui/spinner';

import EditImage from './edit-image';
import FolderMoveDialog from './FolderMoveDialog';



const AddImage = () => {
     const [activeTab, setActiveTab] = useState("files");
     const [editState,setEditState] = useState(false)
     const [editInfo,setEditInfo] = useState(null)


     const [customDialog,setCustomDialog] =useState(false)
     const [customDialogState,setCustomDialogState] =useState('upload')
     const [newFolderState,setNewFolderState] = useState(false)
     const [newFolderValue,setNewFolderValue] = useState('')
     const [displayGrid,setDisplayGrid] = useState(true)
   
     const [isLoading,setIsLoading] = useState(true)
     const [selectedFiles,setSelectedFiles] = useState([])
     const [folder,setFolder] = useState('')
     const [selectedFolders,setSelectedFolders] = useState([])
     const [breadCrumbsList,setBreadCrumbsList] = useState([{id:null,name:'All'}])
     const [currentFolder,setCurrentFolder] = useState([])
     const [selectedItems, setSelectedItems] = useState([]);
     const [clickedFileId, setClickedFileId] = useState(null);
     const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
     const [moveDialogOpen, setMoveDialogOpen] = useState(false);
     const [targetFolderId, setTargetFolderId] = useState(undefined);

      const { info,setInfo,modules } = useContext(CompanyInfoContext)
     
     const [files, setFiles] = useState([
        
     ]);
     
     const [folders, setFolders] = useState([
      
     ]);
     
     const moveFile = async (fileId, folderId) => {
       try {
         // Update database
         await supabase.from('images').update({ folder: folderId }).eq('id', fileId);
         // Update local state
         setFiles((prevFiles) =>
           prevFiles.map((file) =>
             file.id === fileId ? { ...file, folderId } : file
           )
         );
       } catch (error) {
         console.error('Error moving file:', error);
         toast.error('Failed to move file');
       }
     };

     const moveFolder = async (folderId, parentId) => {
       try {
         // Update database
         await supabase.from('folders').update({ folderId: parentId }).eq('id', folderId);
         // Update local state
         setFolders((prev) =>
           prev.map((folder) =>
             folder.id === folderId ? { ...folder, folderId: parentId } : folder
           )
         );
       } catch (error) {
         console.error('Error moving folder:', error);
         toast.error('Failed to move folder');
       }
     };

     const addFolder = async () => {
          try {
               toast.loading('Creating folder...');
               
               const { data, error } = await supabase
                    .from('folders')
                    .insert({
                         name: newFolderValue,
                         folderId: breadCrumbsList[breadCrumbsList.length-1].id,
                         owner: info.id
                    })
                    .select()
                    .single();

               if (error) {
                    console.error('Error creating folder:', error);
                    toast.error('Failed to create folder');
                    return;
               }

               // Add to local state
               setFolders(prev => [...prev, {
                    id: data.id,
                    name: data.name,
                    folderId: data.folderId
               }]);
               
               setNewFolderValue('');
               setNewFolderState(false);
               toast.success('Folder created successfully');
          } catch (err) {
               console.error('Error creating folder:', err);
               toast.error('Failed to create folder');
          } finally {
               toast.dismiss();
          }
     }

    //  const openFolder =(folder)=> {
    //       setBreadCrumbsList(prev=>[...prev,{id:folder.id,name:folder.name}])
    //  }

     const openFolder = (folder) => {
        const active = breadCrumbsList[breadCrumbsList.length - 1];

        // Prevent invalid cross-path opening
        if (folder.folderId !== active.id) {
          toast.error("Invalid folder open: folder is not a child of current folder");
          return;
        }

        setBreadCrumbsList(prev => [
          ...prev,
          { id: folder.id, name: folder.name }
        ]);
    };

    function navigateBreadcrumbs(item,index) {
          setBreadCrumbsList(prev=>prev.slice(0,index+1))
    }

     const handleToggle = (id) => {
          selectedItems.includes(id)?
          setSelectedItems(prev=>prev.filter(item=>item!==id)):
          setSelectedItems((prev) => [...prev, id]);
     };

     const handleSelectAll = () => {
          const currentFolderId = breadCrumbsList[breadCrumbsList.length - 1].id;
          const folderItems = folders.filter(folder => folder.folderId === currentFolderId).map(folder => `folder-${folder.id}`);
          const fileItems = files.filter(file => file.folderId === currentFolderId).map(file => file.id);
          const allItems = [...folderItems, ...fileItems];
          
          if (selectedItems.length === allItems.length) {
               // All items are selected, deselect all
               setSelectedItems([]);
          } else {
               // Select all items
               setSelectedItems(allItems);
          }
     };

     const handleDeleteSelected = async () => {
       if (selectedItems.length === 0) return;
       setDeleteDialogOpen(true);
     };

     const fetchFilesAndFolders = async () => {
       try {
         const [imageList, folderList] = await Promise.all([
           fetchCompanyImages(info.name),
           fetchFolders(info.name)
         ]);
         setFiles(imageList);
         setFolders(folderList);
       } catch (err) {
         console.error("Error fetching data:", err);
         toast.error("Error fetching data");
       }
     };

     const confirmDeleteSelected = async () => {
       setDeleteDialogOpen(false);

       try {
         toast.loading('Moving items to trash...');

         const filesToMove = [];
         const foldersToDelete = [];

         // Separate files and folders
         for (const itemId of selectedItems) {
           if (itemId.startsWith('folder-')) {
             const folderId = itemId.replace('folder-', '');
             foldersToDelete.push(folderId);
           } else {
             filesToMove.push(itemId);
           }
         }

         // Get file objects for moving to trash
         const filesToMoveToTrash = filesToMove.map(fileId =>
           files.find(f => f.id === fileId)
         ).filter(Boolean);

         // Collect files from folders and their subfolders
         const allFilesToMove = [...filesToMoveToTrash];
         const allFoldersToDelete = [...foldersToDelete];

         for (const folderId of foldersToDelete) {
           // Collect files in this folder and subfolders
           const folderFiles = files.filter(f => f.folderId === folderId);
           allFilesToMove.push(...folderFiles);

           const { folders: folderFolders } = await collectFoldersRecursively(folderId);
           allFoldersToDelete.push(...folderFolders);

           // Also collect files from subfolders
           for (const subFolderId of folderFolders) {
             const subFolderFiles = files.filter(f => f.folderId === subFolderId);
             allFilesToMove.push(...subFolderFiles);
           }
         }

         // Move all files to trash
         if (allFilesToMove.length > 0) {
           await moveFilesToTrash(allFilesToMove);
         }

         // Delete folders from database
         if (allFoldersToDelete.length > 0) {
           await supabase.from('folders').delete().in('id', allFoldersToDelete);
         }

         // Remove duplicates
         const uniqueFilesMoved = [...new Set(allFilesToMove.map(f => f.id))];
         const uniqueFoldersDeleted = [...new Set(allFoldersToDelete)];

         // Update local state - remove all affected files and folders
         setFiles(prevFiles => prevFiles.filter(file => !uniqueFilesMoved.includes(file.id)));
         setFolders(prevFolders => prevFolders.filter(folder => !uniqueFoldersDeleted.includes(folder.id)));
         setSelectedItems([]);

         toast.success('Items moved to trash successfully');
       } catch (error) {
         console.error('Move to trash error:', error);
         toast.error('Failed to move items to trash');
       } finally {
         toast.dismiss();
       }
     };

     const collectFoldersRecursively = async (folderId) => {
       const deletedFolders = [folderId];

       // Find all subfolders
       const subfolders = folders.filter(f => f.folderId === folderId);

       // Recursively collect subfolders
       for (const subfolder of subfolders) {
         const { folders: subFolders } = await collectFoldersRecursively(subfolder.id);
         deletedFolders.push(...subFolders);
       }

       return { folders: deletedFolders };
     };

     async function deleteImagesFromStorage(images) {
       if (!images.length) return;

       // Group by bucket (required by Supabase)
       const bucketMap = {};

       for (const img of images) {
         if (!bucketMap[img.bucket]) {
           bucketMap[img.bucket] = [];
         }

         bucketMap[img.bucket].push(
           img.path.replace(/^\/+/, '') // normalize
         );
       }

       for (const bucket of Object.keys(bucketMap)) {
         const { error } = await supabase.storage
           .from(bucket)
           .remove(bucketMap[bucket]);

         if (error) {
           console.error(`Failed deleting from bucket ${bucket}`, error);
           throw error;
         }
       }
     }

     async function moveFilesToTrash(files) {
       // Delete from images table
       const ids = files.map(f => f.id);
       await supabase.from('images').delete().in('id', ids);

       // Insert into trash
       const trashData = files.map(f => ({
         id: f.id,
         name: f.name,
         url: f.url,
         folder: f.folderId,
         path: f.path,
         storage: f.bucket,
         owner: f.owner,
         size: f.size,
         mime_type: f.mime_type,
         deleted_at: new Date().toISOString()
       }));
       await supabase.from('trash').insert(trashData);
     }

     async function deleteFromTrash(images) {
       // Delete from storage
       await deleteImagesFromStorage(images);

       // Delete from trash
       const ids = images.map(f => f.id);
       await supabase.from('trash').delete().in('id', ids);
     }

     async function fetchTrashedImages(companyName) {
       const safeCompanyName = companyName ? companyName.replace(/\s+/g, '_') : 'company';
       const { data, error } = await supabase
         .from("trash")
         .select("*")
         .eq("owner", info.id);

       if (error) {
         console.error("Fetch trashed images error:", error);
         return [];
       }

       return data.map(row => ({
         id: row.id,
         name: row.name,
         url: `${row.url}?t=${Date.now()}`,
         folderId: row.folder || null,
         path: row.path,
         bucket: row.storage,
         owner: row.owner,
         size: row.size,
         mime_type: row.mime_type,
         deleted_at: row.deleted_at
       }));
     }

     async function fetchCompanyImages(companyName) {
      console.log("Fetchingcompany:", companyName);
      const safeCompanyName = companyName ? companyName.replace(/\s+/g, '_') : 'company';
        const { data, error } = await supabase
          .from("images")
          .select("*")
          .ilike("path", `${safeCompanyName}/%`);  // all images under company folder

        if (error) {
          console.error("Fetch images error:", error);
          return [];
        }

        // Convert DB rows to your UI format with all needed properties
        return data.map(row => ({
          id: row.id,
          name: row.name,
          url: `${row.url}`, // Add cache-busting parameter
          folderId: row.folder || null,
          path: row.path,
          bucket: row.storage,
          owner: row.owner,
          size: row.size,
          mime_type: row.mime_type,
        }));
      }

     async function fetchFolders(companyName) {
        const { data, error } = await supabase
          .from("folders")
          .select("*")
          .eq("owner", info.id);  // folders owned by this company

        if (error) {
         toast.error("Fetch folders error:", error);
          return [];
        }

        // Convert DB rows to your UI format
        return data.map(row => ({
          id: row.id,
          name: row.name,
          folderId: row.folderId || null,
          owner: row.owner,
        }));
      }


// const files = await listDeep(companyName);
             
     

    useEffect(()=>{
      const newfolder =  document.getElementById('newfolder')
      newFolderState?newfolder.focus():""

      // Derive selected files and folders from `selectedItems`.
      // `selectedItems` contains file ids and folder ids prefixed with `folder-`.
      const selectedFileIds = selectedItems.filter(id => typeof id === 'string' && !id.startsWith('folder-'));
      const selectedFolderIds = selectedItems
        .filter(id => typeof id === 'string' && id.startsWith('folder-'))
        .map(id => id.replace('folder-', ''));

      // Files that are either directly selected or belong to any selected folder
      setSelectedFiles(files.filter(f => selectedFileIds.includes(f.id) || selectedFolderIds.includes(String(f.folderId))));

      // Folders that are selected
      setSelectedFolders(folders.filter(f => selectedFolderIds.includes(String(f.id))));
    },[files,folders,newFolderState,selectedItems])

     useEffect(()=>{  
          Promise.all([
               fetchCompanyImages(info.name),
               fetchFolders(info.name)
          ]).then(([imageList, folderList]) => {
               setFiles(imageList)
               setFolders(folderList)
               setIsLoading(false)
          }).catch(err=>{
               console.error("Error fetching data:", err)
               toast.error("Error fetching data")
               setIsLoading(false)
               setFiles([])
               setFolders([])
          })
         setCurrentFolder(breadCrumbsList[breadCrumbsList.length-1])
     },[breadCrumbsList])

  return (
     <DndProvider backend={HTML5Backend}>
          <>
                  {editState&&editInfo?
                    (
                      <EditImage 
                        editInfo={editInfo} 
                        setEditState={setEditState} 
                        setEditInfo={setEditInfo}
                        onDelete={async (oldEditInfo)=>{
                                  try {
    // 1️⃣ Fetch image record
                                      const { data: image, error: fetchError } = await supabase
                                        .from("images")
                                        .select("id, storage, path")
                                        .eq("id", oldEditInfo.id)
                                        .single();

                                      if (fetchError || !image) {
                                        return { error: fetchError || new Error("Image not found") };
                                      }

                                      // 2️⃣ Delete from storage
                                      const { error: storageError } = await supabase.storage
                                        .from(image.storage)
                                        .remove([image.path]);

                                      if (storageError) {
                                        return { error: storageError };
                                      }

                                      return { success: true };
                                    } catch (err) {
                                      return { error: err };
                                    }
                        }}
                        onSave={async (file, replaceImage, oldEditInfo) => {
                          try {
                            if (replaceImage && oldEditInfo?.id && oldEditInfo?.path && oldEditInfo?.bucket) {
                              // 🔄 REPLACE MODE: Delete old and upload new
                              toast.loading('Replacing image...')
                              const result = await replaceImageInSupabase(
                                oldEditInfo.id,
                                oldEditInfo.path,
                                oldEditInfo.bucket,
                                file,
                                {
                                  companyName: oldEditInfo.companyName || info.name,
                                  folder: oldEditInfo.folder || '',
                                  owner: oldEditInfo.owner || info.id,
                                }
                              )

                              if (!result.success) {
                                toast.error(`Replace failed: ${result.error?.message || 'Unknown error'}`)
                                return
                              }

                              toast.success('Image replaced successfully!')
                            } else {
                              // ➕ NEW IMAGE: Upload as new image
                              toast.loading('Uploading new image...')
                              const uploadResults = await uploadImagesToSupabase([{ file }], {
                                bucket: 'products',
                                companyName: info.name,
                                folder: '',
                                owner: info.id,
                              },false)

                              const result = uploadResults[0]
                              if (result.error) {
                                toast.error(`Upload failed: ${result.error?.message || 'Unknown error'}`)
                                return
                              }

                              toast.success('Image uploaded successfully!')
                            }

                            // Refresh file list to show changes
                            const imageList = await fetchCompanyImages(info.name)
                            setFiles(imageList)
                          } catch (err) {
                            console.error('Save error:', err)
                            toast.error(`Save failed: ${err.message}`)
                          }
                          finally {toast.dismiss() }
                        }}
                      />
                    )
                      :
                    (<>
                    
                    <div  defaultValue='files' className="flex md:flex-row font-Inter flex-col w-full overflow-hidden grow p-1px my-1 items-start gap-0">
                         <div className="flex md:flex-col md:items-center items-start justify-start w-fit md:w-44 bg-white h-fit md:h-full">
                              <div className={`inline-flex  md:flex md:h-full p-3px md:min-w-max md:flex-col w-full justify-start min-w-max bg-white md:items-center mb-2 gap-2 rounded-[3px] md:pb-2 `}>
                                   <Separator className='hidden md:block mb-data-[state=active]:shadow-none1'/>
                                   <Button onClick={()=>{setCustomDialogState('upload'),setCustomDialog(true)}} className={'bg-core mx-2.5 h-7 text-xs md:mt-2 hover:bg-core/85'}>Upload Image</Button>
                                   <Button onClick={()=>{setActiveTab('files')}} variant={'ghost'} className={`py-1 text-xs md:w-full inline-flex gap-1 items-center px-4 text-black md:px-3 relative h-11 border-b-4 md:border-r-4 border-transparent rounded-none md:border-b-0 md:mt-2 ${activeTab === 'files' ? 'border-b-army md:border-r-army bg-core_grey2' : 'border-b-transparent md:border-r-transparent bg-transparent'}`}><File className="p-5px"/><span className='text-10px'>Files</span></Button>
                                   <Button onClick={()=>{setActiveTab('trash')}} variant={'ghost'} className={`py-1 text-xs md:w-full inline-flex gap-1 items-center text-black px-4 relative h-11 border-b-4 md:border-r-4 border-transparent rounded-none md:border-b-0 md:mt-2 ${activeTab === 'trash' ? 'border-b-army md:border-r-army bg-core_grey2' : 'border-b-transparent md:border-r-transparent bg-transparent'}`}><Trash2 className="p-5px"/><span className='text-10px'>Trash</span></Button>
                              </div>
                         </div>   
                         <div className="flex flex-col md:border-l  border-t md:border-t-0 w-full relative overflow-hidden md:h-full h-full md:px-2">
                              {activeTab === "files"? (
                              <div className='mt-0 h-full overflow-hidden w-full md:px-1 py-1'>
                                        <div className='w-full h-full  md:gap-2 md:justify-end overflow-hidden justify-start flex md:flex-row flex-col'>
                                             <div className={`md:h-full w-full md:overflow-hidden overflow-scroll  rounded-lg px-1 pt-2 flex flex-col justify-start`}>
                                                  <div className="flex flex-col md:flex-row md:justify-between">
                                                    <Input placeholder="Search image..." className="w-full md:w-4/5 text-xs rounded-lg mb-1"/>
                                                    <div className="w-full justify-end inline-flex gap-3">
                                                        <div className="inline-flex gap-0 overflow-x-clip "><p data-open={newFolderState} className="inline-flex items-center transition-all -z-10 opacity-0 data-[open=true]:opacity-100 data-[open=true]:right-0 data-[open=true]:z-0 relative -right-3"><Input id='newfolder' onBlur={()=>{!newFolderValue?setNewFolderState(false):""}} className='h-5 rounded-e-none outline-transparent  ml-1 w-24 rounded-s-md' value={newFolderValue} onChange={({target})=>{setNewFolderValue(target.value)}}/><Button onClick={()=>{addFolder()}} size='icon' disabled={!newFolderValue} className='px-1 rounded-e-md rounded-s-none w-fit h-5'><Plus className=''/></Button></p><Tooltip><TooltipTrigger asChild><Button onClick={()=>{setNewFolderState(!newFolderState)}} variant='icon' className='p-1 relative min-w-max'><FolderPlus data-open={newFolderState} className='relative transition-all scale-125 data-[open=true]:-z-10 data-[open=true]:opacity-0 opacity-100 z-0'/><FolderCheck data-open={newFolderState} className='absolute transition-all scale-125 data-[open=true]:z-0 -z-10 data-[open=true]:opacity-100 opacity-0'/></Button></TooltipTrigger><TooltipContent><p className="text-xs">Add new folder</p></TooltipContent></Tooltip></div>
                                                        <Button onClick={()=>{setDisplayGrid(!displayGrid)}} variant='ghost'><LayoutGridIcon/></Button>
                                                    </div>
                                                  </div>
                                                  <div className='md:grow h-full flex md:overflow-hidden flex-col'>
                                                        <div className="w-full h-10 justify-between flex items-center">
                                                          <div className="flex items-center px-0.5 justify-between">
                                                                <Breadcrumb>
                                                                    <BreadcrumbList className='flex gap-0 sm:gap-0 md:gap-0'>
                                                                          {breadCrumbsList.map((item,index)=>(
                                                                              <div key={index} onClick={()=>{navigateBreadcrumbs(item,index)}} className="inline-flex gap-[3px">
                                                                                  <BreadcrumbItem>
                                                                                        <Button variant='ghost' className='h-0 text-xs px-1'>{item.name}</Button></BreadcrumbItem>
                                                                              {index!=breadCrumbsList.length-1? <BreadcrumbSeparator  />:""}
                                                                              </div>
                                                                          ))}
                                                                    </BreadcrumbList>
                                                                </Breadcrumb>
                                                          </div>
                                                          <>
                                                          {selectedItems.length>0?(
                                                            <div className='flex items-center gap-2'>
                                                              {/* {selectedItems.length<=1?(
                                                                <Button className={'text-black h-6 text-[11px]'} variant={'icon'}><SquareSplitHorizontal className='size-3.5 text-core'/><span className='md:inline hidden'>Rename</span></Button>
                                                              ):''} */}
                                                              <Button className={'text-black h-6 text-[11px]'} variant={'icon'} onClick={() => setMoveDialogOpen(true)}><Move className='size-3.5 text-core'/><span className='md:inline hidden'>Move</span></Button>
                                                              <Button className={'text-black h-6 text-[11px]'} variant={'icon'} onClick={handleDeleteSelected}><Trash2 className='size-3.5 text-core'/><span className='md:inline hidden'>Delete</span></Button>
                                                            </div>                  
                                                          ):''}
                                                          </>
                                                        </div>
                                                       <div className='px-2 mt-2 text-[11px] text-army'>
                                                          <div className="flex items-center gap-2 mb-1">
                                                            <Checkbox
                                                              className={'size-3'}
                                                              checked={(() => {
                                                                const currentFolderId = breadCrumbsList[breadCrumbsList.length - 1].id;
                                                                const folderItems = folders.filter(folder => folder.folderId === currentFolderId).map(folder => `folder-${folder.id}`);
                                                                const fileItems = files.filter(file => file.folderId === currentFolderId).map(file => file.id);
                                                                const allItems = [...folderItems, ...fileItems];
                                                                return allItems.length > 0 && selectedItems.length === allItems.length;
                                                              })()}
                                                              onCheckedChange={handleSelectAll}
                                                            />
                                                            <span className='text-neutral-800'>Select All</span>
                                                          </div>
                                                          <span className='text-neutral-800'>Selected Items:</span>

                                                          {selectedItems && selectedItems.length > 0
                                                            ? selectedItems
                                                                .map(id => {
                                                                  if (id.startsWith('folder-')) {
                                                                    const folderId = id.replace('folder-', '');
                                                                    return folders.find(folder => folder.id === folderId)?.name || "(Unknown Folder)";
                                                                  } else {
                                                                    return files.find(file => file.id === id)?.name || "(Unknown File)";
                                                                  }
                                                                })
                                                                .join(", ")
                                                            : "None"}
                                                        </div>

                                                       <div className="h-full overflow-y-scroll">
                                                            <div data-grid={displayGrid} className="grid data-[grid=true]:justify-items-start h-fit data-[grid=true]:gap-3  grid-cols-1 data-[grid=true]:lg:grid-cols-4 data-[grid=true]:md:grid-cols-3 data-[grid=true]:sm:grid-cols-2">

                                                                 {folders.filter(folder => folder.folderId === currentFolder.id).map(folder => (
                                                                      <Folder key={folder.id} folder={folder} children={{folders:folders.filter(item=>item.folderId==folder.id).length, files:files.filter(item=>item.folderId==folder.id).length}} click={()=>{openFolder(folder)}} moveFile={moveFile} moveFolder={moveFolder} checked={selectedItems&&selectedItems.some(item=>item===`folder-${folder.id}`)} onCheck={(status)=>{handleToggle(`folder-${folder.id}`)}} grid={displayGrid}/>
                                                                 ))}
                                                                 {isLoading ? (
                                                                          <Spinner className='size-4 ml-2 text-core' spinning={isLoading} />
                                                                    )
                                                                      :
                                                                    (
                                                                      files.filter(file => file.folderId === currentFolder.id).map(file => (
                                                                          <Files key={file.id} file={file} moveFile={moveFile} checked={selectedItems&&selectedItems.some(item=>item===file.id)} onCheck={(status)=>{handleToggle(file.id)}} onFileClick={()=>{setClickedFileId(file.id)}} onCtrlClick={()=>{handleToggle(file.id)}} grid={displayGrid}/>
                                                                      ))
                                                                    )
                                                                 }

                                                                 {/* Empty state when no files or folders */}
                                                                 {!isLoading && folders.filter(folder => folder.folderId === currentFolder.id).length === 0 && files.filter(file => file.folderId === currentFolder.id).length === 0 && (
                                                                   <div className="col-span-full w-full flex flex-col items-center justify-center py-12 px-4 text-center min-h-[300px]">
                                                                     <div className="mb-4 p-4 rounded-full bg-gray-100 dark:bg-neutral-800">
                                                                       <ImageIcon className="w-10 h-10 text-gray-400 dark:text-neutral-500" />
                                                                     </div>
                                                                     <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                                                                       {currentFolder.id === null ? "No images uploaded yet" : "This folder is empty"}
                                                                     </h3>
                                                                     <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4 max-w-sm">
                                                                       {currentFolder.id === null ? "Get started by uploading your first image. You can organize them into folders for better management." : "This folder doesn't contain any images or subfolders yet."}
                                                                     </p>
                                                                     {currentFolder.id === null && (
                                                                       <Button 
                                                                         onClick={()=>{setCustomDialogState('upload'),setCustomDialog(true)}}
                                                                         className="bg-core hover:bg-core/85 text-white h-8 text-xs"
                                                                       >
                                                                         <Upload className="w-3 h-3 mr-2" />
                                                                         Upload Your First Image
                                                                       </Button>
                                                                     )}
                                                                   </div>
                                                                 )}
                                
                                                            </div>
                                                       </div>
                                                  </div>
                                             </div>
                                            <div className="w-full md:w-[40%] md:overflow-y-scroll no_scroll md:border-l px-2 border-t md:border-t-0 md:h-full">
                                              <FileDetailsPanel selectedFile={clickedFileId ? files.find(f => f.id === clickedFileId) : null} setEditState={setEditState} setEditInfo={setEditInfo} updateName={(newValue,id,path)=>{

                                              }}/>
                                            </div>
                                        </div>
                                      </div>
                                    ) : activeTab === "trash" ? (
                                   <div className="h-full w-full p-2">
                                   <TrashBox />
                                   </div>
                              ) : ''}
                              
                         </div>
                    </div>
                     <AlertDialogFooter className={'p-3'}>
                                <AlertDialogCancel className={'h-7 text-xs '} >Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={selectedItems.length === 0}
                                  className={'h-7 text-xs bg-core hover:bg-core/85 disabled:opacity-50 disabled:cursor-not-allowed'}
                                  onClick={() => {
                                    const selectedFileIds = selectedItems.filter(id => typeof id === 'string' && !id.startsWith('folder-'));
                                    const selectedFolderIds = selectedItems
                                      .filter(id => typeof id === 'string' && id.startsWith('folder-'))
                                      .map(id => id.replace('folder-', ''));

                                    const filesToSend = files.filter(f => selectedFileIds.includes(f.id) || selectedFolderIds.includes(String(f.folderId)));

                                    // Dispatch a CustomEvent so parent pages (like create product) can listen
                                    try {
                                      window.dispatchEvent(new CustomEvent('nexshelf:selectedImages', { detail: filesToSend }));
                                      toast.success(`${filesToSend.length} image(s) selected`);
                                    } catch (e) {
                                      console.error('Dispatch selected images failed', e);
                                    }
                                  }}
                                ><ImageIcon className="w-4 h-4 mr-1" />Add selected images</AlertDialogAction>
                              </AlertDialogFooter>
                    </>) 
                  }
              
                                    

          {/* Modal for upload - appears when `customDialog` is true */}
          {customDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
                <div className="bg-white dark:bg-neutral-900 flex-col flex rounded-lg w-[95%] max-w-4xl h-[60%] overflow-hidden p-2">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setCustomDialog(false)}>
                      <X />
                    </Button>
                  </div>
                  <div className=" rounded-md grow">
                    <UploadModalContent
                      onStartUpload={async (list) => {
                      toast(`Uploading ${list.length} image(s)...`)
                      try {
                            const results = await uploadImagesToSupabase(
                              list,
                              {
                                bucket: "products",
                                companyName: info.name,
                                folder: folder || "",
                                owner: info.id
                              },
                              false
                            );

                            const success = results.filter(r => !r.error);
                            const failed = results.filter(r => r.error);

                            if (success.length) {
                              toast(`Uploaded ${success.length} image(s)`);

                              // 🔥 Fetch from DB and update UI
                              const imageList = await fetchCompanyImages(info.name);
                              setFiles(imageList);
                            }

                            if (failed.length) {
                              toast(`Failed to upload ${failed.length} image(s)`);
                            }

                            setCustomDialog(false);
                            return results;

                          } catch (err) {
                            console.error(err);
                            toast.error ? toast.error("Upload failed") : toast("Upload failed");
                          } finally {
                            setCustomDialog(false);
                          }

                      

                      }}
                      autoUploadThreshold={1}
                    />
                  </div>
                </div>
              </div>
            )}
         
         {/* Delete Confirmation Dialog */}
         <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
           <AlertDialogContent>
             <AlertDialogHeader>
               <AlertDialogTitle>Delete Selected Items</AlertDialogTitle>
               <AlertDialogDescription>
                 Are you sure you want to delete {selectedItems.length} selected item(s)? This action cannot be undone.
               </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
               <AlertDialogCancel>Cancel</AlertDialogCancel>
               <AlertDialogAction onClick={confirmDeleteSelected} className="bg-red-600 hover:bg-red-700">
                 Delete
               </AlertDialogAction>
             </AlertDialogFooter>
           </AlertDialogContent>
         </AlertDialog>

         {/* Move Dialog */}
         <FolderMoveDialog
           open={moveDialogOpen}
           onOpenChange={setMoveDialogOpen}
           selectedItems={selectedItems}
           onMoveSuccess={() => {
             // Update local state
             setSelectedItems([]);
             setTargetFolderId(undefined);
             // Refresh the current folder view
             fetchFilesAndFolders();
           }}
         />
         
      </>
     </DndProvider>
  )
}

export default AddImage






export const TrashBox = () => {
  const [trashedFiles, setTrashedFiles] = useState([]);
  const [selectedTrashedItems, setSelectedTrashedItems] = useState([]);
  const [displayGrid, setDisplayGrid] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { info } = useContext(CompanyInfoContext);

  const fetchTrashedImages = async () => {
    const { data, error } = await supabase
      .from("trash")
      .select("*")
      .eq("owner", info.id);

    if (error) {
      console.error("Fetch trashed images error:", error);
      return [];
    }

    return data.map(row => ({
      id: row.id,
      name: row.name,
      url: `${row.url}?t=${Date.now()}`,
      folderId: row.folder || null,
      path: row.path,
      bucket: row.storage,
      owner: row.owner,
      size: row.size,
      mime_type: row.mime_type,
      deleted_at: row.deleted_at
    }));
  };

  const deleteImagesFromStorage = async (images) => {
    if (!images.length) return;

    // Group by bucket (required by Supabase)
    const bucketMap = {};

    for (const img of images) {
      if (!bucketMap[img.bucket]) {
        bucketMap[img.bucket] = [];
      }

      bucketMap[img.bucket].push(
        img.path.replace(/^\/+/, '') // normalize
      );
    }

    for (const bucket of Object.keys(bucketMap)) {
      const { error } = await supabase.storage
        .from(bucket)
        .remove(bucketMap[bucket]);

      if (error) {
        console.error(`Failed deleting from bucket ${bucket}`, error);
        throw error;
      }
    }
  };

  const deleteFromTrash = async (images) => {
    // Delete from storage
    await deleteImagesFromStorage(images);

    // Delete from trash
    const ids = images.map(f => f.id);
    await supabase.from('trash').delete().in('id', ids);
  };

  const handleTrashedToggle = (id) => {
    selectedTrashedItems.includes(id) ?
    setSelectedTrashedItems(prev => prev.filter(item => item !== id)) :
    setSelectedTrashedItems((prev) => [...prev, id]);
  };

  const handleTrashedSelectAll = () => {
    if (selectedTrashedItems.length === trashedFiles.length) {
      setSelectedTrashedItems([]);
    } else {
      setSelectedTrashedItems(trashedFiles.map(file => file.id));
    }
  };

  const handleDeleteFromTrash = async () => {
    if (selectedTrashedItems.length === 0) return;
    setDeleteDialogOpen(true);
  };

  const confirmDeleteFromTrash = async () => {
    setDeleteDialogOpen(false);

    try {
      toast.loading('Permanently deleting selected items...');

      const filesToDelete = selectedTrashedItems.map(id =>
        trashedFiles.find(f => f.id === id)
      ).filter(Boolean);

      if (filesToDelete.length > 0) {
        await deleteFromTrash(filesToDelete);
      }

      // Update local state
      setTrashedFiles(prev => prev.filter(file => !selectedTrashedItems.includes(file.id)));
      setSelectedTrashedItems([]);

      toast.success('Items permanently deleted');
    } catch (error) {
      console.error('Permanent delete error:', error);
      toast.error('Failed to delete items');
    } finally {
      toast.dismiss();
    }
  };

  useEffect(() => {
    const loadTrashedFiles = async () => {
      setIsLoading(true);
      const trashed = await fetchTrashedImages(info.name);
      setTrashedFiles(trashed);
      setIsLoading(false);
    };
    loadTrashedFiles();
  }, [info.name]);

  return (
    <div className='w-full h-full gap-2 md:justify-end justify-start flex md:flex-row flex-col'>
      <div className={`md:h-full w-full md:overflow-hidden overflow-scroll rounded-lg px-1 pt-2 flex flex-col justify-start`}>
        <div className="flex flex-col md:flex-row md:justify-between">
          <Input placeholder="Search trashed images..." className="w-full md:w-4/5 text-xs rounded-lg mb-1"/>
          <div className="w-full justify-end inline-flex gap-3">
            <Button onClick={() => setDisplayGrid(!displayGrid)} variant='ghost'>
              <LayoutGridIcon />
            </Button>
          </div>
        </div>
        <div className='md:grow h-full flex md:overflow-hidden flex-col'>
          <div className="w-full h-10 justify-between flex items-center">
            <div className="flex items-center px-0.5 justify-between">
              <span className='text-sm font-medium'>Trash</span>
            </div>
            {selectedTrashedItems.length > 0 && (
              <div className='flex items-center gap-2'>
                <Button className={'text-black h-6 text-[11px]'} variant={'icon'} onClick={handleDeleteFromTrash}>
                  <Trash2 className='size-3.5 text-red-600' />
                  <span className='md:inline hidden'>Delete Permanently</span>
                </Button>
              </div>
            )}
          </div>
          <div className='px-2 mt-2 text-[11px] text-army'>
            <div className="flex items-center gap-2 mb-1">
              <Checkbox
                className={'size-3'}
                checked={trashedFiles.length > 0 && selectedTrashedItems.length === trashedFiles.length}
                onCheckedChange={handleTrashedSelectAll}
              />
              <span className='text-neutral-800'>Select All</span>
            </div>
            <span className='text-neutral-800'>Selected Items: {selectedTrashedItems.length}</span>
          </div>
          <div className="h-full overflow-y-scroll">
            <div data-grid={displayGrid} className="grid data-[grid=true]:justify-items-start h-fit data-[grid=true]:gap-3 grid-cols-1 data-[grid=true]:lg:grid-cols-4 data-[grid=true]:md:grid-cols-3 data-[grid=true]:sm:grid-cols-2">
              {isLoading ? (
                <Spinner className='size-4 ml-2 text-core' spinning={isLoading} />
              ) : trashedFiles.length === 0 ? (
                <div className="col-span-full w-full flex flex-col items-center justify-center py-12 px-4 text-center min-h-[300px]">
                  <div className="mb-4 p-4 rounded-full bg-gray-100 dark:bg-neutral-800">
                    <Trash2 className="w-10 h-10 text-gray-400 dark:text-neutral-500" />
                  </div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                    Trash is empty
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4 max-w-sm">
                    Deleted items will appear here. Permanently delete them to free up storage space.
                  </p>
                </div>
              ) : (
                trashedFiles.map(file => (
                  <div key={file.id} className={`border-b relative hover:bg-core_grey2/50 p-1 flex justify-between gap-2 items-center h-fit data-[checked=true]:bg-core_grey2 data-[grid=true]:inline-flex data-[grid=true]:flex-col data-[grid=true]:justify-start data-[grid=true]:items-center data-[grid=true]:gap-0 data-[grid=true]:border-none data-[grid=true]:w-36 data-[grid=true]:h-48`}>
                    <p className="inline-flex w-fit items-center justify-start data-[grid=true]:justify-between data-[grid=true]:w-full">
                      <Checkbox
                        checked={selectedTrashedItems.includes(file.id)}
                        onCheckedChange={() => handleTrashedToggle(file.id)}
                        className="text-white fill-white border scale-90 data-[grid=true]:scale-75"
                      />
                    </p>
                    <div className="inline-flex gap-2 items-center grow justify-start data-[grid=true]:flex-col data-[grid=true]:gap-1">
                      <div className="data-[grid=true]:h-32 data-[grid=true]:w-full data-[grid=true]:flex data-[grid=true]:items-center data-[grid=true]:justify-center overflow-hidden">
                        <Image src={file.url} alt="trashed file" height={80} width={80} className="object-contain max-h-full max-w-full data-[grid=true]:w-24 data-[grid=true]:h-auto" />
                      </div>
                      <p className="flex overflow-hidden whitespace-nowrap text-xs flex-col items-start text-center gap-0 data-[grid=true]:whitespace-normal data-[grid=true]:leading-tight data-[grid=true]:text-[11px] data-[grid=true]:max-w-32 data-[grid=true]:line-clamp-2 data-[grid=true]:overflow-hidden data-[grid=true]:text-ellipsis">
                        <span>{file.name}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="w-full md:w-[40%] md:overflow-y-scroll no_scroll md:border-l px-2 border-t md:border-t-0 md:h-full">
        {/* File details panel can be added here if needed */}
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Selected Items</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedTrashedItems.length} selected item(s)? This action cannot be undone and will free up storage space.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFromTrash} className="bg-red-600 h-7 hover:bg-red-700">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};







   
     const ItemTypes = {
          DOCUMENT: "file",
          FOLDER: "folder",
     };
   
const Files = ({ file, grid, checked, onCheck, onFileClick, onCtrlClick }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DOCUMENT,
    item: { id: file.id, type: ItemTypes.DOCUMENT },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const handleClick = (e) => {
    if (e.ctrlKey || e.metaKey) {
      onCtrlClick();
    } else {
      onFileClick();
    }
  };

  return (
    <div
      ref={drag}
      data-drag={isDragging}
      data-checked={checked}
      data-grid={grid}
      onClick={handleClick}
      className={`
        border-b relative hover:bg-core_grey2/50 p-1 flex justify-between gap-2 items-center
        h-fit cursor-pointer
        data-[drag=true]:border-b-2 data-[drag=true]:border-army data-[drag=true]:opacity-60 
        data-[checked=true]:bg-core_grey2
        data-[grid=true]:inline-flex
        data-[grid=true]:flex-col 
        data-[grid=true]:justify-start 
        data-[grid=true]:items-center
        data-[grid=true]:gap-0 
        data-[grid=true]:border-none 
        data-[grid=true]:w-32 
        data-[grid=true]:h-44    
      `}
    >

      {/* ONLY CHECKBOX */}
      <p
        data-grid={grid}
        className="inline-flex w-fit items-center justify-start 
          data-[grid=true]:justify-between data-[grid=true]:w-full"
      >
        <Checkbox
          data-grid={grid}
          checked={checked}
          onCheckedChange={(status) => onCheck(status)}
          className={`
            text-white fill-white border scale-110
            data-[grid=true]:scale-110
          `}
        />
      </p>

      {/* IMAGE + NAME */}
      <div
        data-grid={grid}
        className={`
          inline-flex gap-2 items-center grow justify-start 
          data-[grid=true]:flex-col data-[grid=true]:gap-1
        `}
      >
        {/* IMAGE WRAPPER — FIXED HEIGHT, NO CLIPPING */}
        <div
          data-grid={grid}
          className={`
            data-[grid=true]:h-28      
            data-[grid=true]:w-full 
            data-[grid=true]:flex 
            data-[grid=true]:items-center 
            data-[grid=true]:justify-center
            overflow-hidden             
          `}
        >
          <Image
            src={file.url}
            alt="file-item"
            height={80}
            width={80}
            data-drag={isDragging}
            data-grid={grid}
            className={`
              data-[drag=true]:border-army w-auto
              object-cover scale-150
              max-h-full 
              max-w-full

         
              data-[grid=true]:w-20 
              data-[grid=true]:h-auto
            `}
          />
        </div>

        {/* FILE NAME */}
        <p
          data-grid={grid}
          className={`
            flex overflow-hidden whitespace-nowrap text-xs flex-col items-start text-center
            gap-0 
            data-[grid=true]:whitespace-normal
            data-[grid=true]:leading-tight
            data-[grid=true]:text-[10px]
            data-[grid=true]:max-w-24
            data-[grid=true]:line-clamp-2
            data-[grid=true]:overflow-hidden
            data-[grid=true]:text-ellipsis
          `}
        >
          <span>{file.name}</span>
        </p>
      </div>
    </div>
  );
};


const Folder = ({ folder, moveFile, moveFolder, click, grid, checked, onCheck, children }) => {
  const ref = useRef(null);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: [ItemTypes.DOCUMENT, ItemTypes.FOLDER],
    drop: (item) => {
      if (item.type === ItemTypes.DOCUMENT) {
        moveFile(item.id, folder.id);
      } else if (item.type === ItemTypes.FOLDER && item.id !== folder.id) {
        moveFolder(item.id, folder.id);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.FOLDER,
    item: { id: folder.id, type: ItemTypes.FOLDER },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  drag(drop(ref));

  return (
    <div
      ref={ref}
      data-drag={isDragging}
      data-grid={grid}
      className={`
        border-b relative hover:bg-core_grey2/50 py-1 px-1 flex justify-between gap-2 items-center
        data-[drag=true]:border-b-2 data-[drag=true]:border-army data-[drag=true]:opacity-60

        /* GRID MODE BOX STYLE (MATCH FILES COMPONENT) */
        data-[grid=true]:inline-flex
        data-[grid=true]:flex-col
        data-[grid=true]:justify-start
        data-[grid=true]:items-center
        data-[grid=true]:gap-0
        data-[grid=true]:border-none
        data-[grid=true]:w-32
        data-[grid=true]:h-44    /* YOUR REQUESTED GRID HEIGHT */
      `}
    >
      {/* CHECKBOX */}
      <p
        data-grid={grid}
        className="inline-flex w-fit items-center justify-start 
          data-[grid=true]:w-full"
      >
        <Checkbox
          data-grid={grid}
          checked={checked}
          onCheckedChange={(status) => onCheck(status)}
          className={`
            fill-white text-white border scale-90
            data-[grid=true]:scale-75
          `}
        />
      </p>

      {/* FOLDER ICON + NAME */}
      <div
        data-grid={grid}
        onClick={() => click()}
        className={`
          inline-flex gap-2 items-center grow justify-start
          data-[grid=true]:gap-1 
          data-[grid=true]:flex-col
        `}
      >
        {/* ICON WRAPPER (same logic as image wrapper) */}
        <div
          data-grid={grid}
          className={`
            data-[grid=true]:h-24
            data-[grid=true]:w-full
            data-[grid=true]:flex
            data-[grid=true]:items-center
            data-[grid=true]:justify-center
            overflow-hidden
          `}
        >
          <FolderOpen
            data-drag={isDragging}
            data-grid={grid}
            className={`
              data-[drag=true]:border-army
              object-contain
              max-h-full max-w-full
              text-army
              data-[grid=true]:w-16
              data-[grid=true]:h-auto
              data-[grid=true]:mt-2 
              data-[grid=true]:mb-2
            `}
          />
        </div>

        {/* FOLDER NAME + META */}
        <p
          data-grid={grid}
          className="flex items-start gap-0 flex-col"
        >
          <span
            data-grid={grid}
            className={`
              overflow-ellipsis
              data-[grid=true]:text-[10px]
              data-[grid=true]:leading-tight
              data-[grid=true]:line-clamp-2
              data-[grid=true]:max-w-24
            `}
          >
            {folder.name}
          </span>

          <span
            data-grid={grid}
            className="text-gray-500 mt-px text-8px data-[grid=true]:hidden"
          >
            {children.files} files | {children.folders} folders
          </span>
        </p>
      </div>

      {/* DELETE BUTTON (hidden in grid) */}
      <p
        data-grid={grid}
        className="inline-flex w-fit items-center justify-end 
        data-[grid=true]:w-full data-[grid=true]:hidden"
      >
        <Button
          data-grid={grid}
          variant="icon"
          className="p-1 relative min-w-max"
        >
          <Trash2 />
        </Button>
      </p>
    </div>
  );
};

  


// Modal-only upload UI: sidebar for sources + large drop area
export const UploadModalContent = ({ onStartUpload, autoUploadThreshold }) => {
  const [localImages, setLocalImages] = useState([])

  const handleChange = (list) => {
    setLocalImages(list)
    if (list.length >= (autoUploadThreshold || 1)) {
      onStartUpload(list)
    }
  }

  return (
    <div className="h-full w-full flex flex-col md:flex-row overflow-hidden p-2 text-xs">
      {/* Sidebar with external source options */}
      <div className="w-44 rounded-md border-r px-2 py-3 bg-gray-50 dark:bg-neutral-900">
        <p className="text-sm font-semibold mb-2">Import From</p>
        <div className="flex flex-col gap-2">
          <Button variant="ghost" className="justify-start">Dropbox</Button>
          <Button variant="ghost" className="justify-start">Google Drive</Button>
          <Button variant="ghost" className="justify-start">Local Files</Button>
        </div>
      </div>

      {/* Main drop area */}
      <div className="flex-1 flex items-center justify-center p-2">
        <ImageUploading
        multiple
        value={localImages}
        onChange={handleChange}
        maxNumber={10}
        dataURLKey="data_url"
      >
        {({
          imageList,
          onImageUpload,
          onImageRemoveAll,
          onImageUpdate,
          onImageRemove,
          isDragging,
          dragProps,
        }) => (
          <>
            <div className="hidden md:flex w-full h-full gap-2">
              <div
                className={`w-full h-full rounded-lg flex justify-center items-center border-3 ${
                  isDragging ? "border-army border-dotted" : "border-border"
                }`}
                {...dragProps}
              >
                <div className="flex items-center flex-col gap-3">
                  <Button
                    variant={"icon"}
                    size="xs"
                    className={`px-4 py-1 text-xs border ${
                      isDragging ? "text-gray-200" : "text-army"
                    }`}
                    onClick={onImageUpload}
                  >
                    <Upload />
                    <ImageIcon />
                  </Button>

                   <p className="font-semibold text-xs">Drop images here or click to select</p>
                <p className="text-xs text-neutral-500">Supported: JPG, PNG, GIF</p>
                </div>
              </div>
            </div>
          </>
        )}
      </ImageUploading>
      </div>
    </div>
  )
}

// File Details Panel with Actions and Collapsible Sections
const FileDetailsPanel = ({ selectedFile, setEditState, setEditInfo ,updateName}) => {
  const [tagsOpen, setTagsOpen] = useState(false)
  const [fileInfoOpen, setFileInfoOpen] = useState(false)
  const [renameDrop, setRenameDrop] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const handleEditImage = () => {
    setEditInfo(selectedFile)
    setEditState(true)
  }

  return (
    <div className="w-full h-full flex flex-col py-2 text-xs">
      {selectedFile ? (
        <>
          {/* FILE PREVIEW */}
          <div className="mb-4 flex justify-center items-center bg-gray-100 rounded-lg p-2 h-40 w-full">
            <Image
              src={selectedFile.url}
              alt={selectedFile.name}
              height={150}
              width={150}
              className="object-cover max-h-full scale-125"
            />
          </div>

          {/* FILE NAME */}
          <div className="mb-4 px-2">
            <p className="font-semibold text-sm overflow-wrap">{selectedFile.name}</p>
          </div>

          {/* ACTIONS SECTION */}
          <div className="mb-4">
            <h3 className="font-semibold mb-2 text-sm px-2">Actions</h3>
            <div className="flex flex-col gap-2">
              <Button onClick={handleEditImage} variant="ghost" className="justify-start text-xs gap-2 hover:bg-gray-100">
                <Pen size={16} />
                <div className="flex flex-col items-start">
                  <span>Edit Image</span>
                  <span className="text-gray-500 text-8px">Crop, remove background, adjust</span>
                </div>
              </Button>
              <Button onClick={()=>{setRenameDrop(!renameDrop)}} variant="ghost" className="justify-start text-xs gap-2 hover:bg-gray-100">
                <SquareSplitHorizontal size={16} />
                <div className="flex flex-col items-start">
                  <span>Rename Image</span>
                </div>
              </Button>
              <div className={renameDrop?"grid grid-rows-[1fr] relative -top-1.5 transition-collapse":"grid grid-rows-[0fr] relative -top-1.5 transition-collapse"}>
                    <div className="overflow-hidden">
                      <div className="rename-dialog">
                        <Input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)} 
                          className="w-full border border-gray-300 rounde-sm h-8 "
                          // you can also use a dedicated state, e.g. renameValue, if you prefer
                        />

                        <div className="flex justify-end mt-2 space-x-2">
                          <Button
                            className="px-4 py-2 bg-neutral-100 text-neutral-800 h-6 text-xs rounded hover:bg-neutral-200"
                            onClick={() => {
                              setRenameDrop(false);
                              // optionally reset any rename-state
                            }}
                          >
                            Cancel
                          </Button>

                          <Button
                            className="px-4 py-2 bg-core text-white h-6 text-xs rounded hover:bg-core/85"
                            onClick={()=>updateName(renameValue, selectedFile.id, selectedFile.path)}
                          >
                            Rename
                          </Button>
                        </div>
                      </div>
                    </div>
              </div>
            </div>
          </div>

          {/* TAGS SECTION - Collapsible */}
          <div className="mb-4 border-t pt-2">
            <button
              onClick={() => setTagsOpen(!tagsOpen)}
              className="w-full flex justify-between items-center py-2 hover:bg-gray-100 px-2 rounded"
            >
              <h3 className="font-semibold text-sm">Tags</h3>
              <span>{tagsOpen ? '−' : '+'}</span>
            </button>
            {tagsOpen && (
              <div className="px-2 py-2 text-xs text-neutral-600">
                <p>No tags added</p>
              </div>
            )}
          </div>

          {/* FILE INFO SECTION - Collapsible */}
          <div className="border-t pt-2">
            <button
              onClick={() => setFileInfoOpen(!fileInfoOpen)}
              className="w-full flex justify-between items-center py-2 hover:bg-gray-100 px-2 rounded"
            >
              <h3 className="font-semibold text-sm">File Info</h3>
              <span>{fileInfoOpen ? '−' : '+'}</span>
            </button>
            {fileInfoOpen && (
              <div className="px-2 py-2 text-xs text-neutral-600 space-y-1">
                <p><strong>Name:</strong> {selectedFile.name}</p>
                <p><strong>Type:</strong> Image</p>
                <p><strong>URL:</strong> <span className="truncate block">{selectedFile.url}</span></p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex justify-center items-center h-full text-neutral-500 text-xs">
          Click on a file to view details
        </div>
      )}
    </div>
  )
}

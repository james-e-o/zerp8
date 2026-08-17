"use client";

import { useState,useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TransferOwnershipForm from "@/lib/transfer-form";
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,AlertDialogTrigger,} from "@/components/ui/alert-dialog"
import {Shield,UserCog,KeyRound,Trash2,Edit3,Save,X,Mail, RotateCcwKey} from "lucide-react";
import { CompanyInfoContext } from "../../companyInfoProvider";
import { useRouter, useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import supabase from "@/config/supabaseClient";
import { toast } from "sonner";


export default function SecurityOwnershipSettings() {
  const [data, setData] = useState({
    owner: "Jamie (You)",
    twoFactor: "Enabled",
    recoveryEmail: "support@nexshelf.com",
  });

  const {info,setInfo} = useContext(CompanyInfoContext)
  const router = useRouter()
  const params = useParams()

  const {u, companySlug} = params

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(data);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmText,setConfirmText] = useState('')
  const [initiateTransfer,setInitiateTransfer] = useState(false)
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSave = async () => {
    setLoading(true);

    setTimeout(() => {
      setData(formData);
      setEditMode(false);
      setLoading(false);
    }, 700);
  };

  const handleCancel = () => {
    setFormData(data);
    setEditMode(false);
  };

  async function onDelete (){
    setIsLoading(true)

    // First, delete all images associated with this company from storage
    try {
      const { data: files, error: listError } = await supabase.storage
        .from('products')
        .list(info.name, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (listError) {
        console.error("Error listing files:", listError);
      } else if (files && files.length > 0) {
        const fileNames = files.map(file => `${info.name}/${file.name}`);
        const { error: deleteError } = await supabase.storage
          .from('products')
          .remove(fileNames);

        if (deleteError) {
          console.error("Error deleting images:", deleteError);
          // Continue with company deletion even if image deletion fails
        } else {
          console.log("Images deleted successfully");
        }
      }
    } catch (storageError) {
      console.error("Storage operation failed:", storageError);
      // Continue with company deletion
    }
    
    const { data, error } = await supabase
        .from("companies")
        .delete()
        .eq("id", info.id)
        .select();

      if (error) {
        console.error("Delete failed:", error.message);
        toast("Unable to delete company.");
        setIsLoading(false)
        return; // show error toast or message
      }

      // If we reach here, deletion worked
      console.log("Company deleted:", data);
      toast("Company deleted.");
      router.push(`/admin/${u}`); // or wherever you want
      
      setIsLoading(false)
  }
  // console.log(info.id)
  const isMatch = confirmText.trim() === info.name;

  return (
    <AlertDialog>
    <div className="min-h-screen pt-2 font-WixMade text-xs">
      <div className="bg-white rounded-sm p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h1 className="text-base font-semibold text-gray-800">
              Security & Ownership
            </h1>
          </div>

          {!editMode ? (
            <Button
            onClick={() => setEditMode(true)}
              className="flex items-center gap-1 px-2 py-1 h-7 text-xs font-medium bg-core text-white rounded-sm hover:bg-core/90 cursor-pointer transition"
              >
              <Edit3 className="w-3 h-3" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 h-7 text-xs font-medium bg-core text-white rounded-sm hover:bg-core/90 cursor-pointer transition"
              >
                <Save className="w-3 h-3" />
                {loading ? "Saving..." : "Save"}
              </Button>

              <Button
                onClick={handleCancel}
                className="flex items-center gap-1 px-2 py-1 h-7 text-xs font-medium border border-gray-300 rounded-sm hover:bg-gray-100 cursor-pointer transition"
              >
                <X className="w-3 h-3" />
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="divide-y divide-gray-200">

          {/* Ownership */}
          <div className="py-3 flex items-start justify-between">
            <div>
              <p className="text-gray-500 flex items-center gap-1">
                <UserCog className="w-3 h-3 text-gray-400" />
                Company Owner
              </p>

              {!editMode ? (
                <p className="text-gray-800 mt-1 font-medium">{data.owner}</p>
              ) : (
                <input
                  type="text"
                  name="owner"
                  value={formData.owner}
                  onChange={handleChange}
                  className="mt-1 text-xs border border-gray-300 rounded-sm px-2 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}
            </div>
          </div>

          {/* 2FA */}
          <div className="py-3 flex items-start justify-between">
            <div>
              <p className="text-gray-500 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-gray-400" />
                Two-Factor Authentication
              </p>

              {!editMode ? (
                <p className="text-gray-800 mt-1 font-medium">{data.twoFactor}</p>
              ) : (
                <select
                  name="twoFactor"
                  value={formData.twoFactor}
                  onChange={handleChange}
                  className="mt-1 text-xs border border-gray-300 rounded-sm px-2 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option>Enabled</option>
                  <option>Disabled</option>
                </select>
              )}
            </div>
          </div>

          {/* Recovery Email */}
          <div className="py-3 flex items-start justify-between">
            <div>
              <p className="text-gray-500 flex items-center gap-1">
                <Mail className="w-3 h-3 text-gray-400" />
                Recovery Email
              </p>

              {!editMode ? (
                <p className="text-gray-800 mt-1 font-medium">{data.recoveryEmail}</p>
              ) : (
                <input
                  type="email"
                  name="recoveryEmail"
                  value={formData.recoveryEmail}
                  onChange={handleChange}
                  className="mt-1 text-xs border border-gray-300 rounded-sm px-2 py-1 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}
            </div>
          </div>

          {/* Transfer company */}
          <div className="py-4 my-4">
            <p className="text-army text-xs font-medium flex items-center gap-1 mb-2">
              <RotateCcwKey className="w-3 h-3 text-army" />
              Transfer Company Ownership
            </p>

            
              <Button  onClick={()=>setInitiateTransfer(true)} className="bg-army text-white text-xs h-7 px-3 rounded-sm hover:bg-army/90 cursor-pointer">
                Initiate Transfer
              </Button>

               <div className={initiateTransfer?"grid grid-rows-[1fr] transition-collapse":"grid grid-rows-[0fr] transition-collapse"}>
                    <div className="overflow-hidden">
                     <TransferOwnershipForm cancel={()=>setInitiateTransfer(false)}/>
                    </div>
                </div>
            
          </div>

          {/* Delete Company */}
          <div className="py-4">
            <p className="text-red-600 text-xs font-medium flex items-center gap-1 mb-2">
              <Trash2 className="w-3 h-3 text-red-600" />
              Danger Zone
            </p>

            <AlertDialogTrigger asChild>
              <Button className="bg-red-600 text-white text-xs h-7 px-3 rounded-sm hover:bg-red-600/90 cursor-pointer">
                Delete Company Permanently
              </Button>
            </AlertDialogTrigger>
          </div>
        </div>
      </div>
    </div>


    <AlertDialogContent className={'text-xs '}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600 text-sm">
            Delete Company Permanently
          </AlertDialogTitle>

          <AlertDialogDescription  className={'text-xs text-neutral-800'}>
            This action cannot be undone. This will permanently delete the company
            <strong> "{info&&info.name}"</strong> and remove all its associated data.
            <br /><br />
            Please type **{info&&info.name}** below to confirm:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Input
            placeholder={`Type "${info&&info.name}" to confirm`}
            value={confirmText}
            onChange={(e) => {setConfirmText(e.target.value)}}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className={'h-7 text-xs'}>Cancel</AlertDialogCancel>

          <Button
            disabled={!isMatch || isLoading}
            className="bg-red-600 text-xs h-7 text-white hover:bg-red-700"
            onClick={() => {
              if (onDelete) onDelete();
            }}>{isLoading&&<Spinner spinning={isLoading}/>}Delete Permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
  </AlertDialog>
  );
}

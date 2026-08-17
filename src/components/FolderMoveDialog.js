import React, { useState, useEffect, useContext } from 'react';
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import  supabase  from '../config/supabaseClient';
import { CompanyInfoContext } from '@/app/users/[u]/company/[companyId]/companyInfoProvider';
import { toast } from 'sonner';

const FolderMoveDialog = ({ open, onOpenChange, selectedItems, onMoveSuccess }) => {
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const { info } = useContext(CompanyInfoContext);

  useEffect(() => {
    if (open) {
      fetchFolders();
    }
  }, [open]);

  const fetchFolders = async () => {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("owner", info.id);

    if (error) {
      console.error("Fetch folders error:", error);
      return;
    }

    setFolders(data);
    setCurrentFolderId(null);
    setBreadcrumb([]);
  };

  const getFolderPath = (folderId) => {
    if (!folderId) return [];
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    return [...getFolderPath(folder.folderId), folder];
  };

  const handleConfirm = async () => {
    if (!selectedItems || selectedItems.length === 0) return;

    try {
      toast.loading('Moving selected items...');

      for (const itemId of selectedItems) {
        if (itemId.startsWith('folder-')) {
          const folderId = itemId.replace('folder-', '');
          // Update folder in database
          await supabase.from('folders').update({ folderId: currentFolderId }).eq('id', folderId);
        } else {
          // Update file in database
          await supabase.from('images').update({ folder: currentFolderId }).eq('id', itemId);
        }
      }

      toast.success('Items moved successfully');
      onMoveSuccess && onMoveSuccess();
      onOpenChange(false);
      setCurrentFolderId(null);
      setBreadcrumb([]);
    } catch (error) {
      console.error('Move error:', error);
      toast.error('Failed to move items');
    } finally {
      toast.dismiss();
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setCurrentFolderId(null);
    setBreadcrumb([]);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-20]">
        <AlertDialogHeader>
          <AlertDialogTitle>Move to Folder</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="py-4 max-h-[1200px] overflow-y-auto">
          {/* Breadcrumb */}
          <div className="mb-4">
            {breadcrumb.length === 0 ? (
              <span className="text-sm font-medium">Root Folder</span>
            ) : (
              <div className="flex items-center space-x-1 text-sm">
                <button
                  onClick={() => { setCurrentFolderId(null); setBreadcrumb([]); }}
                  className="text-blue-500 hover:underline"
                >
                  Root
                </button>
                {breadcrumb.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    <span>&gt;</span>
                    {index === breadcrumb.length - 1 ? (
                      <span className="font-medium">{folder.name}</span>
                    ) : (
                      <button
                        onClick={() => {
                          setCurrentFolderId(folder.id);
                          setBreadcrumb(getFolderPath(folder.id));
                        }}
                        className="text-blue-500 hover:underline"
                      >
                        {folder.name}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          <hr className="mb-4" />
          {/* Folders */}
          {folders
            .filter(folder => folder.folderId === currentFolderId)
            .map(folder => {
              const hasChildren = folders.some(f => f.folderId === folder.id);
              return (
                <div key={folder.id} className="mb-2" style={{ paddingLeft: 20 }}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentFolderId(folder.id);
                      setBreadcrumb(getFolderPath(folder.id));
                    }}
                    className="w-full justify-start text-left"
                  >
                    {hasChildren ? "▶ " : "📁 "} {folder.name}
                  </Button>
                </div>
              );
            })}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} className="h-7">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="h-7">
            Move Here
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default FolderMoveDialog;

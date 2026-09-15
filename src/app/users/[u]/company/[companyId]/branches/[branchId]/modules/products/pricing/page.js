"use client";

import { useContext, useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus, ShieldCheck, Star, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import supabase from "@/config/supabaseClient";
import { BranchContext } from "@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext";

// NOTE / assumptions - please confirm or correct:
// 1. `currentBranch` from BranchContext carries `company` alongside `id`
//    (same as it already carries `id` for CreateProductPage). If it doesn't,
//    tell me and I'll add a lookup against `branches` instead.
// 2. Each context's rules screen lives at `${current path}/${context.id}` -
//    adjust CONTEXT_DETAIL_PATH below if your routing differs.

export default function PricingContextsPage() {
  const { branchId } = useParams();
  const pathname = usePathname();
  const { currentBranch } = useContext(BranchContext);

  const [contexts, setContexts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const fetchContexts = async () => {
    if (!currentBranch?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pricing_contexts")
        .select("*")
        .eq("branch", currentBranch.id)
        .order("is_default", { ascending: false })
        .order("priority", { ascending: false });

      if (error) throw error;
      setContexts(data || []);
    } catch (err) {
      console.error("Error fetching pricing contexts:", err);
      toast.error("Failed to load pricing contexts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContexts();
  }, [currentBranch?.id]);

  const handleToggleActive = async (context) => {
    if (context.is_default || context.is_system) {
      toast.error("Default and system pricing contexts cannot be changed.");
      return;
    }

    setTogglingId(context.id);
    const nextActive = !context.is_active;

    try {
      const { error } = await supabase
        .from("pricing_contexts")
        .update({ is_active: nextActive })
        .eq("id", context.id);

      if (error) {
        // The protect_system_pricing_contexts trigger raises a Postgres
        // exception for a system-context deactivation attempt - surface
        // that message directly rather than a generic failure.
        toast.error(error.message?.includes("cannot be deactivated")
          ? error.message
          : "Failed to update pricing context");
        return;
      }

      setContexts((prev) =>
        prev.map((c) => (c.id === context.id ? { ...c, is_active: nextActive } : c))
      );
      toast.success(nextActive ? "Context activated" : "Context deactivated");
    } catch (err) {
      console.error("Error toggling pricing context:", err);
      toast.error("Failed to update pricing context");
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const { error } = await supabase.from("pricing_contexts").insert({
        company: currentBranch.company,
        branch: currentBranch.id,
        name: newName.trim(),
        description: newDescription.trim() || null,
        is_system: false,
        is_default: false,
        is_active: true,
        priority: 0,
      });

      if (error) throw error;

      toast.success("Pricing context created");
      setNewName("");
      setNewDescription("");
      setCreateOpen(false);
      fetchContexts();
    } catch (err) {
      console.error("Error creating pricing context:", err);
      toast.error("Failed to create pricing context");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-end mb-4">
        <Button size="sm" className="bg-core hover:bg-core/85 h-7 text-xs gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" /> New Context
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Loading contexts...
        </div>
      ) : contexts.length === 0 ? (
        <div className="border rounded-lg py-16 text-center text-sm text-muted-foreground">
          No pricing contexts found for this branch.
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {contexts.map((context) => (
            <div key={context.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{context.name}</span>
                    {context.is_default && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-700">
                            <Star className="size-2.5" /> Default
                          </span>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">Every variant's Standard price lives here. Cannot be deleted or deactivated.</p></TooltipContent>
                      </Tooltip>
                    )}
                    {context.is_system && !context.is_default && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-700">
                            <ShieldCheck className="size-2.5" /> System
                          </span>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">Seeded automatically for every branch. Cannot be deleted or deactivated.</p></TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {context.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{context.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className={`text-[11px] font-medium ${context.is_active ? "text-emerald-600" : "text-neutral-400"}`}>
                  {context.is_active ? "Active" : "Inactive"}
                </span>
                <Switch
                  checked={context.is_active}
                  disabled={context.is_default || context.is_system || togglingId === context.id}
                  onCheckedChange={() => handleToggleActive(context)}
                />
                <Link href={`${pathname}/${context.id}`}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    Rules <ChevronRight className="size-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>New Pricing Context</SheetTitle>
            <SheetDescription>
              Give it a name and, if you like, a short description. You'll define its actual
              pricing rules (scope, condition, action) afterward from the Rules screen.
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Name</label>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Distributor, VIP, Export"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Description (Optional)</label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
          <SheetFooter>
            <div className="flex w-full justify-start gap-2 px-4 pb-4">
              <Button
                className="h-8 text-xs bg-core hover:bg-core/85"
                disabled={!newName.trim() || isCreating}
                onClick={handleCreate}
              >
                {isCreating ? <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Creating...</> : "Create"}
              </Button>
              <SheetClose asChild>
                <Button variant="outline" className="h-8 text-xs">Cancel</Button>
              </SheetClose>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
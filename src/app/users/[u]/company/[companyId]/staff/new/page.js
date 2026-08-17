"use client";
import { useState, useContext, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanyInfoContext } from "../../companyInfoProvider";
import { toast } from "sonner";
import Image from "next/image";
import supabase from "@/config/supabaseClient";
import {  AlertDialog,  AlertDialogAction,  AlertDialogCancel,  AlertDialogContent,  AlertDialogDescription,  AlertDialogTitle,} from "@/components/ui/alert-dialog";

export default function StaffOnboarding() {
  const [loading, setLoading] = useState(false);
  const { info, user } = useContext(CompanyInfoContext);

  const [inviteEmail, setInviteEmail] = useState("");
  const [showExistsDialog, setShowExistsDialog] = useState(false);
  const [showAlreadyMemberDialog, setShowAlreadyMemberDialog] = useState(false);
  const [existingInvite, setExistingInvite] = useState(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const COOLDOWN_MINUTES = 3;

  // Cooldown Timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const callInviteEdgeFunction = async (email, isResend = false) => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error("Session expired. Please log in again.");
    }

    const payload = {
      email,
      company_id: info.id,
      invited_by: user?.id,
      is_resend: isResend,
    };

    const { data, error } = await supabase.functions.invoke("send-invite", {
      body: payload,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) throw error;
    return data;
  };

  async function handleInviteSubmit(e) {
    e.preventDefault();
    if (!inviteEmail) return;

    setLoading(true);
    const checkingToast = toast.loading("Checking...");

    try {
      const { data: existing, error: checkError } = await supabase
        .from("company_invites")
        .select("*")
        .eq("email", inviteEmail)
        .eq("company_id", info.id)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        throw checkError;
      }

      toast.dismiss(checkingToast);

      if (existing) {
        setExistingInvite(existing);

        if (existing.status === "accepted") {
          setShowAlreadyMemberDialog(true);
        } else {
          // Calculate cooldown
          if (existing.last_sent) {
            const lastSentTime = new Date(existing.last_sent).getTime();
            const remainingMs = lastSentTime + COOLDOWN_MINUTES * 60 * 1000 - Date.now();
            const remainingSeconds = Math.ceil(remainingMs / 1000);

            if (remainingSeconds > 0) {
              setCooldownSeconds(remainingSeconds);
            }
          }
          setShowExistsDialog(true);
        }
        setLoading(false);
        return;
      }

      // New Invite
      await sendNewInvite();
    } catch (err) {
      toast.dismiss(checkingToast);
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function sendNewInvite() {
    const t = toast.loading("Sending invite...");
    try {
      await callInviteEdgeFunction(inviteEmail, false);
      toast.dismiss(t);
      toast.success("Invite sent successfully!");
      setInviteEmail("");
    } catch (err) {
      toast.dismiss(t);
      toast.error(err.message || "Failed to send invite");
    }
  }

  async function handleResend() {
    if (cooldownSeconds > 0) {
      toast.error(`Please wait ${cooldownSeconds} seconds`);
      return;
    }

    setResendLoading(true);
    const t = toast.loading("Resending invite...");

    try {
      await callInviteEdgeFunction(inviteEmail, true);

      toast.dismiss(t);
      toast.success("Invite resent successfully!");

      setShowExistsDialog(false);
      setExistingInvite(null);
      setInviteEmail("");
      setCooldownSeconds(COOLDOWN_MINUTES * 60);
    } catch (err) {
      toast.dismiss(t);
      toast.error(err.message || "Failed to resend invite");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className=" justify-center items-center flex grow">
    <div className=" font-WixMade bg-white shadow-md border rounded-lg -mt-12 p-6 min-w-2xl w-fit">
      {/* Logo Header */}
      <div className="flex scale-[85%] justify-center items-center w-full -mt-2 -mb-2">
        <div className="flex pt-0 md:pt-0 size-8 justify-center">
          <Image
            className="dark:invert w-7/8 scale-75"
            src="/logo.png"
            alt="logo"
            width={200}
            height={200}
            priority
          />
        </div>
        <p className="font-Lato text-army -ml-0.5 text-2xl font-extrabold">
          NEXSHELF
        </p>
      </div>

      <h2 className="text-sm text-center font-semibold my-4">Invite Staff Member</h2>

      {/* Company Info */}
      <div className="bg-slate-50 rounded-lg p-4 mb-5 border border-slate-200">
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 font-medium">Company Name</p>
            <p className="text-sm font-semibold text-gray-800">{info?.name || "Company"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Company Email</p>
            <p className="text-sm text-blue-600">{info?.email || "Not set"}</p>
          </div>
        </div>
      </div>

      {/* Invite Form */}
      <form className="flex flex-col gap-3 text-xs" onSubmit={handleInviteSubmit}>
        <div>
          <Label className="block mb-1 text-xs text-gray-600 font-medium">
            Staff Email Address
          </Label>
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            type="email"
            required
            placeholder="staff@example.com"
            className="text-xs"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="mt-3 bg-core hover:bg-army text-white text-xs py-2 rounded-md font-medium"
        >
          {loading ? "Processing..." : "Send Invite"}
        </Button>
      </form>

      {/* Existing Invite Dialog */}
      <AlertDialog open={showExistsDialog} onOpenChange={setShowExistsDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Invite Already Sent</AlertDialogTitle>
          <AlertDialogDescription>
            An invite has already been sent to <span className="font-semibold">{inviteEmail}</span>.
            Would you like to resend?
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end mt-4">
            <AlertDialogCancel
              onClick={() => {
                setShowExistsDialog(false);
                setExistingInvite(null);
                setInviteEmail("");
                setCooldownSeconds(0);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResend}
              disabled={resendLoading || cooldownSeconds > 0}
              className="bg-core hover:bg-army"
            >
              {resendLoading
                ? "Resending..."
                : cooldownSeconds > 0
                ? `Resend in ${cooldownSeconds}s`
                : "Resend Invite"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Already Member Dialog */}
      <AlertDialog open={showAlreadyMemberDialog} onOpenChange={setShowAlreadyMemberDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>User Already a Member</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold">{inviteEmail}</span> is already a member of this company.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end mt-4">
            <AlertDialogCancel
              onClick={() => {
                setShowAlreadyMemberDialog(false);
                setExistingInvite(null);
                setInviteEmail("");
              }}
            >
              Close
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  );
}
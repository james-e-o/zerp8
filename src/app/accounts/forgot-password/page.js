'use client'
import { useState } from "react";
import { GalleryVerticalEnd, CheckCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Spinner } from "@/components/ui/spinner"
import { isEmpty, isEmail } from "validator"
import  supabase  from "../../../config/supabaseClient";
import Image from "next/image";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [sentEmail, setSentEmail] = useState('')

    const message = {
      emailError: 'valid email address required',
      emailNotFound: 'email address not found in our system',
    }

    async function Submit(e) {
  e.preventDefault();
  setError(false);
  setErrorMessage('');

  if (isEmpty(email) || !isEmail(email)) {
    setError(true);
    setErrorMessage(message.emailError);
    return;
  }

  setIsLoading(true);

  try {
    const { data, error } = await supabase.functions.invoke('reset-password', {
      body: { 
        email,
        redirectUrl: `${window.location.origin}/accounts/reset-password`,
      },
    });

    setIsLoading(false);

    if (error) {
      setError(true);
      setErrorMessage(error.message || 'Failed to send reset email');
      return;
    }

    // Always show success (even if email doesn't exist)
    setSentEmail(email);
    setDialogOpen(true);
    setEmail('');

  } catch (err) {
    setIsLoading(false);
    setError(true);
    toast("Network error, Retry", { className: 'bg-red-500 text-white' });
    console.log("Network or unexpected error:", err);
  }
}


    return (
        <Dialog setDialogOpen={setDialogOpen} dialogOpen={dialogOpen}>
            <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
                <div className="w-full -mt-20 max-w-sm">
                    <div className={cn("flex flex-col gap-6")}>
                        <form onSubmit={Submit}>
                            <FieldGroup>
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <a
                                        href="#"
                                        className="flex flex-col items-center gap-2 font-medium"
                                    >
                                        <div className="flex size-8 items-center justify-center rounded-md">
                                            <div className="inline-flex pt-0 md:pt-0 size-8 justify-center">
                                                <Image className="dark:invert w-7/8 scale-75 " src="/logo.png" alt="logo" width={200} height={200} priority />
                                            </div>
                                        </div>
                                    </a>
                                    <h1 className="text-xl text-alt font-bold">Forgot Your Password?</h1>
                                    <FieldDescription>
                                        Enter your email to receive a password reset link
                                    </FieldDescription>
                                </div>

                                <Field>
                                    <FieldLabel htmlFor="email">Email</FieldLabel>
                                    <Input 
                                        id="email" 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)} 
                                        type="email" 
                                        placeholder="m@example.com"
                                        autoComplete="email"
                                    />
                                    <FieldDescription className={'text-xs ml-1'}>
                                        {error && (
                                            <span className="text-orange-500">{errorMessage}</span>
                                        )}
                                    </FieldDescription>
                                </Field>

                                <Field>
                                    <Button disabled={isLoading} className={'bg-core'} type="submit">
                                        {isLoading && <Spinner spinning={isLoading} />}
                                        Send Reset Link
                                    </Button>
                                </Field>

                                <FieldSeparator />

                                <Field>
                                    <Link href="/accounts/login">
                                        <Button variant="outline" type="button" className="w-full">
                                            <ArrowLeft size={16} className="mr-2" />
                                            Back to Login
                                        </Button>
                                    </Link>
                                </Field>
                            </FieldGroup>
                        </form>
                        <FieldDescription className="px-6 text-center">
                            Remember your password? <Link href="/accounts/login" className="text-core hover:underline">Sign in instead</Link>
                        </FieldDescription>
                    </div>
                </div>
            </div>

            <DialogContent className={''}>
                <DialogHeader>
                    <DialogTitle>Reset Link Sent <CheckCircle className="text-green-600 inline ml-2" size={20} /></DialogTitle>
                    <DialogDescription className={'text-neutral-700'}>
                        We&apos;ve sent a password reset link to <span className="text-core font-medium">{sentEmail}</span>. Check your inbox and follow the link to reset your password.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}

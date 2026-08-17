
'use client'
import { useState, useEffect, Suspense } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Spinner } from "@/components/ui/spinner"
import { isEmpty, isEmail } from "validator"
import supabase from "../../../config/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { google, x } from "../../accounts/signup/page";
import { toast } from "sonner";
import Image from "next/image";

export default function InvitationLoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InvitationLoginContent />
    </Suspense>
  )
}

function InvitationLoginContent() {
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState('')
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [companyData, setCompanyData] = useState(null)
  
  const message = {
    emailError: 'valid email address required',
    passwordError: 'password cannot be empty',
    passwordError2: 'incorrect email or password'
  }

  const router = useRouter()
  
  // Extract company info from URL params
  useEffect(() => {
    const companyId = searchParams.get('company_id')
    const companyName = searchParams.get('company_name')
    const logoUrl = searchParams.get('logo_url')
    const invitedBy = searchParams.get('invited_by')
    const inviteId = searchParams.get('invite_id')

    if (companyId && companyName) {
      setCompanyData({
        id: companyId,
        name: companyName,
        logo_url: logoUrl,
        invited_by: invitedBy,
        invite_id: inviteId
      })
    }
  }, [searchParams])
  
  async function Submit(e) {
    e.preventDefault();
    setError(false)
    setErrorMessage('')

    if (isEmpty(email) || !isEmail(email)) {
      setError(true)
      setErrorMessage(message.emailError)
      return
    }
    else if (isEmpty(password)) {
      setError(true)
      setErrorMessage(message.passwordError)
      return
    }
    else {
      setIsLoading(true)
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          setError(true);
          alert(error.message);
          console.log("Login error:", error);
          return;
        }

        if (data.session && data.user) {
          // ✅ Get handle from user_metadata
          const handle = data.user.user_metadata?.handle;

          if (!handle) {
            alert("Profile handle not found. Please contact support.");
            return;
          }

          // ✅ Redirect to user dashboard
          router.push(`/users/${handle}`);
        }

      } catch (err) {
        setError(true);
        toast("Network error, Retry");
        console.log("Network or unexpected error:", err);

      } finally {
        // ✅ Always stop loading
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const isConfirmed = url.searchParams.get('confirmed');

    if (isConfirmed) {
      setEmail(isConfirmed)
      setDialogOpen(true)
      // Clean up the URL so it doesn't repeat on reload
      router.replace('/invitations/login');
    }
  }, [router]);

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN") {
      console.log(true, event)
      localStorage.setItem("login_timestamp", Date.now().toString());
      localStorage.setItem("refresh_count", "0");
    }
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <div className="flex justify-center gap-2 md:justify-start mb-6">
        <a href="/" className="flex items-center gap-2 font-medium">
          <Image 
            className="dark:invert w-8 h-8" 
            src="/logo.png" 
            alt="Nexshelf" 
            width={32} 
            height={32}
          />
        </a>
      </div>
      
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-xs">
          <div className={cn("flex flex-col gap-6")}>
            <form onSubmit={Submit}>
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center mb-2">
                  {companyData?.logo_url && (
                    <img
                      src={companyData.logo_url}
                      alt={companyData.name}
                      className="w-16 h-16 object-contain lg:hidden"
                    />
                  )}
                  <h1 className="text-xl text-army font-bold">Log In to Accept Invitation</h1>
                  <FieldDescription>
                    Login with your credentials to accept the company invitation
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
                    required 
                  />
                  <FieldDescription className={'text-xs ml-1'}>
                    {error && errorMessage == message.emailError && (
                      <span className="text-orange-500">{errorMessage}</span>
                    )}
                  </FieldDescription>
                </Field>
                <Field className={'gap-1'}>
                  <FieldLabel className={'ml-1 mb-0'} htmlFor="password">Password</FieldLabel>
                  <div className="relative">
                    <Input 
                      id="password" 
                      className={'mt-1'} 
                      onChange={(e) => setPassword(e.target.value)} 
                      type={showPassword ? "text" : "password"} 
                      placeholder="***" 
                      required
                    />
                    <Button 
                      type="button" 
                      variant={'ghost'} 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <Link href="/accounts/forgot-password">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        className="h-auto p-0 text-xs text-gray-600 hover:text-gray-800"
                      >
                        Forgot password?
                      </Button>
                    </Link>
                  </div>
                  <FieldDescription className="mt-0 text-xs ml-0.5 transition-all">
                    {error && (errorMessage == message.passwordError || errorMessage == message.passwordError2) && (
                      <span className="text-orange-500">{errorMessage}</span>
                    )}
                  </FieldDescription>
                </Field>
                <Field>
                  <Button disabled={isLoading} className={'bg-core'} type="submit">
                    {isLoading && <Spinner spinning={isLoading} />}
                    Login
                  </Button>
                </Field>
                <FieldSeparator>Or</FieldSeparator>
                <Field className="grid gap-4 sm:grid-cols-2">
                  <Button disabled variant="outline" type="button">
                    {x}
                    Continue with X
                  </Button>
                  <Button disabled variant="outline" type="button">
                    {google}
                    Continue with Google
                  </Button>
                </Field>
              </FieldGroup>
            </form>
            
            {/* Company Info Display */}
            {companyData && (
              <div className="bg-core/10 border-2 border-core/20 rounded-lg p-4 text-center mt-2">
                {companyData.logo_url && (
                  <img
                    src={companyData.logo_url}
                    alt={companyData.name}
                    className="w-12 h-12 object-contain mx-auto mb-2"
                  />
                )}
                <p className="text-xs text-muted-foreground mb-1">Accepting invitation from</p>
                <p className="font-semibold text-core">{companyData.name}</p>
                {companyData.invited_by && (
                  <p className="text-xs text-muted-foreground mt-2">Invited by: {companyData.invited_by}</p>
                )}
              </div>
            )}

            <FieldDescription className="px-6 text-center">
              By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
              and <a href="#">Privacy Policy</a>.
            </FieldDescription>
            <FieldDescription className="px-6 text-center text-sm">
              Don&apos;t have an account yet? <Link href="/invitations/setup" className="text-core font-semibold hover:underline">Complete your sign up</Link>
            </FieldDescription>
          </div>
        </div>
      </div>
      <DialogContent className={''}>
        <DialogHeader>
          <DialogTitle>Email Confirmed <Check className="text-army inline" /></DialogTitle>
          <DialogDescription className={'text-neutral-700'}>
            Your email <span className="text-core">{email}</span> has been confirmed, continue to login.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
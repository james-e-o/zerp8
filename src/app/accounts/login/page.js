'use client'
import { useState,useEffect } from "react";
import { Eye, EyeOff, GalleryVerticalEnd ,Circle,CheckCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {Field,FieldDescription,FieldGroup,FieldLabel,FieldSeparator,} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Spinner } from "@/components/ui/spinner"
import { isEmpty,isEmail,isLength,matches,contains } from "validator"
import  supabase  from "../../../config/supabaseClient";
import { useRouter } from "next/navigation"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger,} from "@/components/ui/dialog"
import { google,x } from "../signup/page";
import { toast } from "sonner";
import Image from "next/image";


export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState('')
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading,setIsLoading] = useState(false)
  const [dialogOpen,setDialogOpen] = useState(false)
  const message = {
    emailError:'valid email address required',
    passwordError :'password cannot be empty',
    passwordError2 :'incorrect email or password'
  }

  const router = useRouter()
  async function Submit(e){
        e.preventDefault();
        setError(false)
        setErrorMessage('')

        if(isEmpty(email) || !isEmail(email)){setError(true),setErrorMessage(message.emailError); return}
        else if(isEmpty(password)){setError(true),setErrorMessage(message.passwordError); return}
        else {

          setIsLoading(true)
            try {
              const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
              })
              const body = await res.json()

              if (!res.ok) {
                setError(true)
                setErrorMessage(body?.error || 'Unable to sign in')
                return
              }

              if (body.handle) {
                router.push(`/users/${body.handle}`)
              } else {
                setError(true)
                setErrorMessage('Login succeeded but user handle is missing')
              }

            } catch (err) {
              setError(true);
              setErrorMessage('Network error, retry');
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
          router.replace('/accounts/login');
        }
      }, [router]);

      useEffect(() => {
        supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN") {
            console.log(true, event)
            localStorage.setItem("login_timestamp", Date.now().toString());
            localStorage.setItem("refresh_count", "0");
          }
        })
      }, [])



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
                <h1 className="text-xl text-army font-bold">Welcome back @ Nexshelf Pro.</h1>
                <FieldDescription>
                  Don&apos;t have an account? <Link href="/accounts/signup">Sign up</Link>
                </FieldDescription>
              </div>
             <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="m@example.com" required />
                <FieldDescription className={'text-xs ml-1'}>
                  {error && errorMessage==message.emailError && (
                    <span className="text-orange-500">{errorMessage}</span>
                  )}
                </FieldDescription>
              </Field>
              <Field className={'gap-1'}>
                <FieldLabel className={'ml-1 mb-0'} htmlFor="password">Password</FieldLabel>
                <div className="relative ">
                  <Input id="password" className={'mt-1'} onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} type={showPassword ? "text" : "password"} placeholder="***" required/>
                  <Button type="button" variant={'ghost'} onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <Link href="/accounts/forgot-password">
                    <Button type="button" variant="ghost" className="h-auto p-0 text-xs text-gray-600 hover:text-gray-800">
                      Forgot password?
                    </Button>
                  </Link>
                </div>
                <FieldDescription className="mt-0 text-xs ml-0.5 transition-all">
                  {error && (errorMessage==message.passwordError||errorMessage==message.passwordError2) && (
                      <span className="text-orange-500">{errorMessage}</span>
                  )}
                </FieldDescription>
              </Field>
              <Field>
                <Button disabled={isLoading} className={'bg-core'} type="submit">{isLoading&&<Spinner spinning={isLoading}/>}Login</Button>
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
          <FieldDescription className="px-6 text-center">
            By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
            and <a href="#">Privacy Policy</a>.
          </FieldDescription>
        </div>
      </div>
    </div>
      <DialogContent className={''}>
        <DialogHeader>
          <DialogTitle>Email Confirmed <Check className="text-army inline"/></DialogTitle>
          <DialogDescription className={'text-neutral-700'}>
            Your email <span className="text-core">{email}</span> has been confirmed, continue to login.
          </DialogDescription>
        </DialogHeader>
        {/* <DialogFooter>
          <DialogAction className={'h-8 -mt-1'}>Ok</DialogAction>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  )
}




'use client'
import { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle, Circle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Spinner } from "@/components/ui/spinner"
import { isEmpty, isLength, contains } from "validator"
import  supabase  from "../../../config/supabaseClient";
import Image from "next/image";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"

export default function ResetPasswordPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [focused, setFocused] = useState(false);
    const [confirmFocused, setConfirmFocused] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const router = useRouter()

    const message = {
      passwordError: 'password must have at least 8 characters that includes at least one number',
      confirmError: 'passwords do not match',
      sessionError: 'Invalid or expired reset link. Please request a new password reset.',
    }

    const rules = {
      length: isLength(password, { min: 8 }),
      number: contains(password, '0') || contains(password, '1') || contains(password, '2') || contains(password, '3') || contains(password, '4') || contains(password, '5') || contains(password, '6') || contains(password, '7') || contains(password, '8') || contains(password, '9'),
      uppercase: /[A-Z]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const allValid = Object.values(rules).every(Boolean);

    useEffect(() => {
      // Check if user has a valid session from password reset link
      const checkSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          setError(true)
          setErrorMessage(message.sessionError)
        }
      }

      checkSession()
    }, [])

    async function Submit(e) {
        e.preventDefault();
        setError(false)
        setErrorMessage('')

        if (isEmpty(password) || !allValid) {
            setError(true)
            setErrorMessage(message.passwordError)
            return
        } else if (isEmpty(confirmPassword) || confirmPassword !== password) {
            setError(true)
            setErrorMessage(message.confirmError)
            return
        }

        setIsLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({
              password: password
            })

            if (error) {
                setIsLoading(false)
                setError(true)
                setErrorMessage(error.message || 'Failed to reset password')
                return
            }

            setIsLoading(false)
            setDialogOpen(true)
            setPassword('')
            setConfirmPassword('')

            // Redirect to login after 2 seconds
            setTimeout(() => {
              router.push('/accounts/login')
            }, 2000)

        } catch (err) {
            setIsLoading(false)
            setError(true)
            toast("Network error, Retry", { className: 'bg-red-500 text-white' })
            console.log("Network or unexpected error:", err)
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
                                    <h1 className="text-xl text-alt font-bold">Set Your New Password</h1>
                                    <FieldDescription>
                                        Create a strong password to secure your account
                                    </FieldDescription>
                                </div>

                                {error && errorMessage === message.sessionError && (
                                    <div className="bg-orange-50 border border-orange-200 rounded p-3">
                                        <FieldDescription className="text-orange-700">
                                            {errorMessage}
                                        </FieldDescription>
                                        <Link href="/accounts/forgot-password">
                                            <Button variant="outline" type="button" className="w-full mt-3">
                                                Request New Reset Link
                                            </Button>
                                        </Link>
                                    </div>
                                )}

                                {!error || errorMessage !== message.sessionError && (
                                    <>
                                        <Field className={'gap-1'}>
                                            <FieldLabel htmlFor="password">New Password</FieldLabel>
                                            <div className="relative">
                                                <Input 
                                                    id="password" 
                                                    className={'mt-1'} 
                                                    value={password} 
                                                    onChange={(e) => setPassword(e.target.value)} 
                                                    onFocus={() => setFocused(true)} 
                                                    onBlur={() => setFocused(false)} 
                                                    type={showPassword ? "text" : "password"} 
                                                    placeholder=""
                                                    autoComplete="new-password"
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
                                            <div className="mt-2 text-[11px] ml-0.5 transition-all">
                                                {(focused || (error && errorMessage === message.passwordError)) && !isEmpty(password) && (
                                                    <ul className="space-y-px">
                                                        <li className={`flex items-center gap-1 ${rules.length ? "text-green-600" : "text-orange-500"}`}>
                                                            {rules.length ? (
                                                                <CheckCircle size={11} />
                                                            ) : (
                                                                <Circle size={11} />
                                                            )}
                                                            At least 8 characters
                                                        </li>
                                                        <li className={`flex items-center gap-1 ${rules.number ? "text-green-600" : "text-orange-500"}`}>
                                                            {rules.number ? <CheckCircle size={11} /> : <Circle size={11} />}
                                                            Contains a number
                                                        </li>
                                                        <li className={`flex items-center gap-1 ${rules.uppercase ? "text-green-600" : "text-orange-500"}`}>
                                                            {rules.uppercase ? (
                                                                <CheckCircle size={11} />
                                                            ) : (
                                                                <Circle size={11} />
                                                            )}
                                                            One uppercase letter
                                                        </li>
                                                        <li className={`flex items-center gap-1 ${rules.special ? "text-green-600" : "text-orange-500"}`}>
                                                            {rules.special ? (
                                                                <CheckCircle size={11} />
                                                            ) : (
                                                                <Circle size={11} />
                                                            )}
                                                            One special character
                                                        </li>
                                                    </ul>
                                                )}
                                            </div>
                                        </Field>

                                        <Field className={'gap-1'}>
                                            <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                                            <div className="relative">
                                                <Input 
                                                    id="confirm-password" 
                                                    className={'mt-1'} 
                                                    value={confirmPassword} 
                                                    onChange={(e) => setConfirmPassword(e.target.value)} 
                                                    onFocus={() => setConfirmFocused(true)} 
                                                    onBlur={() => setConfirmFocused(false)} 
                                                    type={showConfirmPassword ? "text" : "password"} 
                                                    placeholder=""
                                                    autoComplete="new-password"
                                                />
                                                <Button 
                                                    type="button" 
                                                    variant={'ghost'} 
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                                >
                                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </Button>
                                            </div>
                                            <div className="mt-2 text-[11px] ml-0.5 transition-all">
                                                {(confirmFocused || (error && errorMessage === message.confirmError)) && !isEmpty(confirmPassword) && (
                                                    <ul className="space-y-px">
                                                        <li className={`flex items-center gap-1 ${confirmPassword === password ? "text-green-600" : "text-orange-500"}`}>
                                                            {confirmPassword === password ? (
                                                                <CheckCircle size={11} />
                                                            ) : (
                                                                <Circle size={11} />
                                                            )}
                                                            {confirmPassword === password ? "Passwords match" : "Passwords do not match"}
                                                        </li>
                                                    </ul>
                                                )}
                                            </div>
                                            <FieldDescription className={'text-xs ml-1'}>
                                                {error && errorMessage !== message.sessionError && (
                                                    <span className="text-orange-500">{errorMessage}</span>
                                                )}
                                            </FieldDescription>
                                        </Field>

                                        <Field>
                                            <Button disabled={isLoading} className={'bg-core'} type="submit">
                                                {isLoading && <Spinner spinning={isLoading} />}
                                                Reset Password
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
                                    </>
                                )}
                            </FieldGroup>
                        </form>
                    </div>
                </div>
            </div>

            <DialogContent className={''}>
                <DialogHeader>
                    <DialogTitle>Password Reset Successful <CheckCircle className="text-green-600 inline ml-2" size={20} /></DialogTitle>
                    <DialogDescription className={'text-neutral-700'}>
                        Your password has been successfully reset. You will be redirected to the login page shortly.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}

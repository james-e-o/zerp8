'use client'

import { Suspense } from 'react'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { cn } from "@/lib/utils"
import { TriangleAlert, Eye, EyeOff } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { isEmpty, isLength, contains } from "validator"
import supabase from '../../../config/supabaseClient'

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupPageContent />
    </Suspense>
  )
}

function SignupPageFallback() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="bg-linear-to-br from-core/55 to-army/50 relative hidden lg:flex lg:flex-col lg:items-center lg:justify-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=1000&h=1000&fit=crop"
          alt="Team working together"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-core/40 to-army/10"></div>
      </div>
      <div className="flex flex-col gap-4 p-6 md:p-10 overflow-y-auto max-h-svh">
        <div className="flex justify-center gap-2 md:justify-start">
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
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-core border-t-transparent rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SignupPageContent() {
  const searchParams = useSearchParams()
  const [companyData, setCompanyData] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [caseType, setCaseType] = useState(null) // 'no-invite' | 'continue-onboarding' | 'success' | 'already-signed-up' | 'error'
  const [hasValidated, setHasValidated] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (hasValidated) return

    let isMounted = true

    const runValidation = async (session) => {
      if (!isMounted) return

      try {
      const emailParam = searchParams.get('email')
      const errorParam = searchParams.get('error')
      const errorCode = searchParams.get('error_code')

      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const hashError = hashParams.get('error')
      const hashErrorCode = hashParams.get('error_code')
      const hasError = errorParam || hashError

      // Check the link-level error FIRST, regardless of any existing session
      if (hasError && emailParam && (errorCode === 'otp_expired' || hashErrorCode === 'otp_expired')) {
        setUserEmail(emailParam)
        setCaseType('continue-onboarding')
        setLoading(false)
        setHasValidated(true)
        return
      }

      if (hasError) {
        setError('System failure, contact your inviting company.')
        setCaseType('error')
        setLoading(false)
        setHasValidated(true)
        return
      }

      const hasSession = !!session?.user

      if (!hasSession) {
        setError('You have not been invited by any company.')
        setCaseType('no-invite')
        setLoading(false)
        setHasValidated(true)
        return
      }

// ...rest of the "we have a confirmed session" logic unchanged
        // We have a confirmed session — the auth.users row (and by
        // extension the public.users row, via sync_confirmed_user) already
        // exists at this point; that was never in question. The real
        // question is whether the profile is actually complete — username,
        // handle, and password all set — which is exactly what
        // check_profile_completed() verifies directly, rather than us
        // guessing from whether one column happens to be non-null.
        const user = session.user
        setUserEmail(user.email)

        const { data: isComplete, error: checkError } = await supabase
          .rpc('check_profile_completed', { p_user_id: user.id })

        if (checkError) {
          console.error('Error checking profile completion:', checkError)
          setError('An error occurred. Please contact your administrator.')
          setCaseType('error')
          setLoading(false)
          setHasValidated(true)
          return
        }

        // isComplete is null if no public.users row matched at all (should
        // not happen given the trigger, but treated as incomplete rather
        // than crashing if it ever does) — otherwise it's the real boolean.
        const profileIncomplete = isComplete !== true

        if (profileIncomplete) {
          const metadata = user.user_metadata
          if (metadata?.company_id && metadata?.company_name) {
            setCompanyData({
              id: metadata.company_id,
              name: metadata.company_name,
              logo_url: metadata.logo_url,
              invited_by: metadata.invited_by,
              invite_id: metadata.invite_id
            })
            setUserEmail(user.email)
            setCaseType('success')
            setLoading(false)
            setHasValidated(true)
            return
          } else {
            setError('Company information not found. Please contact your administrator.')
            setCaseType('error')
            setLoading(false)
            setHasValidated(true)
            return
          }
        }

        // Profile IS complete (username, handle, and password all set) —
        // this person genuinely already finished signup before.
        setError("You've been successfully signed up. Log in to check your invite status.")
        setCaseType('already-signed-up')
        setLoading(false)
        setHasValidated(true)

      } catch (err) {
        console.error('Error in validation:', err)
        setError('An unexpected error occurred.')
        setCaseType('error')
        setLoading(false)
        setHasValidated(true)
      }
    }

    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const hashHasAuthTokens = Boolean(accessToken && refreshToken)

    if (hashHasAuthTokens) {
      let validationStarted = false
      const validateOnce = (session) => {
        if (validationStarted) return
        validationStarted = true
        runValidation(session)
      }

      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          validateOnce(session)
        }
      })

      const establishSession = async () => {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (sessionError) {
          console.error('Unable to establish invitation session:', sessionError)
          const { data: currentSession } = await supabase.auth.getSession()
          validateOnce(currentSession?.session)
          return
        }

        validateOnce(data?.session)
      }

      establishSession()

      const timeout = setTimeout(async () => {
        const { data } = await supabase.auth.getSession()
        validateOnce(data?.session)
      }, 4000)

      return () => {
        isMounted = false
        clearTimeout(timeout)
        listener.subscription.unsubscribe()
      }
    } else {
      supabase.auth.getSession().then(({ data }) => runValidation(data?.session))
    }

    return () => {
      isMounted = false
    }
  }, [hasValidated])

  return (
    <>
      <div className="flex justify-center gap-2 md:justify-start">
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
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-core border-t-transparent rounded-full"></div>
            </div>
          )}

          {!loading && (caseType === 'no-invite' || caseType === 'error') && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="text-army mb-2">
                <TriangleAlert className="size-20" />
              </div>
              <div className="bg-core/10 border-2 border-core/30 rounded-lg p-6 text-center">
                <p className="text-core font-semibold mb-2">Access Required</p>
                <p className="text-core/80 text-sm">{error}</p>
              </div>
              <a href="/" className="text-core hover:underline text-sm font-medium">
                Back to Home
              </a>
            </div>
          )}

          {!loading && caseType === 'success' && (
            <SignupForm
              companyData={companyData}
              userEmail={userEmail}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              showConfirmPassword={showConfirmPassword}
              setShowConfirmPassword={setShowConfirmPassword}
            />
          )}

          {!loading && caseType === 'continue-onboarding' && (
            <ContinueOnboardingForm userEmail={userEmail} />
          )}

          {!loading && caseType === 'already-signed-up' && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="text-army mb-2">
                <TriangleAlert className="size-20" />
              </div>
              <div className="bg-core/10 border-2 border-core/30 rounded-lg p-6 text-center">
                <p className="text-core font-semibold mb-2">Already Signed Up</p>
                <p className="text-core/80 text-sm">{error}</p>
              </div>
              <a href="/accounts/login" className="text-core hover:underline text-sm font-medium">
                Go to Login
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ==========================
// SIGNUP FORM COMPONENT
// ==========================

export function SignupForm({
  className,
  companyData,
  userEmail,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  ...props
}) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    username: '@',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [usernameExists, setUsernameExists] = useState(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const debounceTimer = useRef(null)
  const usernameCheckId = useRef(0)

  const message = {
    usernameError: 'username is required',
    passwordError: 'password must have at least 8 characters that includes at least one number, one uppercase letter, and one special character',
    validateError: 'password does not match',
    usernameExistsError: 'username already exists',
  }

  const rules = {
    length: isLength(formData.password, { min: 8 }),
    number: /[0-9]/.test(formData.password),
    uppercase: /[A-Z]/.test(formData.password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  }

  const allValid = Object.values(rules).every(Boolean)

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const checkUsernameAvailability = async (usernameToCheck) => {
    if (!usernameToCheck || isEmpty(usernameToCheck) || usernameToCheck === '@') {
      setUsernameExists(null)
      setCheckingUsername(false)
      return
    }

    const requestId = ++usernameCheckId.current
    setCheckingUsername(true)

    try {
      const { data: existing, error } = await supabase
        .from("users")
        .select("id")
        .eq("username", usernameToCheck.toLowerCase())
        .maybeSingle()

      if (requestId !== usernameCheckId.current) return

      if (error) {
        console.error("Error checking username:", error)
        setUsernameExists(null)
      } else {
        setUsernameExists(existing ? true : false)
      }
    } catch (err) {
      if (requestId !== usernameCheckId.current) return
      console.error("Unexpected error checking username:", err)
      setUsernameExists(null)
    } finally {
      if (requestId === usernameCheckId.current) {
        setCheckingUsername(false)
      }
    }
  }

  const handleUsernameChange = (e) => {
    const inputValue = e.target.value.toLowerCase()
    const cleanValue = inputValue.replace(/[^a-z0-9_$]/g, '')
    const stateValue = `@${cleanValue}`
    setFormData(prev => ({ ...prev, username: stateValue }))
    setError('')

    if (!cleanValue) {
      setUsernameExists(null)
      setCheckingUsername(false)
      return
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      checkUsernameAvailability(stateValue)
    }, 500)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (isEmpty(formData.username) || formData.username === '@') {
      setError(message.usernameError)
      return
    }

    if (usernameExists) {
      setError(message.usernameExistsError)
      return
    }

    if (!allValid) {
      setError(message.passwordError)
      return
    }

    if (isEmpty(formData.confirmPassword) || formData.confirmPassword !== formData.password) {
      setError(message.validateError)
      return
    }

    setIsSubmitting(true)

    try {
      setSignupSuccess(true)

    } catch (err) {
      console.error('Error submitting form:', err)
      setError(err.message || 'An error occurred while setting up your profile. Please refresh and try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <form className={cn("flex flex-col pb-3 gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        {signupSuccess && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="text-army mb-2">
              <div className="w-16 h-16 rounded-full bg-army/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-army" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="text-center space-y-3">
              <p className="text-lg font-semibold text-core">Account Created Successfully!</p>
              <p className="text-sm text-core/80">Your account and invitation have been accepted. Please log in to continue.</p>
            </div>
            <Button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut()
                const params = new URLSearchParams()
                if (companyData?.id) params.append('company_id', companyData.id)
                if (companyData?.name) params.append('company_name', companyData.name)
                if (companyData?.logo_url) params.append('logo_url', companyData.logo_url)
                if (companyData?.invited_by) params.append('invited_by', companyData.invited_by)
                if (companyData?.invite_id) params.append('invite_id', companyData.invite_id)

                const loginUrl = `/invitations/login${params.toString() ? '?' + params.toString() : ''}`
                router.push(loginUrl)
              }}
              className="bg-army hover:bg-army/90 text-white font-semibold w-full mt-4"
            >
              Go to Login
            </Button>
          </div>
        )}

        {!signupSuccess && (
          <>
            <div className="flex flex-col items-center gap-4 text-center mb-2">
              {companyData?.logo_url && (
                <img
                  src={companyData.logo_url}
                  alt={companyData.name}
                  className="w-16 h-16 object-contain lg:hidden"
                />
              )}
              <div className="space-y-1 w-full">
                <div className="text-lg font-semibold text-muted-foreground">
                  Sign up and Accept Invitation <br /> from
                  <span className="text-lg ml-2 font-semibold text-army">
                    {companyData?.name}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Setup your credentials to complete your sign up on Nexshelf Pro
                </p>
              </div>
            </div>

            <div className="bg-muted px-3 py-3 rounded text-sm mb-1">
              <p className="text-muted-foreground text-xs mb-1">Email</p>
              <p className="font-medium">{userEmail}</p>
            </div>

            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium">@ </span>
                <Input
                  id="username"
                  name="username"
                  className="pl-6"
                  value={formData.username.replace('@', '')}
                  onChange={handleUsernameChange}
                  type="text"
                  placeholder="your_username"
                  autoComplete="username"
                />
                {checkingUsername && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    <div className="animate-spin h-4 w-4 border-2 border-core border-t-transparent rounded-full"></div>
                  </span>
                )}
                {!checkingUsername && formData.username && formData.username !== '@' && usernameExists === false && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">✓</div>
                )}
              </div>
              <FieldDescription className="text-xs ml-1">
                {error === message.usernameError && (
                  <span className="text-core">{error}</span>
                )}
                {error === message.usernameExistsError && (
                  <span className="text-core">{error}</span>
                )}
                {!error && formData.username && formData.username !== '@' && !checkingUsername && usernameExists === false && (
                  <span className="text-army">username is available</span>
                )}
                {!error && formData.username && formData.username !== '@' && !checkingUsername && usernameExists === true && (
                  <span className="text-core">username already taken</span>
                )}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="•••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="text-xs space-y-1 mt-2">
                <div className={rules.length ? 'text-army' : 'text-gray-400'}>
                  ✓ At least 8 characters
                </div>
                <div className={rules.number ? 'text-army' : 'text-gray-400'}>
                  ✓ At least one number
                </div>
                <div className={rules.uppercase ? 'text-army' : 'text-gray-400'}>
                  ✓ At least one uppercase letter
                </div>
                <div className={rules.special ? 'text-army' : 'text-gray-400'}>
                  ✓ At least one special character (!@#$%^&*)
                </div>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
              <div className="relative">
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder=""
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="bg-core/10 border-2 border-core/30 rounded-lg p-4 flex gap-3 items-start">
                <TriangleAlert className="w-5 h-5 text-army shrink-0 mt-0.5" />
                <p className="text-core text-sm">{error}</p>
              </div>
            )}

            <Field>
              <Button
                type="submit"
                disabled={isSubmitting || usernameExists === true || !allValid || formData.confirmPassword !== formData.password}
                className="bg-core hover:bg-core/90 text-white font-normal w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Signing up...' : 'Complete Sign Up'}
              </Button>
            </Field>

            <FieldSeparator>or</FieldSeparator>

            <FieldDescription className="px-6 text-center">
              Already have an account? <a href="/accounts/login" className="text-core hover:underline font-semibold">Sign in</a>
            </FieldDescription>
          </>
        )}
      </FieldGroup>
    </form>
  )
}

// ==========================
// CONTINUE ONBOARDING FORM
// ==========================

export function ContinueOnboardingForm({ userEmail }) {
  const [isSending, setIsSending] = useState(false)
  const [sentSuccessfully, setSentSuccessfully] = useState(false)
  const [error, setError] = useState('')

  const handleSendOTP = async () => {
    setIsSending(true)
    setError('')

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/invitations/setup?email=${encodeURIComponent(userEmail)}`
        }
      })

      if (otpError) throw otpError
      setSentSuccessfully(true)
    } catch (err) {
      console.error('Error sending OTP:', err)
      setError('Failed to send verification code. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  if (sentSuccessfully) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="w-16 h-16 rounded-full bg-green-200 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="bg-core/10 border-2 border-core/30 rounded-lg p-6 text-center">
          <p className="text-core font-semibold mb-2">Verification Code Sent</p>
          <p className="text-core/80 text-sm">We've sent a verification code to {userEmail}</p>
          <p className="text-core/80 text-sm mt-3">Please check your email to continue with your onboarding.</p>
        </div>
      </div>
    )
  }

  return (
    <form className="space-y-6">
      <FieldGroup>
        <div className="mb-6">
          <h2 className="text-lg text-center font-bold text-army mb-2">Continue Your Onboarding</h2>
          <p className="text-gray-600 text-sm">Your invitation has expired. Click the button below to generate a new verification code and continue onboarding.</p>
        </div>

        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 flex gap-3 items-start">
          <TriangleAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 text-sm font-semibold">Your one-time session has expired</p>
            <p className="text-amber-700 text-xs mt-1">Generate a new session to continue onboarding.</p>
          </div>
        </div>

        <Field>
          <FieldLabel>Email Address</FieldLabel>
          <Input
            type="email"
            value={userEmail}
            className="bg-gray-50"
            disabled
          />
        </Field>

        {error && (
          <div className="bg-core/10 border-2 border-core/30 rounded-lg p-4 flex gap-3 items-start">
            <TriangleAlert className="w-5 h-5 text-army shrink-0 mt-0.5" />
            <p className="text-core text-sm">{error}</p>
          </div>
        )}

        <Field>
          <Button
            type="button"
            onClick={handleSendOTP}
            disabled={isSending}
            className="bg-core hover:bg-core/90 text-white font-semibold w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? 'Sending...' : 'Get Link'}
          </Button>
        </Field>

        <FieldDescription className="px-6 text-center">
          Already have an account? <a href="/accounts/login" className="text-core hover:underline font-semibold">Sign in</a>
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}
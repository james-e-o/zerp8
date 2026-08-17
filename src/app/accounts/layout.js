import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

const AccountLayout = ({children}) => {
  return (
    <div>
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-border">
        <div className=" flex items-center justify-between px-5 md:px-10 py-3">
          {/* LOGO */}
          <Link href="/" className="font-Madetommy text-alt inline-flex font-bold text-xl md:text-2xl ">
          <div className="inline-flex pt-0 md:pt-0 size-8 justify-center">
              <Image className="dark:invert w-7/8 scale-75 " src="/logo.png" alt="logo" width={200} height={200} priority />
          </div>
          NEXSHELF
        </Link>
        </div>
      </header>
      {children}
    </div>
  )
}

export default AccountLayout


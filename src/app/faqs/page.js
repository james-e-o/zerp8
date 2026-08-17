'use client'
import { useState,useEffect } from "react";
import LandingHeader from "@/components/landing-header";
// import profilePix from '../../public/profilepix2.jpg'
import Link from "next/link";

const Faqs = () => {
  const [dropState, setDropState] = useState(false)
    useEffect(()=>{
      document.onpointerdown = ({target}) => {
        if(dropState&&target.closest('div#drop-box'))return
        else if(dropState) {
          setDropState(!dropState)
        }
      }
    })
  return (
    <div className="relative h-full overflow-x-clip z-0 overflow-y-scroll">
      <LandingHeader />
      <main className="md:px-10 sm:px-8 lg:px-12 px-6 py-10">
              <div className="p-4">
                <h1 className="font-Clash text-5xl font-bold">FAQs.</h1>
                <p className="text-xs">Frequently asked questions</p>
              </div>
               {/* <div className="p-4 mb-3">
                    <p className="border-b p-2 font-semibold text-sm">Teams</p>
               </div>
               <div className="p-4 mb-3">
                    <p className="border-b p-2 font-semibold text-sm">Teams</p>
               </div> */}

          </main>
    </div>
  )
}

export default Faqs

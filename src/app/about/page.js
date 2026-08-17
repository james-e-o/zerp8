'use client'
import { useState,useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import LandingHeader from "@/components/landing-header";
import Image from "next/image"
import { menuX } from "../page";

// import profilePix from '../../public/profilepix2.jpg'
import Link from "next/link";

const About = () => {
 
  return (
    <div  onScroll={(e)=>{dropState?setDropState(false):''}} className="relative h-full overflow-x-clip z-0 overflow-y-scroll">
          <LandingHeader />
          <main className="md:px-10 sm:px-8 lg:px-12 px-6 py-10">
               <h1 className="font-Clash text-5xl font-bold p-4">About us</h1>
               <div className="p-4 mb-3">
                    <p className="border-b p-2 font-semibold text-sm">Teams</p>
               </div>
               <div className="p-4 mb-3">
                    <p className="border-b p-2 font-semibold text-sm">Teams</p>
               </div>

          </main>
    </div>
  )
}

export default About

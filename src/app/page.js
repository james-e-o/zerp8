'use client'
import { useState,useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, MoveRight, Store,XIcon } from "lucide-react";
import Image from "next/image"
import LandingHeader from "@/components/landing-header";

import profilePix from '../../public/profilepix2.jpg'
import Link from "next/link";
import FeatureScroller from "@/components/scroller";

export default function Home() {
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
    <div onScroll={(e)=>{dropState?setDropState(false):''}} className="relative h-full no_scroll overflow-x-hidden z-0 ">
      <LandingHeader />
      <main className=" bg-linear-to-b from-white via-sky-200 to-violet-500/30">
        <section className="min-h-[75svh] mb-36 flex flex-col px-10 items-center justify-center">
          <div >
            <p className="text-5xl text-center font-extralight text-army leading-[110%] font-WixMade md:mt-7 md:text-8xl tracking-tighter">Manage your Product <br/>  & Store with ease.</p>
          </div>
          <div className=" text-center font-WixMade tracking-tight text-core_contrast md:w-3/5 text-lg md:text-xl mt-5 font-light ">nexShelf gives you the complete control you need with <span  className="font-semibold"> effortless <br/>product management and B-2-B </span>.</div>
        
          <Link href={'/pricing'} className="decoration-none mt-10 mx-auto">
            <p className=" bg-white/25 border border-zinc-300 rounded-full  p-4 flex justify-center items-center">
              <Button className="md:text-lg bg-core hover:bg-core/85 rounded-4xl font-medium font-WixMade text-white text-base grow py-6" ><p className="px-7 gap-2 flex items-center"><Store className="size-4"/><span>Get started</span></p></Button>
            </p>
          </Link>
        </section>
        <section className=" rounded-4xl px-16 pt-16 pb-12 overflow-clip relative before:absolute before:inset-0 before:bg-linear-to-b before:from-army/80 before:from-80% before:to-transparent  z-0 before:z-1 coporate1">
          <FeatureScroller />
        </section>
      {/* </main> */}
      <div className=" relative   p-10">
      <div className="    rounded-3xl overflow-clip ">

        

            <section className="py-24 font-WixMade  bg-white">
              <div className="max-w-6xl mx-auto text-center px-6">
                <h2 className="text-4xl md:text-6xl font-bold text-core">
                  Join over <span className="text-army">100,000+</span> NexShelf users
                </h2>
                <p className="mt-6 text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">
                  Thousands of store owners and businesses already trust NexShelf to manage 
                  their inventory, sales, and growth — all in one powerful platform.
                </p>

                <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-gray-500 text-sm">
                  <div>
                    <h4 className="text-2xl font-bold text-core">100K+</h4>
                    <p>Active Stores</p>
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-core">1M+</h4>
                    <p>Transactions Processed</p>
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-core">95%</h4>
                    <p>User Satisfaction</p>
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-core">60+</h4>
                    <p>Countries Supported</p>
                  </div>
                </div>
              </div>
            </section>



            <section className="py-24 bg-white font-WixMade relative overflow-hidden">
              {/* Decorative animated circle */}
              <div className="absolute inset-0 flex justify-start items-center opacity-10">
                <div className="w-[400px] h-[400px] relative  bg-linear-to-tr from-core to-lime-400/40 rounded-full animate-spin-slow blur-3xl"></div>
              </div>

              <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center px-6 relative z-10">
                {/* Image */}
                <div className="relative order-2 md:order-1">
                  <div className="relative w-full">
                    <img
                      src="/images/mockup-desktop.png"
                      alt="Desktop View"
                      className="rounded-3xl border border-gray-100"
                    />
                    <img
                      src="/images/mockup-mobile.png"
                      alt="Mobile View"
                      className="absolute -bottom-10 -right-10 w-1/3 rounded-2xl border border-gray-100 transform hover:translate-y-2 transition-all duration-300"
                    />
                  </div>
                </div>

                {/* Text */}
                <div className="order-1 md:order-2">
                  <h2 className="text-4xl md:text-5xl font-bold text-core leading-tight">
                    Run your business <span className="text-army">anywhere</span>
                  </h2>
                  <p className="mt-6 text-gray-600 text-lg leading-relaxed">
                    NexShelf gives you full control — whether you’re on desktop or mobile. 
                    Track inventory, manage staff, and handle orders with ease across all devices.
                  </p>
                  <a
                    href="#"
                    className="mt-8 inline-block text-core hover:text-army font-semibold transition-colors duration-300"
                  >
                    Discover NexShelf mobile →
                  </a>
                </div>
              </div>
            </section>




            <section className="py-24 font-WixMade bg-white relative">
              {/* Soft decorative background */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-army/10 blur-3xl rounded-full"></div>
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-core/10 blur-2xl rounded-full"></div>

              <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center relative z-10">
                {/* Text */}
                <div>
                  <h2 className="text-4xl md:text-5xl font-bold text-core leading-tight">
                    Build your <span className="text-army">storefront</span>, manage your <span className="text-core">B2B</span> with ease
                  </h2>
                  <p className="mt-6 text-gray-600 text-lg leading-relaxed">
                    With NexShelf, launch your e-commerce store in minutes and connect with other 
                    businesses seamlessly. From inventory to invoicing — NexShelf keeps everything 
                    unified, flexible, and professional.
                  </p>

                  <div className="mt-10 flex flex-wrap gap-4">
                    <button className="bg-core hover:bg-army text-white px-10 py-4 rounded-2xl font-medium text-lg transition-all duration-300">
                      Launch Store
                    </button>
                    <button className="border border-army text-army hover:bg-army hover:text-white px-10 py-4 rounded-2xl font-medium text-lg transition-all duration-300">
                      Explore B2B Tools
                    </button>
                  </div>
                </div>

                {/* Image */}
                <div className="relative">
                  <img
                    src="/images/commerce-dashboard.png"
                    alt="Commerce Dashboard"
                    className="rounded-3xl border border-gray-100"
                  />
                  <div className="absolute -top-6 -left-6 w-12 h-12 bg-lime-600-400/40 rounded-full blur-xl"></div>
                  <div className="absolute bottom-4 right-4 w-16 h-16 bg-army-300/30 rounded-full blur-2xl"></div>
                </div>
              </div>
            </section>



        </div>
      </div>
      
      </main>
      <footer className="p-5 border-t border-border text-sm">
        <div className="px-0 md:px-7 md:grid-cols-3 grid grid-cols-1">
          <div className="p-3 flex flex-col ">
            <p className="font-Madetommy p-1 text-lg font-semibold text-army">NEXSHELF</p>
            <p className="text-sm px-1 font-extralight">Simplify your commerce with nexShelf.</p>
            <p className="p-1">Copyright &copy; {new Date().getFullYear()} - All rights reserved.</p>
          </div>
        </div>
        <div className="flex items-center md:px-7 mb-3 md:mb-7 gap-1 mt-4">
          <Avatar className='flex items-center justify-center'>
            <Image src={profilePix} className="" alt="@storeprobuilder"/>
            {/* <AvatarFallback>JO</AvatarFallback> */}
          </Avatar>
          <p className="ml-2 font-thin">Hello There{`👋🏽`} I'm <span className="font-semibold text-[slateblue]">James,</span> builder of nexShelf. You can view my work on <a className="underline text-[slateblue]" href="https://profile-beige-one.vercel.app/">profile</a></p>
        </div>
      </footer>
    </div>
  );
}

export const menuX = <svg data-name="Layer 1" className="w-5 h-5" id="Layer_1" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M21.86,18.73H9.18a2,2,0,0,1,0-4H21.86a2,2,0,0,1,0,4Z"/><path d="M54.82,18.73H34.88a2,2,0,0,1,0-4H54.82a2,2,0,0,1,0,4Z"/><path d="M54.82,34H9.18a2,2,0,0,1,0-4H54.82a2,2,0,0,1,0,4Z"/><path d="M54.82,49.27H30.07a2,2,0,0,1,0-4H54.82a2,2,0,0,1,0,4Z"/></svg>


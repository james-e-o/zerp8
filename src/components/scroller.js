"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Track sales in real time.",
  },
  {
    title: "Manage staff on-site.",
  },
  {
    title: "Manage stock in store.",
  },
  {
    title: "Control purchases with ease.",
  },

];

export default function FeatureScroller() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-scroll every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className=" text-white  flex flex-col space-y-8 rounded-lg  z-10">
        
    <div className="flex flex-col md:flex-row items-center  z-10 md:h-[58vh] md:gap-20 mb-0 gap-5 md:justify-between ">
      {/* Left Text Section */}
      <div className="w-full md:w-1/2 flex-col justify-between h-full flex ">
            <p className="font-WixMade min-w-2/6 tracking-tighter leading-tight text-white text-pretty font-thin text-[40px]">One Platform. Every Store. Every Sale.</p>
            <div className="mt-3 md:mt-4 h-20 leading-snug overflow-hidden md:h-fit">
         
                {features.map((feature, index) => (
                    <span
                    key={index}
                    className={`transition-colors text-2xl duration-300 ${
                        index === activeIndex
                        ? "text-cyan-300" // highlighted (change this to your accent color)
                        : "text-gray-400"
                    }`}
                    >
                    {feature.title}
                    </span>
                ))}  
            </div>
            <Button className='rounded-full hidden md:block text-black w-fit h-12 px-7 py-2 bg-sky-300 border-[3px] border-zinc-500'>Get Started</Button>
      </div>

      {/* Right Scrolling Section */}
      <div className="w-full md:w-[45%] h-80 overflow-hidden relative top-[2%] rounded-lg border border-gray-200">
        <div className="absolute flex h-80 top-0 left-0 w-full transition-transform duration-700"
        //   style={{ transform: `translateY(-${activeIndex * 100}%)` }}
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {features.map((item, index) => (
              <div
              key={index}
              className=" h-full flex scroll_item items-center justify-center bg-core/10 text-white text-2xl font-bold"
              >
              {item.title}
            </div>
          ))}
        </div>
      </div>
    </div>
          <Button className='rounded-full md:hidden text-black w-fit h-12 px-7 py-2 bg-sky-300 border-[3px] border-zinc-500'>Get Started</Button>
      
    </div>
  );
}


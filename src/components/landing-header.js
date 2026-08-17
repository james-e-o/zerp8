"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, Menu } from "lucide-react";
import { Button } from "./ui/button";
import Image from "next/image";

const LandingHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  // close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpen && !e.target.closest("#mobile-menu")) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [menuOpen]);

  // lock scroll when menu is open
  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-border">
      <div className=" flex items-center justify-between px-5 md:px-10 py-3">
        {/* LOGO */}
        <Link href="/" className="font-Inter tracking-tight inline-flex font-extrabold text-xl md:text-2xl text-alt">
          <div className="inline-flex pt-0 md:pt-0 size-8 justify-center">
              <Image className="dark:invert w-7/8 scale-75 " src="/logo.png" alt="logo" width={200} height={200} priority />
          </div>
          NEXSHELF
        </Link>

        {/* NAV LINKS (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 font-Inter font-medium text-base text-primary">
          <NavLink href="/pricing">Pricing</NavLink>
          <NavLink href="/about">About</NavLink>
          <NavLink href="/faqs">FAQs</NavLink>
          <Link href="/accounts/login">
            <Button
              size="sm"
              className="rounded-lg px-6 py-2 bg-core hover:bg-core/65 text-white"
            >
              Log in
            </Button>
          </Link>
        </nav>

        {/* MOBILE CONTROLS */}
        <div className="flex items-center gap-3 md:hidden">
          <Link href="/accounts/login">
            <Button
              variant="outline"
              size="sm"
              className="border-core_polish bg-core hover:bg-core/65 text-white font-medium px-3 py-1"
            >
              Log in
            </Button>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </div>

      {/* MOBILE MENU */}
      <div
        id="mobile-menu"
        className={`absolute left-0 top-0 w-full bg-white transition-all duration-300 ease-in-out ${
          menuOpen ? "opacity-100 translate-y-0 z-30" : "opacity-0 -translate-y-full -z-10"
        }`}
      >
        <div className="flex flex-col items-center font-medium text-lg p-8">
          <button
            onClick={() => setMenuOpen(false)}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="mt-12 flex flex-col items-center space-y-6 text-primary">
            <NavLink href="/pricing" onClick={() => setMenuOpen(false)}>
              Pricing
            </NavLink>
            <NavLink href="/about" onClick={() => setMenuOpen(false)}>
              About
            </NavLink>
            <NavLink href="/faqs" onClick={() => setMenuOpen(false)}>
              FAQs
            </NavLink>

            <Link href="/accounts/login" onClick={() => setMenuOpen(false)}>
              <Button
                size="sm"
                className="rounded-lg px-8 mt-5 py-3 text-base bg-core hover:bg-core/65 text-white"
              >
                Log in
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

/* ✅ Clean NavLink wrapper for consistent styles */
const NavLink = ({ href, children, onClick }) => (
  <Link
    href={href}
    onClick={onClick}
    className="hover:text-gradient2 transition-colors duration-200"
  >
    {children}
  </Link>
);

export default LandingHeader;


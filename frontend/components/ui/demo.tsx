"use client";

import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { LayoutDashboard, UserCog, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function SidebarDemo() {
  const links = [
    {
      label: "Dashboard",
      href: "#",
      icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-stone-100" />,
    },
    {
      label: "Profile",
      href: "#",
      icon: <UserCog className="h-5 w-5 flex-shrink-0 text-stone-100" />,
    },
    {
      label: "Settings",
      href: "#",
      icon: <Settings className="h-5 w-5 flex-shrink-0 text-stone-100" />,
    },
    {
      label: "Logout",
      href: "#",
      icon: <LogOut className="h-5 w-5 flex-shrink-0 text-stone-100" />,
    },
  ];
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "mx-auto flex h-[60vh] w-full max-w-7xl flex-1 flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-stone-100 md:flex-row"
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: "Manu Arora",
                href: "#",
                icon: (
                  <Image
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80"
                    className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                    width={50}
                    height={50}
                    alt="Avatar"
                  />
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
      <Dashboard />
    </div>
  );
}

export const Logo = () => {
  return (
    <Link href="#" className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-stone-100">
      <div className="h-5 w-6 flex-shrink-0 rounded-bl-sm rounded-br-lg rounded-tl-lg rounded-tr-sm bg-amber-300" />
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-pre font-medium">
        Acet Labs
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link href="#" className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-stone-100">
      <div className="h-5 w-6 flex-shrink-0 rounded-bl-sm rounded-br-lg rounded-tl-lg rounded-tr-sm bg-amber-300" />
    </Link>
  );
};

const Dashboard = () => {
  return (
    <div className="flex flex-1 bg-white">
      <div className="flex h-full w-full flex-1 flex-col gap-2 rounded-tl-[28px] bg-white p-6">
        <div className="flex gap-2">
          {[...new Array(4)].map((i) => (
            <div key={`first-array-${i}`} className="h-20 w-full animate-pulse rounded-2xl bg-stone-100" />
          ))}
        </div>
        <div className="flex flex-1 gap-2">
          {[...new Array(2)].map((i) => (
            <div key={`second-array-${i}`} className="h-full w-full animate-pulse rounded-2xl bg-stone-100" />
          ))}
        </div>
      </div>
    </div>
  );
};

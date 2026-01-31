


import { useState } from "react";
import { useLocation } from "react-router";
import { Link } from "@heroui/link";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from "@heroui/navbar";
import { YnoLiberoVinoLogo } from "./YnoLiberoVinoLogo";
import { Button } from "@heroui/button";
import { ChevronDownIcon } from "~/components/icons/ChevronDown";

type HeaderVariant = "dark" | "light";

type SplashHeaderProps = {
  variant?: HeaderVariant;
};

const navLinks = [
  { label: "About", to: "/about" },
  { label: "Learn", to: "/learn" },
  { label: "FAQs", to: "/faqs" },
  { label: "Contact", to: "/contact" }
];

function isNavActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

const SplashHeader = ({ variant = "dark" }: SplashHeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const isDark = variant === "dark";
  const backgroundClass = isDark ? "bg-black" : "bg-white";
  const textClass = isDark ? "text-white" : "text-gray-700";
  const activeLinkClass = isDark
    ? "font-semibold text-white underline underline-offset-4"
    : "font-semibold text-gray-900 underline underline-offset-4";
  const inactiveLinkClass = isDark ? "text-gray-100" : "text-gray-700";
  const isDocsActive = pathname.startsWith("/docs");

  return (
    <header className={`fixed left-0 right-0 top-0 z-10 h-24 ${backgroundClass} flex align-middle`}>
      <Navbar
        isBordered
        isMenuOpen={isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
        className="bg-transparent"
        classNames={{ 
          base: `w-full`, 
          wrapper: `w-full max-w-none md:pl-10 ${textClass}`
        }}
      >
        <NavbarContent justify="start" className="flex-1">
          <NavbarBrand className="ml-auto">
            <YnoLiberoVinoLogo variant={isDark ? "dark" : "light"} />
          </NavbarBrand>
        </NavbarContent>

        <NavbarContent className="hidden md:flex" justify="end">
          {navLinks.map((link) => {
            const active = isNavActive(pathname, link.to);
            return (
              <NavbarItem key={link.to}>
                <Link
                  href={link.to}
                  className={active ? activeLinkClass : inactiveLinkClass}
                >
                  {link.label}
                </Link>
              </NavbarItem>
            );
          })}
          <Dropdown classNames={{
            base: variant,
            trigger: variant,
            content: variant,
            backdrop: variant,
          }}>
            <NavbarItem>
              <DropdownTrigger>
                <Link
                  href="#"
                  anchorIcon={<ChevronDownIcon />}
                  className={isDocsActive ? activeLinkClass : inactiveLinkClass}
                >
                  Docs
                </Link>
              </DropdownTrigger>
            </NavbarItem>
            <DropdownMenu>
              <DropdownItem className={textClass} key="sms-opt-in" href="/docs/sms-opt-in">SMS Opt-In</DropdownItem>
              <DropdownItem className={textClass} key="sms-opt-in-demo" href="/docs/sms-opt-in-demo">SMS Opt-In Demo</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarContent> 

        <NavbarContent className="md:hidden" justify="end">
          <NavbarMenuToggle aria-label={isMenuOpen ? "Close menu" : "Open menu"} />
        </NavbarContent>

        <NavbarMenu className={`${textClass} ${backgroundClass}/60 pt-10 pl-20 mt-9`}>
          {navLinks.map((link) => {
            const active = isNavActive(pathname, link.to);
            return (
              <NavbarMenuItem key={link.to}>
                <Link
                  href={link.to}
                  className={active ? activeLinkClass : inactiveLinkClass}
                >
                  {link.label}
                </Link>
              </NavbarMenuItem>
            );
          })}
          <Dropdown classNames={{
            base: variant,
            trigger: variant,
            content: variant,
            backdrop: variant,
          }}>
            <NavbarItem>
              <DropdownTrigger>
                <Link
                  href="#"
                  anchorIcon={<ChevronDownIcon />}
                  className={isDocsActive ? activeLinkClass : inactiveLinkClass}
                >
                  Docs
                </Link>
              </DropdownTrigger>
            </NavbarItem>
            <DropdownMenu>
              <DropdownItem className={textClass} key="sms-opt-in" href="/docs/sms-opt-in">SMS Opt-In</DropdownItem>
              <DropdownItem className={textClass} key="sms-opt-in-demo" href="/docs/sms-opt-in-demo">SMS Opt-In Demo</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarMenu>
      </Navbar>
    </header>
  );
};

export default SplashHeader;

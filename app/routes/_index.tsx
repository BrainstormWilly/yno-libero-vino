import type { MetaFunction } from "react-router";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/avatar";
import { Link } from "@heroui/link";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import SplashHeader from "~/components/splash/SplashHeader";

export const meta: MetaFunction = () => [
  { title: "Yno LiberoVino" },
  {
    name: "description",
    content: "A wine club and loyalty platform for Commerce7.",
  },
];

export default function Index() {
  return (
    <div className="fixed top-0 bottom-0 left-0 right-0 bg-[#050405]">
      <SplashHeader variant="dark" />
      <div className="absolute inset-x-0 left-0 right-0 h-px top-24 bg-[#8E8E93] z-100" />
      <main className="absolute inset-x-0 bottom-0 overflow-y-auto top-24">
        <section className="relative w-full h-100">
          <img
            src="/media/cork-star.jpg"
            alt="Cork star"
            className="absolute left-0 top-0 h-full object-cover"
          />
          <div className="absolute right-0 top-0 flex flex-col items-end mt-10 mr-10">
            <img
              src="/media/join-the-evolution.png"
              alt="Join the evolution"
              width={600}
            />
            <div className="flex gap-4 mt-10 mr-6">
              <Dropdown>
                <DropdownTrigger>
                  <Button color="primary">Install Now</Button>
                </DropdownTrigger>
                <DropdownMenu disabledKeys={["shopify"]}>
                  <DropdownItem key="commerce7" onPress={() => {}}>Commerce7</DropdownItem>
                  <DropdownItem key="shopify" onPress={() => {}}>Shopify (coming soon)</DropdownItem>
                </DropdownMenu>
              </Dropdown>
              <Button color="secondary" onPress={() => {}}>Learn More</Button>
            </div>
          </div>
        </section>
        <div className="inset-x-0 bottom-0 h-px bg-[#8E8E93]" />
      <section className="relative w-full overflow-hidden">
        <img
          src="/media/boxes.jpg"
          alt="Wine boxes"
          className="absolute inset-0 h-full w-full object-cover object-right"
        />
        <div className="relative z-10 w-full bg-gradient-to-r from-[#050405] lg:from-40% to-transparent to-100% p-6 md:p-10">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start">
            <div className="
              relative max-w-130 h-full bg-[#050405]/50 lg:bg-white/20 
              pt-25 px-5 pb-10 rounded-lg border-1 border-[#4e4e4f] lg:border-none
            " >
              <img src="/media/what-is.png" alt="What is LiberoVino?" width={400} className="absolute top-[-30px] right-[-20px]" />
              <div className="text-white text-3xl font-bold font-serif">&ldquo;Liberate Wine&rdquo;</div>
              <div className="text-white text-lg font-bold font-serif pl-4">a customer-driven benefits program for the <br/>direct-to-consumer wine industry</div>
              <div className="text-white text-lg font-serif pl-4 mt-4">
                LiberoVino empowers your winery to ditch forced shipments for true consumer flexibility. 
                Our self-adjusting tier system automates allocation, loyalty and discounts based on real-time spending—liberating your customers to buy what they want, 
                when they want, while maximizing your brand&apos;s retention.
              </div>
            </div>
            <div className="
              relative max-w-130 h-full bg-[#050405]/50 
              pt-25 px-5 pb-10 rounded-lg border-1 border-[#4e4e4f] 
            " >
              <div className="absolute top-5 right-5 flex items-center gap-4">
                <Avatar size="lg" src="/media/ynoguy.jpg" />
                <div className="flex flex-col">
                  <div className="text-white text-lg font-bold">Bill Langley</div>
                  <div className="text-white text-sm opacity-80">Founder, Engineer</div>
                  <div className="text-white text-sm opacity-80">WSET Advanced, CSW</div>
                </div>
              </div>
              <div className="text-white text-3xl font-bold font-serif">&ldquo;YnoGuy&rdquo;</div>
              <div className="text-white text-lg font-serif pl-4 mt-4">
                LiberoVino is a solution built from experience. Combining years of software engineering with DtC wine sales, 
                I&apos;ve seen firsthand how forced shipping kills loyalty. I built this platform to liberate wineries from rigid club tiers and provide a flexible, 
                automated experience that consumers actually want. 
              </div>
            </div>
          </div>
        </div>
      </section>
        <div className="inset-x-0 bottom-0 h-px bg-[#8E8E93]" />
        <section className="
          relative h-56 md:h-24 w-full 
          flex flex-col lg:flex-row justify-between items-center gap-10 lg:gap-0
          text-white px-6 py-6
        ">
          <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-10">
            <div className="flex items-center gap-4 font-display">
              <div className="text-lg">BUILT BY:</div>
              <a href="https://ynosoftware.com" target="_blank" rel="noreferrer"><img src="/media/yno-software-logo-dark.png" alt="YnoSoftware" width={150} /></a>
            </div>
            <div className="flex items-center gap-2 font-display">
              <div className="text-lg">BUILT ON:</div>
              <a href="https://commerce7.com" target="_blank" rel="noreferrer"><img src="/media/c7_white.png" alt="Commerce7" width={150} /></a>
              <a href="https://shopify.com" target="_blank" rel="noreferrer"><img src="/media/shopify_logo_white.png" alt="Shopify" width={100} /></a>
            </div>
          </div>
          <div className="flex items-center gap-2 pb-10 lg:pb-0">
            <div>© Yno Software 2026</div>
            <div>|</div>
            <Link target="_blank" rel="noreferrer" href="https://ynosoftware.com/privacy">Privacy</Link>
            <div>|</div>
            <Link target="_blank" rel="noreferrer" href="https://ynosoftware.com/terms">Terms</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Link } from "@heroui/link";
import MarketingLayout from "~/components/splash/MarketingLayout";

export default function About() {
  return (
    <MarketingLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - 1/3 */}
        <div className="lg:col-span-1">
          <div className="text-4xl font-display font-semibold text-gray-900">About</div>
          <div className="mt-3 text-lg text-gray-600 font-serif">
            LiberoVino is a customer-driven wine club platform that helps
            wineries deliver flexible, modern loyalty experiences.
          </div>
        </div>

        {/* Right Column - 2/3 */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="text-xl font-semibold text-gray-900">
              The wine club is dead. Long live the wine club!
            </CardHeader>
            <CardBody className="text-gray-700">
              Let&apos;s face it, wine clubs have had a good run for DtC wineries over the years. 
              But times have changed. Consumers are demanding a better loyalty experience. 
              Clubs may work well for our local &quot;pickup&quot; customers, but shipping can be a challenge. 
              Unexpected scheduling, shipping charges, weather damage, and signature requirements all add to a negative experience that can erase the reasons why a customer joined in the first place. 
              Furthermore, the commitment to joining a wine club can make consumers averse to signing up for any other communications, leading to too many anonymous purchases and missed opportunities to build lasting relationships.
            </CardBody>
          </Card>
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="text-xl font-semibold text-gray-900">
              The LiberoVino Evolution!
            </CardHeader>
            <CardBody className="flex flex-col gap-4 text-gray-700">
              <span>
                LiberoVino was born from years of real tasting room wine sales experience, as well as observing wine club retention analytics. 
                The message is clear: customers like the perks and privileges of membership…but not the scheduled shipping. 
                When you think about it, everything is winery-driven. The quantity, schedule, and often even choice. From a customer&apos;s standpoint, 
                the only thing appealing is the discount.
              </span>
              <span>
                So, why not let the customer control their own benefits? Enter LiberoVino. 
                A customer-driven wine club program where customers earn benefits based on their actual purchases. 
                The more they buy, the more benefits they can qualify for and the longer those benefits last. 
                If they no longer want to participate, they simply stop purchasing. All the incentives, without all the commitments.
              </span>
              <span>
                In addition, once you&apos;re freed from wine packages and shipping schedules, you can get creative in tailoring club tiers for all your member types, and even evolve it over time. Check out the Learn More page to see how you can make your club tiers more appealing to your members.
              </span>
            </CardBody>
          </Card>
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="text-xl font-semibold text-gray-900">
              Real Solutions for Real Wine
            </CardHeader>
            <CardBody className="flex flex-col gap-4 text-gray-700">
              <span>
                I&apos;ve been working in and around small wineries for over 10 years in hospitality, marketing, and tech. 
                What I&apos;ve learned is that DtC wineries are nothing like their larger 3-tier counterparts. 
                They have special needs and smaller budgets. They don&apos;t always have marketing staff, social media experts, or sales departments. 
                For them, it&apos;s about making real, hand-crafted wine for those who appreciate it.
              </span>
              <span>
                That&apos;s why I started <Link href="https://ynosoftware.com" target="_blank" rel="noreferrer">Yno Software</Link>—to build affordable, effective solutions for direct-to-consumer wine businesses on Commerce7 and Shopify platforms. 
                My first product, Yno Neighborly, helps qualify leads to improve member acquisition. LiberoVino improves member retention with more flexible member benefits.
              </span>
              <span>
                Both are what I call real solutions for real wine.
              </span>
              <span className="text-xs italic">
                — Bill Langley (YnoGuy)<br />
                &nbsp;&nbsp;&nbsp;&nbsp;WSET Advanced, CSW<br />
                &nbsp;&nbsp;&nbsp;&nbsp;Founder, Engineer<br />
                &nbsp;&nbsp;&nbsp;&nbsp;Yno Software
              </span>
            </CardBody>
          </Card>
        </div>
      </div>
    </MarketingLayout>
  );
}

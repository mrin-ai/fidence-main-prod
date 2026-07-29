"use client";

import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useState, useEffect } from "react";
import Autoplay from "embla-carousel-autoplay";
import { LcxLogo } from "@/components/lcx-logo";
import { PixelCard } from "@/components/pixel-card";
import {
  CreditCard,
  Link2,
  QrCode,
  Gift,
  ShieldCheck,
} from "lucide-react";

const testimonials = [
  {
    content:
      "PayAgent made it effortless to spin up payment links for our global customer base. Settlement is fast and the dashboard gives us full visibility.",
    author: "Sarah Chen",
    role: "Head of Payments, Nova Commerce",
  },
  {
    content:
      "We replaced three tools with PayAgent. QR payments, invoicing, and rewards all live in one place — our ops team loves it.",
    author: "Marcus Webb",
    role: "COO, Stackline",
  },
  {
    content:
      "The compliance and reporting features saved us weeks during our audit. Clean UI, reliable infrastructure.",
    author: "Elena Rodriguez",
    role: "Finance Director, Meridian Pay",
  },
  {
    content:
      "From first link to first payout in under an hour. Exactly what we needed to launch in new markets.",
    author: "James Okonkwo",
    role: "Founder, PayRoute",
  },
];

const features = [
  {
    icon: Link2,
    label: "Payment Links",
    description: "Shareable links, instant checkout",
  },
  {
    icon: QrCode,
    label: "QR Payments",
    description: "In-person and mobile pay",
  },
  {
    icon: CreditCard,
    label: "Transactions",
    description: "Real-time payment tracking",
  },
  {
    icon: Gift,
    label: "Rewards",
    description: "Loyalty and cashback programs",
  },
  {
    icon: ShieldCheck,
    label: "Compliance",
    description: "Regulated, audit-ready flows",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <div className="lcx-auth flex min-h-svh w-full bg-background">
      <div className="relative hidden flex-col overflow-hidden lg:flex lg:w-[45%] xl:w-[50%]">
        <div className="absolute inset-0">
          <PixelCard
            autoPlay
            backgroundColor="#5264E200"
            borderColor="#00000000"
            borderWidth={0}
            radius={0}
            gap={6}
            pixelSize={2}
            speed={80}
            appearFrom="middle"
            colors={["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb"]}
          />
        </div>
        <div className="absolute inset-0 bg-linear-to-br from-background/75 via-background/55 to-background/35" />

        <div className="relative flex flex-1 flex-col px-12 py-10 xl:px-20">
          <Link
            href="/"
            className="group mb-12 inline-flex w-fit items-center transition-transform duration-300 hover:scale-[1.02]"
          >
            <LcxLogo className="h-14 w-auto xl:h-16" priority />
          </Link>

          <div className="flex flex-1 flex-col justify-center">
            <div className="w-full max-w-md">
              <div className="mb-12">
                <p className="font-serif text-2xl leading-snug font-light tracking-tight text-foreground/90 xl:text-3xl">
                  Get paid. Move money.
                  <br />
                  Scale commerce.
                </p>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Payment links, QR checkout, transactions, and rewards — one
                  platform for modern merchants and teams.
                </p>
              </div>

              <div className="mb-12 grid grid-cols-2 gap-2.5">
                {features.map((f) => (
                  <div
                    key={f.label}
                    className="flex items-start gap-3 rounded-xl border border-border/30 bg-white p-3"
                  >
                    <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                    <div>
                      <p className="text-xs leading-tight font-medium text-foreground">
                        {f.label}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                        {f.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative">
                <Carousel
                  className="w-full"
                  opts={{ loop: true }}
                  setApi={setApi}
                  plugins={[
                    Autoplay({
                      delay: 6000,
                      stopOnInteraction: true,
                      stopOnMouseEnter: true,
                    }),
                  ]}
                >
                  <CarouselContent>
                    {testimonials.map((testimonial, index) => (
                      <CarouselItem key={index}>
                        <div className="rounded-xl border border-border/50 bg-white p-5">
                          <blockquote className="mb-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                            &ldquo;{testimonial.content}&rdquo;
                          </blockquote>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-foreground">
                              {testimonial.author}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {testimonial.role}
                            </span>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>

                <div className="mt-5 flex items-center gap-2">
                  {testimonials.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => api?.scrollTo(index)}
                      className={`h-1 rounded-full transition-all duration-500 ${
                        index === current
                          ? "w-8 bg-foreground"
                          : "w-2 bg-foreground/15 hover:bg-foreground/30"
                      }`}
                      aria-label={`Go to testimonial ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8">
            <div className="flex w-full max-w-md items-center gap-6 text-xs text-muted-foreground">
              {[
                { num: "$50M+", label: "processed" },
                { num: "10K+", label: "merchants" },
                { num: "99.9%", label: "uptime" },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  {i > 0 && <span className="mr-1.5 h-3 w-px bg-border/50" />}
                  <span className="font-mono text-foreground/80">{s.num}</span>
                  <span className="text-[10px]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-background lg:w-[55%] lg:border-l lg:border-border/50 xl:w-[50%]">
        <header className="flex h-16 items-center justify-between border-b border-border/50 px-6 lg:hidden">
          <Link href="/" className="flex items-center">
            <LcxLogo className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="font-mono">$50M+ processed</span>
            <span className="h-3 w-px bg-border/50" />
            <span className="font-mono">10K+ merchants</span>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-12">
          {children}
        </div>

        <footer className="flex h-12 items-center justify-center gap-6 px-6 text-xs text-muted-foreground">
          <span>Trusted by merchants worldwide</span>
          <span className="h-3 w-px bg-border/30" />
          <Link
            href="/dashboard"
            className="transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
        </footer>
      </div>
    </div>
  );
}

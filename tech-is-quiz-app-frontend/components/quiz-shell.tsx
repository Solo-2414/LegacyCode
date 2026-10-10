import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { AuthenticatedNav } from "@/components/authenticated-nav"

export function QuizShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="quiz-shell min-h-screen overflow-hidden px-4 pb-10 pt-4 text-white sm:px-6 sm:pt-6 lg:px-10">
      <div className="quiz-orb quiz-orb-one" aria-hidden="true" />
      <div className="quiz-orb quiz-orb-two" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1320px]">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/[0.07] pb-4 sm:mb-10 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
          <Link className="group flex w-fit items-center gap-3" href="/" aria-label="TechIs QuizApp home">
            <span className="size-10 overflow-hidden rounded-[14px] ring-1 ring-white/15 shadow-[0_5px_24px_rgba(0,0,0,.3)] sm:size-11">
              <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-KHwywXUeXAt6gKRaUvSyojic08od8c.png" alt="TechIs colorful geometric logo" className="size-full object-cover" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[17px] font-bold tracking-[-0.045em] sm:text-lg">TechIs</span>
              <span className="mt-1.5 text-[10px] font-semibold tracking-[0.2em] text-white/40 uppercase">LegacyCode</span>
            </span>
          </Link>
          <AuthenticatedNav />
        </header>
        {children}
        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/[0.07] pt-5 text-[11px] text-white/35 sm:flex-row sm:pt-6">
          <span>TechIs QuizApp <span className="mx-1.5 text-white/15">/</span> Tech Department</span>
          <Link href="/" className="group inline-flex items-center gap-1.5 transition hover:text-white/65">{"\u00A9"} 2026 TECHIS <ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
        </footer>
      </div>
    </main>
  )
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[10px] font-bold tracking-[0.2em] text-[#62e8cb] uppercase">{children}</p>
}

export function PageHeading({ id, eyebrow, title, description }: { id?: string; eyebrow: string; title: React.ReactNode; description: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 id={id} className="text-[2rem] leading-[1.08] font-bold tracking-[-0.055em] text-white sm:text-[3.1rem]">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-white/45 sm:text-[15px]">{description}</p>
    </div>
  )
}

export const surfaceClass = "rounded-[26px] border border-white/[0.09] bg-[#141b25]/75 shadow-[0_24px_80px_rgba(0,0,0,.26)] backdrop-blur-xl"
export const fieldClass = "h-[52px] w-full rounded-xl border border-white/[0.11] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#10d7ac]/55 focus:ring-2 focus:ring-[#10d7ac]/15"
export const primaryButtonClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#10d7ac] px-5 py-3 text-sm font-bold text-[#08251f] shadow-[0_8px_30px_rgba(16,215,172,.19)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#37e5bd] hover:shadow-[0_12px_40px_rgba(16,215,172,.32)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
export const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.045] px-4 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"

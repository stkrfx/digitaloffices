import { MonitorCheck } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      
      {/* LEFT SIDE: Brand & Testimonial */}
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <MonitorCheck className="mr-2 h-6 w-6" />
          Mindnamo
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;This platform completely revolutionized how I connect with industry experts. The verification process is top-notch.&rdquo;
            </p>
            <footer className="text-sm">Sofia Davis</footer>
          </blockquote>
        </div>
      </div>

      {/* RIGHT SIDE: The Form */}
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          {children}
        </div>
      </div>
    </div>
  )
}
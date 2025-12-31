import { Metadata } from "next"
import { RegisterForm } from "@/features/auth/components/register-form"

export const metadata: Metadata = {
  title: "Create an Account - Mindnamo",
  description: "Get started with your digital journey.",
}

export default function RegisterPage() {
  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email below to create your account
        </p>
      </div>
      <RegisterForm />
      <p className="px-8 text-center text-sm text-muted-foreground">
        By clicking continue, you agree to our{" "}
        <a href="/terms" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </a>
        .
      </p>
    </>
  )
}
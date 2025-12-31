import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { registerSchema, RegisterFormValues } from "../lib/schema"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner" // Ensure shadcn toast is installed
import { RegisterRequest } from "@shared/types"

export function useRegister() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  // const { toast } = useToast()

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      promotionalEmails: false,
    },
  })

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true)

    try {
      // Adapt form data to API request
      const payload: RegisterRequest = {
        ...data,
        initialRole: "USER", // This is the User Portal, so we default to USER
      }

      console.log("hello world")

      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      })

      // SONNER USAGE:
      toast.success("Account created successfully", {
        description: "Please check your email to verify your account.",
        duration: 5000,
      })

      // Redirect to login (or a 'check email' page)
      router.push("/login?verified=false")
    } catch (error) {
      // SONNER ERROR:
      toast.error("Registration failed", {
        description: error instanceof Error ? error.message : "Something went wrong",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return { form, onSubmit, isLoading }
}
import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { cn } from "../../lib/utils"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

const ToastProvider = ToastPrimitive.Provider

export type ToastMessage = {
  title: string
  description: string
  variant: ToastVariant
}

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-1 p-2 sm:top-0 sm:right-0 sm:flex-col md:max-w-[320px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

type ToastVariant = "neutral" | "success" | "error"

interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  variant?: ToastVariant
  swipeDirection?: "right" | "left" | "up" | "down"
}

const toastVariants: Record<
  ToastVariant,
  { icon: React.ReactNode; bgColor: string }
> = {
  neutral: {
    icon: <Info className="h-3 w-3" style={{ color: 'var(--wagoo-accent-warning)' }} />,
    bgColor: "wagoo-bg-secondary"
  },
  success: {
    icon: <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--wagoo-accent-success)' }} />,
    bgColor: "wagoo-bg-secondary"
  },
  error: {
    icon: <AlertCircle className="h-3 w-3" style={{ color: 'var(--wagoo-accent-error)' }} />,
    bgColor: "wagoo-bg-secondary"
  }
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ToastProps
>(({ className, variant = "neutral", ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    duration={4000}
    className={cn(
      "group pointer-events-auto relative flex w-full items-center space-x-2 overflow-hidden rounded-md p-2 wagoo-border",
      toastVariants[variant].bgColor,
      className
    )}
    style={{ backdropFilter: 'var(--wagoo-backdrop-blur)' }}
    {...props}
  >
    {toastVariants[variant].icon}
    <div className="flex-1">{props.children}</div>
    <ToastPrimitive.Close className="absolute right-1 top-1 rounded-md p-0.5 wagoo-text-muted opacity-0 transition-opacity hover:wagoo-text-secondary group-hover:opacity-100">
      <X className="h-2 w-2" />
    </ToastPrimitive.Close>
  </ToastPrimitive.Root>
))
Toast.displayName = ToastPrimitive.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "text-[0.65rem] font-medium wagoo-text-secondary hover:wagoo-text-primary",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitive.Action.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn("text-[0.7rem] font-medium wagoo-text-primary", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitive.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-[0.65rem] wagoo-text-secondary", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitive.Description.displayName

export type { ToastProps, ToastVariant }
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastAction,
  ToastTitle,
  ToastDescription
}

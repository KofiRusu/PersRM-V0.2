import { ReasoningAssistantProvider } from "@/components/ui-generator/ReasoningAssistantProvider";

export default function UIGeneratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ReasoningAssistantProvider defaultVisible={false}>
      {children}
    </ReasoningAssistantProvider>
  )
} 
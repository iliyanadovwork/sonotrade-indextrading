import { TagProvider } from '@/components/sx/TagProvider'
import { TagSidebar } from '@/components/sx/TagSidebar'

export default function TagLayout({ children }: { children: React.ReactNode }) {
  return (
    <TagProvider>
      <main className="flex flex-1 w-full flex-col bg-[rgb(10,10,10)] text-white">
        <div className="w-full max-w-[92.5rem] mx-auto flex gap-0" style={{ minHeight: '100vh' }}>
          <TagSidebar />
          {children}
        </div>
      </main>
    </TagProvider>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'

type LazyMountProps = {
  children: ReactNode
  heightClassName?: string
}

export function LazyMount({ children, heightClassName = 'h-72' }: LazyMountProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const target = ref.current
    if (!target) return
    if (visible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [visible])

  return (
    <div ref={ref} className={heightClassName}>
      {visible ? children : <div className="h-full w-full" />}
    </div>
  )
}

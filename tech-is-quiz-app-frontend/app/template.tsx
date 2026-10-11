// A template re-mounts on every navigation, which gives each page a soft fade-in.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-in fade-in duration-300">{children}</div>
}

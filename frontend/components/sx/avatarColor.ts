const COLORS = [
  '#e879f9', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24',
  '#FF4B4B', '#fb923c', '#38bdf8', '#04df9d', '#c084fc',
  '#f472b6', '#2dd4bf', '#facc15', '#818cf8', '#fb7185',
]

export function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

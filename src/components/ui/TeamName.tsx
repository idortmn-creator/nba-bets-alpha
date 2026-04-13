import { getTeamLogoUrl } from '@/lib/teamLogos'

interface TeamNameProps {
  name: string
  /** Logo size in px (default 18) */
  size?: number
  /** Stack logo above name instead of inline */
  vertical?: boolean
}

export function TeamName({ name, size = 18, vertical = false }: TeamNameProps) {
  const url = getTeamLogoUrl(name)
  if (!url) return <span>{name}</span>
  return (
    <span className={vertical ? 'team-name-v' : 'team-name-h'}>
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="team-logo"
        loading="lazy"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
      <span>{name}</span>
    </span>
  )
}

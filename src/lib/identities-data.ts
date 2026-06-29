export type Identity = {
  id: string
  initials: string
  avatarClassName: string
  name: string
  agents: number
  amount: string
}

export const identities: Identity[] = [
  {
    id: "1",
    initials: "AO",
    avatarClassName: "bg-primary text-primary-foreground",
    name: "Acme Ops",
    agents: 3,
    amount: "$18.2k",
  },
  {
    id: "2",
    initials: "GR",
    avatarClassName: "bg-chart-2 text-primary-foreground",
    name: "Growth",
    agents: 2,
    amount: "$14.6k",
  },
  {
    id: "3",
    initials: "EN",
    avatarClassName: "bg-secondary-foreground text-primary-foreground",
    name: "Engineering",
    agents: 2,
    amount: "$11.9k",
  },
  {
    id: "4",
    initials: "AR",
    avatarClassName: "bg-accent text-primary",
    name: "Personal",
    agents: 0,
    amount: "$3.5k",
  },
  {
    id: "5",
    initials: "MK",
    avatarClassName: "bg-chart-3 text-primary",
    name: "Marketing",
    agents: 1,
    amount: "$6.2k",
  },
]

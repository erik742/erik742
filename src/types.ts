export type Role = 'teen' | 'parent'

export type WatchType = 'front' | 'back' | 'audio'

export interface User {
  id: string
  role: Role
  name: string
  avatar: string
  age?: number | null
  interests: string[]
  contactType: 'phone' | 'email'
  contact: string
  shareLocation: boolean
  parentIds: string[]
  childIds: string[]
  online: boolean
}

export interface DiscoverUser extends User {
  common: string[]
}

export interface FriendRequest {
  id: string
  from: string
  to: string
  status: string
  at: number
}

export interface IncomingRequest { request: FriendRequest; from: User | null }
export interface OutgoingRequest { request: FriendRequest; to: User | null }

export interface Message {
  id: string
  from: string
  to: string
  text: string
  at: number
  kind: string
}

export interface LocationFix {
  lat: number
  lng: number
  acc: number | null
  at: number
}

export interface ChildInfo extends User {
  lastLocation: LocationFix | null
}

export interface AdviceItem {
  id: string
  emoji: string
  title: string
  text: string
  parentHint: string
}

export interface SosEvent {
  id: string
  childId: string
  at: number
  lat: number | null
  lng: number | null
}

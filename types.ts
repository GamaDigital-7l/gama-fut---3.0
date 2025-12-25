
export type UserRole = 'super_admin' | 'organizer_admin' | 'mesario' | 'tecnico' | 'torcedor';
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed';
export type MatchEventType = 'gol' | 'cartao_amarelo' | 'cartao_vermelho' | 'substituicao' | 'inicio_partida' | 'fim_partida';
export type ChampionshipStatus = 'rascunho' | 'publicado' | 'encerrado';
export type SubscriptionStatus = 'trial' | 'active' | 'warning' | 'overdue' | 'blocked' | 'canceled';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  subscription?: Subscription;
  created_at?: string;
  owner_id?: string;
  notes?: string; // New field for internal admin notes
}

export interface UserProfile {
  id: string;
  organization_id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string;
  phone?: string;
  team_id?: string;
  email?: string; // Added for display in settings
  status?: 'active' | 'blocked'; // New
  created_at?: string;
}

export interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  limits: {
    championships: number;
    teams_per_championship: number;
    users: number;
  };
  features: string[];
  description: string;
  active: boolean;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  start_date: string;
  end_date: string;
  custom_limits?: any;
  plan?: Plan;
}

export interface Championship {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  season?: string;
  category?: string;
  city: string;
  state: string;
  description: string;
  status: ChampionshipStatus;
  logo_url: string;
  banner_url: string;
  primary_color: string;
  secondary_color: string;
  start_date?: string;
  end_date?: string;
  
  // Rules & Regulations
  points_win: number;
  points_draw: number;
  points_loss: number;
  tiebreakers: string[];
  zone_config: {
    mode: 'traditional' | 'series';
    promotion: number;
    relegation: number;
    gold: number;
    silver: number;
    bronze: number;
  };
  regulations_url?: string; // New: PDF Link
  regulations_text?: string; // New: Explained text

  // Analytics
  views_page?: number;
  views_table?: number;

  // Virtual counts
  teams?: { count: number }[];
  matches?: { count: number }[];
}

export interface Group {
  id: string;
  championship_id: string;
  name: string;
}

export interface Team {
  id: string;
  organization_id: string;
  championship_id?: string;
  name: string;
  short_name: string;
  logo_url: string;
  coach_name: string;
  group_id?: string;
  category?: string;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  number: number;
  position: string;
  photo_url?: string;
  letter?: string;
}

export interface Venue {
  id: string;
  organization_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  created_at?: string;
}

export interface Match {
  id: string;
  organization_id: string;
  championship_id: string;
  group_id?: string;
  home_team_id: string | null;
  away_team_id: string | null;
  start_time: string | null;
  status: MatchStatus;
  home_score: number;
  away_score: number;
  
  // Penalties
  penalty_home_score?: number;
  penalty_away_score?: number;

  // W.O.
  is_wo?: boolean;
  wo_winner_team_id?: string;

  // Location
  location: string | null; // Keeps backward compatibility for display
  venue_id?: string; // Link to Venue table

  round_number: number;
  stage?: 'group_stage' | 'round_16' | 'quarter_finals' | 'semi_finals' | 'final';
  
  // Arbitration & Sheet Data
  referee_name?: string;
  assistant_referee_1?: string;
  assistant_referee_2?: string;
  fourth_official?: string;
  uniform_home?: string;
  uniform_away?: string;
  observations?: string;

  mesario_id?: string;
  home_team?: Team;
  away_team?: Team;
  championship?: Championship;
  group?: Group;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  player_id: string | null;
  team_id: string | null;
  type: MatchEventType;
  minute: number;
  extra_info: string;
  created_at: string;
  player?: Player;
  team?: Team;
}

export interface News {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  image_url: string;
  published_at: string;
}

export interface Sponsor {
  id: string;
  championship_id: string;
  name: string;
  quota: 'ouro' | 'prata' | 'bronze';
  logo_url: string;
  website_url: string;
  active: boolean;
  impressions: number;
  clicks: number;
}

export interface AuditLog {
  id: string;
  match_id: string;
  user_id: string;
  action_type: string;
  description: string;
  created_at: string;
  user_profile?: UserProfile; // Joined
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action_type: string;
  target_id?: string;
  description: string;
  created_at: string;
  admin_profile?: UserProfile;
}

export interface GlobalSponsor {
  id: string;
  name: string;
  logo_url: string;
  link_url?: string;
  active: boolean;
  display_order: number;
  quota?: string;
  display_locations?: string[]; // e.g. ['home', 'login', 'footer', 'champ_page']
}

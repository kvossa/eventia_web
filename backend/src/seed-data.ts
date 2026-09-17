import type { EventStatus, UserRole } from '@eventia/shared';

export interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface SeedCategory {
  name: string;
  slug: string;
  description?: string;
}

export interface SeedOrganizer {
  name: string;
  slug: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
}

export interface SeedVenue {
  name: string;
  city: string;
  address: string;
  capacity?: number;
  description?: string;
}

export interface SeedTicketType {
  name: string;
  description?: string;
  priceCents: number;
  quantity: number;
  quantitySold?: number;
  salesStartsInDays?: number | null;
  salesEndsInDays?: number | null;
  maxPerCustomer?: number;
  isVisible?: boolean;
}

export interface SeedEvent {
  name: string;
  description?: string;
  categorySlug: string;
  organizerSlug: string;
  venueName: string;
  inDays: number;
  status: EventStatus;
  featured?: boolean;
  imageUrl?: string;
  maxCapacity?: number;
  ageRestriction?: string;
  city?: string;
  address?: string;
  ticketTypes: SeedTicketType[];
}

const DEMO_USERS: SeedUser[] = [
  { name: 'Eventia Admin', email: 'root@eventia.local', password: 'adminpass1234', role: 'admin' },
  { name: 'Alice Novak', email: 'alice@example.com', password: 'alicepass123', role: 'customer' },
  { name: 'Sam Wise', email: 'sam@example.com', password: 'sampass123', role: 'customer' },
  { name: 'Mia Chen', email: 'mia@example.com', password: 'miapass123', role: 'customer' },
  { name: 'Kai Müller', email: 'kai@example.com', password: 'kaipass123', role: 'customer' },
  { name: 'Nina Petrova', email: 'nina@example.com', password: 'ninapass123', role: 'customer' },
];

const SEED_CATEGORIES: SeedCategory[] = [
  { name: 'Concerts', slug: 'concerts', description: 'Live music, bands and orchestras' },
  { name: 'Theatre', slug: 'theatre', description: 'Plays, musicals and stage performances' },
  { name: 'Comedy', slug: 'comedy', description: 'Stand-up and comedy shows' },
  { name: 'Festivals', slug: 'festivals', description: 'Multi-stage festivals and open airs' },
  { name: 'Sports', slug: 'sports', description: 'Sporting events and competitions' },
];

const SEED_ORGANIZERS: SeedOrganizer[] = [
  {
    name: 'Aurora Presents',
    slug: 'aurora-presents',
    description: 'Premium live experiences across Europe',
    websiteUrl: 'https://aurorapresents.example',
    logoUrl: 'https://picsum.photos/seed/aurora/200/200',
  },
  {
    name: 'Night Owl Live',
    slug: 'night-owl-live',
    description: 'Independent events, club nights and hidden gems',
    websiteUrl: 'https://nightowllive.example',
  },
  {
    name: 'City Sounds',
    slug: 'city-sounds',
    description: 'Urban festivals and community stages',
    websiteUrl: 'https://citysounds.example',
  },
];

const SEED_VENUES: SeedVenue[] = [
  {
    name: 'Grand Arena',
    city: 'Berlin',
    address: 'Alexanderplatz 1',
    capacity: 15000,
    description: 'Berlin premier indoor arena with a standing floor and tiered seating.',
  },
  {
    name: 'St. Pauli Arena',
    city: 'Hamburg',
    address: 'Reeperbahn 35',
    capacity: 4200,
    description: 'Intimate harbor-side concert hall in the heart of St. Pauli.',
  },
  {
    name: 'Kulturbrauerei',
    city: 'Berlin',
    address: 'Schönhauser Allee 36',
    capacity: 1800,
    description: 'Historic brewery venue with a cosy main stage.',
  },
  {
    name: 'Olympiahalle',
    city: 'Munich',
    address: 'Spiridon-Louis-Ring 21',
    capacity: 12000,
    description: 'Iconic Munich hall hosting concerts and sporting events.',
  },
];

const SEED_EVENTS: SeedEvent[] = [
  {
    name: 'Neon Nights Festival',
    description: 'Two days of electronic music, art installations and food trucks.',
    categorySlug: 'festivals',
    organizerSlug: 'night-owl-live',
    venueName: 'Grand Arena',
    inDays: 12,
    status: 'published',
    featured: true,
    imageUrl: 'https://picsum.photos/seed/neon-festival/1200/600',
    maxCapacity: 15000,
    ageRestriction: '16+',
    ticketTypes: [
      {
        name: 'Early Bird',
        description: 'Limited first-release pass',
        priceCents: 5900,
        quantity: 1000,
        maxPerCustomer: 4,
      },
      {
        name: 'General Admission',
        description: 'Standard festival entry',
        priceCents: 7900,
        quantity: 5000,
        maxPerCustomer: 6,
      },
      {
        name: 'VIP Box',
        description: 'Backstage access and lounge',
        priceCents: 14900,
        quantity: 200,
        salesStartsInDays: 10,
        maxPerCustomer: 2,
      },
    ],
  },
  {
    name: 'Symphony Under the Stars',
    description: 'A summer gala of classical favourites performed by a 80-piece orchestra.',
    categorySlug: 'concerts',
    organizerSlug: 'aurora-presents',
    venueName: 'Grand Arena',
    inDays: 30,
    status: 'published',
    featured: true,
    imageUrl: 'https://picsum.photos/seed/symphony-stars/1200/600',
    maxCapacity: 15000,
    ticketTypes: [
      {
        name: 'General Admission',
        description: 'Standing floor access',
        priceCents: 6900,
        quantity: 3000,
        maxPerCustomer: 6,
      },
      {
        name: 'Premium Seating',
        description: 'Reserved tiered seat',
        priceCents: 12900,
        quantity: 800,
        maxPerCustomer: 4,
      },
    ],
  },
  {
    name: 'Laughing Hour Stand-Up',
    description: 'An evening of sharp stand-up comedy with national headliners.',
    categorySlug: 'comedy',
    organizerSlug: 'city-sounds',
    venueName: 'St. Pauli Arena',
    inDays: 5,
    status: 'published',
    imageUrl: 'https://picsum.photos/seed/laughing-hour/1200/600',
    ageRestriction: '18+',
    ticketTypes: [
      {
        name: 'General Admission',
        description: 'First come, first served seating',
        priceCents: 3900,
        quantity: 1200,
        maxPerCustomer: 6,
      },
    ],
  },
  {
    name: 'City Sports Festival',
    description: 'Street basketball, parkour and skate competitions with live commentary.',
    categorySlug: 'sports',
    organizerSlug: 'city-sounds',
    venueName: 'Olympiahalle',
    inDays: 45,
    status: 'published',
    imageUrl: 'https://picsum.photos/seed/city-sports/1200/600',
    maxCapacity: 12000,
    ticketTypes: [
      {
        name: 'Day Pass',
        description: 'Full-day access to all competitions',
        priceCents: 2500,
        quantity: 4000,
        maxPerCustomer: 8,
      },
      {
        name: 'Family Pass',
        description: 'Entry for two adults and two children',
        priceCents: 6000,
        quantity: 500,
        salesEndsInDays: 3,
        maxPerCustomer: 2,
      },
    ],
  },
  {
    name: 'Indie Nights: Live Session',
    description: 'An up-close session with rising indie acts in an intimate setting.',
    categorySlug: 'concerts',
    organizerSlug: 'night-owl-live',
    venueName: 'Kulturbrauerei',
    inDays: 8,
    status: 'published',
    imageUrl: 'https://picsum.photos/seed/indie-nights/1200/600',
    maxCapacity: 1800,
    ticketTypes: [
      {
        name: 'General Admission',
        description: 'Standing room only',
        priceCents: 3200,
        quantity: 200,
        quantitySold: 190,
        maxPerCustomer: 4,
      },
    ],
  },
  {
    name: 'Theatre Gala Premiere',
    description: 'Premiere gala of a sweeping historical drama with a live orchestra.',
    categorySlug: 'theatre',
    organizerSlug: 'aurora-presents',
    venueName: 'St. Pauli Arena',
    inDays: 20,
    status: 'published',
    imageUrl: 'https://picsum.photos/seed/theatre-gala/1200/600',
    maxCapacity: 4200,
    ageRestriction: '12+',
    ticketTypes: [
      {
        name: 'Main Floor',
        description: 'Orchestra floor seating',
        priceCents: 4900,
        quantity: 1500,
        maxPerCustomer: 6,
      },
      {
        name: 'Loge Seats',
        description: 'Premium balcony seats',
        priceCents: 9900,
        quantity: 300,
        maxPerCustomer: 4,
      },
    ],
  },
  {
    name: 'Retro Beats Festival',
    description: 'A weekend celebrating vinyl-era hits and old-school DJs.',
    categorySlug: 'festivals',
    organizerSlug: 'night-owl-live',
    venueName: 'Olympiahalle',
    inDays: 60,
    status: 'draft',
    imageUrl: 'https://picsum.photos/seed/retro-beats/1200/600',
    maxCapacity: 12000,
    ticketTypes: [
      {
        name: 'General Admission',
        priceCents: 4500,
        quantity: 4000,
        maxPerCustomer: 6,
      },
    ],
  },
  {
    name: 'Last Summer Open Air',
    description: 'Final open-air concert of the season under the evening sky.',
    categorySlug: 'concerts',
    organizerSlug: 'aurora-presents',
    venueName: 'Grand Arena',
    inDays: -30,
    status: 'published',
    imageUrl: 'https://picsum.photos/seed/last-summer/1200/600',
    maxCapacity: 15000,
    ticketTypes: [
      {
        name: 'General Admission',
        priceCents: 5500,
        quantity: 5000,
        quantitySold: 5000,
        maxPerCustomer: 8,
      },
    ],
  },
];

export {
  DEMO_USERS,
  SEED_CATEGORIES,
  SEED_ORGANIZERS,
  SEED_VENUES,
  SEED_EVENTS,
};
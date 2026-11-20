export type MenuCategory = 'signature' | 'coffee' | 'non-coffee';

export interface MenuItemConfig {
  id: string;
  category: MenuCategory;
  name: string;
  description?: string;
  image: string;
  price: number | null;
}

export interface StoreInfoConfig {
  brandName: string;
  address: string;
  hours: string;
  mapUrl: string;
  phone: string;
  youtubeUrl: string;
}

export interface CampaignSummary {
  id: string;
  title: string;
  benefitText: string;
  conditionText: string;
  issueStartAt: string | null;
  issueEndAt: string | null;
  redeemEndAt: string | null;
  status: 'draft' | 'active' | 'paused' | 'ended';
  isTest: boolean;
}

export type PublicCouponAvailability =
  | 'ready'
  | 'upcoming'
  | 'preparing'
  | 'ended'
  | 'paused';

export interface StorePlaceDetails {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  location: {
    lat: number;
    lng: number;
  } | null;
  kakaoMapUri: string;
  directionsUri: string;
}

export interface PublicConfigResponse {
  store: StoreInfoConfig;
  menu: MenuItemConfig[];
  campaign: CampaignSummary | null;
  availability: PublicCouponAvailability;
  isPreviewTestMode: boolean;
  kakaoMapAppKey?: string;
  serverNow: string;
}

export type CouponStatus = 'unused' | 'used' | 'expired';

export interface CustomerCouponDTO {
  code: string;
  campaignId: string;
  benefitText: string;
  conditionText: string;
  status: CouponStatus;
  isTest: boolean;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface StaffUser {
  id: string;
  name: string;
  role: 'staff' | 'admin';
}

export interface StaffCouponRecord {
  code: string;
  campaignId: string;
  benefitText: string;
  conditionText: string;
  status: CouponStatus;
  isTest: boolean;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
  usedByName: string | null;
}

export interface StaffMetrics {
  issuedCount: number;
  usedCount: number;
  redemptionRate: number;
  testIssuedCount: number;
  testUsedCount: number;
}

export interface EditableCampaignSettings {
  liveIssueStartAt: string;
  liveIssueEndAt: string;
  liveRedeemEndAt: string;
  liveStatus: 'draft' | 'active' | 'paused' | 'ended';
}

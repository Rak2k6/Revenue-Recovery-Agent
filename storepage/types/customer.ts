import { ShippingAddress } from './order';

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  defaultAddress?: ShippingAddress;
  createdAt: string;
}

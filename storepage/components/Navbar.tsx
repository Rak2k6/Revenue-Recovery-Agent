import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { NotificationBell } from './NotificationBell';
import { CustomerNotification } from '../types/notification';

interface NavbarProps {
  notifications: CustomerNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onActionClick: (notification: CustomerNotification) => void;
}

const NAV_CATEGORIES = [
  { name: 'Shop All', path: '/shop' },
  { name: 'Audio', path: '/shop?category=Audio' },
  { name: 'Wearables', path: '/shop?category=Wearables' },
  { name: 'Computing', path: '/shop?category=Computing' },
  { name: 'Home', path: '/shop?category=Home' },
  { name: 'Accessories', path: '/shop?category=Accessories' },
];

export const Navbar: React.FC<NavbarProps> = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onActionClick,
}) => {
  const { navigate, currentPath } = useRouter();
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setIsMobileMenuOpen(false);
    }
  };

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E5E5E2] transition-all">
      {/* Top micro announcement bar */}
      <div className="bg-[#1A1A1A] text-white text-[10px] uppercase tracking-[0.2em] py-2 px-4 text-center font-medium flex items-center justify-center gap-2">
        <Sparkles className="w-3 h-3 text-[#D44D2F]" />
        <span>Complimentary Express Logistics on all orders over ₹999</span>
        <span className="hidden sm:inline text-neutral-400">•</span>
        <span className="hidden sm:inline text-neutral-300">Code LUMINA10 for 10% off your initial order</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-[#1A1A1A] hover:bg-[#F4F4F1] rounded-sm transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Brand Logo in Editorial Aesthetics */}
          <div
            onClick={() => navigate('/')}
            className="cursor-pointer flex flex-col items-start select-none"
          >
            <span className="text-2xl sm:text-3xl font-serif italic tracking-tight text-[#1A1A1A] leading-none">
              LUMINA
            </span>
            <span className="text-[8px] uppercase tracking-[0.3em] text-[#9A9A95] font-sans font-semibold mt-1">
              Studio & Living
            </span>
          </div>

          {/* Desktop Category Navigation */}
          <nav className="hidden lg:flex items-center space-x-8 text-xs uppercase tracking-widest font-medium text-[#666662]">
            {NAV_CATEGORIES.map(cat => {
              const isActive =
                cat.path === currentPath ||
                (cat.path.startsWith('/shop?category=') &&
                  currentPath.includes(cat.path.split('category=')[1]));

              return (
                <button
                  key={cat.name}
                  onClick={() => navigate(cat.path)}
                  className={`py-1.5 transition-all cursor-pointer relative ${
                    isActive
                      ? 'text-[#1A1A1A] font-bold border-b-2 border-[#1A1A1A]'
                      : 'hover:text-[#1A1A1A]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons: Search, Wishlist, Notification Bell, Account, Bag */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            
            {/* Search Toggle / Input */}
            <div className="relative">
              {isSearchOpen ? (
                <form
                  onSubmit={handleSearchSubmit}
                  className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center bg-white border border-[#1A1A1A] shadow-lg rounded-sm overflow-hidden w-64 sm:w-80 z-50"
                >
                  <Search className="w-4 h-4 ml-3 text-[#9A9A95]" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search headphones, keyboards..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    className="p-2 text-[#9A9A95] hover:text-[#1A1A1A]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 text-[#1A1A1A] hover:text-[#666662] transition-colors"
                  aria-label="Search catalog"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Wishlist Link */}
            <button
              onClick={() => navigate('/account')}
              className="relative p-2 text-[#1A1A1A] hover:text-[#666662] transition-colors hidden sm:inline-block"
              aria-label="View Wishlist"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#1A1A1A] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Customer Notifications Center */}
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={onMarkRead}
              onMarkAllRead={onMarkAllRead}
              onActionClick={onActionClick}
            />

            {/* Customer Account */}
            <button
              onClick={() => navigate('/account')}
              className="p-2 text-[#1A1A1A] hover:text-[#666662] transition-colors"
              aria-label="Customer Account"
            >
              <User className="w-5 h-5" />
            </button>

            {/* Cart / Bag Button */}
            <button
              id="navbar-bag-btn"
              onClick={() => navigate('/cart')}
              className="relative inline-flex items-center gap-2 px-3.5 py-2 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-widest font-bold rounded-sm transition-colors cursor-pointer"
              aria-label={`Shopping bag with ${itemCount} items`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden md:inline font-sans">Bag</span>
              <span className="text-[10px] bg-white text-[#1A1A1A] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                {itemCount}
              </span>
            </button>

          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#E5E5E2] bg-white px-6 py-6 space-y-5 animate-in slide-in-from-top-2 duration-200 shadow-xl">
          {/* Mobile search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#E5E5E2] text-xs focus:outline-none focus:border-[#1A1A1A]"
            />
            <Search className="w-4 h-4 text-[#9A9A95] absolute left-3 top-3" />
          </form>

          {/* Categories */}
          <div className="flex flex-col space-y-3 pt-2">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#9A9A95]">
              Shop Categories
            </span>
            {NAV_CATEGORIES.map(cat => (
              <button
                key={cat.name}
                onClick={() => {
                  navigate(cat.path);
                  setIsMobileMenuOpen(false);
                }}
                className="text-left text-sm font-serif italic text-[#1A1A1A] py-1 hover:text-[#D44D2F] flex items-center justify-between"
              >
                <span>{cat.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#9A9A95]" />
              </button>
            ))}
          </div>

          {/* Account quick links */}
          <div className="pt-4 border-t border-[#F0F0EE] flex items-center justify-between text-xs text-[#666662]">
            <button
              onClick={() => {
                navigate('/account');
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-1.5 hover:text-[#1A1A1A]"
            >
              <User className="w-4 h-4" />
              <span>Customer Account</span>
            </button>
            <button
              onClick={() => {
                navigate('/account');
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-1.5 hover:text-[#1A1A1A]"
            >
              <Heart className="w-4 h-4" />
              <span>Wishlist ({wishlistCount})</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

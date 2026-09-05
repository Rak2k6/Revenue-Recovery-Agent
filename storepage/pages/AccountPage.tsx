import React, { useState, useEffect } from 'react';
import {
  User,
  Package,
  Heart,
  MapPin,
  Calendar,
  Truck,
  ArrowRight,
  ShoppingBag,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { Order } from '../types/order';
import { Product } from '../types/product';
import { MOCK_PRODUCTS } from '../data/products';

export const AccountPage: React.FC = () => {
  const { navigate } = useRouter();
  const { wishlistIds, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();

  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'addresses'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    api.getCustomerOrders().then(ords => {
      setOrders(ords);
      setLoadingOrders(false);
    });
  }, []);

  const wishlistProducts = MOCK_PRODUCTS.filter(p => wishlistIds.includes(p.id));

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'SHIPPED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PREPARING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CONFIRMED':
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      
      {/* Header Profile Section */}
      <div className="bg-white border border-[#E5E5E2] p-6 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#F4F4F1] border border-[#E5E5E2] flex items-center justify-center text-[#1A1A1A]">
            <User className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#9A9A95] block">
              Studio Patron
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif italic text-[#1A1A1A]">
              Rahul Sharma
            </h1>
            <p className="text-xs text-[#666662] font-sans">
              customer@example.com • Member since 2024
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/shop')}
            className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer"
          >
            Explore Store
          </button>
        </div>
      </div>

      {/* Account Tabs */}
      <div className="flex border-b border-[#E5E5E2] bg-white">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-4 text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'border-b-2 border-[#1A1A1A] text-[#1A1A1A]'
              : 'text-[#666662] hover:text-[#1A1A1A]'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Order History ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('wishlist')}
          className={`px-6 py-4 text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'wishlist'
              ? 'border-b-2 border-[#1A1A1A] text-[#1A1A1A]'
              : 'text-[#666662] hover:text-[#1A1A1A]'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Wishlist ({wishlistProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('addresses')}
          className={`px-6 py-4 text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'addresses'
              ? 'border-b-2 border-[#1A1A1A] text-[#1A1A1A]'
              : 'text-[#666662] hover:text-[#1A1A1A]'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Delivery Addresses</span>
        </button>
      </div>

      {/* Tab 1: Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {loadingOrders ? (
            <div className="p-12 text-center text-xs text-[#9A9A95]">
              Loading previous orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 bg-white border border-[#E5E5E2] text-center space-y-4">
              <h3 className="font-serif italic text-xl text-[#1A1A1A]">No Orders Placed Yet</h3>
              <p className="text-xs text-[#666662]">When you complete an order, it will appear here with live tracking.</p>
              <button
                onClick={() => navigate('/shop')}
                className="px-6 py-3 bg-[#1A1A1A] text-white text-xs uppercase tracking-widest font-bold"
              >
                Browse Instruments
              </button>
            </div>
          ) : (
            orders.map(ord => (
              <div
                key={ord.id}
                className="bg-white border border-[#E5E5E2] p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#F0F0EE] gap-2">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-[#1A1A1A]">
                        {ord.orderNumber}
                      </span>
                      <span
                        className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 border ${getStatusBadge(
                          ord.status
                        )}`}
                      >
                        {ord.status}
                      </span>
                    </div>
                    <span className="text-xs text-[#9A9A95] block mt-0.5">
                      Placed on {new Date(ord.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-sans font-bold text-base text-[#1A1A1A]">
                      ₹{ord.total.toLocaleString('en-IN')}
                    </span>
                    <button
                      onClick={() => navigate(`/orders/${ord.id}`)}
                      className="px-3.5 py-1.5 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer"
                    >
                      View Receipt
                    </button>
                  </div>
                </div>

                {/* Items in this order */}
                <div className="divide-y divide-[#F0F0EE]">
                  {ord.items.map(item => (
                    <div
                      key={item.id}
                      className="py-3 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.product.thumbnail}
                          alt={item.product.name}
                          className="w-12 h-12 object-contain bg-[#F4F4F1] border border-[#E5E5E2] p-1 shrink-0"
                        />
                        <div>
                          <h4
                            onClick={() => navigate(`/products/${item.product.id}`)}
                            className="font-serif italic text-[#1A1A1A] hover:text-[#D44D2F] cursor-pointer"
                          >
                            {item.product.name}
                          </h4>
                          <span className="text-[10px] text-[#9A9A95]">
                            Qty: {item.quantity} • ₹{item.product.price.toLocaleString('en-IN')} each
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          addToCart(item.product, item.selectedVariant, 1);
                          navigate('/cart');
                        }}
                        className="text-xs text-[#1A1A1A] hover:text-[#D44D2F] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Buy Again</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Footer status notice */}
                <div className="pt-2 flex items-center justify-between text-xs text-[#666662] border-t border-[#F0F0EE]">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#1A1A1A]" />
                    <span>Tracking: <strong>{ord.trackingNumber || 'TRK-982144'}</strong></span>
                  </span>
                  <span>Estimated Arrival: <strong>{ord.estimatedDeliveryDate}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Wishlist */}
      {activeTab === 'wishlist' && (
        <div className="space-y-6">
          {wishlistProducts.length === 0 ? (
            <div className="p-12 bg-white border border-[#E5E5E2] text-center space-y-4">
              <h3 className="font-serif italic text-xl text-[#1A1A1A]">No Wishlist Items Saved</h3>
              <p className="text-xs text-[#666662]">Tap the heart icon on any product to save it to your private list.</p>
              <button
                onClick={() => navigate('/shop')}
                className="px-6 py-3 bg-[#1A1A1A] text-white text-xs uppercase tracking-widest font-bold"
              >
                Browse Instruments
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlistProducts.map(p => (
                <div
                  key={p.id}
                  className="bg-white border border-[#E5E5E2] p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="relative aspect-square bg-[#F4F4F1] p-4 flex items-center justify-center">
                    <img
                      src={p.thumbnail}
                      alt={p.name}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      onClick={() => toggleWishlist(p.id)}
                      className="absolute top-2 right-2 p-1.5 bg-white text-[#D44D2F] rounded-full shadow-xs"
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#9A9A95] block">
                      {p.category}
                    </span>
                    <h4
                      onClick={() => navigate(`/products/${p.id}`)}
                      className="font-serif italic text-base text-[#1A1A1A] hover:text-[#D44D2F] cursor-pointer"
                    >
                      {p.name}
                    </h4>
                    <span className="font-sans font-bold text-sm text-[#1A1A1A] block mt-1">
                      ₹{p.price.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      addToCart(p, p.variants[0], 1);
                      navigate('/cart');
                    }}
                    className="w-full py-2.5 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-wider font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Move to Bag</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Delivery Addresses */}
      {activeTab === 'addresses' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white border border-[#1A1A1A] p-6 space-y-3 relative">
            <span className="bg-[#1A1A1A] text-white text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 absolute top-4 right-4">
              Primary Address
            </span>
            <h3 className="font-serif italic text-base text-[#1A1A1A]">
              Rahul Sharma
            </h3>
            <p className="text-xs text-[#666662] leading-relaxed">
              402, Sea View Residency, Bandra West<br />
              Near Joggers Park, Mumbai<br />
              Maharashtra - 400050<br />
              India
            </p>
            <p className="text-xs text-[#1A1A1A] font-medium pt-1">
              Contact: +91 98765 43210
            </p>
          </div>

          <div className="border border-dashed border-[#E5E5E2] bg-[#FBFBF9] p-6 flex flex-col items-center justify-center text-center space-y-2 cursor-pointer hover:border-[#1A1A1A] transition-colors">
            <MapPin className="w-6 h-6 text-[#9A9A95]" />
            <h4 className="font-serif italic text-sm text-[#1A1A1A]">Add New Studio Destination</h4>
            <span className="text-[11px] text-[#9A9A95]">Add an alternate delivery location</span>
          </div>
        </div>
      )}

    </div>
  );
};

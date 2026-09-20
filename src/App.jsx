import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { DataProvider } from './context/DataContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import SpecialDayCheck from './components/SpecialDayCheck.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import TitleSync from './components/TitleSync.jsx';
import PageTransition from './components/PageTransition.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Checkout from './pages/Checkout.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import OrderStatus from './pages/OrderStatus.jsx';
import OrderManage from './pages/OrderManage.jsx';
import MyOrders from './pages/MyOrders.jsx';
import Returns from './pages/Returns.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Admin from './pages/Admin.jsx';
import Customer360 from './pages/Customer360.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';
import Profile from './pages/Profile.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';

export default function App() {
  const [cartOpen, setCartOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    setCartOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname, loc.search]);

  return (
    <DataProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <ScrollToTop />
            <TitleSync />
                        <Navbar onCartOpen={() => setCartOpen(true)} />
            <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
            <SpecialDayCheck />
            <PageTransition>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/track" element={<RequireAuth><OrderStatus /></RequireAuth>} />
              <Route path="/order-manage/:id" element={<RequireAuth><OrderManage /></RequireAuth>} />
              <Route path="/orders" element={<RequireAuth><MyOrders /></RequireAuth>} />
              <Route path="/returns" element={<RequireAuth><Returns /></RequireAuth>} />
              <Route path="/wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
                            <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
              <Route path="/customer360" element={<RequireAuth><Customer360 /></RequireAuth>} />
              <Route path="/dashboard" element={<RequireAuth><StaffDashboard /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<Home />} />
                        </Routes>
            </PageTransition>
            <Footer />
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </DataProvider>
  );
}
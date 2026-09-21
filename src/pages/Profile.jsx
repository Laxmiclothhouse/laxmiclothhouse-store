import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import AccountIcon from '../components/AccountIcon.jsx';

export default function Profile() {
  const { user, updateUserProfile, changePasswordWithCurrent, logout } = useAuth();
  const { hasProcessingOrdersForUser } = useData();
  const nav = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [specialDate, setSpecialDate] = useState(user?.specialDate || '');
  const [specialDateType, setSpecialDateType] = useState(user?.specialDateType || 'Birthday');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Name + mobile + address can only be changed when the user has NO processing order.
  // Processing = any of my orders whose status is not delivered/cancelled.
  const profileLocked = hasProcessingOrdersForUser ? hasProcessingOrdersForUser(user) : false;

  const [modalOpen, setModalOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  if (!user) {
    nav('/login', { replace: true, state: { from: '/profile' } });
    return null;
  }

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2500); };

  const saveProfile = async (e) => {
    e.preventDefault();
    // Email is never sent — it cannot be changed in any case.
    // Phone is identity-bound: it is set once (signup / OTP login) and can
    // never be edited afterwards — even with no orders in process.
    if (phone.trim() !== String(user?.phone || '').trim()) {
      setPhone(user?.phone || '');
      flash('Phone number cannot be changed. It is fixed to the number on your account.');
      return;
    }
    // When an order is processing, name + address are frozen (phone is always frozen).
    // When an order is processing, name + phone + address are all frozen.
    if (profileLocked) {
      // Revert any typed values back to the saved ones; nothing is saved.
      setName(user?.name || '');
      setPhone(user?.phone || '');
      setAddress(user?.address || '');
      flash('Profile is locked while you have an order in process. You can edit it again once all orders are delivered or cancelled.');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({
        name: name.trim(),
        // NOTE: phone is deliberately NOT sent — it is immutable.
        address: address.trim(),
        specialDate: specialDate || '',
        specialDateType: specialDateType || 'Birthday',
      });
      flash('Profile updated.');
    } catch (ex) {
      flash(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const submitChangePw = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) return setPwMsg('Passwords do not match.');
    if (newPw.length < 6) return setPwMsg('Password must be at least 6 characters.');
    try {
      await changePasswordWithCurrent(currentPw, newPw);
      flash('Password changed!');
      setModalOpen(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg('');
    } catch (ex) {
      setPwMsg(ex.message);
    }
  };

  return (
    <main className='page profile-page'>
      <div className='profile-container'>
        <div className='profile-header'>
          <div className='profile-avatar'><AccountIcon size={48} /></div>
          <div className='profile-head'>
            <h3 className='profile-name'>{user?.name || 'My Account'}</h3>
            <p>{user?.email}</p>
          </div>
        </div>

        <form onSubmit={saveProfile} className='form'>
          <h2>Personal details</h2>
          <label>Email (cannot be changed)
            <input value={user?.email || ''} disabled readOnly placeholder='Email' title='Email cannot be changed' />
          </label>
          {profileLocked && (
            <p className='muted'>Name, mobile number and address are locked while you have an order in process. You can change them again once all orders are delivered or cancelled.</p>
          )}
          <label>Name *
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Your name' required disabled={profileLocked} title={profileLocked ? 'Locked while an order is processing' : undefined} />
          </label>
          <label>Phone
            <input type='tel' value={phone} readOnly disabled placeholder='+91 98765 43210' title='Phone number is fixed to your account and cannot be changed' />
            <span className='muted tiny'>Phone number is fixed to your account and cannot be changed.</span>
          </label>
          <label>Address
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder='Street, city, postcode...' disabled={profileLocked} title={profileLocked ? 'Locked while an order is processing' : undefined} />
          </label>
          <div className="grid2">
            <label>Birthday / Anniversary (optional)
              <input type="date" value={specialDate} onChange={(e) => setSpecialDate(e.target.value)} max="2100-12-31" />
              <span className="muted tiny">We'll mail you a birthday gift coupon every year.</span>
            </label>
            <label>It is a…
              <select value={specialDateType} onChange={(e) => setSpecialDateType(e.target.value)}>
                <option value="Birthday">Birthday</option>
                <option value="Anniversary">Anniversary</option>
              </select>
            </label>
          </div>
          {msg && <p className='ok'>{msg}</p>}
          <div className='flex-row-m'>
            <button type='submit' className='btn btn-gold' disabled={profileLocked} title={profileLocked ? 'Locked while an order is processing' : undefined}>Save changes</button>
          </div>
        </form>

        <div className='profile-pw-row'>
          <button className='btn btn-dark btn-block' onClick={() => setModalOpen(true)}>Change password</button>
        </div>

        {modalOpen && (
          <div className='modal-overlay' onClick={() => setModalOpen(false)}>
            <div className='modal-card' onClick={(e) => e.stopPropagation()}>
              <div className='modal-head'>
                <h2>Change password</h2>
                <button className='modal-close' onClick={() => setModalOpen(false)}>x</button>
              </div>

              <form onSubmit={submitChangePw} className='form'>
                <label>Current password
                  <input type='password' value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
                </label>
                <label>New password
                  <input type='password' value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={6} />
                </label>
                <label>Confirm new password
                  <input type='password' value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required minLength={6} />
                </label>
                {pwMsg && <p className='error'>{pwMsg}</p>}
                <div className='flex-row-m'>
                  <button type='submit' className='btn btn-gold'>Change password</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className='profile-logout'>
          <button className='btn btn-dark' type='button' onClick={() => { logout(); nav('/'); }}>Log out</button>
        </div>
      </div>
    </main>
  );
}
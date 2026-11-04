import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AccountIcon from '../components/AccountIcon.jsx';

export default function Profile() {
  const { user, updateUserProfile, changePasswordWithCurrent, logout } = useAuth();
  const nav = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState(user?.address || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

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
    setSaving(true);
    try {
      await updateUserProfile({ email: email.trim(), phone: phone.trim(), name: name.trim(), address: address.trim() });
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
          <label>Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder='Email' title='Your email address' />
          </label>
          <label>Name *
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Your name' required disabled title='Name cannot be changed' />
          </label>
          <label>Phone
            <input type='tel' value={phone} onChange={(e) => setPhone(e.target.value)} placeholder='+91 98765 43210' title='Your phone number' />
          </label>
          <label>Address
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder='Street, city, postcode...' />
          </label>
          
          
          {msg && <p className='ok'>{msg}</p>}
          <div className='flex-row-m'>
            <button type='submit' className='btn btn-gold'>Save changes</button>
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
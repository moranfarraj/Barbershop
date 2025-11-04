import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebaseConfig';
import Constants from 'expo-constants';
const initialFormState = {
  fullName: '',
  username: '',
  email: '',
  password: '',
};
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '10203040';
const DAY_NAME_TO_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};
const HALF_HOUR_SLOTS = (() => {
  const slots = [];
  let minutes = 9 * 60;
  const end = 18 * 60 + 30;
  while (minutes <= end) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(
      `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    );
    minutes += 30;
  }
  return slots;
})();
const initialShopInventory = [];
const initialOrders = [];
const initialReservations = [];

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [mode, setMode] = useState('login');
  const [formValues, setFormValues] = useState(initialFormState);
  const [userName, setUserName] = useState('');
  const [shopItems, setShopItems] = useState(initialShopInventory);
  const [reservations, setReservations] = useState([]);
  const [orders, setOrders] = useState(initialOrders);
  const [currentUser, setCurrentUser] = useState(null);
  const [localProfiles, setLocalProfiles] = useState({});
  const [activeUsername, setActiveUsername] = useState(null);
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [pendingVerificationUsername, setPendingVerificationUsername] = useState(null);
  const [verificationCodeInput, setVerificationCodeInput] = useState('');

  const isLogin = mode === 'login';

  const resetForm = () => setFormValues(initialFormState);

  const handleChange = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return;
    }
    const shopRef = collection(db, 'shopItems');
    const unsubscribe = onSnapshot(
      shopRef,
      (snapshot) => {
        setShopItems(
          snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
        );
      },
      (error) => console.error('Shop subscription error', error),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return;
    }
    const reservationsRef = collection(db, 'reservations');
    const unsubscribe = onSnapshot(
      reservationsRef,
      (snapshot) => {
        setReservations(
          snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
        );
      },
      (error) => console.error('Reservations subscription error', error),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return;
    }
    const ordersRef = collection(db, 'orders');
    const unsubscribe = onSnapshot(
      ordersRef,
      (snapshot) => {
        setOrders(
          snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
        );
      },
      (error) => console.error('Orders subscription error', error),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeUsername) {
      setCurrentUser(null);
      return;
    }

    if (isFirebaseConfigured) {
      const userRef = doc(db, 'users', activeUsername);
      const unsubscribe = onSnapshot(
        userRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setCurrentUser({ username: activeUsername, ...snapshot.data() });
            setUserName(snapshot.data().fullName);
          }
        },
        (error) => console.error('User subscription error', error),
      );
      return unsubscribe;
    } else {
      const profile = localProfiles[activeUsername];
      if (profile) {
        setCurrentUser({ username: activeUsername, ...profile });
        setUserName(profile.fullName);
      }
    }
  }, [activeUsername, isFirebaseConfigured, localProfiles]);

  const fetchUserProfile = async (username) => {
    if (!username) return null;
    if (!isFirebaseConfigured) {
      return localProfiles[username] ?? null;
    }
    const userRef = doc(db, 'users', username);
    const snapshot = await getDoc(userRef);
    return snapshot.exists() ? snapshot.data() : null;
  };

  const saveUserProfile = async (username, data) => {
    if (!username) return;
    if (!isFirebaseConfigured) {
      setLocalProfiles((prev) => ({ ...prev, [username]: data }));
      return;
    }
    const userRef = doc(db, 'users', username);
    await setDoc(userRef, data);
  };

  const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  const sendVerificationEmail = async (email, code) => {
    const cfg = Constants?.expoConfig?.extra?.email || {};
    const apiKey = cfg.resendApiKey;
    const fromAddress = cfg.fromAddress || 'Barbershop <no-reply@example.com>';
    const brand = cfg.brandName || 'Barbershop';

    const subject = `${brand} – Verify your email address`;
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111;">
        <div style="max-width: 560px; margin: 24px auto; border: 1px solid #eee; border-radius: 12px; padding: 24px;">
          <h1 style="margin: 0 0 12px 0; font-size: 22px;">Verify your email</h1>
          <p style="margin: 0 0 16px 0; color: #444;">Welcome to ${brand}! Use the code below to verify your email address and complete your registration.</p>
          <div style="display: inline-block; padding: 12px 16px; border-radius: 10px; background: #111; color: #fff; font-weight: 700; letter-spacing: 2px; font-size: 20px;">${code}</div>
          <p style="margin: 16px 0 0 0; color: #444;">This code expires in 15 minutes. If you did not request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0" />
          <p style="margin: 0; color: #888; font-size: 12px;">${brand}</p>
        </div>
      </div>
    `;

    if (!apiKey) {
      console.warn('Resend API key missing. Configure expo.extra.email.resendApiKey in app.json');
      Alert.alert('Email not configured', 'Verification code logged to console for development. Configure email to send real messages.');
      console.log(`[DEV ONLY] Verification code for ${email}: ${code}`);
      return;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [email],
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Resend error: ${text}`);
      }
      Alert.alert('Verification email sent', `We've sent a 6-digit code to ${email}.`);
    } catch (e) {
      console.error('Failed to send verification email', e);
      Alert.alert('Email failed', 'Could not send verification email. Please try again later.');
    }
  };

  const openVerificationForUser = (username) => {
    setPendingVerificationUsername(username);
    setVerificationCodeInput('');
    setVerificationModalVisible(true);
  };

  const verifyCodeForUser = async () => {
    const username = pendingVerificationUsername;
    if (!username) return;
    const profile = await fetchUserProfile(username);
    const stored = profile?.verification;
    const now = Date.now();
    const notExpired = stored?.expiresAt ? new Date(stored.expiresAt).getTime() > now : true;
    if (!stored?.code || !notExpired) {
      Alert.alert('Code expired', 'Please request a new code.');
      return;
    }
    if (stored.code !== verificationCodeInput.trim()) {
      Alert.alert('Invalid code', 'The code you entered is incorrect.');
      return;
    }
    const nextVerification = {
      ...(stored || {}),
      verified: true,
      verifiedAt: new Date().toISOString(),
    };
    if (isFirebaseConfigured) {
      await setDoc(doc(db, 'users', username), { verification: nextVerification }, { merge: true });
    } else {
      setLocalProfiles((prev) => ({
        ...prev,
        [username]: { ...(prev[username] || {}), verification: nextVerification },
      }));
    }
    setVerificationModalVisible(false);
    Alert.alert('Verified', 'Your email has been verified. Awaiting admin approval.');
  };

  const handleSubmit = async () => {
    const usernameInput = formValues.username.trim();
    const normalizedUsername = usernameInput.toLowerCase();
    const passwordInput = formValues.password.trim();
    const fullNameInput = formValues.fullName.trim();
    const emailInput = formValues.email.trim();

    if (!usernameInput || !passwordInput) {
      Alert.alert('Missing info', 'Username and password are required.');
      return;
    }

    if (!isLogin && (!fullNameInput || !emailInput)) {
      Alert.alert(
        'Missing info',
        'Full name and email are required to create an account.',
      );
      return;
    }

    if (
      isLogin &&
      normalizedUsername === ADMIN_USERNAME &&
      passwordInput === ADMIN_PASSWORD
    ) {
      setUserName('Admin');
      // Track admin session so profile loads from Firestore
      setActiveUsername('admin');
      resetForm();
      setScreen('admin');
      return;
    }

    if (!isLogin && normalizedUsername === ADMIN_USERNAME) {
      Alert.alert('Unauthorized', 'This username is reserved for admin access.');
      return;
    }

    try {
      if (isLogin) {
        const profile = await fetchUserProfile(normalizedUsername);
        if (!profile || profile.password !== passwordInput) {
          Alert.alert('Login failed', 'Invalid username or password.');
          return;
        }
        const verified = Boolean(profile?.verification?.verified);
        const adminApproved = Boolean(profile?.verification?.adminApproved);
        if (!verified) {
          Alert.alert('Verify your email', 'Please enter the verification code sent to your email.');
          setActiveUsername(normalizedUsername);
          openVerificationForUser(normalizedUsername);
          return;
        }
        if (!adminApproved) {
          Alert.alert('Pending approval', 'Your account is awaiting admin approval. You can log in but content will be hidden until approved.');
        }
        setUserName(profile.fullName);
        setCurrentUser({
          username: normalizedUsername,
          fullName: profile.fullName,
          email: profile.email,
          verification: profile.verification,
        });
        setActiveUsername(normalizedUsername);
        resetForm();
        setScreen('main');
        return;
      }

      const existingProfile = await fetchUserProfile(normalizedUsername);
      if (existingProfile) {
        Alert.alert('Account exists', 'That username is already taken.');
        return;
      }

      const code = generateVerificationCode();
      const profileData = {
        fullName: fullNameInput,
        email: emailInput,
        password: passwordInput,
        verification: {
          code,
          verified: false,
          adminApproved: false,
          sentAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      };
      await saveUserProfile(normalizedUsername, profileData);
      await sendVerificationEmail(emailInput, code);
      setActiveUsername(normalizedUsername);
      setUserName(fullNameInput);
      setCurrentUser({
        username: normalizedUsername,
        ...profileData,
      });
      resetForm();
      setMode('login');
      openVerificationForUser(normalizedUsername);
    } catch (error) {
      console.error('Authentication error', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleSignOut = () => {
    resetForm();
    setMode('login');
    setCurrentUser(null);
    setActiveUsername(null);
    setScreen('auth');
  };

  const handleCreateReservation = async (newReservation) => {
    if (!newReservation) return;
    if (!isFirebaseConfigured) {
      setReservations((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, ...newReservation },
      ]);
      return;
    }
    try {
      await addDoc(collection(db, 'reservations'), newReservation);
    } catch (error) {
      console.error('Create reservation error', error);
      Alert.alert('Error', 'Could not save reservation.');
    }
  };

  const handleCancelReservation = async (reservationId) => {
    if (!reservationId) return;
    if (!isFirebaseConfigured) {
      setReservations((prev) => prev.filter((res) => res.id !== reservationId));
      return;
    }
    try {
      await deleteDoc(doc(db, 'reservations', reservationId));
    } catch (error) {
      console.error('Cancel reservation error', error);
      Alert.alert('Error', 'Could not cancel reservation.');
    }
  };

  const handleShopItemAdd = async (item) => {
    if (!item?.name) return;
    if (!isFirebaseConfigured) {
      setShopItems((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, ...item },
      ]);
      return;
    }
    try {
      await addDoc(collection(db, 'shopItems'), item);
    } catch (error) {
      console.error('Add shop item error', error);
      Alert.alert('Error', 'Could not add shop item.');
    }
  };

  const handleShopItemRemove = async (itemId) => {
    if (!itemId) return;
    if (!isFirebaseConfigured) {
      setShopItems((prev) => prev.filter((item) => item.id !== itemId));
      return;
    }
    try {
      await deleteDoc(doc(db, 'shopItems', itemId));
    } catch (error) {
      console.error('Remove shop item error', error);
      Alert.alert('Error', 'Could not remove shop item.');
    }
  };

  const handleCreateOrder = async (order) => {
    if (!order) return;
    if (!isFirebaseConfigured) {
      setOrders((prev) => [...prev, { id: `local-${Date.now()}`, ...order }]);
      return;
    }
    try {
      await addDoc(collection(db, 'orders'), order);
    } catch (error) {
      console.error('Create order error', error);
      Alert.alert('Error', 'Could not complete checkout.');
    }
  };

  const handleProfileUpdate = async (updates) => {
    if (!currentUser?.username) {
      Alert.alert('Error', 'No user session found.');
      return;
    }
    const nextProfile = {
      fullName: updates.fullName ?? currentUser.fullName,
      email: updates.email ?? currentUser.email,
    };

    try {
      if (isFirebaseConfigured) {
        await setDoc(
          doc(db, 'users', currentUser.username),
          {
            fullName: nextProfile.fullName,
            email: nextProfile.email,
            ...(updates.password && { password: updates.password }),
          },
          { merge: true },
        );
      } else {
        setLocalProfiles((prev) => ({
          ...prev,
          [currentUser.username]: {
            ...(prev?.[currentUser.username] || {}),
            fullName: nextProfile.fullName,
            email: nextProfile.email,
            ...(updates.password && { password: updates.password }),
          },
        }));
      }

      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              fullName: nextProfile.fullName,
              email: nextProfile.email,
            }
          : prev,
      );
      setUserName(nextProfile.fullName);
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (error) {
      console.error('Profile update error', error);
      Alert.alert('Error', 'Could not update profile.');
    }
  };

  return (
    <SafeAreaProvider>
      {screen === 'main' && (
        <MainScreen
          name={userName}
          onSignOut={handleSignOut}
          reservations={reservations}
          onCreateReservation={handleCreateReservation}
          shopItems={shopItems}
          onCancelReservation={handleCancelReservation}
          currentUser={currentUser}
          orders={orders}
          onUpdateProfile={handleProfileUpdate}
          onCreateOrder={handleCreateOrder}
          username={activeUsername}
        />
      )}
      {screen === 'admin' && (
        <AdminScreen
          onSignOut={handleSignOut}
          shopItems={shopItems}
          onAddShopItem={handleShopItemAdd}
          onRemoveShopItem={handleShopItemRemove}
          reservations={reservations}
          currentUser={currentUser}
          onUpdateProfile={handleProfileUpdate}
          onApproveUser={async (username) => {
            try {
              if (isFirebaseConfigured) {
                await setDoc(doc(db, 'users', username), { verification: { adminApproved: true } }, { merge: true });
              } else {
                setLocalProfiles((prev) => ({
                  ...prev,
                  [username]: {
                    ...(prev[username] || {}),
                    verification: { ...(prev[username]?.verification || {}), adminApproved: true },
                  },
                }));
              }
              Alert.alert('Approved', `@${username} has been approved.`);
            } catch (e) {
              console.error('Approve user error', e);
              Alert.alert('Error', 'Could not approve user.');
            }
          }}
        />
      )}
      {screen === 'auth' && (
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Barbershop</Text>
              <Text style={styles.subtitle}>Look sharp. Feel sharper.</Text>
            </View>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
                onPress={() => handleModeChange('login')}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    isLogin && styles.toggleLabelActive,
                  ]}
                >
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  !isLogin && styles.toggleButtonActive,
                ]}
                onPress={() => handleModeChange('signup')}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    !isLogin && styles.toggleLabelActive,
                  ]}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              {!isLogin && (
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor="#8a8a8a"
                  value={formValues.fullName}
                  onChangeText={(value) => handleChange('fullName', value)}
                  autoCapitalize="words"
                />
              )}
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#8a8a8a"
                value={formValues.username}
                onChangeText={(value) => handleChange('username', value)}
                autoCapitalize="none"
              />
              {!isLogin && (
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#8a8a8a"
                  keyboardType="email-address"
                  value={formValues.email}
                  onChangeText={(value) => handleChange('email', value)}
                  autoCapitalize="none"
                />
              )}
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#8a8a8a"
                secureTextEntry
                value={formValues.password}
                onChangeText={(value) => handleChange('password', value)}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
                <Text style={styles.primaryButtonText}>
                  {isLogin ? 'Log In' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => handleModeChange(isLogin ? 'signup' : 'login')}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryText}>
                {isLogin
                  ? 'Need an account? Tap here to sign up.'
                  : 'Already have an account? Sign in instead.'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
      {/* Verification Modal */}
      <Modal
        visible={verificationModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setVerificationModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>Email verification</Text>
            <Text style={{ color: '#666' }}>Enter the 6-digit code we sent to your email.</Text>
            <TextInput
              style={styles.input}
              value={verificationCodeInput}
              onChangeText={setVerificationCodeInput}
              placeholder="123456"
              placeholderTextColor="#8a8a8a"
              keyboardType="number-pad"
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.smallButton, { flex: 1 }]} onPress={() => setVerificationModalVisible(false)}>
                <Text style={styles.smallButtonLabel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallButtonDanger, { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10 }]} onPress={verifyCodeForUser}>
                <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaProvider>
  );
}

// AdminScreen with tabs: Schedule | Shop | Customers | Days
const AdminScreen = ({ onSignOut, shopItems, onAddShopItem, onRemoveShopItem, reservations, currentUser, onUpdateProfile, onApproveUser }) => {
  const [tab, setTab] = useState('schedule');
  const barberTabs = ['Fadi Salameh', 'Islam'];
  const [barberTab, setBarberTab] = useState(barberTabs[0]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const isCompact = width < 400;
  const CELL_WIDTH = isSmall ? 110 : 130;
  const TIME_COL_WIDTH = 84;
  const BOTTOM_BAR_HEIGHT = 56;

  // Firestore-backed admin data
  const [users, setUsers] = useState([]); // array of { id: username, fullName, email }
  const [workingDays, setWorkingDays] = useState([]); // array of { id: 'Monday', isOpen: true }

  // Shop inputs
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Days input
  const [newDayLabel, setNewDayLabel] = useState('');

  // Admin profile form
  const [adminProfileForm, setAdminProfileForm] = useState({
    fullName: currentUser?.fullName || '',
    email: currentUser?.email || '',
    newPassword: '',
  });

  useEffect(() => {
    setAdminProfileForm({
      fullName: currentUser?.fullName || '',
      email: currentUser?.email || '',
      newPassword: '',
    });
  }, [currentUser]);

  useEffect(() => {
    // Users subscription
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Admin users subscription error', err),
    );

    // Working days subscription
    const unsubDays = onSnapshot(
      collection(db, 'workingDays'),
      (snap) => setWorkingDays(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Admin workingDays subscription error', err),
    );

    return () => {
      unsubUsers && unsubUsers();
      unsubDays && unsubDays();
    };
  }, []);

  // ---- Shop handlers ----
  const handleAddShop = async () => {
    const name = newItemName.trim();
    const price = parseFloat(newItemPrice);
    if (!name || Number.isNaN(price)) {
      Alert.alert('Invalid item', 'Enter a name and numeric price.');
      return;
    }
    await onAddShopItem({ name, price });
    setNewItemName('');
    setNewItemPrice('');
  };

  // ---- Days handlers ----
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleAddDay = async () => {
    const label = newDayLabel.trim();
    if (!label) return;
    try {
      await setDoc(doc(db, 'workingDays', label), { isOpen: true }, { merge: true });
      setNewDayLabel('');
    } catch (e) {
      console.error('Add working day error', e);
      Alert.alert('Error', 'Could not add day.');
    }
  };

  const handleToggleDay = async (label, isOpen) => {
    try {
      await setDoc(doc(db, 'workingDays', label), { isOpen: !isOpen }, { merge: true });
    } catch (e) {
      console.error('Toggle working day error', e);
    }
  };

  const handleRemoveDay = async (label) => {
    try {
      await deleteDoc(doc(db, 'workingDays', label));
    } catch (e) {
      console.error('Remove working day error', e);
    }
  };

  // ---- Customers handlers ----
  const handleRemoveUser = async (username) => {
    try {
      await deleteDoc(doc(db, 'users', username));
    } catch (e) {
      console.error('Delete user error', e);
    }
  };

  // ---- Schedule grid (per barber) ----
  const reservationLookup = useMemo(() => {
    const map = {};
    reservations.forEach((r) => {
      if (r.barber !== barberTab) return;
      const dt = new Date(r.dateTime);
      const day = WEEKDAYS[dt.getDay()];
      const slot = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      if (!map[day]) map[day] = {};
      map[day][slot] = r;
    });
    return map;
  }, [reservations, barberTab]);

  const renderSchedule = () => {
    const bookedColor = barberTab === 'Fadi Salameh' ? '#2b6cb0' : '#2f855a';
    return (
      <ScrollView horizontal style={styles.calendarScroll} showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.calendarHeaderRow}>
            <View style={[styles.calendarCell, styles.calendarTimeHeader, { width: TIME_COL_WIDTH }]}>
              <Text style={styles.calendarHeaderText}>Time</Text>
            </View>
            {DAY_ORDER.map((d) => (
              <View key={d} style={[styles.calendarCell, styles.calendarDayHeader, { width: CELL_WIDTH }]}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.calendarHeaderText}>{d}</Text>
              </View>
            ))}
          </View>
          {HALF_HOUR_SLOTS.map((slot, idx) => (
            <View key={slot} style={[styles.calendarRow, idx % 2 === 0 ? { backgroundColor: '#fafafa' } : null]}>
              <View style={[styles.calendarCell, styles.calendarTimeCell, { width: TIME_COL_WIDTH }]}>
                <Text style={styles.calendarTimeLabel}>{slot}</Text>
              </View>
              {DAY_ORDER.map((d) => {
                const res = reservationLookup?.[d]?.[slot];
                return (
                  <View key={`${d}-${slot}`} style={[styles.calendarCell, { width: CELL_WIDTH }]}>
                    {res ? (
                      <View style={[styles.calendarBooked, { backgroundColor: bookedColor }]}>
                        <Text style={styles.calendarBookedClient} numberOfLines={1} adjustsFontSizeToFit>{res.client}</Text>
                        <Text style={styles.calendarBookedMeta} numberOfLines={1} adjustsFontSizeToFit>{res.service}</Text>
                      </View>
                    ) : (
                      <Text style={styles.calendarEmpty}>—</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderShop = () => (
    <View style={[styles.sectionCard, styles.adminSection]}>
      <Text style={styles.sectionTitle}>Shop Inventory</Text>
      {shopItems.map((it) => (
        <View key={it.id} style={styles.listRow}>
          <View>
            <Text style={styles.listRowTitle}>{it.name}</Text>
            <Text style={styles.cardDetail}>${it.price.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={[styles.smallButton, styles.smallButtonDanger]} onPress={() => onRemoveShopItem(it.id)}>
            <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
      <View style={styles.inlineForm}>
        <TextInput
          style={styles.miniInput}
          placeholder="Item name"
          placeholderTextColor="#8a8a8a"
          value={newItemName}
          onChangeText={setNewItemName}
        />
        <TextInput
          style={styles.miniInput}
          placeholder="Price"
          placeholderTextColor="#8a8a8a"
          keyboardType="decimal-pad"
          value={newItemPrice}
          onChangeText={setNewItemPrice}
        />
        <TouchableOpacity style={[styles.smallButton, styles.smallButtonDanger]} onPress={handleAddShop}>
          <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCustomers = () => (
    <View style={[styles.sectionCard, styles.adminSection]}>
      <Text style={styles.sectionTitle}>Customers</Text>
      {users.length === 0 ? (
        <Text style={styles.optionDescription}>No users yet.</Text>
      ) : (
        users.map((u) => (
          <View key={u.id} style={styles.listRow}>
            <View>
              <Text style={styles.listRowTitle}>{u.fullName || u.id}</Text>
              <Text style={styles.cardDetail}>@{u.id} · {u.email}</Text>
              <Text style={[
                styles.statusPill,
                u?.verification?.verified ? styles.statusPillOpen : styles.statusPillClosed,
              ]}>
                {u?.verification?.verified ? 'Email verified' : 'Email pending'}
              </Text>
              <Text style={[
                styles.statusPill,
                u?.verification?.adminApproved ? styles.statusPillOpen : styles.statusPillClosed,
              ]}>
                {u?.verification?.adminApproved ? 'Admin approved' : 'Awaiting approval'}
              </Text>
            </View>
            <View style={styles.rowActions}>
              {!u?.verification?.adminApproved && (
                <TouchableOpacity style={styles.smallButton} onPress={() => onApproveUser(u.id)}>
                  <Text style={styles.smallButtonLabel}>Approve</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.smallButton, styles.smallButtonDanger]} onPress={() => handleRemoveUser(u.id)}>
                <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderDays = () => (
    <View style={[styles.sectionCard, styles.adminSection]}>
      <Text style={styles.sectionTitle}>Working Days</Text>
      {DAY_ORDER.map((label) => {
        const found = workingDays.find((d) => d.id === label);
        const isOpen = found?.isOpen ?? false;
        return (
          <View key={label} style={styles.listRow}>
            <Text style={styles.listRowTitle}>{label}</Text>
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.smallButton} onPress={() => handleToggleDay(label, isOpen)}>
                <Text style={styles.smallButtonLabel}>{isOpen ? 'Close' : 'Open'}</Text>
              </TouchableOpacity>
              {found && (
                <TouchableOpacity style={[styles.smallButton, styles.smallButtonDanger]} onPress={() => handleRemoveDay(label)}>
                  <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
      <View style={styles.inlineForm}>
        <TextInput
          style={styles.miniInput}
          placeholder="Add a day (e.g. Sunday)"
          placeholderTextColor="#8a8a8a"
          value={newDayLabel}
          onChangeText={setNewDayLabel}
        />
        <TouchableOpacity style={[styles.smallButton, styles.smallButtonDanger]} onPress={handleAddDay}>
          <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.adminTopSection}>
        <View style={styles.adminHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.adminHeading}>Admin</Text>
            <Text style={styles.adminSubheading}>Manage schedule, inventory and customers</Text>
          </View>
          <TouchableOpacity style={styles.smallButtonDanger} onPress={onSignOut}>
            <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Sign out</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[styles.adminContent, { paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>
          {tab === 'schedule' && (
            <View style={styles.adminSection}>
              <View style={styles.barberTabRow}>
                {barberTabs.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.barberTabButton, barberTab === b && styles.barberTabButtonActive]}
                    onPress={() => setBarberTab(b)}
                  >
                    <Text style={[styles.barberTabLabel, barberTab === b && styles.barberTabLabelActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {renderSchedule()}
            </View>
          )}
          {tab === 'shop' && renderShop()}
          {tab === 'customers' && renderCustomers()}
          {tab === 'days' && renderDays()}
          {tab === 'profile' && (
            <View style={[styles.sectionCard, styles.adminSection]}>
              <Text style={styles.sectionTitle}>Profile</Text>
              <View style={styles.profileHeaderRow}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarLabel}>
                    {(currentUser?.fullName || 'A').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.optionTitle}>{currentUser?.fullName || 'Admin'}</Text>
                  <Text style={styles.cardDetail}>@admin</Text>
                </View>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="#8a8a8a"
                value={adminProfileForm.fullName}
                onChangeText={(v) => setAdminProfileForm((p) => ({ ...p, fullName: v }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#8a8a8a"
                keyboardType="email-address"
                value={adminProfileForm.email}
                onChangeText={(v) => setAdminProfileForm((p) => ({ ...p, email: v }))}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor="#8a8a8a"
                secureTextEntry
                value={adminProfileForm.newPassword}
                onChangeText={(v) => setAdminProfileForm((p) => ({ ...p, newPassword: v }))}
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={async () => {
                  const payload = {
                    fullName: adminProfileForm.fullName,
                    email: adminProfileForm.email,
                  };
                  if (adminProfileForm.newPassword) payload.password = adminProfileForm.newPassword;
                  await onUpdateProfile(payload);
                  setAdminProfileForm((p) => ({ ...p, newPassword: '' }));
                  Alert.alert('Saved', 'Admin profile updated');
                }}
              >
                <Text style={styles.primaryButtonText}>Save changes</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        <View style={[styles.adminBottomBar, { paddingBottom: Math.max(6, 6 + insets.bottom), bottom: Math.max(12, 12 + insets.bottom) }]}>
          {['schedule', 'shop', 'customers', 'days', 'profile'].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.adminBottomButton, tab === t && styles.adminBottomButtonActive]}
              onPress={() => setTab(t)}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                allowFontScaling
                style={[styles.adminBottomLabel, tab === t && styles.adminBottomLabelActive]}
              >
                {t === 'schedule' ? 'Schedule' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 32,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#111',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e5e5',
    borderRadius: 999,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#111',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#555',
    fontWeight: '600',
  },
  toggleLabelActive: {
    color: '#fff',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  primaryButton: {
    backgroundColor: '#111',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryAction: {
    alignItems: 'center',
  },
  secondaryText: {
    color: '#333',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
    gap: 24,
  },
  mainContent: {
    flex: 1,
  },
  homeSection: {
    flex: 1,
    gap: 12,
  },
  mainHeading: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
  },
  mainSubheading: {
    fontSize: 16,
    color: '#555',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDetail: {
    fontSize: 14,
    color: '#666',
  },
  sectionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    justifyContent: 'center',
  },
  adminSectionCard: {
    flex: 0,
    width: '100%',
    justifyContent: 'flex-start',
  },
  signOutButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  signOutLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 999,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#111',
  },
  tabLabel: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#fff',
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backArrow: {
    fontSize: 18,
    color: '#111',
  },
  backLabel: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  currentPath: {
    color: '#666',
    fontSize: 14,
  },
  optionsGrid: {
    gap: 12,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 18,
    padding: 16,
    gap: 8,
    backgroundColor: '#fafafa',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  optionDescription: {
    color: '#666',
    fontSize: 14,
  },
  optionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dayChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dayChipActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  dayChipLabel: {
    color: '#333',
    fontWeight: '600',
  },
  dayChipLabelActive: {
    color: '#fff',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  timeChipActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  timeChipLabel: {
    color: '#333',
    fontWeight: '600',
  },
  timeChipLabelActive: {
    color: '#fff',
  },
  summaryCard: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#666',
    fontWeight: '600',
  },
  summaryValue: {
    color: '#111',
    fontWeight: '600',
  },
  cartCard: {
    gap: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#fafafa',
  },
  cartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartList: {
    gap: 12,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  cartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelChip: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  cancelChipLabel: {
    color: '#c53030',
    fontWeight: '600',
  },
  shopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  shopCard: {
    flexBasis: '48%',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    backgroundColor: '#fafafa',
  },
  reservationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileScroll: {
    gap: 16,
    paddingBottom: 32,
  },
  profileCard: {
    gap: 12,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarLabel: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  historyCard: {
    marginTop: 16,
    gap: 12,
  },
  historyRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 4,
  },
  adminWrapper: {
    flex: 1,
    paddingBottom: 24,
  },
  adminTopSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
  },
  adminContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  adminHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  adminHeading: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
  },
  adminSubheading: {
    fontSize: 15,
    color: '#666',
  },
  adminSection: {
    gap: 16,
  },
  adminTabBar: {
    flexDirection: 'row',
    backgroundColor: '#e5e5e5',
    borderRadius: 999,
    padding: 4,
    gap: 6,
  },
  adminTabButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  adminTabButtonActive: {
    backgroundColor: '#111',
  },
  adminTabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  adminTabLabelActive: {
    color: '#fff',
  },
  adminBottomBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 999,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    gap: 6,
  },
  adminBottomButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    minWidth: 0,
  },
  adminBottomButtonActive: {
    backgroundColor: '#111',
  },
  adminBottomLabel: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  adminBottomLabelActive: {
    color: '#fff',
  },
  barberTabRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 999,
    padding: 4,
    gap: 6,
    marginTop: 12,
    marginBottom: 12,
  },
  barberTabButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  barberTabButtonActive: {
    backgroundColor: '#111',
  },
  barberTabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  barberTabLabelActive: {
    color: '#fff',
  },
  calendarScroll: {
    marginTop: 12,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
  },
  calendarRow: {
    flexDirection: 'row',
  },
  calendarCell: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    gap: 4,
  },
  calendarTimeHeader: {
    width: 80,
    backgroundColor: '#111',
    borderTopLeftRadius: 16,
  },
  calendarDayHeader: {
    backgroundColor: '#111',
  },
  calendarHeaderText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  calendarTimeCell: {
    backgroundColor: '#fafafa',
  },
  calendarTimeLabel: {
    fontWeight: '600',
    color: '#333',
  },
  calendarClient: {
    fontWeight: '600',
    color: '#111',
  },
  calendarMeta: {
    fontSize: 12,
    color: '#555',
  },
  calendarBooked: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2,
  },
  calendarBookedClient: {
    color: '#fff',
    fontWeight: '700',
  },
  calendarBookedMeta: {
    color: '#e6e6e6',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarEmpty: {
    fontSize: 12,
    color: '#bbb',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  statusPill: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '600',
  },
  statusPillOpen: {
    backgroundColor: '#e0f6ec',
    color: '#0c8a43',
  },
  statusPillClosed: {
    backgroundColor: '#fdecea',
    color: '#c53030',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  smallButtonDanger: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  smallButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  smallButtonLabelAlt: {
    color: '#fff',
  },
  inlineForm: {
    flexDirection: 'row',
    gap: 12,
  },
  miniInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  stackForm: {
    gap: 12,
  },
  scheduleRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 4,
  },
});

const MainScreen = ({
  name,
  onSignOut,
  reservations,
  onCreateReservation,
  onCancelReservation,
  shopItems,
  currentUser,
  orders,
  onUpdateProfile,
  onCreateOrder,
  username: usernameProp,
}) => {
  const isApproved = Boolean(currentUser?.verification?.adminApproved);
  const tabOptions = [
    { id: 'home', label: 'Home' },
    { id: 'appointments', label: 'Bookings' },
    { id: 'shop', label: 'Shop' },
    { id: 'profile', label: 'Profile' },
  ];
  const [tab, setTab] = useState(tabOptions[0].id);
  const bookingSteps = ['service', 'barber', 'day', 'time', 'summary'];
  const [bookingStep, setBookingStep] = useState('service');
  const [selection, setSelection] = useState({
    service: null,
    barber: null,
    day: null,
    time: null,
  });
  const serviceOptions = [
    {
      id: 'classic',
      name: 'Classic Cut',
      duration: 30,
      price: 25,
      description: 'Timeless scissor cut with detailed finish.',
    },
    {
      id: 'fade',
      name: 'Skin Fade',
      duration: 45,
      price: 35,
      description: 'Clean fade with razor finish.',
    },
    {
      id: 'beard',
      name: 'Beard Trim',
      duration: 20,
      price: 18,
      description: 'Sculpted beard trim with hot towel.',
    },
    {
      id: 'groom',
      name: 'Full Grooming',
      duration: 60,
      price: 55,
      description: 'Cut, beard, and hot towel treatment.',
    },
  ];
  const barberOptions = [
    { id: 'fadi', name: 'Fadi Salameh', specialties: ['classic', 'fade', 'groom'] },
    { id: 'islam', name: 'Islam', specialties: ['classic', 'beard', 'groom'] },
  ];
  const barberAvailability = {
    fadi: {
      Monday: ['09:00', '09:30', '10:00', '10:30', '13:00', '13:30', '16:00', '16:30'],
      Wednesday: ['10:00', '10:30', '12:00', '12:30', '15:00', '15:30'],
      Friday: ['09:00', '09:30', '14:00', '14:30', '17:00', '17:30'],
      Saturday: ['10:00', '10:30', '12:00', '12:30', '14:00', '14:30'],
    },
    islam: {
      Tuesday: ['09:30', '10:00', '11:30', '12:00', '14:30', '15:00', '16:30'],
      Thursday: ['10:00', '10:30', '12:00', '12:30', '15:00', '15:30'],
      Sunday: ['11:00', '11:30', '13:00', '13:30', '16:00', '16:30'],
      Saturday: ['09:00', '09:30', '11:30', '12:00', '13:30', '14:00'],
    },
  };
  const dayOptions = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  const username = usernameProp || currentUser?.username || 'guest';
  const customerName = currentUser?.fullName || name || 'Guest';

  const [cartItems, setCartItems] = useState([]);
  const [profileForm, setProfileForm] = useState({
    fullName: currentUser?.fullName || '',
    email: currentUser?.email || '',
    newPassword: '',
  });
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);

  useEffect(() => {
    setProfileForm({
      fullName: currentUser?.fullName || '',
      email: currentUser?.email || '',
      newPassword: '',
    });
  }, [currentUser]);

  const customerReservations = useMemo(
    () =>
      reservations
        .filter((item) => item.client === customerName)
        .sort(
          (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
        ),
    [reservations, customerName],
  );

  const customerOrders = useMemo(
    () =>
      orders
        .filter((order) => order.username === username)
        .sort(
          (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
        ),
    [orders, username],
  );

  const addToCart = (item) => {
    setCartItems((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id);
      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateCartQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
    );
  };

  const removeFromCart = (itemId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems],
  );

  const handleCheckout = async () => {
    if (!cartItems.length) {
      Alert.alert('Cart empty', 'Please add items to your cart first.');
      return;
    }

    const orderPayload = {
      username,
      customerName,
      items: cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      total: cartTotal,
      createdAt: new Date().toISOString(),
    };

    await onCreateOrder(orderPayload);
    setCartItems([]);
    Alert.alert('Success', 'Thanks! Your items are on the way.');
  };

  const handleProfileFieldChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileSave = async () => {
    const payload = {
      fullName: profileForm.fullName,
      email: profileForm.email,
    };
    if (profileForm.newPassword) {
      payload.password = profileForm.newPassword;
    }
    await onUpdateProfile(payload);
    setProfileForm((prev) => ({ ...prev, newPassword: '' }));
    setProfileModalVisible(false);
  };
  const formatReservationDate = (value) =>
    new Date(value).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const getNextDateForSelection = (dayLabel, timeLabel) => {
    const targetDay = DAY_NAME_TO_INDEX[dayLabel];
    if (targetDay === undefined || !timeLabel) {
      return null;
    }
    const [hourStr, minuteStr] = timeLabel.split(':');
    const now = new Date();
    const result = new Date(now);
    const currentDay = now.getDay();
    let delta = (targetDay - currentDay + 7) % 7;
    result.setDate(now.getDate() + delta);
    result.setHours(Number(hourStr), Number(minuteStr), 0, 0);
    if (result <= now) {
      result.setDate(result.getDate() + 7);
    }
    return result;
  };

  const renderReservation = ({ item }) => (
    <View style={[styles.card, styles.reservationRow]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{item.service}</Text>
        <Text style={styles.cardDetail}>
          {formatReservationDate(item.dateTime)} · with {item.barber}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.cancelChip}
        onPress={() => onCancelReservation(item.id)}
      >
        <Text style={styles.cancelChipLabel}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const resetSelection = (base = 'service') => {
    setSelection((prev) => {
      switch (base) {
        case 'service':
          return { service: null, barber: null, day: null, time: null };
        case 'barber':
          return { ...prev, barber: null, day: null, time: null };
        case 'day':
          return { ...prev, day: null, time: null };
        case 'time':
          return { ...prev, time: null };
        default:
          return prev;
      }
    });
  };

  const handleServiceSelect = (service) => {
    setSelection({ service, barber: null, day: null, time: null });
    setBookingStep('barber');
  };

  const handleBarberSelect = (barber) => {
    setSelection((prev) => ({ ...prev, barber, day: null, time: null }));
    setBookingStep('day');
  };

  const handleDaySelect = (day) => {
    setSelection((prev) => ({ ...prev, day, time: null }));
    setBookingStep('time');
  };

  const handleTimeSelect = (time) => {
    setSelection((prev) => ({ ...prev, time }));
    setBookingStep('summary');
  };

  const handleBookingRestart = () => {
    setBookingStep('service');
    setSelection({ service: null, barber: null, day: null, time: null });
  };

  const handleConfirmReservation = async () => {
    if (!selection.service || !selection.barber || !selection.day || !selection.time) {
      return;
    }
    const nextDate = getNextDateForSelection(selection.day, selection.time);
    if (!nextDate) {
      Alert.alert('Try again', 'Unable to schedule this slot. Please pick another.');
      return;
    }
    const newReservation = {
      client: customerName,
      service: selection.service.name,
      barber: selection.barber.name,
      dateTime: nextDate.toISOString(),
    };
    await onCreateReservation(newReservation);
    Alert.alert(
      'Reservation saved',
      `${selection.barber.name.split(' ')[0]} will see you on ${nextDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}.`,
    );
    handleBookingRestart();
  };

  const handleBack = () => {
    const currentIndex = bookingSteps.indexOf(bookingStep);
    if (currentIndex <= 0) return;
    const prevStep = bookingSteps[currentIndex - 1];
    resetSelection(prevStep);
    setBookingStep(prevStep);
  };

  const selectedAvailability =
    selection.barber &&
    barberAvailability[selection.barber.id] &&
    selection.day
      ? barberAvailability[selection.barber.id][selection.day] || []
      : [];

  const stepTitles = {
    service: 'Choose your service',
    barber: 'Pick your barber',
    day: 'Pick a day',
    time: 'Select a time',
    summary: 'Review your booking',
  };

  const summaryDetails = selection.service && selection.barber && selection.day
    ? [
        { label: 'Service', value: selection.service.name },
        { label: 'Barber', value: selection.barber.name },
        { label: 'Day', value: selection.day },
        { label: 'Time', value: selection.time },
      ]
    : [];

  const renderServiceStep = () => (
    <View style={styles.optionsGrid}>
      {serviceOptions.map((service) => (
        <TouchableOpacity
          key={service.id}
          style={styles.optionCard}
          onPress={() => handleServiceSelect(service)}
        >
          <Text style={styles.optionTitle}>{service.name}</Text>
          <Text style={styles.optionDescription}>{service.description}</Text>
          <View style={styles.optionMetaRow}>
            <Text style={styles.optionMeta}>{service.duration} min</Text>
            <Text style={styles.optionMeta}>${service.price}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderBarberStep = () => {
    const availableBarbers = selection.service
      ? barberOptions.filter((barber) =>
          barber.specialties.includes(selection.service.id),
        )
      : barberOptions;
    return (
      <View style={styles.optionsGrid}>
        {availableBarbers.map((barber) => (
          <TouchableOpacity
            key={barber.id}
            style={styles.optionCard}
            onPress={() => handleBarberSelect(barber)}
          >
            <Text style={styles.optionTitle}>{barber.name}</Text>
            <Text style={styles.optionDescription}>
              Specialties:{' '}
              {barber.specialties
                .map(
                  (spec) =>
                    serviceOptions.find((svc) => svc.id === spec)?.name || spec,
                )
                .join(', ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderDayStep = () => {
    const availableDays = selection.barber
      ? dayOptions.filter(
          (day) => barberAvailability[selection.barber.id]?.[day]?.length,
        )
      : dayOptions;
    return (
      <View style={styles.dayGrid}>
        {availableDays.map((day) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayChip,
              selection.day === day && styles.dayChipActive,
            ]}
            onPress={() => handleDaySelect(day)}
          >
            <Text
              style={[
                styles.dayChipLabel,
                selection.day === day && styles.dayChipLabelActive,
              ]}
            >
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTimeStep = () => (
    <View style={styles.timeGrid}>
      {selectedAvailability.length === 0 && (
        <Text style={styles.optionDescription}>
          No availability on this day. Please go back and choose another day.
        </Text>
      )}
      {selectedAvailability.map((slot) => (
        <TouchableOpacity
          key={slot}
          style={[
            styles.timeChip,
            selection.time === slot && styles.timeChipActive,
          ]}
          onPress={() => handleTimeSelect(slot)}
        >
          <Text
            style={[
              styles.timeChipLabel,
              selection.time === slot && styles.timeChipLabelActive,
            ]}
          >
            {slot}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSummaryStep = () => (
    <View style={styles.summaryCard}>
      {summaryDetails.map((detail) => (
        <View key={detail.label} style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{detail.label}</Text>
          <Text style={styles.summaryValue}>{detail.value}</Text>
        </View>
      ))}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleConfirmReservation}
      >
        <Text style={styles.primaryButtonText}>Confirm reservation</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryAction} onPress={handleBookingRestart}>
        <Text style={styles.secondaryText}>Start over</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStepContent = () => {
    switch (bookingStep) {
      case 'service':
        return renderServiceStep();
      case 'barber':
        return renderBarberStep();
      case 'day':
        return renderDayStep();
      case 'time':
        return renderTimeStep();
      case 'summary':
        return renderSummaryStep();
      default:
        return null;
    }
  };

  const renderHome = () => (
    <View style={styles.homeSection}>
      <Text style={styles.mainHeading}>Welcome, {customerName}!</Text>
      <Text style={styles.mainSubheading}>
        Let’s get you seated. Follow the steps to reserve your spot.
      </Text>

      <View style={styles.bookingCard}>
        {bookingStep !== 'service' && (
          <TouchableOpacity style={styles.backRow} onPress={handleBack}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.stepTitle}>{stepTitles[bookingStep]}</Text>
        {selection.service && bookingStep !== 'service' && (
          <Text style={styles.currentPath}>
            {selection.service.name}
            {selection.barber ? ` › ${selection.barber.name}` : ''}
            {selection.day ? ` › ${selection.day}` : ''}
            {selection.time ? ` › ${selection.time}` : ''}
          </Text>
        )}
        {renderStepContent()}
      </View>

      {customerReservations.length === 0 ? (
        <Text style={styles.optionDescription}>
          You have no upcoming reservations. Start a new booking above.
        </Text>
      ) : (
        <FlatList
          data={customerReservations}
          keyExtractor={(item) => item.id}
          renderItem={renderReservation}
          contentContainerStyle={{ gap: 12, paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderAppointments = () => (
    <View style={styles.homeSection}>
      <Text style={styles.mainHeading}>Upcoming reservations</Text>
      <Text style={styles.mainSubheading}>
        All of your confirmed bookings in one place.
      </Text>
      {customerReservations.length === 0 ? (
        <Text style={styles.optionDescription}>
          No reservations yet. Head to Home to book your next visit.
        </Text>
      ) : (
        <FlatList
          data={customerReservations}
          keyExtractor={(item) => item.id}
          renderItem={renderReservation}
          contentContainerStyle={{ gap: 12, paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderShop = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Shop</Text>
      <Text style={styles.cardDetail}>
        Curated products from the barbershop. Inventory syncs directly with the admin panel.
      </Text>
      <TouchableOpacity
        style={styles.cartIcon}
        onPress={() => setCartModalVisible(true)}
      >
        <Text style={styles.cartIconLabel}>🛒</Text>
        {cartItems.length > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeLabel}>
              {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {shopItems.length === 0 ? (
        <Text style={styles.optionDescription}>No items yet—check back soon.</Text>
      ) : (
        <View style={styles.shopGrid}>
          {shopItems.map((item) => (
            <View key={item.id} style={styles.shopCard}>
              <Text style={styles.optionTitle}>{item.name}</Text>
              <Text style={styles.optionMeta}>${item.price.toFixed(2)}</Text>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => addToCart(item)}
              >
                <Text style={styles.smallButtonLabel}>Add to cart</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.cartCard}>
        <View style={styles.cartHeaderRow}>
          <Text style={styles.optionTitle}>Shopping cart</Text>
          <Text style={styles.optionMeta}>{cartItems.length} items</Text>
        </View>
        {cartItems.length === 0 ? (
          <Text style={styles.optionDescription}>Your cart is empty.</Text>
        ) : (
          <View style={styles.cartList}>
            {cartItems.map((item) => (
              <View key={item.id} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardDetail}>${item.price.toFixed(2)}</Text>
                </View>
                <View style={styles.cartQtyRow}>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => updateCartQuantity(item.id, item.quantity - 1)}
                  >
                    <Text style={styles.qtyButtonLabel}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.optionTitle}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => updateCartQuantity(item.id, item.quantity + 1)}
                  >
                    <Text style={styles.qtyButtonLabel}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.cancelChip}
                  onPress={() => removeFromCart(item.id)}
                >
                  <Text style={styles.cancelChipLabel}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={styles.cartFooter}>
          <Text style={styles.stepTitle}>Total: ${cartTotal.toFixed(2)}</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 0 }]}
            onPress={handleCheckout}
            disabled={!cartItems.length}
          >
            <Text style={styles.primaryButtonText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderProfile = () => (
    <ScrollView contentContainerStyle={styles.profileScroll}>
      <View style={styles.profileCard}>
        <View style={styles.profileHeaderRow}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarLabel}>
              {customerName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.optionTitle}>{customerName}</Text>
            <Text style={styles.cardDetail}>@{username}</Text>
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#8a8a8a"
          value={profileForm.fullName}
          onChangeText={(value) => handleProfileFieldChange('fullName', value)}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8a8a8a"
          keyboardType="email-address"
          value={profileForm.email}
          onChangeText={(value) => handleProfileFieldChange('email', value)}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor="#8a8a8a"
          secureTextEntry
          value={profileForm.newPassword}
          onChangeText={(value) => handleProfileFieldChange('newPassword', value)}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleProfileSave}>
          <Text style={styles.primaryButtonText}>Save changes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={onSignOut}>
          <Text style={styles.secondaryText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.sectionTitle}>Your reservations</Text>
        {customerReservations.length === 0 ? (
          <Text style={styles.optionDescription}>No bookings yet.</Text>
        ) : (
          customerReservations.map((booking) => (
            <View key={booking.id} style={styles.historyRow}>
              <Text style={styles.cardTitle}>{booking.service}</Text>
              <Text style={styles.cardDetail}>
                {formatReservationDate(booking.dateTime)} · {booking.barber}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.sectionTitle}>Shopping history</Text>
        {customerOrders.length === 0 ? (
          <Text style={styles.optionDescription}>No purchases yet.</Text>
        ) : (
          customerOrders.map((order) => (
            <View key={order.id} style={styles.historyRow}>
              <Text style={styles.cardTitle}>
                {order.items?.map((item) => item.name).join(', ')}
              </Text>
              <Text style={styles.cardDetail}>
                ${order.total?.toFixed?.(2) || order.total} ·
                {' '}
                {new Date(order.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
  const renderContent = () => {
    if (!isApproved) {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pending admin approval</Text>
          <Text style={styles.cardDetail}>
            Your account has been created and email verified. An admin must approve
            your registration before you can access the app content.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onSignOut}>
            <Text style={styles.primaryButtonText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      );
    }
    switch (tab) {
      case 'appointments':
        return renderAppointments();
      case 'shop':
        return renderShop();
      case 'profile':
        return renderProfile();
      default:
        return renderHome();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        <View style={styles.mainContent}>{renderContent()}</View>

        <View style={styles.bottomBar}>
          {tabOptions.map((tabOption) => (
            <TouchableOpacity
              key={tabOption.id}
              style={[
                styles.tabButton,
                tab === tabOption.id && styles.tabButtonActive,
              ]}
              onPress={() => setTab(tabOption.id)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  tab === tabOption.id && styles.tabLabelActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                allowFontScaling
              >
                {tabOption.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
// --- AdminScreen with tabs: Shop | Customers | Availability | Schedule ---
// const AdminScreen = ({
//   onSignOut,
//   shopItems,
//   onAddShopItem,
//   onRemoveShopItem,
//   reservations,
//   availability,
//   onSaveAvailability,
//   users,
//   onUpdateUserAdmin,
//   onDeleteUserAdmin,
// }) => {
//   const [tab, setTab] = useState('shop'); // 'shop' | 'customers' | 'availability' | 'schedule'
//   const [newName, setNewName] = useState('');
//   const [newPrice, setNewPrice] = useState('');

//   // ---- SHOP TAB ----
//   const handleAdd = () => {
//     const name = newName.trim();
//     const priceNum = parseFloat(newPrice);
//     if (!name || Number.isNaN(priceNum)) {
//       Alert.alert('Invalid', 'Please enter a name and numeric price.');
//       return;
//     }
//     onAddShopItem({ name, price: priceNum });
//     setNewName('');
//     setNewPrice('');
//   };

//   // ---- CUSTOMERS TAB ----
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [editUser, setEditUser] = useState({ fullName: '', email: '', password: '' });
//   const startEditUser = (u) => {
//     setSelectedUser(u.username);
//     setEditUser({ fullName: u.fullName || '', email: u.email || '', password: '' });
//   };
//   const saveUser = async () => {
//     if (!selectedUser) return;
//     const payload = { fullName: editUser.fullName, email: editUser.email };
//     if (editUser.password) payload.password = editUser.password;
//     await onUpdateUserAdmin(selectedUser, payload);
//     setEditUser({ fullName: '', email: '', password: '' });
//     setSelectedUser(null);
//   };

//   // ---- AVAILABILITY TAB ----
//   const barbers = [
//     { id: 'fadi', name: 'Fadi Salameh' },
//     { id: 'islam', name: 'Islam' },
//   ];
//   const [selectedBarber, setSelectedBarber] = useState(barbers[0].id);
//   const [selectedDay, setSelectedDay] = useState('Monday');
//   const [slotInput, setSlotInput] = useState('09:00');

//   const currentSchedule = availability?.[selectedBarber] || {};
//   const daySlots = currentSchedule[selectedDay] || [];

//   const addSlot = () => {
//     const v = slotInput.trim();
//     const isValid = /^\d{2}:\d{2}$/.test(v);
//     if (!isValid) {
//       Alert.alert('Invalid', 'Use HH:MM (24h).');
//       return;
//     }
//     const next = { ...currentSchedule, [selectedDay]: Array.from(new Set([...(daySlots || []), v])).sort() };
//     onSaveAvailability(selectedBarber, next);
//   };
//   const removeSlot = (v) => {
//     const next = { ...currentSchedule, [selectedDay]: (daySlots || []).filter(t => t !== v) };
//     onSaveAvailability(selectedBarber, next);
//   };

//   // ---- SCHEDULE (CALENDAR) TAB ----
//   const dayOptions = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
//   // index reservations by DayName + HH:MM
//   const indexByDayTime = {};
//   (reservations || []).forEach((r) => {
//     const d = new Date(r.dateTime);
//     const day = d.toLocaleString('en-US', { weekday: 'long' });
//     const hh = d.getHours().toString().padStart(2,'0');
//     const mm = d.getMinutes().toString().padStart(2,'0');
//     const key = `${hh}:${mm}`;
//     if (!indexByDayTime[day]) indexByDayTime[day] = {};
//     indexByDayTime[day][key] = r;
//   });

//   return (
//     <SafeAreaView style={styles.safeArea}>
//       <View style={styles.adminWrapper}>
//         <View style={styles.adminTopSection}>
//           <View style={styles.adminHeaderRow}>
//             <View>
//               <Text style={styles.adminHeading}>Admin</Text>
//               <Text style={styles.adminSubheading}>
//                 Manage shop, customers, availability, and schedule
//               </Text>
//             </View>
//             <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
//               <Text style={styles.signOutLabel}>Sign out</Text>
//             </TouchableOpacity>
//           </View>

//           <View style={styles.adminTabBar}>
//             {['shop','customers','availability','schedule'].map((t) => (
//               <TouchableOpacity
//                 key={t}
//                 style={[styles.adminTabButton, tab === t && styles.adminTabButtonActive]}
//                 onPress={() => setTab(t)}
//               >
//                 <Text style={[styles.adminTabLabel, tab === t && styles.adminTabLabelActive]}>
//                   {t.charAt(0).toUpperCase() + t.slice(1)}
//                 </Text>
//               </TouchableOpacity>
//             ))}
//           </View>
//         </View>

//         <ScrollView style={styles.adminContent}>
//           {/* SHOP */}
//           {tab === 'shop' && (
//             <View style={styles.adminSection}>
//               <Text style={styles.sectionTitle}>Shop inventory</Text>
//               <View style={styles.inlineForm}>
//                 <TextInput
//                   style={styles.miniInput}
//                   value={newName}
//                   onChangeText={setNewName}
//                   placeholder="Item name"
//                   placeholderTextColor="#8a8a8a"
//                 />
//                 <TextInput
//                   style={styles.miniInput}
//                   value={newPrice}
//                   onChangeText={setNewPrice}
//                   keyboardType="decimal-pad"
//                   placeholder="Price (e.g. 19.99)"
//                   placeholderTextColor="#8a8a8a"
//                 />
//                 <TouchableOpacity
//                   style={[styles.smallButton, styles.smallButtonDanger]}
//                   onPress={handleAdd}
//                 >
//                   <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Add</Text>
//                 </TouchableOpacity>
//               </View>

//               {shopItems?.length ? (
//                 shopItems.map((item) => (
//                   <View key={item.id} style={styles.listRow}>
//                     <View>
//                       <Text style={styles.listRowTitle}>{item.name}</Text>
//                       <Text style={styles.cardDetail}>
//                         ${Number(item.price).toFixed(2)}
//                       </Text>
//                     </View>
//                     <View style={styles.rowActions}>
//                       <TouchableOpacity
//                         style={[styles.smallButton, styles.smallButtonDanger]}
//                         onPress={() => onRemoveShopItem(item.id)}
//                       >
//                         <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>
//                           Remove
//                         </Text>
//                       </TouchableOpacity>
//                     </View>
//                   </View>
//                 ))
//               ) : (
//                 <Text style={styles.optionDescription}>No items yet.</Text>
//               )}
//             </View>
//           )}

//           {/* CUSTOMERS */}
//           {tab === 'customers' && (
//             <View style={styles.adminSection}>
//               <Text style={styles.sectionTitle}>Customers</Text>
//               {users?.length ? (
//                 users.map((u) => (
//                   <View key={u.username} style={styles.listRow}>
//                     <View>
//                       <Text style={styles.listRowTitle}>{u.fullName || '(no name)'}</Text>
//                       <Text style={styles.cardDetail}>@{u.username} · {u.email || ''}</Text>
//                     </View>
//                     <View style={styles.rowActions}>
//                       <TouchableOpacity style={styles.smallButton} onPress={() => startEditUser(u)}>
//                         <Text style={styles.smallButtonLabel}>Edit</Text>
//                       </TouchableOpacity>
//                       <TouchableOpacity
//                         style={[styles.smallButton, styles.smallButtonDanger]}
//                         onPress={() => onDeleteUserAdmin(u.username)}
//                       >
//                         <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Delete</Text>
//                       </TouchableOpacity>
//                     </View>
//                   </View>
//                 ))
//               ) : (
//                 <Text style={styles.optionDescription}>No users yet.</Text>
//               )}

//               {selectedUser && (
//                 <View style={[styles.card, { marginTop: 12 }]}>
//                   <Text style={styles.sectionTitle}>Edit @{selectedUser}</Text>
//                   <View style={styles.stackForm}>
//                     <TextInput
//                       style={styles.input}
//                       value={editUser.fullName}
//                       onChangeText={(v) => setEditUser((p) => ({ ...p, fullName: v }))}
//                       placeholder="Full name"
//                       placeholderTextColor="#8a8a8a"
//                     />
//                     <TextInput
//                       style={styles.input}
//                       value={editUser.email}
//                       onChangeText={(v) => setEditUser((p) => ({ ...p, email: v }))}
//                       placeholder="Email"
//                       placeholderTextColor="#8a8a8a"
//                       autoCapitalize="none"
//                     />
//                     <TextInput
//                       style={styles.input}
//                       value={editUser.password}
//                       onChangeText={(v) => setEditUser((p) => ({ ...p, password: v }))}
//                       placeholder="New password (optional)"
//                       placeholderTextColor="#8a8a8a"
//                       secureTextEntry
//                     />
//                     <View style={styles.rowActions}>
//                       <TouchableOpacity
//                         style={styles.smallButton}
//                         onPress={() => { setSelectedUser(null); setEditUser({ fullName: '', email: '', password: '' }); }}
//                       >
//                         <Text style={styles.smallButtonLabel}>Cancel</Text>
//                       </TouchableOpacity>
//                       <TouchableOpacity
//                         style={[styles.smallButton, styles.smallButtonDanger]}
//                         onPress={saveUser}
//                       >
//                         <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Save</Text>
//                       </TouchableOpacity>
//                     </View>
//                   </View>
//                 </View>
//               )}
//             </View>
//           )}

//           {/* AVAILABILITY */}
//           {tab === 'availability' && (
//             <View style={styles.adminSection}>
//               <Text style={styles.sectionTitle}>Barber availability</Text>
//               <View style={styles.barberTabRow}>
//                 {barbers.map((b) => (
//                   <TouchableOpacity
//                     key={b.id}
//                     style={[styles.barberTabButton, selectedBarber === b.id && styles.barberTabButtonActive]}
//                     onPress={() => setSelectedBarber(b.id)}
//                   >
//                     <Text style={[styles.barberTabLabel, selectedBarber === b.id && styles.barberTabLabelActive]}>
//                       {b.name}
//                     </Text>
//                   </TouchableOpacity>
//                 ))}
//               </View>

//               <View style={styles.dayGrid}>
//                 {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d) => (
//                   <TouchableOpacity
//                     key={d}
//                     style={[styles.dayChip, selectedDay === d && styles.dayChipActive]}
//                     onPress={() => setSelectedDay(d)}
//                   >
//                     <Text style={[styles.dayChipLabel, selectedDay === d && styles.dayChipLabelActive]}>
//                       {d}
//                     </Text>
//                   </TouchableOpacity>
//                 ))}
//               </View>

//               <View style={{ marginTop: 12 }}>
//                 <Text style={styles.cardDetail}>Slots for {selectedDay}</Text>
//                 <View style={styles.timeGrid}>
//                   {(daySlots || []).map((t) => (
//                     <TouchableOpacity key={t} style={styles.timeChip} onPress={() => removeSlot(t)}>
//                       <Text style={styles.timeChipLabel}>{t} ✕</Text>
//                     </TouchableOpacity>
//                   ))}
//                 </View>

//                 <View style={[styles.inlineForm, { marginTop: 12 }]}>
//                   <TextInput
//                     style={styles.miniInput}
//                     value={slotInput}
//                     onChangeText={setSlotInput}
//                     placeholder="HH:MM"
//                     placeholderTextColor="#8a8a8a"
//                     autoCapitalize="none"
//                   />
//                   <TouchableOpacity style={[styles.smallButton, styles.smallButtonDanger]} onPress={addSlot}>
//                     <Text style={[styles.smallButtonLabel, styles.smallButtonLabelAlt]}>Add slot</Text>
//                   </TouchableOpacity>
//                 </View>
//               </View>
//             </View>
//           )}

//           {/* SCHEDULE (CALENDAR) */}
//           {tab === 'schedule' && (
//             <View style={styles.adminSection}>
//               <Text style={styles.sectionTitle}>Reservations schedule</Text>
//               <ScrollView horizontal style={styles.calendarScroll} showsHorizontalScrollIndicator={false}>
//                 <View>
//                   {/* Header row */}
//                   <View style={styles.calendarHeaderRow}>
//                     <View style={[styles.calendarCell, styles.calendarTimeHeader]}>
//                       <Text style={styles.calendarHeaderText}>Time</Text>
//                     </View>
//                     {dayOptions.map((day) => (
//                       <View key={day} style={[styles.calendarCell, styles.calendarDayHeader]}>
//                         <Text style={styles.calendarHeaderText}>{day}</Text>
//                       </View>
//                     ))}
//                   </View>
//                   {/* Grid rows */}
//                   {HALF_HOUR_SLOTS.map((slot) => (
//                     <View key={slot} style={styles.calendarRow}>
//                       <View style={[styles.calendarCell, styles.calendarTimeCell]}>
//                         <Text style={styles.calendarTimeLabel}>{slot}</Text>
//                       </View>
//                       {dayOptions.map((day) => {
//                         const res = indexByDayTime?.[day]?.[slot];
//                         return (
//                           <View key={day} style={styles.calendarCell}>
//                             {res ? (
//                               <>
//                                 <Text style={styles.calendarClient}>{res.client}</Text>
//                                 <Text style={styles.calendarMeta}>{res.service} · {res.barber}</Text>
//                               </>
//                             ) : (
//                               <Text style={styles.calendarEmpty}>—</Text>
//                             )}
//                           </View>
//                         );
//                       })}
//                     </View>
//                   ))}
//                 </View>
//               </ScrollView>
//             </View>
//           )}
//         </ScrollView>
//       </View>
//     </SafeAreaView>
//   );
// };  
  

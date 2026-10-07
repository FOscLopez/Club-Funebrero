import { 
  getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, writeBatch, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"; 
import { app } from "./firebase.config.js";

// ==========================================
// ¡AQUÍ ESTÁ LA SOLUCIÓN AL ERROR!
// Conectamos a tu base de datos llamada "funebrero" 
// ==========================================
export const db = getFirestore(app, "funebrero");

// ==============================
// FIXTURES (PARTIDOS)
// ==============================
export async function getFixtures() {
  try {
    const snapshot = await getDocs(query(collection(db, "fixtures"), orderBy("createdAt", "desc")));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) { return []; }
}

export function listenToFixtures(callback) {
  return onSnapshot(collection(db, "fixtures"), (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
}

export async function updateFixture(id, data) {
  await updateDoc(doc(db, "fixtures", id), data);
}

export async function deleteFixture(id) {
  await deleteDoc(doc(db, "fixtures", id));
}

// ==============================
// JUGADORES / PLANTELES
// ==============================
export async function getPlayers() {
  try {
    const snapshot = await getDocs(collection(db, "players"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) { return []; }
}

export async function addPlayersBulk(playersArray) {
  const batch = writeBatch(db);
  playersArray.forEach(p => {
    const newRef = doc(collection(db, "players"));
    batch.set(newRef, p);
  });
  await batch.commit();
}

export async function updatePlayer(id, data) {
  await updateDoc(doc(db, "players", id), data);
}

export async function deletePlayer(id) {
  await deleteDoc(doc(db, "players", id));
}

// ==============================
// INSTITUCIONAL (ACTAS E HISTORIA PDF)
// ==============================
export async function getMeetings() {
  try {
    const snapshot = await getDocs(collection(db, "meetings"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch(e) { return []; }
}

export function listenToMeetings(callback) {
  return onSnapshot(collection(db, "meetings"), (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
}

export async function createMeeting(data) {
  data.createdAt = new Date().toISOString();
  await addDoc(collection(db, "meetings"), data);
}

export async function updateMeeting(id, data) {
  await updateDoc(doc(db, "meetings", id), data);
}

export async function deleteMeeting(id) {
  await deleteDoc(doc(db, "meetings", id));
}

// ==============================
// SPONSORS (CARRUSEL)
// ==============================
export async function getSponsors() {
  try {
    const snapshot = await getDocs(collection(db, "sponsors"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) { return []; }
}

export function listenToSponsors(callback) {
  return onSnapshot(collection(db, "sponsors"), (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
}

export async function createSponsor(data) {
  data.createdAt = new Date().toISOString();
  await addDoc(collection(db, "sponsors"), data);
}

export async function updateSponsor(id, data) {
  await updateDoc(doc(db, "sponsors", id), data);
}

export async function deleteSponsor(id) {
  await deleteDoc(doc(db, "sponsors", id));
}

// ==============================
// PORTAL SOCIOS
// ==============================
export async function getSocios() {
  try {
    const snapshot = await getDocs(query(collection(db, "socios"), orderBy("name", "asc")));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) { return []; }
}

export async function addSociosBulk(sociosArray) {
  const batch = writeBatch(db);
  sociosArray.forEach(s => {
    const newRef = doc(collection(db, "socios"));
    batch.set(newRef, s);
  });
  await batch.commit();
}

export async function deleteSocio(id) {
  await deleteDoc(doc(db, "socios", id));
}

export async function getSocioByDni(dni) {
  try {
      const q = query(collection(db, "socios"), where("dni", "==", dni));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (e) { return null; }
}

export async function registerPaymentIntent(data) {
  try {
      data.createdAt = new Date().toISOString();
      data.status = "pendiente";
      const docRef = await addDoc(collection(db, "pagos_socios"), data);
      return docRef.id;
  } catch (e) { return null; }
}

// ==============================
// CARRUSEL PRINCIPAL DE FOTOS
// ==============================
export async function getCarouselImages() {
  try {
    const snapshot = await getDocs(query(collection(db, "carousel_images"), orderBy("createdAt", "desc")));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) { return []; }
}

export function listenToCarouselImages(callback) {
  return onSnapshot(collection(db, "carousel_images"), (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  });
}

export async function createCarouselImage(data) {
  data.createdAt = new Date().toISOString();
  await addDoc(collection(db, "carousel_images"), data);
}

export async function deleteCarouselImage(id) {
  await deleteDoc(doc(db, "carousel_images", id));
}

// ==============================
// PRÓXIMOS PARTIDOS (NUEVO)
// ==============================
export async function getUpcomingMatches() {
  try {
    const snapshot = await getDocs(query(collection(db, "upcoming_matches"), orderBy("createdAt", "asc")));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) { return []; }
}

export function listenToUpcomingMatches(callback) {
  return onSnapshot(collection(db, "upcoming_matches"), (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
  });
}

export async function createUpcomingMatch(data) {
  data.createdAt = new Date().toISOString();
  await addDoc(collection(db, "upcoming_matches"), data);
}

export async function deleteUpcomingMatch(id) {
  await deleteDoc(doc(db, "upcoming_matches", id));
}
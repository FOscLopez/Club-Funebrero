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
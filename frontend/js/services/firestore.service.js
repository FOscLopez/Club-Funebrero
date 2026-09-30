import { db } from "./firebase.config.js";
import { collection, getDocs, doc, writeBatch, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==============================
// GESTIÓN DE FIXTURES (EN VIVO Y ADMIN)
// ==============================
export async function getFixtures() {
    try {
        const snapshot = await getDocs(collection(db, "fixtures"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error al obtener los partidos:", error);
        return [];
    }
}

export function listenToFixtures(callback) {
    const q = query(collection(db, "fixtures"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error("Error escuchando fixtures:", error);
        callback([]);
    });
}

export const addFixture = async (data) => await addDoc(collection(db, "fixtures"), data);
export const updateFixture = async (id, data) => await updateDoc(doc(db, "fixtures", id), data);
export const deleteFixture = async (id) => await deleteDoc(doc(db, "fixtures", id));

// ==============================
// JUGADORES Y PLANTELES
// ==============================
export async function getPlayers() {
    try {
        const snapshot = await getDocs(collection(db, "players"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error al obtener jugadores:", error);
        return [];
    }
}

export async function addPlayersBulk(playersArray) {
    try {
        const batch = writeBatch(db);
        playersArray.forEach(player => {
            const newRef = doc(collection(db, "players"));
            batch.set(newRef, player);
        });
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error en carga masiva:", error);
        throw error;
    }
}

export const updatePlayer = async (id, data) => await updateDoc(doc(db, "players", id), data);
export const deletePlayer = async (id) => await deleteDoc(doc(db, "players", id));

// ==============================
// COMPLEMENTOS PÚBLICOS (Sponsors, Noticias, etc.)
// ==============================
export async function getClubs() {
    try {
        const snap = await getDocs(collection(db, "clubs"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
}

export async function getCategories() {
    try {
        const snap = await getDocs(collection(db, "categories"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
}

export async function getNews() {
    try {
        const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
}

export async function getMeetings() {
    try {
        const snap = await getDocs(collection(db, "meetings"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
}

export async function getSponsors() {
    try {
        const snap = await getDocs(collection(db, "sponsors"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
}

export function listenToSystemSettings(callback) {
    try {
        return onSnapshot(doc(db, "settings", "system"), (docSnap) => {
            if (docSnap.exists()) callback(docSnap.data());
            else callback({ maintenance: false });
        });
    } catch (e) { callback({ maintenance: false }); }
}

export function buildStandings(fixtures, clubs) {
    // Función disponible para evitar errores de sintaxis si el motor la solicita
    return [];
}